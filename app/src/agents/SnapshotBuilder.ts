/**
 * Legal v7.2 — SnapshotBuilder
 *
 * build(lastAppliedDate, currentDate) → SnapshotBuildResult
 *
 * Consumes a ConnectResult and assembles one regulation snapshot record,
 * classifying it into one of three statuses:
 *
 *   READY            — fetchJobs contain at least one FETCH action and
 *                      no approval is required; snapshot data is available
 *   PENDING_APPROVAL — approvalJobs.length > 0; the snapshot was fetched
 *                      but cannot be applied until an operator signs off;
 *                      takes precedence over READY and UNCHANGED
 *   UNCHANGED        — all fetchJobs are WAIT actions (or fetchJobs is
 *                      empty); no new regulation data arrived this cycle;
 *                      the previous snapshot remains authoritative
 *
 * PENDING_APPROVAL is the highest-precedence status: even when fetchJobs
 * contain FETCH actions, an outstanding approval blocks the snapshot from
 * advancing to READY.
 *
 * assembledSnapshot.sources is derived from fetchJobs filtered by
 * action==='FETCH'. For the WAIT/UNCHANGED path this yields [].
 * For the FETCH/READY path this yields [GOV_PORTAL, MOISA, MPI, MOF]
 * in connector order. No HTTP. No parsing. Pure object assembly.
 *
 * metadata reflects job-level counts from the connector layer:
 *   fetchSources  = fetchJobs.length   (includes WAIT jobs)
 *   auditCount    = auditJobs.length
 *   approvalCount = approvalJobs.length
 *
 * buildFromConnect() is exported so tests can inject synthetic ConnectResult
 * objects for all three status branches, which real data cannot fully cover
 * (PENDING_APPROVAL never occurs with the current two-snapshot set).
 *
 * Calls OfficialSourceConnector.connect() exactly once.
 * Never calls GovernmentCrawler, NotificationCenter, SchedulerAgent,
 * WorkflowAgent, RollbackManager, HumanReviewQueue, TemplateAutoUpdater,
 * ChangeImpactAgent, LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { OfficialSourceConnector }                         from './OfficialSourceConnector';
import type { ConnectorJob, ConnectorSource, ConnectResult } from './OfficialSourceConnector';

// ─── Public types ─────────────────────────────────────────────────────────────

export type SnapshotStatus = 'READY' | 'PENDING_APPROVAL' | 'UNCHANGED';

export interface AssembledSnapshot {
  sources:    readonly ConnectorSource[];
  targetDate: string;
}

export interface SnapshotMetadata {
  fetchSources:  number;
  auditCount:    number;
  approvalCount: number;
}

export interface SnapshotBuildResult {
  status:            SnapshotStatus;
  targetDate:        string;
  assembledSnapshot: AssembledSnapshot;
  metadata:          SnapshotMetadata;
  approvalRequired:  boolean;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields buildFromConnect actually reads.
interface MinConnect {
  approvalJobs: readonly ConnectorJob[];
  auditJobs:    readonly ConnectorJob[];
  fetchJobs:    readonly ConnectorJob[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildFromConnect(connect: MinConnect, currentDate: string): SnapshotBuildResult {
  const approvalRequired = connect.approvalJobs.length > 0;

  // Status — PENDING_APPROVAL takes precedence over everything
  let status: SnapshotStatus;
  if (approvalRequired) {
    status = 'PENDING_APPROVAL';
  } else if (connect.fetchJobs.every(j => j.action === 'WAIT')) {
    // vacuously true when fetchJobs=[] → UNCHANGED
    status = 'UNCHANGED';
  } else {
    status = 'READY';
  }

  // Sources — extracted from FETCH-action jobs only (WAIT jobs contribute nothing)
  const sources: ConnectorSource[] = connect.fetchJobs
    .filter(j => j.action === 'FETCH')
    .map(j => j.source);

  const assembledSnapshot: AssembledSnapshot = { sources, targetDate: currentDate };

  const metadata: SnapshotMetadata = {
    fetchSources:  connect.fetchJobs.length,
    auditCount:    connect.auditJobs.length,
    approvalCount: connect.approvalJobs.length,
  };

  return {
    status,
    targetDate: currentDate,
    assembledSnapshot,
    metadata,
    approvalRequired,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class SnapshotBuilder {
  constructor(private readonly connector: OfficialSourceConnector = new OfficialSourceConnector()) {}

  build(lastAppliedDate: string, currentDate: string): SnapshotBuildResult {
    return buildFromConnect(this.connector.connect(lastAppliedDate, currentDate), currentDate);
  }
}
