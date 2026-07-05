import { describe, it, expect, beforeEach } from 'vitest'
import type { User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy } from '../auth/types/authTypes.ts'
import {
  MemoryUserRepository, MemoryRoleRepository, MemoryPermissionRepository,
  MemorySessionRepository, MemoryDelegationRepository,
  MemoryApprovalHierarchyRepository, MemoryPolicyRepository,
  MemoryAuditEventRepository, buildMemoryAuthRepositories,
} from '../auth/infrastructure/memoryAuthRepositories.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const legalBasis = [{ document: 'NĐ-63', article: '1', clause: '', point: '', appendix: '', effectiveDate: '2020-01-01', issuingAuthority: 'CP', summary: '', url: '' }]

const userBase = (): Omit<User, 'id' | 'createdAt' | 'updatedAt'> => ({
  username: 'alice', email: 'alice@example.com', displayName: 'Alice',
  departmentId: 'dept-1', roleIds: ['r1'], isActive: true, isLocked: false, failedLoginCount: 0,
})

const roleBase = (): Omit<Role, 'id' | 'createdAt' | 'updatedAt'> => ({
  code: 'OFFICER', name: 'Officer', permissionIds: ['p1'], isActive: true,
})

const permBase = (): Omit<Permission, 'id' | 'createdAt' | 'updatedAt'> => ({
  resource: 'PACKAGE', action: 'READ', scope: 'OWN',
})

const sessionBase = (): Omit<Session, 'id' | 'createdAt' | 'updatedAt'> => ({
  userId: 'user-1', refreshTokenHash: 'hash-1',
  issuedAt: '2026-01-01T08:00:00.000Z', expiresAt: '2099-01-01T16:00:00.000Z',
  refreshExpiresAt: '2099-01-08T08:00:00.000Z',
})

const delegBase = (): Omit<DelegationGrant, 'id' | 'createdAt' | 'updatedAt'> => ({
  fromUserId: 'user-A', toUserId: 'user-B', permissionIds: ['p1'],
  scope: 'DEPARTMENT', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2099-12-31T00:00:00.000Z',
  reason: 'Cover', legalBasis,
})

const hierBase = (): Omit<ApprovalHierarchy, 'id' | 'createdAt' | 'updatedAt'> => ({
  userId: 'user-1', departmentId: 'dept-1', authorityLevel: 1,
  valueThreshold: 2_000_000_000n, packageTypes: ['goods'],
  effectiveFrom: '2026-01-01T00:00:00.000Z', legalBasis,
})

const policyBase = (): Omit<Policy, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Test', resource: 'PACKAGE', action: 'APPROVE', effect: 'ALLOW',
  conditions: {}, priority: 10, isActive: true,
})

// ── User repo ─────────────────────────────────────────────────────────────────

describe('MemoryUserRepository', () => {
  let repo: MemoryUserRepository
  beforeEach(() => { repo = new MemoryUserRepository() })

  it('creates a user with generated id/timestamps', async () => {
    const u = await repo.create(userBase())
    expect(u.id).toBeTruthy()
    expect(u.username).toBe('alice')
    expect(u.createdAt).toBeTruthy()
  })

  it('findById returns user', async () => {
    const u = await repo.create(userBase())
    expect(await repo.findById(u.id)).toEqual(u)
  })

  it('findByUsername returns user', async () => {
    const u = await repo.create(userBase())
    expect((await repo.findByUsername('alice'))?.id).toBe(u.id)
  })

  it('findByEmail returns user', async () => {
    const u = await repo.create(userBase())
    expect((await repo.findByEmail('alice@example.com'))?.id).toBe(u.id)
  })

  it('findByExternalId returns user', async () => {
    const u = await repo.create({ ...userBase(), externalId: 'ldap-123', externalProvider: 'ldap' })
    expect((await repo.findByExternalId('ldap-123', 'ldap'))?.id).toBe(u.id)
  })

  it('findActive returns only active users', async () => {
    await repo.create(userBase())
    await repo.create({ ...userBase(), username: 'bob', email: 'bob@x.com', isActive: false })
    const active = await repo.findActive()
    expect(active.every(u => u.isActive)).toBe(true)
  })

  it('update changes fields', async () => {
    const u = await repo.create(userBase())
    const updated = await repo.update(u.id, { failedLoginCount: 3 })
    expect(updated.failedLoginCount).toBe(3)
  })

  it('delete removes user', async () => {
    const u = await repo.create(userBase())
    await repo.delete(u.id)
    expect(await repo.findById(u.id)).toBeNull()
  })

  it('count returns total', async () => {
    await repo.create(userBase())
    await repo.create({ ...userBase(), username: 'bob', email: 'bob@x.com' })
    expect(await repo.count()).toBe(2)
  })
})

