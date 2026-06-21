/**
 * Legal v7.3 — RegulationFetcher
 *
 * fetch(lastAppliedDate, currentDate) → RegulationFetchResult
 *
 * Consumes a SnapshotBuildResult and produces zero or more RegulationRecord
 * objects — one per source in assembledSnapshot.sources — together with
 * fetch-level metadata.
 *
 * Status is forwarded unchanged from SnapshotBuilder; no recomputation:
 *
 *   READY            — one record per source in assembledSnapshot.sources
 *   PENDING_APPROVAL — records = [] (cannot load until operator approves)
 *   UNCHANGED        — records = [] (no new data this cycle)
 *
 * Each record is a pure mapping from source identifier to known URL and
 * human-readable title.  No HTTP requests are made; no files are read; no
 * external systems are contacted.  The URL and title are static fixtures
 * representing where real data would be fetched from in a live system.
 *
 * URL and title mappings:
 *   GOV_PORTAL → https://chinhphu.vn  / "Government regulations"
 *   MOISA      → https://moha.gov.vn  / "MOISA regulations"
 *   MPI        → https://mpi.gov.vn   / "MPI regulations"
 *   MOF        → https://mof.gov.vn   / "MOF regulations"
 *
 * Source order in records follows assembledSnapshot.sources order exactly.
 * No sorting. No grouping.
 *
 * fetchFromSnapshot() is exported so tests can inject synthetic
 * SnapshotBuildResult objects for all three status paths.  PENDING_APPROVAL
 * cannot be reached with the current two-snapshot real data set.
 *
 * Calls SnapshotBuilder.build() exactly once.
 * Never calls OfficialSourceConnector, GovernmentCrawler,
 * NotificationCenter, SchedulerAgent, WorkflowAgent, RollbackManager,
 * HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { SnapshotBuilder }      from './SnapshotBuilder';
import type { SnapshotStatus }  from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RegulationRecord {
  source:        string;
  title:         string;
  url:           string;
  effectiveDate: string;
}

export interface FetchMetadata {
  sourceCount: number;
  auditCount:  number;
  targetDate:  string;
}

export interface RegulationFetchResult {
  status:   SnapshotStatus;
  records:  readonly RegulationRecord[];
  metadata: FetchMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields fetchFromSnapshot actually reads.
interface MinSnapshot {
  status:            SnapshotStatus;
  targetDate:        string;
  assembledSnapshot: { sources: readonly string[] };
  metadata:          { auditCount: number };
}

// ─── Source lookup tables ─────────────────────────────────────────────────────

const SOURCE_URL: Record<string, string> = {
  GOV_PORTAL: 'https://chinhphu.vn',
  MOISA:      'https://moha.gov.vn',
  MPI:        'https://mpi.gov.vn',
  MOF:        'https://mof.gov.vn',
};

const SOURCE_TITLE: Record<string, string> = {
  GOV_PORTAL: 'Government regulations',
  MOISA:      'MOISA regulations',
  MPI:        'MPI regulations',
  MOF:        'MOF regulations',
};

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function fetchFromSnapshot(snapshot: MinSnapshot): RegulationFetchResult {
  // Status is forwarded directly — no recomputation
  const status = snapshot.status;

  // Only READY produces records; PENDING_APPROVAL and UNCHANGED yield []
  const records: RegulationRecord[] =
    status === 'READY'
      ? snapshot.assembledSnapshot.sources.map(source => ({
          source,
          title:         SOURCE_TITLE[source],
          url:           SOURCE_URL[source],
          effectiveDate: snapshot.targetDate,
        }))
      : [];

  const metadata: FetchMetadata = {
    sourceCount: records.length,
    auditCount:  snapshot.metadata.auditCount,
    targetDate:  snapshot.targetDate,
  };

  return { status, records, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RegulationFetcher {
  constructor(private readonly snapshotBuilder: SnapshotBuilder = new SnapshotBuilder()) {}

  fetch(lastAppliedDate: string, currentDate: string): RegulationFetchResult {
    return fetchFromSnapshot(this.snapshotBuilder.build(lastAppliedDate, currentDate));
  }
}
