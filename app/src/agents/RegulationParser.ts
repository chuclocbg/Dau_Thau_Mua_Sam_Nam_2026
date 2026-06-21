/**
 * Legal v7.4 — RegulationParser
 *
 * parse(lastAppliedDate, currentDate) → ParseResult
 *
 * Consumes a RegulationFetchResult and normalizes each RegulationRecord into a
 * ParsedRegulation by appending two derived fields:
 *
 *   authority — human-readable institution name per source identifier
 *   category  — domain classification per source identifier
 *
 * Authority mapping:
 *   GOV_PORTAL → 'Government'
 *   MOISA      → 'MOISA'
 *   MPI        → 'MPI'
 *   MOF        → 'MOF'
 *
 * Category mapping:
 *   GOV_PORTAL → 'GENERAL'
 *   MOISA      → 'PERSONNEL'
 *   MPI        → 'PROCUREMENT'
 *   MOF        → 'FINANCE'
 *
 * Status is forwarded unchanged from RegulationFetcher — never recomputed:
 *
 *   READY            — one ParsedRegulation per record, order preserved
 *   PENDING_APPROVAL — regulations = []
 *   UNCHANGED        — regulations = []
 *
 * No text extraction, no NLP, no HTTP, no file I/O.  The two lookup tables
 * above are the complete normalization layer.  Text-level parsing (extracting
 * article numbers, amendment dates, legal references from title strings) is
 * deferred to RegulationClassifier v7.5, which will receive ParsedRegulation[]
 * from this layer with authority and category already resolved.
 *
 * parseFromFetch() is exported so tests can inject synthetic RegulationFetchResult
 * objects for all three status paths (PENDING_APPROVAL unreachable from real data).
 *
 * Calls RegulationFetcher.fetch() exactly once.
 * Never calls SnapshotBuilder, OfficialSourceConnector, GovernmentCrawler,
 * NotificationCenter, SchedulerAgent, WorkflowAgent, RollbackManager,
 * HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent,
 * or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { RegulationFetcher }   from './RegulationFetcher';
import type { SnapshotStatus } from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ParsedRegulation {
  source:        string;
  title:         string;
  url:           string;
  effectiveDate: string;
  authority:     string;
  category:      string;
}

export interface ParseMetadata {
  count:       number;
  sourceCount: number;
  targetDate:  string;
}

export interface ParseResult {
  status:      SnapshotStatus;
  regulations: readonly ParsedRegulation[];
  metadata:    ParseMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinRecord {
  source:        string;
  title:         string;
  url:           string;
  effectiveDate: string;
}

interface MinFetch {
  status:   SnapshotStatus;
  records:  readonly MinRecord[];
  metadata: { sourceCount: number; targetDate: string };
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const AUTHORITY: Record<string, string> = {
  GOV_PORTAL: 'Government',
  MOISA:      'MOISA',
  MPI:        'MPI',
  MOF:        'MOF',
};

const CATEGORY: Record<string, string> = {
  GOV_PORTAL: 'GENERAL',
  MOISA:      'PERSONNEL',
  MPI:        'PROCUREMENT',
  MOF:        'FINANCE',
};

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function parseFromFetch(fetch: MinFetch): ParseResult {
  const status = fetch.status;

  const regulations: ParsedRegulation[] =
    status === 'READY'
      ? fetch.records.map(rec => ({
          source:        rec.source,
          title:         rec.title,
          url:           rec.url,
          effectiveDate: rec.effectiveDate,
          authority:     AUTHORITY[rec.source],
          category:      CATEGORY[rec.source],
        }))
      : [];

  const metadata: ParseMetadata = {
    count:       regulations.length,
    sourceCount: fetch.metadata.sourceCount,
    targetDate:  fetch.metadata.targetDate,
  };

  return { status, regulations, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RegulationParser {
  constructor(private readonly fetcher: RegulationFetcher = new RegulationFetcher()) {}

  parse(lastAppliedDate: string, currentDate: string): ParseResult {
    return parseFromFetch(this.fetcher.fetch(lastAppliedDate, currentDate));
  }
}
