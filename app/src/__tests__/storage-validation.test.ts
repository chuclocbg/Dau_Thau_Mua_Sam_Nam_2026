import { describe, it, expect } from 'vitest'
import {
  validateObjectKey, validateInitiateUploadParams, validateUploadSessionActive,
  validateRetentionPolicy, validateAttachmentReference, validateFilename,
} from '../storage/validation/storageValidation.ts'
import { StorageError } from '../storage/types/storageTypes.ts'
import type { UploadSession } from '../storage/types/storageTypes.ts'

const session = (overrides: Partial<UploadSession> = {}): UploadSession => ({
  id: 's-1',
  objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
  checksumAlgorithm: 'SHA256',
  uploadedChunks: 0,
  status: 'INITIATED',
  documentType: 'CONTRACT',
  uploadedBy: 'user-1',
  metadata: {},
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('validateObjectKey', () => {
  it('does not throw for valid keys', () => {
    expect(() => validateObjectKey('contract/c-1/file.pdf')).not.toThrow()
    expect(() => validateObjectKey('a/b/c-d_e.f')).not.toThrow()
  })

  it('throws for empty key', () => {
    expect(() => validateObjectKey('')).toThrow(StorageError)
    expect(() => validateObjectKey('   ')).toThrow(StorageError)
  })

  it('throws for path traversal', () => {
    expect(() => validateObjectKey('contract/../secret')).toThrow(StorageError)
  })

  it('throws for invalid characters', () => {
    expect(() => validateObjectKey('contract/file name.pdf')).toThrow(StorageError)
    expect(() => validateObjectKey('contract/file?name')).toThrow(StorageError)
  })

  it('throws for keys exceeding 1024 chars', () => {
    expect(() => validateObjectKey('a'.repeat(1025))).toThrow(StorageError)
  })

  it('accepts keys at exactly 1024 chars', () => {
    expect(() => validateObjectKey('a'.repeat(1024))).not.toThrow()
  })
})

describe('validateInitiateUploadParams', () => {
  const valid = {
    objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
    documentType: 'CONTRACT' as const,
    uploadedBy: 'user-1',
  }

  it('does not throw for valid params', () => {
    expect(() => validateInitiateUploadParams(valid)).not.toThrow()
  })

  it('throws for invalid document type', () => {
    expect(() => validateInitiateUploadParams({ ...valid, documentType: 'INVALID' as never })).toThrow(StorageError)
  })

  it('throws for missing uploadedBy', () => {
    expect(() => validateInitiateUploadParams({ ...valid, uploadedBy: '' })).toThrow(StorageError)
  })

  it('throws for zero expectedSizeBytes', () => {
    expect(() => validateInitiateUploadParams({ ...valid, expectedSizeBytes: 0n })).toThrow(StorageError)
  })

  it('throws for too-large expectedSizeBytes', () => {
    expect(() => validateInitiateUploadParams({ ...valid, expectedSizeBytes: 501n * 1024n * 1024n })).toThrow(StorageError)
  })

  it('throws for totalChunks = 0', () => {
    expect(() => validateInitiateUploadParams({ ...valid, totalChunks: 0 })).toThrow(StorageError)
  })

  it('throws for non-integer totalChunks', () => {
    expect(() => validateInitiateUploadParams({ ...valid, totalChunks: 1.5 })).toThrow(StorageError)
  })

  it('throws for invalid checksum format', () => {
    expect(() => validateInitiateUploadParams({
      ...valid, expectedChecksum: 'not-hex', checksumAlgorithm: 'SHA256',
    })).toThrow(StorageError)
  })
})

describe('validateUploadSessionActive', () => {
  it('does not throw for INITIATED status', () => {
    expect(() => validateUploadSessionActive(session({ status: 'INITIATED' }))).not.toThrow()
  })

  it('does not throw for IN_PROGRESS status', () => {
    expect(() => validateUploadSessionActive(session({ status: 'IN_PROGRESS' }))).not.toThrow()
  })

  it('throws for ABORTED status', () => {
    expect(() => validateUploadSessionActive(session({ status: 'ABORTED' }))).toThrow(StorageError)
  })

  it('throws for COMPLETED status', () => {
    expect(() => validateUploadSessionActive(session({ status: 'COMPLETED' }))).toThrow(StorageError)
  })
})

describe('validateRetentionPolicy', () => {
  const valid = {
    documentType: 'CONTRACT' as const,
    retentionDays: 3650,
    legalBasis: [{ document: 'LTA-2011', article: '10' }],
    isActive: true,
  }

  it('does not throw for valid policy', () => {
    expect(() => validateRetentionPolicy(valid)).not.toThrow()
  })

  it('throws for invalid document type', () => {
    expect(() => validateRetentionPolicy({ ...valid, documentType: 'BAD' as never })).toThrow(StorageError)
  })

  it('throws for zero retention days', () => {
    expect(() => validateRetentionPolicy({ ...valid, retentionDays: 0 })).toThrow(StorageError)
  })

  it('throws for empty legalBasis', () => {
    expect(() => validateRetentionPolicy({ ...valid, legalBasis: [] })).toThrow(StorageError)
  })
})

describe('validateAttachmentReference', () => {
  const valid = {
    objectId: 'obj-1',
    moduleType: 'CONTRACT',
    moduleId: 'c-1',
    filename: 'doc.pdf',
    mimeType: 'application/pdf',
    documentType: 'CONTRACT' as const,
    uploadedBy: 'user-1',
  }

  it('does not throw for valid reference', () => {
    expect(() => validateAttachmentReference(valid)).not.toThrow()
  })

  it('throws for missing objectId', () => {
    expect(() => validateAttachmentReference({ ...valid, objectId: '' })).toThrow(StorageError)
  })

  it('throws for missing moduleType', () => {
    expect(() => validateAttachmentReference({ ...valid, moduleType: '' })).toThrow(StorageError)
  })

  it('throws for missing moduleId', () => {
    expect(() => validateAttachmentReference({ ...valid, moduleId: '' })).toThrow(StorageError)
  })

  it('throws for disallowed MIME type', () => {
    expect(() => validateAttachmentReference({ ...valid, mimeType: 'text/html' })).toThrow(StorageError)
  })

  it('throws for invalid document type', () => {
    expect(() => validateAttachmentReference({ ...valid, documentType: 'INVALID' as never })).toThrow(StorageError)
  })
})

describe('validateFilename', () => {
  it('does not throw for valid filename', () => {
    expect(() => validateFilename('document.pdf')).not.toThrow()
    expect(() => validateFilename('my-report_2024.xlsx')).not.toThrow()
  })

  it('throws for empty filename', () => {
    expect(() => validateFilename('')).toThrow(StorageError)
    expect(() => validateFilename('   ')).toThrow(StorageError)
  })

  it('throws for filename with no valid characters', () => {
    expect(() => validateFilename('!!!')).toThrow(StorageError)
  })
})
