/**
 * Phase X.16 Step 3 — real-server integration tests for credential verification
 * (X16_PROTOCOL_DECISION.md, Acceptance Criteria #7: exercised against the REAL
 * buildHttpServer(), never a throwaway Fastify instance).
 *
 * Complements (does not replace) the frozen x15-conversation-authorization-integration.test.ts,
 * which covers the no-secret-configured, raw x-client-id path and is left byte-for-byte
 * untouched. This file covers the new, secret-configured, verified-token path only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from '../server/httpServer.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { signToken } from '../api/credentialToken.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'
const ENV_KEY = 'CREDENTIAL_SIGNING_SECRET'
const SECRET = 's'.repeat(40)

async function buildTestServer() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const app = await buildApplication(config.value)
  return buildHttpServer(app)
}

describe('POST /api/v1/conversation/turn — Phase X.16 Step 3: real-server credential verification', () => {
  const originalSecret = process.env[ENV_KEY]

  beforeEach(() => {
    process.env[ENV_KEY] = SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalSecret
  })

  it('a validly signed token succeeds with 200', async () => {
    const server = await buildTestServer()
    const token = signToken(SECRET, 'alice', 3600)
    const res = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': token }, payload: { question: QUESTION },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.turnNumber).toBe(1)
  })

  it('the same validly signed token can resume its own session across two calls', async () => {
    const server = await buildTestServer()
    const token = signToken(SECRET, 'alice', 3600)
    const first = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': token }, payload: { question: QUESTION },
    })
    const firstBody = first.json()
    expect(first.statusCode).toBe(200)

    const second = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': token },
      payload: { sessionId: firstBody.data.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?' },
    })
    expect(second.statusCode).toBe(200)
    expect(second.json().data.turnNumber).toBe(2)
  })

  it("a DIFFERENT validly signed token is rejected with 403 attempting to resume someone else's session", async () => {
    const server = await buildTestServer()
    const aliceToken = signToken(SECRET, 'alice', 3600)
    const bobToken = signToken(SECRET, 'bob', 3600)

    const first = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': aliceToken }, payload: { question: QUESTION },
    })
    const firstBody = first.json()

    const hijackAttempt = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': bobToken },
      payload: { sessionId: firstBody.data.sessionId, question: "trying to read alice's conversation" },
    })
    expect(hijackAttempt.statusCode).toBe(403)
    expect(hijackAttempt.json().error.code).toBe('FORBIDDEN')
  })

  it("an expired token falls back to anonymous, which does not own alice's real session -- still rejected with 403, never silently trusted", async () => {
    const server = await buildTestServer()
    const aliceToken = signToken(SECRET, 'alice', 3600)
    const first = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': aliceToken }, payload: { question: QUESTION },
    })
    const firstBody = first.json()

    const longAgo = 1_000_000
    const expiredToken = signToken(SECRET, 'alice', 60, longAgo)
    const expiredAttempt = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': expiredToken },
      payload: { sessionId: firstBody.data.sessionId, question: 'using an expired token' },
    })
    expect(expiredAttempt.statusCode).toBe(403)
  })

  it('a tampered token falls back to anonymous -- never a 500, never a silently-escalated trusted principal', async () => {
    const server = await buildTestServer()
    const token = signToken(SECRET, 'alice', 3600)
    const tampered = `${token}corrupted`
    const res = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': tampered }, payload: { question: QUESTION },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('a request with no x-client-id header still succeeds anonymously, unchanged (regression check, even with a secret configured)', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: QUESTION } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.turnNumber).toBe(1)
  })
})
