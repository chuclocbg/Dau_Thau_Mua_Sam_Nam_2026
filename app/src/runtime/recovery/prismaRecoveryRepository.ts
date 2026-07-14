import type { IRecoveryRepository, RecoveryMarker } from './recoveryTypes.ts'
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

// ── PrismaRecoveryRepository — Phase X.13 ──────────────────────────────────────
// Same pattern as every other module's prisma*Repositories.ts file (e.g.
// src/conversation/infrastructure/prismaSessionRepository.ts): reuses the singleton
// getPrismaClient() and mapPrismaRow() for Date -> ISO string conversion, implements the SAME
// IRecoveryRepository interface MemoryRecoveryRepository already satisfies.

interface RecoveryMarkerRow {
  readonly id: string
  readonly sessionId: string | null
  readonly question: string
  readonly asOfDate: string | null
  readonly status: string
  readonly startedAt: string
  readonly completedAt: string | null
  readonly error: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly version: number
}

function toDomain(row: RecoveryMarkerRow): RecoveryMarker {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    ...(row.sessionId !== null ? { sessionId: row.sessionId } : {}),
    question: row.question,
    ...(row.asOfDate !== null ? { asOfDate: row.asOfDate } : {}),
    status: row.status as RecoveryMarker['status'],
    startedAt: row.startedAt,
    ...(row.completedAt !== null ? { completedAt: row.completedAt } : {}),
    ...(row.error !== null ? { error: row.error } : {}),
  }
}

export class PrismaRecoveryRepository implements IRecoveryRepository {
  async create(entity: Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<RecoveryMarker> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationRecoveryMarker.create({ data: entity as never })
    return toDomain(mapPrismaRow(row) as unknown as RecoveryMarkerRow)
  }

  async update(id: string, updates: Partial<Omit<RecoveryMarker, 'id' | 'createdAt' | 'version'>>): Promise<RecoveryMarker> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationRecoveryMarker.update({
      where: { id },
      data: { ...updates, version: { increment: 1 } } as never,
    })
    return toDomain(mapPrismaRow(row) as unknown as RecoveryMarkerRow)
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().conversationRecoveryMarker.delete({ where: { id } })
  }

  async findById(id: string): Promise<RecoveryMarker | null> {
    const row = await getPrismaClient().conversationRecoveryMarker.findUnique({ where: { id } })
    return row ? toDomain(mapPrismaRow(row) as unknown as RecoveryMarkerRow) : null
  }

  async findAll(): Promise<readonly RecoveryMarker[]> {
    const rows = await getPrismaClient().conversationRecoveryMarker.findMany()
    return rows.map(r => toDomain(mapPrismaRow(r) as unknown as RecoveryMarkerRow))
  }

  async count(): Promise<number> {
    return getPrismaClient().conversationRecoveryMarker.count()
  }

  async findPending(): Promise<readonly RecoveryMarker[]> {
    const rows = await getPrismaClient().conversationRecoveryMarker.findMany({
      where: { status: 'PENDING' },
      orderBy: { startedAt: 'asc' },
    })
    return rows.map(r => toDomain(mapPrismaRow(r) as unknown as RecoveryMarkerRow))
  }

  async findBySessionId(sessionId: string): Promise<readonly RecoveryMarker[]> {
    const rows = await getPrismaClient().conversationRecoveryMarker.findMany({ where: { sessionId } })
    return rows.map(r => toDomain(mapPrismaRow(r) as unknown as RecoveryMarkerRow))
  }

  // Phase X.19 -- optimistic locking via the `version` column (see X19_ARCHITECTURE_DECISION.md;
  // an earlier `updatedAt`-based design was rejected because millisecond-resolution timestamps can
  // collide between near-simultaneous writes). updateMany's `where` clause makes the whole
  // check-and-write atomic at the database level: a row matches only if it is still PENDING and
  // its version still equals expectedVersion; `count === 0` means another writer already claimed
  // or resolved it -- a lost race, not an error. `version` does not auto-increment like
  // `@updatedAt`, so the increment must be requested explicitly here.
  async resolveIfPending(
    id: string,
    expectedVersion: number,
    updates: Partial<Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
  ): Promise<RecoveryMarker | null> {
    const prisma = getPrismaClient()
    const result = await prisma.conversationRecoveryMarker.updateMany({
      where: { id, status: 'PENDING', version: expectedVersion },
      data: { ...updates, version: { increment: 1 } } as never,
    })
    if (result.count === 0) return null
    const row = await prisma.conversationRecoveryMarker.findUnique({ where: { id } })
    return row ? toDomain(mapPrismaRow(row) as unknown as RecoveryMarkerRow) : null
  }
}

export function buildPrismaRecoveryRepository(): IRecoveryRepository {
  return new PrismaRecoveryRepository()
}
