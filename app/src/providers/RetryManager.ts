/**
 * P6-11I: RetryManager — general-purpose async function-retry utility.
 *
 * Wraps any zero-argument function (sync or async) in a configurable
 * retry loop.  On every failure the error is recorded, a back-off delay
 * is applied (optional), and the function is called again until either
 * it succeeds or the retry budget is exhausted.
 *
 * Public API:
 *   execute(fn)   — run fn, retrying on failure up to maxRetries times
 *   retryCount()  — total retry attempts made across all execute() calls
 *   clear()       — reset the cumulative retry counter
 *
 * Constructor options (RetryManagerOptions):
 *   maxRetries  — number of extra attempts after the first (default: 3)
 *   delayMs     — wait between retries in milliseconds (default: 0)
 *   backoff     — double the delay each retry (default: false)
 *
 * Error codes:
 *   INVALID_FUNCTION    — execute() received a non-function argument
 *   ALL_RETRIES_FAILED  — fn threw on every attempt
 *   RETRY_MANAGER_ERROR — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - execute() returns a Promise<RetryManagerResult<T>>.
 *   - retryCount() and clear() are synchronous; never fail.
 *   - Retries stop immediately on the first success.
 *   - ALL_RETRIES_FAILED error carries an attempts[] defensive copy so
 *     the caller can inspect every individual failure.
 *   - The return value from a successful execute() is shallow-cloned
 *     (consistent with the rest of the provider layer).
 *   - SSR-compatible: setTimeout is available in all JS runtimes.
 *   - No browser-exclusive APIs (window, document, localStorage, etc.).
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type RetryManagerErrorCode =
  | 'INVALID_FUNCTION'    // fn argument is not callable
  | 'ALL_RETRIES_FAILED'  // fn threw on every attempt
  | 'RETRY_MANAGER_ERROR'; // catch-all for unexpected failures

/** Per-attempt record included in ALL_RETRIES_FAILED errors. */
export interface RetryAttempt {
  /** 0-based attempt index (0 = initial call, 1 = first retry, …). */
  readonly attempt: number;
  /** The value thrown by fn() on this attempt. */
  readonly error: unknown;
}

export interface RetryManagerError {
  code:       RetryManagerErrorCode;
  message:    string;
  /** Present only when code === 'ALL_RETRIES_FAILED'. */
  attempts?:  RetryAttempt[];
}

export type RetryManagerResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: RetryManagerError };

// ─── Options ─────────────────────────────────────────────────────────────────

export interface RetryManagerOptions {
  /** Extra attempts after the first.  0 means try once only.  Default: 3. */
  maxRetries?: number;
  /** Milliseconds to wait between attempts.  Default: 0 (no delay). */
  delayMs?: number;
  /** Double the delay on each successive retry.  Default: false. */
  backoff?: boolean;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Shallow-clones objects and arrays; returns primitives, null, and undefined
 * as-is.  Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

// ─── RetryManager ─────────────────────────────────────────────────────────────

export class RetryManager {
  private readonly maxRetries: number;
  private readonly delayMs: number;
  private readonly backoff: boolean;
  /** Cumulative count of retry attempts (not total calls). */
  private totalRetries: number = 0;

  constructor(options: RetryManagerOptions = {}) {
    const { maxRetries = 3, delayMs = 0, backoff = false } = options;

    this.maxRetries = (typeof maxRetries === 'number'
      && Number.isFinite(maxRetries)
      && maxRetries >= 0)
        ? Math.floor(maxRetries)
        : 3;

    this.delayMs = (typeof delayMs === 'number'
      && Number.isFinite(delayMs)
      && delayMs >= 0)
        ? delayMs
        : 0;

    this.backoff = typeof backoff === 'boolean' ? backoff : false;
  }

  // ── execute ──────────────────────────────────────────────────────────────────

  /**
   * Calls `fn()` and, on failure, retries up to `maxRetries` additional times.
   *
   * - Returns { ok: true, value } on the first successful call.
   * - Returns { ok: false, error: ALL_RETRIES_FAILED } if every attempt fails;
   *   the error's `attempts` array contains each individual failure record.
   * - Returns { ok: false, error: INVALID_FUNCTION } if fn is not a function.
   *
   * Delays are applied between attempts (never before the first call):
   *   no backoff: delayMs each time
   *   backoff:    delayMs * 2^(retryNumber - 1)  (doubles each retry)
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<RetryManagerResult<T>> {
    if (typeof fn !== 'function') {
      return {
        ok: false,
        error: {
          code: 'INVALID_FUNCTION',
          message: `execute() requires a callable function; received: ${typeof fn}.`,
        },
      };
    }

    const log: RetryAttempt[] = [];
    let attempt = 0;

    for (;;) {
      try {
        const result = await fn();
        return { ok: true, value: cloneValue(result) };
      } catch (err) {
        log.push({ attempt, error: err });

        if (attempt >= this.maxRetries) {
          // Budget exhausted — return all attempt records as a defensive copy.
          return {
            ok: false,
            error: {
              code: 'ALL_RETRIES_FAILED',
              message: `Function failed after ${attempt + 1} attempt(s) (${attempt} ${attempt === 1 ? 'retry' : 'retries'}).`,
              attempts: log.map(a => ({ attempt: a.attempt, error: a.error })),
            },
          };
        }

        // A retry will be made — record it in the cumulative counter.
        this.totalRetries += 1;
        attempt += 1;

        // Compute inter-retry delay.
        // For backoff: retry #n waits delayMs * 2^(n-1); attempt is 1-indexed here.
        if (this.delayMs > 0) {
          const delay = this.backoff
            ? this.delayMs * (2 ** (attempt - 1))
            : this.delayMs;
          await sleep(delay);
        }
      }
    }
  }

  // ── retryCount ───────────────────────────────────────────────────────────────

  /**
   * Returns the cumulative number of retry attempts made since the last
   * clear() (or since construction).
   *
   * A successful first-try does not increment this counter.
   * Never fails.
   */
  retryCount(): number {
    return this.totalRetries;
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * Resets the cumulative retry counter to zero.
   * Does not affect options (maxRetries, delayMs, backoff).
   * Never fails.
   */
  clear(): void {
    this.totalRetries = 0;
  }
}
