/**
 * Phase 11.4 — Governance Impact Engine
 *
 * The reasoning layer between the Legal Knowledge Graph and all future
 * governance modules. Determines every object affected by a legal change,
 * classifies each impact, calculates severity, and produces structured reports.
 *
 * ─── Public APIs ──────────────────────────────────────────────────────────────
 *
 *   classifyImpact(node)                          → ImpactCategory
 *   calculateSeverity(depth, edgeType, conf?)     → ImpactSeverity
 *   engine.analyzeImpact(nodeId, options?)        → readonly ImpactRecord[]
 *   engine.findAffectedNodes(nodeId, options?)    → readonly GraphNode[]
 *   engine.findCriticalImpacts(nodeId, options?)  → readonly ImpactRecord[]
 *   engine.findPropagationPath(fromId, toId)      → readonly string[]
 *   engine.generateImpactReport(nodeId, options?) → ImpactReport
 *   buildGovernanceImpactEngine(graph)            → GovernanceImpactEngine
 *
 * ─── Propagation rules (inherited from Phase 11.3) ────────────────────────────
 *
 *   Forward (follow outEdge.to):    defines, used_by
 *   Reverse (follow inEdge.from):   implements, depends_on, requires,
 *                                   references, derived_from
 *   Excluded:                       supersedes (history edge, no impact)
 *
 * ─── Severity scoring ─────────────────────────────────────────────────────────
 *
 *   base  = max(0, 4 − depth)          → High(3) at 1, down to Informational(0) at 5+
 *   +1    depends_on / implements       strong coupling amplifies
 *   −1    references / used_by          loose coupling attenuates
 *   −1    confidence < 0.7              low legal confidence attenuates
 *
 * ─── Extension point interfaces (Phase 11.5+) ────────────────────────────────
 *
 *   LegalConfigurationHook  — Phase 11.5 Legal Configuration Engine
 *   WorkflowTrigger         — Future Workflow Engine
 *   DocumentGeneratorHook   — Future Document Generator
 *   AuthorityEngineHook     — Future Authority Engine
 *   LegalReasoningHook      — Future Legal Reasoning Engine
 *   ExecutiveCopilotHook    — Future Executive Copilot
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input
 * (except generatedAt timestamp). No any. No React. No browser globals.
 */

import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  MinKnowledgeGraph,
  NodeType,
} from './knowledgeGraph';

// ─── Impact category ──────────────────────────────────────────────────────────

export type ImpactCategory =
  | 'Legal'
  | 'Threshold'
  | 'Workflow'
  | 'Approval'
  | 'Template'
  | 'Audit'
  | 'Prompt'
  | 'Checklist'
  | 'Risk'
  | 'Governance'
  | 'Unknown';

const NODE_TYPE_CATEGORY: Readonly<Record<NodeType, ImpactCategory>> = Object.freeze({
  LAW:                   'Legal',
  RESOLUTION:            'Legal',
  DECREE:                'Legal',
  CIRCULAR:              'Legal',
  DECISION:              'Legal',
  INTERNAL_REGULATION:   'Legal',
  GUIDELINE:             'Legal',
  PROCUREMENT_THRESHOLD: 'Threshold',
  WORKFLOW:              'Workflow',
  AUDIT_RULE:            'Audit',
  TEMPLATE:              'Template',
  PROMPT_RULE:           'Prompt',
  CHECKLIST:             'Checklist',
});

export function classifyImpact(node: GraphNode): ImpactCategory {
  return NODE_TYPE_CATEGORY[node.type] ?? 'Unknown';
}

// ─── Impact severity ──────────────────────────────────────────────────────────

export type ImpactSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

const SEVERITY_SCALE: readonly ImpactSeverity[] =
  ['Informational', 'Low', 'Medium', 'High', 'Critical'];

const HIGH_COUPLING = new Set<EdgeType>(['depends_on', 'implements']);
const LOW_COUPLING  = new Set<EdgeType>(['references', 'used_by']);

/**
 * Calculates impact severity from depth, edge type, and optional legal confidence.
 *
 * base  = max(0, 4 − depth)  → High at depth 1, Informational at depth 5+
 * +1 for depends_on / implements (strong coupling)
 * −1 for references / used_by  (loose coupling)
 * −1 when confidence < 0.7     (uncertain legal source)
 *
 * Future: pass GraphEdge.weight here to support weighted severity.
 */
export function calculateSeverity(
  depth:      number,
  edgeType:   EdgeType,
  confidence = 1.0,
): ImpactSeverity {
  let score = Math.max(0, 4 - depth);
  if (HIGH_COUPLING.has(edgeType)) score += 1;
  if (LOW_COUPLING.has(edgeType))  score -= 1;
  if (confidence < 0.7)            score -= 1;
  return SEVERITY_SCALE[Math.max(0, Math.min(4, score))]!;
}

