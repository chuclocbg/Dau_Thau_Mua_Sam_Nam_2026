import type { ISessionRepository } from './memorySessionRepository.ts'
import type { AdvisoryConversationSession, AdvisorySessionState, AdvisoryConversationHistory } from '../domain/conversationTypes.ts'
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

// ── PrismaSessionRepository — Phase X.11 Conversation persistence ─────────────
// Same pattern as every other module's prisma*Repositories.ts file (e.g.
// src/procurement/package/prismaPackageRepositories.ts): reuses the singleton
// getPrismaClient() and mapPrismaRow() for Date -> ISO string conversion, implements the SAME
// ISessionRepository interface MemorySessionRepository already satisfies (Phase X.1, untouched).
// sessionState/history are stored as opaque JSON columns (see prisma/schema.prisma's
// ConversationSession model) since they are already plain, self-contained value objects with
// no independent query need of their own fields -- identical to how MemorySessionRepository
// stores them, just durable instead of in-process.

interface ConversationSessionRow {
  readonly id: string
  readonly sessionState: unknown
  readonly history: unknown
  readonly createdAt: string
  readonly updatedAt: string
}

function toDomain(row: ConversationSessionRow): AdvisoryConversationSession {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sessionState: row.sessionState as AdvisorySessionState,
    history: row.history as AdvisoryConversationHistory,
  }
}

export class PrismaSessionRepository implements ISessionRepository {
  async create(entity: Omit<AdvisoryConversationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdvisoryConversationSession> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationSession.create({ data: entity as never })
    return toDomain(mapPrismaRow(row) as unknown as ConversationSessionRow)
  }

  async update(
    id: string,
    updates: Partial<Omit<AdvisoryConversationSession, 'id' | 'createdAt'>>,
  ): Promise<AdvisoryConversationSession> {
    const prisma = getPrismaClient()
    const row = await prisma.conversationSession.update({ where: { id }, data: updates as never })
    return toDomain(mapPrismaRow(row) as unknown as ConversationSessionRow)
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().conversationSession.delete({ where: { id } })
  }

  async findById(id: string): Promise<AdvisoryConversationSession | null> {
    const row = await getPrismaClient().conversationSession.findUnique({ where: { id } })
    return row ? toDomain(mapPrismaRow(row) as unknown as ConversationSessionRow) : null
  }

  async findAll(): Promise<readonly AdvisoryConversationSession[]> {
    const rows = await getPrismaClient().conversationSession.findMany()
    return rows.map(r => toDomain(mapPrismaRow(r) as unknown as ConversationSessionRow))
  }

  async count(): Promise<number> {
    return getPrismaClient().conversationSession.count()
  }

  async findBySessionId(sessionId: string): Promise<AdvisoryConversationSession | null> {
    const rows = await getPrismaClient().conversationSession.findMany({
      where: { sessionState: { path: ['sessionId'], equals: sessionId } },
      take: 1,
    })
    return rows[0] ? toDomain(mapPrismaRow(rows[0]) as unknown as ConversationSessionRow) : null
  }
}

export function buildPrismaSessionRepository(): ISessionRepository {
  return new PrismaSessionRepository()
}
