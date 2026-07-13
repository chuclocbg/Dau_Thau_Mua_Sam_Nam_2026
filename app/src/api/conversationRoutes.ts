import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { RuntimeContext } from '../runtime/runtimeContext.ts'
import { runAuthorizedConversationTurn } from '../identity/application/runtimeAuthorization.ts'
import type { ISessionIdentityRepository } from '../identity/infrastructure/sessionIdentityRepository.ts'
import { resolvePrincipalFromRequest } from './httpPrincipalResolver.ts'

// ── Conversation Routes — Phase X.12, extended X.15 ────────────────────────────
// Thin HTTP adapter over the real, frozen X.11 Conversation Runtime: this file's ONLY job is
// request/response mapping around runConversationTurn() — the single existing orchestration
// entry point that already reaches detectIntent -> RuntimeSessionBuilder ->
// reasoningPipeline.answer() -> formatConversationResponse() -> runToolCallingStage(). No
// reasoning/session/formatting/tool-calling logic of its own, mirroring the exact "thin handler
// -> validate -> call service -> map response" discipline already established by
// src/api/reasoningRoutes.ts (Phase X.9.1). Deliberately does NOT call detectIntent(),
// formatConversationResponse(), or runToolCallingStage() directly -- those are
// runConversationTurn()'s own internal, already-tested composition, not this file's concern.
//
// X.15 ADDITION, per ADR_X15_ARCHITECTURE_DECISION.md: calls runAuthorizedConversationTurn()
// (Phase X.14, unmodified, reused verbatim) instead of runConversationTurn() directly.
// runAuthorizedConversationTurn() itself calls runConversationTurn() internally -- this file
// still never calls the reasoning chain directly. A denied request returns 403 with the
// AuthorizationDecision's own reason; nothing about the underlying reasoning/session logic
// changes. Per the ADR's explicit scope, this does NOT wire runRecoverableConversationTurn()
// (Phase X.13) -- recovery-producer wiring was deliberately deferred (see the ADR's Decision
// and Rejected Alternatives sections) since composing it with authorization around one turn
// would require either modifying a frozen X.13/X.14 file or duplicating security-sensitive
// ownership-check logic outside a clean interface -- both rejected.

interface ConversationTurnRequestBody {
  readonly sessionId?: unknown
  readonly question?: unknown
  readonly asOfDate?: unknown
}

function parseConversationTurnBody(body: unknown): { sessionId?: string; question: string; asOfDate?: string } | null {
  const b = (body ?? {}) as ConversationTurnRequestBody
  if (typeof b.question !== 'string' || b.question.trim() === '') return null
  const result: { sessionId?: string; question: string; asOfDate?: string } = { question: b.question }
  if (typeof b.sessionId === 'string' && b.sessionId.trim() !== '') result.sessionId = b.sessionId
  if (typeof b.asOfDate === 'string' && b.asOfDate.trim() !== '') result.asOfDate = b.asOfDate
  return result
}

export function registerConversationRoutes(
  server: FastifyInstance,
  runtime: RuntimeContext,
  sessionIdentityRepository: ISessionIdentityRepository,
): void {
  server.post('/api/v1/conversation/turn', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseConversationTurnBody(req.body)
    if (parsed === null) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: "Body must include a non-empty 'question' string." } })
    }

    const auth = resolvePrincipalFromRequest(req)
    const outcome = await runAuthorizedConversationTurn(auth, sessionIdentityRepository, runtime, parsed)
    if (!outcome.authorized) {
      return reply.status(403).send({ ok: false, error: { code: 'FORBIDDEN', message: outcome.decision.reason } })
    }
    return reply.status(200).send({ ok: true, data: outcome.result })
  })
}
