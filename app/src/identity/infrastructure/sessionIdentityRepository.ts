import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { PrincipalKind } from '../domain/identityTypes.ts'

// ── Session Identity Binding — Phase X.14 ──────────────────────────────────────
// Records which Principal a ConversationSession (Phase X.11, frozen) belongs to, WITHOUT
// modifying ConversationSession/AdvisoryConversationSession's shape -- a parallel bookkeeping
// table, exactly the same pattern Phase X.13's RecoveryMarker already established for
// turn-in-flight tracking (a separate concern, its own lifecycle, associated by sessionId).

export interface SessionIdentityBinding {
  readonly id: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly sessionId: string
  readonly principalId: string
  readonly principalKind: PrincipalKind
}

export interface ISessionIdentityRepository extends IBaseRepository<SessionIdentityBinding> {
  findBySessionId(sessionId: string): Promise<SessionIdentityBinding | null>
}

// ── Memory implementation (same pattern as every other module's memory repository) ────────────

export class MemorySessionIdentityRepository implements ISessionIdentityRepository {
  private readonly store = new Map<string, SessionIdentityBinding>()

  async create(entity: Omit<SessionIdentityBinding, 'id' | 'createdAt' | 'updatedAt'>): Promise<SessionIdentityBinding> {
    const now = new Date().toISOString()
    const binding: SessionIdentityBinding = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    this.store.set(binding.id, binding)
    return binding
  }

  async update(id: string, updates: Partial<Omit<SessionIdentityBinding, 'id' | 'createdAt'>>): Promise<SessionIdentityBinding> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Session identity binding not found: ${id}`)
    const updated: SessionIdentityBinding = { ...existing, ...updates, id, updatedAt: new Date().toISOString() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async findById(id: string): Promise<SessionIdentityBinding | null> {
    return this.store.get(id) ?? null
  }

  async findAll(): Promise<readonly SessionIdentityBinding[]> {
    return Array.from(this.store.values())
  }

  async count(): Promise<number> {
    return this.store.size
  }

  async findBySessionId(sessionId: string): Promise<SessionIdentityBinding | null> {
    return Array.from(this.store.values()).find(b => b.sessionId === sessionId) ?? null
  }
}

export function buildMemorySessionIdentityRepository(): ISessionIdentityRepository {
  return new MemorySessionIdentityRepository()
}
