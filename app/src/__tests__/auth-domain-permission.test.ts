import { describe, it, expect } from 'vitest'
import type { Permission, AuthContext, Role, DelegationGrant } from '../auth/types/authTypes.ts'
import {
  scopeIncludes, matchesResource, matchesAction,
  evaluatePermission, hasPermission, resolveEffectivePermissions,
  getDelegationPermissionIds,
} from '../auth/domain/permission.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePerm = (id: string, resource: string, action: string, scope: Permission['scope'] = 'OWN'): Permission => ({
  id, resource, action, scope,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

const makeCtx = (permissions: readonly Permission[]): AuthContext => ({
  userId: 'user-1', username: 'alice', email: 'alice@example.com',
  displayName: 'Alice', departmentId: 'dept-1',
  roles: [] as Role[], effectivePermissions: permissions,
  activeDelegations: [] as DelegationGrant[], approvalHierarchies: [],
  sessionId: 'sess-1', issuedAt: '2026-01-01T08:00:00.000Z',
  expiresAt: '2026-01-01T16:00:00.000Z', metadata: {},
})

const makeDelegation = (toUserId: string, permIds: string[], validFrom: string, validUntil: string, revokedAt?: string): DelegationGrant => ({
  id: 'deleg-1', fromUserId: 'user-0', toUserId, permissionIds: permIds,
  scope: 'DEPARTMENT', validFrom, validUntil, reason: 'Test',
  legalBasis: [{ document: 'NĐ-63', article: '1', effectiveDate: '2020-01-01', issuingAuthority: 'CP', summary: '', clause: '', point: '', appendix: '', url: '' }],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  revokedAt,
})

// ── scopeIncludes ─────────────────────────────────────────────────────────────

describe('scopeIncludes', () => {
  it('OWN does not cover DEPARTMENT', () => expect(scopeIncludes('OWN', 'DEPARTMENT')).toBe(false))
  it('OWN does not cover ALL', () => expect(scopeIncludes('OWN', 'ALL')).toBe(false))
  it('DEPARTMENT covers OWN', () => expect(scopeIncludes('DEPARTMENT', 'OWN')).toBe(true))
  it('DEPARTMENT does not cover ALL', () => expect(scopeIncludes('DEPARTMENT', 'ALL')).toBe(false))
  it('ALL covers OWN', () => expect(scopeIncludes('ALL', 'OWN')).toBe(true))
  it('ALL covers DEPARTMENT', () => expect(scopeIncludes('ALL', 'DEPARTMENT')).toBe(true))
  it('ALL covers ALL', () => expect(scopeIncludes('ALL', 'ALL')).toBe(true))
  it('same scope covers itself', () => {
    expect(scopeIncludes('OWN', 'OWN')).toBe(true)
    expect(scopeIncludes('DEPARTMENT', 'DEPARTMENT')).toBe(true)
  })
})

// ── matchesResource ───────────────────────────────────────────────────────────

describe('matchesResource', () => {
  it('exact match', () => expect(matchesResource('PACKAGE', 'PACKAGE')).toBe(true))
  it('no match', () => expect(matchesResource('PACKAGE', 'CONTRACT')).toBe(false))
  it('* matches everything', () => {
    expect(matchesResource('*', 'PACKAGE')).toBe(true)
    expect(matchesResource('*', 'anything')).toBe(true)
  })
  it('PACKAGE:* matches PACKAGE:sub', () => {
    expect(matchesResource('PACKAGE:*', 'PACKAGE:sub')).toBe(true)
    expect(matchesResource('PACKAGE:*', 'PACKAGE')).toBe(true)
  })
  it('PACKAGE:* does not match CONTRACT', () => {
    expect(matchesResource('PACKAGE:*', 'CONTRACT')).toBe(false)
  })
  it('*:READ prefix wildcard not supported (only suffix)', () => {
    // *:READ is a suffix wildcard on the resource side
    expect(matchesResource('*:READ', 'PACKAGE:READ')).toBe(true)
    expect(matchesResource('*:READ', 'CONTRACT:WRITE')).toBe(false)
  })
})

// ── matchesAction ─────────────────────────────────────────────────────────────

describe('matchesAction', () => {
  it('exact match', () => expect(matchesAction('READ', 'READ')).toBe(true))
  it('* matches any action', () => expect(matchesAction('*', 'DELETE')).toBe(true))
  it('no match', () => expect(matchesAction('READ', 'WRITE')).toBe(false))
})

// ── evaluatePermission ────────────────────────────────────────────────────────

