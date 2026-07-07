import { randomUUID } from 'node:crypto'

// ── Request Context — Phase X.9.2 ──────────────────────────────────────────────
// Request ID and Correlation ID resolution. Request IDs are always generated fresh per request
// (Fastify already assigns req.id; this module is for the correlation ID specifically, which —
// unlike a request ID — should be honored across service boundaries when a caller supplies one).

export const CORRELATION_ID_HEADER = 'x-correlation-id'

export function generateRequestId(): string {
  return randomUUID()
}

export function resolveCorrelationId(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers[CORRELATION_ID_HEADER]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value !== undefined && value.trim() !== '' ? value : randomUUID()
}
