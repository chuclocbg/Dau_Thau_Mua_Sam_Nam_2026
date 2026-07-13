import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { signToken, verifyToken } from '../api/credentialToken.ts'

function signPayload(payloadEncoded: string): string {
  return createHmac('sha256', SECRET).update(payloadEncoded).digest().toString('base64url')
}

const SECRET = 'test-signing-secret'

describe('credentialToken — signToken()/verifyToken() (Phase X.16 Step 1)', () => {
  it('a freshly signed token verifies as valid with the matching subject', () => {
    const token = signToken(SECRET, 'user-42', 3600)
    const result = verifyToken(SECRET, token)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.payload.subject).toBe('user-42')
      expect(result.payload.expiresAt).toBeGreaterThan(result.payload.issuedAt)
    }
  })

  it('rejects an expired token', () => {
    const issuedAt = 1_000_000
    const token = signToken(SECRET, 'user-42', 60, issuedAt)
    const result = verifyToken(SECRET, token, issuedAt + 61_000)
    expect(result).toEqual({ valid: false, reason: 'EXPIRED' })
  })

  it('accepts a token exactly at its expiry instant, rejects one millisecond after', () => {
    const issuedAt = 1_000_000
    const token = signToken(SECRET, 'user-42', 60, issuedAt)
    const atExpiry = verifyToken(SECRET, token, issuedAt + 60_000)
    expect(atExpiry.valid).toBe(true)
    const pastExpiry = verifyToken(SECRET, token, issuedAt + 60_001)
    expect(pastExpiry).toEqual({ valid: false, reason: 'EXPIRED' })
  })

  it('rejects a token verified with the wrong secret', () => {
    const token = signToken(SECRET, 'user-42', 3600)
    const result = verifyToken('a-different-secret', token)
    expect(result).toEqual({ valid: false, reason: 'BAD_SIGNATURE' })
  })

  it('rejects a token whose signature was tampered with', () => {
    const token = signToken(SECRET, 'user-42', 3600)
    const [payload] = token.split('.')
    const tampered = `${payload}.not-a-real-signature`
    const result = verifyToken(SECRET, tampered)
    expect(result.valid).toBe(false)
  })

  it('rejects a token whose payload was tampered with (signature no longer matches)', () => {
    const token = signToken(SECRET, 'user-42', 3600)
    const [, signature] = token.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ subject: 'admin', issuedAt: Date.now(), expiresAt: Date.now() + 999_000 }), 'utf-8').toString('base64url')
    const tampered = `${forgedPayload}.${signature}`
    const result = verifyToken(SECRET, tampered)
    expect(result).toEqual({ valid: false, reason: 'BAD_SIGNATURE' })
  })

  it('rejects a malformed token with no separator', () => {
    expect(verifyToken(SECRET, 'not-a-token')).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('rejects a malformed token with too many separators', () => {
    expect(verifyToken(SECRET, 'a.b.c')).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('rejects an empty string', () => {
    expect(verifyToken(SECRET, '')).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('rejects a token with an empty payload or signature segment', () => {
    expect(verifyToken(SECRET, '.signature')).toEqual({ valid: false, reason: 'MALFORMED' })
    expect(verifyToken(SECRET, 'payload.')).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('rejects a token whose payload decodes to invalid JSON', () => {
    const badPayload = Buffer.from('not json', 'utf-8').toString('base64url')
    const signature = signPayload(badPayload)
    expect(verifyToken(SECRET, `${badPayload}.${signature}`)).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('rejects a token whose payload is valid JSON but missing required fields', () => {
    const badPayload = Buffer.from(JSON.stringify({ subject: 'user-42' }), 'utf-8').toString('base64url')
    const signature = signPayload(badPayload)
    expect(verifyToken(SECRET, `${badPayload}.${signature}`)).toEqual({ valid: false, reason: 'MALFORMED' })
  })

  it('two tokens signed for different subjects never verify as each other', () => {
    const tokenA = signToken(SECRET, 'user-a', 3600)
    const tokenB = signToken(SECRET, 'user-b', 3600)
    const resultA = verifyToken(SECRET, tokenA)
    const resultB = verifyToken(SECRET, tokenB)
    expect(resultA.valid && resultA.payload.subject).toBe('user-a')
    expect(resultB.valid && resultB.payload.subject).toBe('user-b')
  })
})
