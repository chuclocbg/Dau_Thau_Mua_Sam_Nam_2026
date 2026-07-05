import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { KnowledgeItem, KnowledgeApplicabilityRule, KnowledgeRelationType } from '../platform/knowledgeTypes.ts'
import type { KnowledgeGraphEdge } from '../graph/knowledgeGraph.ts'
import type {
  IKnowledgeItemRepository, IKnowledgeRelationRepository, IApplicabilityRepository, KnowledgeRepositories,
} from './knowledgeRepositories.ts'

// ── Generic base (same pattern as every other module's Memory*Repository) ────

class MemoryBase<T extends { id: string; createdAt: string; updatedAt: string }>
  implements IBaseRepository<T>
{
  protected readonly store = new Map<string, T>()

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const item = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T
    this.store.set(item.id, item)
    return item
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Knowledge entity not found: ${id}`)
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> { this.store.delete(id) }
  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null }
  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()) }
  async count(): Promise<number> { return this.store.size }
}

// ── KnowledgeItem ──────────────────────────────────────────────────────────────

export class MemoryKnowledgeItemRepository extends MemoryBase<KnowledgeItem> implements IKnowledgeItemRepository {
  async findByDomain(domain: string): Promise<readonly KnowledgeItem[]> {
    return Array.from(this.store.values()).filter(i => i.domain === domain)
  }
  async findActive(domain?: string): Promise<readonly KnowledgeItem[]> {
    return Array.from(this.store.values()).filter(i => i.isActive && (!domain || i.domain === domain))
  }
  async findByType(type: string): Promise<readonly KnowledgeItem[]> {
    return Array.from(this.store.values()).filter(i => i.type === type)
  }
}

// ── KnowledgeRelation (graph edges) ───────────────────────────────────────────

export class MemoryKnowledgeRelationRepository implements IKnowledgeRelationRepository {
  private readonly store = new Map<string, KnowledgeGraphEdge>()

  async create(
    fromItemId: string,
    toItemId: string,
    relationType: KnowledgeRelationType,
    metadata: Readonly<Record<string, string>> = {},
  ): Promise<KnowledgeGraphEdge> {
    const edge: KnowledgeGraphEdge = {
      id: crypto.randomUUID(), fromItemId, toItemId, relationType, metadata,
      createdAt: new Date().toISOString(),
    }
    this.store.set(edge.id, edge)
    return edge
  }
  async findByFromItem(fromItemId: string): Promise<readonly KnowledgeGraphEdge[]> {
    return Array.from(this.store.values()).filter(e => e.fromItemId === fromItemId)
  }
  async findByToItem(toItemId: string): Promise<readonly KnowledgeGraphEdge[]> {
    return Array.from(this.store.values()).filter(e => e.toItemId === toItemId)
  }
  async findAll(): Promise<readonly KnowledgeGraphEdge[]> {
    return Array.from(this.store.values())
  }
}

// ── KnowledgeApplicabilityRule ─────────────────────────────────────────────────

export class MemoryApplicabilityRepository extends MemoryBase<KnowledgeApplicabilityRule> implements IApplicabilityRepository {
  async findByItemId(itemId: string): Promise<readonly KnowledgeApplicabilityRule[]> {
    return Array.from(this.store.values()).filter(r => r.itemId === itemId)
  }
  async findActive(): Promise<readonly KnowledgeApplicabilityRule[]> {
    return Array.from(this.store.values()).filter(r => r.isActive)
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildMemoryKnowledgeRepositories(): KnowledgeRepositories {
  return {
    items: new MemoryKnowledgeItemRepository(),
    relations: new MemoryKnowledgeRelationRepository(),
    applicability: new MemoryApplicabilityRepository(),
  }
}
