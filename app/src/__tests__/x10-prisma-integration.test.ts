/**
 * Phase X.10 — migration + integration tests.
 *
 * Migration test: runs `prisma validate` for real (schema-consistency check, no live database
 * needed), mirroring the project's established "run the real tool, don't fabricate a pass"
 * discipline.
 *
 * Integration tests: exercise verifyDatabaseConnection()/waitForDatabaseReady()/withTransaction()
 * against a REAL Postgres instance via TEST_DATABASE_URL. Docker/Postgres is confirmed
 * unavailable in this development environment (see docs/prisma-production.md, "What Still Needs
 * Docker"), so this suite skips with a clear message rather than fabricating a pass or hard
 * failing — the same honesty precedent set throughout Phase X.9 (e.g. smoke-checks-integration.test.ts).
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { hasTestDatabase, buildTestPrismaClient, closeTestDatabase } from '../persistence/testDatabaseBootstrap.ts'
import { verifyDatabaseConnection, waitForDatabaseReady } from '../persistence/databaseConnectivity.ts'
import { withTransaction } from '../persistence/prismaTransaction.ts'

describe('Migration test — prisma schema validity', () => {
  it('`prisma validate` accepts prisma/schema.prisma with no errors', () => {
    expect(() =>
      execSync('npx prisma validate', { cwd: process.cwd(), stdio: 'pipe' }),
    ).not.toThrow()
  })
})

describe.skipIf(!hasTestDatabase())('Integration — real TEST_DATABASE_URL', () => {
  it('verifyDatabaseConnection() reports connected: true against a real database', async () => {
    const client = buildTestPrismaClient()
    try {
      const result = await verifyDatabaseConnection(client)
      expect(result.connected).toBe(true)
    } finally {
      await closeTestDatabase(client)
    }
  })

  it('waitForDatabaseReady() succeeds on the first attempt against a live database', async () => {
    const client = buildTestPrismaClient()
    try {
      const result = await waitForDatabaseReady(client)
      expect(result.ready).toBe(true)
      expect(result.attempts).toBe(1)
    } finally {
      await closeTestDatabase(client)
    }
  })

  it('withTransaction() commits a trivial read-only transaction', async () => {
    const result = await withTransaction(async (tx) => tx.$queryRaw`SELECT 1 AS ok`)
    expect(result).toBeTruthy()
  })
})

if (!hasTestDatabase()) {
  describe('Integration — TEST_DATABASE_URL not configured', () => {
    it('is documented as skipped, not silently missing', () => {
      expect(hasTestDatabase()).toBe(false)
    })
  })
}
