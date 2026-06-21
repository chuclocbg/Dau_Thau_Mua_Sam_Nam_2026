/**
 * Legal v8.2 — DocumentRegenerator
 *
 * regenerate(lastAppliedDate, currentDate) → DocumentRegenerationResult
 *
 * Consumes a RegenerationPlan and produces GeneratedDocument records with
 * assigned priority numbers and required flags.  No template rendering
 * occurs here — this is a pure orchestration layer.
 *
 * GeneratedDocument shape:
 *   { id, priority, required }
 *
 * Priority assignment:
 *   impactLevel CRITICAL → mandatory priority = 1
 *   impactLevel HIGH     → mandatory priority = 2
 *   impactLevel LOW      → mandatory priority = 3
 *   optional (any level) → priority = 4
 *
 * generatedDocuments ordering:
 *   All mandatoryGenerated first (source order), then optionalGenerated
 *   (source order).  No sorting within buckets.
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty plan buckets):
 *   generatedDocuments = [], mandatoryGenerated = [], optionalGenerated = []
 *   This is the natural result of empty mandatoryDocuments/optionalDocuments
 *   from v8.1.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * regenerateFromPlan() is exported so tests can inject synthetic
 * RegenerationPlan objects for all priority/bucket scenarios.
 *
 * Calls RegenerationPlanner.plan() exactly once.
 * Never calls DocumentDependencyResolver, TemplateDependencyResolver,
 * DependencyGraphBuilder, ImpactAnalyzer, KnowledgeGraphBuilder,
 * RegulationClassifier, RegulationParser, RegulationFetcher, SnapshotBuilder,
 * OfficialSourceConnector, GovernmentCrawler, NotificationCenter,
 * SchedulerAgent, WorkflowAgent, RollbackManager, HumanReviewQueue,
 * TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent, or any v4.x
 * engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No randomness. No side effects.
 * No AI. No LLM. No template rendering. No browser globals. No hooks.
 * No IndexedDB. No HTTP.
 */

import { RegenerationPlanner }          from './RegenerationPlanner';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Priority table — mandatory priority by impactLevel ────────────────────────

const MANDATORY_PRIORITY: Readonly<Record<string, number>> = {
  CRITICAL: 1,
  HIGH:     2,
  LOW:      3,
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GeneratedDocument {
  id:       string;
  priority: number;
  required: boolean;
}

export interface DocumentRegenerationMetadata {
  generatedCount: number;
  mandatoryCount: number;
  optionalCount:  number;
  targetDate:     string;
}

export interface DocumentRegenerationResult {
  status:             SnapshotStatus;
  impactScope:        ImpactScope;
  impactLevel:        ImpactLevel;
  generatedDocuments: readonly GeneratedDocument[];
  mandatoryGenerated: readonly GeneratedDocument[];
  optionalGenerated:  readonly GeneratedDocument[];
  metadata:           DocumentRegenerationMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinPlanDoc {
  id: string;
}

interface MinPlan {
  status:             SnapshotStatus;
  impactScope:        ImpactScope;
  impactLevel:        ImpactLevel;
  mandatoryDocuments: readonly MinPlanDoc[];
  optionalDocuments:  readonly MinPlanDoc[];
  metadata:           { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function regenerateFromPlan(plan: MinPlan): DocumentRegenerationResult {
  const { status, impactScope, impactLevel } = plan;
  const targetDate        = plan.metadata.targetDate;
  const mandatoryPriority = MANDATORY_PRIORITY[impactLevel] ?? 4;

  const mandatoryGenerated: GeneratedDocument[] = plan.mandatoryDocuments.map(d => ({
    id:       d.id,
    priority: mandatoryPriority,
    required: true,
  }));

  const optionalGenerated: GeneratedDocument[] = plan.optionalDocuments.map(d => ({
    id:       d.id,
    priority: 4,
    required: false,
  }));

  // Mandatory bucket first, then optional — preserves source order within each
  const generatedDocuments: GeneratedDocument[] = [
    ...mandatoryGenerated,
    ...optionalGenerated,
  ];

  const metadata: DocumentRegenerationMetadata = {
    generatedCount: generatedDocuments.length,
    mandatoryCount: mandatoryGenerated.length,
    optionalCount:  optionalGenerated.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    generatedDocuments,
    mandatoryGenerated,
    optionalGenerated,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DocumentRegenerator {
  constructor(
    private readonly planner: RegenerationPlanner = new RegenerationPlanner(),
  ) {}

  regenerate(lastAppliedDate: string, currentDate: string): DocumentRegenerationResult {
    return regenerateFromPlan(this.planner.plan(lastAppliedDate, currentDate));
  }
}
