import type {
  ObjectMetadata, StoredObject, StorageVersion, SignedUrl,
  ListOptions, ObjectListing, VirusScanResult, StorageProviderType,
  ChecksumAlgorithm,
} from './storageTypes.ts'

// ── IStorageProvider — low-level object store ─────────────────────────────────
// Implementations: LocalStorageProvider, S3StorageProvider, AzureBlobProvider,
// GcsProvider, MinioProvider, GovernmentObjectStorageProvider.
// Never called directly by application services — use IObjectStore.

export interface IStorageProvider {
  readonly providerId: string
  readonly providerType: StorageProviderType

  /** Store raw bytes at key. Overwrites if exists. */
  putObject(key: string, data: Uint8Array, metadata: Partial<ObjectMetadata>): Promise<void>

  /** Retrieve raw bytes. Returns null if not found. */
  getObject(key: string): Promise<{ data: Uint8Array; metadata: Partial<ObjectMetadata> } | null>

  /** Delete object at key. No-op if not found. */
  deleteObject(key: string): Promise<void>

  /** Check if object exists without downloading. */
  headObject(key: string): Promise<Partial<ObjectMetadata> | null>

  /** List objects under prefix. */
  listObjects(prefix: string, options?: ListOptions): Promise<ObjectListing>

  /** Copy object from one key to another within the same provider. */
  copyObject(sourceKey: string, destKey: string): Promise<void>

  /** Generate a pre-signed URL for direct client access. Deferred to Phase M for production. */
  generateSignedUrl(
    key: string,
    expiresInSeconds: number,
    operation: 'GET' | 'PUT',
  ): Promise<SignedUrl>
}

// ── IObjectStore — mid-level, adds versioning and integrity ───────────────────

export interface StoreParams {
  readonly objectKey: string
  readonly data: Uint8Array
  readonly metadata: ObjectMetadata
  readonly createdBy: string
}

export interface RetrieveParams {
  readonly objectId: string
  readonly versionId?: string           // omit for current version
}

export interface IObjectStore {
  /** Store a new object. Returns the stored object with version info. */
  store(params: StoreParams): Promise<StoredObject>

  /** Retrieve object data and metadata. */
  retrieve(params: RetrieveParams): Promise<{ object: StoredObject; data: Uint8Array } | null>

  /** Create a new version of an existing object. */
  createVersion(objectId: string, data: Uint8Array, metadata: ObjectMetadata, createdBy: string): Promise<StorageVersion>

  /** List all versions of an object. */
  listVersions(objectId: string): Promise<readonly StorageVersion[]>

  /** Mark an object as deleted (soft delete). Does not physically remove if retention is active. */
  softDelete(objectId: string, deletedBy: string): Promise<void>

  /** Generate a signed URL for an object version. */
  generateSignedUrl(objectId: string, expiresInSeconds: number, operation: 'GET' | 'PUT'): Promise<SignedUrl>
}

// ── IBinaryRepository — domain-level, procurement-aware ───────────────────────

export interface AttachmentParams {
  readonly data: Uint8Array
  readonly metadata: ObjectMetadata
  readonly moduleType: string
  readonly moduleId: string
  readonly uploadedBy: string
}

export interface IBinaryRepository {
  /** Store attachment and return a reference record. */
  save(params: AttachmentParams): Promise<import('./storageTypes.ts').AttachmentReference>

  /** Load attachment data by reference id. */
  load(attachmentId: string): Promise<{ reference: import('./storageTypes.ts').AttachmentReference; data: Uint8Array } | null>

  /** Deactivate an attachment reference (does not delete the stored object). */
  deactivate(attachmentId: string, deactivatedBy: string): Promise<void>

  /** List all active attachment references for a module entity. */
  listByModule(moduleType: string, moduleId: string): Promise<readonly import('./storageTypes.ts').AttachmentReference[]>

  /** List all active attachments for a module type (cross-entity). */
  listByModuleType(moduleType: string, limit?: number): Promise<readonly import('./storageTypes.ts').AttachmentReference[]>
}

// ── IVirusScanProvider ────────────────────────────────────────────────────────
// Deferred implementation: Phase M+ (ClamAV, cloud scan, etc.)

export interface IVirusScanProvider {
  readonly providerId: string

  /** Scan data in memory. Returns result immediately. */
  scan(data: Uint8Array, filename: string): Promise<VirusScanResult>

  /** Queue an already-stored object for async scan. Returns pending result. */
  queueScan(objectKey: string): Promise<VirusScanResult>

  /** Check if this provider supports async scanning. */
  supportsAsync(): boolean
}

// ── IMultipartUploadProvider ──────────────────────────────────────────────────
// Low-level provider hook for native multipart support (S3 MPU, Azure blocks, etc.)

export interface MultipartInitResult {
  readonly uploadId: string
  readonly objectKey: string
}

export interface IMultipartUploadProvider {
  /** Initiate a native multipart upload. Returns a provider upload ID. */
  initiateMultipart(key: string, metadata: Partial<ObjectMetadata>): Promise<MultipartInitResult>

  /** Upload a single part. Returns an ETag-equivalent. */
  uploadPart(uploadId: string, key: string, partNumber: number, data: Uint8Array): Promise<string>

  /** Complete multipart upload with ordered ETags. */
  completeMultipart(uploadId: string, key: string, parts: readonly { partNumber: number; etag: string }[]): Promise<void>

  /** Abort and discard all uploaded parts. */
  abortMultipart(uploadId: string, key: string): Promise<void>
}

// ── StorageProviders registry ─────────────────────────────────────────────────

export interface StorageProviders {
  readonly primary: IStorageProvider
  readonly virusScan?: IVirusScanProvider
  readonly multipart?: IMultipartUploadProvider
}

// ── Chunk upload params ───────────────────────────────────────────────────────

export interface AppendChunkParams {
  readonly uploadSessionId: string
  readonly chunkNumber: number          // 1-based
  readonly data: Uint8Array
  readonly chunkChecksum?: string
  readonly chunkChecksumAlgorithm?: ChecksumAlgorithm
}

export interface CompleteUploadParams {
  readonly uploadSessionId: string
  readonly finalChecksum: string
  readonly finalChecksumAlgorithm: ChecksumAlgorithm
}

export interface InitiateUploadParams {
  readonly objectKey: string
  readonly documentType: import('./storageTypes.ts').AttachmentDocumentType
  readonly expectedSizeBytes?: bigint
  readonly expectedChecksum?: string
  readonly checksumAlgorithm?: ChecksumAlgorithm
  readonly totalChunks?: number
  readonly uploadedBy: string
  readonly metadata?: Readonly<Record<string, string>>
}
