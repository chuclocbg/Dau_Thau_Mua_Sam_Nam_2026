/**
 * Phase X.16 Step 2 — resolvePrincipalFromRequest() credential-verification behavior
 * (X16_PROTOCOL_DECISION.md, Path B: the secret is read internally via loadAppConfigFromEnv(),
 * the function's own exported signature is unchanged).
 *
 * Kept as a NEW file rather than extending the frozen x15-http-principal-resolver.test.ts, so
 * that file remains byte-for-byte untouched -- no governance exception needed for it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolvePrincipalFromRequest } from '../api/httpPrincipalResolver.ts'
import { signToken } from '../api/credentialToken.ts'
import type { FastifyRequest } from 'fastify'

const ENV_KEY = 'CREDENTIAL_SIGNING_SECRET'
const SECRET = 's'.repeat(40)
const OTHER_SECRET = 't'.repeat(40)

function fakeRequest(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return { headers } as unknown as FastifyRequest
}

describe('resolvePrincipalFromRequest — credential verification enabled (secret configured)', () => {
  const originalSecret = process.env[ENV_KEY]

  beforeEach(() => {
    process.env[ENV_KEY] = SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalSecret
  })

  it('resolves to a USER context when x-client-id carries a validly signed token', () => {
    const token = signToken(SECRET, 'alice', 3600)
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': token }))
    expect(ctx.principal.kind).toBe('USER')
    expect(ctx.principal.id).toBe('alice')
  })

  it('falls back to anonymous when x-client-id is absent, even with a secret configured', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({}))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('falls back to anonymous when x-client-id is a raw, unsigned string', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': 'alice' }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('falls back to anonymous when the token is expired', () => {
    const longAgo = 1_000_000
    const token = signToken(SECRET, 'alice', 60, longAgo)
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': token }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('falls back to anonymous when the token was signed with a different secret', () => {
    const token = signToken(OTHER_SECRET, 'alice', 3600)
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': token }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('falls back to anonymous when the token is tampered with', () => {
    const token = signToken(SECRET, 'alice', 3600)
    const tampered = `${token}x`
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': tampered }))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })

  it('two different verified tokens resolve to two different, distinguishable principals', () => {
    const aliceToken = signToken(SECRET, 'alice', 3600)
    const bobToken = signToken(SECRET, 'bob', 3600)
    const alice = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': aliceToken }))
    const bob = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': bobToken }))
    expect(alice.principal.id).toBe('alice')
    expect(bob.principal.id).toBe('bob')
  })
})

describe('resolvePrincipalFromRequest — no secret configured (non-regression, exact pre-X.16 behavior)', () => {
  const originalSecret = process.env[ENV_KEY]

  beforeEach(() => {
    delete process.env[ENV_KEY]
  })

  afterEach(() => {
    if (originalSecret !== undefined) process.env[ENV_KEY] = originalSecret
  })

  it('trusts a raw x-client-id string directly, identical to the X.15 freeze', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({ 'x-client-id': 'alice' }))
    expect(ctx.principal.kind).toBe('USER')
    expect(ctx.principal.id).toBe('alice')
  })

  it('still resolves to anonymous when x-client-id is absent', () => {
    const ctx = resolvePrincipalFromRequest(fakeRequest({}))
    expect(ctx.principal.kind).toBe('ANONYMOUS')
  })
})
