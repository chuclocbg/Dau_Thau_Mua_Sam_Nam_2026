import { describe, it, expect } from 'vitest'
import {
  buildObjectKey, buildVersionKey, sanitizeFilename,
  isAllowedMimeType, isValidDocumentType, validateAttachmentMetadata,
  filterActiveAttachments, groupAttachmentsByType, classifyDocumentByMime,
} from '../storage/domain/attachment.ts'
import { StorageError } from '../storage/types/storageTypes.ts'
import type { AttachmentReference } from '../storage/types/storageTypes.ts'

const baseRef = (overrides: Partial<AttachmentReference> = {}): AttachmentReference => ({
  id: 'ref-1',
  objectId: 'obj-1',
  moduleType: 'CONTRACT',
  moduleId: 'c-1',
  documentType: 'CONTRACT',
  filename: 'contract.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024n,
  checksum: 'a'.repeat(64),
  versionId: 'v-1',
  uploadedBy: 'user-1',
  uploadedAt: '2024-01-01T00:00:00Z',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('buildObjectKey', () => {
  it('builds a structured key from parts', () => {
    const key = buildObjectKey('CONTRACT', 'c-1', 'CONTRACT', 'contract.pdf', '2024-01-15T10:00:00Z')
    expect(key).toBe('contract/c-1/contract/2024-01-15/contract.pdf')
  })

  it('sanitizes the filename (collapses consecutive underscores)', () => {
    const key = buildObjectKey('PACKAGE', 'p-1', 'GENERAL', 'my file (v2).pdf', '2024-03-01T00:00:00Z')
    expect(key).toContain('my_file_v2_.pdf')
  })

  it('lowercases module type and document type', () => {
    const key = buildObjectKey('PAYMENT', 'pay-1', 'INVOICE', 'invoice.pdf', '2024-06-01T00:00:00Z')
    expect(key.startsWith('payment/')).toBe(true)
    expect(key).toContain('/invoice/')
  })
})

describe('buildVersionKey', () => {
  it('appends /vN to base key', () => {
    expect(buildVersionKey('contract/c-1/contract/2024-01-15/file.pdf', 1)).toBe('contract/c-1/contract/2024-01-15/file.pdf/v1')
    expect(buildVersionKey('contract/c-1/contract/2024-01-15/file.pdf', 3)).toBe('contract/c-1/contract/2024-01-15/file.pdf/v3')
  })
})

describe('sanitizeFilename', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('my file.pdf')).toBe('my_file.pdf')
  })

  it('replaces special characters', () => {
    const result = sanitizeFilename('file (1).pdf')
    expect(result).not.toContain('(')
    expect(result).not.toContain(')')
    expect(result).not.toContain(' ')
  })

  it('collapses consecutive underscores', () => {
    const result = sanitizeFilename('file  name.pdf')
    expect(result).not.toContain('__')
  })

  it('truncates to 200 characters', () => {
    const long = 'a'.repeat(300) + '.pdf'
    expect(sanitizeFilename(long)).toHaveLength(200)
  })

  it('preserves valid characters', () => {
    expect(sanitizeFilename('valid-file_name.pdf')).toBe('valid-file_name.pdf')
  })
})

describe('isAllowedMimeType', () => {
  it('returns true for allowed types', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true)
    expect(isAllowedMimeType('image/png')).toBe(true)
    expect(isAllowedMimeType('text/plain')).toBe(true)
  })

  it('returns false for disallowed types', () => {
    expect(isAllowedMimeType('application/x-executable')).toBe(false)
    expect(isAllowedMimeType('text/html')).toBe(false)
    expect(isAllowedMimeType('')).toBe(false)
  })
})

describe('isValidDocumentType', () => {
  it('returns true for valid document types', () => {
    expect(isValidDocumentType('CONTRACT')).toBe(true)
    expect(isValidDocumentType('INVOICE')).toBe(true)
    expect(isValidDocumentType('GENERAL')).toBe(true)
  })

  it('returns false for invalid document types', () => {
    expect(isValidDocumentType('UNKNOWN')).toBe(false)
    expect(isValidDocumentType('')).toBe(false)
  })
})

describe('validateAttachmentMetadata', () => {
  const valid = {
    filename: 'doc.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024n,
    documentType: 'CONTRACT',
  }

  it('does not throw for valid params', () => {
    expect(() => validateAttachmentMetadata(valid)).not.toThrow()
  })

  it('throws for empty filename', () => {
    expect(() => validateAttachmentMetadata({ ...valid, filename: '' })).toThrow(StorageError)
    expect(() => validateAttachmentMetadata({ ...valid, filename: '   ' })).toThrow(StorageError)
  })

  it('throws for disallowed MIME type', () => {
    expect(() => validateAttachmentMetadata({ ...valid, mimeType: 'application/x-virus' })).toThrow(StorageError)
  })

  it('throws for zero-byte file', () => {
    expect(() => validateAttachmentMetadata({ ...valid, sizeBytes: 0n })).toThrow(StorageError)
  })

  it('throws for file exceeding max size', () => {
    expect(() => validateAttachmentMetadata({ ...valid, sizeBytes: 501n * 1024n * 1024n })).toThrow(StorageError)
  })

  it('throws for invalid document type', () => {
    expect(() => validateAttachmentMetadata({ ...valid, documentType: 'INVALID' })).toThrow(StorageError)
  })
})

describe('filterActiveAttachments', () => {
  it('returns only active references', () => {
    const refs = [
      baseRef({ id: 'r1', isActive: true }),
      baseRef({ id: 'r2', isActive: false }),
      baseRef({ id: 'r3', isActive: true }),
    ]
    const result = filterActiveAttachments(refs)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.isActive)).toBe(true)
  })

  it('returns empty for all-inactive', () => {
    expect(filterActiveAttachments([baseRef({ isActive: false })])).toHaveLength(0)
  })
})

describe('groupAttachmentsByType', () => {
  it('groups references by documentType', () => {
    const refs = [
      baseRef({ id: 'r1', documentType: 'CONTRACT' }),
      baseRef({ id: 'r2', documentType: 'INVOICE' }),
      baseRef({ id: 'r3', documentType: 'CONTRACT' }),
    ]
    const map = groupAttachmentsByType(refs)
    expect(map.get('CONTRACT')).toHaveLength(2)
    expect(map.get('INVOICE')).toHaveLength(1)
  })
})

describe('classifyDocumentByMime', () => {
  it('classifies PDF as LEGAL_DOCUMENT', () => {
    expect(classifyDocumentByMime('application/pdf')).toBe('LEGAL_DOCUMENT')
  })

  it('classifies xlsx as PAYMENT_EVIDENCE', () => {
    expect(classifyDocumentByMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('PAYMENT_EVIDENCE')
  })

  it('returns GENERAL for unknown MIME type', () => {
    expect(classifyDocumentByMime('application/x-unknown')).toBe('GENERAL')
    expect(classifyDocumentByMime('image/png')).toBe('GENERAL')
  })
})
