/**
 * P6-12B: RateLimiter — sliding-window rate limiter for async functions.
 *
 * Wraps any zero-argument function (sync or async) and enforces configurable
 * request-per-second (rps) and/or request-per-minute (rpm) limits using the
 * sliding-window log algorithm.  Each window tracks the exact timestamps of
 * recent calls; when the count within the window reaches the limit the call is
 * rejected immediately without invoking fn.
 *
 * Public API:
 *   execute(fn)   — call fn if within limits; return typed result
 *   remaining()   — slots available right now (min across all windows)
 *   reset()       — clear all window timestamps
 *
 * Constructor options (RateLimiterOptions):
 *   rps   — max requests per second  (window: 1 000 ms)
 *   rpm   — max requests per minute  (window: 60 000 ms)
 *
 * Both rps and rpm may be set simultaneously; every call must satisfy ALL
 * active windows.  Default when no valid option is supplied: 60 rpm.
 *
 * Error codes:
 *   RATE_LIMIT_EXCEEDED — window is full; error includes retryAfter (ms)
 *   INVALID_FUNCTION    — fn is not callable
 *   RATE_LIMITER_ERROR  — fn threw or an unexpected failure occurred
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - execute() returns Promise<RateLimiterResult<T>>.
 *   - remaining() and reset() are synchronous; never fail.
 *   - Timestamps are recorded BEFORE fn() runs so even a failing fn()
 *     consumes a rate-limit slot (prevents hot-retry abuse).
 *   - The successful return value of fn() is shallow-cloned.
 *   - SSR-compatible: only Date.now() is used; no browser-exclusive globals.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type RateLimiterErrorCode =
  | 'RATE_LIMIT_EXCEEDED'  // window full
  | 'INVALID_FUNCTION'     // fn is not callable
  | 'RATE_LIMITER_ERROR';  // fn threw / catch-all

export interface RateLimiterError {
  code:         RateLimiterErrorCode;
  message:      string;
  /** Milliseconds until the oldest in-window timestamp expires and a slot opens. */
  retryAfter?:  number;
}

export type RateLimiterResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: RateLimiterError };

// ─── Options ─────────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Maximum requests per second (window: 1 000 ms).  Must be a positive integer. */
  rps?: number;
  /** Maximum requests per minute (window: 60 000 ms).  Must be a positive integer. */
  rpm?: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Internal sliding-window state. */
interface RateWindow {
  readonly limit:     number;
  readonly windowMs:  number;
  timestamps:         number[];  // sorted ascending; mutated in-place
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, and undefined
 * as-is.  Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value;
}

function isPositiveFiniteInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

// ─── RateLimiter ──────────────────────────────────────────────────────────────

export class RateLimiter {
  private readonly windows: RateWindow[];

  constructor(options: RateLimiterOptions = {}) {
    const wins: RateWindow[] = [];

    if (isPositiveFiniteInt(options.rps)) {
      wins.push({ limit: Math.floor(options.rps), windowMs: 1_000, timestamps: [] });
    }
    if (isPositiveFiniteInt(options.rpm)) {
      wins.push({ limit: Math.floor(options.rpm), windowMs: 60_000, timestamps: [] });
    }
    // Default when no valid window is configured.
    if (wins.length === 0) {
      wins.push({ limit: 60, windowMs: 60_000, timestamps: [] });
    }

    this.windows = wins;
  }

  // ── execute ──────────────────────────────────────────────────────────────────

  /**
   * Calls `fn()` if all rate-limit windows have capacity; rejects with
   * RATE_LIMIT_EXCEEDED if any window is full.
   *
   * Timestamp is recorded in every window BEFORE fn() runs, so even a
   * failing fn() consumes one slot — this prevents runaway hot-retries.
   *
   * Returns the shallow-cloned return value on success.
   * Never throws.
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<RateLimiterResult<T>> {
    if (typeof fn !== 'function') {
      return {
        ok: false,
        error: {
          code: 'INVALID_FUNCTION',
          message: `execute() requires a callable function; received: ${typeof fn}.`,
        },
      };
    }

    const now = Date.now();

    // Check every window; prune stale entries while we're there.
    for (const w of this.windows) {
      const cutoff = now - w.windowMs;
      // Purge entries older than the window (keeps the array lean).
      w.timestamps = w.timestamps.filter(t => t > cutoff);

      if (w.timestamps.length >= w.limit) {
        // The oldest entry still in the window determines the retry delay.
        const retryAfter = Math.max(0, w.timestamps[0] + w.windowMs - now);
        return {
          ok: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              `Rate limit exceeded: ${w.timestamps.length}/${w.limit} ` +
              `requests in the last ${w.windowMs}ms.`,
            retryAfter,
          },
        };
      }
    }

    // All windows have capacity — record this call before invoking fn.
    for (const w of this.windows) {
      w.timestamps.push(now);
    }

    try {
      const result = await fn();
      return { ok: true, value: cloneValue(result) };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'RATE_LIMITER_ERROR',
          message: `Function threw an error: ${String(err)}.`,
        },
      };
    }
  }

  // ── remaining ────────────────────────────────────────────────────────────────

  /**
   * Returns how many more requests can be made right now.
   *
   * When multiple windows are active, the most restrictive (lowest) value is
   * returned.  This method is read-only — it does not prune the timestamps.
   * Never fails; returns 0 if the limiter has no windows.
   */
  remaining(): number {
    if (this.windows.length === 0) return 0;

    const now = Date.now();
    let min = Infinity;

    for (const w of this.windows) {
      const cutoff = now - w.windowMs;
      const active = w.timestamps.filter(t => t > cutoff).length;
      min = Math.min(min, w.limit - active);
    }

    return Math.max(0, min);
  }

  // ── reset ────────────────────────────────────────────────────────────────────

  /**
   * Clears all sliding-window timestamps, immediately restoring full capacity.
   * Does not change the configured limits or window sizes.
   * Never fails.
   */
  reset(): void {
    for (const w of this.windows) {
      w.timestamps.length = 0;
    }
  }
}
