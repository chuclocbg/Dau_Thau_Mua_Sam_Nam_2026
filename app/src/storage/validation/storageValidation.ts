import type { RetentionPolicy, UploadSession, AttachmentReference } from '../types/storageTypes.ts'
import { StorageError, CHECKSUM_ALGORITHMS, MAX_FILE_SIZE_BYTES, MIN_FILE_SIZE_BYTES } from '../types/storageTypes.ts'
import type { InitiateUploadParams } from '../types/providerTypes.ts'
import { isAllowedMimeType, isValidDocumentType, sanitizeFilename } from '../domain/attachment.ts'
import { isValidChecksumFormat } from '../domain/checksum.ts'

// ── Object key validation ─────────────────────────────────────────────────────

export function validateObjectKey(key: string): void {
  if (!key || !key.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'objectKey', 'objectKey is required')
  }
  if (key.length > 1024) {
    throw new StorageError('VALIDATION_FAILED', 'objectKey', 'objectKey must be <= 1024 characters')
  }
  if (key.includes('..')) {
    throw new StorageError('VALIDATION_FAILED', 'objectKey', 'objectKey must not contain ".." path traversal')
  }
  if (!/^[a-zA-Z0-9/_.\-]+$/.test(key)) {
    throw new StorageError('VALIDATION_FAILED', 'objectKey', 'objectKey contains invalid characters')
  }
}

// ── Upload request validation ─────────────────────────────────────────────────

export function validateInitiateUploadParams(params: InitiateUploadParams): void {
  validateObjectKey(params.objectKey)
  if (!isValidDocumentType(params.documentType)) {
    throw new StorageError('VALIDATION_FAILED', 'documentType', `Unknown document type: ${params.documentType}`)
  }
  if (!params.uploadedBy || !params.uploadedBy.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'uploadedBy', 'uploadedBy is required')
  }
  if (params.expectedSizeBytes !== undefined) {
    if (params.expectedSizeBytes < MIN_FILE_SIZE_BYTES) {
      throw new StorageError('FILE_TOO_SMALL', 'expectedSizeBytes', 'Expected file must be at least 1 byte')
    }
    if (params.expectedSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new StorageError('FILE_TOO_LARGE', 'expectedSizeBytes', `Expected file exceeds maximum size`)
    }
  }
  if (params.expectedChecksum && params.checksumAlgorithm) {
    if (!(CHECKSUM_ALGORITHMS as readonly string[]).includes(params.checksumAlgorithm)) {
      throw new StorageError('VALIDATION_FAILED', 'checksumAlgorithm', `Unknown checksum algorithm: ${params.checksumAlgorithm}`)
    }
    if (!isValidChecksumFormat(params.expectedChecksum, params.checksumAlgorithm)) {
      throw new StorageError('VALIDATION_FAILED', 'expectedChecksum', `Invalid checksum format for ${params.checksumAlgorithm}`)
    }
  }
  if (params.totalChunks !== undefined && (params.totalChunks < 1 || !Number.isInteger(params.totalChunks))) {
    throw new StorageError('VALIDATION_FAILED', 'totalChunks', 'totalChunks must be a positive integer')
  }
}

// ── Upload session state validation ──────────────────────────────────────────

export function validateUploadSessionActive(session: UploadSession): void {
  if (session.status === 'ABORTED') {
    throw new StorageError('UPLOAD_SESSION_ABORTED', 'uploadSessionId', 'Upload session has been aborted')
  }
  if (session.status === 'COMPLETED') {
    throw new StorageError('UPLOAD_SESSION_COMPLETED', 'uploadSessionId', 'Upload session is already completed')
  }
}

// ── Retention policy validation ───────────────────────────────────────────────

export function validateRetentionPolicy(policy: Partial<RetentionPolicy>): void {
  if (!policy.documentType || !isValidDocumentType(policy.documentType)) {
    throw new StorageError('VALIDATION_FAILED', 'documentType', 'Valid documentType is required')
  }
  if (!Number.isInteger(policy.retentionDays) || (policy.retentionDays ?? 0) < 1) {
    throw new StorageError('VALIDATION_FAILED', 'retentionDays', 'retentionDays must be a positive integer')
  }
  if (!policy.legalBasis?.length) {
    throw new StorageError('VALIDATION_FAILED', 'legalBasis', 'legalBasis is required for retention policy')
  }
}

// ── Attachment reference validation ───────────────────────────────────────────

export function validateAttachmentReference(ref: Partial<AttachmentReference>): void {
  if (!ref.objectId?.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'objectId', 'objectId is required')
  }
  if (!ref.moduleType?.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'moduleType', 'moduleType is required')
  }
  if (!ref.moduleId?.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'moduleId', 'moduleId is required')
  }
  if (!ref.filename?.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'filename', 'filename is required')
  }
  if (!ref.mimeType || !isAllowedMimeType(ref.mimeType)) {
    throw new StorageError('MIME_TYPE_NOT_ALLOWED', 'mimeType', `MIME type not allowed: ${ref.mimeType}`)
  }
  if (!ref.documentType || !isValidDocumentType(ref.documentType)) {
    throw new StorageError('VALIDATION_FAILED', 'documentType', `Unknown document type: ${ref.documentType}`)
  }
  if (!ref.uploadedBy?.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'uploadedBy', 'uploadedBy is required')
  }
}

// ── Filename validation ───────────────────────────────────────────────────────

export function validateFilename(filename: string): void {
  if (!filename || !filename.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'filename', 'filename is required')
  }
  const sanitized = sanitizeFilename(filename)
  if (sanitized.length === 0) {
    throw new StorageError('VALIDATION_FAILED', 'filename', 'filename contains no valid characters')
  }
}
