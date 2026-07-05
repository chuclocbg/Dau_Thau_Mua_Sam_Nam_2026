import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Provider discriminator ────────────────────────────────────────────────────

export const STORAGE_PROVIDER_TYPES = [
  'local', 's3', 'azure_blob', 'gcs', 'minio', 'government_object_storage',
] as const
export type StorageProviderType = typeof STORAGE_PROVIDER_TYPES[number]

// ── Procurement document types ────────────────────────────────────────────────

export const ATTACHMENT_DOCUMENT_TYPES = [
  'DECISION',            // Quyết định
  'TENDER_DOCUMENTS',    // Hồ sơ mời thầu (HSMT)
  'BID_SUBMISSION',      // Hồ sơ dự thầu (HSDT)
  'EVALUATION_REPORT',   // Báo cáo đánh giá
  'CONTRACT',            // Hợp đồng
  'ACCEPTANCE',          // Biên bản nghiệm thu
  'INVOICE',             // Hóa đơn
  'PAYMENT_EVIDENCE',    // Chứng từ thanh toán
  'AUDIT_EVIDENCE',      // Bằng chứng kiểm toán
  'LEGAL_DOCUMENT',      // Văn bản pháp lý
  'GENERAL',             // Catch-all for unclassified documents
] as const
export type AttachmentDocumentType = typeof ATTACHMENT_DOCUMENT_TYPES[number]

// ── Supported checksum algorithms ─────────────────────────────────────────────

export const CHECKSUM_ALGORITHMS = ['SHA256', 'SHA512', 'MD5'] as const
export type ChecksumAlgorithm = typeof CHECKSUM_ALGORITHMS[number]

// ── Upload session status ─────────────────────────────────────────────────────

export const UPLOAD_STATUSES = ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'] as const
export type UploadStatus = typeof UPLOAD_STATUSES[number]

// ── Virus scan status ─────────────────────────────────────────────────────────

export const VIRUS_SCAN_STATUSES = ['CLEAN', 'INFECTED', 'PENDING', 'ERROR', 'SKIPPED'] as const
export type VirusScanStatus = typeof VIRUS_SCAN_STATUSES[number]

// ── Object access level ───────────────────────────────────────────────────────

export const OBJECT_ACCESS_LEVELS = ['PRIVATE', 'RESTRICTED', 'INTERNAL', 'PUBLIC'] as const
export type ObjectAccessLevel = typeof OBJECT_ACCESS_LEVELS[number]

// ── Storage error codes ───────────────────────────────────────────────────────

export const STORAGE_ERROR_CODES = [
  'OBJECT_NOT_FOUND', 'OBJECT_ALREADY_EXISTS', 'UPLOAD_SESSION_NOT_FOUND',
  'UPLOAD_SESSION_ABORTED', 'UPLOAD_SESSION_COMPLETED', 'CHECKSUM_MISMATCH',
  'INFECTED_FILE', 'MIME_TYPE_NOT_ALLOWED', 'FILE_TOO_LARGE', 'FILE_TOO_SMALL',
  'RETENTION_ACTIVE', 'LEGAL_HOLD_ACTIVE', 'PROVIDER_ERROR',
  'PERMISSION_DENIED', 'VALIDATION_FAILED', 'VERSION_NOT_FOUND',
  'QUOTA_EXCEEDED', 'SIGNED_URL_EXPIRED',
] as const
export type StorageErrorCode = typeof STORAGE_ERROR_CODES[number]

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

// ── Core object metadata ──────────────────────────────────────────────────────

export interface ObjectMetadata {
  readonly objectKey: string              // storage-internal path (never expose to client)
  readonly filename: string              // original filename as uploaded
  readonly mimeType: string
  readonly sizeBytes: bigint             // precise byte count
  readonly checksum: string              // hex digest
  readonly checksumAlgorithm: ChecksumAlgorithm
  readonly accessLevel: ObjectAccessLevel
  readonly documentType: AttachmentDocumentType
  readonly uploadedBy: string           // userId
  readonly uploadedAt: string           // ISO 8601
  readonly contentDisposition?: string
  readonly tags: Readonly<Record<string, string>>
}

// ── Stored object (metadata + version info) ───────────────────────────────────

