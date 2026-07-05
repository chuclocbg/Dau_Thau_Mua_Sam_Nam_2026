/**
 * Local filesystem storage provider.
 * Uses node:fs/promises — NOT safe for jsdom test environment.
 * Never import this file in tests. Use MockStorageProvider instead.
 */

import * as fs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { IStorageProvider } from '../../types/providerTypes.ts'
import type { ObjectMetadata, SignedUrl, ListOptions, ObjectListing } from '../../types/storageTypes.ts'
import { StorageError } from '../../types/storageTypes.ts'

export class LocalStorageProvider implements IStorageProvider {
  readonly providerId = 'local'
  readonly providerType = 'local' as const

  constructor(private readonly basePath: string) {}

  private resolve(key: string): string {
    return nodePath.join(this.basePath, key)
  }

  async putObject(key: string, data: Uint8Array, _metadata: Partial<ObjectMetadata>): Promise<void> {
    const filePath = this.resolve(key)
    await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
  }

  async getObject(key: string): Promise<{ data: Uint8Array; metadata: Partial<ObjectMetadata> } | null> {
    try {
      const data = await fs.readFile(this.resolve(key))
      return { data: new Uint8Array(data.buffer), metadata: {} }
    } catch {
      return null
    }
  }

  async deleteObject(key: string): Promise<void> {
    try { await fs.unlink(this.resolve(key)) } catch { /* no-op if missing */ }
  }

  async headObject(key: string): Promise<Partial<ObjectMetadata> | null> {
    try {
      const stat = await fs.stat(this.resolve(key))
      return { sizeBytes: BigInt(stat.size) }
    } catch {
      return null
    }
  }

  async listObjects(prefix: string, options: ListOptions = {}): Promise<ObjectListing> {
    const dir = this.resolve(prefix)
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return { entries: [], total: 0, hasMore: false }
    }

    const page = entries.slice(offset, offset + limit)
    const listed = await Promise.all(page.map(async (name) => {
      const full = nodePath.join(dir, name)
      const stat = await fs.stat(full).catch(() => null)
      return {
        objectKey: nodePath.join(prefix, name).replace(/\\/g, '/'),
        sizeBytes: BigInt(stat?.size ?? 0),
        lastModified: stat?.mtime.toISOString() ?? new Date().toISOString(),
      }
    }))

    return { entries: listed, total: entries.length, hasMore: offset + limit < entries.length }
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const src = this.resolve(sourceKey)
    const dest = this.resolve(destKey)
    try {
      await fs.mkdir(nodePath.dirname(dest), { recursive: true })
      await fs.copyFile(src, dest)
    } catch {
      throw new StorageError('OBJECT_NOT_FOUND', 'sourceKey', `Source object not found: ${sourceKey}`)
    }
  }

  async generateSignedUrl(
    key: string,
    expiresInSeconds: number,
    operation: 'GET' | 'PUT',
  ): Promise<SignedUrl> {
    // ponytail: local provider returns a file:// URL; real signing deferred to Phase M
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    return {
      url: `file://${this.resolve(key)}`,
      objectKey: key,
      operation,
      expiresAt,
    }
  }
}