describe('evaluatePermission', () => {
  it('returns match when permission exactly satisfies required', () => {
    const perms = [makePerm('p1', 'PACKAGE', 'READ', 'OWN')]
    const result = evaluatePermission(perms, { resource: 'PACKAGE', action: 'READ', scope: 'OWN' })
    expect(result).not.toBeNull()
    expect(result?.permission.id).toBe('p1')
  })

  it('returns null when scope is insufficient', () => {
    const perms = [makePerm('p1', 'PACKAGE', 'READ', 'OWN')]
    expect(evaluatePermission(perms, { resource: 'PACKAGE', action: 'READ', scope: 'DEPARTMENT' })).toBeNull()
  })

  it('ALL scope permission satisfies OWN requirement', () => {
    const perms = [makePerm('p1', 'PACKAGE', 'READ', 'ALL')]
    expect(evaluatePermission(perms, { resource: 'PACKAGE', action: 'READ', scope: 'OWN' })).not.toBeNull()
  })

  it('wildcard resource permission matches specific resource', () => {
    const perms = [makePerm('p1', '*', 'READ', 'ALL')]
    expect(evaluatePermission(perms, { resource: 'PACKAGE', action: 'READ', scope: 'ALL' })).not.toBeNull()
  })

  it('returns null for empty list', () => {
    expect(evaluatePermission([], { resource: 'PACKAGE', action: 'READ', scope: 'OWN' })).toBeNull()
  })

  it('returns first match when multiple qualify', () => {
    const perms = [makePerm('p1', 'PACKAGE', 'READ', 'ALL'), makePerm('p2', 'PACKAGE', 'READ', 'OWN')]
    const result = evaluatePermission(perms, { resource: 'PACKAGE', action: 'READ', scope: 'OWN' })
    expect(result?.permission.id).toBe('p1')
  })
})

// ── hasPermission ─────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('true when effective permissions contain a match', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    expect(hasPermission(ctx, 'PACKAGE', 'READ', 'OWN')).toBe(true)
  })

  it('false when no permissions match', () => {
    const ctx = makeCtx([])
    expect(hasPermission(ctx, 'PACKAGE', 'READ', 'OWN')).toBe(false)
  })

  it('false when scope is insufficient', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    expect(hasPermission(ctx, 'PACKAGE', 'READ', 'ALL')).toBe(false)
  })
})

// ── resolveEffectivePermissions ───────────────────────────────────────────────

describe('resolveEffectivePermissions', () => {
  it('merges without duplicates', () => {
    const role = [makePerm('p1', 'PACKAGE', 'READ', 'OWN'), makePerm('p2', 'CONTRACT', 'READ', 'ALL')]
    const deleg = [makePerm('p1', 'PACKAGE', 'READ', 'OWN'), makePerm('p3', 'PAYMENT', 'READ', 'OWN')]
    const result = resolveEffectivePermissions(role, deleg)
    expect(result).toHaveLength(3)
    const ids = result.map(p => p.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
    expect(ids).toContain('p3')
  })

  it('empty inputs return empty', () => {
    expect(resolveEffectivePermissions([], [])).toHaveLength(0)
  })

  it('role permissions come first', () => {
    const role = [makePerm('p1', 'PACKAGE', 'READ', 'OWN')]
    const deleg = [makePerm('p2', 'CONTRACT', 'READ', 'OWN')]
    const result = resolveEffectivePermissions(role, deleg)
    expect(result[0].id).toBe('p1')
  })
})

// ── getDelegationPermissionIds ────────────────────────────────────────────────

describe('getDelegationPermissionIds', () => {
  const asOf = '2026-06-01T00:00:00.000Z'

  it('returns permission ids from active delegations', () => {
    const d = makeDelegation('user-1', ['p1', 'p2'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')
    const ids = getDelegationPermissionIds([d], asOf)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
  })

  it('excludes revoked delegations', () => {
    const d = makeDelegation('user-1', ['p1'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2026-05-01T00:00:00.000Z')
    expect(getDelegationPermissionIds([d], asOf)).toHaveLength(0)
  })

  it('excludes expired delegations', () => {
    const d = makeDelegation('user-1', ['p1'], '2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z')
    expect(getDelegationPermissionIds([d], asOf)).toHaveLength(0)
  })

  it('deduplicates repeated permission ids', () => {
    const d1 = makeDelegation('user-1', ['p1'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')
    const d2 = { ...d1, id: 'deleg-2', permissionIds: ['p1', 'p3'] }
    const ids = getDelegationPermissionIds([d1, d2], asOf)
    expect(ids.filter(id => id === 'p1')).toHaveLength(1)
    expect(ids).toContain('p3')
  })
})
