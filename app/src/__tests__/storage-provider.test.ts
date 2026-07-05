import { describe, it, expect, beforeEach } from 'vitest'
import { MockStorageProvider } from '../storage/infrastructure/providers/mockStorageProvider.ts'
import { StorageError } from '../storage/types/storageTypes.ts'

let provider: MockStorageProvider

beforeEach(() => { provider = new MockStorageProvider() })

const bytes = (s: string) => new TextEncoder().encode(s)

describe('MockStorageProvider identity', () => {
  it('has providerId = mock', () => {
    expect(provider.providerId).toBe('mock')
  })

  it('has providerType = local', () => {
    expect(provider.providerType).toBe('local')
  })
})

describe('putObject / getObject', () => {
  it('stores and retrieves data', async () => {
    await provider.putObject('key/a.pdf', bytes('hello'), {})
    const result = await provider.getObject('key/a.pdf')
    expect(result).not.toBeNull()
    expect(new TextDecoder().decode(result!.data)).toBe('hello')
  })

  it('returns null for missing key', async () => {
    const result = await provider.getObject('does-not-exist')
    expect(result).toBeNull()
  })

  it('overwrites existing key on put', async () => {
    await provider.putObject('key/a', bytes('v1'), {})
    await provider.putObject('key/a', bytes('v2'), {})
    const result = await provider.getObject('key/a')
    expect(new TextDecoder().decode(result!.data)).toBe('v2')
  })

  it('stores metadata alongside data', async () => {
    await provider.putObject('key/meta', bytes('data'), { filename: 'file.pdf' })
    const result = await provider.getObject('key/meta')
    expect(result!.metadata.filename).toBe('file.pdf')
  })
})

describe('deleteObject', () => {
  it('removes the object', async () => {
    await provider.putObject('key/d', bytes('delete me'), {})
    await provider.deleteObject('key/d')
    expect(await provider.getObject('key/d')).toBeNull()
  })

  it('is a no-op for missing key', async () => {
    await expect(provider.deleteObject('missing-key')).resolves.not.toThrow()
  })
})

describe('headObject', () => {
  it('returns metadata for existing key', async () => {
    await provider.putObject('key/head', bytes('content'), { filename: 'head.txt' })
    const meta = await provider.headObject('key/head')
    expect(meta).not.toBeNull()
    expect(meta!.filename).toBe('head.txt')
  })

  it('returns null for missing key', async () => {
    const result = await provider.headObject('missing')
    expect(result).toBeNull()
  })
})

describe('listObjects', () => {
  beforeEach(async () => {
    await provider.putObject('prefix/a.pdf', bytes('a'), {})
    await provider.putObject('prefix/b.pdf', bytes('b'), {})
    await provider.putObject('other/c.pdf', bytes('c'), {})
  })

  it('lists objects matching prefix', async () => {
    const result = await provider.listObjects('prefix/')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.every(e => e.objectKey.startsWith('prefix/'))).toBe(true)
  })

  it('returns total and hasMore', async () => {
    const result = await provider.listObjects('prefix/', { limit: 1 })
    expect(result.total).toBe(2)
    expect(result.hasMore).toBe(true)
    expect(result.entries).toHaveLength(1)
  })

  it('returns empty for unmatched prefix', async () => {
    const result = await provider.listObjects('nope/')
    expect(result.entries).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('sizeBytes reflects data length', async () => {
    const result = await provider.listObjects('prefix/')
    expect(result.entries.every(e => e.sizeBytes > 0n)).toBe(true)
  })
})

describe('copyObject', () => {
  it('copies object to new key', async () => {
    await provider.putObject('src/a', bytes('copy me'), {})
    await provider.copyObject('src/a', 'dst/a')
    const result = await provider.getObject('dst/a')
    expect(new TextDecoder().decode(result!.data)).toBe('copy me')
  })

  it('source remains after copy', async () => {
    await provider.putObject('src/b', bytes('original'), {})
    await provider.copyObject('src/b', 'dst/b')
    expect(provider.has('src/b')).toBe(true)
  })

  it('throws StorageError when source not found', async () => {
    await expect(provider.copyObject('missing', 'dst')).rejects.toThrow(StorageError)
  })
})

describe('generateSignedUrl', () => {
  it('returns a signed url with correct structure', async () => {
    const url = await provider.generateSignedUrl('key/doc.pdf', 3600, 'GET')
    expect(url.url).toContain('key/doc.pdf')
    expect(url.objectKey).toBe('key/doc.pdf')
    expect(url.operation).toBe('GET')
    expect(url.expiresAt).toBeTruthy()
  })

  it('expiry is in the future', async () => {
    const url = await provider.generateSignedUrl('key/doc.pdf', 3600, 'PUT')
    expect(new Date(url.expiresAt) > new Date()).toBe(true)
  })

  it('supports GET and PUT operations', async () => {
    const get = await provider.generateSignedUrl('k', 60, 'GET')
    const put = await provider.generateSignedUrl('k', 60, 'PUT')
    expect(get.operation).toBe('GET')
    expect(put.operation).toBe('PUT')
  })
})

describe('test helpers', () => {
  it('size() returns count of stored objects', async () => {
    expect(provider.size()).toBe(0)
    await provider.putObject('k1', bytes('a'), {})
    await provider.putObject('k2', bytes('b'), {})
    expect(provider.size()).toBe(2)
  })

  it('has() checks existence', async () => {
    await provider.putObject('key/exists', bytes('y'), {})
    expect(provider.has('key/exists')).toBe(true)
    expect(provider.has('key/missing')).toBe(false)
  })

  it('clear() removes all objects', async () => {
    await provider.putObject('k1', bytes('a'), {})
    await provider.putObject('k2', bytes('b'), {})
    provider.clear()
    expect(provider.size()).toBe(0)
  })
})
