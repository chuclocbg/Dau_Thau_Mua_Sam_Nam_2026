/**
 * Legal v7.9 — TemplateDependencyResolver
 *
 * resolve(lastAppliedDate, currentDate) → TemplateDependencyResult
 *
 * Consumes a DependencyGraphResult and expands domain-level nodes and edges
 * into template-level nodes and edges using the static TEMPLATE_REGISTRY.
 *
 * Template node shape:
 *   { id: templateId, domain: domainId, type: 'TEMPLATE' }
 *
 * Node order:
 *   1. Domain order from DependencyGraphResult.nodes (first-appearance order)
 *   2. Registry order within each domain
 *
 * Template edge types:
 *   SELF   — every template → itself; one per template; always present
 *   DOMAIN — cross-domain: for each domain edge where from ≠ to, connect
 *            every template in the source domain to every template in the
 *            target domain
 *
 * SELF domain edges (NARROW scope, from === to) do not generate DOMAIN
 * template edges; intra-domain self-references are already captured by the
 * SELF template edges.
 *
 * For NONE scope or non-READY status the domain node list is empty, so
 * templates and templateEdges naturally resolve to [].
 *
 * Edge count formula:
 *   SELF edges:   templates.length
 *   DOMAIN edges: Σ |src_templates| × |dst_templates| for each CROSS domain edge
 *
 * For forward real data (4 domains: GENERAL/3, HR/1, BIDDING/4, FINANCIAL/2):
 *   10 templates, 10 SELF edges, 70 DOMAIN edges → 80 total template edges
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * resolveFromDependency() is exported so tests can inject synthetic
 * DependencyGraphResult objects for all scope/topology/domain combinations.
 *
 * Calls DependencyGraphBuilder.build() exactly once.
 * Never calls ImpactAnalyzer, KnowledgeGraphBuilder, RegulationClassifier,
 * RegulationParser, RegulationFetcher, SnapshotBuilder,
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

import { DependencyGraphBuilder }       from './DependencyGraphBuilder';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';
import { TEMPLATE_REGISTRY }            from '../legal/templateRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export type TemplateNodeType = 'TEMPLATE';
export type TemplateEdgeType = 'SELF' | 'DOMAIN';

export interface TemplateNode {
  id:     string;
  domain: string;
  type:   TemplateNodeType;
}

export interface TemplateEdge {
  from: string;
  to:   string;
  type: TemplateEdgeType;
}

export interface TemplateDependencyMetadata {
  templateCount: number;
  edgeCount:     number;
  targetDate:    string;
}

export interface TemplateDependencyResult {
  status:        SnapshotStatus;
  impactScope:   ImpactScope;
  impactLevel:   ImpactLevel;
  templates:     readonly TemplateNode[];
  templateEdges: readonly TemplateEdge[];
  metadata:      TemplateDependencyMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinDepNode {
  id:   string;
  type: string;
}

interface MinDepEdge {
  from: string;
  to:   string;
  type: string;
}

interface MinDependency {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  nodes:       readonly MinDepNode[];
  edges:       readonly MinDepEdge[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function resolveFromDependency(dep: MinDependency): TemplateDependencyResult {
  const { status, impactScope, impactLevel } = dep;
  const targetDate = dep.metadata.targetDate;

  // Expand domain nodes → template nodes (domain order then registry order)
  const domainNodes = dep.nodes.filter(n => n.type === 'DOMAIN');
  const templates: TemplateNode[] = [];
  for (const domNode of domainNodes) {
    for (const id of TEMPLATE_REGISTRY[domNode.id] ?? []) {
      templates.push({ id, domain: domNode.id, type: 'TEMPLATE' });
    }
  }

  const templateEdges: TemplateEdge[] = [];

  // SELF edges — one per template
  for (const t of templates) {
    templateEdges.push({ from: t.id, to: t.id, type: 'SELF' });
  }

  // DOMAIN edges — expand each cross-domain edge to template pairs
  for (const dEdge of dep.edges) {
    if (dEdge.from === dEdge.to) continue; // skip self-referential domain edges
    const srcTemplates = templates.filter(t => t.domain === dEdge.from);
    const dstTemplates = templates.filter(t => t.domain === dEdge.to);
    for (const src of srcTemplates) {
      for (const dst of dstTemplates) {
        templateEdges.push({ from: src.id, to: dst.id, type: 'DOMAIN' });
      }
    }
  }

  const metadata: TemplateDependencyMetadata = {
    templateCount: templates.length,
    edgeCount:     templateEdges.length,
    targetDate,
  };

  return { status, impactScope, impactLevel, templates, templateEdges, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class TemplateDependencyResolver {
  constructor(
    private readonly depGraphBuilder: DependencyGraphBuilder = new DependencyGraphBuilder(),
  ) {}

  resolve(lastAppliedDate: string, currentDate: string): TemplateDependencyResult {
    return resolveFromDependency(this.depGraphBuilder.build(lastAppliedDate, currentDate));
  }
}
