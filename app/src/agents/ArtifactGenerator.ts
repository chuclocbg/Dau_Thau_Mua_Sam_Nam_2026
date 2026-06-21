/**
 * Legal v8.4 — ArtifactGenerator
 *
 * generate(lastAppliedDate, currentDate) → ArtifactGenerationResult
 *
 * Consumes a RenderResult and assigns a constant DOCX format to every
 * RenderTask in renderQueue, then partitions artifacts into required and
 * optional buckets.  No filesystem, no DOCX generation, no template
 * rendering.  Pure artifact planning layer.
 *
 * Artifact shape (copied from RenderTask + constant format):
 *   { documentId, priority, required, format: 'DOCX' }
 *
 * Source: renderQueue — one artifact per task, one-to-one.
 * Partition:
 *   requiredArtifacts — all tasks where required=true  (source order)
 *   optionalArtifacts — all tasks where required=false (source order)
 *
 * artifacts ordering:
 *   [...requiredArtifacts, ...optionalArtifacts]
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty renderQueue):
 *   artifacts = [], requiredArtifacts = [], optionalArtifacts = []
 *   Natural result of empty input from v8.3.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * generateFromRender() is exported so tests can inject synthetic
 * RenderResult objects for all format/bucket/ordering scenarios.
 *
 * Calls RenderEngine.render() exactly once.
 * Never calls DocumentRegenerator, RegenerationPlanner,
 * DocumentDependencyResolver, TemplateDependencyResolver,
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
 * No AI. No LLM. No DOCX. No PDF. No XLSX. No filesystem.
 * No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { RenderEngine }                 from './RenderEngine';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ArtifactFormat = 'DOCX';

export interface Artifact {
  documentId: string;
  priority:   number;
  required:   boolean;
  format:     ArtifactFormat;
}

export interface ArtifactGenerationMetadata {
  artifactCount: number;
  requiredCount: number;
  optionalCount: number;
  targetDate:    string;
}

export interface ArtifactGenerationResult {
  status:            SnapshotStatus;
  impactScope:       ImpactScope;
  impactLevel:       ImpactLevel;
  artifacts:         readonly Artifact[];
  requiredArtifacts: readonly Artifact[];
  optionalArtifacts: readonly Artifact[];
  metadata:          ArtifactGenerationMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinRenderTask {
  documentId: string;
  priority:   number;
  required:   boolean;
}

interface MinRender {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  renderQueue: readonly MinRenderTask[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function generateFromRender(render: MinRender): ArtifactGenerationResult {
  const { status, impactScope, impactLevel } = render;
  const targetDate = render.metadata.targetDate;

  const requiredArtifacts: Artifact[] = [];
  const optionalArtifacts: Artifact[] = [];

  for (const task of render.renderQueue) {
    const artifact: Artifact = {
      documentId: task.documentId,
      priority:   task.priority,
      required:   task.required,
      format:     'DOCX',
    };
    if (task.required) {
      requiredArtifacts.push(artifact);
    } else {
      optionalArtifacts.push(artifact);
    }
  }

  // Required bucket always precedes optional; source order preserved within each
  const artifacts: Artifact[] = [...requiredArtifacts, ...optionalArtifacts];

  const metadata: ArtifactGenerationMetadata = {
    artifactCount: artifacts.length,
    requiredCount: requiredArtifacts.length,
    optionalCount: optionalArtifacts.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    artifacts,
    requiredArtifacts,
    optionalArtifacts,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class ArtifactGenerator {
  constructor(
    private readonly renderEngine: RenderEngine = new RenderEngine(),
  ) {}

  generate(lastAppliedDate: string, currentDate: string): ArtifactGenerationResult {
    return generateFromRender(this.renderEngine.render(lastAppliedDate, currentDate));
  }
}
