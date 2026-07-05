import type { AuthContext } from '../../auth/index.ts'
import type { IStorageProvider, StorageProviders } from '../types/providerTypes.ts'
import type {
  ObjectMetadata, AttachmentReference, StoredObject, StorageVersion,
  SignedUrl, VirusScanResult, ListOptions, ObjectListing,
} from '../types/storageTypes.ts'
import { StorageError, MAX_FILE_SIZE_BYTES, MIN_FILE_SIZE_BYTES } from '../types/storageTypes.ts'
import type { StorageRepositories } from '../infrastructure/storageRepositories.ts'
import type { StorageAuditEvent } from '../types/auditTypes.ts'
import { computeChecksumHex, validateChecksum } from '../domain/checksum.ts'
import { canDelete, hasActiveLegalHold } from '../domain/retention.ts'
import { validateObjectKey } from '../validation/storageValidation.ts'
import { validateAttachmentMetadata } from '../domain/attachment.ts'
import type { BuildObjectMetadataParams } from './storageFactory.ts'
import { buildObjectMetadata, buildAttachmentReference } from './storageFactory.ts'

// ── Service params ────────────────────────────────────────────────────────────

export interface UploadObjectParams {
  readonly objectKey: string
  readonly data: Uint8Array
  readonly metadata: BuildObjectMetadataParams
  readonly moduleType: string
  readonly moduleId: string
  readonly auth: AuthContext
}

export interface DownloadObjectParams {
  readonly objectId: string
  readonly auth: AuthContext
}

export interface DeleteObjectParams {
  readonly objectId: string
  readonly auth: AuthContext
}

export interface GetSignedUrlParams {
  readonly objectKey: string
  readonly expiresInSeconds: number
  readonly operation: 'GET' | 'PUT'
  readonly auth: AuthContext
}

// ── In-memory object store (versioned) ───────────────────────────────────────
// ponytail: stored objects + versions live in Maps; persistent storage deferred to Phase M

class MemoryObjectStore {
  private readonly objects = new Map<string, StoredObject>()
  private readonly versions = new Map<string, StorageVersion>()
  private readonly objectsByKey = new Map<string, string>()        // objectKey → objectId
  private readonly versionsByObject = new Map<string, string[]>()  // objectId → versionId[]

  put(meta: ObjectMetadata, data: Uint8Array, createdBy: string): StoredObject {
    void data // data delegated to IStorageProvider
    const id = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const now = new Date().toISOString()

    const version: StorageVersion = {
      id: versionId,
      objectId: id,
      versionNumber: 1,
      objectKey: meta.objectKey,
      checksum: meta.checksum,
      sizeBytes: meta.sizeBytes,
      createdBy,
      createdAt: now,
      isDeleted: false,
    }
    this.versions.set(versionId, version)

    const obj: StoredObject = {
      id,
      metadata: meta,
      versionId,
      versionNumber: 1,
      isCurrentVersion: true,
      createdAt: now,
    }
    this.objects.set(id, obj)
    this.objectsByKey.set(meta.objectKey, id)
    this.versionsByObject.set(id, [versionId])
    return obj
  }

  addVersion(objectId: string, meta: ObjectMetadata, createdBy: string): StorageVersion {
    const existing = this.objects.get(objectId)
    if (!existing) throw new StorageError('OBJECT_NOT_FOUND', 'objectId', `Object not found: ${objectId}`)

    const versionId = crypto.randomUUID()
    const now = new Date().toISOString()
    const versionList = this.versionsByObject.get(objectId) ?? []
    const nextNum = versionList.length + 1

    const version: StorageVersion = {
      id: versionId,
      objectId,
      versionNumber: nextNum,
      objectKey: meta.objectKey,
      checksum: meta.checksum,
      sizeBytes: meta.sizeBytes,
      createdBy,
      createdAt: now,
      isDeleted: false,
    }
    this.versions.set(versionId, version)

    const updated: StoredObject = {
      ...existing,
      metadata: meta,
      versionId,
      versionNumber: nextNum,
    }
    this.objects.set(objectId, updated)
    this.objectsByKey.set(meta.objectKey, objectId)
    versionList.push(versionId)
    this.versionsByObject.set(objectId, versionList)
    return version
  }

