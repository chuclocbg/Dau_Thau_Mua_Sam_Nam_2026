/**
 * Legal v7.7 — ImpactAnalyzer
 *
 * analyze(lastAppliedDate, currentDate) → ImpactAnalysisResult
 *
 * Consumes a KnowledgeGraphResult and classifies the regulatory impact
 * into a scope and severity level based on the number and identity of
 * affected domains.
 *
 * Domain extraction:
 *   impactedDomains = graph.nodes.filter(n => n.type === 'DOMAIN').map(n => n.id)
 *   Order: first-appearance order inherited from KnowledgeGraphBuilder.
 *   REGULATION nodes are excluded.
 *
 * Scope rules (count = impactedDomains.length):
 *   0 domains → NONE
 *   1 domain  → NARROW
 *   2+ domains → BROAD
 *
 * Level rules:
 *   NONE scope        → NONE
 *   NARROW, no GENERAL → LOW
 *   BROAD, no GENERAL  → HIGH
 *   GENERAL present   → CRITICAL (any scope, takes precedence over NARROW and BROAD)
 *
 * GENERAL escalation rationale: the Government Portal (GOV_PORTAL) issues
 * cross-ministerial instruments that are not scoped to a single domain.
 * Any regulatory cycle that touches GENERAL therefore potentially affects
 * every domain simultaneously, making the impact CRITICAL regardless of
 * whether the scope appears narrow.
 *
 * Status forwarded unchanged from KnowledgeGraphResult — never recomputed:
 *   READY            — analysis performed as described above
 *   PENDING_APPROVAL — impactedDomains=[], impactScope='NONE', impactLevel='NONE'
 *   UNCHANGED        — same as PENDING_APPROVAL
 *
 * analyzeFromGraph() is exported so tests can inject synthetic
 * KnowledgeGraphResult objects for all scope/level combinations.
 *
 * Calls KnowledgeGraphBuilder.build() exactly once.
 * Never calls RegulationClassifier, RegulationParser, RegulationFetcher,
 * SnapshotBuilder, OfficialSourceConnector, GovernmentCrawler,
 * NotificationCenter, SchedulerAgent, WorkflowAgent, RollbackManager,
 * HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent,
 * or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No AI. No NLP. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { KnowledgeGraphBuilder } from './KnowledgeGraphBuilder';
import type { SnapshotStatus }   from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ImpactScope = 'NONE' | 'NARROW' | 'BROAD';
export type ImpactLevel = 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL';

export interface ImpactMetadata {
  domainCount: number;
  nodeCount:   number;
  edgeCount:   number;
  targetDate:  string;
}

export interface ImpactAnalysisResult {
  status:          SnapshotStatus;
  impactedDomains: readonly string[];
  impactScope:     ImpactScope;
  impactLevel:     ImpactLevel;
  metadata:        ImpactMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinNode {
  id:   string;
  type: string;
}

interface MinGraph {
  status:   SnapshotStatus;
  nodes:    readonly MinNode[];
  metadata: { nodeCount: number; edgeCount: number; targetDate: string };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function computeScope(count: number): ImpactScope {
  if (count === 0) return 'NONE';
  if (count === 1) return 'NARROW';
  return 'BROAD';
}

function computeLevel(scope: ImpactScope, domains: readonly string[]): ImpactLevel {
  if (scope === 'NONE') return 'NONE';
  if (domains.includes('GENERAL')) return 'CRITICAL';
  if (scope === 'NARROW') return 'LOW';
  return 'HIGH';
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function analyzeFromGraph(graph: MinGraph): ImpactAnalysisResult {
  const status     = graph.status;
  const targetDate = graph.metadata.targetDate;

  const baseMeta: ImpactMetadata = {
    domainCount: 0,
    nodeCount:   graph.metadata.nodeCount,
    edgeCount:   graph.metadata.edgeCount,
    targetDate,
  };

  if (status !== 'READY') {
    return {
      status,
      impactedDomains: [],
      impactScope:     'NONE',
      impactLevel:     'NONE',
      metadata:        baseMeta,
    };
  }

  const impactedDomains = graph.nodes
    .filter(n => n.type === 'DOMAIN')
    .map(n => n.id);

  const impactScope = computeScope(impactedDomains.length);
  const impactLevel = computeLevel(impactScope, impactedDomains);

  const metadata: ImpactMetadata = {
    domainCount: impactedDomains.length,
    nodeCount:   graph.metadata.nodeCount,
    edgeCount:   graph.metadata.edgeCount,
    targetDate,
  };

  return { status, impactedDomains, impactScope, impactLevel, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class ImpactAnalyzer {
  constructor(
    private readonly graphBuilder: KnowledgeGraphBuilder = new KnowledgeGraphBuilder(),
  ) {}

  analyze(lastAppliedDate: string, currentDate: string): ImpactAnalysisResult {
    return analyzeFromGraph(this.graphBuilder.build(lastAppliedDate, currentDate));
  }
}
