/**
 * P6-08A: Persistence schema — types, constants, type guards, and serializers.
 *
 * This file defines WHAT is persisted and HOW to describe it.
 * No I/O, no storage logic — those belong to P6-08B (ISessionStore
 * implementations) and P6-08C (migration runner).
 *
 * Design principles:
 *   - Every persisted object carries schemaVersion for migration detection.
 *   - Serialized forms use primitive/JSON-safe types only (no class instances).
 *   - Type guards enable runtime validation when loading from external storage.
 *   - Pure serializer helpers convert live agent objects → persisted forms
 *     without side-effects.
 *   - SchemaMigration interface is declared here; migration logic is in P6-08C.
 *
 * Milestones:
 *   P6-08A — schema, interfaces, type guards, serializers  (this file)
 *   P6-08B — ISessionStore / ITraceStore / IExportStore implementations
 *   P6-08C — migration runner + version management
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentMessage }          from '../agents/types';
import type { WorkflowState, AgentSession, UserQuestion } from '../agents/AutonomousAgent';
import type { PlannerOutput }          from '../agents/PlannerAgent';
import type { DossierReviewOutput }    from '../agents/LegalReviewerAgent';
import type { RiskOutput }             from '../agents/RiskAgent';
import type { ProcurementPackage }     from '../demoData';

// ─── Schema version ───────────────────────────────────────────────────────────

/**
 * Monotonically increasing integer.  Increment this whenever a breaking change
 * is made to any persisted interface so the migration runner can detect stale
 * records loaded from storage.
 *
 * History:
 *   1 — initial schema (P6-08A)
 */
export const PERSISTENCE_SCHEMA_VERSION = 1 as const;

// ─── PersistedMessage ─────────────────────────────────────────────────────────

/**
 * JSON-safe form of AgentMessage.
 * Uses `string` for `from` / `to` / `type` so the record survives round-trips
 * through JSON.stringify / JSON.parse without losing type information.
 */
export interface PersistedMessage {
  traceId:    string;
  from:       string;   // AgentId | 'user'
  to:         string;   // AgentId | 'user' | 'broadcast'
  type:       string;   // 'request' | 'response' | 'event' | 'error'
  payload:    unknown;  // serialised payload — opaque to the persistence layer
  timestamp:  number;
  legalBasis?: string[];
}

// ─── PersistedTrace ───────────────────────────────────────────────────────────

/**
 * All messages logged under a single traceId, stored together for audit
 * retrieval.  Includes the creation timestamp of the first message so
 * traces can be ordered chronologically.
 */
export interface PersistedTrace {
  schemaVersion: number;
  traceId:       string;
  messages:      PersistedMessage[];
  /** Timestamp of the first message logged in this trace. */
  createdAt:     number;
  /** Timestamp of the last message logged in this trace. */
  updatedAt:     number;
}

// ─── PersistedSession ─────────────────────────────────────────────────────────

/**
 * Snapshot of an AgentSession at a given point in time.
 * Suitable for checkpoint saves (mid-workflow) and final saves (done/error).
 *
 * All sub-outputs (plannerOutput, dossierReview, etc.) are stored inline
 * because they are plain JSON objects with no circular references.
 */
export interface PersistedSession {
  schemaVersion:   number;
  sessionId:       string;
  /** Wall-clock time this snapshot was written to storage. */
  savedAt:         number;

  // ── Core session fields ────────────────────────────────────────────────────
  goal:            string;
  state:           WorkflowState;
  startedAt:       number;
  completedAt?:    number;
  specRetries:     number;
  totalBudget?:    number;
  budgetYear?:     number;

  // ── Sub-outputs (may be absent for mid-workflow checkpoints) ───────────────
  plannerOutput?:   PlannerOutput;
  dossierReview?:   DossierReviewOutput;
  riskOutput?:      RiskOutput;
  pkg?:             ProcurementPackage;

  // ── Pending interaction ────────────────────────────────────────────────────
  pendingQuestion?: UserQuestion;

  // ── Serialised messageLog ─────────────────────────────────────────────────
  messageLog:      PersistedMessage[];
}

// ─── ExportSnapshot ───────────────────────────────────────────────────────────