  getById(objectId: string): StoredObject | null { return this.objects.get(objectId) ?? null }
  getByKey(objectKey: string): StoredObject | null {
    const id = this.objectsByKey.get(objectKey)
    return id ? (this.objects.get(id) ?? null) : null
  }
  getVersion(versionId: string): StorageVersion | null { return this.versions.get(versionId) ?? null }
  listVersions(objectId: string): StorageVersion[] {
    const ids = this.versionsByObject.get(objectId) ?? []
    return ids.map(id => this.versions.get(id)).filter((v): v is StorageVersion => v !== undefined)
  }
  softDelete(objectId: string): void { this.objects.delete(objectId) }
}

// ── StorageService ────────────────────────────────────────────────────────────

export class StorageService {
  private readonly objectStore = new MemoryObjectStore()

  constructor(
    private readonly providers: StorageProviders,
    private readonly repos: StorageRepositories,
  ) {}

  // ── Upload ──────────────────────────────────────────────────────────────────

  async upload(params: UploadObjectParams): Promise<AttachmentReference> {
    const { data, moduleType, moduleId, auth } = params

    if (data.length === 0 || BigInt(data.length) < MIN_FILE_SIZE_BYTES) {
      throw new StorageError('VALIDATION_FAILED', 'data', 'File must not be empty')
    }
    if (BigInt(data.length) > MAX_FILE_SIZE_BYTES) {
      throw new StorageError('FILE_TOO_LARGE', 'data', `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`)
    }

    validateObjectKey(params.objectKey)

    const meta = buildObjectMetadata(params.metadata)
    validateAttachmentMetadata(meta)

    // Verify checksum
    const computed = await computeChecksumHex(data, meta.checksumAlgorithm === 'MD5' ? 'SHA256' : meta.checksumAlgorithm)
    const providedChecksum = meta.checksumAlgorithm === 'MD5' ? meta.checksum : meta.checksum
    if (meta.checksumAlgorithm !== 'MD5' && !validateChecksum(computed, providedChecksum)) {
      throw new StorageError('CHECKSUM_MISMATCH', 'checksum', `Checksum mismatch: expected ${providedChecksum}, got ${computed}`)
    }

    // Virus scan if available
    if (this.providers.virusScan) {
      const scanResult = await this.providers.virusScan.scan(data, meta.filename)
      if (scanResult.status === 'INFECTED') {
        throw new StorageError('INFECTED_FILE', 'data', `Infected file detected: ${scanResult.threatName ?? 'unknown threat'}`)
      }
    }

    // Store via provider
    await this.providers.primary.putObject(meta.objectKey, data, meta)

    // Track in object store
    const storedObj = this.objectStore.put(meta, data, auth.userId)

    // Create attachment reference
    const refParams = buildAttachmentReference({
      objectId: storedObj.id,
      moduleType,
      moduleId,
      documentType: meta.documentType,
      filename: meta.filename,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      checksum: meta.checksum,
      versionId: storedObj.versionId,
      uploadedBy: auth.userId,
      uploadedAt: meta.uploadedAt,
    })
    const ref = await this.repos.attachmentReferences.create(refParams)

    await this.audit({
      eventType: 'OBJECT_UPLOADED',
      objectKey: meta.objectKey,
      objectId: storedObj.id,
      userId: auth.userId,
      moduleType,
      moduleId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { filename: meta.filename, sizeBytes: String(meta.sizeBytes) },
    })

    return ref
  }

  // ── Download ────────────────────────────────────────────────────────────────

