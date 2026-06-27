/**
 * Phase 11.3 — Graph Query Engine
 *
 * Pure traversal layer over the Legal Knowledge Graph.
 *
 * ─── API ──────────────────────────────────────────────────────────────────────
 *
 *   findParents(id)                       → direct predecessors (nodes with edges TO id)
 *   findChildren(id)                      → direct successors (nodes id has edges TO)
 *   findAncestors(id, edgeTypes?)         → all transitive predecessors (BFS on inEdges)
 *   findDescendants(id, edgeTypes?)       → all transitive successors (BFS on outEdges)
 *   findDependents(id)                    → nodes with depends_on edge TO id
 *   findImpacts(id)                       → full set of nodes affected if id changes
 *   topologicalOrder()                    → Kahn's sort; appends cycle members at end
 *   findNodesByType(type)                 → all nodes with matching NodeType
 *   findEdgesBetween(fromId, toId)        → all edges connecting two specific nodes
 *
 * ─── findImpacts algorithm ────────────────────────────────────────────────────
 *
 *   BFS from id following two complementary directions:
 *
 *   FORWARD_TYPES (change propagates along the edge):
 *     defines    — if A defines B, B changes when A changes
 *     used_by    — if A is used_by B, B is affected when A changes
 *
 *   REVERSE_TYPES (change propagates against the edge):
 *     implements   — A implements id → A may need updating
 *     depends_on   — A depends_on id → A breaks
 *     requires     — A requires id → A affected
 *     references   — A references id → A may need updating
 *     derived_from — A derived_from id → A needs recalculation
 *
 *   supersedes edges carry no impact — history only.
 *
 *   Phase 11.4 (Impact Analyzer) can extend this by:
 *   - Scoring nodes by GraphEdge.weight
 *   - Adding domain-specific rules (e.g. PROCUREMENT_THRESHOLD change triggers
 *     automatic re-audit of all AUDIT_RULE nodes in scope)
 *   - Filtering by NodeStatus (skip DEPRECATED nodes)
 *
 * ─── topologicalOrder ────────────────────────────────────────────────────────
 *
 *   Kahn's algorithm; stable due to alphabetical tie-breaking.
 *   Cycle members (nodes never reaching in-degree 0) are appended in source
 *   order so callers always receive a complete list of nodes.
 *
 * buildGraphQueryEngine() is the factory following the Phase 10/11 pattern.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

import type { EdgeType, GraphEdge, GraphNode, MinKnowledgeGraph, NodeType } from './knowledgeGraph';

// ─── Impact propagation sets (module-level constants) ─────────────────────────

const FORWARD_TYPES = new Set<EdgeType>(['defines', 'used_by']);

const REVERSE_TYPES = new Set<EdgeType>([
  'implements',
  'depends_on',
  'requires',
  'references',
  'derived_from',
]);

// ─── Engine class ─────────────────────────────────────────────────────────────

export class GraphQueryEngine {
  constructor(private readonly graph: MinKnowledgeGraph) {}

  // ── Direct neighbors ───────────────────────────────────────────────────────

  /** Nodes with any outgoing edge TO id (predecessors in the directed graph). */
  findParents(id: string): readonly GraphNode[] {
    return (this.graph.inEdges[id] ?? [])
      .map(e => this.graph.nodeIndex[e.from])
      .filter((n): n is GraphNode => n !== undefined);
  }

  /** Nodes that id has outgoing edges TO (successors in the directed graph). */
  findChildren(id: string): readonly GraphNode[] {
    return (this.graph.outEdges[id] ?? [])
      .map(e => this.graph.nodeIndex[e.to])
      .filter((n): n is GraphNode => n !== undefined);
  }

  // ── Transitive traversal ───────────────────────────────────────────────────

  /**
   * All transitive predecessors of id (BFS following inbound edges).
   * @param edgeTypes  If provided, only follow edges of these types.
   */
  findAncestors(
    id:         string,
    edgeTypes?: readonly EdgeType[],
  ): readonly GraphNode[] {
    const typeSet = edgeTypes ? new Set(edgeTypes) : null;
    const visited = new Set<string>([id]);
    const queue   = [id];
    const result: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of (this.graph.inEdges[current] ?? [])) {
        if (typeSet !== null && !typeSet.has(edge.type)) continue;
        if (visited.has(edge.from)) continue;
        visited.add(edge.from);
        queue.push(edge.from);
        const node = this.graph.nodeIndex[edge.from];
        if (node) result.push(node);
      }
    }

    return result;
  }

  /**
   * All transitive successors of id (BFS following outbound edges).
   * @param edgeTypes  If provided, only follow edges of these types.
   */
  findDescendants(
    id:         string,
    edgeTypes?: readonly EdgeType[],
  ): readonly GraphNode[] {
    const typeSet = edgeTypes ? new Set(edgeTypes) : null;
    const visited = new Set<string>([id]);
    const queue   = [id];
    const result: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of (this.graph.outEdges[current] ?? [])) {
        if (typeSet !== null && !typeSet.has(edge.type)) continue;
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push(edge.to);
        const node = this.graph.nodeIndex[edge.to];
        if (node) result.push(node);
      }
    }

    return result;
  }

  // ── Dependency queries ─────────────────────────────────────────────────────

  /**
   * Nodes that have a direct depends_on edge pointing TO id.
   * These are the immediate consumers of id's contract.
   */
  findDependents(id: string): readonly GraphNode[] {
    return (this.graph.inEdges[id] ?? [])
      .filter(e => e.type === 'depends_on')
      .map(e => this.graph.nodeIndex[e.from])
      .filter((n): n is GraphNode => n !== undefined);
  }

  /**
   * Full set of nodes affected when id changes.
   *
   * BFS in two complementary directions:
   *   Forward  (along edge)  : defines, used_by
   *   Reverse  (against edge): implements, depends_on, requires, references, derived_from
   *
   * Cycles are handled by the visited set — no infinite loops.
   * id itself is excluded from the result.
   */
  findImpacts(id: string): readonly GraphNode[] {
    if (!this.graph.nodeIndex[id]) return [];

    const visited = new Set<string>([id]);
    const queue   = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Forward: what current defines or is used by
      for (const edge of (this.graph.outEdges[current] ?? [])) {
        if (FORWARD_TYPES.has(edge.type) && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }

      // Reverse: who implements, depends on, requires, references, or derives from current
      for (const edge of (this.graph.inEdges[current] ?? [])) {
        if (REVERSE_TYPES.has(edge.type) && !visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push(edge.from);
        }
      }
    }

    visited.delete(id);
    return [...visited]
      .map(nodeId => this.graph.nodeIndex[nodeId])
      .filter((n): n is GraphNode => n !== undefined);
  }

  // ── Topological ordering ───────────────────────────────────────────────────

  /**
   * Kahn's topological sort over all graph nodes.
   * Alphabetical tie-breaking ensures deterministic output.
   * Cycle members (nodes that never reach in-degree 0) are appended
   * after all acyclic nodes, in their original source order.
   */
  topologicalOrder(): readonly GraphNode[] {
    // Compute in-degrees
    const inDeg = new Map<string, number>();
    for (const node of this.graph.nodes) inDeg.set(node.id, 0);
    for (const node of this.graph.nodes) {
      for (const edge of (this.graph.outEdges[node.id] ?? [])) {
        inDeg.set(edge.to, (inDeg.get(edge.to) ?? 0) + 1);
      }
    }

    // Seed queue with zero-in-degree nodes, sorted for determinism
    const queue: string[] = [...inDeg.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id)
      .sort();

    const result:    GraphNode[]  = [];
    const processed = new Set<string>();

    while (queue.length > 0) {
      // ponytail: sort per iteration, O(k log k); fine for governance-sized graphs
      queue.sort();
      const id = queue.shift()!;
      processed.add(id);
      const node = this.graph.nodeIndex[id];
      if (node) result.push(node);

      for (const edge of (this.graph.outEdges[id] ?? [])) {
        const d = (inDeg.get(edge.to) ?? 1) - 1;
        inDeg.set(edge.to, d);
        if (d === 0 && !processed.has(edge.to)) queue.push(edge.to);
      }
    }

    // Append cycle members in source order
    for (const node of this.graph.nodes) {
      if (!processed.has(node.id)) result.push(node);
    }

    return result;
  }

  // ── Convenience queries ────────────────────────────────────────────────────

  /** All nodes with the specified NodeType. */
  findNodesByType(type: NodeType): readonly GraphNode[] {
    return this.graph.nodes.filter(n => n.type === type);
  }

  /**
   * All edges directly connecting fromId → toId (any edge type).
   * Returns edges in the outEdges[fromId] array order.
   */
  findEdgesBetween(fromId: string, toId: string): readonly GraphEdge[] {
    return (this.graph.outEdges[fromId] ?? []).filter(e => e.to === toId);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildGraphQueryEngine(graph: MinKnowledgeGraph): GraphQueryEngine {
  return new GraphQueryEngine(graph);
}
