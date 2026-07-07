import { randomBytes } from 'node:crypto'
import type { Span, TraceContext, Tracer } from './tracingTypes.ts'

// ── Simple Tracer — Phase X.9.2 ────────────────────────────────────────────────
// Dependency-free Tracer implementation, plus W3C Trace Context ("traceparent" header)
// parsing/formatting for cross-service propagation. Both are pure string/byte manipulation —
// no vendor SDK, no network calls, no external dependency.

function hex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex')
}

class SimpleSpan implements Span {
  readonly context: TraceContext
  private readonly attributes: Record<string, unknown> = {}
  private readonly startedAtMs = Date.now()
  private endedAtMs: number | undefined

  constructor(context: TraceContext) {
    this.context = context
  }

  setAttribute(key: string, value: unknown): void {
    this.attributes[key] = value
  }

  end(): void {
    if (this.endedAtMs === undefined) this.endedAtMs = Date.now()
  }

  get durationMs(): number | undefined {
    return this.endedAtMs === undefined ? undefined : this.endedAtMs - this.startedAtMs
  }
}

export class SimpleTracer implements Tracer {
  startSpan(name: string, parent?: TraceContext): Span {
    const context: TraceContext = {
      traceId: parent?.traceId ?? hex(16),
      spanId: hex(8),
      ...(parent !== undefined ? { parentSpanId: parent.spanId } : {}),
    }
    const span = new SimpleSpan(context)
    span.setAttribute('span.name', name)
    return span
  }
}

const TRACEPARENT_PATTERN = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i

export function parseTraceParent(header: string | undefined): TraceContext | undefined {
  if (header === undefined) return undefined
  const match = TRACEPARENT_PATTERN.exec(header.trim())
  if (match === null) return undefined
  return { traceId: match[1]!, spanId: match[2]! }
}

export function formatTraceParent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-01`
}