// ─── Core data structures ─────────────────────────────────────────────────────

export interface ImpactRecord {
  readonly node:             GraphNode;
  readonly category:         ImpactCategory;
  readonly severity:         ImpactSeverity;
  readonly depth:            number;
  readonly reason:           string;
  readonly dependencyChain:  readonly string[];   // node ids from source → this node
  readonly relationshipPath: readonly GraphEdge[]; // edges traversed from source → this node
}

export interface ImpactReport {
  readonly sourceNodeId:  string;
  readonly sourceNode:    GraphNode | undefined;
  readonly impacts:       readonly ImpactRecord[];
  readonly criticalCount: number;
  readonly highCount:     number;
  readonly reviewOrder:   readonly string[]; // node ids sorted: severity desc, depth asc, id asc
  readonly generatedAt:   string;            // ISO-8601 timestamp
}

export interface AnalysisOptions {
  readonly maxDepth?:       number;
  readonly traversalMode?:  'bfs' | 'dfs';
  readonly edgeTypes?:      readonly EdgeType[];
  readonly confidence?:     number;
}

// ─── Extension point interfaces (Phase 11.5+) ────────────────────────────────

/** Phase 11.5 — Legal Configuration Engine: receives the report after analysis. */
export interface LegalConfigurationHook {
  onImpactAnalyzed(report: ImpactReport): void;
}

/** Future — Workflow Engine: trigger a review workflow per affected record. */
export interface WorkflowTrigger {
  triggerReview(record: ImpactRecord): void;
}

/** Future — Document Generator: request regeneration of impacted templates. */
export interface DocumentGeneratorHook {
  requestUpdate(nodeId: string, severity: ImpactSeverity): void;
}

/** Future — Authority Engine: determine approval chain for an impact. */
export interface AuthorityEngineHook {
  requiresApproval(severity: ImpactSeverity): boolean;
}

/** Future — Legal Reasoning Engine: produce natural-language explanation. */
export interface LegalReasoningHook {
  explain(record: ImpactRecord): string;
}

/** Future — Executive Copilot: produce board-level summary. */
export interface ExecutiveCopilotHook {
  summarize(report: ImpactReport): string;
}

// ─── Propagation constants ────────────────────────────────────────────────────

const FORWARD_TYPES = new Set<EdgeType>(['defines', 'used_by']);
const REVERSE_TYPES = new Set<EdgeType>([
  'implements', 'depends_on', 'requires', 'references', 'derived_from',
]);

// ─── Internal traversal entry ─────────────────────────────────────────────────