export interface StoredObject {
  readonly id: string
  readonly metadata: ObjectMetadata
  readonly versionId: string
  readonly versionNumber: number
  readonly isCurrentVersion: boolean
  readonly createdAt: string
}

// ── Immutable version record ──────────────────────────────────────────────────

export interface StorageVersion {
  readonly id: string
  readonly objectId: string
  readonly versionNumber: number
  readonly objectKey: string            // versioned storage key
  readonly checksum: string
  readonly sizeBytes: bigint
  readonly createdBy: string
  readonly createdAt: string
  readonly isDeleted: boolean
}

// ── Signed URL for pre-authorized access ─────────────────────────────────────

export interface SignedUrl {
  readonly url: string
  readonly objectKey: string
  readonly operation: 'GET' | 'PUT' | 'DELETE'
  readonly expiresAt: string            // ISO 8601
  readonly headers?: Readonly<Record<string, string>>
}

// ── Attachment reference — domain-level link ──────────────────────────────────
// Links a stored object to a business entity. Frozen modules reference by id string only.

export interface AttachmentReference {
  readonly id: string
  readonly objectId: string            // → StoredObject.id
  readonly moduleType: string          // 'CONTRACT' | 'PACKAGE' | 'PAYMENT' | etc.
  readonly moduleId: string            // the business entity id
  readonly documentType: AttachmentDocumentType
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: bigint
  readonly checksum: string
  readonly versionId: string
  readonly uploadedBy: string
  readonly uploadedAt: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Upload session (multipart / resumable) ────────────────────────────────────

export interface UploadSession {
  readonly id: string
  readonly objectKey: string
  readonly expectedSizeBytes?: bigint
  readonly expectedChecksum?: string
  readonly checksumAlgorithm: ChecksumAlgorithm
  readonly totalChunks?: number
  readonly uploadedChunks: number
  readonly status: UploadStatus
  readonly documentType: AttachmentDocumentType
  readonly uploadedBy: string
  readonly metadata: Readonly<Record<string, string>>
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Retention policy ──────────────────────────────────────────────────────────
// Minimum retention duration per document type (Vietnamese archiving law).
// Luật Lưu trữ 2011 requires at least 5 years for most government records.

export interface RetentionPolicy {
  readonly id: string
  readonly documentType: AttachmentDocumentType
  readonly retentionDays: number        // minimum days before physical deletion is allowed
  readonly legalBasis: readonly LegalBasis[]
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Legal hold ────────────────────────────────────────────────────────────────
// Placed on a specific object or module's attachments during investigation/audit.
// A legal hold overrides the retention policy — object CANNOT be deleted.

export interface LegalHold {
  readonly id: string
  readonly objectId?: string           // if set: holds a specific object
  readonly moduleType?: string         // if set: holds all attachments of this module type
  readonly moduleId?: string           // if set: holds all attachments for this module entity
  readonly reason: string
  readonly legalBasis: readonly LegalBasis[]
  readonly placedBy: string            // userId
  readonly placedAt: string
  readonly releasedBy?: string
  readonly releasedAt?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Virus scan result ─────────────────────────────────────────────────────────

export interface VirusScanResult {
  readonly objectKey: string
  readonly status: VirusScanStatus
  readonly scannedAt?: string
  readonly threatName?: string
  readonly scannerVersion?: string
  readonly metadata: Readonly<Record<string, string>>
}

// ── Object listing ────────────────────────────────────────────────────────────

export interface ListOptions {
  readonly prefix?: string
  readonly limit?: number
  readonly offset?: number
  readonly documentType?: AttachmentDocumentType
}

export interface ObjectListEntry {
  readonly objectKey: string
  readonly sizeBytes: bigint
  readonly lastModified: string
  readonly checksum?: string
}

export interface ObjectListing {
  readonly entries: readonly ObjectListEntry[]
  readonly total: number
  readonly hasMore: boolean
}

// ── Allowed MIME types for procurement documents ──────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'text/plain',
  'text/csv',
] as const
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number]

// ── Max file sizes (bytes as bigint) ─────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 500n * 1024n * 1024n   // 500 MB
export const MAX_CHUNK_SIZE_BYTES = 5n * 1024n * 1024n    // 5 MB per chunk
export const MIN_FILE_SIZE_BYTES = 1n                     // at least 1 byte
