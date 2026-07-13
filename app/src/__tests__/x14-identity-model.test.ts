/**
 * Phase X.14 — unit tests for the Identity model (Principal, Claims) and the four identity
 * factory functions (Anonymous, User, Service, System identity).
 */

import { describe, it, expect } from 'vitest'
import {
  buildAnonymousContext, buildUserContext, buildServiceContext, buildSystemContext,
} from '../identity/application/authenticationContext.ts'

describe('buildAnonymousContext', () => {
  it('produces a Principal of kind ANONYMOUS with the ANONYMOUS role', () => {
    const ctx = buildAnonymousContext()
    expect(ctx.principal.kind).toBe('ANONYMOUS')
    expect(ctx.principal.roles).toEqual(['ANONYMOUS'])
    expect(ctx.principal.claims.subject).toBe('anonymous')
  })

  it('grants exactly the conversation:ask:OWN permission -- matching what every caller can already do today', () => {
    const ctx = buildAnonymousContext()
    expect(ctx.permissions).toEqual([{ resource: 'conversation', action: 'ask', scope: 'OWN' }])
  })
})

describe('buildUserContext', () => {
  it('produces a Principal of kind USER carrying the given userId as claims.subject and principal.id', () => {
    const ctx = buildUserContext('user-123')
    expect(ctx.principal.kind).toBe('USER')
    expect(ctx.principal.id).toBe('user-123')
    expect(ctx.principal.claims.subject).toBe('user-123')
  })

  it('carries caller-supplied claim attributes through unchanged', () => {
    const ctx = buildUserContext('user-123', { department: 'engineering' })
    expect(ctx.principal.claims.attributes).toEqual({ department: 'engineering' })
  })
})

describe('buildServiceContext', () => {
  it('produces a Principal of kind SERVICE with a prefixed id', () => {
    const ctx = buildServiceContext('recovery-scan')
    expect(ctx.principal.kind).toBe('SERVICE')
    expect(ctx.principal.id).toBe('service:recovery-scan')
  })

  it('grants ALL-scope conversation and tool permissions', () => {
    const ctx = buildServiceContext('recovery-scan')
    expect(ctx.permissions).toContainEqual({ resource: 'conversation', action: 'ask', scope: 'ALL' })
    expect(ctx.permissions).toContainEqual({ resource: 'tool', action: 'invoke', scope: 'ALL' })
  })
})

describe('buildSystemContext', () => {
  it('produces a Principal of kind SYSTEM with wildcard resource/action ALL-scope permission', () => {
    const ctx = buildSystemContext()
    expect(ctx.principal.kind).toBe('SYSTEM')
    expect(ctx.permissions).toEqual([{ resource: '*', action: '*', scope: 'ALL' }])
  })
})

describe('Determinism -- same identity kind always yields the same permission set', () => {
  it('two independently-built anonymous contexts have identical permissions', () => {
    expect(buildAnonymousContext().permissions).toEqual(buildAnonymousContext().permissions)
  })

  it('two independently-built system contexts have identical permissions', () => {
    expect(buildSystemContext().permissions).toEqual(buildSystemContext().permissions)
  })
})
