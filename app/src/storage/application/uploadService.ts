import type { AuthContext } from '../../auth/index.ts'
import type { StorageProviders, InitiateUploadParams, AppendChunkParams, CompleteUploadParams } from '../types/providerTypes.ts'
import type { UploadSession } from '../types/storageTypes.ts'
import { StorageError, MAX_CHUNK_SIZE_BYTES } from '../types/storageTypes.ts'
import type { StorageRepositories } from '../infrastructure/storageRepositories.ts'
import type { StorageAuditEvent } from '../types/auditTypes.ts'
import { computeChecksumHex } from '../domain/checksum.ts'
import { validateInitiateUploadParams, validateUploadSessionActive } from '../validation/storageValidation.ts'
import { buildUploadSession } from './storageFactory.ts'

// Chunk buffer: accumulate chunks in memory until complete upload is assembled
// ponytail: Map-based in-memory buffer; streaming buffer deferred to Phase M

interface ChunkEntry {
  chunkNumber: number
  data: Uint8Array
}

class ChunkBuffer {
  private readonly chunks = new Map<string, ChunkEntry[]>() // sessionId → chunks

  add(sessionId: string, entry: ChunkEntry): void {
    const list = this.chunks.get(sessionId) ?? []
    list.push(entry)
    this.chunks.set(sessionId, list)
  }

  assemble(sessionId: string): Uint8Array {
    const list = (this.chunks.get(sessionId) ?? []).sort((a, b) => a.chunkNumber - b.chunkNumber)
    const total = list.reduce((sum, c) => sum + c.data.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of list) { out.set(c.data, offset); offset += c.data.length }
    return out
  }

  clear(sessionId: string): void { this.chunks.delete(sessionId) }
}

// ── UploadService ─────────────────────────────────────────────────────────────

export class UploadService {
  private readonly buffer = new ChunkBuffer()

  constructor(
    private readonly providers: StorageProviders,
    private readonly repos: StorageRepositories,
  ) {}

  // ── Initiate ────────────────────────────────────────────────────────────────

  async initiateUpload(params: InitiateUploadParams): Promise<UploadSession> {
    validateInitiateUploadParams(params)

    const sessionParams = buildUploadSession({
      objectKey: params.objectKey,
      documentType: params.documentType,
      uploadedBy: params.uploadedBy,
      checksumAlgorithm: params.checksumAlgorithm,
      expectedSizeBytes: params.expectedSizeBytes,
      expectedChecksum: params.expectedChecksum,
      totalChunks: params.totalChunks,
      metadata: params.metadata,
    })

    const session = await this.repos.uploadSessions.create(sessionParams)
    return session
  }

  // ── Append chunk ─────────────────────────────────────────────────────────────

  async appendChunk(params: AppendChunkParams): Promise<UploadSession> {
    const session = await this.repos.uploadSessions.findById(params.uploadSessionId)
    if (!session) throw new StorageError('UPLOAD_SESSION_NOT_FOUND', 'uploadSessionId', `Session not found: ${params.uploadSessionId}`)

    validateUploadSessionActive(session)

    if (BigInt(params.data.length) > MAX_CHUNK_SIZE_BYTES) {
      throw new StorageError('FILE_TOO_LARGE', 'data', `Chunk exceeds maximum size of ${MAX_CHUNK_SIZE_BYTES} bytes`)
    }

    // Validate chunk checksum if provided
    if (params.chunkChecksum && params.chunkChecksumAlgorithm && params.chunkChecksumAlgorithm !== 'MD5') {
      const computed = await computeChecksumHex(params.data, params.chunkChecksumAlgorithm)
      if (computed !== params.chunkChecksum.toLowerCase()) {
        throw new StorageError('CHECKSUM_MISMATCH', 'chunkChecksum', `Chunk checksum mismatch for chunk ${params.chunkNumber}`)
      }
    }

    this.buffer.add(params.uploadSessionId, { chunkNumber: params.chunkNumber, data: params.data })

    const updated = await this.repos.uploadSessions.incrementChunkCount(params.uploadSessionId)
    return await this.repos.uploadSessions.markStatus(updated.id, 'IN_PROGRESS')
  }

