/**
 * P6-11E: MetricsCollector — in-process numeric metrics accumulator.
 *
 * Tracks named numeric counters and gauges.  All metric values are numbers.
 * Missing metrics return 0 rather than an error.  Insertion order is
 * preserved by the underlying Map.
 *
 * Public API:
 *   increment(name)       — add 1 to a metric; creates at 0 if new
 *   add(name, value)      — add a finite number to a metric; creates at 0 if new
 *   set(name, value)      — set a metric to an exact finite number
 *   get(name)             — current value, or 0 when absent; never fails
 *   reset(name)           — zero an existing metric; no-op for unknown names
 *   clear()               — remove all metrics; never fails
 *   listMetrics()         — all entries in insertion order as defensive copies
 *
 * Error codes:
 *   INVALID_METRIC_NAME  — empty or non-string metric name
 *   INVALID_VALUE        — non-finite or non-number value passed to add() / set()
 *   METRICS_ERROR        — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — write errors surface as { ok: false, error }.
 *   - get(), reset(), clear(), listMetrics() never fail.
 *   - Missing metrics return 0 from get().
 *   - reset() on an unknown metric is a silent no-op (does not create an entry).
 *   - Overwriting an existing metric with set() / increment() / add() preserves
 *     its insertion position in listMetrics().
 *   - listMetrics() returns a fresh MetricEntry array each call; entries are
 *     plain objects with primitive fields, so they are inherently independent.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── MetricEntry ──────────────────────────────────────────────────────────────

/** A single metric snapshot as returned by listMetrics(). */
export interface MetricEntry {
  readonly name:  string;
  readonly value: number;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type MetricsErrorCode =
  | 'INVALID_METRIC_NAME'  // empty or non-string metric name
  | 'INVALID_VALUE'        // NaN, Infinity, or non-number passed to add/set
  | 'METRICS_ERROR';       // catch-all for unexpected failures

export interface MetricsError {
  code:    MetricsErrorCode;
  message: string;
}

export type MetricsResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: MetricsError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function metricsErr(
  code:    MetricsErrorCode,
  message: string,
): MetricsResult<never> {
  return { ok: false, error: { code, message } };
}

function isValidName(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── MetricsCollector ─────────────────────────────────────────────────────────

export class MetricsCollector {
  private readonly store: Map<string, number> = new Map();

  // ── increment ───────────────────────────────────────────────────────────────

  /**
   * Adds 1 to the named metric.
   * Creates the metric at 0 then increments when it does not yet exist.
   * Returns the new value on success.
   *
   * Returns INVALID_METRIC_NAME for empty or non-string names.
   */
  increment(name: string): MetricsResult<number> {
    if (!isValidName(name)) {
      return metricsErr('INVALID_METRIC_NAME',
        `Metric name must be a non-empty string; received: ${String(name)}.`);
    }

    const next = (this.store.get(name) ?? 0) + 1;
    this.store.set(name, next);
    return { ok: true, value: next };
  }

  // ── add ─────────────────────────────────────────────────────────────────────

  /**
   * Adds `value` to the named metric.
   * Creates the metric at 0 then adds when it does not yet exist.
   * Negative finite values are valid (they decrement).
   * Returns the new accumulated value on success.
   *
   * Returns INVALID_METRIC_NAME for empty or non-string names.
   * Returns INVALID_VALUE for NaN, ±Infinity, or non-numbers.
   */
  add(name: string, value: number): MetricsResult<number> {
    if (!isValidName(name)) {
      return metricsErr('INVALID_METRIC_NAME',
        `Metric name must be a non-empty string; received: ${String(name)}.`);
    }
    if (!isFiniteNumber(value)) {
      return metricsErr('INVALID_VALUE',
        `add() value must be a finite number; received: ${String(value)}.`);
    }

    const next = (this.store.get(name) ?? 0) + value;
    this.store.set(name, next);
    return { ok: true, value: next };
  }

  // ── set ─────────────────────────────────────────────────────────────────────

  /**
   * Sets the named metric to `value`, replacing any existing value.
   * Creates the metric when it does not yet exist.
   * Preserves the metric's insertion position when overwriting.
   * Returns the stored value on success.
   *
   * Returns INVALID_METRIC_NAME for empty or non-string names.
   * Returns INVALID_VALUE for NaN, ±Infinity, or non-numbers.
   */
  set(name: string, value: number): MetricsResult<number> {
    if (!isValidName(name)) {
      return metricsErr('INVALID_METRIC_NAME',
        `Metric name must be a non-empty string; received: ${String(name)}.`);
    }
    if (!isFiniteNumber(value)) {
      return metricsErr('INVALID_VALUE',
        `set() value must be a finite number; received: ${String(value)}.`);
    }

    this.store.set(name, value);
    return { ok: true, value };
  }

  // ── get ─────────────────────────────────────────────────────────────────────

  /**
   * Returns the current value of the named metric.
   * Returns 0 when the metric is absent or the name is invalid.
   * Never fails.
   */
  get(name: string): number {
    if (!isValidName(name)) return 0;
    return this.store.get(name) ?? 0;
  }

  // ── reset ────────────────────────────────────────────────────────────────────

  /**
   * Sets the named metric back to 0 without removing it from the store.
   * When the metric is absent the call is a silent no-op (no new entry is
   * created).  When the name is invalid the call is also a no-op.
   * Never fails.
   */
  reset(name: string): void {
    if (!isValidName(name)) return;
    if (!this.store.has(name)) return;
    this.store.set(name, 0);
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * Removes all metrics.  Never fails.
   */
  clear(): void {
    this.store.clear();
  }

  // ── listMetrics ──────────────────────────────────────────────────────────────

  /**
   * Returns all metrics in insertion order as an array of MetricEntry objects.
   * Each call produces a fresh array with fresh entry objects; callers
   * cannot mutate the store through the returned values.
   * Never fails; returns [] when the store is empty.
   */
  listMetrics(): MetricEntry[] {
    const result: MetricEntry[] = [];
    for (const [name, value] of this.store) {
      result.push({ name, value });
    }
    return result;
  }
}
