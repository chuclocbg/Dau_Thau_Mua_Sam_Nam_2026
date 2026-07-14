import type { IRecoveryRepository, RecoveryMarker } from './recoveryTypes.ts'
import { isUnfinished } from './recoveryTypes.ts'

// ── MemoryRecoveryRepository — Phase X.13 ──────────────────────────────────────
// Same pattern as every other module's memory repository (e.g.
// src/conversation/infrastructure/memorySessionRepository.ts's MemorySessionRepository).
// Memory-first per project convention; a Prisma-backed implementation exists alongside it
// (prismaRecoveryRepository.ts), never before this module is proven.

export class MemoryRecoveryRepository implements IRecoveryRepository {
  private readonly store = new Map<string, RecoveryMarker>()

  async create(entity: Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<RecoveryMarker> {
    const now = new Date().toISOString()
    const marker: RecoveryMarker = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now, version: 0 }
    this.store.set(marker.id, marker)
    return marker
  }

  async update(id: string, updates: Partial<Omit<RecoveryMarker, 'id' | 'createdAt' | 'version'>>): Promise<RecoveryMarker> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Recovery marker not found: ${id}`)
    const updated: RecoveryMarker = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async findById(id: string): Promise<RecoveryMarker | null> {
    return this.store.get(id) ?? null
  }

  async findAll(): Promise<readonly RecoveryMarker[]> {
    return Array.from(this.store.values())
  }

  async count(): Promise<number> {
    return this.store.size
  }

  async findPending(): Promise<readonly RecoveryMarker[]> {
    return Array.from(this.store.values())
      .filter(isUnfinished)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  }

  async findBySessionId(sessionId: string): Promise<readonly RecoveryMarker[]> {
    return Array.from(this.store.values()).filter(m => m.sessionId === sessionId)
  }

  async resolveIfPending(
    id: string,
    expectedVersion: number,
    updates: Partial<Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
  ): Promise<RecoveryMarker | null> {
    const existing = this.store.get(id)
    if (!existing || existing.status !== 'PENDING' || existing.version !== expectedVersion) {
      return null
    }
    const updated: RecoveryMarker = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    }
    this.store.set(id, updated)
    return updated
  }
}

export function buildMemoryRecoveryRepository(): IRecoveryRepository {
  return new MemoryRecoveryRepository()
}
