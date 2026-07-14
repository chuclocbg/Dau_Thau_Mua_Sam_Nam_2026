import { runConversationTurn } from '../conversationEntryOrchestrator.ts'
import type { ConversationTurnResult } from '../conversationEntryOrchestrator.ts'
import type { RuntimeContext } from '../runtimeContext.ts'
import type { IRecoveryRepository, RecoveryMarker } from './recoveryTypes.ts'
import { isUnfinished } from './recoveryTypes.ts'

// ── Conversation Recovery Coordinator — Phase X.13, extended X.19 ──────────────
// Recovers exactly one marker: pending-session restoration (letting runConversationTurn()'s own
// existing resumeSession()-or-createSession() logic run again, unmodified -- not a second
// session-resolution mechanism), deterministic replay of the original question/asOfDate, then
// marking the outcome. See recoverableConversationTurn.ts's header comment for the at-least-once,
// not exactly-once, caveat this still inherits (X.19 does not close that gap -- see
// X19_IMPLEMENTATION_PLAN.md's explicit scope boundary).
//
// X.19 ADDITION: concurrent-scan safety. The pre-X.19 version re-checked the marker's status
// immediately before acting, but that is a check-then-act race -- two concurrent scans could
// both observe PENDING before either wrote back a terminal status, both replaying the same turn.
// Closed via resolveIfPending()'s compare-and-swap: recoverMarker() now atomically CLAIMS the
// marker (a same-status, version-incrementing write) before calling runConversationTurn() at all
// -- a lost claim returns ALREADY_RESOLVED immediately, without ever replaying the turn. Only the
// scan that wins the claim proceeds, so the final COMPLETED/FAILED write (after replay) can use
// the plain update() again -- by that point this call is the marker's sole owner. The claim's
// `updates` payload is empty: the version bump alone is the claim, since resolveIfPending()
// always increments version regardless of what other fields are passed.

export type RecoveryOutcome =
  | { readonly recovered: true; readonly markerId: string; readonly result: ConversationTurnResult }
  | { readonly recovered: false; readonly markerId: string; readonly reason: 'ALREADY_RESOLVED' }
  | { readonly recovered: false; readonly markerId: string; readonly reason: 'REPLAY_FAILED'; readonly error: string }

/** Re-reads the marker's current status and returns it only if still PENDING -- the idempotency
 *  check every recovery attempt must perform immediately before doing any replay work. */
export async function restorePendingMarker(
  recoveryRepository: IRecoveryRepository,
  markerId: string,
): Promise<RecoveryMarker | null> {
  const current = await recoveryRepository.findById(markerId)
  return current && isUnfinished(current) ? current : null
}

export async function recoverMarker(
  recoveryRepository: IRecoveryRepository,
  runtime: RuntimeContext,
  markerId: string,
): Promise<RecoveryOutcome> {
  const marker = await restorePendingMarker(recoveryRepository, markerId)
  if (!marker) {
    return { recovered: false, markerId, reason: 'ALREADY_RESOLVED' }
  }

  // Atomically claim the marker before replaying anything. A lost race here means another scan
  // already claimed or resolved it -- this call must not replay the turn at all, not merely skip
  // the final write.
  const claimed = await recoveryRepository.resolveIfPending(marker.id, marker.version, {})
  if (!claimed) {
    return { recovered: false, markerId, reason: 'ALREADY_RESOLVED' }
  }

  try {
    const result = await runConversationTurn(runtime, {
      ...(claimed.sessionId !== undefined ? { sessionId: claimed.sessionId } : {}),
      question: claimed.question,
      ...(claimed.asOfDate !== undefined ? { asOfDate: claimed.asOfDate } : {}),
    })
    await recoveryRepository.update(claimed.id, {
      status: 'COMPLETED',
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
    })
    return { recovered: true, markerId, result }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await recoveryRepository.update(claimed.id, { status: 'FAILED', error, completedAt: new Date().toISOString() })
    return { recovered: false, markerId, reason: 'REPLAY_FAILED', error }
  }
}
