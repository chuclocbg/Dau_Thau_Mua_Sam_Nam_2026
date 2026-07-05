/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type {
  ProcurementPackage, PackageItem, PackageBudget, PackageAttachment, PackageHistory,
  PackageStatus, PackageSearchQuery, PackageSearchResult,
} from './packageTypes';
import type {
  IProcurementPackageRepository, IPackageItemRepository, IBudgetRepository,
  IAttachmentRepository, IHistoryRepository, PackageRepositories,
} from './packageRepository';
import { getPrismaClient } from '../../persistence/prismaClient.ts';
import { mapPrismaRow } from '../../persistence/decimalMapping.ts';

// ─── ProcurementPackage ───────────────────────────────────────────────────────

export class PrismaProcurementPackageRepository implements IProcurementPackageRepository {
  async create(entity: Omit<ProcurementPackage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementPackage> {
    const prisma = getPrismaClient();
    const row = await prisma.procurementPackage.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ProcurementPackage;
  }

  async update(id: string, updates: Partial<Omit<ProcurementPackage, 'id' | 'createdAt'>>): Promise<ProcurementPackage> {
    const prisma = getPrismaClient();
    const row = await prisma.procurementPackage.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ProcurementPackage;
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.procurementPackage.delete({ where: { id } });
  }

  async findById(id: string): Promise<ProcurementPackage | null> {
    const prisma = getPrismaClient();
    const row = await prisma.procurementPackage.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementPackage) : null;
  }

  async findAll(): Promise<readonly ProcurementPackage[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.procurementPackage.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPackage);
  }

  async count(): Promise<number> {
    return getPrismaClient().procurementPackage.count();
  }

  async findByCode(code: string): Promise<ProcurementPackage | null> {
    const prisma = getPrismaClient();
    const row = await prisma.procurementPackage.findUnique({ where: { packageCode: code } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementPackage) : null;
  }

  async findByStatus(status: PackageStatus): Promise<readonly ProcurementPackage[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.procurementPackage.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPackage);
  }

  async findByDepartment(deptCode: string): Promise<readonly ProcurementPackage[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.procurementPackage.findMany({ where: { department: deptCode } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPackage);
  }

  async search(query: PackageSearchQuery): Promise<PackageSearchResult> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.department) where.department = query.department
    if (query.packageType) where.packageType = query.packageType
    if (query.fundSource) where.fundSource = query.fundSource
    if (query.minValue !== undefined || query.maxValue !== undefined) {
      where.estimatedValue = {
        ...(query.minValue !== undefined ? { gte: query.minValue } : {}),
        ...(query.maxValue !== undefined ? { lte: query.maxValue } : {}),
      }
    }
    if (query.term) {
      where.OR = [
        { packageName: { contains: query.term, mode: 'insensitive' } },
        { packageCode: { contains: query.term, mode: 'insensitive' } },
      ]
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize

    const [rows, total] = await Promise.all([
      prisma.procurementPackage.findMany({ where: where as never, skip, take: pageSize }),
      prisma.procurementPackage.count({ where: where as never }),
    ])

    return { items: rows.map(r => mapPrismaRow(r) as unknown as ProcurementPackage), total, page, pageSize };
  }
}

// ─── PackageItem ──────────────────────────────────────────────────────────────

export class PrismaPackageItemRepository implements IPackageItemRepository {
  async create(entity: Omit<PackageItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<PackageItem> {
    const row = await getPrismaClient().packageItem.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as PackageItem;
  }

  async update(id: string, updates: Partial<Omit<PackageItem, 'id' | 'createdAt'>>): Promise<PackageItem> {
    const row = await getPrismaClient().packageItem.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as PackageItem;
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().packageItem.delete({ where: { id } });
  }

  async findById(id: string): Promise<PackageItem | null> {
    const row = await getPrismaClient().packageItem.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as PackageItem) : null;
  }

  async findAll(): Promise<readonly PackageItem[]> {
    const rows = await getPrismaClient().packageItem.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as PackageItem);
  }

  async count(): Promise<number> {
    return getPrismaClient().packageItem.count();
  }

  async findByPackageId(packageId: string): Promise<readonly PackageItem[]> {
    const rows = await getPrismaClient().packageItem.findMany({ where: { packageId } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageItem);
  }

  async deleteByPackageId(packageId: string): Promise<void> {
    await getPrismaClient().packageItem.deleteMany({ where: { packageId } });
  }

  async sumByPackageId(packageId: string): Promise<number> {
    const result = await getPrismaClient().packageItem.aggregate({
      where: { packageId },
      _sum: { estimatedTotal: true },
    });
    const sum = result._sum.estimatedTotal;
    return sum ? sum.toNumber() : 0;
  }
}

