import { describe, it, expect } from 'vitest'
import {
  resolveAttachmentReference, resolveAttachmentsForModule,
} from '../storage/integration/storageIntegration.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'
import type { AttachmentReference } from '../storage/types/storageTypes.ts'

const ref = (overrides: Partial<Omit<AttachmentReference, 'id' | 'createdAt' | 'updatedAt'>> = {}) => ({
  objectId: 'obj-1',
  moduleType: 'CONTRACT',
  moduleId: 'c-1',
  documentType: 'CONTRACT' as const,
  filename: 'doc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024n,
  checksum: 'a'.repeat(64),
  versionId: 'v-1',
  uploadedBy: 'user-1',
  uploadedAt: '2024-01-01T00:00:00Z',
  isActive: true,
  ...overrides,
})

describe('resolveAttachmentReference', () => {
  it('returns the attachment reference by id', async () => {
    const repos = buildMemoryStorageRepositories()
    const created = await repos.attachmentReferences.create(ref())

    const found = await resolveAttachmentReference(created.id, repos)
    expect(found?.id).toBe(created.id)
    expect(found?.moduleType).toBe('CONTRACT')
  })

  it('returns null for unknown id', async () => {
    const repos = buildMemoryStorageRepositories()
    const result = await resolveAttachmentReference('no-such-id', repos)
    expect(result).toBeNull()
  })
})

describe('resolveAttachmentsForModule', () => {
  it('returns active references for the module entity', async () => {
    const repos = buildMemoryStorageRepositories()
    await repos.attachmentReferences.create(ref({ moduleType: 'CONTRACT', moduleId: 'c-1', isActive: true }))
    await repos.attachmentReferences.create(ref({ moduleType: 'CONTRACT', moduleId: 'c-1', isActive: false }))
    await repos.attachmentReferences.create(ref({ moduleType: 'CONTRACT', moduleId: 'c-2', isActive: true }))

    const result = await resolveAttachmentsForModule('CONTRACT', 'c-1', repos)
    expect(result).toHaveLength(1)
    expect(result[0].moduleId).toBe('c-1')
    expect(result[0].isActive).toBe(true)
  })

  it('returns empty array when no refs found', async () => {
    const repos = buildMemoryStorageRepositories()
    const result = await resolveAttachmentsForModule('PAYMENT', 'pay-99', repos)
    expect(result).toHaveLength(0)
  })

  it('cross-module isolation — refs for different module types do not mix', async () => {
    const repos = buildMemoryStorageRepositories()
    await repos.attachmentReferences.create(ref({ moduleType: 'CONTRACT', moduleId: 'x' }))
    await repos.attachmentReferences.create(ref({ moduleType: 'PAYMENT', moduleId: 'x' }))

    const contracts = await resolveAttachmentsForModule('CONTRACT', 'x', repos)
    const payments = await resolveAttachmentsForModule('PAYMENT', 'x', repos)
    expect(contracts).toHaveLength(1)
    expect(payments).toHaveLength(1)
    expect(contracts[0].moduleType).toBe('CONTRACT')
    expect(payments[0].moduleType).toBe('PAYMENT')
  })
})
