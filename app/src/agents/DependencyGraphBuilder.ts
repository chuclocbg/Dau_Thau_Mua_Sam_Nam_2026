/**
 * Legal v7.8 — DependencyGraphBuilder
 *
 * build(lastAppliedDate, currentDate) → DependencyGraphResult
 *
 * Consumes an ImpactAnalysisResult and constructs a directed dependency
 * graph whose topology is determined by the impact scope:
 *
 *   NONE   — 0 nodes, 0 edges
 *   NARROW — 1 node,  1 SELF edge (domain → itself)
 *   BROAD  — n nodes, n*(n-1) CROSS edges (complete directed graph, no self)
 *
 * Node shape:
 *   { id: domain, type: 'DOMAIN' }
 *   Order: same as impactedDomains (first-appearance order from ImpactAnalyzer).
 *
 * Edge shapes:
 *   { from, to, type: 'SELF'  } — used in NARROW scope only
 *   { from, to, type: 'CROSS' } — used in BROAD scope
 *
 * GENERAL escalation:
 *   When impactLevel === 'CRITICAL' and 'GENERAL' is in impactedDomains,
 *   after the normal edges are generated, edges from GENERAL to every other
 *   domain are appended (type: 'CROSS'). Duplicates are prevented by tracking
 *   seen `from→to` keys; first occurrence wins.
 *   In practice the normal BROAD edge loop already covers GENERAL→X, so the
 *   escalation block is a no-op for BROAD scope. For NARROW scope (single
 *   GENERAL domain), there are no other nodes to escalate to. The code is
 *   present as a safety guarantee that GENERAL→X edges always exist under
 *   CRITICAL impact, regardless of future scope-rule changes.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 * PENDING_APPROVAL and UNCHANGED return nodes=[], edges=[].
 *
 * buildFromImpact() is exported so tests can inject synthetic
 * ImpactAnalysisResult objects for all scope/level/escalation combinations.
 *
 * Calls ImpactAnalyzer.analyze() exactly once.
 * Never calls KnowledgeGraphBuilder, RegulationClassifier, RegulationParser,
 * RegulationFetcher, SnapshotBuilder, OfficialSourceConnector,
 * GovernmentCrawler, NotificationCenter, SchedulerAgent, WorkflowAgent,
 * RollbackManager, HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No AI. No NLP. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { ImpactAnalyzer }    from './ImpactAnalyzer';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export type DependencyNodeType = 'DOMAIN';
export type DependencyEdgeType = 'SELF' | 'CROSS';

export interface DependencyNode {
  id:   string;
  type: DependencyNodeType;
}

export interface DependencyEdge {
  from: string;
  to:   string;
  type: DependencyEdgeType;
}

export interface DependencyMetadata {
  domainCount: number;
  edgeCount:   number;
  targetDate:  string;
}

export interface DependencyGraphResult {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  nodes:       readonly DependencyNode[];
  edges:       readonly DependencyEdge[];
  metadata:    DependencyMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinImpact {
  status:          SnapshotStatus;
  impactedDomains: readonly string[];
  impactScope:     ImpactScope;
  impactLevel:     ImpactLevel;
  metadata:        { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildFromImpact(impact: MinImpact): DependencyGraphResult {
  const { status, impactedDomains, impactScope, impactLevel } = impact;
  const targetDate = impact.metadata.targetDate;

  if (status !== 'READY') {
    return {
      status, impactScope, impactLevel,
      nodes: [], edges: [],
      metadata: { domainCount: 0, edgeCount: 0, targetDate },
    };
  }

  // Nodes — one per domain, order preserved
  const nodes: DependencyNode[] = impactedDomains.map(id => ({ id, type: 'DOMAIN' }));

  // Edges — topology determined by scope
  const edges: DependencyEdge[] = [];

  if (impactScope === 'NARROW' && impactedDomains.length > 0) {
    const id = impactedDomains[0];
    edges.push({ from: id, to: id, type: 'SELF' });
  } else if (impactScope === 'BROAD') {
    for (const from of impactedDomains) {
      for (const to of impactedDomains) {
        if (from !== to) {
          edges.push({ from, to, type: 'CROSS' });
        }
      }
    }
  }

  // GENERAL escalation — ensures GENERAL→X edges exist under CRITICAL impact
  if (impactLevel === 'CRITICAL' && impactedDomains.includes('GENERAL')) {
    const seen = new Set(edges.map(e => `${e.from}→${e.to}`));
    for (const to of impactedDomains) {
      if (to !== 'GENERAL') {
        const key = `GENERAL→${to}`;
        if (!seen.has(key)) {
          edges.push({ from: 'GENERAL', to, type: 'CROSS' });
          seen.add(key);
        }
      }
    }
  }

  const metadata: DependencyMetadata = {
    domainCount: nodes.length,
    edgeCount:   edges.length,
    targetDate,
  };

  return { status, impactScope, impactLevel, nodes, edges, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DependencyGraphBuilder {
  constructor(
    private readonly impactAnalyzer: ImpactAnalyzer = new ImpactAnalyzer(),
  ) {}

  build(lastAppliedDate: string, currentDate: string): DependencyGraphResult {
    return buildFromImpact(this.impactAnalyzer.analyze(lastAppliedDate, currentDate));
  }
}
