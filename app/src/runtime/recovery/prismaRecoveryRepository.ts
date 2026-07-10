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
}

function toDomain(row: RecoveryMarkerRow): RecoveryMarker {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
  async create(entity: Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecoveryMarker> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationRecoveryMarker.create({ data: entity as never })
    return toDomain(mapPrismaRow(row) as unknown as RecoveryMarkerRow)
  }

  async update(id: string, updates: Partial<Omit<RecoveryMarker, 'id' | 'createdAt'>>): Promise<RecoveryMarker> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationRecoveryMarker.update({ where: { id }, data: updates as never })
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
}

export function buildPrismaRecoveryRepository(): IRecoveryRepository {
  return new PrismaRecoveryRepository()
}
