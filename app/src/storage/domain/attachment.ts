import type { AttachmentDocumentType, AttachmentReference } from '../types/storageTypes.ts'
import { ATTACHMENT_DOCUMENT_TYPES, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIN_FILE_SIZE_BYTES, StorageError } from '../types/storageTypes.ts'

// ── MIME → DocumentType classification hints ──────────────────────────────────
// Informational only — caller provides the explicit documentType at upload time.
// This mapping is a fallback classification, not authoritative.

const MIME_TO_DOC_HINTS: Partial<Record<string, AttachmentDocumentType>> = {
  'application/pdf': 'LEGAL_DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'LEGAL_DOCUMENT',
  'application/msword': 'LEGAL_DOCUMENT',
  'application/vnd.ms-excel': 'PAYMENT_EVIDENCE',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'PAYMENT_EVIDENCE',
}

export function classifyDocumentByMime(mimeType: string): AttachmentDocumentType {
  return MIME_TO_DOC_HINTS[mimeType] ?? 'GENERAL'
}

// ── Object key construction ───────────────────────────────────────────────────

export function buildObjectKey(
  moduleType: string,
  moduleId: string,
  documentType: AttachmentDocumentType,
  filename: string,
  uploadedAt: string,
): string {
  const date = uploadedAt.slice(0, 10)  // YYYY-MM-DD
  const sanitized = sanitizeFilename(filename)
  return `${moduleType.toLowerCase()}/${moduleId}/${documentType.toLowerCase()}/${date}/${sanitized}`
}

export function buildVersionKey(baseKey: string, versionNumber: number): string {
  return `${baseKey}/v${versionNumber}`
}

// ── Filename sanitization ─────────────────────────────────────────────────────

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/, '')
    .slice(0, 200)
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function isValidDocumentType(documentType: string): documentType is AttachmentDocumentType {
  return (ATTACHMENT_DOCUMENT_TYPES as readonly string[]).includes(documentType)
}

export function validateAttachmentMetadata(params: {
  filename: string
  mimeType: string
  sizeBytes: bigint
  documentType: string
}): void {
  if (!params.filename || !params.filename.trim()) {
    throw new StorageError('VALIDATION_FAILED', 'filename', 'filename is required')
  }
  if (!isAllowedMimeType(params.mimeType)) {
    throw new StorageError('MIME_TYPE_NOT_ALLOWED', 'mimeType', `MIME type not allowed: ${params.mimeType}`)
  }
  if (params.sizeBytes < MIN_FILE_SIZE_BYTES) {
    throw new StorageError('FILE_TOO_SMALL', 'sizeBytes', 'File must be at least 1 byte')
  }
  if (params.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new StorageError('FILE_TOO_LARGE', 'sizeBytes', `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`)
  }
  if (!isValidDocumentType(params.documentType)) {
    throw new StorageError('VALIDATION_FAILED', 'documentType', `Unknown document type: ${params.documentType}`)
  }
}

// ── Reference helpers ─────────────────────────────────────────────────────────

export function isAttachmentActive(ref: AttachmentReference): boolean {
  return ref.isActive
}

export function filterActiveAttachments(refs: readonly AttachmentReference[]): readonly AttachmentReference[] {
  return refs.filter(isAttachmentActive)
}

export function groupAttachmentsByType(
  refs: readonly AttachmentReference[],
): ReadonlyMap<AttachmentDocumentType, readonly AttachmentReference[]> {
  const map = new Map<AttachmentDocumentType, AttachmentReference[]>()
  for (const ref of refs) {
    const list = map.get(ref.documentType) ?? []
    list.push(ref)
    map.set(ref.documentType, list)
  }
  return map
}
