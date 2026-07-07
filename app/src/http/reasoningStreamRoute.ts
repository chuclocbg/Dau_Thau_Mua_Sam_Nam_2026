import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { runToolCallingStage, neverInvokeTool } from '../reasoning/application/toolCallingStage.ts'
import type { Application } from '../bootstrap/buildApplication.ts'
import { SSEWriter } from '../streaming/sseWriter.ts'
import { raceSignalAndTimeout, StreamAbortedError, StreamTimeoutError } from '../streaming/streamRace.ts'
import { createAbortSignalForResponse } from '../cancellation/requestAbortSignal.ts'

// ── Reasoning Stream Route — Phase X.9.3 ───────────────────────────────────────
// POST /api/v1/reasoning/answer/stream — a Server-Sent Events adapter over the exact same real,
// frozen chain X.9.1's reasoningRoutes.ts already calls: detectIntent() -> pipeline.answer() ->
// formatConversationResponse() -> runToolCallingStage(). Two independent consumers of the same
// frozen functions (same pattern already established by X.8's reasoningWorkerAdapter.ts existing
// alongside X.9.1's reasoningRoutes.ts) — reasoningRoutes.ts itself is never modified.
//
// SCOPE NOTE: only the single-question path is streamed. Streaming the Multi-Agent batch path
// would require CoordinatorAgent to expose a per-task progress callback, which it does not (its
// run() resolves only once every wave has finished) — adding one would mean modifying the frozen
// src/multiagent/**, explicitly forbidden this milestone. Not built, not fabricated.
//
// This route calls reply.hijack() to take manual control of the raw response for SSE framing —
// Fastify's own onResponse hook (X.9.2's registerRequestLifecycleHooks) does not fire for a
// hijacked reply, so stream-specific logging/metrics are recorded directly here instead. The
// onRequest hook DOES already run before the handler starts, so req.correlationId/
// req.traceContext (set by the frozen X.9.2 hook) are reused as-is, not re-derived.

interface StreamRequestBody {
  readonly question?: unknown
  readonly asOfDate?: unknown
}

function parseStreamBody(body: unknown): { question: string; asOfDate?: string } | null {
  const b = (body ?? {}) as StreamRequestBody
  if (typeof b.question !== 'string' || b.question.trim() === '') return null
  const result: { question: string; asOfDate?: string } = { question: b.question }
  if (typeof b.asOfDate === 'string' && b.asOfDate.trim() !== '') result.asOfDate = b.asOfDate
  return result
}

export interface ReasoningStreamRouteOptions {
  readonly streamTimeoutMs: number
}

export function registerReasoningStreamRoute(
  server: FastifyInstance, app: Application, options: ReasoningStreamRouteOptions,
): void {
  server.post('/api/v1/reasoning/answer/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseStreamBody(req.body)
    if (parsed === null) {
      return reply.status(400).send({ ok: false, error: { code: 'INVALID_REQUEST', message: "Body must include a non-empty 'question' string." } })
    }

    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const writer = new SSEWriter(res)
    const signal = createAbortSignalForResponse(res)
    const log = app.logger.child({ requestId: req.id, correlationId: req.correlationId, traceId: req.traceContext?.traceId })
    const span = app.tracer.startSpan('reasoning.answer.stream', req.traceContext)
    const startedAt = Date.now()

    app.metrics.increment('sse_streams_total')
    log.info('stream started', { question: parsed.question })

    try {
      await writer.writeEvent({ event: 'stage', data: { stage: 'reasoning', status: 'started' } })

      const intent = detectIntent({ question: parsed.question, asOfDate: parsed.asOfDate })
      const answer = await raceSignalAndTimeout(app.reasoningPipeline.answer(intent), signal, options.streamTimeoutMs)
      await writer.writeEvent({ event: 'stage', data: { stage: 'reasoning', status: 'completed' } })

      const response = formatConversationResponse(answer)
      await writer.writeEvent({ event: 'stage', data: { stage: 'formatting', status: 'completed' } })

      const augmented = await raceSignalAndTimeout(
        runToolCallingStage(response, answer, app.toolExecutor, { decider: neverInvokeTool }),
        signal, options.streamTimeoutMs,
      )
      await writer.writeEvent({ event: 'stage', data: { stage: 'tool_calling', status: 'completed', toolInvoked: augmented.toolInvoked } })
      await writer.writeEvent({ event: 'result', data: augmented })

      span.setAttribute('toolInvoked', augmented.toolInvoked)
      app.metrics.increment('sse_streams_completed_total')
      log.info('stream completed', { durationMs: Date.now() - startedAt })
    } catch (err) {
      if (err instanceof StreamAbortedError) {
        app.metrics.increment('sse_streams_aborted_total')
        log.warn('stream aborted by client disconnect', { durationMs: Date.now() - startedAt })
      } else if (err instanceof StreamTimeoutError) {
        app.metrics.increment('sse_streams_timeout_total')
        await writer.writeEvent({ event: 'error', data: { code: 'STREAM_TIMEOUT', message: `Exceeded ${options.streamTimeoutMs}ms.` } })
        log.error('stream timed out', { durationMs: Date.now() - startedAt })
      } else {
        app.metrics.increment('sse_streams_error_total')
        await writer.writeEvent({ event: 'error', data: { code: 'STREAM_ERROR', message: String(err) } })
        log.error('stream failed', { error: String(err), durationMs: Date.now() - startedAt })
      }
    } finally {
      span.end()
      await writer.close()
    }
  })
}
