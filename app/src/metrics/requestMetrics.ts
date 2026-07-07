import type { MetricsCollector } from '../providers/MetricsCollector.ts'

// ── Request Metrics — Phase X.9.2 ──────────────────────────────────────────────
// A thin, request-shaped naming layer over the existing, unmodified, already-tested
// MetricsCollector (src/providers/MetricsCollector.ts) — genuinely reused, not duplicated. Every
// call here delegates directly to MetricsCollector's own increment()/add(); no counter/gauge
// storage logic is reimplemented.
//
// HONEST LIMITATION: MetricsCollector only supports named numeric counters/gauges, not a true
// histogram type — request duration is recorded as a running sum + count (from which an average
// can be derived), not a percentile distribution. Documented here rather than fabricating a
// percentile this milestone cannot actually compute.

export function recordRequestStart(metrics: MetricsCollector, route: string): void {
  metrics.increment(`http_requests_total{route="${route}"}`)
}

export function recordRequestCompletion(
  metrics: MetricsCollector, route: string, statusCode: number, durationMs: number,
): void {
  metrics.increment(`http_responses_total{route="${route}",status="${statusCode}"}`)
  metrics.add(`http_request_duration_ms_sum{route="${route}"}`, durationMs)
  metrics.increment(`http_request_duration_ms_count{route="${route}"}`)
}
