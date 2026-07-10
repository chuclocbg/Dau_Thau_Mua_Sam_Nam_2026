import { runConversationTurn } from '../conversationEntryOrchestrator.ts'
import type { ConversationTurnResult } from '../conversationEntryOrchestrator.ts'
import type { RuntimeContext } from '../runtimeContext.ts'
import type { IRecoveryRepository, RecoveryMarker } from './recoveryTypes.ts'
import { isUnfinished } from './recoveryTypes.ts'

// ── Conversation Recovery Coordinator — Phase X.13 ─────────────────────────────
// Recovers exactly one marker: pending-session restoration (letting runConversationTurn()'s own
// existing resumeSession()-or-createSession() logic run again, unmodified -- not a second
// session-resolution mechanism), deterministic replay of the original question/asOfDate, then
// marking the outcome. Idempotent for the realistic sequential-scan case: re-fetches the
// marker's current status immediately before acting and is a safe no-op once it is no longer
// PENDING (see runtimeRecoveryManager.ts's own scan loop, and recoverableConversationTurn.ts's
// header comment for the at-least-once, not exactly-once, caveat this inherits).

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

  try {
    const result = await runConversationTurn(runtime, {
      ...(marker.sessionId !== undefined ? { sessionId: marker.sessionId } : {}),
      question: marker.question,
      ...(marker.asOfDate !== undefined ? { asOfDate: marker.asOfDate } : {}),
    })
    await recoveryRepository.update(marker.id, {
      status: 'COMPLETED',
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
    })
    return { recovered: true, markerId, result }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await recoveryRepository.update(marker.id, { status: 'FAILED', error, completedAt: new Date().toISOString() })
    return { recovered: false, markerId, reason: 'REPLAY_FAILED', error }
  }
}
