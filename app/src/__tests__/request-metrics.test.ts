import { describe, it, expect } from 'vitest'
import { MetricsCollector } from '../providers/MetricsCollector.ts'
import { recordRequestStart, recordRequestCompletion } from '../metrics/requestMetrics.ts'

// Parity: proves requestMetrics.ts genuinely delegates to the real, unmodified
// MetricsCollector.increment()/add() rather than reimplementing counter storage.

describe('recordRequestStart', () => {
  it('increments a real MetricsCollector counter, not a private store', () => {
    const metrics = new MetricsCollector()
    recordRequestStart(metrics, '/api/v1/reasoning/answer')
    recordRequestStart(metrics, '/api/v1/reasoning/answer')
    expect(metrics.get('http_requests_total{route="/api/v1/reasoning/answer"}')).toBe(2)
  })
})

describe('recordRequestCompletion', () => {
  it('increments response/duration counters on the real MetricsCollector', () => {
    const metrics = new MetricsCollector()
    recordRequestCompletion(metrics, '/live', 200, 5)
    recordRequestCompletion(metrics, '/live', 200, 15)

    expect(metrics.get('http_responses_total{route="/live",status="200"}')).toBe(2)
    expect(metrics.get('http_request_duration_ms_sum{route="/live"}')).toBe(20)
    expect(metrics.get('http_request_duration_ms_count{route="/live"}')).toBe(2)
  })

  it('keys counters per route and per status code independently', () => {
    const metrics = new MetricsCollector()
    recordRequestCompletion(metrics, '/ready', 200, 1)
    recordRequestCompletion(metrics, '/ready', 503, 1)
    expect(metrics.get('http_responses_total{route="/ready",status="200"}')).toBe(1)
    expect(metrics.get('http_responses_total{route="/ready",status="503"}')).toBe(1)
  })
})
