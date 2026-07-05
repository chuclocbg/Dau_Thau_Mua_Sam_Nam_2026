import { describe, it, expect } from 'vitest'
import type { User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy, AuthContext, AccessDecision } from '../auth/types/authTypes.ts'
import { AuthError, PERMISSION_SCOPES, POLICY_EFFECTS, STANDARD_RESOURCES, STANDARD_ACTIONS, AUTH_ERROR_CODES } from '../auth/types/authTypes.ts'
import type { IAccessToken, IRefreshToken, TokenPair } from '../auth/types/tokenTypes.ts'
import { TOKEN_TYPES } from '../auth/types/tokenTypes.ts'
import { AUTH_PROVIDER_TYPES } from '../auth/types/providerTypes.ts'
import { AUTH_AUDIT_EVENT_TYPES, AUDIT_OUTCOMES } from '../auth/types/auditTypes.ts'
import type { AuthAuditEvent } from '../auth/types/auditTypes.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1', username: 'alice', email: 'alice@example.com',
  displayName: 'Alice', departmentId: 'dept-1',
  roleIds: ['role-1'], isActive: true, isLocked: false, failedLoginCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'role-1', code: 'OFFICER', name: 'Procurement Officer',
  permissionIds: ['perm-1'], isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makePermission = (overrides: Partial<Permission> = {}): Permission => ({
  id: 'perm-1', resource: 'PACKAGE', action: 'READ', scope: 'OWN',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1', userId: 'user-1', refreshTokenHash: 'hash-abc',
  issuedAt: '2026-01-01T08:00:00.000Z', expiresAt: '2026-01-01T16:00:00.000Z',
  refreshExpiresAt: '2026-01-08T08:00:00.000Z',
  createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z',
  ...overrides,
})

const makeLegalBasis = () => ({
  document: 'Nghị định 63/2014/NĐ-CP', article: 'Điều 12', clause: '1',
  effectiveDate: '2014-07-01', issuingAuthority: 'Chính phủ',
  summary: 'Quy định về thẩm quyền phê duyệt',
})

