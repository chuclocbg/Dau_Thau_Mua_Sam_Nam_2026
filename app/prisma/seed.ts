// ── Prisma Seed Entrypoint — Phase X.10 ────────────────────────────────────────
// Infrastructure only. Seeds NOTHING: per CLAUDE.md's Demo Data Principles ("never invent real
// people/departments/organizations... use placeholders"), and Phase X.10's own explicit scope
// ("no business logic yet, no procurement domain yet, no legal domain yet"), no rows are
// fabricated here. This just proves the seed pipeline is wired and the database is reachable.
// Registered via prisma.config.ts's `migrations.seed`, so `npx prisma db seed` resolves here.
import { getPrismaClient, disconnectPrismaClient } from '../src/persistence/prismaClient.ts'
import { verifyDatabaseConnection } from '../src/persistence/databaseConnectivity.ts'

async function main(): Promise<void> {
  const client = getPrismaClient()
  const connectivity = await verifyDatabaseConnection(client)
  if (!connectivity.connected) {
    throw new Error(`Cannot seed: database is not reachable (${connectivity.error ?? 'unknown error'}).`)
  }
  console.log('[seed] Database connection verified. No seed data defined yet -- Phase X.10 is infrastructure-only.')
}

main()
  .then(() => disconnectPrismaClient())
  .catch(async (err) => {
    console.error('[seed] failed:', err)
    await disconnectPrismaClient()
    process.exitCode = 1
  })
