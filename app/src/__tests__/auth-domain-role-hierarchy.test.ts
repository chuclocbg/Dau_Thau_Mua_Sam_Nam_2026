import { describe, it, expect } from 'vitest'
import type { Role, Permission } from '../auth/types/authTypes.ts'
import { AuthError } from '../auth/types/authTypes.ts'
import {
  buildRoleAncestors, detectRoleCycle, getRoleDepth, resolveInheritedPermissions,
} from '../auth/domain/roleHierarchy.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeRole = (id: string, permIds: string[] = [], parentRoleId?: string): Role => ({
  id, code: id.toUpperCase(), name: id, permissionIds: permIds, isActive: true,
  parentRoleId, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

const makePerm = (id: string): Permission => ({
  id, resource: 'PACKAGE', action: 'READ', scope: 'OWN',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

// officer → manager → director
const officer = makeRole('officer', ['p-read'], 'manager')
const manager = makeRole('manager', ['p-approve'], 'director')
const director = makeRole('director', ['p-admin'])

const roleMap = new Map([
  [officer.id, officer],
  [manager.id, manager],
  [director.id, director],
])

const permMap = new Map([
  ['p-read', makePerm('p-read')],
  ['p-approve', makePerm('p-approve')],
  ['p-admin', makePerm('p-admin')],
])

// ── buildRoleAncestors ────────────────────────────────────────────────────────

describe('buildRoleAncestors', () => {
  it('returns chain for officer', () => {
    const ancestors = buildRoleAncestors('officer', roleMap)
    expect(ancestors).toEqual(['manager', 'director'])
  })

  it('returns empty for root role (no parent)', () => {
    const ancestors = buildRoleAncestors('director', roleMap)
    expect(ancestors).toHaveLength(0)
  })

  it('throws on cycle', () => {
    const cycleMap = new Map([
      ['a', makeRole('a', [], 'b')],
      ['b', makeRole('b', [], 'a')],
    ])
    expect(() => buildRoleAncestors('a', cycleMap)).toThrow(AuthError)
  })

  it('returns empty for unknown role', () => {
    expect(buildRoleAncestors('unknown', roleMap)).toHaveLength(0)
  })
})

// ── detectRoleCycle ───────────────────────────────────────────────────────────

describe('detectRoleCycle', () => {
  it('detects direct cycle: a→b, setting b.parent=a', () => {
    const m = new Map([['a', makeRole('a', [], 'b')], ['b', makeRole('b')]])
    expect(detectRoleCycle('b', 'a', m)).toBe(true)
  })

  it('detects indirect cycle: a→b→c, setting c.parent=a', () => {
    const m = new Map([
      ['a', makeRole('a', [], 'b')],
      ['b', makeRole('b', [], 'c')],
      ['c', makeRole('c')],
    ])
    expect(detectRoleCycle('c', 'a', m)).toBe(true)
  })

  it('no cycle for valid parent assignment', () => {
    expect(detectRoleCycle('officer', 'new-parent', roleMap)).toBe(false)
  })

  it('no cycle when assigning root parent', () => {
    expect(detectRoleCycle('director', 'super-admin', new Map())).toBe(false)
  })
})

// ── getRoleDepth ──────────────────────────────────────────────────────────────

describe('getRoleDepth', () => {
  it('depth 0 for root role', () => {
    expect(getRoleDepth('director', roleMap)).toBe(0)
  })

  it('depth 1 for manager', () => {
    expect(getRoleDepth('manager', roleMap)).toBe(1)
  })

  it('depth 2 for officer', () => {
    expect(getRoleDepth('officer', roleMap)).toBe(2)
  })

  it('depth 0 for unknown role', () => {
    expect(getRoleDepth('unknown', roleMap)).toBe(0)
  })
})

// ── resolveInheritedPermissions ───────────────────────────────────────────────

describe('resolveInheritedPermissions', () => {
  it('includes own permissions and all ancestor permissions', () => {
    const result = resolveInheritedPermissions(officer, roleMap, permMap)
    const ids = result.map(p => p.id)
    expect(ids).toContain('p-read')
    expect(ids).toContain('p-approve')
    expect(ids).toContain('p-admin')
  })

  it('root role returns only its own permissions', () => {
    const result = resolveInheritedPermissions(director, roleMap, permMap)
    expect(result.map(p => p.id)).toEqual(['p-admin'])
  })

  it('deduplicates permissions appearing in multiple levels', () => {
    // officer and director both have 'p-read'
    const directorWithShared = { ...director, permissionIds: ['p-admin', 'p-read'] }
    const m = new Map(roleMap)
    m.set('director', directorWithShared)
    const result = resolveInheritedPermissions(officer, m, permMap)
    expect(result.filter(p => p.id === 'p-read')).toHaveLength(1)
  })

  it('skips permissions not in permMap', () => {
    const roleWithUnknown = makeRole('r', ['p-unknown'], undefined)
    const result = resolveInheritedPermissions(roleWithUnknown, new Map(), permMap)
    expect(result).toHaveLength(0)
  })

  it('handles role with no parent', () => {
    const solo = makeRole('solo', ['p-read'])
    const result = resolveInheritedPermissions(solo, new Map(), permMap)
    expect(result.map(p => p.id)).toEqual(['p-read'])
  })
})
