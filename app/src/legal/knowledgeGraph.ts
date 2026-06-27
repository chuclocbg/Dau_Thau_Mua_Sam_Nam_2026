/**
 * Phase 11.3 — Enterprise Legal Knowledge Graph: Core Types
 *
 * Central dependency model for the AI Governance Platform.
 *
 * NodeType covers the full Vietnamese legal and operational hierarchy:
 *
 *   Legal instruments (ordered by authority):
 *     LAW                 — Luật (National Assembly)
 *     RESOLUTION          — Nghị quyết (National Assembly / Standing Committee)
 *     DECREE              — Nghị định (Government)
 *     CIRCULAR            — Thông tư (Ministry)
 *     DECISION            — Quyết định (PM / Ministry)
 *     INTERNAL_REGULATION — Quy chế nội bộ (Institution)
 *     GUIDELINE           — Hướng dẫn
 *
 *   Operational artifacts:
 *     PROCUREMENT_THRESHOLD — Ngưỡng giá trị đấu thầu (money thresholds)
 *     WORKFLOW              — Quy trình nghiệp vụ
 *     AUDIT_RULE            — Quy tắc kiểm tra
 *     TEMPLATE              — Mẫu tài liệu (Word/Excel templates)
 *     PROMPT_RULE           — Quy tắc nhắc lệnh AI
 *     CHECKLIST             — Danh mục kiểm tra
 *
 * EdgeType models all cross-domain dependency relationships:
 *
 *   implements   — A (Decree) implements B (Law)
 *   defines      — A (Circular) defines B (Threshold): if A changes, B changes
 *   supersedes   — A (new) supersedes B (old): history edge, no impact propagation
 *   depends_on   — A (Audit Rule) depends_on B (Threshold): B changes → A affected
 *   used_by      — A (Template) used_by B (Workflow): A changes → B affected
 *   requires     — A (Workflow) requires B (Checklist): B changes → A affected
 *   references   — A (Prompt Rule) references B (Audit Rule): B changes → A may need update
 *   derived_from — A (Threshold value) derived_from B (Decree): B changes → A recalculated
 *
 * Impact propagation rules (used by findImpacts in graphQueryEngine.ts):
 *   Forward  — change propagates along the edge:   defines, used_by
 *   Reverse  — change propagates against the edge: implements, depends_on, requires,
 *                                                  references, derived_from
 *   Excluded — no automatic propagation:           supersedes
 *
 * Extension points for Phase 11.4 (Impact Analyzer):
 *   Add GraphNode.impactWeight?: number for prioritised scoring.
 *   Add EdgeType 'governs' for future cross-institution relationships.
 *   Add GraphNode.applicableFrom?: string for time-bounded impact windows.
 *
 * createNode() and createEdge() are pure factory helpers — no I/O, no mutation.
 * buildKnowledgeGraph() is the only constructor for KnowledgeGraph values.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

// ─── Node types ───────────────────────────────────────────────────────────────

export type NodeType =
  | 'LAW'
  | 'RESOLUTION'
  | 'DECREE'
  | 'CIRCULAR'
  | 'DECISION'
  | 'INTERNAL_REGULATION'
  | 'GUIDELINE'
  | 'PROCUREMENT_THRESHOLD'
  | 'WORKFLOW'
  | 'AUDIT_RULE'
  | 'TEMPLATE'
  | 'PROMPT_RULE'
  | 'CHECKLIST';

export type NodeStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DRAFT'
  | 'DEPRECATED';

// ─── Edge types ───────────────────────────────────────────────────────────────

export type EdgeType =
  | 'implements'
  | 'defines'
  | 'supersedes'
  | 'depends_on'
  | 'used_by'
  | 'requires'
  | 'references'
  | 'derived_from';

// ─── Domain entities ──────────────────────────────────────────────────────────

export interface GraphNode {
  readonly id:             string;
  readonly type:           NodeType;
  readonly label:          string;
  readonly status:         NodeStatus;
  readonly sourceId?:      string;      // Links to LegalDocument.id or other registry key
  readonly effectiveDate?: string;      // YYYY-MM-DD
  readonly version?:       string;      // Semantic version for non-legal nodes
  readonly metadata:       Readonly<Record<string, string>>;
}

export interface GraphEdge {
  readonly id:       string;
  readonly from:     string;    // Source node id
  readonly to:       string;    // Target node id
  readonly type:     EdgeType;
  readonly weight?:  number;    // Extension point: edge priority / confidence weight
  readonly metadata: Readonly<Record<string, string>>;
}

// ─── Graph aggregate ──────────────────────────────────────────────────────────

export interface GraphMetadata {
  readonly version:   string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodeTypes: readonly NodeType[];
  readonly edgeTypes: readonly EdgeType[];
}

export interface KnowledgeGraph {
  readonly nodes:     readonly GraphNode[];
  readonly edges:     readonly GraphEdge[];
  readonly nodeIndex: Readonly<Record<string, GraphNode>>;
  readonly edgeIndex: Readonly<Record<string, GraphEdge>>;
  readonly outEdges:  Readonly<Record<string, readonly GraphEdge[]>>;
  readonly inEdges:   Readonly<Record<string, readonly GraphEdge[]>>;
  readonly metadata:  GraphMetadata;
}

// ─── MinXxx interface for dependency injection ────────────────────────────────

/** Narrow interface — graphQueryEngine and future Impact Analyzer inject this. */
export interface MinKnowledgeGraph {
  readonly nodes:     readonly GraphNode[];
  readonly nodeIndex: Readonly<Record<string, GraphNode>>;
  readonly outEdges:  Readonly<Record<string, readonly GraphEdge[]>>;
  readonly inEdges:   Readonly<Record<string, readonly GraphEdge[]>>;
}