/**
 * Point-in-time complete archive record.  Created when the user triggers
 * action='export' on a completed or error session.
 *
 * Contains everything required for State Audit Office review:
 *   - the full session with all sub-outputs
 *   - the messageLog (4 request/response pairs)
 *   - the full registry trace (state events + sub-agent messages)
 *   - the aggregated legal citations
 *   - a human-readable summary
 */
export interface ExportSnapshot {
  schemaVersion: number;
  /** UUID v4 identifying this specific export event. */
  snapshotId:    string;
  exportedAt:    number;

  session:    PersistedSession;
  /** Full registry trace for the workflow run — all messages, all agents. */
  traces:     PersistedTrace[];
  legalBasis: string[];
  summary:    string;
}

// ─── Storage interfaces ───────────────────────────────────────────────────────

/**
 * Contract for a session checkpoint store.
 * Implementations (file system, IndexedDB, server API) are in P6-08B.
 */
export interface ISessionStore {
  /** Persist (upsert) a session snapshot.  Overwrites any prior snapshot for sessionId. */
  saveSession(session: PersistedSession): Promise<void>;
  /** Load the latest snapshot for sessionId, or null if not found. */
  loadSession(sessionId: string): Promise<PersistedSession | null>;
  /** Remove a session record from storage. */
  deleteSession(sessionId: string): Promise<void>;
  /** Return all stored sessionIds, newest first. */
  listSessions(): Promise<string[]>;
}

/**
 * Contract for a trace store.
 * Traces are append-only from a business perspective; delete is for admin cleanup.
 */
export interface ITraceStore {
  /** Persist all messages for a traceId.  Overwrites any existing trace. */
  saveTrace(trace: PersistedTrace): Promise<void>;
  /** Load all messages for traceId, or null if not found. */
  loadTrace(traceId: string): Promise<PersistedTrace | null>;
  /** Remove a trace from storage. */
  deleteTrace(traceId: string): Promise<void>;
  /** Return all stored traceIds. */
  listTraces(): Promise<string[]>;
}

/**
 * Contract for an export snapshot store.
 * Snapshots are immutable once written.
 */
export interface IExportStore {
  /** Persist a completed export snapshot. */
  saveSnapshot(snapshot: ExportSnapshot): Promise<void>;
  /** Load an export snapshot by snapshotId, or null if not found. */
  loadSnapshot(snapshotId: string): Promise<ExportSnapshot | null>;
  /** Return all stored snapshotIds, newest first. */
  listSnapshots(): Promise<string[]>;
}

/**
 * Unified persistence layer — composes the three stores.
 * Injected into agents or the AutonomousAgent via constructor.
 */
export interface IPersistenceLayer {
  sessions: ISessionStore;
  traces:   ITraceStore;
  exports:  IExportStore;
}

// ─── SchemaMigration ─────────────────────────────────────────────────────────

/**
 * Describes how to transform persisted data from one schema version to the next.
 * The migration runner (P6-08C) will collect and apply these in version order.
 *
 * `migrate` receives the raw JSON-parsed object and must return the updated form.
 * Throw if migration is impossible so the caller can quarantine the record.
 */
export interface SchemaMigration {
  fromVersion:  number;
  toVersion:    number;
  /** Human-readable description for the migration log. */
  description:  string;
  migrate:      (data: unknown) => unknown;
}

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Returns true if `obj` is a structurally valid PersistedSession. */
export function isPersistedSession(obj: unknown): obj is PersistedSession {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o['schemaVersion'] === 'number' &&
    typeof o['sessionId']     === 'string' && o['sessionId'] !== '' &&
    typeof o['savedAt']       === 'number' &&
    typeof o['goal']          === 'string' &&
    typeof o['state']         === 'string' &&
    typeof o['startedAt']     === 'number' &&
    typeof o['specRetries']   === 'number' &&
    Array.isArray(o['messageLog'])
  );
}

/** Returns true if `obj` is a structurally valid PersistedTrace. */
export function isPersistedTrace(obj: unknown): obj is PersistedTrace {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o['schemaVersion'] === 'number' &&
    typeof o['traceId']       === 'string' && o['traceId'] !== '' &&
    Array.isArray(o['messages']) &&
    typeof o['createdAt']     === 'number' &&
    typeof o['updatedAt']     === 'number'
  );
}

