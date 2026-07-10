/**
 * Phase X.10 (Business Foundation — Prisma & Persistence) — unit tests
 *
 * Per the milestone's own scope: the pre-existing Phase M1 Prisma layer (schema, client
 * provider, repository interfaces/implementations, migrations) is the canonical foundation and
 * is NOT re-tested here (already covered by its own test suite, e.g. legal-repo-*.test.ts).
 * These tests cover only the four genuinely-missing pieces this milestone adds:
 *   1. withTransaction()          — src/persistence/prismaTransaction.ts
 *   2. verifyDatabaseConnection() / waitForDatabaseReady() — src/persistence/databaseConnectivity.ts
 *   3. hasTestDatabase() / buildTestPrismaClient() / closeTestDatabase() — src/persistence/testDatabaseBootstrap.ts
 *
 * DATABASE_URL is not configured in this environment (Docker unavailable — see
 * docs/infrastructure.md), matching the established repo-wide test convention (see
 * legal-repo-document.test.ts's LRD-12): real calls surface getPrismaClient()'s own
 * "DATABASE_URL is not set" guard error rather than being mocked away.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { withTransaction } from '../persistence/prismaTransaction.ts'
import { verifyDatabaseConnection, waitForDatabaseReady } from '../persistence/databaseConnectivity.ts'
import { hasTestDatabase, buildTestPrismaClient } from '../persistence/testDatabaseBootstrap.ts'

describe('withTransaction', () => {
  it('surfaces the real DATABASE_URL configuration error rather than swallowing it', async () => {
    await expect(withTransaction(async (tx) => tx)).rejects.toThrow(/DATABASE_URL/)
  })
})

describe('verifyDatabaseConnection', () => {
  it('returns a { connected: false, error } result instead of throwing when DATABASE_URL is unset', async () => {
    const result = await verifyDatabaseConnection()
    expect(result.connected).toBe(false)
    expect(result.error).toMatch(/DATABASE_URL/)
  })
})

describe('waitForDatabaseReady', () => {
  it('reports not-ready after exhausting retries, with zero delay for fast tests', async () => {
    const result = await waitForDatabaseReady(undefined, { maxAttempts: 2, retryDelayMs: 0 })
    expect(result.ready).toBe(false)
    expect(result.attempts).toBe(2)
    expect(result.lastError).toMatch(/DATABASE_URL/)
  })

  it('makes exactly maxAttempts connectivity attempts, not fewer or more', async () => {
    let calls = 0
    const originalFetch = undefined
    void originalFetch
    const client = { $queryRaw: async () => { calls++; throw new Error('down') } } as never
    const result = await waitForDatabaseReady(client, { maxAttempts: 3, retryDelayMs: 0 })
    expect(calls).toBe(3)
    expect(result.attempts).toBe(3)
  })
})

describe('Test database bootstrap', () => {
  afterEach(() => {
    delete process.env.TEST_DATABASE_URL
  })

  it('hasTestDatabase() is false when TEST_DATABASE_URL is unset', () => {
    expect(hasTestDatabase()).toBe(false)
  })

  it('hasTestDatabase() is false for a blank string', () => {
    process.env.TEST_DATABASE_URL = '   '
    expect(hasTestDatabase()).toBe(false)
  })

  it('hasTestDatabase() is true once TEST_DATABASE_URL is set', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    expect(hasTestDatabase()).toBe(true)
  })

  it('buildTestPrismaClient() throws a clear error when TEST_DATABASE_URL is unset', () => {
    expect(() => buildTestPrismaClient()).toThrow(/TEST_DATABASE_URL is not set/)
  })

  it('buildTestPrismaClient() constructs a client (lazy connection) once TEST_DATABASE_URL is set', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    expect(() => buildTestPrismaClient()).not.toThrow()
  })
})