interface TraversalEntry {
  readonly nodeId:      string;
  readonly depth:       number;
  readonly chain:       readonly string[];
  readonly path:        readonly GraphEdge[];
  readonly inboundEdge: GraphEdge | null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GovernanceImpactEngine {
  constructor(private readonly graph: MinKnowledgeGraph) {}

  /**
   * Returns a structured ImpactRecord for every node affected by a change
   * to nodeId, with category, severity, depth, and full dependency chain.
   */
  analyzeImpact(nodeId: string, options: AnalysisOptions = {}): readonly ImpactRecord[] {
    return this._traverse(nodeId, options);
  }

  /**
   * Returns the set of GraphNode objects reachable via impact propagation
   * from nodeId. Lightweight wrapper around analyzeImpact.
   */
  findAffectedNodes(nodeId: string, options: AnalysisOptions = {}): readonly GraphNode[] {
    return this._traverse(nodeId, options).map(r => r.node);
  }

  /**
   * Returns only Critical and High severity impact records.
   * Entry point for escalation workflows (Phase 11.5).
   */
  findCriticalImpacts(nodeId: string, options: AnalysisOptions = {}): readonly ImpactRecord[] {
    return this._traverse(nodeId, options)
      .filter(r => r.severity === 'Critical' || r.severity === 'High');
  }

  /**
   * Returns the shortest node-id path from fromId to toId following impact
   * propagation edges. Returns [] if no path exists or either id is unknown.
   */
  findPropagationPath(fromId: string, toId: string): readonly string[] {
    if (fromId === toId) return [fromId];
    if (!this.graph.nodeIndex[fromId] || !this.graph.nodeIndex[toId]) return [];

    const parent = new Map<string, string | null>([[fromId, null]]);
    const queue  = [fromId];

    outer: while (queue.length > 0) {
      const current = queue.shift()!;

      for (const edge of (this.graph.outEdges[current] ?? [])) {
        if (FORWARD_TYPES.has(edge.type) && !parent.has(edge.to)) {
          parent.set(edge.to, current);
          if (edge.to === toId) break outer;
          queue.push(edge.to);
        }
      }

      for (const edge of (this.graph.inEdges[current] ?? [])) {
        if (REVERSE_TYPES.has(edge.type) && !parent.has(edge.from)) {
          parent.set(edge.from, current);
          if (edge.from === toId) break outer;
          queue.push(edge.from);
        }
      }
    }

    if (!parent.has(toId)) return [];

    const path: string[] = [toId];
    let cur: string | null | undefined = toId;
    while ((cur = parent.get(cur as string) ?? null) !== null) path.unshift(cur as string);
    return path;
  }

  /**
   * Generates a complete structured ImpactReport.
   * reviewOrder sorts impacted nodes by severity desc → depth asc → id asc,
   * giving the recommended sequence for compliance review.
   */
  generateImpactReport(nodeId: string, options: AnalysisOptions = {}): ImpactReport {
    const impacts    = this._traverse(nodeId, options);
    const sourceNode = this.graph.nodeIndex[nodeId];

    const reviewOrder = [...impacts]
      .sort((a, b) => {
        const sd = SEVERITY_SCALE.indexOf(b.severity) - SEVERITY_SCALE.indexOf(a.severity);
        if (sd !== 0) return sd;
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.node.id.localeCompare(b.node.id);
      })
      .map(r => r.node.id);

    return {
      sourceNodeId:  nodeId,
      sourceNode,
      impacts,
      criticalCount: impacts.filter(r => r.severity === 'Critical').length,
      highCount:     impacts.filter(r => r.severity === 'High').length,
      reviewOrder,
      generatedAt:   new Date().toISOString(),
    };
  }

  // ── Private traversal ──────────────────────────────────────────────────────

  private _traverse(nodeId: string, options: AnalysisOptions): ImpactRecord[] {
    const {
      maxDepth      = Infinity,
      traversalMode = 'bfs',
      edgeTypes,
      confidence    = 1.0,
    } = options;

    if (!this.graph.nodeIndex[nodeId]) return [];

    const typeFilter  = edgeTypes ? new Set(edgeTypes) : null;
    const visited     = new Set<string>([nodeId]);
    const collection: TraversalEntry[] = [{
      nodeId, depth: 0, chain: [nodeId], path: [], inboundEdge: null,
    }];
    const records: ImpactRecord[] = [];

    while (collection.length > 0) {
      const entry = traversalMode === 'bfs' ? collection.shift()! : collection.pop()!;
      const { nodeId: current, depth, chain, path } = entry;

      if (depth > 0) {
        const node = this.graph.nodeIndex[current];
        if (node) {
          const edgeType = entry.inboundEdge!.type;
          records.push({
            node,
            category:         classifyImpact(node),
            severity:         calculateSeverity(depth, edgeType, confidence),
            depth,
            reason:           buildReason(entry, this.graph),
            dependencyChain:  chain,
            relationshipPath: path,
          });
        }
      }

      if (depth >= maxDepth) continue;

      for (const edge of (this.graph.outEdges[current] ?? [])) {
        if (!FORWARD_TYPES.has(edge.type))                      continue;
        if (typeFilter !== null && !typeFilter.has(edge.type))  continue;
        if (visited.has(edge.to))                               continue;
        visited.add(edge.to);
        collection.push({
          nodeId: edge.to, depth: depth + 1,
          chain: [...chain, edge.to], path: [...path, edge], inboundEdge: edge,
        });
      }

      for (const edge of (this.graph.inEdges[current] ?? [])) {
        if (!REVERSE_TYPES.has(edge.type))                      continue;
        if (typeFilter !== null && !typeFilter.has(edge.type))  continue;
        if (visited.has(edge.from))                             continue;
        visited.add(edge.from);
        collection.push({
          nodeId: edge.from, depth: depth + 1,
          chain: [...chain, edge.from], path: [...path, edge], inboundEdge: edge,
        });
      }
    }

    return records;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReason(entry: TraversalEntry, graph: MinKnowledgeGraph): string {
  const edge     = entry.inboundEdge!;
  const prevId   = entry.chain[entry.chain.length - 2]!;
  const prevNode = graph.nodeIndex[prevId];
  const src      = prevNode ? `'${prevNode.label}'` : `'${prevId}'`;
  return `${edge.type} relationship from ${src} at depth ${entry.depth}`;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildGovernanceImpactEngine(graph: MinKnowledgeGraph): GovernanceImpactEngine {
  return new GovernanceImpactEngine(graph);
}