  async download(params: DownloadObjectParams): Promise<{ reference: AttachmentReference; data: Uint8Array } | null> {
    const refs = await this.repos.attachmentReferences.findByObjectId(params.objectId)
    const ref = refs.find(r => r.isActive)
    if (!ref) return null

    const obj = this.objectStore.getById(params.objectId)
    if (!obj) return null

    const result = await this.providers.primary.getObject(obj.metadata.objectKey)
    if (!result) return null

    await this.audit({
      eventType: 'OBJECT_DOWNLOADED',
      objectKey: obj.metadata.objectKey,
      objectId: params.objectId,
      userId: params.auth.userId,
      moduleType: ref.moduleType,
      moduleId: ref.moduleId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: {},
    })

    return { reference: ref, data: result.data }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async delete(params: DeleteObjectParams): Promise<void> {
    const refs = await this.repos.attachmentReferences.findByObjectId(params.objectId)
    const ref = refs.find(r => r.isActive)
    if (!ref) throw new StorageError('OBJECT_NOT_FOUND', 'objectId', `Attachment not found: ${params.objectId}`)

    // Check legal holds on the object
    const holds = await this.repos.legalHolds.findActiveByObjectId(params.objectId)
    if (hasActiveLegalHold(holds)) {
      throw new StorageError('LEGAL_HOLD_ACTIVE', 'objectId', 'Object is under a legal hold and cannot be deleted')
    }

    // Check retention policy
    const policy = await this.repos.retentionPolicies.findByDocumentType(ref.documentType)
    const asOf = new Date().toISOString()
    const { allowed, reason } = canDelete(ref.uploadedAt, ref.documentType, asOf, policy ?? undefined, holds)
    if (!allowed) {
      throw new StorageError('RETENTION_ACTIVE', 'objectId', reason ?? 'Retention policy prevents deletion')
    }

    const obj = this.objectStore.getById(params.objectId)
    if (obj) {
      await this.providers.primary.deleteObject(obj.metadata.objectKey)
      this.objectStore.softDelete(params.objectId)
    }

    await this.repos.attachmentReferences.deactivate(ref.id, params.auth.userId)

    await this.audit({
      eventType: 'OBJECT_DELETED',
      objectKey: obj?.metadata.objectKey ?? '',
      objectId: params.objectId,
      userId: params.auth.userId,
      moduleType: ref.moduleType,
      moduleId: ref.moduleId,
      outcome: 'SUCCESS',
      occurredAt: asOf,
      metadata: {},
    })
  }

  // ── Metadata ────────────────────────────────────────────────────────────────

  async getMetadata(objectId: string): Promise<StoredObject | null> {
    return this.objectStore.getById(objectId)
  }

  // ── Versions ────────────────────────────────────────────────────────────────

  async createVersion(
    objectId: string,
    data: Uint8Array,
    metadata: BuildObjectMetadataParams,
    auth: AuthContext,
  ): Promise<StorageVersion> {
    const meta = buildObjectMetadata(metadata)
    await this.providers.primary.putObject(meta.objectKey, data, meta)
    const version = this.objectStore.addVersion(objectId, meta, auth.userId)

    await this.audit({
      eventType: 'OBJECT_VERSION_CREATED',
      objectKey: meta.objectKey,
      objectId,
      userId: auth.userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { versionNumber: String(version.versionNumber) },
    })

    return version
  }

  listVersions(objectId: string): StorageVersion[] {
    return this.objectStore.listVersions(objectId)
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async list(prefix: string, options?: ListOptions): Promise<ObjectListing> {
    return this.providers.primary.listObjects(prefix, options)
  }

  async listByModule(moduleType: string, moduleId: string): Promise<readonly AttachmentReference[]> {
    return this.repos.attachmentReferences.findActive(moduleType, moduleId)
  }

  // ── Signed URL ──────────────────────────────────────────────────────────────

  async generateSignedUrl(params: GetSignedUrlParams): Promise<SignedUrl> {
    validateObjectKey(params.objectKey)
    const url = await this.providers.primary.generateSignedUrl(
      params.objectKey,
      params.expiresInSeconds,
      params.operation,
    )

    await this.audit({
      eventType: 'SIGNED_URL_GENERATED',
      objectKey: params.objectKey,
      userId: params.auth.userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { operation: params.operation, expiresAt: url.expiresAt },
    })

    return url
  }

  // ── Virus scan result application ───────────────────────────────────────────

  async applyVirusScan(objectKey: string, result: VirusScanResult, scannedBy: string): Promise<void> {
    await this.audit({
      eventType: result.status === 'INFECTED' ? 'SCAN_INFECTED' : 'SCAN_CLEAN',
      objectKey,
      userId: scannedBy,
      outcome: result.status === 'INFECTED' ? 'FAILURE' : 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: {
        status: result.status,
        ...(result.threatName ? { threatName: result.threatName } : {}),
        ...(result.scannerVersion ? { scannerVersion: result.scannerVersion } : {}),
      },
    })
  }

  // ── Audit helper ────────────────────────────────────────────────────────────

  private async audit(event: Omit<StorageAuditEvent, 'id' | 'createdAt'>): Promise<void> {
    await this.repos.auditEvents.append(event)
  }
}
