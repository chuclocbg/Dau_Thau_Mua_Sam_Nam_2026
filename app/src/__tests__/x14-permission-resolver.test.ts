/**
 * Phase X.14 — unit tests for resolveEffectivePermissions() and the built-in role registry
 * (Permission resolver, Roles, Permissions).
 */

import { describe, it, expect } from 'vitest'
import {
  BUILTIN_ROLES, ANONYMOUS_ROLE, USER_ROLE, SERVICE_ROLE, SYSTEM_ROLE, resolveEffectivePermissions,
} from '../identity/application/permissionResolver.ts'

describe('BUILTIN_ROLES', () => {
  it('has exactly the four documented roles', () => {
    expect(Array.from(BUILTIN_ROLES.keys()).sort()).toEqual(['ANONYMOUS', 'SERVICE', 'SYSTEM', 'USER'])
  })

  it('each role is retrievable by its own code', () => {
    expect(BUILTIN_ROLES.get('ANONYMOUS')).toBe(ANONYMOUS_ROLE)
    expect(BUILTIN_ROLES.get('USER')).toBe(USER_ROLE)
    expect(BUILTIN_ROLES.get('SERVICE')).toBe(SERVICE_ROLE)
    expect(BUILTIN_ROLES.get('SYSTEM')).toBe(SYSTEM_ROLE)
  })
})

describe('resolveEffectivePermissions', () => {
  it('resolves a single role\'s permissions', () => {
    expect(resolveEffectivePermissions(['ANONYMOUS'])).toEqual(ANONYMOUS_ROLE.permissions)
  })

  it('merges permissions from multiple roles, deduplicated', () => {
    const merged = resolveEffectivePermissions(['ANONYMOUS', 'USER'])
    // USER already includes conversation:ask:OWN, same as ANONYMOUS -- no duplicate entry
    const askOwnCount = merged.filter(p => p.resource === 'conversation' && p.action === 'ask' && p.scope === 'OWN').length
    expect(askOwnCount).toBe(1)
  })

  it('silently ignores unknown role codes rather than throwing', () => {
    expect(resolveEffectivePermissions(['NOT_A_REAL_ROLE'])).toEqual([])
  })

  it('an empty role list resolves to no permissions', () => {
    expect(resolveEffectivePermissions([])).toEqual([])
  })

  it('accepts a caller-supplied role registry instead of the built-in one', () => {
    const customRegistry = new Map([['CUSTOM', { code: 'CUSTOM', permissions: [{ resource: 'x', action: 'y', scope: 'OWN' as const }] }]])
    expect(resolveEffectivePermissions(['CUSTOM'], customRegistry)).toEqual([{ resource: 'x', action: 'y', scope: 'OWN' }])
  })
})

describe('Determinism -- resolving the same role codes twice yields identical results', () => {
  it('is a pure function', () => {
    expect(resolveEffectivePermissions(['SERVICE'])).toEqual(resolveEffectivePermissions(['SERVICE']))
  })
})
