/**
 * Legal v7.6 — KnowledgeGraphBuilder
 *
 * build(lastAppliedDate, currentDate) → KnowledgeGraphResult
 *
 * Consumes a ClassifyResult and constructs a bipartite directed graph:
 *
 *   DOMAIN nodes — one per unique domain, ordered by first appearance
 *   REGULATION nodes — one per classified regulation, order preserved
 *   BELONGS_TO edges — one per regulation, from regulation url to domain
 *
 * Node schema:
 *   { id: string, type: 'DOMAIN' | 'REGULATION', label: string }
 *
 *   DOMAIN:     id = domain string (e.g. 'BIDDING'), label = domain string
 *   REGULATION: id = url, label = title
 *
 * Edge schema:
 *   { from: string, to: string, relation: 'BELONGS_TO' }
 *
 *   from = regulation url, to = domain string
 *
 * Node order: domain nodes precede regulation nodes.
 *   Domain nodes are ordered by first appearance of their domain in the
 *   input regulations array (no sorting, no grouping).
 *   Regulation nodes follow in the same order as the regulations array.
 *
 * Status forwarded unchanged from RegulationClassifier — never recomputed:
 *
 *   READY            — graph generated as described above
 *   PENDING_APPROVAL — nodes = [], edges = []
 *   UNCHANGED        — nodes = [], edges = []
 *
 * metadata.domainCount = nodes.filter(n => n.type === 'DOMAIN').length
 * This equals the number of distinct domains in the input, which may be
 * less than the number of regulations when multiple regulations share a domain.
 *
 * buildFromClassified() is exported so tests can inject synthetic ClassifyResult
 * objects for all status paths and for graph topology edge cases.
 *
 * Calls RegulationClassifier.classify() exactly once.
 * Never calls RegulationParser, RegulationFetcher, SnapshotBuilder,
 * OfficialSourceConnector, GovernmentCrawler, NotificationCenter,
 * SchedulerAgent, WorkflowAgent, RollbackManager, HumanReviewQueue,
 * TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent, or any v4.x
 * engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No AI. No NLP. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { RegulationClassifier } from './RegulationClassifier';
import type { SnapshotStatus }  from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export type NodeType     = 'DOMAIN' | 'REGULATION';
export type EdgeRelation = 'BELONGS_TO';

export interface GraphNode {
  id:    string;
  type:  NodeType;
  label: string;
}

export interface GraphEdge {
  from:     string;
  to:       string;
  relation: EdgeRelation;
}

export interface GraphMetadata {
  nodeCount:   number;
  edgeCount:   number;
  domainCount: number;
  targetDate:  string;
}

export interface KnowledgeGraphResult {
  status:   SnapshotStatus;
  nodes:    readonly GraphNode[];
  edges:    readonly GraphEdge[];
  metadata: GraphMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinReg {
  url:    string;
  title:  string;
  domain: string;
}

interface MinClassified {
  status:      SnapshotStatus;
  regulations: readonly MinReg[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildFromClassified(classified: MinClassified): KnowledgeGraphResult {
  const status     = classified.status;
  const targetDate = classified.metadata.targetDate;

  if (status !== 'READY') {
    return {
      status,
      nodes: [],
      edges: [],
      metadata: { nodeCount: 0, edgeCount: 0, domainCount: 0, targetDate },
    };
  }

  // Domain nodes — deduplicated, first-appearance order
  const seenDomains = new Set<string>();
  const domainNodes: GraphNode[] = [];
  for (const reg of classified.regulations) {
    if (!seenDomains.has(reg.domain)) {
      seenDomains.add(reg.domain);
      domainNodes.push({ id: reg.domain, type: 'DOMAIN', label: reg.domain });
    }
  }

  // Regulation nodes — input order preserved
  const regNodes: GraphNode[] = classified.regulations.map(reg => ({
    id:    reg.url,
    type:  'REGULATION',
    label: reg.title,
  }));

  const nodes: readonly GraphNode[] = [...domainNodes, ...regNodes];

  // Edges — one per regulation
  const edges: readonly GraphEdge[] = classified.regulations.map(reg => ({
    from:     reg.url,
    to:       reg.domain,
    relation: 'BELONGS_TO',
  }));

  const metadata: GraphMetadata = {
    nodeCount:   nodes.length,
    edgeCount:   edges.length,
    domainCount: domainNodes.length,
    targetDate,
  };

  return { status, nodes, edges, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class KnowledgeGraphBuilder {
  constructor(
    private readonly classifier: RegulationClassifier = new RegulationClassifier(),
  ) {}

  build(lastAppliedDate: string, currentDate: string): KnowledgeGraphResult {
    return buildFromClassified(this.classifier.classify(lastAppliedDate, currentDate));
  }
}
