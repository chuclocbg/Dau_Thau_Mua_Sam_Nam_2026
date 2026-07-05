import { describe, it, expect } from 'vitest'
import {
  STORAGE_PROVIDER_TYPES, ATTACHMENT_DOCUMENT_TYPES, CHECKSUM_ALGORITHMS,
  UPLOAD_STATUSES, VIRUS_SCAN_STATUSES, OBJECT_ACCESS_LEVELS, STORAGE_ERROR_CODES,
  ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_CHUNK_SIZE_BYTES, MIN_FILE_SIZE_BYTES,
  StorageError,
} from '../storage/types/storageTypes.ts'

describe('Storage provider types', () => {
  it('includes all expected provider types', () => {
    expect(STORAGE_PROVIDER_TYPES).toContain('local')
    expect(STORAGE_PROVIDER_TYPES).toContain('s3')
    expect(STORAGE_PROVIDER_TYPES).toContain('azure_blob')
    expect(STORAGE_PROVIDER_TYPES).toContain('gcs')
    expect(STORAGE_PROVIDER_TYPES).toContain('minio')
    expect(STORAGE_PROVIDER_TYPES).toContain('government_object_storage')
    expect(STORAGE_PROVIDER_TYPES).toHaveLength(6)
  })
})

describe('Attachment document types', () => {
  it('covers all 11 procurement document types', () => {
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('DECISION')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('TENDER_DOCUMENTS')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('BID_SUBMISSION')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('EVALUATION_REPORT')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('CONTRACT')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('ACCEPTANCE')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('INVOICE')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('PAYMENT_EVIDENCE')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('AUDIT_EVIDENCE')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('LEGAL_DOCUMENT')
    expect(ATTACHMENT_DOCUMENT_TYPES).toContain('GENERAL')
    expect(ATTACHMENT_DOCUMENT_TYPES).toHaveLength(11)
  })
})

describe('Checksum algorithms', () => {
  it('supports SHA256, SHA512, MD5', () => {
    expect(CHECKSUM_ALGORITHMS).toContain('SHA256')
    expect(CHECKSUM_ALGORITHMS).toContain('SHA512')
    expect(CHECKSUM_ALGORITHMS).toContain('MD5')
  })
})

describe('Upload statuses', () => {
  it('covers full lifecycle', () => {
    expect(UPLOAD_STATUSES).toContain('INITIATED')
    expect(UPLOAD_STATUSES).toContain('IN_PROGRESS')
    expect(UPLOAD_STATUSES).toContain('COMPLETED')
    expect(UPLOAD_STATUSES).toContain('ABORTED')
    expect(UPLOAD_STATUSES).toHaveLength(4)
  })
})

describe('Virus scan statuses', () => {
  it('includes all expected statuses', () => {
    expect(VIRUS_SCAN_STATUSES).toContain('CLEAN')
    expect(VIRUS_SCAN_STATUSES).toContain('INFECTED')
    expect(VIRUS_SCAN_STATUSES).toContain('PENDING')
    expect(VIRUS_SCAN_STATUSES).toContain('ERROR')
    expect(VIRUS_SCAN_STATUSES).toContain('SKIPPED')
  })
})

describe('Object access levels', () => {
  it('includes PRIVATE, RESTRICTED, INTERNAL, PUBLIC', () => {
    expect(OBJECT_ACCESS_LEVELS).toContain('PRIVATE')
    expect(OBJECT_ACCESS_LEVELS).toContain('RESTRICTED')
    expect(OBJECT_ACCESS_LEVELS).toContain('INTERNAL')
    expect(OBJECT_ACCESS_LEVELS).toContain('PUBLIC')
  })
})

describe('Storage error codes', () => {
  it('defines 18 error codes', () => {
    expect(STORAGE_ERROR_CODES).toHaveLength(18)
    expect(STORAGE_ERROR_CODES).toContain('OBJECT_NOT_FOUND')
    expect(STORAGE_ERROR_CODES).toContain('CHECKSUM_MISMATCH')
    expect(STORAGE_ERROR_CODES).toContain('INFECTED_FILE')
    expect(STORAGE_ERROR_CODES).toContain('RETENTION_ACTIVE')
    expect(STORAGE_ERROR_CODES).toContain('LEGAL_HOLD_ACTIVE')
    expect(STORAGE_ERROR_CODES).toContain('SIGNED_URL_EXPIRED')
  })
})

describe('StorageError', () => {
  it('constructs with code, field, message', () => {
    const err = new StorageError('OBJECT_NOT_FOUND', 'objectId', 'Not found')
    expect(err.code).toBe('OBJECT_NOT_FOUND')
    expect(err.field).toBe('objectId')
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('StorageError')
    expect(err).toBeInstanceOf(Error)
  })

  it('is an instanceof Error', () => {
    const err = new StorageError('CHECKSUM_MISMATCH', 'checksum', 'bad')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StorageError)
  })
})

describe('File size constants', () => {
  it('MAX_FILE_SIZE_BYTES is 500MB as bigint', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(500n * 1024n * 1024n)
    expect(typeof MAX_FILE_SIZE_BYTES).toBe('bigint')
  })

  it('MAX_CHUNK_SIZE_BYTES is 5MB as bigint', () => {
    expect(MAX_CHUNK_SIZE_BYTES).toBe(5n * 1024n * 1024n)
  })

  it('MIN_FILE_SIZE_BYTES is 1', () => {
    expect(MIN_FILE_SIZE_BYTES).toBe(1n)
  })
})

describe('Allowed MIME types', () => {
  it('includes common procurement document formats', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('text/plain')
  })

  it('has 12 types', () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(12)
  })
})
