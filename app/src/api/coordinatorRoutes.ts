import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { buildReasoningWorkerTask } from '../multiagent/application/reasoningWorkerAdapter.ts'
import type { Application } from '../bootstrap/buildApplication.ts'

// ── Coordinator Routes — Phase X.9.1 ───────────────────────────────────────────
// Thin HTTP adapter over the real, frozen X.8 chain: buildReasoningWorkerTask() (per question)
// -> CoordinatorAgent.run(). Every WorkerTask built here deterministically calls the same,
// shared, injected ReasoningEnginePipeline (via reasoningWorkerAdapter.ts) — this file
// contributes no scheduling/reasoning logic of its own, only request/response mapping.

interface BatchRequestBody {
  readonly questions?: unknown
  readonly asOfDate?: unknown
}

function parseBatchBody(body: unknown): { questions: string[]; asOfDate?: string } | null {
  const b = (body ?? {}) as BatchRequestBody
  if (!Array.isArray(b.questions) || b.questions.length === 0) return null
  if (!b.questions.every((q): q is string => typeof q === 'string' && q.trim() !== '')) return null
  const result: { questions: string[]; asOfDate?: string } = { questions: b.questions }
  if (typeof b.asOfDate === 'string' && b.asOfDate.trim() !== '') result.asOfDate = b.asOfDate
  return result
}

export function registerCoordinatorRoutes(server: FastifyInstance, app: Application): void {
  server.post('/api/v1/reasoning/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseBatchBody(req.body)
    if (parsed === null) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: "Body must include a non-empty 'questions' array of non-empty strings." } })
    }

    const tasks = parsed.questions.map((question, index) => {
      const intent = detectIntent({ question, asOfDate: parsed.asOfDate })
      return buildReasoningWorkerTask(`q-${index}`, intent, app.reasoningPipeline)
    })

    const result = await app.coordinator.run(tasks)
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error })
    }
    return reply.status(200).send({ ok: true, data: result.value })
  })
}
