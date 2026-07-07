import { RetryPolicy } from '../providers/RetryPolicy.ts'
import type { RetryOptions } from '../providers/RetryPolicy.ts'

// ── Startup Verification — Phase X.9.5 ─────────────────────────────────────────
// Polls a URL (typically the real, deployed /ready endpoint — X.9.1, frozen, never
// reimplemented here) until it responds 2xx or the retry budget is exhausted. Genuinely reuses
// the existing, unmodified RetryPolicy (src/providers/) for backoff timing — no second retry
// loop invented. Used after `docker compose up`/a process restart to confirm the server actually
// came up before running smoke tests against it.

export interface WaitForReadyOptions {
  readonly retry?: RetryOptions
  readonly fetchFn?: typeof fetch
}

export interface WaitForReadyResult {
  readonly ready: boolean
  readonly attempts: number
  readonly lastStatus?: number
  readonly lastError?: string
}

export async function waitForReady(url: string, options: WaitForReadyOptions = {}): Promise<WaitForReadyResult> {
  const policy = new RetryPolicy(options.retry)
  const doFetch = options.fetchFn ?? fetch
  let lastStatus: number | undefined
  let lastError: string | undefined

  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    try {
      const res = await doFetch(url)
      lastStatus = res.status
      if (res.ok) return { ready: true, attempts: attempt + 1, lastStatus }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    if (attempt < policy.maxAttempts - 1) await policy.sleep(attempt)
  }

  return {
    ready: false,
    attempts: policy.maxAttempts,
    ...(lastStatus !== undefined ? { lastStatus } : {}),
    ...(lastError !== undefined ? { lastError } : {}),
  }
}
