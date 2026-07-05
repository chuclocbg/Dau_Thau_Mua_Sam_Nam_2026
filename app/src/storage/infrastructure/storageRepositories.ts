import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { AttachmentReference, RetentionPolicy, LegalHold, UploadSession, AttachmentDocumentType, UploadStatus } from '../types/storageTypes.ts'
import type { IStorageAuditRepository } from '../types/auditTypes.ts'

// ── Attachment Reference Repository ──────────────────────────────────────────

export interface IAttachmentReferenceRepository extends IBaseRepository<AttachmentReference> {
  findByObjectId(objectId: string): Promise<readonly AttachmentReference[]>
  findByModule(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]>
  findByModuleType(moduleType: string, limit?: number): Promise<readonly AttachmentReference[]>
  findActive(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]>
  findByDocumentType(documentType: AttachmentDocumentType): Promise<readonly AttachmentReference[]>
  deactivate(id: string, deactivatedBy: string): Promise<AttachmentReference>
}

// ── Upload Session Repository ─────────────────────────────────────────────────

export interface IUploadSessionRepository extends IBaseRepository<UploadSession> {
  findByStatus(status: UploadStatus): Promise<readonly UploadSession[]>
  findByUploadedBy(uploadedBy: string): Promise<readonly UploadSession[]>
  findExpiredSessions(asOf: string): Promise<readonly UploadSession[]>
  markStatus(id: string, status: UploadStatus): Promise<UploadSession>
  incrementChunkCount(id: string): Promise<UploadSession>
}

// ── Retention Policy Repository ───────────────────────────────────────────────

export interface IRetentionPolicyRepository extends IBaseRepository<RetentionPolicy> {
  findByDocumentType(documentType: AttachmentDocumentType): Promise<RetentionPolicy | null>
  findActive(): Promise<readonly RetentionPolicy[]>
}

// ── Legal Hold Repository ─────────────────────────────────────────────────────

export interface ILegalHoldRepository extends IBaseRepository<LegalHold> {
  findByObjectId(objectId: string): Promise<readonly LegalHold[]>
  findByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]>
  findActiveByObjectId(objectId: string): Promise<readonly LegalHold[]>
  findActiveByModule(moduleType: string, moduleId: string): Promise<readonly LegalHold[]>
  release(id: string, releasedBy: string, releasedAt: string): Promise<LegalHold>
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export interface StorageRepositories {
  readonly attachmentReferences: IAttachmentReferenceRepository
  readonly uploadSessions: IUploadSessionRepository
  readonly retentionPolicies: IRetentionPolicyRepository
  readonly legalHolds: ILegalHoldRepository
  readonly auditEvents: IStorageAuditRepository
}