// ─── Type-set constants ───────────────────────────────────────────────────────

export const NODE_TYPES: readonly NodeType[] = [
  'LAW',
  'RESOLUTION',
  'DECREE',
  'CIRCULAR',
  'DECISION',
  'INTERNAL_REGULATION',
  'GUIDELINE',
  'PROCUREMENT_THRESHOLD',
  'WORKFLOW',
  'AUDIT_RULE',
  'TEMPLATE',
  'PROMPT_RULE',
  'CHECKLIST',
];

export const EDGE_TYPES: readonly EdgeType[] = [
  'implements',
  'defines',
  'supersedes',
  'depends_on',
  'used_by',
  'requires',
  'references',
  'derived_from',
];

export const NODE_STATUSES: readonly NodeStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'DEPRECATED',
];

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' &&
    (NODE_TYPES as readonly string[]).includes(value);
}

export function isEdgeType(value: unknown): value is EdgeType {
  return typeof value === 'string' &&
    (EDGE_TYPES as readonly string[]).includes(value);
}

export function isNodeStatus(value: unknown): value is NodeStatus {
  return typeof value === 'string' &&
    (NODE_STATUSES as readonly string[]).includes(value);
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function createNode(
  id:      string,
  type:    NodeType,
  label:   string,
  options?: {
    readonly status?:        NodeStatus;
    readonly sourceId?:      string;
    readonly effectiveDate?: string;
    readonly version?:       string;
    readonly metadata?:      Record<string, string>;
  },
): GraphNode {
  return {
    id,
    type,
    label,
    status:        options?.status         ?? 'ACTIVE',
    sourceId:      options?.sourceId,
    effectiveDate: options?.effectiveDate,
    version:       options?.version,
    metadata:      Object.freeze(options?.metadata ?? {}),
  };
}

export function createEdge(
  id:    string,
  from:  string,
  to:    string,
  type:  EdgeType,
  options?: {
    readonly weight?:   number;
    readonly metadata?: Record<string, string>;
  },
): GraphEdge {
  return {
    id,
    from,
    to,
    type,
    weight:   options?.weight,
    metadata: Object.freeze(options?.metadata ?? {}),
  };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function freezeEdgeLists(
  map: Record<string, GraphEdge[]>,
): Readonly<Record<string, readonly GraphEdge[]>> {
  const out: Record<string, readonly GraphEdge[]> = {};
  for (const key of Object.keys(map)) {
    out[key] = Object.freeze(map[key]!);
  }
  return Object.freeze(out);
}

/**
 * Builds the immutable, fully-indexed KnowledgeGraph from raw arrays.
 * Does NOT validate — that is the responsibility of LegalGraphBuilder.
 *
 * @param nodes    Graph nodes in any order.
 * @param edges    Graph edges in any order.
 * @param version  Graph schema version (default '1.0.0').
 */
export function buildKnowledgeGraph(
  nodes:   readonly GraphNode[],
  edges:   readonly GraphEdge[],
  version  = '1.0.0',
): KnowledgeGraph {
  const nodeIndex: Record<string, GraphNode> = {};
  const edgeIndex: Record<string, GraphEdge> = {};
  const outEdges:  Record<string, GraphEdge[]> = {};
  const inEdges:   Record<string, GraphEdge[]> = {};

  const nodeTypesSet = new Set<NodeType>();
  const edgeTypesSet = new Set<EdgeType>();

  for (const node of nodes) {
    nodeIndex[node.id] = node;
    outEdges[node.id]  = outEdges[node.id] ?? [];
    inEdges[node.id]   = inEdges[node.id]  ?? [];
    nodeTypesSet.add(node.type);
  }

  for (const edge of edges) {
    edgeIndex[edge.id] = edge;
    edgeTypesSet.add(edge.type);

    // Ensure adjacency lists exist even for edge endpoints not yet in nodes
    outEdges[edge.from] = outEdges[edge.from] ?? [];
    inEdges[edge.to]    = inEdges[edge.to]    ?? [];

    outEdges[edge.from]!.push(edge);
    inEdges[edge.to]!.push(edge);
  }

  return {
    nodes,
    edges,
    nodeIndex: Object.freeze(nodeIndex),
    edgeIndex: Object.freeze(edgeIndex),
    outEdges:  freezeEdgeLists(outEdges),
    inEdges:   freezeEdgeLists(inEdges),
    metadata: {
      version,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: Object.freeze([...nodeTypesSet]),
      edgeTypes: Object.freeze([...edgeTypesSet]),
    },
  };
}
