import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { runToolCallingStage, neverInvokeTool } from '../reasoning/application/toolCallingStage.ts'
import type { Application } from '../bootstrap/buildApplication.ts'

// ── Reasoning Routes — Phase X.9.1 ─────────────────────────────────────────────
// Thin HTTP adapter over the real, frozen chain: detectIntent() -> pipeline.answer() ->
// formatConversationResponse() -> runToolCallingStage(). Every step is an unmodified call to an
// already-frozen, already-tested public function from X.4-X.7 — this file contributes no
// reasoning/formatting/tool-calling logic of its own, mirroring the exact "thin handler ->
// validate -> call service -> map response" discipline already established by
// src/interface/restAdapter.ts (Phase 14).
//
// Always routes through runToolCallingStage() (with the default neverInvokeTool decider unless
// the caller supplies one) rather than skipping it, so the complete X.4-X.7 chain is genuinely
// exercised end-to-end for every request — never bypassed for convenience.

interface AnswerRequestBody {
  readonly question?: unknown
  readonly asOfDate?: unknown
}

function parseAnswerBody(body: unknown): { question: string; asOfDate?: string } | null {
  const b = (body ?? {}) as AnswerRequestBody
  if (typeof b.question !== 'string' || b.question.trim() === '') return null
  const result: { question: string; asOfDate?: string } = { question: b.question }
  if (typeof b.asOfDate === 'string' && b.asOfDate.trim() !== '') result.asOfDate = b.asOfDate
  return result
}

export function registerReasoningRoutes(server: FastifyInstance, app: Application): void {
  server.post('/api/v1/reasoning/answer', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseAnswerBody(req.body)
    if (parsed === null) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: "Body must include a non-empty 'question' string." } })
    }

    const intent = detectIntent({ question: parsed.question, asOfDate: parsed.asOfDate })
    const answer = await app.reasoningPipeline.answer(intent)
    const response = formatConversationResponse(answer)
    const augmented = await runToolCallingStage(response, answer, app.toolExecutor, { decider: neverInvokeTool })

    return reply.status(200).send({ ok: true, data: augmented })
  })
}
