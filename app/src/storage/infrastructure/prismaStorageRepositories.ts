/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type { AttachmentReference, RetentionPolicy, LegalHold, UploadSession, AttachmentDocumentType, UploadStatus } from '../types/storageTypes.ts'
import type { StorageAuditEvent, StorageAuditEventType, IStorageAuditRepository } from '../types/auditTypes.ts'
import type {
  IAttachmentReferenceRepository, IUploadSessionRepository,
  IRetentionPolicyRepository, ILegalHoldRepository, StorageRepositories,
} from './storageRepositories.ts'
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

export class PrismaAttachmentReferenceRepository implements IAttachmentReferenceRepository {
  async create(entity: Omit<AttachmentReference, 'id' | 'createdAt' | 'updatedAt'>): Promise<AttachmentReference> {
    const row = await getPrismaClient().storageAttachmentReference.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as AttachmentReference
  }
  async update(id: string, updates: Partial<Omit<AttachmentReference, 'id' | 'createdAt'>>): Promise<AttachmentReference> {
    const row = await getPrismaClient().storageAttachmentReference.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as AttachmentReference
  }
  async delete(id: string): Promise<void> { await getPrismaClient().storageAttachmentReference.delete({ where: { id } }) }
  async findById(id: string): Promise<AttachmentReference | null> {
    const row = await getPrismaClient().storageAttachmentReference.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as AttachmentReference) : null
  }
  async findAll(): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async count(): Promise<number> { return getPrismaClient().storageAttachmentReference.count() }

  async findByObjectId(objectId: string): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany({ where: { objectId } })
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async findByModule(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany({ where: { moduleType, moduleId } })
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async findByModuleType(moduleType: string, limit = 100): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany({ where: { moduleType }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async findActive(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany({ where: { moduleType, moduleId, isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async findByDocumentType(documentType: AttachmentDocumentType): Promise<readonly AttachmentReference[]> {
    const rows = await getPrismaClient().storageAttachmentReference.findMany({ where: { documentType } })
    return rows.map(r => mapPrismaRow(r) as unknown as AttachmentReference)
  }
  async deactivate(id: string, _deactivatedBy: string): Promise<AttachmentReference> {
    const row = await getPrismaClient().storageAttachmentReference.update({ where: { id }, data: { isActive: false } })
    return mapPrismaRow(row) as unknown as AttachmentReference
  }
}

export class PrismaUploadSessionRepository implements IUploadSessionRepository {
  async create(entity: Omit<UploadSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<UploadSession> {
    const row = await getPrismaClient().storageUploadSession.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as UploadSession
  }
  async update(id: string, updates: Partial<Omit<UploadSession, 'id' | 'createdAt'>>): Promise<UploadSession> {
    const row = await getPrismaClient().storageUploadSession.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as UploadSession
  }
  async delete(id: string): Promise<void> { await getPrismaClient().storageUploadSession.delete({ where: { id } }) }
  async findById(id: string): Promise<UploadSession | null> {
    const row = await getPrismaClient().storageUploadSession.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as UploadSession) : null
  }
  async findAll(): Promise<readonly UploadSession[]> {
    const rows = await getPrismaClient().storageUploadSession.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as UploadSession)
  }
  async count(): Promise<number> { return getPrismaClient().storageUploadSession.count() }

  async findByStatus(status: UploadStatus): Promise<readonly UploadSession[]> {
    const rows = await getPrismaClient().storageUploadSession.findMany({ where: { status } })
    return rows.map(r => mapPrismaRow(r) as unknown as UploadSession)
  }
  async findByUploadedBy(uploadedBy: string): Promise<readonly UploadSession[]> {
    const rows = await getPrismaClient().storageUploadSession.findMany({ where: { uploadedBy } })
    return rows.map(r => mapPrismaRow(r) as unknown as UploadSession)
  }
  async findExpiredSessions(asOf: string): Promise<readonly UploadSession[]> {
    const cutoff = new Date(new Date(asOf).getTime() - 86_400_000).toISOString()
    const rows = await getPrismaClient().storageUploadSession.findMany({
      where: { status: { in: ['INITIATED', 'IN_PROGRESS'] }, createdAt: { lt: cutoff } },
    })
    return rows.map(r => mapPrismaRow(r) as unknown as UploadSession)
  }
  async markStatus(id: string, status: UploadStatus): Promise<UploadSession> {
    const row = await getPrismaClient().storageUploadSession.update({ where: { id }, data: { status } })
    return mapPrismaRow(row) as unknown as UploadSession
  }
  async incrementChunkCount(id: string): Promise<UploadSession> {
    const row = await getPrismaClient().storageUploadSession.update({
      where: { id }, data: { uploadedChunks: { increment: 1 } },
    })
    return mapPrismaRow(row) as unknown as UploadSession
  }
}

export class PrismaRetentionPolicyRepository implements IRetentionPolicyRepository {
  async create(entity: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetentionPolicy> {
    const row = await getPrismaClient().storageRetentionPolicy.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as RetentionPolicy
  }
  async update(id: string, updates: Partial<Omit<RetentionPolicy, 'id' | 'createdAt'>>): Promise<RetentionPolicy> {
    const row = await getPrismaClient().storageRetentionPolicy.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as RetentionPolicy
  }
  async delete(id: string): Promise<void> { await getPrismaClient().storageRetentionPolicy.delete({ where: { id } }) }
  async findById(id: string): Promise<RetentionPolicy | null> {
    const row = await getPrismaClient().storageRetentionPolicy.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as RetentionPolicy) : null
  }
  async findAll(): Promise<readonly RetentionPolicy[]> {
    const rows = await getPrismaClient().storageRetentionPolicy.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as RetentionPolicy)
  }
  async count(): Promise<number> { return getPrismaClient().storageRetentionPolicy.count() }

  async findByDocumentType(documentType: AttachmentDocumentType): Promise<RetentionPolicy | null> {
    const row = await getPrismaClient().storageRetentionPolicy.findFirst({ where: { documentType, isActive: true } })
    return row ? (mapPrismaRow(row) as unknown as RetentionPolicy) : null
  }
  async findActive(): Promise<readonly RetentionPolicy[]> {
    const rows = await getPrismaClient().storageRetentionPolicy.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as RetentionPolicy)
  }
}

export class PrismaLegalHoldRepository implements ILegalHoldRepository {
  async create(entity: Omit<LegalHold, 'id' | 'createdAt' | 'updatedAt'>): Promise<LegalHold> {
    const row = await getPrismaClient().storageLegalHold.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as LegalHold
  }
  async update(id: string, updates: Partial<Omit<LegalHold, 'id' | 'createdAt'>>): Promise<LegalHold> {
    const row = await getPrismaClient().storageLegalHold.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as LegalHold
  }
  async delete(id: string): Promise<void> { await getPrismaClient().storageLegalHold.delete({ where: { id } }) }
  async findById(id: string): Promise<LegalHold | null> {
    const row = await getPrismaClient().storageLegalHold.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as LegalHold) : null
  }
  async findAll(): Promise<readonly LegalHold[]> {
    const rows = await getPrismaClient().storageLegalHold.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as LegalHold)
  }
  async count(): Promise<number> { return getPrismaClient().storageLegalHold.count() }

  async findByObjectId(objectId: string): Promise<readonly LegalHold[]> {
    const rows = await getPrismaClient().storageLegalHold.findMany({ where: { objectId } })
    return rows.map(r => mapPrismaRow(r) as unknown as LegalHold)
  }
  async findByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]> {
    const rows = await getPrismaClient().storageLegalHold.findMany({ where: { moduleType, moduleId } })
    return rows.map(r => mapPrismaRow(r) as unknown as LegalHold)
  }
  async findActiveByObjectId(objectId: string): Promise<readonly LegalHold[]> {
    const rows = await getPrismaClient().storageLegalHold.findMany({ where: { objectId, releasedAt: null } })
    return rows.map(r => mapPrismaRow(r) as unknown as LegalHold)
  }
  async findActiveByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]> {
    const rows = await getPrismaClient().storageLegalHold.findMany({ where: { moduleType, moduleId, releasedAt: null } })
    return rows.map(r => mapPrismaRow(r) as unknown as LegalHold)
  }
  async release(id: string, releasedBy: string, releasedAt: string): Promise<LegalHold> {
    const row = await getPrismaClient().storageLegalHold.update({ where: { id }, data: { releasedBy, releasedAt } })
    return mapPrismaRow(row) as unknown as LegalHold
  }
}

