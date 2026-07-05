import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { AdvisoryConversationSession } from '../domain/conversationTypes.ts'

// ── MemorySessionRepository — same pattern as every other module's memory repository ──
// Per src/knowledge/repositories/memoryKnowledgeRepositories.ts's MemoryBase pattern.
// Memory-first per project convention; a Prisma-backed implementation follows later,
// never before this module is proven (per DEVELOPMENT_GUIDE.md).

export interface ISessionRepository extends IBaseRepository<AdvisoryConversationSession> {
  findBySessionId(sessionId: string): Promise<AdvisoryConversationSession | null>
}

export class MemorySessionRepository implements ISessionRepository {
  private readonly store = new Map<string, AdvisoryConversationSession>()

  async create(entity: Omit<AdvisoryConversationSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdvisoryConversationSession> {
    const now = new Date().toISOString()
    const session: AdvisoryConversationSession = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    this.store.set(session.id, session)
    return session
  }

  async update(
    id: string,
    updates: Partial<Omit<AdvisoryConversationSession, 'id' | 'createdAt'>>,
  ): Promise<AdvisoryConversationSession> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Conversation session not found: ${id}`)
    const updated: AdvisoryConversationSession = { ...existing, ...updates, id, updatedAt: new Date().toISOString() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async findById(id: string): Promise<AdvisoryConversationSession | null> {
    return this.store.get(id) ?? null
  }

  async findAll(): Promise<readonly AdvisoryConversationSession[]> {
    return Array.from(this.store.values())
  }

  async count(): Promise<number> {
    return this.store.size
  }

  async findBySessionId(sessionId: string): Promise<AdvisoryConversationSession | null> {
    return Array.from(this.store.values()).find(s => s.sessionState.sessionId === sessionId) ?? null
  }
}

export function buildMemorySessionRepository(): ISessionRepository {
  return new MemorySessionRepository()
}
