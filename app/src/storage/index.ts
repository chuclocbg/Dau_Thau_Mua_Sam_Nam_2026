// ── Public API — Storage Module ───────────────────────────────────────────────

// Types
export type {
  StorageProviderType, AttachmentDocumentType, ChecksumAlgorithm,
  UploadStatus, VirusScanStatus, ObjectAccessLevel, StorageErrorCode, AllowedMimeType,
  ObjectMetadata, StoredObject, StorageVersion, SignedUrl,
  AttachmentReference, UploadSession, RetentionPolicy, LegalHold,
  VirusScanResult, ListOptions, ObjectListEntry, ObjectListing,
} from './types/storageTypes.ts'
export {
  STORAGE_PROVIDER_TYPES, ATTACHMENT_DOCUMENT_TYPES, CHECKSUM_ALGORITHMS,
  UPLOAD_STATUSES, VIRUS_SCAN_STATUSES, OBJECT_ACCESS_LEVELS, STORAGE_ERROR_CODES,
  ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_CHUNK_SIZE_BYTES, MIN_FILE_SIZE_BYTES,
  StorageError,
} from './types/storageTypes.ts'

// Provider interfaces
export type {
  IStorageProvider, IObjectStore, IBinaryRepository,
  IVirusScanProvider, IMultipartUploadProvider, StorageProviders,
  StoreParams, RetrieveParams, AttachmentParams,
  InitiateUploadParams, AppendChunkParams, CompleteUploadParams,
  MultipartInitResult,
} from './types/providerTypes.ts'

// Audit types
export type { StorageAuditEvent, StorageAuditEventType, IStorageAuditRepository } from './types/auditTypes.ts'

// Repository interfaces
export type {
  IAttachmentReferenceRepository, IUploadSessionRepository,
  IRetentionPolicyRepository, ILegalHoldRepository, StorageRepositories,
} from './infrastructure/storageRepositories.ts'

// Factory
export type {
  BuildObjectMetadataParams, BuildAttachmentReferenceParams, BuildUploadSessionParams, BuildLegalHoldParams,
  CreateAttachmentReferenceParams, CreateUploadSessionParams, CreateRetentionPolicyParams, CreateLegalHoldParams,
} from './application/storageFactory.ts'
export {
  buildObjectMetadata, buildAttachmentReference, buildUploadSession,
  buildRetentionPolicy, buildLegalHold,
} from './application/storageFactory.ts'

// Application services
export type { UploadObjectParams, DownloadObjectParams, DeleteObjectParams, GetSignedUrlParams } from './application/storageService.ts'
export { StorageService } from './application/storageService.ts'
export { UploadService } from './application/uploadService.ts'
export { RetentionService } from './application/retentionService.ts'

// Domain
export {
  DEFAULT_RETENTION_DAYS, calculateRetentionExpiry, isRetentionExpired,
  getEffectiveRetentionDays, isHoldActive, hasActiveLegalHold, canDelete,
  validateRetentionPolicyValues,
} from './domain/retention.ts'
export {
  computeChecksumHex, normalizeChecksum, validateChecksum,
  isValidChecksumFormat, assertValidChecksum, buildContentAddressedKey,
} from './domain/checksum.ts'
export {
  buildObjectKey, buildVersionKey, sanitizeFilename, isAllowedMimeType,
  isValidDocumentType, validateAttachmentMetadata, filterActiveAttachments,
  groupAttachmentsByType, classifyDocumentByMime,
} from './domain/attachment.ts'

// Validation
export {
  validateObjectKey, validateInitiateUploadParams, validateUploadSessionActive,
  validateRetentionPolicy, validateAttachmentReference, validateFilename,
} from './validation/storageValidation.ts'

// Memory implementations (for tests and local dev)
export { buildMemoryStorageRepositories } from './infrastructure/memoryStorageRepositories.ts'
export { MockStorageProvider } from './infrastructure/providers/mockStorageProvider.ts'

// Prisma stubs
export { buildPrismaStorageRepositories } from './infrastructure/prismaStorageRepositories.ts'

// Integration bridge
export {
  resolveDepartmentForAttachment, resolveAttachmentReference, resolveAttachmentsForModule,
} from './integration/storageIntegration.ts'
