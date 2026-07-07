import type { NodeEnv } from '../config/appConfig.ts'

// ── Error Mapper — Phase X.9.2 ─────────────────────────────────────────────────
// Pure function: any thrown error (Fastify validation errors, framework errors, unexpected
// exceptions) -> a consistent HTTP status + body. Never touches ConversationResponse or any
// domain response object — this is the framework-level error envelope for requests that never
// reached a route handler's own { ok, data|error } shape (already established by X.9.1's
// reasoningRoutes.ts/coordinatorRoutes.ts), not a replacement for it.

export interface HttpErrorBody {
  readonly ok: false
  readonly error: {
    readonly code: string
    readonly message: string
  }
}

export interface HttpErrorResponse {
  readonly statusCode: number
  readonly body: HttpErrorBody
}

interface FastifyLikeError {
  readonly statusCode?: number
  readonly code?: string
  readonly message?: string
  readonly validation?: unknown
}

export function mapErrorToHttpResponse(err: unknown, nodeEnv: NodeEnv): HttpErrorResponse {
  const fastifyErr = (err ?? {}) as FastifyLikeError

  if (fastifyErr.validation !== undefined) {
    return {
      statusCode: 400,
      body: { ok: false, error: { code: 'VALIDATION_ERROR', message: fastifyErr.message ?? 'Request failed validation.' } },
    }
  }

  const statusCode = typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 600
    ? fastifyErr.statusCode
    : 500
  const isServerError = statusCode >= 500
  const message = isServerError && nodeEnv === 'production'
    ? 'An unexpected error occurred.'
    : (fastifyErr.message ?? 'An unexpected error occurred.')

  return {
    statusCode,
    body: { ok: false, error: { code: fastifyErr.code ?? (isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'), message } },
  }
}