// ── Role repo ─────────────────────────────────────────────────────────────────

describe('MemoryRoleRepository', () => {
  let repo: MemoryRoleRepository
  beforeEach(() => { repo = new MemoryRoleRepository() })

  it('findByCode works', async () => {
    const r = await repo.create(roleBase())
    expect((await repo.findByCode('OFFICER'))?.id).toBe(r.id)
  })

  it('findByIds returns matching roles', async () => {
    const r1 = await repo.create(roleBase())
    const r2 = await repo.create({ ...roleBase(), code: 'MANAGER' })
    const found = await repo.findByIds([r1.id, r2.id])
    expect(found).toHaveLength(2)
  })

  it('findChildren returns roles with matching parentRoleId', async () => {
    const parent = await repo.create(roleBase())
    await repo.create({ ...roleBase(), code: 'CHILD', parentRoleId: parent.id })
    const children = await repo.findChildren(parent.id)
    expect(children).toHaveLength(1)
    expect(children[0].code).toBe('CHILD')
  })
})

// ── Permission repo ───────────────────────────────────────────────────────────

describe('MemoryPermissionRepository', () => {
  let repo: MemoryPermissionRepository
  beforeEach(() => { repo = new MemoryPermissionRepository() })

  it('findByResource returns matching permissions', async () => {
    await repo.create(permBase())
    await repo.create({ ...permBase(), resource: 'CONTRACT' })
    const found = await repo.findByResource('PACKAGE')
    expect(found).toHaveLength(1)
  })

  it('findByResourceAndAction is specific', async () => {
    await repo.create(permBase())
    await repo.create({ ...permBase(), action: 'WRITE' })
    const found = await repo.findByResourceAndAction('PACKAGE', 'READ')
    expect(found).toHaveLength(1)
  })
})

// ── Session repo ──────────────────────────────────────────────────────────────

describe('MemorySessionRepository', () => {
  let repo: MemorySessionRepository
  beforeEach(() => { repo = new MemorySessionRepository() })

  it('findActive returns active session', async () => {
    const s = await repo.create(sessionBase())
    const found = await repo.findActive(s.id)
    expect(found?.id).toBe(s.id)
  })

  it('findActive returns null for revoked session', async () => {
    const s = await repo.create(sessionBase())
    await repo.revokeBySessionId(s.id, 'admin')
    expect(await repo.findActive(s.id)).toBeNull()
  })

  it('revokeByUserId revokes all sessions for user', async () => {
    const s1 = await repo.create(sessionBase())
    const s2 = await repo.create(sessionBase())
    await repo.revokeByUserId('user-1', 'admin')
    expect(await repo.findActive(s1.id)).toBeNull()
    expect(await repo.findActive(s2.id)).toBeNull()
  })

  it('cleanExpired removes past-expiry sessions', async () => {
    await repo.create({ ...sessionBase(), expiresAt: '2020-01-01T00:00:00.000Z' })
    await repo.create(sessionBase()) // far future
    const removed = await repo.cleanExpired()
    expect(removed).toBe(1)
    expect(await repo.count()).toBe(1)
  })
})

// ── Delegation repo ───────────────────────────────────────────────────────────

