/**
 * Phase 11.3 — Legal Graph Builder
 *
 * Fluent builder for constructing a KnowledgeGraph from structured metadata.
 * No legal knowledge is hardcoded — all graph content comes from caller-supplied
 * GraphNode and GraphEdge values (or LegalDocument objects via nodeFromLegalDocument).
 *
 * LegalGraphBuilder provides:
 *   addNode(node)    — add a single node
 *   addEdge(edge)    — add a single edge
 *   addNodes(nodes)  — bulk-add nodes
 *   addEdges(edges)  — bulk-add edges
 *   build(version?)  — produce an immutable KnowledgeGraph
 *   reset()          — clear accumulated state for reuse
 *
 * LegalGraphBuilder validates on build():
 *   DUPLICATE_NODE_ID  — two nodes share the same id
 *   DUPLICATE_EDGE_ID  — two edges share the same id
 *   BROKEN_EDGE_FROM   — edge.from references an unknown node id
 *   BROKEN_EDGE_TO     — edge.to references an unknown node id
 *
 * On build() errors, the builder returns { ok: false, errors }.
 * The graph is only constructed when the input is clean.
 *
 * nodeFromLegalDocument() converts a LegalDocument to a GraphNode.
 * edgeFromSupersession() converts a supersededBy reference to a GraphEdge.
 * These helpers connect Phase 11.2 (LegalRegistry) to Phase 11.3 (KnowledgeGraph).
 *
 * Extension points for Phase 11.4 (Impact Analyzer):
 *   Phase 11.4 can add subgraph extraction helpers here, e.g.:
 *   subgraphForLegalDocument(docId, depth) using GraphQueryEngine internally.
 *
 * buildGraph() is a convenience function for single-call construction.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

import {
  buildKnowledgeGraph,
  createEdge,
  createNode,
} from './knowledgeGraph';
import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  NodeStatus,
  NodeType,
} from './knowledgeGraph';
import type { LegalDocument, LegalDocumentStatus } from './legalRegistry';

// ─── Build error types ────────────────────────────────────────────────────────

export type BuildErrorCode =
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'BROKEN_EDGE_FROM'
  | 'BROKEN_EDGE_TO';

export interface GraphBuildError {
  readonly code:    BuildErrorCode;
  readonly message: string;
  readonly id?:     string;
}

export type GraphBuildResult =
  | { readonly ok: true;  readonly graph: KnowledgeGraph }
  | { readonly ok: false; readonly errors: readonly GraphBuildError[] };

// ─── LegalDocument → GraphNode mapping ───────────────────────────────────────

function legalStatusToNodeStatus(status: LegalDocumentStatus): NodeStatus {
  switch (status) {
    case 'ACTIVE':    return 'ACTIVE';
    case 'DRAFT':     return 'DRAFT';
    case 'EXPIRED':   return 'INACTIVE';
    case 'SUPERSEDED':return 'INACTIVE';
    case 'REPEALED':  return 'DEPRECATED';
  }
}

/**
 * Converts a LegalDocument from Phase 11.2 into a GraphNode.
 * The first 7 LegalDocumentType values map 1-to-1 onto NodeType values.
 */
export function nodeFromLegalDocument(doc: LegalDocument): GraphNode {
  // Safe cast: LegalDocumentType ⊆ NodeType for all 7 legal instrument kinds
  const type = doc.type as NodeType;
  return createNode(doc.id, type, doc.title, {
    status:        legalStatusToNodeStatus(doc.status),
    sourceId:      doc.id,
    effectiveDate: doc.effectiveDate,
    metadata:      { symbol: doc.symbol, issuer: doc.issuer },
  });
}

/**
 * Creates a supersedes GraphEdge from a LegalDocument's supersededBy field.
 * Returns undefined if the document has no supersededBy reference.
 */
export function edgeFromSupersession(
  doc: LegalDocument,
  edgeIdSuffix = '',
): GraphEdge | undefined {
  if (doc.supersededBy === undefined) return undefined;
  const edgeId = `${doc.id}-supersedes-${doc.supersededBy}${edgeIdSuffix}`;
  return createEdge(edgeId, doc.id, doc.supersededBy, 'supersedes');
}

/**
 * Creates a defines GraphEdge from a document to a target node id.
 */
export function edgeFromDefinition(
  fromDocId: string,
  toNodeId:  string,
  type:      EdgeType = 'defines',
): GraphEdge {
  return createEdge(`${fromDocId}-${type}-${toNodeId}`, fromDocId, toNodeId, type);
}

// ─── Builder class ────────────────────────────────────────────────────────────

export class LegalGraphBuilder {
  private _nodes: GraphNode[] = [];
  private _edges: GraphEdge[] = [];

  addNode(node: GraphNode): this {
    this._nodes.push(node);
    return this;
  }

  addEdge(edge: GraphEdge): this {
    this._edges.push(edge);
    return this;
  }

  addNodes(nodes: readonly GraphNode[]): this {
    for (const n of nodes) this._nodes.push(n);
    return this;
  }

  addEdges(edges: readonly GraphEdge[]): this {
    for (const e of edges) this._edges.push(e);
    return this;
  }

  /** Clears accumulated state. Returns this for chaining. */
  reset(): this {
    this._nodes = [];
    this._edges = [];
    return this;
  }

  /**
   * Validates and builds the graph.
   * Returns ok:true with graph on success, ok:false with errors on failure.
   */
  build(version?: string): GraphBuildResult {
    const errors: GraphBuildError[] = [];

    // Duplicate node ids
    const seenNodeIds = new Set<string>();
    for (const node of this._nodes) {
      if (seenNodeIds.has(node.id)) {
        errors.push({
          code:    'DUPLICATE_NODE_ID',
          message: `Duplicate node id "${node.id}".`,
          id:      node.id,
        });
      } else {
        seenNodeIds.add(node.id);
      }
    }

    // Duplicate edge ids
    const seenEdgeIds = new Set<string>();
    for (const edge of this._edges) {
      if (seenEdgeIds.has(edge.id)) {
        errors.push({
          code:    'DUPLICATE_EDGE_ID',
          message: `Duplicate edge id "${edge.id}".`,
          id:      edge.id,
        });
      } else {
        seenEdgeIds.add(edge.id);
      }
    }

    // Referential integrity (only check if no duplicates so ids are trustworthy)
    if (!errors.some(e => e.code === 'DUPLICATE_NODE_ID')) {
      for (const edge of this._edges) {
        if (!seenNodeIds.has(edge.from)) {
          errors.push({
            code:    'BROKEN_EDGE_FROM',
            message: `Edge "${edge.id}" references unknown from-node "${edge.from}".`,
            id:      edge.id,
          });
        }
        if (!seenNodeIds.has(edge.to)) {
          errors.push({
            code:    'BROKEN_EDGE_TO',
            message: `Edge "${edge.id}" references unknown to-node "${edge.to}".`,
            id:      edge.id,
          });
        }
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok:    true,
      graph: buildKnowledgeGraph(this._nodes, this._edges, version),
    };
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

/**
 * Single-call graph construction — validates and builds in one step.
 * Throws only if nodes or edges are undefined (never for validation errors).
 */
export function buildGraph(
  nodes:    readonly GraphNode[],
  edges:    readonly GraphEdge[],
  version?: string,
): GraphBuildResult {
  return new LegalGraphBuilder()
    .addNodes(nodes)
    .addEdges(edges)
    .build(version);
}

// Re-export createNode and createEdge so callers need only one import
export { createNode, createEdge };
