/**
 * Prisma master data repository — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database (Docker unavailable in this environment).
 *
 * One generic class backs all 10 entity types, exactly mirroring
 * MemoryMasterDataRepository<T>'s "one generic class, 10 typed instances" design —
 * each instance is bound to its Prisma model delegate by name (e.g. "mdDepartment").
 */

import type { MasterDataEntity, SearchQuery, PagedResult } from './masterdataTypes';
import type { IMasterDataRepository } from './masterdataRepository';
import { getPrismaClient } from '../persistence/prismaClient.ts';
import { mapPrismaRow } from '../persistence/decimalMapping.ts';

export class PrismaNotReadyError extends Error {
  constructor() {
    super('Prisma client not configured — set DATABASE_URL and run prisma migrate dev');
    this.name = 'PrismaNotReadyError';
  }
}

// ── Minimal structural shape of a Prisma model delegate ──────────────────────
// Every md* model shares this CRUD surface; row-specific extra fields pass through
// untyped (Prisma validates them against its own generated types at the call site).

interface MdDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>
  delete(args: { where: { id: string } }): Promise<unknown>
  findUnique(args: { where: { id: string } | { code: string } }): Promise<Record<string, unknown> | null>
  findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>
  findMany(args?: { where?: Record<string, unknown>; skip?: number; take?: number }): Promise<Record<string, unknown>[]>
  count(args?: { where?: Record<string, unknown> }): Promise<number>
}

const MODEL_KEYS = [
  'mdDepartment', 'mdEmployee', 'mdApprovalAuthority', 'mdVendor', 'mdFundSource',
  'mdBudgetYear', 'mdPackageType', 'mdProcurementMethod', 'mdProcurementCategory', 'mdDocumentTemplate',
] as const
export type MdModelKey = typeof MODEL_KEYS[number]

function delegate(modelKey: MdModelKey): MdDelegate {
  const prisma = getPrismaClient() as unknown as Record<MdModelKey, MdDelegate>
  return prisma[modelKey]
}

export class PrismaMasterDataRepository<T extends MasterDataEntity>
  implements IMasterDataRepository<T>
{
  constructor(private readonly modelKey: MdModelKey) {}

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const row = await delegate(this.modelKey).create({ data: entity as Record<string, unknown> })
    return mapPrismaRow(row) as unknown as T
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const row = await delegate(this.modelKey).update({ where: { id }, data: updates as Record<string, unknown> })
    return mapPrismaRow(row) as unknown as T
  }

  async delete(id: string): Promise<void> {
    await delegate(this.modelKey).delete({ where: { id } })
  }

  async archive(id: string): Promise<T> {
    return this.update(id, { isArchived: true, isActive: false } as Partial<Omit<T, 'id' | 'createdAt'>>)
  }

  async findById(id: string): Promise<T | null> {
    const row = await delegate(this.modelKey).findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as T) : null
  }

  async findByCode(code: string): Promise<T | null> {
    const row = await delegate(this.modelKey).findUnique({ where: { code } })
    return row ? (mapPrismaRow(row) as unknown as T) : null
  }

  async findActive(): Promise<readonly T[]> {
    const rows = await delegate(this.modelKey).findMany({ where: { isActive: true, isArchived: false } })
    return rows.map(r => mapPrismaRow(r) as unknown as T)
  }

  async search(query: SearchQuery): Promise<PagedResult<T>> {
    const where: Record<string, unknown> = {}
    if (query.isArchived !== undefined) where.isArchived = query.isArchived
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.term) {
      where.OR = [
        { name: { contains: query.term, mode: 'insensitive' } },
        { code: { contains: query.term, mode: 'insensitive' } },
      ]
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize

    const [rows, total] = await Promise.all([
      delegate(this.modelKey).findMany({ where, skip, take: pageSize }),
      delegate(this.modelKey).count({ where }),
    ])

    return { items: rows.map(r => mapPrismaRow(r) as unknown as T), total, page, pageSize }
  }

  async count(): Promise<number> {
    return delegate(this.modelKey).count()
  }
}
