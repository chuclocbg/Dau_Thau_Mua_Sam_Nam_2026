/**
 * P6-10J: Retry and provider-fallback policy.
 *
 * Transient errors (retry):    NETWORK_ERROR, RATE_LIMITED
 * Non-retryable (skip retry):  INVALID_CONFIG, UNAUTHORIZED, PARSE_ERROR
 * Other errors (skip retry):   API_ERROR, NO_PROVIDER, etc.
 *
 * After per-provider retries are exhausted, ProviderManager.chatWithFallback /
 * streamWithFallback automatically advances to the next provider in the chain.
 *
 * Never throws — all async logic is in ProviderManager; this module is pure.
 */

import type { ProviderId } from './ProviderRegistry';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Total attempts per provider (including first try).  Min 1, default 3. */
  maxAttempts?:  number;
  /** Base delay in ms for exponential backoff.  Set to 0 to disable delays. */
  retryDelayMs?: number;
  /** Add ±50% random jitter to each delay to prevent thundering herd. */
  jitter?:       boolean;
}

export interface FallbackOptions {
  /**
   * Explicit provider ordering for the fallback chain.
   * When omitted, the chain is [defaultProvider, ...rest] in registry list() order.
   */
  providerOrder?: ProviderId[];
}

// ─── RetryResult ──────────────────────────────────────────────────────────────

/** ProviderManagerResult<T> enriched with retry/fallback metadata. */
export type RetryResult<T> =
  | {
      ok:           true;
      value:        T;
      providerUsed: string;   // ProviderId of the provider that succeeded
      attempts:     number;   // total attempts across all providers
      fallbackCount: number;  // number of provider switches
    }
  | {
      ok:           false;
      error:        { code: string; message: string; cause?: unknown };
      providerUsed: string;   // ProviderId of the last-tried provider (or '' if none)
      attempts:     number;
      fallbackCount: number;
    };

// ─── RetryPolicy ──────────────────────────────────────────────────────────────

export class RetryPolicy {
  /** Total attempts per provider (1 means no retries). */
  readonly maxAttempts:  number;
  /** Base delay in ms. */
  readonly retryDelayMs: number;
  /** Whether to add random jitter to delays. */
  readonly useJitter:    boolean;

  constructor(options?: RetryOptions) {
    this.maxAttempts  = Math.max(1, options?.maxAttempts  ?? 3);
    this.retryDelayMs = options?.retryDelayMs             ?? 100;
    this.useJitter    = options?.jitter                   ?? true;
  }

  /** Returns true for error codes that warrant a retry (transient failures). */
  isTransient(code: string): boolean {
    return code === 'NETWORK_ERROR' || code === 'RATE_LIMITED';
  }

  /**
   * Returns true for error codes that must NOT be retried on the same provider.
   * The provider is still skipped in favour of the next fallback candidate.
   */
  isNonRetryable(code: string): boolean {
    return (
      code === 'INVALID_CONFIG' ||
      code === 'UNAUTHORIZED'   ||
      code === 'PARSE_ERROR'
    );
  }

  /**
   * Waits for the exponential-backoff delay for the given attempt index (0-based).
   * Resolves immediately when retryDelayMs is 0 (useful in tests).
   */
  async sleep(attempt: number): Promise<void> {
    if (this.retryDelayMs === 0) return;
    const base  = this.retryDelayMs * (2 ** attempt);
    const delay = this.useJitter
      ? base * (0.5 + Math.random() * 0.5)
      : base;
    await new Promise<void>(resolve => setTimeout(resolve, Math.round(delay)));
  }
}
