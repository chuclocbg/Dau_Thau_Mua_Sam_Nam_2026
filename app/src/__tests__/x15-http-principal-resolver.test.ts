/**
 * Phase X.15 — unit tests for resolvePrincipalFromRequest() (ADR_X15_ARCHITECTURE_DECISION.md
 * Implementation Order Step 1).
 */

import { describe, it, expect } from 'vitest'
import { resolvePrincipalFromRequest } from '../api/httpPrincipalResolver.ts'
import type { FastifyRequest } from 'fastify'

function fakeRequest(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return { headers } as unknown as FastifyRequest
}

describe('resolvePrincipalFromRequest', () => {
  it('resolves to an anonymous context when x-client-id is absent', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({}))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
    expect(ctx.principal.id).toBe('anonymous')
  })

  it('resolves to an anonymous context when x-client-id is an empty string', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': '' }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('resolves to an anonymous context when x-client-id is whitespace only', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': '   ' }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('resolves to a USER context carrying the header value when x-client-id is present', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': 'client-abc' }))
    expect(ctx.principal.kind).toBe('USER')
    expect(ctx.principal.id).toBe('client-abc')
    expect(ctx.principal.claims.subject).toBe('client-abc')
  })

  it('trims surrounding whitespace from a supplied client id', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': '  client-abc  ' }))
    expect(ctx.principal.id).toBe('client-abc')
  })

  it('takes the first value when the header is supplied multiple times', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': ['client-1', 'client-2'] }))
    expect(ctx.principal.id).toBe('client-1')
  })

  it('two different client ids resolve to two different, distinguishable principals', () => {
    const alice = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': 'alice' }))
    const bob = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': 'bob' }))
    expect(alice.principal.id).not.toBe(bob.principal.id)
  })
})
