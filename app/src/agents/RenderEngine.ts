/**
 * Legal v8.3 — RenderEngine
 *
 * render(lastAppliedDate, currentDate) → RenderResult
 *
 * Consumes a DocumentRegenerationResult and distributes GeneratedDocuments
 * into two priority buckets for the downstream artifact generator.
 * No template rendering, no filesystem access, no DOCX generation.
 * Pure render planning layer.
 *
 * RenderTask shape (copied from GeneratedDocument, no value transformation):
 *   { documentId, priority, required }
 *
 * Priority buckets:
 *   highPriority   — priority 1 or 2
 *   normalPriority — priority 3 or 4
 *
 * renderQueue ordering:
 *   [...highPriority, ...normalPriority]
 *   Source order preserved within each bucket.  No sorting.  No dedup.
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty generatedDocuments):
 *   renderQueue = [], highPriority = [], normalPriority = []
 *   Natural result of empty input from v8.2.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * renderFromRegeneration() is exported so tests can inject synthetic
 * DocumentRegenerationResult objects for all priority/bucket scenarios.
 *
 * Calls DocumentRegenerator.regenerate() exactly once.
 * Never calls RegenerationPlanner, DocumentDependencyResolver,
 * TemplateDependencyResolver, DependencyGraphBuilder, ImpactAnalyzer,
 * KnowledgeGraphBuilder, RegulationClassifier, RegulationParser,
 * RegulationFetcher, SnapshotBuilder, OfficialSourceConnector,
 * GovernmentCrawler, NotificationCenter, SchedulerAgent, WorkflowAgent,
 * RollbackManager, HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No randomness. No side effects.
 * No AI. No LLM. No DOCX. No filesystem. No browser globals. No hooks.
 * No IndexedDB. No HTTP.
 */

import { DocumentRegenerator }          from './DocumentRegenerator';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Priority threshold: priority ≤ 2 → high, > 2 → normal ──────────────────

const HIGH_PRIORITY_MAX = 2;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RenderTask {
  documentId: string;
  priority:   number;
  required:   boolean;
}

export interface RenderMetadata {
  renderCount: number;
  highCount:   number;
  normalCount: number;
  targetDate:  string;
}

export interface RenderResult {
  status:         SnapshotStatus;
  impactScope:    ImpactScope;
  impactLevel:    ImpactLevel;
  renderQueue:    readonly RenderTask[];
  highPriority:   readonly RenderTask[];
  normalPriority: readonly RenderTask[];
  metadata:       RenderMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinRegenDoc {
  id:       string;
  priority: number;
  required: boolean;
}

interface MinRegen {
  status:             SnapshotStatus;
  impactScope:        ImpactScope;
  impactLevel:        ImpactLevel;
  generatedDocuments: readonly MinRegenDoc[];
  metadata:           { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function renderFromRegeneration(regen: MinRegen): RenderResult {
  const { status, impactScope, impactLevel } = regen;
  const targetDate = regen.metadata.targetDate;

  const highPriority:   RenderTask[] = [];
  const normalPriority: RenderTask[] = [];

  for (const doc of regen.generatedDocuments) {
    const task: RenderTask = {
      documentId: doc.id,
      priority:   doc.priority,
      required:   doc.required,
    };
    if (doc.priority <= HIGH_PRIORITY_MAX) {
      highPriority.push(task);
    } else {
      normalPriority.push(task);
    }
  }

  // High bucket always precedes normal bucket; source order preserved within each
  const renderQueue: RenderTask[] = [...highPriority, ...normalPriority];

  const metadata: RenderMetadata = {
    renderCount: renderQueue.length,
    highCount:   highPriority.length,
    normalCount: normalPriority.length,
    targetDate,
  };

  return { status, impactScope, impactLevel, renderQueue, highPriority, normalPriority, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RenderEngine {
  constructor(
    private readonly regenerator: DocumentRegenerator = new DocumentRegenerator(),
  ) {}

  render(lastAppliedDate: string, currentDate: string): RenderResult {
    return renderFromRegeneration(this.regenerator.regenerate(lastAppliedDate, currentDate));
  }
}