export class PrismaStorageAuditRepository implements IStorageAuditRepository {
  async append(event: Omit<StorageAuditEvent, 'id' | 'createdAt'>): Promise<StorageAuditEvent> {
    const row = await getPrismaClient().storageAuditEvent.create({ data: event as never })
    return mapPrismaRow(row) as unknown as StorageAuditEvent
  }
  async findById(id: string): Promise<StorageAuditEvent | null> {
    const row = await getPrismaClient().storageAuditEvent.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as StorageAuditEvent) : null
  }
  async findByObjectKey(objectKey: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({ where: { objectKey }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async findByObjectId(objectId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({ where: { objectId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async findByUserId(userId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({ where: { userId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async findByModule(moduleType: string, moduleId: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({ where: { moduleType, moduleId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async findByEventType(type: StorageAuditEventType, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({ where: { eventType: type }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly StorageAuditEvent[]> {
    const rows = await getPrismaClient().storageAuditEvent.findMany({
      where: { occurredAt: { gte: from, lte: to } }, take: limit,
    })
    return rows.map(r => mapPrismaRow(r) as unknown as StorageAuditEvent)
  }
  async count(): Promise<number> { return getPrismaClient().storageAuditEvent.count() }
}

export function buildPrismaStorageRepositories(): StorageRepositories {
  return {
    attachmentReferences: new PrismaAttachmentReferenceRepository(),
    uploadSessions: new PrismaUploadSessionRepository(),
    retentionPolicies: new PrismaRetentionPolicyRepository(),
    legalHolds: new PrismaLegalHoldRepository(),
    auditEvents: new PrismaStorageAuditRepository(),
  }
}
