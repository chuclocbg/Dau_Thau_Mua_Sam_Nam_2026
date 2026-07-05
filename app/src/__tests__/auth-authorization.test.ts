import { describe, it, expect, beforeEach } from 'vitest'
import type { AuthContext, Role, Permission, DelegationGrant } from '../auth/types/authTypes.ts'
import { buildMemoryAuthRepositories } from '../auth/infrastructure/memoryAuthRepositories.ts'
import { checkPermission, authorize, checkPermissions } from '../auth/application/authorizationService.ts'

// ── Fixtures ───────────────────────��────────────────────────────��─────────────

const makePerm = (id: string, resource: string, action: string, scope: Permission['scope']): Permission => ({
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

// ── checkPermission (sync) ───────────���────────────────────────────────────────

describe('checkPermission', () => {
  it('returns true when effective permission matches', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'OWN')).toBe(true)
  })

  it('returns false when no matching permission', () => {
    const ctx = makeCtx([])
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'OWN')).toBe(false)
  })

  it('returns false when scope is insufficient', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'DEPARTMENT')).toBe(false)
  })

  it('ALL scope permission satisfies any scope requirement', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'ALL')])
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'OWN')).toBe(true)
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'DEPARTMENT')).toBe(true)
    expect(checkPermission(ctx, 'PACKAGE', 'READ', 'ALL')).toBe(true)
  })

  it('wildcard resource permission matches any resource', () => {
    const ctx = makeCtx([makePerm('p1', '*', 'READ', 'ALL')])
    expect(checkPermission(ctx, 'CONTRACT', 'READ', 'OWN')).toBe(true)
  })
})

// ── checkPermissions (bulk) ───────────────────────────────────────────────────

describe('checkPermissions', () => {
  it('returns a map of checks', () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    const result = checkPermissions(ctx, [
      { resource: 'PACKAGE', action: 'READ', scope: 'OWN' },
      { resource: 'CONTRACT', action: 'READ', scope: 'OWN' },
    ])
    expect(result.get('PACKAGE:READ:OWN')).toBe(true)
    expect(result.get('CONTRACT:READ:OWN')).toBe(false)
  })

  it('empty checks returns empty map', () => {
    const ctx = makeCtx([])
    expect(checkPermissions(ctx, []).size).toBe(0)
  })
})

// ── authorize (async with policy evaluation) ─────────────────────────────────

describe('authorize', () => {
  let repos: ReturnType<typeof buildMemoryAuthRepositories>

  beforeEach(() => { repos = buildMemoryAuthRepositories() })

  it('ALLOW decision when permission matches and no policies', async () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'APPROVE', 'DEPARTMENT')])
    const decision = await authorize(ctx, 'PACKAGE', 'APPROVE', 'DEPARTMENT', repos)
    expect(decision.allowed).toBe(true)
    expect(decision.matchedPermissionId).toBe('p1')
  })

  it('DENY decision when no permission and no policies', async () => {
    const ctx = makeCtx([])
    const decision = await authorize(ctx, 'PACKAGE', 'APPROVE', 'DEPARTMENT', repos)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('No matching permission')
  })

  it('policy DENY overrides permission match', async () => {
    const now = '2026-01-01T00:00:00.000Z'
    await repos.policies.create({
      name: 'Block all APPROVE', resource: 'PACKAGE', action: 'APPROVE',
      effect: 'DENY', conditions: {}, priority: 1, isActive: true,
    })
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'APPROVE', 'DEPARTMENT')])
    const decision = await authorize(ctx, 'PACKAGE', 'APPROVE', 'DEPARTMENT', repos)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('Policy DENY')
    void now
  })

  it('policy ALLOW grants access without permission', async () => {
    await repos.policies.create({
      name: 'Allow read', resource: 'PACKAGE', action: 'READ',
      effect: 'ALLOW', conditions: {}, priority: 1, isActive: true,
    })
    const ctx = makeCtx([])
    const decision = await authorize(ctx, 'PACKAGE', 'READ', 'OWN', repos)
    expect(decision.allowed).toBe(true)
  })

  it('records ACCESS_GRANTED audit event', async () => {
    const ctx = makeCtx([makePerm('p1', 'PACKAGE', 'READ', 'OWN')])
    await authorize(ctx, 'PACKAGE', 'READ', 'OWN', repos)
    const events = await repos.auditEvents.findByUserId('user-1')
    expect(events.some(e => e.eventType === 'ACCESS_GRANTED')).toBe(true)
  })

  it('records ACCESS_DENIED audit event', async () => {
    const ctx = makeCtx([])
    await authorize(ctx, 'PACKAGE', 'READ', 'OWN', repos)
    const events = await repos.auditEvents.findByUserId('user-1')
    expect(events.some(e => e.eventType === 'ACCESS_DENIED')).toBe(true)
  })

  it('decision contains userId, resource, action, scope, decidedAt', async () => {
    const ctx = makeCtx([])
    const d = await authorize(ctx, 'CONTRACT', 'DELETE', 'ALL', repos)
    expect(d.userId).toBe('user-1')
    expect(d.resource).toBe('CONTRACT')
    expect(d.action).toBe('DELETE')
    expect(d.scope).toBe('ALL')
    expect(d.decidedAt).toBeTruthy()
  })

  it('resourceValue is passed through to policy evaluation', async () => {
    // ALLOW policy with maxValue=1M: applies (allows) only when value <= 1M
    // For value > 1M the policy doesn't match → fallback to permission check
    await repos.policies.create({
      name: 'Allow APPROVE up to 1M', resource: 'PACKAGE', action: 'APPROVE',
      effect: 'ALLOW', conditions: { maxValue: 1_000_000n }, priority: 1, isActive: true,
    })
    const ctxNoPerms = makeCtx([])
    // value <= 1M → policy matches → ALLOW
    const small = await authorize(ctxNoPerms, 'PACKAGE', 'APPROVE', 'ALL', repos, 500_000n)
    expect(small.allowed).toBe(true)
    // value > 1M → policy doesn't match → no permission → DENY
    const large = await authorize(ctxNoPerms, 'PACKAGE', 'APPROVE', 'ALL', repos, 2_000_000n)
    expect(large.allowed).toBe(false)
  })
})
