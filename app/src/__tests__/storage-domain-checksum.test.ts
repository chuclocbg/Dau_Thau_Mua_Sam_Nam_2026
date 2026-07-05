import { describe, it, expect } from 'vitest'
import {
  computeChecksumHex, normalizeChecksum, validateChecksum,
  isValidChecksumFormat, assertValidChecksum, buildContentAddressedKey,
} from '../storage/domain/checksum.ts'
import { StorageError } from '../storage/types/storageTypes.ts'

const data = new TextEncoder().encode('hello world')

describe('computeChecksumHex', () => {
  it('computes SHA256 hex string', async () => {
    const result = await computeChecksumHex(data, 'SHA256')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('computes SHA512 hex string', async () => {
    const result = await computeChecksumHex(data, 'SHA512')
    expect(result).toHaveLength(128)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('returns consistent result for same input', async () => {
    const a = await computeChecksumHex(data, 'SHA256')
    const b = await computeChecksumHex(data, 'SHA256')
    expect(a).toBe(b)
  })

  it('returns different results for different inputs', async () => {
    const a = await computeChecksumHex(new TextEncoder().encode('abc'), 'SHA256')
    const b = await computeChecksumHex(new TextEncoder().encode('def'), 'SHA256')
    expect(a).not.toBe(b)
  })

  it('throws StorageError for MD5 (not supported by subtle)', async () => {
    await expect(computeChecksumHex(data, 'MD5')).rejects.toThrow(StorageError)
  })

  it('SHA256 of empty buffer differs from SHA256 of data', async () => {
    const empty = await computeChecksumHex(new Uint8Array(0), 'SHA256')
    const full = await computeChecksumHex(data, 'SHA256')
    expect(empty).not.toBe(full)
    expect(empty).toHaveLength(64)
  })
})

describe('normalizeChecksum', () => {
  it('lowercases and trims', () => {
    expect(normalizeChecksum('  ABC123  ')).toBe('abc123')
    expect(normalizeChecksum('ABCDEF')).toBe('abcdef')
  })
})

describe('validateChecksum', () => {
  it('returns true for matching checksums (case-insensitive)', () => {
    expect(validateChecksum('abc123', 'ABC123')).toBe(true)
    expect(validateChecksum('abc123', 'abc123')).toBe(true)
  })

  it('returns false for mismatched checksums', () => {
    expect(validateChecksum('abc123', 'def456')).toBe(false)
  })
})

describe('isValidChecksumFormat', () => {
  it('returns true for valid SHA256 checksum', () => {
    const valid = 'a'.repeat(64)
    expect(isValidChecksumFormat(valid, 'SHA256')).toBe(true)
  })

  it('returns false for wrong length', () => {
    expect(isValidChecksumFormat('abc', 'SHA256')).toBe(false)
  })

  it('returns false for non-hex chars', () => {
    const invalid = 'g'.repeat(64)
    expect(isValidChecksumFormat(invalid, 'SHA256')).toBe(false)
  })

  it('returns true for valid MD5 checksum', () => {
    const valid = 'f'.repeat(32)
    expect(isValidChecksumFormat(valid, 'MD5')).toBe(true)
  })

  it('returns true for valid SHA512 checksum', () => {
    const valid = 'e'.repeat(128)
    expect(isValidChecksumFormat(valid, 'SHA512')).toBe(true)
  })
})

describe('assertValidChecksum', () => {
  it('does not throw for valid checksum', () => {
    expect(() => assertValidChecksum('a'.repeat(64), 'SHA256')).not.toThrow()
  })

  it('throws StorageError for invalid checksum', () => {
    expect(() => assertValidChecksum('zzzz', 'SHA256')).toThrow(StorageError)
  })
})

describe('buildContentAddressedKey', () => {
  it('builds key as algorithm/checksum', () => {
    expect(buildContentAddressedKey('abc123', 'SHA256')).toBe('sha256/abc123')
    expect(buildContentAddressedKey('def456', 'SHA512')).toBe('sha512/def456')
    expect(buildContentAddressedKey('ghi789', 'MD5')).toBe('md5/ghi789')
  })
})
