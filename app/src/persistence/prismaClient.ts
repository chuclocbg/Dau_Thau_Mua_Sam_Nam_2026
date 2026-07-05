/**
 * Shared Prisma client singleton — the ONLY place `PrismaClient` is instantiated.
 * Every `prisma*Repositories.ts` file across every module imports `getPrismaClient()`
 * from here; application services never import Prisma directly (preserves the
 * repository abstraction — business code depends only on repository interfaces).
 *
 * Uses the Prisma 7 driver-adapter pattern (@prisma/adapter-pg + node-postgres) —
 * required because this schema's datasource block has no `url` (see prisma.config.ts).
 *
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never connected to a real
 * database in this environment (Docker unavailable). getPrismaClient() will throw
 * immediately if DATABASE_URL is unset, rather than silently falling back to memory.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'

export type { PrismaClient } from '../../generated/prisma/client.ts'

let singleton: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (singleton) return singleton

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and configure it ' +
      '(see docs/infrastructure.md) before using a Prisma-backed repository.',
    )
  }

  const adapter = new PrismaPg({ connectionString })
  singleton = new PrismaClient({ adapter })
  return singleton
}

/** Test/shutdown helper — disconnects and clears the singleton so a fresh client is created next call. */
export async function disconnectPrismaClient(): Promise<void> {
  if (singleton) {
    await singleton.$disconnect()
    singleton = null
  }
}
