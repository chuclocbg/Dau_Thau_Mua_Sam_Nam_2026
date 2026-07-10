import { runConversationTurn } from '../conversationEntryOrchestrator.ts'
import type { ConversationTurnRequest, ConversationTurnResult } from '../conversationEntryOrchestrator.ts'
import type { RuntimeContext } from '../runtimeContext.ts'
import type { IRecoveryRepository } from './recoveryTypes.ts'

// ── Recoverable Conversation Turn — Phase X.13 (producer side) ────────────────
// The genuinely-missing piece that makes recovery possible at all: without this wrapper, no
// RecoveryMarker is ever created, so there would be nothing for the recovery queue/manager to
// find. Wraps runConversationTurn() (Phase X.11, frozen, unmodified -- imported and called
// as-is, never reimplemented) rather than duplicating its orchestration: writes a PENDING
// marker before the call, COMPLETED after success, FAILED (with the error captured, never
// swallowed) if it throws -- then re-throws so callers still observe the real failure.
//
// HONEST LIMITATION: this does not provide exactly-once semantics across a crash. If the
// process dies in the narrow window after runConversationTurn() has already persisted the
// session but before this function marks the marker COMPLETED, a later replay of that marker
// will append a duplicate turn to the session's history. True exactly-once would require
// runConversationTurn()'s own session persist() call and this marker's completion update to
// share one atomic transaction -- not achievable without modifying runConversationTurn() itself
// (frozen, X.11) or the persistence layer's session repository (frozen, X.10/X.11). This
// provides at-least-once replay, not exactly-once -- stated plainly, not glossed over.

export async function runRecoverableConversationTurn(
  recoveryRepository: IRecoveryRepository,
  runtime: RuntimeContext,
  request: ConversationTurnRequest,
): Promise<ConversationTurnResult> {
  const marker = await recoveryRepository.create({
    ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
    question: request.question,
    ...(request.asOfDate !== undefined ? { asOfDate: request.asOfDate } : {}),
    status: 'PENDING',
    startedAt: new Date().toISOString(),
  })

  try {
    const result = await runConversationTurn(runtime, request)
    await recoveryRepository.update(marker.id, {
      status: 'COMPLETED',
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
    })
    return result
  } catch (err) {
    await recoveryRepository.update(marker.id, {
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    })
    throw err
  }
}