describe('MemoryDelegationRepository', () => {
  let repo: MemoryDelegationRepository
  beforeEach(() => { repo = new MemoryDelegationRepository() })

  it('findActive returns active delegations for toUser', async () => {
    await repo.create(delegBase())
    const active = await repo.findActive('user-B', '2026-06-01T00:00:00.000Z')
    expect(active).toHaveLength(1)
  })

  it('findActive excludes revoked', async () => {
    const d = await repo.create(delegBase())
    await repo.update(d.id, { revokedAt: '2026-05-01T00:00:00.000Z' })
    const active = await repo.findActive('user-B', '2026-06-01T00:00:00.000Z')
    expect(active).toHaveLength(0)
  })
})

// ── ApprovalHierarchy repo ────────────────────────────────────────────────────

describe('MemoryApprovalHierarchyRepository', () => {
  let repo: MemoryApprovalHierarchyRepository
  beforeEach(() => { repo = new MemoryApprovalHierarchyRepository() })

  it('findActive returns active hierarchies', async () => {
    await repo.create(hierBase())
    const active = await repo.findActive('user-1', '2026-06-01T00:00:00.000Z')
    expect(active).toHaveLength(1)
  })

  it('findByAuthorityLevel works', async () => {
    await repo.create(hierBase())
    await repo.create({ ...hierBase(), authorityLevel: 2 })
    expect(await repo.findByAuthorityLevel(1)).toHaveLength(1)
  })
})

// ── Policy repo ───────────────────────────────────────────────────────────────

describe('MemoryPolicyRepository', () => {
  let repo: MemoryPolicyRepository
  beforeEach(() => { repo = new MemoryPolicyRepository() })

  it('findActive returns only active policies', async () => {
    await repo.create(policyBase())
    await repo.create({ ...policyBase(), name: 'Inactive', isActive: false })
    expect(await repo.findActive()).toHaveLength(1)
  })

  it('findApplicable returns matching policies', async () => {
    await repo.create(policyBase())
    await repo.create({ ...policyBase(), name: 'Other', resource: 'CONTRACT' })
    const found = await repo.findApplicable('PACKAGE', 'APPROVE')
    expect(found).toHaveLength(1)
  })

  it('findApplicable includes wildcard resource policies', async () => {
    await repo.create({ ...policyBase(), resource: '*', action: '*' })
    const found = await repo.findApplicable('CONTRACT', 'READ')
    expect(found).toHaveLength(1)
  })
})

// ── Audit repo ────────────────────────────────────────────────────────────────

describe('MemoryAuditEventRepository', () => {
  let repo: MemoryAuditEventRepository
  beforeEach(() => { repo = new MemoryAuditEventRepository() })

  it('append creates event with id and createdAt', async () => {
    const e = await repo.append({
      eventType: 'LOGIN', userId: 'user-1', outcome: 'SUCCESS',
      metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z',
    })
    expect(e.id).toBeTruthy()
    expect(e.createdAt).toBeTruthy()
  })

  it('findByUserId returns events for user', async () => {
    await repo.append({ eventType: 'LOGIN', userId: 'user-1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    await repo.append({ eventType: 'LOGOUT', userId: 'user-2', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    const events = await repo.findByUserId('user-1')
    expect(events).toHaveLength(1)
    expect(events[0].userId).toBe('user-1')
  })

  it('findByEventType filters correctly', async () => {
    await repo.append({ eventType: 'LOGIN', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    await repo.append({ eventType: 'LOGOUT', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    expect(await repo.findByEventType('LOGIN')).toHaveLength(1)
  })
})

// ── buildMemoryAuthRepositories ───────────────────────────────────────────────

describe('buildMemoryAuthRepositories', () => {
  it('returns all 8 repositories', () => {
    const repos = buildMemoryAuthRepositories()
    expect(repos.users).toBeDefined()
    expect(repos.roles).toBeDefined()
    expect(repos.permissions).toBeDefined()
    expect(repos.sessions).toBeDefined()
    expect(repos.delegations).toBeDefined()
    expect(repos.approvalHierarchies).toBeDefined()
    expect(repos.policies).toBeDefined()
    expect(repos.auditEvents).toBeDefined()
  })
})
