import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { runConversationTurn } from '../runtime/conversationEntryOrchestrator.ts'
import type { RuntimeContext } from '../runtime/runtimeContext.ts'

// ── Conversation Routes — Phase X.12 ───────────────────────────────────────────
// Thin HTTP adapter over the real, frozen X.11 Conversation Runtime: this file's ONLY job is
// request/response mapping around runConversationTurn() — the single existing orchestration
// entry point that already reaches detectIntent -> RuntimeSessionBuilder ->
// reasoningPipeline.answer() -> formatConversationResponse() -> runToolCallingStage(). No
// reasoning/session/formatting/tool-calling logic of its own, mirroring the exact "thin handler
// -> validate -> call service -> map response" discipline already established by
// src/api/reasoningRoutes.ts (Phase X.9.1). Deliberately does NOT call detectIntent(),
// formatConversationResponse(), or runToolCallingStage() directly -- those are
// runConversationTurn()'s own internal, already-tested composition, not this file's concern.

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

export function registerConversationRoutes(server: FastifyInstance, runtime: RuntimeContext): void {
  server.post('/api/v1/conversation/turn', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseConversationTurnBody(req.body)
    if (parsed === null) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: "Body must include a non-empty 'question' string." } })
    }

    const result = await runConversationTurn(runtime, parsed)
    return reply.status(200).send({ ok: true, data: result })
  })
}
