import { describe, it, expect } from 'vitest'
import { SimpleTracer, parseTraceParent, formatTraceParent } from '../tracing/tracer.ts'

describe('SimpleTracer — startSpan', () => {
  it('generates a fresh traceId/spanId when there is no parent', () => {
    const tracer = new SimpleTracer()
    const span = tracer.startSpan('root')
    expect(span.context.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(span.context.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(span.context.parentSpanId).toBeUndefined()
  })

  it('inherits the parent traceId and sets parentSpanId when a parent is given', () => {
    const tracer = new SimpleTracer()
    const parent = tracer.startSpan('parent')
    const child = tracer.startSpan('child', parent.context)
    expect(child.context.traceId).toBe(parent.context.traceId)
    expect(child.context.parentSpanId).toBe(parent.context.spanId)
    expect(child.context.spanId).not.toBe(parent.context.spanId)
  })

  it('generates a new spanId for every span, even without a parent', () => {
    const tracer = new SimpleTracer()
    const a = tracer.startSpan('a')
    const b = tracer.startSpan('b')
    expect(a.context.spanId).not.toBe(b.context.spanId)
    expect(a.context.traceId).not.toBe(b.context.traceId)
  })
})

describe('SimpleSpan — attributes and duration', () => {
  it('records attributes and reports duration only after end()', () => {
    const tracer = new SimpleTracer()
    const span = tracer.startSpan('work')
    expect(span.durationMs).toBeUndefined()
    span.setAttribute('key', 'value')
    span.end()
    expect(span.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('end() is idempotent — duration does not change on a second call', () => {
    const tracer = new SimpleTracer()
    const span = tracer.startSpan('work')
    span.end()
    const first = span.durationMs
    span.end()
    expect(span.durationMs).toBe(first)
  })
})

describe('parseTraceParent / formatTraceParent — W3C Trace Context', () => {
  it('round-trips a valid traceparent header', () => {
    const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    const context = parseTraceParent(header)
    expect(context).toEqual({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7' })
    expect(formatTraceParent(context!)).toBe(header)
  })

  it('returns undefined for a missing header', () => {
    expect(parseTraceParent(undefined)).toBeUndefined()
  })

  it('returns undefined for a malformed header', () => {
    expect(parseTraceParent('not-a-traceparent')).toBeUndefined()
    expect(parseTraceParent('00-tooshort-00f067aa0ba902b7-01')).toBeUndefined()
  })
})