  // ── Complete ─────────────────────────────────────────────────────────────────

  async completeUpload(
    params: CompleteUploadParams,
    auth: AuthContext,
  ): Promise<{ session: UploadSession; assembled: Uint8Array }> {
    const session = await this.repos.uploadSessions.findById(params.uploadSessionId)
    if (!session) throw new StorageError('UPLOAD_SESSION_NOT_FOUND', 'uploadSessionId', `Session not found: ${params.uploadSessionId}`)

    validateUploadSessionActive(session)

    const assembled = this.buffer.assemble(params.uploadSessionId)

    // Verify final checksum
    if (params.finalChecksumAlgorithm !== 'MD5') {
      const computed = await computeChecksumHex(assembled, params.finalChecksumAlgorithm)
      if (computed !== params.finalChecksum.toLowerCase()) {
        await this.repos.uploadSessions.markStatus(params.uploadSessionId, 'ABORTED')
        this.buffer.clear(params.uploadSessionId)
        throw new StorageError('CHECKSUM_MISMATCH', 'finalChecksum', `Final checksum mismatch: expected ${params.finalChecksum}, got ${computed}`)
      }
    }

    // If multipart provider supports native MPU, delegate; else we assembled ourselves
    if (this.providers.multipart) {
      const result = await this.providers.multipart.initiateMultipart(session.objectKey, {})
      // assemble via native parts — we treat assembled as a single part here
      const etag = await this.providers.multipart.uploadPart(result.uploadId, session.objectKey, 1, assembled)
      await this.providers.multipart.completeMultipart(result.uploadId, session.objectKey, [{ partNumber: 1, etag }])
    } else {
      await this.providers.primary.putObject(session.objectKey, assembled, {
        checksum: params.finalChecksum,
        checksumAlgorithm: params.finalChecksumAlgorithm,
      })
    }

    this.buffer.clear(params.uploadSessionId)
    const completed = await this.repos.uploadSessions.markStatus(params.uploadSessionId, 'COMPLETED')

    await this.repos.auditEvents.append({
      eventType: 'UPLOAD_COMPLETED',
      objectKey: session.objectKey,
      userId: auth.userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { sessionId: session.id, chunks: String(session.uploadedChunks) },
    } as Omit<StorageAuditEvent, 'id' | 'createdAt'>)

    return { session: completed, assembled }
  }

  // ── Abort ────────────────────────────────────────────────────────────────────

  async abortUpload(uploadSessionId: string, auth: AuthContext): Promise<UploadSession> {
    const session = await this.repos.uploadSessions.findById(uploadSessionId)
    if (!session) throw new StorageError('UPLOAD_SESSION_NOT_FOUND', 'uploadSessionId', `Session not found: ${uploadSessionId}`)

    if (session.status === 'COMPLETED') {
      throw new StorageError('UPLOAD_SESSION_COMPLETED', 'uploadSessionId', 'Cannot abort a completed upload session')
    }
    if (session.status === 'ABORTED') {
      return session // idempotent
    }

    this.buffer.clear(uploadSessionId)

    if (this.providers.multipart) {
      // Best-effort abort of any native MPU (we don't track native uploadId in this phase)
    }

    const aborted = await this.repos.uploadSessions.markStatus(uploadSessionId, 'ABORTED')

    await this.repos.auditEvents.append({
      eventType: 'UPLOAD_ABORTED',
      objectKey: session.objectKey,
      userId: auth.userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { sessionId: session.id },
    } as Omit<StorageAuditEvent, 'id' | 'createdAt'>)

    return aborted
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  async getUploadStatus(uploadSessionId: string): Promise<UploadSession | null> {
    return this.repos.uploadSessions.findById(uploadSessionId)
  }

  // ── Cleanup expired ──────────────────────────────────────────────────────────

  async cleanupExpiredSessions(asOf: string): Promise<number> {
    const expired = await this.repos.uploadSessions.findExpiredSessions(asOf)
    for (const s of expired) {
      this.buffer.clear(s.id)
      await this.repos.uploadSessions.markStatus(s.id, 'ABORTED')
    }
    return expired.length
  }
}
