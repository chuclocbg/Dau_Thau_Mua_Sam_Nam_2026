import { describe, it, expect } from 'vitest'
import type { Policy, PolicyContext } from '../auth/types/authTypes.ts'
import {
  matchesPolicy, evaluatePolicy, evaluatePolicies, resolveHighestPriorityDecision,
} from '../auth/domain/policy.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'pol-1', name: 'Default', resource: 'PACKAGE', action: 'APPROVE',
  effect: 'ALLOW', conditions: {}, priority: 10, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeCtx = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  userId: 'user-1', departmentId: 'dept-1', resource: 'PACKAGE', action: 'APPROVE',
  scope: 'DEPARTMENT', ...overrides,
})

// ── matchesPolicy ─────────────────────────────────────────────────────────────

describe('matchesPolicy', () => {
  it('matches when all conditions satisfied', () => {
    expect(matchesPolicy(makePolicy(), makeCtx())).toBe(true)
  })

  it('does not match inactive policy', () => {
    expect(matchesPolicy(makePolicy({ isActive: false }), makeCtx())).toBe(false)
  })

  it('does not match different resource', () => {
    expect(matchesPolicy(makePolicy({ resource: 'CONTRACT' }), makeCtx())).toBe(false)
  })

  it('wildcard resource matches any', () => {
    expect(matchesPolicy(makePolicy({ resource: '*' }), makeCtx({ resource: 'CONTRACT' }))).toBe(true)
  })

  it('wildcard action matches any', () => {
    expect(matchesPolicy(makePolicy({ action: '*' }), makeCtx({ action: 'DELETE' }))).toBe(true)
  })

  it('requiredScope condition fails on mismatch', () => {
    const p = makePolicy({ conditions: { requiredScope: 'ALL' } })
    expect(matchesPolicy(p, makeCtx({ scope: 'OWN' }))).toBe(false)
  })

  it('requiredDepartments condition passes for matching department', () => {
    const p = makePolicy({ conditions: { requiredDepartments: ['dept-1', 'dept-2'] } })
    expect(matchesPolicy(p, makeCtx())).toBe(true)
  })

  it('requiredDepartments condition fails for non-matching department', () => {
    const p = makePolicy({ conditions: { requiredDepartments: ['dept-99'] } })
    expect(matchesPolicy(p, makeCtx())).toBe(false)
  })

  it('maxValue condition: fails when resourceValue exceeds limit', () => {
    const p = makePolicy({ conditions: { maxValue: 1_000_000n } })
    expect(matchesPolicy(p, makeCtx({ resourceValue: 2_000_000n }))).toBe(false)
  })

  it('maxValue condition: passes when resourceValue is within limit', () => {
    const p = makePolicy({ conditions: { maxValue: 5_000_000n } })
    expect(matchesPolicy(p, makeCtx({ resourceValue: 1_000_000n }))).toBe(true)
  })

  it('requiresDelegation condition: fails when hasDelegation not set', () => {
    const p = makePolicy({ conditions: { requiresDelegation: true } })
    expect(matchesPolicy(p, makeCtx())).toBe(false)
  })

  it('requiresDelegation condition: passes when hasDelegation=true attribute set', () => {
    const p = makePolicy({ conditions: { requiresDelegation: true } })
    expect(matchesPolicy(p, makeCtx({ attributes: { hasDelegation: 'true' } }))).toBe(true)
  })
})

// ── evaluatePolicy ────────────────────────────────────────────────────────────

describe('evaluatePolicy', () => {
  it('matched=true for a matching policy', () => {
    const result = evaluatePolicy(makePolicy(), makeCtx())
    expect(result.matched).toBe(true)
    expect(result.effect).toBe('ALLOW')
    expect(result.policyId).toBe('pol-1')
  })

  it('matched=false for non-matching policy', () => {
    const result = evaluatePolicy(makePolicy({ resource: 'OTHER' }), makeCtx())
    expect(result.matched).toBe(false)
  })
})

// ── evaluatePolicies ──────────────────────────────────────────────────────────

describe('evaluatePolicies', () => {
  it('returns null when no policies match', () => {
    const result = evaluatePolicies([], makeCtx())
    expect(result).toBeNull()
  })

  it('returns ALLOW when single matching ALLOW policy', () => {
    const result = evaluatePolicies([makePolicy()], makeCtx())
    expect(result?.effect).toBe('ALLOW')
  })

  it('DENY wins over ALLOW at same priority', () => {
    const allow = makePolicy({ id: 'p-allow', effect: 'ALLOW', priority: 10 })
    const deny = makePolicy({ id: 'p-deny', effect: 'DENY', priority: 10 })
    const result = evaluatePolicies([allow, deny], makeCtx())
    expect(result?.effect).toBe('DENY')
  })

  it('lower priority number wins over higher', () => {
    const high = makePolicy({ id: 'p-high', effect: 'ALLOW', priority: 1 })
    const low = makePolicy({ id: 'p-low', effect: 'DENY', priority: 100 })
    const result = evaluatePolicies([high, low], makeCtx())
    expect(result?.effect).toBe('ALLOW')
  })

  it('specific resource wins over wildcard at same priority', () => {
    const specific = makePolicy({ id: 'p-specific', resource: 'PACKAGE', effect: 'ALLOW', priority: 10 })
    const wildcard = makePolicy({ id: 'p-wildcard', resource: '*', effect: 'DENY', priority: 10 })
    const result = evaluatePolicies([specific, wildcard], makeCtx())
    expect(result?.effect).toBe('ALLOW')
  })

  it('includes all matched policy ids in result', () => {
    const p1 = makePolicy({ id: 'p1', priority: 1 })
    const p2 = makePolicy({ id: 'p2', priority: 10 })
    const result = evaluatePolicies([p1, p2], makeCtx())
    expect(result?.appliedPolicies).toContain('p1')
    expect(result?.appliedPolicies).toContain('p2')
  })
})

// ── resolveHighestPriorityDecision ────────────────────────────────────────────

describe('resolveHighestPriorityDecision', () => {
  it('ALLOW decision when permission matched and no blocking policy', () => {
    const d = resolveHighestPriorityDecision([], makeCtx(), true, 'perm-1')
    expect(d.allowed).toBe(true)
    expect(d.matchedPermissionId).toBe('perm-1')
    expect(d.reason).toBe('Permission granted')
  })

  it('DENY decision when no permission and no policy', () => {
    const d = resolveHighestPriorityDecision([], makeCtx(), false)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('No matching permission')
  })

  it('policy DENY overrides permission match', () => {
    const deny = makePolicy({ effect: 'DENY' })
    const d = resolveHighestPriorityDecision([deny], makeCtx(), true, 'perm-1')
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('Policy DENY')
  })

  it('policy ALLOW grants access even without permission', () => {
    const allow = makePolicy({ effect: 'ALLOW' })
    const d = resolveHighestPriorityDecision([allow], makeCtx(), false)
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe('Policy ALLOW')
  })

  it('decision includes userId, resource, action, scope, decidedAt', () => {
    const ctx = makeCtx()
    const d = resolveHighestPriorityDecision([], ctx, true)
    expect(d.userId).toBe('user-1')
    expect(d.resource).toBe('PACKAGE')
    expect(d.action).toBe('APPROVE')
    expect(d.scope).toBe('DEPARTMENT')
    expect(d.decidedAt).toBeTruthy()
  })
})
