import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CORRELATION_ID_HEADER, resolveCorrelationId } from '../logging/requestContext.ts'
import { parseTraceParent, formatTraceParent } from '../tracing/tracer.ts'
import type { Tracer, TraceContext } from '../tracing/tracingTypes.ts'
import { recordRequestStart, recordRequestCompletion } from '../metrics/requestMetrics.ts'
import { mapErrorToHttpResponse } from './errorMapper.ts'
import type { StructuredLogger } from '../logging/structuredLogger.ts'
import type { MetricsCollector } from '../providers/MetricsCollector.ts'
import type { NodeEnv } from '../config/appConfig.ts'

// ── Request Lifecycle Hooks — Phase X.9.2 ──────────────────────────────────────
// The single Fastify-specific wiring point for this milestone's cross-cutting concerns: request
// timing, correlation ID resolution, W3C trace context propagation, structured request logging,
// request metrics, and the global error handler (HTTP exception mapping). Registered once by
// server/httpServer.ts (X.9.1, touched only for this DI wiring, per this milestone's explicit
// carve-out) — no reasoning/retrieval/Tool Calling/MCP/Multi-Agent logic lives here.

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string
    traceContext?: TraceContext
    startTimeMs?: number
  }
}

export interface RequestLifecycleDependencies {
  readonly logger: StructuredLogger
  readonly metrics: MetricsCollector
  readonly tracer: Tracer
  readonly nodeEnv: NodeEnv
}

export function registerRequestLifecycleHooks(server: FastifyInstance, deps: RequestLifecycleDependencies): void {
  server.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    req.startTimeMs = Date.now()
    req.correlationId = resolveCorrelationId(req.headers as Record<string, string | string[] | undefined>)

    const parentContext = parseTraceParent(req.headers['traceparent'] as string | undefined)
    const span = deps.tracer.startSpan(`${req.method} ${req.url}`, parentContext)
    req.traceContext = span.context

    reply.header(CORRELATION_ID_HEADER, req.correlationId)
    reply.header('traceparent', formatTraceParent(span.context))

    recordRequestStart(deps.metrics, req.url)
    deps.logger.child({ requestId: req.id, correlationId: req.correlationId, traceId: span.context.traceId })
      .info('request received', { method: req.method, url: req.url })
  })

  server.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const durationMs = req.startTimeMs !== undefined ? Date.now() - req.startTimeMs : 0
    recordRequestCompletion(deps.metrics, req.url, reply.statusCode, durationMs)
    deps.logger.child({ requestId: req.id, correlationId: req.correlationId, traceId: req.traceContext?.traceId })
      .info('request completed', { statusCode: reply.statusCode, durationMs })
  })

  server.setErrorHandler(async (err: Error, req: FastifyRequest, reply: FastifyReply) => {
    const { statusCode, body } = mapErrorToHttpResponse(err, deps.nodeEnv)
    deps.logger.child({ requestId: req.id, correlationId: req.correlationId, traceId: req.traceContext?.traceId })
      .error('request failed', { statusCode, errorCode: body.error.code, message: body.error.message })
    return reply.status(statusCode).send(body)
  })
}
