/**
 * Legal v8.1 — RegenerationPlanner
 *
 * plan(lastAppliedDate, currentDate) → RegenerationPlan
 *
 * Consumes a DocumentDependencyResult and classifies documents into mandatory
 * and optional regeneration buckets based on the forwarded impactLevel.
 *
 * documentsToRegenerate:
 *   Exactly DocumentDependencyResult.documents, order preserved.
 *   No sorting. No dedup.
 *
 * Mandatory document IDs per impactLevel:
 *   LOW      → KE_HOACH_LCNT, HO_SO_YEU_CAU
 *   HIGH     → KE_HOACH_LCNT, HO_SO_YEU_CAU, HO_SO_MOI_THAU, DU_TOAN_MUA_SAM
 *   CRITICAL → all documents (short-circuit, no filtering)
 *   NONE     → none (vacuous: source documents are already [])
 *
 * optionalDocuments:
 *   Filter complement of mandatory within documentsToRegenerate.
 *   Preserves source order.
 *
 * For NONE scope, PENDING_APPROVAL, or UNCHANGED:
 *   documentsToRegenerate = [], mandatoryDocuments = [], optionalDocuments = []
 *   This is the natural result of an empty document list from v8.0.
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * planFromDocument() is exported so tests can inject synthetic
 * DocumentDependencyResult objects for all impact-level scenarios.
 *
 * Calls DocumentDependencyResolver.resolve() exactly once.
 * Never calls TemplateDependencyResolver, DependencyGraphBuilder,
 * ImpactAnalyzer, KnowledgeGraphBuilder, RegulationClassifier,
 * RegulationParser, RegulationFetcher, SnapshotBuilder,
 * OfficialSourceConnector, GovernmentCrawler, NotificationCenter,
 * SchedulerAgent, WorkflowAgent, RollbackManager, HumanReviewQueue,
 * TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent, or any v4.x
 * engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No randomness. No side effects.
 * No AI. No NLP. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { DocumentDependencyResolver }   from './DocumentDependencyResolver';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';

// ─── Mandatory document IDs per impact level ───────────────────────────────────

const MANDATORY_IDS: Readonly<Record<string, readonly string[]>> = {
  LOW:      ['KE_HOACH_LCNT', 'HO_SO_YEU_CAU'],
  HIGH:     ['KE_HOACH_LCNT', 'HO_SO_YEU_CAU', 'HO_SO_MOI_THAU', 'DU_TOAN_MUA_SAM'],
  CRITICAL: [],  // all documents — handled by isCritical branch
  NONE:     [],
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RegenerationDocument {
  id:       string;
  template: string;
  type:     string;
}

export interface RegenerationMetadata {
  documentCount:  number;
  mandatoryCount: number;
  optionalCount:  number;
  targetDate:     string;
}

export interface RegenerationPlan {
  status:                SnapshotStatus;
  impactScope:           ImpactScope;
  impactLevel:           ImpactLevel;
  documentsToRegenerate: readonly RegenerationDocument[];
  mandatoryDocuments:    readonly RegenerationDocument[];
  optionalDocuments:     readonly RegenerationDocument[];
  metadata:              RegenerationMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinDocNode {
  id:       string;
  template: string;
  type:     string;
}

interface MinDocument {
  status:      SnapshotStatus;
  impactScope: ImpactScope;
  impactLevel: ImpactLevel;
  documents:   readonly MinDocNode[];
  metadata:    { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function planFromDocument(doc: MinDocument): RegenerationPlan {
  const { status, impactScope, impactLevel } = doc;
  const targetDate = doc.metadata.targetDate;

  const documentsToRegenerate: readonly RegenerationDocument[] = doc.documents;

  let mandatoryDocuments: readonly RegenerationDocument[];
  let optionalDocuments:  readonly RegenerationDocument[];

  if (impactLevel === 'CRITICAL') {
    mandatoryDocuments = documentsToRegenerate;
    optionalDocuments  = [];
  } else {
    const mandatorySet = new Set(MANDATORY_IDS[impactLevel] ?? []);
    mandatoryDocuments = documentsToRegenerate.filter(d => mandatorySet.has(d.id));
    optionalDocuments  = documentsToRegenerate.filter(d => !mandatorySet.has(d.id));
  }

  const metadata: RegenerationMetadata = {
    documentCount:  documentsToRegenerate.length,
    mandatoryCount: mandatoryDocuments.length,
    optionalCount:  optionalDocuments.length,
    targetDate,
  };

  return {
    status,
    impactScope,
    impactLevel,
    documentsToRegenerate,
    mandatoryDocuments,
    optionalDocuments,
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RegenerationPlanner {
  constructor(
    private readonly documentResolver: DocumentDependencyResolver = new DocumentDependencyResolver(),
  ) {}

  plan(lastAppliedDate: string, currentDate: string): RegenerationPlan {
    return planFromDocument(this.documentResolver.resolve(lastAppliedDate, currentDate));
  }
}