/** Returns true if `obj` is a structurally valid ExportSnapshot. */
export function isExportSnapshot(obj: unknown): obj is ExportSnapshot {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o['schemaVersion'] === 'number' &&
    typeof o['snapshotId']    === 'string' && o['snapshotId'] !== '' &&
    typeof o['exportedAt']    === 'number' &&
    isPersistedSession(o['session']) &&
    Array.isArray(o['traces']) &&
    Array.isArray(o['legalBasis']) &&
    typeof o['summary']       === 'string'
  );
}

// ─── Migration helpers ────────────────────────────────────────────────────────

/**
 * Returns true if the persisted record's schemaVersion is older than the
 * current PERSISTENCE_SCHEMA_VERSION and therefore requires migration.
 */
export function needsMigration(record: { schemaVersion: number }): boolean {
  return record.schemaVersion < PERSISTENCE_SCHEMA_VERSION;
}

/**
 * Returns true if the persisted record's schemaVersion is NEWER than the
 * current PERSISTENCE_SCHEMA_VERSION.  This indicates a downgrade scenario
 * where the code is older than the stored data — the caller should refuse
 * to load the record to prevent data corruption.
 */
export function isNewerSchema(record: { schemaVersion: number }): boolean {
  return record.schemaVersion > PERSISTENCE_SCHEMA_VERSION;
}

// ─── Serializers ─────────────────────────────────────────────────────────────

/** Converts an AgentMessage to a JSON-safe PersistedMessage. */
export function serializeMessage(msg: AgentMessage): PersistedMessage {
  return {
    traceId:    msg.traceId,
    from:       msg.from,
    to:         msg.to,
    type:       msg.type,
    payload:    msg.payload,
    timestamp:  msg.timestamp,
    legalBasis: msg.legalBasis,
  };
}

/**
 * Converts a live AgentSession to a PersistedSession snapshot.
 * `savedAt` is stamped with the current wall-clock time.
 */
export function serializeSession(session: AgentSession): PersistedSession {
  return {
    schemaVersion:   PERSISTENCE_SCHEMA_VERSION,
    sessionId:       session.sessionId,
    savedAt:         Date.now(),
    goal:            session.goal,
    state:           session.state,
    startedAt:       session.startedAt,
    completedAt:     session.completedAt,
    specRetries:     session.specRetries,
    totalBudget:     session.totalBudget,
    budgetYear:      session.budgetYear,
    plannerOutput:   session.plannerOutput,
    dossierReview:   session.dossierReview,
    riskOutput:      session.riskOutput,
    pkg:             session.pkg,
    pendingQuestion: session.pendingQuestion,
    messageLog:      session.messageLog.map(serializeMessage),
  };
}

/**
 * Builds a PersistedTrace from a traceId and the ordered list of AgentMessages
 * logged under that traceId.  Requires at least one message.
 */
export function serializeTrace(traceId: string, messages: AgentMessage[]): PersistedTrace {
  const timestamps = messages.map(m => m.timestamp);
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    traceId,
    messages:  messages.map(serializeMessage),
    createdAt: timestamps.length > 0 ? Math.min(...timestamps) : Date.now(),
    updatedAt: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
  };
}

/**
 * Creates an ExportSnapshot from the components available after a completed
 * workflow run.  The caller supplies the snapshotId (typically a UUID from
 * generateTraceId) and the legal / summary data from AutonomousAgent.
 */
export function createExportSnapshot(opts: {
  snapshotId:  string;
  session:     AgentSession;
  traces:      Array<{ traceId: string; messages: AgentMessage[] }>;
  legalBasis:  string[];
  summary:     string;
}): ExportSnapshot {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    snapshotId:    opts.snapshotId,
    exportedAt:    Date.now(),
    session:       serializeSession(opts.session),
    traces:        opts.traces.map(t => serializeTrace(t.traceId, t.messages)),
    legalBasis:    [...new Set(opts.legalBasis)],
    summary:       opts.summary,
  };
}
