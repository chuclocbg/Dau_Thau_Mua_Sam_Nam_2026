/**
 * In-memory storage provider for tests and local development.
 * Never reads from or writes to disk — safe for jsdom test environment.
 */

import type { IStorageProvider } from '../../types/providerTypes.ts'
import type { ObjectMetadata, SignedUrl, ListOptions, ObjectListing } from '../../types/storageTypes.ts'
import { StorageError } from '../../types/storageTypes.ts'

interface StoredEntry {
  data: Uint8Array
  metadata: Partial<ObjectMetadata>
  storedAt: string
}

export class MockStorageProvider implements IStorageProvider {
  readonly providerId = 'mock'
  readonly providerType = 'local' as const

  private readonly store = new Map<string, StoredEntry>()

  async putObject(key: string, data: Uint8Array, metadata: Partial<ObjectMetadata>): Promise<void> {
    this.store.set(key, { data, metadata, storedAt: new Date().toISOString() })
  }

  async getObject(key: string): Promise<{ data: Uint8Array; metadata: Partial<ObjectMetadata> } | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    return { data: entry.data, metadata: entry.metadata }
  }

  async deleteObject(key: string): Promise<void> {
    this.store.delete(key)
  }

  async headObject(key: string): Promise<Partial<ObjectMetadata> | null> {
    return this.store.get(key)?.metadata ?? null
  }

  async listObjects(prefix: string, options: ListOptions = {}): Promise<ObjectListing> {
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0
    const matching = Array.from(this.store.entries())
      .filter(([k]) => k.startsWith(prefix))
    const page = matching.slice(offset, offset + limit)

    return {
      entries: page.map(([objectKey, entry]) => ({
        objectKey,
        sizeBytes: BigInt(entry.data.length),
        lastModified: entry.storedAt,
        checksum: entry.metadata.checksum,
      })),
      total: matching.length,
      hasMore: offset + limit < matching.length,
    }
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const entry = this.store.get(sourceKey)
    if (!entry) throw new StorageError('OBJECT_NOT_FOUND', 'sourceKey', `Source object not found: ${sourceKey}`)
    this.store.set(destKey, { ...entry, data: new Uint8Array(entry.data) })
  }

  async generateSignedUrl(
    key: string,
    expiresInSeconds: number,
    operation: 'GET' | 'PUT',
  ): Promise<SignedUrl> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    return {
      url: `mock://storage/${key}?op=${operation}&expires=${expiresAt}`,
      objectKey: key,
      operation,
      expiresAt,
    }
  }

  // ── Test helpers ────────────────────────────────────────────────────────────

  size(): number { return this.store.size }
  has(key: string): boolean { return this.store.has(key) }
  clear(): void { this.store.clear() }
}
