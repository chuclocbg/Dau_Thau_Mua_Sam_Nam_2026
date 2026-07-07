// ── Tracing Types — Phase X.9.2 ────────────────────────────────────────────────
// An OpenTelemetry-SHAPED tracing abstraction (traceId/spanId/parentSpanId, span attributes) —
// deliberately vendor-free: no @opentelemetry/* package is a direct dependency of this
// repository (only an undeclared transitive one, never imported here). A real OTel SDK could
// implement this same Tracer interface later without touching any call site.

export interface TraceContext {
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId?: string
}

export interface Span {
  readonly context: TraceContext
  readonly durationMs: number | undefined
  setAttribute(key: string, value: unknown): void
  end(): void
}

export interface Tracer {
  startSpan(name: string, parent?: TraceContext): Span
}
