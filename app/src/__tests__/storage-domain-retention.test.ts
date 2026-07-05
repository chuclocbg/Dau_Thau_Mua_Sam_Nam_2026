import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RETENTION_DAYS, calculateRetentionExpiry, isRetentionExpired,
  getEffectiveRetentionDays, isHoldActive, hasActiveLegalHold,
  canDelete, validateRetentionPolicyValues,
} from '../storage/domain/retention.ts'
import type { LegalHold, RetentionPolicy } from '../storage/types/storageTypes.ts'
import { StorageError } from '../storage/types/storageTypes.ts'

const hold = (overrides: Partial<LegalHold> = {}): LegalHold => ({
  id: 'hold-1',
  reason: 'audit',
  legalBasis: [],
  placedBy: 'user-1',
  placedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

const policy = (overrides: Partial<RetentionPolicy> = {}): RetentionPolicy => ({
  id: 'pol-1',
  documentType: 'CONTRACT',
  retentionDays: 3650,
  legalBasis: [],
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('DEFAULT_RETENTION_DAYS', () => {
  it('DECISION is 3650 days (10 years)', () => {
    expect(DEFAULT_RETENTION_DAYS.DECISION).toBe(3650)
  })
  it('TENDER_DOCUMENTS is 1825 days (5 years)', () => {
    expect(DEFAULT_RETENTION_DAYS.TENDER_DOCUMENTS).toBe(1825)
  })
  it('CONTRACT is 3650 days', () => {
    expect(DEFAULT_RETENTION_DAYS.CONTRACT).toBe(3650)
  })
  it('INVOICE is 3650 days (10 years, tax law)', () => {
    expect(DEFAULT_RETENTION_DAYS.INVOICE).toBe(3650)
  })
  it('GENERAL is 1825 days (5 years)', () => {
    expect(DEFAULT_RETENTION_DAYS.GENERAL).toBe(1825)
  })
})

describe('calculateRetentionExpiry', () => {
  it('returns ISO string later than uploadedAt', () => {
    const result = calculateRetentionExpiry('2024-01-01T00:00:00Z', 365)
    expect(typeof result).toBe('string')
    expect(result > '2024-01-01T00:00:00Z').toBe(true)
  })

  it('1-day expiry is exactly 86400000ms after uploadedAt', () => {
    const uploadedAt = '2024-01-01T00:00:00Z'
    const result = calculateRetentionExpiry(uploadedAt, 1)
    const diff = new Date(result).getTime() - new Date(uploadedAt).getTime()
    expect(diff).toBe(86_400_000)
  })

  it('10-year expiry is correct', () => {
    const result = calculateRetentionExpiry('2024-01-01T00:00:00Z', 3650)
    expect(result > '2024-01-01T00:00:00Z').toBe(true)
    expect(result < '2035-01-01T00:00:00Z').toBe(true)
  })
})

describe('isRetentionExpired', () => {
  it('returns false when retention period not yet elapsed', () => {
    const uploadedAt = '2024-01-01T00:00:00Z'
    const asOf = '2024-06-01T00:00:00Z'
    expect(isRetentionExpired(uploadedAt, 3650, asOf)).toBe(false)
  })

  it('returns true when retention period has elapsed', () => {
    const uploadedAt = '2010-01-01T00:00:00Z'
    const asOf = '2024-01-01T00:00:00Z'
    expect(isRetentionExpired(uploadedAt, 365, asOf)).toBe(true)
  })

  it('returns true at exact expiry moment', () => {
    const uploadedAt = '2024-01-01T00:00:00Z'
    const expiry = new Date(new Date(uploadedAt).getTime() + 365 * 86_400_000).toISOString()
    expect(isRetentionExpired(uploadedAt, 365, expiry)).toBe(true)
  })
})

describe('getEffectiveRetentionDays', () => {
  it('returns default when no policy provided', () => {
    expect(getEffectiveRetentionDays('DECISION')).toBe(3650)
    expect(getEffectiveRetentionDays('GENERAL')).toBe(1825)
  })

  it('returns policy value when policy days > default (7300 > 3650)', () => {
    const pol = policy({ documentType: 'CONTRACT', retentionDays: 7300 })
    expect(getEffectiveRetentionDays('CONTRACT', pol)).toBe(7300)
  })

  it('returns default when policy days < default (floor at default)', () => {
    const pol = policy({ documentType: 'CONTRACT', retentionDays: 100 })
    expect(getEffectiveRetentionDays('CONTRACT', pol)).toBe(3650)
  })
})

describe('isHoldActive', () => {
  it('returns true when hold has no releasedAt', () => {
    expect(isHoldActive(hold())).toBe(true)
  })

  it('returns false when hold has releasedAt', () => {
    expect(isHoldActive(hold({ releasedAt: '2024-06-01T00:00:00Z' }))).toBe(false)
  })
})

describe('hasActiveLegalHold', () => {
  it('returns false for empty array', () => {
    expect(hasActiveLegalHold([])).toBe(false)
  })

  it('returns false when all holds are released', () => {
    expect(hasActiveLegalHold([hold({ releasedAt: '2024-06-01T00:00:00Z' })])).toBe(false)
  })

  it('returns true when at least one hold is active', () => {
    expect(hasActiveLegalHold([hold({ releasedAt: '2024-06-01T00:00:00Z' }), hold()])).toBe(true)
  })
})

describe('canDelete', () => {
  it('allows deletion when retention is expired and no holds', () => {
    const uploadedAt = '2010-01-01T00:00:00Z'
    const asOf = '2024-01-01T00:00:00Z'
    const result = canDelete(uploadedAt, 'GENERAL', asOf)
    expect(result.allowed).toBe(true)
  })

  it('denies deletion when retention is active', () => {
    const uploadedAt = '2024-01-01T00:00:00Z'
    const asOf = '2024-06-01T00:00:00Z'
    const result = canDelete(uploadedAt, 'CONTRACT', asOf)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/retention/i)
  })

  it('denies deletion when legal hold is active (even if retention expired)', () => {
    const uploadedAt = '2010-01-01T00:00:00Z'
    const asOf = '2024-01-01T00:00:00Z'
    const result = canDelete(uploadedAt, 'GENERAL', asOf, undefined, [hold()])
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/hold/i)
  })

  it('uses custom policy when it exceeds default — extends retention', () => {
    // Policy with 10-year retention on GENERAL (default 5 years)
    // uploadedAt 6 years ago — past default but within custom policy
    const uploadedAt = '2018-01-01T00:00:00Z'
    const asOf = '2024-06-01T00:00:00Z'  // ~6.4 years later
    const longPolicy = policy({ documentType: 'GENERAL', retentionDays: 3650 })  // 10 years
    const withDefault = canDelete(uploadedAt, 'GENERAL', asOf)             // default = 1825 days (5 yr)
    const withPolicy = canDelete(uploadedAt, 'GENERAL', asOf, longPolicy)  // policy = 3650 days (10 yr)
    expect(withDefault.allowed).toBe(true)    // past 5-year default
    expect(withPolicy.allowed).toBe(false)   // still within 10-year policy
  })
})

describe('validateRetentionPolicyValues', () => {
  it('does not throw for valid values at or above minimum', () => {
    expect(() => validateRetentionPolicyValues(3650, 'CONTRACT')).not.toThrow()
    expect(() => validateRetentionPolicyValues(1825, 'GENERAL')).not.toThrow()
    expect(() => validateRetentionPolicyValues(7300, 'INVOICE')).not.toThrow()
  })

  it('throws StorageError for zero days', () => {
    expect(() => validateRetentionPolicyValues(0, 'GENERAL')).toThrow(StorageError)
  })

  it('throws StorageError for negative days', () => {
    expect(() => validateRetentionPolicyValues(-1, 'INVOICE')).toThrow(StorageError)
  })
})
