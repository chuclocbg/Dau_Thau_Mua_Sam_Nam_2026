/**
 * In-memory master data repository — one generic class, 10 typed instances.
 * Used for tests and local development only; not referenced by production code.
 */

import type { MasterDataEntity, SearchQuery, PagedResult } from './masterdataTypes';
import type { IMasterDataRepository } from './masterdataRepository';

// ─── Generic memory implementation ───────────────────────────────────────────

export class MemoryMasterDataRepository<T extends MasterDataEntity>
  implements IMasterDataRepository<T>
{
  private readonly store = new Map<string, T>();

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now  = new Date().toISOString();
    const item = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T;
    this.store.set(item.id, item);
    return item;
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Master data entity not found: ${id}`);
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T;
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async archive(id: string): Promise<T> {
    return this.update(id, { isArchived: true, isActive: false } as Partial<Omit<T, 'id' | 'createdAt'>>);
  }

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async findByCode(code: string): Promise<T | null> {
    for (const entity of this.store.values()) {
      if (entity.code === code) return entity;
    }
    return null;
  }

  async findActive(): Promise<readonly T[]> {
    const result: T[] = [];
    for (const entity of this.store.values()) {
      if (entity.isActive && !entity.isArchived) result.push(entity);
    }
    return result;
  }

  async search(query: SearchQuery): Promise<PagedResult<T>> {
    let items = Array.from(this.store.values());

    if (query.isArchived !== undefined) {
      items = items.filter(e => e.isArchived === query.isArchived);
    }
    if (query.isActive !== undefined) {
      items = items.filter(e => e.isActive === query.isActive);
    }
    if (query.term) {
      const term = query.term.toLowerCase();
      items = items.filter(
        e => e.name.toLowerCase().includes(term) || e.code.toLowerCase().includes(term),
      );
    }

    const total    = items.length;
    const page     = query.page     ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start    = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  /** For test isolation only — not part of the repository interface. */
  clear(): void {
    this.store.clear();
  }

  /** Expose raw entries for assertion convenience in tests. */
  all(): readonly T[] {
    return Array.from(this.store.values());
  }
}
