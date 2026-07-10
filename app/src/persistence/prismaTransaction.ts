import { getPrismaClient } from './prismaClient.ts'
import { Prisma } from '../../generated/prisma/client.ts'

// ── Prisma Transaction Helper — Phase X.10 ─────────────────────────────────────
// Genuinely missing infrastructure, confirmed by inspection: docs/prisma-production.md's own
// "Transactions" section documents exactly one inline `prisma.$transaction(...)` call
// (`PrismaArticleRepository.importFromParsed()`, src/legal/prismaRepositories.ts — untouched,
// frozen, not modified here) and explicitly states no reusable wrapper exists ("not yet used
// elsewhere"). This file adds that reusable wrapper WITHOUT touching the existing inline usage —
// a thin pass-through to Prisma's own `$transaction`, reusing the existing `getPrismaClient()`
// singleton (never a new client), never reimplementing transactional semantics of any kind.
// Future repository methods that need multi-statement atomicity can adopt this instead of each
// hand-rolling their own `$transaction` call.

export type PrismaTransactionClient = Prisma.TransactionClient

export interface TransactionOptions {
  readonly maxWait?: number
  readonly timeout?: number
  readonly isolationLevel?: Prisma.TransactionIsolationLevel
}

export async function withTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return getPrismaClient().$transaction(fn, options)
}
