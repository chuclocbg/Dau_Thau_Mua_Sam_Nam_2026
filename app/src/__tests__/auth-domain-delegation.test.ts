import { describe, it, expect } from 'vitest'
import type { DelegationGrant, Permission } from '../auth/types/authTypes.ts'
import { AuthError } from '../auth/types/authTypes.ts'
import {
  isDelegationActive, isDelegationExpired, isDelegationRevoked,
  validateDelegationPeriod, detectDelegationCycle, resolveDelegatedPermissions,
} from '../auth/domain/delegation.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const legalBasis = [{
  document: 'NĐ-63', article: '1', clause: '', point: '', appendix: '',
  effectiveDate: '2020-01-01', issuingAuthority: 'CP', summary: '', url: '',
}]

const makeD = (overrides: Partial<DelegationGrant> = {}): DelegationGrant => ({
  id: 'deleg-1', fromUserId: 'user-A', toUserId: 'user-B',
  permissionIds: ['p1'], scope: 'DEPARTMENT',
  validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-12-31T00:00:00.000Z',
  reason: 'Test', legalBasis,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makePerm = (id: string): Permission => ({
  id, resource: 'PACKAGE', action: 'READ', scope: 'OWN',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

const NOW = '2026-06-15T12:00:00.000Z'

// ── isDelegationExpired ───────────────────────────────────────────────────────

describe('isDelegationExpired', () => {
  it('not expired when validUntil is in the future', () => {
    expect(isDelegationExpired(makeD(), NOW)).toBe(false)
  })

  it('expired when validUntil is in the past', () => {
    const d = makeD({ validUntil: '2026-01-01T00:00:00.000Z' })
    expect(isDelegationExpired(d, NOW)).toBe(true)
  })

  it('expired when validUntil equals asOf (exclusive)', () => {
    expect(isDelegationExpired(makeD({ validUntil: NOW }), NOW)).toBe(true)
  })
})

// ── isDelegationRevoked ───────────────────────────────────────────────────────

describe('isDelegationRevoked', () => {
  it('false when not revoked', () => expect(isDelegationRevoked(makeD())).toBe(false))
  it('true when revokedAt is set', () => {
    expect(isDelegationRevoked(makeD({ revokedAt: '2026-05-01T00:00:00.000Z' }))).toBe(true)
  })
})

// ── isDelegationActive ────────────────────────────────────────────────────────

describe('isDelegationActive', () => {
  it('active when within period and not revoked', () => {
    expect(isDelegationActive(makeD(), NOW)).toBe(true)
  })

  it('not active when expired', () => {
    expect(isDelegationActive(makeD({ validUntil: '2026-01-01T00:00:00.000Z' }), NOW)).toBe(false)
  })

  it('not active when revoked', () => {
    expect(isDelegationActive(makeD({ revokedAt: '2026-05-01T00:00:00.000Z' }), NOW)).toBe(false)
  })

  it('not active before validFrom', () => {
    const d = makeD({ validFrom: '2026-12-01T00:00:00.000Z', validUntil: '2027-12-31T00:00:00.000Z' })
    expect(isDelegationActive(d, NOW)).toBe(false)
  })

  it('active exactly at validFrom', () => {
    const d = makeD({ validFrom: NOW, validUntil: '2027-12-31T00:00:00.000Z' })
    expect(isDelegationActive(d, NOW)).toBe(true)
  })
})

// ── validateDelegationPeriod ──────────────────────────────────────────────────

describe('validateDelegationPeriod', () => {
  it('passes for valid period', () => {
    expect(() => validateDelegationPeriod('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')).not.toThrow()
  })

  it('throws when validFrom >= validUntil', () => {
    expect(() => validateDelegationPeriod('2026-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'))
      .toThrow(AuthError)
  })

  it('throws when period exceeds max days', () => {
    expect(() => validateDelegationPeriod('2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z', 365))
      .toThrow(AuthError)
  })

  it('custom maxDurationDays respected', () => {
    expect(() => validateDelegationPeriod('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 10))
      .toThrow(AuthError)
    expect(() => validateDelegationPeriod('2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z', 10))
      .not.toThrow()
  })
})

// ── detectDelegationCycle ─────────────────────────────────────────────────────

describe('detectDelegationCycle', () => {
  it('detects A→B→A cycle', () => {
    const activeDelegations: DelegationGrant[] = [
      makeD({ id: 'd1', fromUserId: 'B', toUserId: 'A' }),
    ]
    expect(detectDelegationCycle('A', 'B', activeDelegations)).toBe(true)
  })

  it('detects A→B→C→A cycle', () => {
    const activeDelegations: DelegationGrant[] = [
      makeD({ id: 'd1', fromUserId: 'B', toUserId: 'C' }),
      makeD({ id: 'd2', fromUserId: 'C', toUserId: 'A' }),
    ]
    expect(detectDelegationCycle('A', 'B', activeDelegations)).toBe(true)
  })

  it('no cycle in linear chain A→B→C', () => {
    const activeDelegations: DelegationGrant[] = [
      makeD({ id: 'd1', fromUserId: 'B', toUserId: 'C' }),
    ]
    expect(detectDelegationCycle('A', 'B', activeDelegations)).toBe(false)
  })

  it('no cycle when no existing delegations', () => {
    expect(detectDelegationCycle('A', 'B', [])).toBe(false)
  })
})

// ── resolveDelegatedPermissions ───────────────────────────────────────────────

describe('resolveDelegatedPermissions', () => {
  const perms = [makePerm('p1'), makePerm('p2'), makePerm('p3')]

  it('returns permissions from active delegations for toUserId', () => {
    const d = makeD({ toUserId: 'user-B', permissionIds: ['p1', 'p2'] })
    const result = resolveDelegatedPermissions([d], 'user-B', perms, NOW)
    expect(result.map(p => p.id)).toEqual(expect.arrayContaining(['p1', 'p2']))
  })

  it('excludes delegations for other users', () => {
    const d = makeD({ toUserId: 'user-C', permissionIds: ['p1'] })
    expect(resolveDelegatedPermissions([d], 'user-B', perms, NOW)).toHaveLength(0)
  })

  it('excludes expired delegations', () => {
    const d = makeD({ toUserId: 'user-B', permissionIds: ['p1'], validUntil: '2025-01-01T00:00:00.000Z' })
    expect(resolveDelegatedPermissions([d], 'user-B', perms, NOW)).toHaveLength(0)
  })

  it('deduplicates permissions from overlapping delegations', () => {
    const d1 = makeD({ id: 'd1', toUserId: 'user-B', permissionIds: ['p1', 'p2'] })
    const d2 = { ...d1, id: 'd2', permissionIds: ['p2', 'p3'] }
    const result = resolveDelegatedPermissions([d1, d2], 'user-B', perms, NOW)
    expect(result).toHaveLength(3)
    expect(result.filter(p => p.id === 'p2')).toHaveLength(1)
  })

  it('returns empty when permissionIds not in availablePermissions', () => {
    const d = makeD({ toUserId: 'user-B', permissionIds: ['p-unknown'] })
    expect(resolveDelegatedPermissions([d], 'user-B', perms, NOW)).toHaveLength(0)
  })
})
