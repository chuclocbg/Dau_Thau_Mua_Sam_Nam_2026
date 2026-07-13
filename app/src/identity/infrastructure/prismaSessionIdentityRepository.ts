import type { ISessionIdentityRepository, SessionIdentityBinding } from './sessionIdentityRepository.ts'
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

// ── PrismaSessionIdentityRepository — Phase X.14 ───────────────────────────────
// Same pattern as every other module's prisma*Repositories.ts file (e.g.
// src/runtime/recovery/prismaRecoveryRepository.ts): reuses the singleton getPrismaClient()
// and mapPrismaRow(), implements the SAME ISessionIdentityRepository interface
// MemorySessionIdentityRepository already satisfies.

interface SessionIdentityBindingRow {
  readonly id: string
  readonly sessionId: string
  readonly principalId: string
  readonly principalKind: string
  readonly createdAt: string
  readonly updatedAt: string
}

function toDomain(row: SessionIdentityBindingRow): SessionIdentityBinding {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sessionId: row.sessionId,
    principalId: row.principalId,
    principalKind: row.principalKind as SessionIdentityBinding['principalKind'],
  }
}

export class PrismaSessionIdentityRepository implements ISessionIdentityRepository {
  async create(entity: Omit<SessionIdentityBinding, 'id' | 'createdAt' | 'updatedAt'>): Promise<SessionIdentityBinding> {
    const prisma = getPrismaClient()
    const row = await prisma.sessionIdentityBinding.create({ data: entity as never })
    return toDomain(mapPrismaRow(row) as unknown as SessionIdentityBindingRow)
  }

  async update(id: string, updates: Partial<Omit<SessionIdentityBinding, 'id' | 'createdAt'>>): Promise<SessionIdentityBinding> {
    const prisma = getPrismaClient()
    const row = await prisma.sessionIdentityBinding.update({ where: { id }, data: updates as never })
    return toDomain(mapPrismaRow(row) as unknown as SessionIdentityBindingRow)
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().sessionIdentityBinding.delete({ where: { id } })
  }

  async findById(id: string): Promise<SessionIdentityBinding | null> {
    const row = await getPrismaClient().sessionIdentityBinding.findUnique({ where: { id } })
    return row ? toDomain(mapPrismaRow(row) as unknown as SessionIdentityBindingRow) : null
  }

  async findAll(): Promise<readonly SessionIdentityBinding[]> {
    const rows = await getPrismaClient().sessionIdentityBinding.findMany()
    return rows.map(r => toDomain(mapPrismaRow(r) as unknown as SessionIdentityBindingRow))
  }

  async count(): Promise<number> {
    return getPrismaClient().sessionIdentityBinding.count()
  }

  async findBySessionId(sessionId: string): Promise<SessionIdentityBinding | null> {
    const row = await getPrismaClient().sessionIdentityBinding.findFirst({ where: { sessionId } })
    return row ? toDomain(mapPrismaRow(row) as unknown as SessionIdentityBindingRow) : null
  }
}

export function buildPrismaSessionIdentityRepository(): ISessionIdentityRepository {
  return new PrismaSessionIdentityRepository()
}
