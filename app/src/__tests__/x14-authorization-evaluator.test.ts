/**
 * Phase X.14 — unit tests for the Authorization evaluator (wildcard matching, scope hierarchy,
 * findMatchingPermission, evaluateAuthorization) plus deterministic replay verification.
 */

import { describe, it, expect } from 'vitest'
import {
  scopeIncludes, matchesResource, matchesAction, findMatchingPermission, evaluateAuthorization,
} from '../identity/application/authorizationEvaluator.ts'
import type { Permission } from '../identity/domain/identityTypes.ts'

describe('scopeIncludes', () => {
  it('ALL includes OWN', () => { expect(scopeIncludes('ALL', 'OWN')).toBe(true) })
  it('ALL includes ALL', () => { expect(scopeIncludes('ALL', 'ALL')).toBe(true) })
  it('OWN does NOT include ALL', () => { expect(scopeIncludes('OWN', 'ALL')).toBe(false) })
  it('OWN includes OWN', () => { expect(scopeIncludes('OWN', 'OWN')).toBe(true) })
})

describe('matchesResource / matchesAction', () => {
  it('wildcard "*" matches anything', () => {
    expect(matchesResource('*', 'conversation')).toBe(true)
    expect(matchesAction('*', 'ask')).toBe(true)
  })
  it('exact match only otherwise -- no prefix wildcards', () => {
    expect(matchesResource('conversation', 'conversation')).toBe(true)
    expect(matchesResource('conversation', 'tool')).toBe(false)
    expect(matchesResource('conv', 'conversation')).toBe(false)
  })
})

describe('findMatchingPermission', () => {
  const permissions: Permission[] = [
    { resource: 'conversation', action: 'ask', scope: 'OWN' },
    { resource: 'tool', action: 'invoke', scope: 'ALL' },
  ]

  it('finds a permission matching resource+action+scope', () => {
    expect(findMatchingPermission(permissions, { resource: 'conversation', action: 'ask', scope: 'OWN' }))
      .toEqual(permissions[0])
  })

  it('an ALL-scope permission satisfies an OWN-scope request', () => {
    expect(findMatchingPermission(permissions, { resource: 'tool', action: 'invoke', scope: 'OWN' }))
      .toEqual(permissions[1])
  })

  it('an OWN-scope permission does NOT satisfy an ALL-scope request', () => {
    expect(findMatchingPermission(permissions, { resource: 'conversation', action: 'ask', scope: 'ALL' })).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(findMatchingPermission(permissions, { resource: 'mcp:x', action: 'invoke', scope: 'OWN' })).toBeNull()
  })

  it('a wildcard "*:*" permission satisfies any request', () => {
    const wildcard: Permission[] = [{ resource: '*', action: '*', scope: 'ALL' }]
    expect(findMatchingPermission(wildcard, { resource: 'anything', action: 'anything', scope: 'ALL' })).toEqual(wildcard[0])
  })
})

describe('evaluateAuthorization', () => {
  it('produces an allowed=true decision with the matched permission named in the reason', () => {
    const permissions: Permission[] = [{ resource: 'conversation', action: 'ask', scope: 'OWN' }]
    const decision = evaluateAuthorization('p-1', permissions, { resource: 'conversation', action: 'ask', scope: 'OWN' })
    expect(decision.allowed).toBe(true)
    expect(decision.principalId).toBe('p-1')
    expect(decision.reason).toContain('conversation:ask:OWN')
  })

  it('produces an allowed=false decision with a clear reason when nothing matches', () => {
    const decision = evaluateAuthorization('p-1', [], { resource: 'conversation', action: 'ask', scope: 'OWN' })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('No matching permission')
  })

  it('stamps a real decidedAt timestamp', () => {
    const before = new Date().toISOString()
    const decision = evaluateAuthorization('p-1', [], { resource: 'x', action: 'y', scope: 'OWN' })
    expect(decision.decidedAt >= before).toBe(true)
  })
})

describe('Deterministic replay verification', () => {
  it('evaluating the same request twice with the same permission set yields the same allowed/reason', () => {
    const permissions: Permission[] = [{ resource: 'conversation', action: 'ask', scope: 'OWN' }]
    const first = evaluateAuthorization('p-1', permissions, { resource: 'conversation', action: 'ask', scope: 'OWN' })
    const second = evaluateAuthorization('p-1', permissions, { resource: 'conversation', action: 'ask', scope: 'OWN' })
    expect(first.allowed).toBe(second.allowed)
    expect(first.reason).toBe(second.reason)
  })
})
