import { describe, it, expect, beforeEach } from 'vitest'
import { UploadService } from '../storage/application/uploadService.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'
import { MockStorageProvider } from '../storage/infrastructure/providers/mockStorageProvider.ts'
import { StorageError } from '../storage/types/storageTypes.ts'
import type { AuthContext } from '../auth/index.ts'

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
})

const bytes = (s: string) => new TextEncoder().encode(s)
let service: UploadService
let provider: MockStorageProvider

beforeEach(() => {
  provider = new MockStorageProvider()
  service = new UploadService({ primary: provider }, buildMemoryStorageRepositories())
})

describe('initiateUpload', () => {
  it('creates upload session with INITIATED status', async () => {
    const session = await service.initiateUpload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      documentType: 'CONTRACT',
      uploadedBy: 'user-1',
    })
    expect(session.id).toBeTruthy()
    expect(session.status).toBe('INITIATED')
    expect(session.uploadedChunks).toBe(0)
  })

  it('sets checksumAlgorithm to SHA256 by default', async () => {
    const session = await service.initiateUpload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      documentType: 'CONTRACT',
      uploadedBy: 'user-1',
    })
    expect(session.checksumAlgorithm).toBe('SHA256')
  })

  it('stores custom metadata', async () => {
    const session = await service.initiateUpload({
      objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
      documentType: 'CONTRACT',
      uploadedBy: 'user-1',
      totalChunks: 5,
      expectedSizeBytes: 50n * 1024n * 1024n,
      metadata: { source: 'web-upload' },
    })
    expect(session.totalChunks).toBe(5)
    expect(session.metadata.source).toBe('web-upload')
  })

  it('throws for invalid objectKey', async () => {
    await expect(service.initiateUpload({
      objectKey: '../secret',
      documentType: 'CONTRACT',
      uploadedBy: 'user-1',
    })).rejects.toThrow(StorageError)
  })

  it('throws for invalid document type', async () => {
    await expect(service.initiateUpload({
      objectKey: 'k/file.pdf',
      documentType: 'INVALID' as never,
      uploadedBy: 'user-1',
    })).rejects.toThrow(StorageError)
  })

  it('throws for missing uploadedBy', async () => {
    await expect(service.initiateUpload({
      objectKey: 'k/file.pdf',
      documentType: 'CONTRACT',
      uploadedBy: '',
    })).rejects.toThrow(StorageError)
  })
})

describe('appendChunk', () => {
  it('increments uploadedChunks and sets status to IN_PROGRESS', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/f.pdf',
      documentType: 'CONTRACT',
      uploadedBy: 'user-1',
    })
    const updated = await service.appendChunk({
      uploadSessionId: session.id,
      chunkNumber: 1,
      data: bytes('chunk1'),
    })
    expect(updated.uploadedChunks).toBe(1)
    expect(updated.status).toBe('IN_PROGRESS')
  })

  it('throws for unknown session id', async () => {
    await expect(service.appendChunk({
      uploadSessionId: 'no-such',
      chunkNumber: 1,
      data: bytes('data'),
    })).rejects.toThrow(StorageError)
  })

  it('throws for aborted session', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/f.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.abortUpload(session.id, auth)
    await expect(service.appendChunk({
      uploadSessionId: session.id,
      chunkNumber: 1,
      data: bytes('data'),
    })).rejects.toThrow(StorageError)
  })

  it('throws for completed session', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/f.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.appendChunk({ uploadSessionId: session.id, chunkNumber: 1, data: bytes('part1') })
    const checksum = await computeSHA256(bytes('part1'))
    await service.completeUpload({
      uploadSessionId: session.id,
      finalChecksum: checksum,
      finalChecksumAlgorithm: 'SHA256',
    }, auth)
    await expect(service.appendChunk({
      uploadSessionId: session.id,
      chunkNumber: 2,
      data: bytes('more'),
    })).rejects.toThrow(StorageError)
  })
})

describe('completeUpload', () => {
  it('assembles chunks and marks session COMPLETED', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/complete.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.appendChunk({ uploadSessionId: session.id, chunkNumber: 1, data: bytes('hello ') })
    await service.appendChunk({ uploadSessionId: session.id, chunkNumber: 2, data: bytes('world') })

    const assembled = new TextEncoder().encode('hello world')
    const checksum = await computeSHA256(assembled)

    const result = await service.completeUpload({
      uploadSessionId: session.id,
      finalChecksum: checksum,
      finalChecksumAlgorithm: 'SHA256',
    }, auth)

    expect(result.session.status).toBe('COMPLETED')
    expect(provider.has('k/complete.pdf')).toBe(true)
  })

  it('aborts and throws on checksum mismatch', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/mismatch.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.appendChunk({ uploadSessionId: session.id, chunkNumber: 1, data: bytes('content') })

    await expect(service.completeUpload({
      uploadSessionId: session.id,
      finalChecksum: 'a'.repeat(64),  // wrong checksum
      finalChecksumAlgorithm: 'SHA256',
    }, auth)).rejects.toThrow(StorageError)

    const status = await service.getUploadStatus(session.id)
    expect(status?.status).toBe('ABORTED')
  })
})

describe('abortUpload', () => {
  it('marks session as ABORTED', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/abort.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    const aborted = await service.abortUpload(session.id, auth)
    expect(aborted.status).toBe('ABORTED')
  })

  it('is idempotent for already-aborted session', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/abort.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.abortUpload(session.id, auth)
    const result = await service.abortUpload(session.id, auth)
    expect(result.status).toBe('ABORTED')
  })

  it('throws for completed session abort', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/complete.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    await service.appendChunk({ uploadSessionId: session.id, chunkNumber: 1, data: bytes('data') })
    const checksum = await computeSHA256(bytes('data'))
    await service.completeUpload({ uploadSessionId: session.id, finalChecksum: checksum, finalChecksumAlgorithm: 'SHA256' }, auth)
    await expect(service.abortUpload(session.id, auth)).rejects.toThrow(StorageError)
  })

  it('throws for unknown session', async () => {
    await expect(service.abortUpload('no-such', auth)).rejects.toThrow(StorageError)
  })
})

describe('getUploadStatus', () => {
  it('returns session by id', async () => {
    const session = await service.initiateUpload({
      objectKey: 'k/status.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1',
    })
    const found = await service.getUploadStatus(session.id)
    expect(found?.id).toBe(session.id)
  })

  it('returns null for unknown session', async () => {
    expect(await service.getUploadStatus('no-such')).toBeNull()
  })
})

describe('cleanupExpiredSessions', () => {
  it('returns 0 when no sessions are expired', async () => {
    await service.initiateUpload({ objectKey: 'k/f.pdf', documentType: 'CONTRACT', uploadedBy: 'user-1' })
    const count = await service.cleanupExpiredSessions(new Date().toISOString())
    expect(count).toBe(0)
  })
})

// ── Helper ────────────────────────────────────────────────────────────────────

async function computeSHA256(data: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
