import type { RetryPolicy } from '../types/notificationTypes.ts'

// ── Retry / backoff calculation — pure functions ──────────────────────────────

/** True if another attempt is still allowed under the policy. */
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt < policy.maxAttempts
}

/** Exponential backoff delay for the given attempt number (1-based), capped at maxDelayMs. */
export function computeNextRetryDelay(attempt: number, policy: RetryPolicy): number {
  const raw = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, Math.max(0, attempt - 1))
  return Math.min(raw, policy.maxDelayMs)
}

/** ISO timestamp of the next retry, given the current time and attempt number. */
export function computeNextRetryAt(now: string, attempt: number, policy: RetryPolicy): string {
  const delayMs = computeNextRetryDelay(attempt, policy)
  return new Date(new Date(now).getTime() + delayMs).toISOString()
}
