import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'

// ── Test Database Bootstrap — Phase X.10 ───────────────────────────────────────
// Genuinely missing infrastructure, confirmed by inspection: zero results anywhere in the repo
// for a test-scoped database setup. Deliberately does NOT reuse `getPrismaClient()`
// (src/persistence/prismaClient.ts) -- that singleton is wired to `DATABASE_URL` (the dev/prod
// database) and sharing it would mean tests either pollute that database or silently no-op.
// A test database is a different logical connection, not a modification of the existing
// provider, so this mirrors prismaClient.ts's driver-adapter construction (same Prisma 7
// requirement) without touching or wrapping it.
//
// Docker/Postgres is confirmed unavailable in this environment (see docs/prisma-production.md,
// "What Still Needs Docker"), so callers must check `hasTestDatabase()` first and skip
// gracefully -- consistent with the honesty precedent set throughout Phase X.9.

export function hasTestDatabase(): boolean {
  return typeof process.env.TEST_DATABASE_URL === 'string' && process.env.TEST_DATABASE_URL.trim() !== ''
}

export function buildTestPrismaClient(): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Call hasTestDatabase() first and skip when it returns false.',
    )
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export async function closeTestDatabase(client: PrismaClient): Promise<void> {
  await client.$disconnect()
}
