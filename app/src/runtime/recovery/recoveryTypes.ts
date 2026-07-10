import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'

// ── Recovery Metadata — Phase X.13 Conversation Persistence Recovery ──────────
// A RecoveryMarker records one conversational turn's lifecycle independently of the turn's own
// session/history persistence (src/runtime/conversationEntryOrchestrator.ts, X.11, frozen,
// unmodified by this milestone). Written PENDING before the turn starts, transitioned to
// COMPLETED/FAILED after it ends. A marker left PENDING after a process restart is the signal
// that a conversation was interrupted by a crash, a hard shutdown-timeout, or (were a streaming
// conversation endpoint to exist) an interrupted stream -- the same PENDING/not-PENDING
// distinction applies uniformly regardless of transport, since no session-aware streaming
// conversation endpoint exists yet (X.12 built only a non-streaming POST route).
//
// Deliberately a separate concept from AdvisorySessionStatus (Phase X.1, frozen shape) rather
// than an extension of it: session lifecycle (CREATED/ACTIVE/IDLE/ARCHIVED) and turn-in-flight
// bookkeeping are different concerns with different lifecycles -- a session can be perfectly
// healthy (ACTIVE) while a specific turn attempt against it failed or crashed.

export type RecoveryMarkerStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

export interface RecoveryMarker {
  readonly id: string
  readonly createdAt: string
  readonly updatedAt: string
  /** Known when resuming an existing session; also set retroactively on successful completion
   *  of a brand-new session's first turn (its id isn't known until the turn actually creates it). */
  readonly sessionId?: string
  readonly question: string
  readonly asOfDate?: string
  readonly status: RecoveryMarkerStatus
  readonly startedAt: string
  readonly completedAt?: string
  readonly error?: string
}

/** A PENDING marker represents an operation that started but never reached a terminal state --
 *  the recovery queue's own membership predicate ("unfinished stream/turn detection"). */
export function isUnfinished(marker: RecoveryMarker): boolean {
  return marker.status === 'PENDING'
}

export interface IRecoveryRepository extends IBaseRepository<RecoveryMarker> {
  /** The recovery queue: every unfinished marker, oldest first (FIFO) -- the durable queue IS
   *  the repository's own PENDING rows; no separate in-memory queue structure is introduced. */
  findPending(): Promise<readonly RecoveryMarker[]>
  findBySessionId(sessionId: string): Promise<readonly RecoveryMarker[]>
}
