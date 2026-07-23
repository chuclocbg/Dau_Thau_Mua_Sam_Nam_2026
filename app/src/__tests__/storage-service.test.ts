import { describe, it, expect, beforeEach } from 'vitest'
import { StorageService } from '../storage/application/storageService.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'
import { MockStorageProvider } from '../storage/infrastructure/providers/mockStorageProvider.ts'
import { StorageError } from '../storage/types/storageTypes.ts'
import type { AuthContext } from '../auth/index.ts'
import type { BuildObjectMetadataParams } from '../storage/application/storageFactory.ts'

const auth: AuthContext = Object.freeze({
  userId: 'user-1',
  sessionId: 'sess-1',
  providerId: 'local',
  roles: [],
  effectivePermissions: [],
  delegations: [],
  approvalHierarchies: [],
  issuedAt: '2024-01-01T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  username: 'user-1',
  email: 'user-1@example.com',
  displayName: 'Test User',
  departmentId: 'dept-1',
  activeDelegations: [],
  metadata: {},
})

const bytes = (s: string) => new TextEncoder().encode(s)

const metaParams = (overrides: Partial<BuildObjectMetadataParams> = {}): BuildObjectMetadataParams => ({
  objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
  filename: 'doc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024n,
  checksum: 'a'.repeat(64),
  checksumAlgorithm: 'MD5', // MD5 accepted as pre-computed
  documentType: 'CONTRACT',
  uploadedBy: 'user-1',
  uploadedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

let provider: MockStorageProvider
let service: StorageService

beforeEach(() => {
  provider = new MockStorageProvider()
  service = new StorageService({ primary: provider }, buildMemoryStorageRepositories())
})

describe('upload', () => {
  it('stores file and returns attachment reference', async () => {
    const data = bytes('contract content')
    const ref = await service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data,
      metadata: metaParams({ sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    expect(ref.id).toBeTruthy()
    expect(ref.moduleType).toBe('CONTRACT')
    expect(ref.moduleId).toBe('c-1')
    expect(ref.isActive).toBe(true)
    expect(provider.has('contract/c-1/contract/2024-01-01/doc.pdf')).toBe(true)
  })

  it('throws for empty file', async () => {
    await expect(service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data: new Uint8Array(0),
      metadata: metaParams({ sizeBytes: 0n }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })).rejects.toThrow(StorageError)
  })

  it('throws for file exceeding max size', async () => {
    const bigData = new Uint8Array(1)
    await expect(service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data: bigData,
      metadata: metaParams({ sizeBytes: 501n * 1024n * 1024n }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })).rejects.toThrow(StorageError)
  })

  it('throws for invalid object key', async () => {
    const data = bytes('content')
    await expect(service.upload({
      objectKey: 'path/../secret',
      data,
      metadata: metaParams({ objectKey: 'path/../secret', sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })).rejects.toThrow(StorageError)
  })

  it('throws for infected file when virus scanner provided', async () => {
    const scanProvider = {
      providerId: 'mock-scan',
      scan: async () => ({ objectKey: '', status: 'INFECTED' as const, threatName: 'EICAR', metadata: {} }),
      queueScan: async (_k: string) => ({ objectKey: _k, status: 'PENDING' as const, metadata: {} }),
      supportsAsync: () => true,
    }
    const infectedService = new StorageService(
      { primary: provider, virusScan: scanProvider },
      buildMemoryStorageRepositories(),
    )
    const data = bytes('infected content')
    await expect(infectedService.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data,
      metadata: metaParams({ sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })).rejects.toThrow(StorageError)
  })
})

describe('download', () => {
  it('returns data and reference for uploaded object', async () => {
    const data = bytes('download me')
    const ref = await service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data,
      metadata: metaParams({ sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    const result = await service.download({ objectId: ref.objectId, auth })
    expect(result).not.toBeNull()
    expect(new TextDecoder().decode(result!.data)).toBe('download me')
  })

  it('returns null for non-existent objectId', async () => {
    const result = await service.download({ objectId: 'non-existent', auth })
    expect(result).toBeNull()
  })
})

describe('delete', () => {
  it('deactivates the attachment reference', async () => {
    const data = bytes('to delete')
    const ref = await service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data,
      metadata: metaParams({ sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    // Can only delete GENERAL content that's past retention (10 years CONTRACT retention blocks this)
    // Use GENERAL doc type which has 1-year default retention
    const genRef = await service.upload({
      objectKey: 'contract/c-1/general/2024-01-01/notes.pdf',
      data: bytes('general'),
      metadata: metaParams({
        objectKey: 'contract/c-1/general/2024-01-01/notes.pdf',
        documentType: 'GENERAL',
        sizeBytes: 7n,
        uploadedAt: '2010-01-01T00:00:00Z',
      }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    await service.delete({ objectId: genRef.objectId, auth })
    // After deletion, download should return null
    const result = await service.download({ objectId: genRef.objectId, auth })
    expect(result).toBeNull()
  })

  it('throws for non-existent objectId', async () => {
    await expect(service.delete({ objectId: 'no-such-id', auth })).rejects.toThrow(StorageError)
  })
})

describe('getMetadata', () => {
  it('returns stored object after upload', async () => {
    const data = bytes('metadata test')
    const ref = await service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      data,
      metadata: metaParams({ sizeBytes: BigInt(data.length) }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    const obj = await service.getMetadata(ref.objectId)
    expect(obj).not.toBeNull()
    expect(obj!.id).toBe(ref.objectId)
  })

  it('returns null for non-existent objectId', async () => {
    expect(await service.getMetadata('no-such')).toBeNull()
  })
})

describe('listByModule', () => {
  it('returns active refs for module', async () => {
    const data = bytes('x')
    await service.upload({
      objectKey: 'contract/c-1/contract/2024-01-01/a.pdf',
      data,
      metadata: metaParams({ objectKey: 'contract/c-1/contract/2024-01-01/a.pdf', sizeBytes: 1n }),
      moduleType: 'CONTRACT',
      moduleId: 'c-1',
      auth,
    })
    await service.upload({
      objectKey: 'contract/c-2/contract/2024-01-01/b.pdf',
      data,
      metadata: metaParams({ objectKey: 'contract/c-2/contract/2024-01-01/b.pdf', sizeBytes: 1n }),
      moduleType: 'CONTRACT',
      moduleId: 'c-2',
      auth,
    })
    const refs = await service.listByModule('CONTRACT', 'c-1')
    expect(refs).toHaveLength(1)
    expect(refs[0].moduleId).toBe('c-1')
  })
})

describe('generateSignedUrl', () => {
  it('returns a signed URL', async () => {
    const url = await service.generateSignedUrl({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      expiresInSeconds: 3600,
      operation: 'GET',
      auth,
    })
    expect(url.url).toBeTruthy()
    expect(url.operation).toBe('GET')
  })
})

describe('list', () => {
  it('returns objects from provider', async () => {
    await provider.putObject('prefix/a', new Uint8Array([1]), {})
    await provider.putObject('prefix/b', new Uint8Array([2]), {})
    const result = await service.list('prefix/')
    expect(result.entries).toHaveLength(2)
  })
})