// ─── PackageBudget ────────────────────────────────────────────────────────────

export class PrismaBudgetRepository implements IBudgetRepository {
  async create(entity: Omit<PackageBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<PackageBudget> {
    const row = await getPrismaClient().packageBudget.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as PackageBudget;
  }

  async update(id: string, updates: Partial<Omit<PackageBudget, 'id' | 'createdAt'>>): Promise<PackageBudget> {
    const row = await getPrismaClient().packageBudget.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as PackageBudget;
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().packageBudget.delete({ where: { id } });
  }

  async findById(id: string): Promise<PackageBudget | null> {
    const row = await getPrismaClient().packageBudget.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as PackageBudget) : null;
  }

  async findAll(): Promise<readonly PackageBudget[]> {
    const rows = await getPrismaClient().packageBudget.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as PackageBudget);
  }

  async count(): Promise<number> {
    return getPrismaClient().packageBudget.count();
  }

  async findByPackageId(packageId: string): Promise<PackageBudget | null> {
    const row = await getPrismaClient().packageBudget.findFirst({ where: { packageId } });
    return row ? (mapPrismaRow(row) as unknown as PackageBudget) : null;
  }
}

// ─── PackageAttachment ────────────────────────────────────────────────────────

export class PrismaAttachmentRepository implements IAttachmentRepository {
  async create(entity: Omit<PackageAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<PackageAttachment> {
    const row = await getPrismaClient().packageAttachment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as PackageAttachment;
  }

  async update(id: string, updates: Partial<Omit<PackageAttachment, 'id' | 'createdAt'>>): Promise<PackageAttachment> {
    const row = await getPrismaClient().packageAttachment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as PackageAttachment;
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().packageAttachment.delete({ where: { id } });
  }

  async findById(id: string): Promise<PackageAttachment | null> {
    const row = await getPrismaClient().packageAttachment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as PackageAttachment) : null;
  }

  async findAll(): Promise<readonly PackageAttachment[]> {
    const rows = await getPrismaClient().packageAttachment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as PackageAttachment);
  }

  async count(): Promise<number> {
    return getPrismaClient().packageAttachment.count();
  }

  async findByPackageId(packageId: string): Promise<readonly PackageAttachment[]> {
    const rows = await getPrismaClient().packageAttachment.findMany({ where: { packageId } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageAttachment);
  }

  async findByDocumentType(packageId: string, docType: string): Promise<readonly PackageAttachment[]> {
    const rows = await getPrismaClient().packageAttachment.findMany({ where: { packageId, documentType: docType } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageAttachment);
  }
}

// ─── PackageHistory ───────────────────────────────────────────────────────────

export class PrismaHistoryRepository implements IHistoryRepository {
  async create(entity: Omit<PackageHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<PackageHistory> {
    const row = await getPrismaClient().packageHistory.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as PackageHistory;
  }

  async update(id: string, updates: Partial<Omit<PackageHistory, 'id' | 'createdAt'>>): Promise<PackageHistory> {
    const row = await getPrismaClient().packageHistory.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as PackageHistory;
  }

  async delete(id: string): Promise<void> {
    await getPrismaClient().packageHistory.delete({ where: { id } });
  }

  async findById(id: string): Promise<PackageHistory | null> {
    const row = await getPrismaClient().packageHistory.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as PackageHistory) : null;
  }

  async findAll(): Promise<readonly PackageHistory[]> {
    const rows = await getPrismaClient().packageHistory.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as PackageHistory);
  }

  async count(): Promise<number> {
    return getPrismaClient().packageHistory.count();
  }

  async findByPackageId(packageId: string): Promise<readonly PackageHistory[]> {
    const rows = await getPrismaClient().packageHistory.findMany({ where: { packageId } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageHistory);
  }

  async findByAction(packageId: string, action: string): Promise<readonly PackageHistory[]> {
    const rows = await getPrismaClient().packageHistory.findMany({ where: { packageId, action } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageHistory);
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function buildPrismaPackageRepositories(): PackageRepositories {
  return {
    packages: new PrismaProcurementPackageRepository(),
    items: new PrismaPackageItemRepository(),
    budgets: new PrismaBudgetRepository(),
    attachments: new PrismaAttachmentRepository(),
    history: new PrismaHistoryRepository(),
  };
}
