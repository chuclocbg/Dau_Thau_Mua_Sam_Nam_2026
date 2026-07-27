import { describe, it, expect } from 'vitest'
import { AuthError } from '../auth/types/authTypes.ts'
import type { PasswordCredentials, TokenCredentials } from '../auth/types/authTypes.ts'
import {
  validateCredentials, validateUser, validateRole, validatePermission,
  validateDelegation, validatePolicy, validateApprovalHierarchy,
} from '../auth/validation/authValidation.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const legalBasis = [{
  document: 'NĐ-63', article: '1', clause: '', point: '', appendix: '',
  effectiveDate: '2020-01-01', issuingAuthority: 'CP', summary: '', url: '',
}]

// ── validateCredentials ───────────────────────────────────────────────────────

describe('validateCredentials', () => {
  it('passes for valid password credentials', () => {
    expect(() => validateCredentials({ credentialType: 'password', username: 'alice', password: 'secret' } as PasswordCredentials)).not.toThrow()
  })

  it('throws when credentialType is empty', () => {
    expect(() => validateCredentials({ credentialType: '' })).toThrow(AuthError)
  })

  it('throws when password credentials missing username', () => {
    expect(() => validateCredentials({ credentialType: 'password', password: 'secret' } as never)).toThrow(AuthError)
  })

  it('throws when password credentials missing password', () => {
    expect(() => validateCredentials({ credentialType: 'password', username: 'alice' } as never)).toThrow(AuthError)
  })

  it('throws when token credentials missing token', () => {
    expect(() => validateCredentials({ credentialType: 'token' } as never)).toThrow(AuthError)
  })

  it('passes for valid token credentials', () => {
    expect(() => validateCredentials({ credentialType: 'token', token: 'abc123' } as TokenCredentials)).not.toThrow()
  })
})

// ── validateUser ──────────────────────────────────────────────────────────────

describe('validateUser', () => {
  const valid = { username: 'alice', email: 'alice@example.com', displayName: 'Alice', departmentId: 'dept-1' }

  it('passes for valid user data', () => {
    expect(() => validateUser(valid)).not.toThrow()
  })

  it('throws when username is empty', () => {
    expect(() => validateUser({ ...valid, username: '' })).toThrow(AuthError)
  })

  it('throws when email is invalid', () => {
    expect(() => validateUser({ ...valid, email: 'not-an-email' })).toThrow(AuthError)
  })

  it('throws when displayName is missing', () => {
    expect(() => validateUser({ ...valid, displayName: '' })).toThrow(AuthError)
  })

  it('throws when departmentId is missing', () => {
    expect(() => validateUser({ ...valid, departmentId: '' })).toThrow(AuthError)
  })
})

// ── validateRole ──────────────────────────────────────────────────────────────

describe('validateRole', () => {
  it('passes for valid role', () => {
    expect(() => validateRole({ code: 'PROCUREMENT_OFFICER', name: 'Officer' })).not.toThrow()
  })

  it('throws when code is empty', () => {
    expect(() => validateRole({ code: '', name: 'Officer' })).toThrow(AuthError)
  })

  it('throws when code has lowercase letters', () => {
    expect(() => validateRole({ code: 'officer', name: 'Officer' })).toThrow(AuthError)
  })

  it('throws when name is empty', () => {
    expect(() => validateRole({ code: 'OFFICER', name: '' })).toThrow(AuthError)
  })
})

// ── validatePermission ────────────────────────────────────────────────────────

describe('validatePermission', () => {
  it('passes for valid permission', () => {
    expect(() => validatePermission({ resource: 'PACKAGE', action: 'READ', scope: 'OWN' })).not.toThrow()
  })

  it('throws when resource is empty', () => {
    expect(() => validatePermission({ resource: '', action: 'READ', scope: 'OWN' })).toThrow(AuthError)
  })

  it('throws when action is empty', () => {
    expect(() => validatePermission({ resource: 'PACKAGE', action: '', scope: 'OWN' })).toThrow(AuthError)
  })

  it('throws when scope is invalid', () => {
    expect(() => validatePermission({ resource: 'PACKAGE', action: 'READ', scope: 'GLOBAL' as never })).toThrow(AuthError)
  })
})

// ── validateDelegation ────────────────────────────────────────────────────────

describe('validateDelegation', () => {
  const valid = {
    fromUserId: 'user-A', toUserId: 'user-B', reason: 'Coverage',
    validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-12-31T00:00:00.000Z',
    legalBasis, permissionIds: ['p1'], scope: 'DEPARTMENT' as const,
  }

  it('passes for valid delegation', () => {
    expect(() => validateDelegation(valid)).not.toThrow()
  })

  it('throws when fromUserId is empty', () => {
    expect(() => validateDelegation({ ...valid, fromUserId: '' })).toThrow(AuthError)
  })

  it('throws when delegating to self', () => {
    expect(() => validateDelegation({ ...valid, toUserId: 'user-A' })).toThrow(AuthError)
  })

  it('throws when legalBasis is empty', () => {
    expect(() => validateDelegation({ ...valid, legalBasis: [] })).toThrow(AuthError)
  })

  it('throws when permissionIds is empty', () => {
    expect(() => validateDelegation({ ...valid, permissionIds: [] })).toThrow(AuthError)
  })

  it('throws when validFrom is invalid ISO 8601', () => {
    expect(() => validateDelegation({ ...valid, validFrom: 'not-a-date' })).toThrow(AuthError)
  })
})

// ── validatePolicy ────────────────────────────────────────────────────────────

describe('validatePolicy', () => {
  const valid = { name: 'Test Policy', resource: 'PACKAGE', action: 'APPROVE', effect: 'ALLOW' as const, priority: 10 }

  it('passes for valid policy', () => {
    expect(() => validatePolicy(valid)).not.toThrow()
  })

  it('throws when name is empty', () => {
    expect(() => validatePolicy({ ...valid, name: '' })).toThrow(AuthError)
  })

  it('throws when effect is invalid', () => {
    expect(() => validatePolicy({ ...valid, effect: 'GRANT' as never })).toThrow(AuthError)
  })

  it('throws when priority is negative', () => {
    expect(() => validatePolicy({ ...valid, priority: -1 })).toThrow(AuthError)
  })
})

// ── validateApprovalHierarchy ─────────────────────────────────────────────────

describe('validateApprovalHierarchy', () => {
  const valid = {
    userId: 'user-1', departmentId: 'dept-1', authorityLevel: 1,
    valueThreshold: 1_000_000_000n, effectiveFrom: '2026-01-01T00:00:00.000Z', legalBasis,
  }

  it('passes for valid hierarchy', () => {
    expect(() => validateApprovalHierarchy(valid)).not.toThrow()
  })

  it('throws when userId is empty', () => {
    expect(() => validateApprovalHierarchy({ ...valid, userId: '' })).toThrow(AuthError)
  })

  it('throws when authorityLevel is 0', () => {
    expect(() => validateApprovalHierarchy({ ...valid, authorityLevel: 0 })).toThrow(AuthError)
  })

  it('throws when valueThreshold is negative', () => {
    expect(() => validateApprovalHierarchy({ ...valid, valueThreshold: -1n })).toThrow(AuthError)
  })

  it('throws when legalBasis is empty', () => {
    expect(() => validateApprovalHierarchy({ ...valid, legalBasis: [] })).toThrow(AuthError)
  })
})
