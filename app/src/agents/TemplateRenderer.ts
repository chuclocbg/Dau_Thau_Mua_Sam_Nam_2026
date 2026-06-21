/**
 * Legal v8.5 — TemplateRenderer
 *
 * render(lastAppliedDate, currentDate) → RenderedArtifactResult
 *
 * Consumes an ArtifactGenerationResult and augments each Artifact with a
 * templateId and placeholder content string.  No template engine, no
 * filesystem, no DOCX generation, no file writing.  Pure content planning.
 *
 * RenderedArtifact shape:
 *   documentId — copied from Artifact
 *   priority   — copied from Artifact
 *   required   — copied from Artifact
 *   format     — copied from Artifact
 *   templateId — documentId (constant rule, no lookup, no registry)
 *   content    — `TEMPLATE:${templateId}`
 *
 * One RenderedArtifact per Artifact from artifacts — one-to-one.
 * No filtering.  No dedup.  No sorting.
 *
 * Partition:
 *   requiredRendered — all where required=true  (source order)
 *   optionalRendered — all where required=false (source order)
 *
 * renderedArtifacts ordering:
 *   [...requiredRendered, ...optionalRendered]
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty artifacts):
 *   renderedArtifacts = [], requiredRendered = [], optionalRendered = []
 *   Natural result of empty input from v8.4.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * renderFromArtifacts() is exported so tests can inject synthetic
 * ArtifactGenerationResult objects for all content/bucket scenarios.
 *
 * Calls ArtifactGenerator.generate() exactly once.
 * Never calls RenderEngine, DocumentRegenerator, RegenerationPlanner,
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
 * No AI. No LLM. No template engine. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { ArtifactGenerator }            from './ArtifactGenerator';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RenderedArtifact {
  documentId: string;
  priority:   number;
  required:   boolean;
  format:     string;
  templateId: string;
  content:    string;
}

export interface RenderedArtifactMetadata {
  renderedCount: number;
  requiredCount: number;
  optionalCount: number;
  targetDate:    string;
}

export interface RenderedArtifactResult {
  status:           SnapshotStatus;
  impactScope:      ImpactScope;
  impactLevel:      ImpactLevel;
  renderedArtifacts: readonly RenderedArtifact[];
  requiredRendered:  readonly RenderedArtifact[];
  optionalRendered:  readonly RenderedArtifact[];
  metadata:          RenderedArtifactMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinArtifact {
  documentId: string;
  priority:   number;
  required:   boolean;
  format:     string;
}

interface MinArtifactResult {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  artifacts:   readonly MinArtifact[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function renderFromArtifacts(result: MinArtifactResult): RenderedArtifactResult {
  const { status, impactScope, impactLevel } = result;
  const targetDate = result.metadata.targetDate;

  const requiredRendered: RenderedArtifact[] = [];
  const optionalRendered: RenderedArtifact[] = [];

  for (const a of result.artifacts) {
    const templateId = a.documentId;
    const rendered: RenderedArtifact = {
      documentId: a.documentId,
      priority:   a.priority,
      required:   a.required,
      format:     a.format,
      templateId,
      content:    `TEMPLATE:${templateId}`,
    };
    if (a.required) {
      requiredRendered.push(rendered);
    } else {
      optionalRendered.push(rendered);
    }
  }

  // Required bucket always precedes optional; source order preserved within each
  const renderedArtifacts: RenderedArtifact[] = [...requiredRendered, ...optionalRendered];

  const metadata: RenderedArtifactMetadata = {
    renderedCount: renderedArtifacts.length,
    requiredCount: requiredRendered.length,
    optionalCount: optionalRendered.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    renderedArtifacts,
    requiredRendered,
    optionalRendered,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class TemplateRenderer {
  constructor(
    private readonly artifactGenerator: ArtifactGenerator = new ArtifactGenerator(),
  ) {}

  render(lastAppliedDate: string, currentDate: string): RenderedArtifactResult {
    return renderFromArtifacts(this.artifactGenerator.generate(lastAppliedDate, currentDate));
  }
}
