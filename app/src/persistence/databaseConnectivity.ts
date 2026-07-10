import { getPrismaClient } from './prismaClient.ts'
import type { PrismaClient } from './prismaClient.ts'
import { RetryPolicy } from '../providers/RetryPolicy.ts'
import type { RetryOptions } from '../providers/RetryPolicy.ts'

// ── Database Bootstrap — Phase X.10 ────────────────────────────────────────────
// Genuinely missing infrastructure, confirmed by inspection: no standalone "is the database
// reachable" check exists anywhere in the repo (distinct from schema migration). Reuses the
// existing `getPrismaClient()` singleton and the existing `RetryPolicy` (already proven for
// exactly this "wait for an external dependency to become ready" role in
// src/startup/waitForReady.ts, X.9.5) rather than inventing a new backoff mechanism.

export interface DatabaseConnectivityResult {
  readonly connected: boolean
  readonly error?: string
}

export async function verifyDatabaseConnection(
  client?: PrismaClient,
): Promise<DatabaseConnectivityResult> {
  try {
    const resolved = client ?? getPrismaClient()
    await resolved.$queryRaw`SELECT 1`
    return { connected: true }
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export interface WaitForDatabaseReadyResult {
  readonly ready: boolean
  readonly attempts: number
  readonly lastError?: string
}

export async function waitForDatabaseReady(
  client?: PrismaClient,
  retryOptions?: RetryOptions,
): Promise<WaitForDatabaseReadyResult> {
  const policy = new RetryPolicy(retryOptions)
  let lastError: string | undefined
  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    const result = await verifyDatabaseConnection(client)
    if (result.connected) return { ready: true, attempts: attempt + 1 }
    lastError = result.error
    if (attempt < policy.maxAttempts - 1) await policy.sleep(attempt)
  }
  return { ready: false, attempts: policy.maxAttempts, ...(lastError !== undefined ? { lastError } : {}) }
}
