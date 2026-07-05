/**
 * In-memory repository implementations.
 * Generic base covers create/update/delete/findById/findAll/count.
 * Concrete subclasses add domain-specific finders.
 */

import type {
  ProcurementPackage, PackageItem, PackageBudget,
  PackageAttachment, PackageHistory, PackageStatus,
  PackageSearchQuery, PackageSearchResult,
} from './packageTypes';
import type {
  IBaseRepository, IProcurementPackageRepository, IPackageItemRepository,
  IBudgetRepository, IAttachmentRepository, IHistoryRepository,
  PackageRepositories,
} from './packageRepository';

// ─── Generic base ─────────────────────────────────────────────────────────────

export class MemoryPackageBaseRepository<T extends { id: string; createdAt: string; updatedAt: string }>
  implements IBaseRepository<T>
{
  protected readonly store = new Map<string, T>();

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now  = new Date().toISOString();
    const item = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T;
    this.store.set(item.id, item);
    return item;
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Package entity not found: ${id}`);
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T;
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> { this.store.delete(id); }

  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null; }

  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()); }

  async findWhere(pred: (item: T) => boolean): Promise<readonly T[]> {
    return Array.from(this.store.values()).filter(pred);
  }

  async count(): Promise<number> { return this.store.size; }

  clear(): void { this.store.clear(); }
}

// ─── ProcurementPackage ───────────────────────────────────────────────────────

export class MemoryProcurementPackageRepository
  extends MemoryPackageBaseRepository<ProcurementPackage>
  implements IProcurementPackageRepository
{
  async findByCode(code: string): Promise<ProcurementPackage | null> {
    for (const pkg of this.store.values()) {
      if (pkg.packageCode === code) return pkg;
    }
    return null;
  }

  async findByStatus(status: PackageStatus): Promise<readonly ProcurementPackage[]> {
    return this.findWhere(p => p.status === status);
  }

  async findByDepartment(deptCode: string): Promise<readonly ProcurementPackage[]> {
    return this.findWhere(p => p.department === deptCode);
  }

  async search(query: PackageSearchQuery): Promise<PackageSearchResult> {
    let items = Array.from(this.store.values());

    if (query.status)      items = items.filter(p => p.status      === query.status);
    if (query.department)  items = items.filter(p => p.department   === query.department);
    if (query.packageType) items = items.filter(p => p.packageType  === query.packageType);
    if (query.fundSource)  items = items.filter(p => p.fundSource   === query.fundSource);
    if (query.minValue !== undefined) items = items.filter(p => p.estimatedValue >= query.minValue!);
    if (query.maxValue !== undefined) items = items.filter(p => p.estimatedValue <= query.maxValue!);
    if (query.term) {
      const t = query.term.toLowerCase();
      items = items.filter(
        p => p.packageName.toLowerCase().includes(t) || p.packageCode.toLowerCase().includes(t),
      );
    }

    const total    = items.length;
    const page     = query.page     ?? 1;
    const pageSize = query.pageSize ?? 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }
}

// ─── PackageItem ──────────────────────────────────────────────────────────────

export class MemoryPackageItemRepository
  extends MemoryPackageBaseRepository<PackageItem>
  implements IPackageItemRepository
{
  async findByPackageId(packageId: string): Promise<readonly PackageItem[]> {
    return this.findWhere(i => i.packageId === packageId);
  }

  async deleteByPackageId(packageId: string): Promise<void> {
    const items = await this.findByPackageId(packageId);
    for (const item of items) this.store.delete(item.id);
  }

  async sumByPackageId(packageId: string): Promise<number> {
    const items = await this.findByPackageId(packageId);
    return items.reduce((sum, i) => sum + i.estimatedTotal, 0);
  }
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export class MemoryBudgetRepository
  extends MemoryPackageBaseRepository<PackageBudget>
  implements IBudgetRepository
{
  async findByPackageId(packageId: string): Promise<PackageBudget | null> {
    const results = await this.findWhere(b => b.packageId === packageId);
    return results[0] ?? null;
  }
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export class MemoryAttachmentRepository
  extends MemoryPackageBaseRepository<PackageAttachment>
  implements IAttachmentRepository
{
  async findByPackageId(packageId: string): Promise<readonly PackageAttachment[]> {
    return this.findWhere(a => a.packageId === packageId);
  }

  async findByDocumentType(packageId: string, docType: string): Promise<readonly PackageAttachment[]> {
    return this.findWhere(a => a.packageId === packageId && a.documentType === docType);
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export class MemoryHistoryRepository
  extends MemoryPackageBaseRepository<PackageHistory>
  implements IHistoryRepository
{
  async findByPackageId(packageId: string): Promise<readonly PackageHistory[]> {
    return this.findWhere(h => h.packageId === packageId);
  }

  async findByAction(packageId: string, action: string): Promise<readonly PackageHistory[]> {
    return this.findWhere(h => h.packageId === packageId && h.action === action);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMemoryPackageRepositories(): PackageRepositories {
  return {
    packages:    new MemoryProcurementPackageRepository(),
    items:       new MemoryPackageItemRepository(),
    budgets:     new MemoryBudgetRepository(),
    attachments: new MemoryAttachmentRepository(),
    history:     new MemoryHistoryRepository(),
  };
}
