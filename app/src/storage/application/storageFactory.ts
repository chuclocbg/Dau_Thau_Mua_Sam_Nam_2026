import type {
  ObjectMetadata, AttachmentReference, UploadSession, RetentionPolicy, LegalHold,
  AttachmentDocumentType, ObjectAccessLevel, ChecksumAlgorithm,
} from '../types/storageTypes.ts'
import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Create param types ────────────────────────────────────────────────────────

export type CreateAttachmentReferenceParams = Omit<AttachmentReference, 'id' | 'createdAt' | 'updatedAt'>
export type CreateUploadSessionParams = Omit<UploadSession, 'id' | 'createdAt' | 'updatedAt'>
export type CreateRetentionPolicyParams = Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>
export type CreateLegalHoldParams = Omit<LegalHold, 'id' | 'createdAt' | 'updatedAt'>

// ── ObjectMetadata builder ────────────────────────────────────────────────────

export interface BuildObjectMetadataParams {
  readonly objectKey: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: bigint
  readonly checksum: string
  readonly checksumAlgorithm: ChecksumAlgorithm
  readonly documentType: AttachmentDocumentType
  readonly uploadedBy: string
  readonly uploadedAt: string
  readonly accessLevel?: ObjectAccessLevel
  readonly contentDisposition?: string
  readonly tags?: Readonly<Record<string, string>>
}

export function buildObjectMetadata(params: BuildObjectMetadataParams): ObjectMetadata {
  return Object.freeze({
    objectKey: params.objectKey,
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    checksum: params.checksum,
    checksumAlgorithm: params.checksumAlgorithm,
    accessLevel: params.accessLevel ?? 'PRIVATE',
    documentType: params.documentType,
    uploadedBy: params.uploadedBy,
    uploadedAt: params.uploadedAt,
    contentDisposition: params.contentDisposition,
    tags: params.tags ?? {},
  })
}

// ── AttachmentReference builder ───────────────────────────────────────────────

export interface BuildAttachmentReferenceParams {
  readonly objectId: string
  readonly moduleType: string
  readonly moduleId: string
  readonly documentType: AttachmentDocumentType
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: bigint
  readonly checksum: string
  readonly versionId: string
  readonly uploadedBy: string
  readonly uploadedAt: string
}

export function buildAttachmentReference(params: BuildAttachmentReferenceParams): CreateAttachmentReferenceParams {
  return {
    objectId: params.objectId,
    moduleType: params.moduleType,
    moduleId: params.moduleId,
    documentType: params.documentType,
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    checksum: params.checksum,
    versionId: params.versionId,
    uploadedBy: params.uploadedBy,
    uploadedAt: params.uploadedAt,
    isActive: true,
  }
}

// ── UploadSession builder ─────────────────────────────────────────────────────

export interface BuildUploadSessionParams {
  readonly objectKey: string
  readonly documentType: AttachmentDocumentType
  readonly uploadedBy: string
  readonly checksumAlgorithm?: ChecksumAlgorithm
  readonly expectedSizeBytes?: bigint
  readonly expectedChecksum?: string
  readonly totalChunks?: number
  readonly metadata?: Readonly<Record<string, string>>
}

export function buildUploadSession(params: BuildUploadSessionParams): CreateUploadSessionParams {
  return {
    objectKey: params.objectKey,
    documentType: params.documentType,
    uploadedBy: params.uploadedBy,
    checksumAlgorithm: params.checksumAlgorithm ?? 'SHA256',
    expectedSizeBytes: params.expectedSizeBytes,
    expectedChecksum: params.expectedChecksum,
    totalChunks: params.totalChunks,
    uploadedChunks: 0,
    status: 'INITIATED',
    metadata: params.metadata ?? {},
  }
}

// ── RetentionPolicy builder ───────────────────────────────────────────────────

export function buildRetentionPolicy(
  documentType: AttachmentDocumentType,
  retentionDays: number,
  legalBasis: readonly LegalBasis[],
): CreateRetentionPolicyParams {
  return { documentType, retentionDays, legalBasis, isActive: true }
}

// ── LegalHold builder ─────────────────────────────────────────────────────────

export interface BuildLegalHoldParams {
  readonly objectId?: string
  readonly moduleType?: string
  readonly moduleId?: string
  readonly reason: string
  readonly legalBasis: readonly LegalBasis[]
  readonly placedBy: string
  readonly placedAt: string
}

export function buildLegalHold(params: BuildLegalHoldParams): CreateLegalHoldParams {
  return {
    objectId: params.objectId,
    moduleType: params.moduleType,
    moduleId: params.moduleId,
    reason: params.reason,
    legalBasis: params.legalBasis,
    placedBy: params.placedBy,
    placedAt: params.placedAt,
  }
}
