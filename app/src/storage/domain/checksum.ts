import type { ChecksumAlgorithm } from '../types/storageTypes.ts'
import { StorageError } from '../types/storageTypes.ts'

// ── Checksum computation via Web Crypto API ───────────────────────────────────
// Uses crypto.subtle (available in Node.js 15+ and modern jsdom).
// MD5 is not supported by crypto.subtle — treat as legacy read-only value.

const SUBTLE_ALGO_MAP: Partial<Record<ChecksumAlgorithm, string>> = {
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
}

export async function computeChecksumHex(
  data: Uint8Array,
  algorithm: ChecksumAlgorithm,
): Promise<string> {
  const algo = SUBTLE_ALGO_MAP[algorithm]
  if (!algo) {
    throw new StorageError(
      'VALIDATION_FAILED',
      'checksumAlgorithm',
      `Algorithm ${algorithm} cannot be computed by the platform. Provide a pre-computed value for legacy MD5.`,
    )
  }
  const buffer = await crypto.subtle.digest(algo, data as BufferSource)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Normalise ─────────────────────────────────────────────────────────────────

export function normalizeChecksum(checksum: string): string {
  return checksum.toLowerCase().trim()
}

// ── Validate ──────────────────────────────────────────────────────────────────

export function validateChecksum(computed: string, expected: string): boolean {
  return normalizeChecksum(computed) === normalizeChecksum(expected)
}

// ── Hex format validation ─────────────────────────────────────────────────────

const HEX_LENGTHS: Partial<Record<ChecksumAlgorithm, number>> = {
  MD5: 32,
  SHA256: 64,
  SHA512: 128,
}

export function isValidChecksumFormat(checksum: string, algorithm: ChecksumAlgorithm): boolean {
  const expected = HEX_LENGTHS[algorithm]
  if (!expected) return false
  return checksum.length === expected && /^[0-9a-fA-F]+$/.test(checksum)
}

export function assertValidChecksum(checksum: string, algorithm: ChecksumAlgorithm): void {
  if (!isValidChecksumFormat(checksum, algorithm)) {
    throw new StorageError(
      'CHECKSUM_MISMATCH',
      'checksum',
      `Invalid ${algorithm} checksum format: expected ${HEX_LENGTHS[algorithm]} hex characters`,
    )
  }
}

// ── Build object key incorporating checksum (deduplication key) ───────────────

export function buildContentAddressedKey(checksum: string, algorithm: ChecksumAlgorithm): string {
  // e.g. "sha256/ab12cd34.../content"
  return `${algorithm.toLowerCase()}/${checksum}`
}
