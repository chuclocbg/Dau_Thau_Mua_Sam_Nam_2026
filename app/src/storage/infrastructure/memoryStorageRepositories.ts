import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { AttachmentReference, RetentionPolicy, LegalHold, UploadSession, AttachmentDocumentType, UploadStatus } from '../types/storageTypes.ts'
import type { StorageAuditEvent, StorageAuditEventType, IStorageAuditRepository } from '../types/auditTypes.ts'
import type {
  IAttachmentReferenceRepository, IUploadSessionRepository,
  IRetentionPolicyRepository, ILegalHoldRepository, StorageRepositories,
} from './storageRepositories.ts'

// ── Generic base ──────────────────────────────────────────────────────────────

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
    if (!existing) throw new Error(`Storage entity not found: ${id}`)
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> { this.store.delete(id) }
  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null }
  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()) }
  async count(): Promise<number> { return this.store.size }
}

// ── AttachmentReference ───────────────────────────────────────────────────────

export class MemoryAttachmentReferenceRepository
  extends MemoryBase<AttachmentReference>
  implements IAttachmentReferenceRepository
{
  async findByObjectId(objectId: string): Promise<readonly AttachmentReference[]> {
    return Array.from(this.store.values()).filter(r => r.objectId === objectId)
  }
  async findByModule(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]> {
    return Array.from(this.store.values()).filter(r => r.moduleType === moduleType && r.moduleId === moduleId)
  }
  async findByModuleType(moduleType: string, limit = 100): Promise<readonly AttachmentReference[]> {
    return Array.from(this.store.values()).filter(r => r.moduleType === moduleType).slice(0, limit)
  }
  async findActive(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]> {
    return Array.from(this.store.values()).filter(
      r => r.moduleType === moduleType && r.moduleId === moduleId && r.isActive,
    )
  }
  async findByDocumentType(documentType: AttachmentDocumentType): Promise<readonly AttachmentReference[]> {
    return Array.from(this.store.values()).filter(r => r.documentType === documentType)
  }
  async deactivate(id: string, _deactivatedBy: string): Promise<AttachmentReference> {
    return this.update(id, { isActive: false })
  }
}

// ── UploadSession ─────────────────────────────────────────────────────────────

export class MemoryUploadSessionRepository
  extends MemoryBase<UploadSession>
  implements IUploadSessionRepository
{
  async findByStatus(status: UploadStatus): Promise<readonly UploadSession[]> {
    return Array.from(this.store.values()).filter(s => s.status === status)
  }
  async findByUploadedBy(uploadedBy: string): Promise<readonly UploadSession[]> {
    return Array.from(this.store.values()).filter(s => s.uploadedBy === uploadedBy)
  }
  async findExpiredSessions(asOf: string): Promise<readonly UploadSession[]> {
    // Sessions older than 24 hours and still INITIATED or IN_PROGRESS are considered expired
    const cutoff = new Date(new Date(asOf).getTime() - 86_400_000).toISOString()
    return Array.from(this.store.values()).filter(
      s => (s.status === 'INITIATED' || s.status === 'IN_PROGRESS') && s.createdAt < cutoff,
    )
  }
  async markStatus(id: string, status: UploadStatus): Promise<UploadSession> {
    return this.update(id, { status })
  }
  async incrementChunkCount(id: string): Promise<UploadSession> {
    const s = this.store.get(id)
    if (!s) throw new Error(`UploadSession not found: ${id}`)
    return this.update(id, { uploadedChunks: s.uploadedChunks + 1 })
  }
}

// ── RetentionPolicy ───────────────────────────────────────────────────────────

export class MemoryRetentionPolicyRepository
  extends MemoryBase<RetentionPolicy>
  implements IRetentionPolicyRepository
{
  async findByDocumentType(documentType: AttachmentDocumentType): Promise<RetentionPolicy | null> {
    for (const p of this.store.values()) {
      if (p.documentType === documentType && p.isActive) return p
    }
    return null
  }
  async findActive(): Promise<readonly RetentionPolicy[]> {
    return Array.from(this.store.values()).filter(p => p.isActive)
  }
}

// ── LegalHold ─────────────────────────────────────────────────────────────────

export class MemoryLegalHoldRepository
  extends MemoryBase<LegalHold>
  implements ILegalHoldRepository
{
  async findByObjectId(objectId: string): Promise<readonly LegalHold[]> {
    return Array.from(this.store.values()).filter(h => h.objectId === objectId)
  }
  async findByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]> {
    return Array.from(this.store.values()).filter(h => h.moduleType === moduleType && h.moduleId === moduleId)
  }
  async findActiveByObjectId(objectId: string): Promise<readonly LegalHold[]> {
    return Array.from(this.store.values()).filter(h => h.objectId === objectId && !h.releasedAt)
  }
  async findActiveByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]> {
    return Array.from(this.store.values()).filter(
      h => h.moduleType === moduleType && h.moduleId === moduleId && !h.releasedAt,
    )
  }
  async release(id: string, releasedBy: string, releasedAt: string): Promise<LegalHold> {
    return this.update(id, { releasedBy, releasedAt })
  }
}

// ── Storage Audit (append-only) ───────────────────────────────────────────────

export class MemoryStorageAuditRepository implements IStorageAuditRepository {
  private readonly store = new Map<string, StorageAuditEvent>()

  async append(event: Omit<StorageAuditEvent, 'id' | 'createdAt'>): Promise<StorageAuditEvent> {
    const stored: StorageAuditEvent = { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    this.store.set(stored.id, stored)
    return stored
  }
  async findById(id: string): Promise<StorageAuditEvent | null> { return this.store.get(id) ?? null }
  async findByObjectKey(objectKey: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.objectKey === objectKey).slice(0, limit)
  }
  async findByObjectId(objectId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.objectId === objectId).slice(0, limit)
  }
  async findByUserId(userId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.userId === userId).slice(0, limit)
  }
  async findByModule(moduleType: string, moduleId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values())
      .filter(e => e.moduleType === moduleType && e.moduleId === moduleId)
      .slice(0, limit)
  }
  async findByEventType(type: StorageAuditEventType, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.eventType === type).slice(0, limit)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    return Array.from(this.store.values())
      .filter(e => e.occurredAt >= from && e.occurredAt <= to)
      .slice(0, limit)
  }
  async count(): Promise<number> { return this.store.size }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildMemoryStorageRepositories(): StorageRepositories {
  return {
    attachmentReferences: new MemoryAttachmentReferenceRepository(),
    uploadSessions: new MemoryUploadSessionRepository(),
    retentionPolicies: new MemoryRetentionPolicyRepository(),
    legalHolds: new MemoryLegalHoldRepository(),
    auditEvents: new MemoryStorageAuditRepository(),
  }
}
