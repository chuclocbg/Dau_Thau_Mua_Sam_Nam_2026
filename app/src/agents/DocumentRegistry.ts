/**
 * Legal v8.7 — DocumentRegistry
 *
 * register(lastAppliedDate, currentDate) → RegistryResult
 *
 * Consumes a FileEmissionResult and enriches each EmittedFile into a
 * RegistryEntry by adding registeredAt (= metadata.targetDate), then builds
 * an index keyed by filename for O(1) lookup.
 *
 * RegistryEntry shape:
 *   filename     — copied from EmittedFile
 *   extension    — copied from EmittedFile
 *   payload      — copied from EmittedFile
 *   priority     — copied from EmittedFile
 *   required     — copied from EmittedFile
 *   registeredAt — metadata.targetDate from the input FileEmissionResult
 *
 * index: Record<string, RegistryEntry> keyed by filename.
 * Duplicate filenames: last occurrence wins (source order).
 *
 * Partition:
 *   requiredEntries — all where required=true  (source order)
 *   optionalEntries — all where required=false (source order)
 *
 * entries ordering:
 *   [...requiredEntries, ...optionalEntries]
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty files):
 *   entries = [], requiredEntries = [], optionalEntries = [], index = {}
 *   Natural result of empty input from v8.6.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * registerFromEmission() is exported so tests can inject synthetic
 * FileEmissionResult objects for all bucket/index scenarios.
 *
 * Calls FileEmitter.emit() exactly once.
 * Never calls TemplateRenderer, ArtifactGenerator, RenderEngine,
 * DocumentRegenerator, RegenerationPlanner, DocumentDependencyResolver,
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
 * No AI. No LLM. No template engine. No filesystem. No disk writes.
 * No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { FileEmitter }                  from './FileEmitter';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RegistryEntry {
  filename:     string;
  extension:    string;
  payload:      string;
  priority:     number;
  required:     boolean;
  registeredAt: string;
}

export interface RegistryMetadata {
  entryCount:    number;
  requiredCount: number;
  optionalCount: number;
  targetDate:    string;
}

export interface RegistryResult {
  status:          SnapshotStatus;
  impactScope:     ImpactScope;
  impactLevel:     ImpactLevel;
  entries:         readonly RegistryEntry[];
  requiredEntries: readonly RegistryEntry[];
  optionalEntries: readonly RegistryEntry[];
  index:           Readonly<Record<string, RegistryEntry>>;
  metadata:        RegistryMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinEmittedFile {
  filename:  string;
  extension: string;
  payload:   string;
  priority:  number;
  required:  boolean;
}

interface MinEmissionResult {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  files:       readonly MinEmittedFile[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function registerFromEmission(result: MinEmissionResult): RegistryResult {
  const { status, impactScope, impactLevel } = result;
  const targetDate = result.metadata.targetDate;

  const requiredEntries: RegistryEntry[] = [];
  const optionalEntries: RegistryEntry[] = [];
  const index: Record<string, RegistryEntry> = {};

  for (const f of result.files) {
    const entry: RegistryEntry = {
      filename:     f.filename,
      extension:    f.extension,
      payload:      f.payload,
      priority:     f.priority,
      required:     f.required,
      registeredAt: targetDate,
    };
    if (f.required) {
      requiredEntries.push(entry);
    } else {
      optionalEntries.push(entry);
    }
    index[f.filename] = entry;  // last occurrence wins for duplicates
  }

  // Required bucket always precedes optional; source order preserved within each
  const entries: RegistryEntry[] = [...requiredEntries, ...optionalEntries];

  const metadata: RegistryMetadata = {
    entryCount:    entries.length,
    requiredCount: requiredEntries.length,
    optionalCount: optionalEntries.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    entries,
    requiredEntries,
    optionalEntries,
    index,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DocumentRegistry {
  constructor(
    private readonly fileEmitter: FileEmitter = new FileEmitter(),
  ) {}

  register(lastAppliedDate: string, currentDate: string): RegistryResult {
    return registerFromEmission(this.fileEmitter.emit(lastAppliedDate, currentDate));
  }
}
