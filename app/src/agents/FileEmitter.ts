/**
 * Legal v8.6 — FileEmitter
 *
 * emit(lastAppliedDate, currentDate) → FileEmissionResult
 *
 * Consumes a RenderedArtifactResult and maps each RenderedArtifact to an
 * EmittedFile.  No filesystem, no DOCX generation, no disk writes.
 * Pure file planning.
 *
 * EmittedFile shape:
 *   filename  — documentId (constant rule, no lookup, no registry)
 *   extension — 'DOCX'    (constant)
 *   payload   — `CONTENT:${templateId}` (token for downstream writer)
 *   priority  — copied from RenderedArtifact
 *   required  — copied from RenderedArtifact
 *
 * One EmittedFile per RenderedArtifact — one-to-one.
 * No filtering.  No dedup.  No sorting.
 *
 * Partition:
 *   requiredFiles — all where required=true  (source order)
 *   optionalFiles — all where required=false (source order)
 *
 * files ordering:
 *   [...requiredFiles, ...optionalFiles]
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty renderedArtifacts):
 *   files = [], requiredFiles = [], optionalFiles = []
 *   Natural result of empty input from v8.5.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * emitFromRendered() is exported so tests can inject synthetic
 * RenderedArtifactResult objects for all file/bucket scenarios.
 *
 * Calls TemplateRenderer.render() exactly once.
 * Never calls ArtifactGenerator, RenderEngine, DocumentRegenerator,
 * RegenerationPlanner, DocumentDependencyResolver, TemplateDependencyResolver,
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
 * No AI. No LLM. No template engine. No filesystem. No disk writes.
 * No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { TemplateRenderer }             from './TemplateRenderer';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EmittedFile {
  filename:  string;
  extension: string;
  payload:   string;
  priority:  number;
  required:  boolean;
}

export interface FileEmissionMetadata {
  fileCount:     number;
  requiredCount: number;
  optionalCount: number;
  targetDate:    string;
}

export interface FileEmissionResult {
  status:        SnapshotStatus;
  impactScope:   ImpactScope;
  impactLevel:   ImpactLevel;
  files:         readonly EmittedFile[];
  requiredFiles: readonly EmittedFile[];
  optionalFiles: readonly EmittedFile[];
  metadata:      FileEmissionMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinRenderedArtifact {
  documentId: string;
  templateId: string;
  priority:   number;
  required:   boolean;
}

interface MinRenderedResult {
  status:            SnapshotStatus;
  impactScope:       ImpactScope;
  impactLevel:       ImpactLevel;
  renderedArtifacts: readonly MinRenderedArtifact[];
  metadata:          { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function emitFromRendered(result: MinRenderedResult): FileEmissionResult {
  const { status, impactScope, impactLevel } = result;
  const targetDate = result.metadata.targetDate;

  const requiredFiles: EmittedFile[] = [];
  const optionalFiles: EmittedFile[] = [];

  for (const a of result.renderedArtifacts) {
    const file: EmittedFile = {
      filename:  a.documentId,
      extension: 'DOCX',
      payload:   `CONTENT:${a.templateId}`,
      priority:  a.priority,
      required:  a.required,
    };
    if (a.required) {
      requiredFiles.push(file);
    } else {
      optionalFiles.push(file);
    }
  }

  // Required bucket always precedes optional; source order preserved within each
  const files: EmittedFile[] = [...requiredFiles, ...optionalFiles];

  const metadata: FileEmissionMetadata = {
    fileCount:     files.length,
    requiredCount: requiredFiles.length,
    optionalCount: optionalFiles.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    files,
    requiredFiles,
    optionalFiles,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class FileEmitter {
  constructor(
    private readonly templateRenderer: TemplateRenderer = new TemplateRenderer(),
  ) {}

  emit(lastAppliedDate: string, currentDate: string): FileEmissionResult {
    return emitFromRendered(this.templateRenderer.render(lastAppliedDate, currentDate));
  }
}