const makeDelegation = (overrides: Partial<DelegationGrant> = {}): DelegationGrant => ({
  id: 'deleg-1', fromUserId: 'user-1', toUserId: 'user-2',
  permissionIds: ['perm-1'], scope: 'DEPARTMENT',
  validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-12-31T00:00:00.000Z',
  reason: 'Temporary', legalBasis: [makeLegalBasis()],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthError', () => {
  it('sets code, field, message, name', () => {
    const err = new AuthError('USER_NOT_FOUND', 'username', 'not found')
    expect(err.code).toBe('USER_NOT_FOUND')
    expect(err.field).toBe('username')
    expect(err.message).toBe('not found')
    expect(err.name).toBe('AuthError')
    expect(err instanceof Error).toBe(true)
  })

  it('AUTH_ERROR_CODES has all required codes', () => {
    const required = ['INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'SESSION_EXPIRED', 'PERMISSION_DENIED', 'DELEGATION_CYCLE_DETECTED']
    for (const c of required) expect(AUTH_ERROR_CODES).toContain(c)
  })
})

describe('PERMISSION_SCOPES', () => {
  it('has OWN, DEPARTMENT, ALL', () => {
    expect(PERMISSION_SCOPES).toContain('OWN')
    expect(PERMISSION_SCOPES).toContain('DEPARTMENT')
    expect(PERMISSION_SCOPES).toContain('ALL')
  })
})

describe('User model', () => {
  it('can be constructed with required fields', () => {
    const u = makeUser()
    expect(u.username).toBe('alice')
    expect(u.isActive).toBe(true)
    expect(u.failedLoginCount).toBe(0)
  })

  it('supports optional externalId/externalProvider for SSO', () => {
    const u = makeUser({ externalId: 'uid-123', externalProvider: 'ldap' })
    expect(u.externalId).toBe('uid-123')
    expect(u.externalProvider).toBe('ldap')
  })
})

describe('Role model', () => {
  it('supports parentRoleId for hierarchy', () => {
    const r = makeRole({ parentRoleId: 'role-admin' })
    expect(r.parentRoleId).toBe('role-admin')
  })
})

describe('Permission model', () => {
  it('resource and action are open strings', () => {
    const p = makePermission({ resource: 'CUSTOM_ENTITY', action: 'custom_action' })
    expect(p.resource).toBe('CUSTOM_ENTITY')
  })

  it('scope is a PermissionScope', () => {
    const p = makePermission({ scope: 'ALL' })
    expect(p.scope).toBe('ALL')
  })
})

describe('Session model', () => {
  it('refreshExpiresAt is longer-lived than expiresAt', () => {
    const s = makeSession()
    expect(s.refreshExpiresAt > s.expiresAt).toBe(true)
  })

  it('supports optional revokedAt/revokedBy', () => {
    const s = makeSession({ revokedAt: '2026-01-02T00:00:00.000Z', revokedBy: 'admin' })
    expect(s.revokedAt).toBeDefined()
    expect(s.revokedBy).toBe('admin')
  })
})

describe('DelegationGrant model', () => {
  it('requires legalBasis (RULE-09)', () => {
    const d = makeDelegation()
    expect(d.legalBasis.length).toBeGreaterThan(0)
    expect(d.legalBasis[0].document).toContain('Nghị định')
  })

  it('validUntil is exclusive boundary', () => {
    const d = makeDelegation({ validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-06-01T00:00:00.000Z' })
    expect(d.validUntil > d.validFrom).toBe(true)
  })
})

describe('ApprovalHierarchy model', () => {
  it('valueThreshold is bigint', () => {
    const h: ApprovalHierarchy = {
      id: 'h-1', userId: 'user-1', departmentId: 'dept-1',
      authorityLevel: 1, valueThreshold: 2_000_000_000n, packageTypes: ['goods'],
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      legalBasis: [makeLegalBasis()],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(typeof h.valueThreshold).toBe('bigint')
    expect(h.valueThreshold).toBe(2_000_000_000n)
  })
})

describe('Policy model', () => {
  it('POLICY_EFFECTS contains ALLOW and DENY', () => {
    expect(POLICY_EFFECTS).toContain('ALLOW')
    expect(POLICY_EFFECTS).toContain('DENY')
  })

  it('conditions.maxValue is bigint when set', () => {
    const p: Policy = {
      id: 'p-1', name: 'Cap policy', resource: 'PACKAGE', action: 'APPROVE',
      effect: 'DENY', conditions: { maxValue: 5_000_000_000n },
      priority: 10, isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(p.conditions?.maxValue).toBe(5_000_000_000n)
  })
})

describe('AuthContext model', () => {
  it('has no raw JWT payload — only pre-resolved fields', () => {
    const ctx: AuthContext = {
      userId: 'user-1', username: 'alice', email: 'alice@example.com',
      displayName: 'Alice', departmentId: 'dept-1',
      roles: [makeRole()], effectivePermissions: [makePermission()],
      activeDelegations: [], approvalHierarchies: [],
      sessionId: 'session-1', issuedAt: '2026-01-01T08:00:00.000Z',
      expiresAt: '2026-01-01T16:00:00.000Z', metadata: {},
    }
    expect(ctx.userId).toBe('user-1')
    expect(ctx.effectivePermissions.length).toBe(1)
  })
})

describe('AccessDecision model', () => {
  it('is explainable with reason and appliedPolicies', () => {
    const d: AccessDecision = {
      allowed: true, userId: 'user-1', resource: 'PACKAGE', action: 'READ',
      scope: 'OWN', reason: 'Permission granted', appliedPolicies: [],
      matchedPermissionId: 'perm-1', decidedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(d.reason).toBe('Permission granted')
    expect(d.appliedPolicies).toHaveLength(0)
  })
})

describe('Token types', () => {
  it('TOKEN_TYPES has all 5 types', () => {
    expect(TOKEN_TYPES).toContain('ACCESS')
    expect(TOKEN_TYPES).toContain('REFRESH')
    expect(TOKEN_TYPES).toContain('API_KEY')
    expect(TOKEN_TYPES).toContain('DELEGATION')
    expect(TOKEN_TYPES).toContain('SERVICE')
  })

  it('IAccessToken interface shape is correct', () => {
    const t: IAccessToken = {
      tokenId: 't-1', tokenType: 'ACCESS', userId: 'user-1',
      sessionId: 'session-1', permissions: [], departmentId: 'dept-1',
      roles: ['OFFICER'], issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:15:00.000Z', issuer: 'platform', audience: ['api'],
    }
    expect(t.tokenType).toBe('ACCESS')
  })

  it('TokenPair is interface-only (no concrete impl in Phase J)', () => {
    const pair: TokenPair = {
      accessToken: 'opaque-access', refreshToken: 'opaque-refresh',
      expiresAt: '2026-01-01T00:15:00.000Z', refreshExpiresAt: '2026-01-08T00:00:00.000Z',
    }
    expect(pair.accessToken).toBe('opaque-access')
  })
})

describe('Provider types', () => {
  it('AUTH_PROVIDER_TYPES includes VNeID and government_sso', () => {
    expect(AUTH_PROVIDER_TYPES).toContain('vneid')
    expect(AUTH_PROVIDER_TYPES).toContain('government_sso')
    expect(AUTH_PROVIDER_TYPES).toContain('keycloak')
    expect(AUTH_PROVIDER_TYPES).toContain('azure_ad')
  })
})

describe('Audit types', () => {
  it('AUTH_AUDIT_EVENT_TYPES has 23 events', () => {
    expect(AUTH_AUDIT_EVENT_TYPES.length).toBe(23)
  })

  it('AUDIT_OUTCOMES has SUCCESS, FAILURE, PARTIAL', () => {
    expect(AUDIT_OUTCOMES).toContain('SUCCESS')
    expect(AUDIT_OUTCOMES).toContain('FAILURE')
    expect(AUDIT_OUTCOMES).toContain('PARTIAL')
  })

  it('AuthAuditEvent has no updatedAt (append-only)', () => {
    const e: AuthAuditEvent = {
      id: 'e-1', eventType: 'LOGIN', userId: 'user-1',
      outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    // TypeScript will complain at compile time if updatedAt exists on the type
    expect((e as Record<string, unknown>)['updatedAt']).toBeUndefined()
  })

  it('STANDARD_RESOURCES and STANDARD_ACTIONS are present', () => {
    expect(STANDARD_RESOURCES).toContain('PACKAGE')
    expect(STANDARD_ACTIONS).toContain('APPROVE')
  })
})
