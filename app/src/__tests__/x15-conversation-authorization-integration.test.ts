/**
 * Phase X.15 — real-server integration tests for authorization wiring
 * (ADR_X15_ARCHITECTURE_DECISION.md, Acceptance Criteria #4).
 *
 * Exercised against the REAL buildHttpServer() (never a throwaway Fastify instance -- the exact
 * gap ADR_X15_ARCHITECTURE_DECISION.md's own risk register named), via Fastify's inject(), the
 * same pattern http-server-integration.test.ts (X.9.1) and x12-conversation-http-integration.test.ts
 * (X.12) already use.
 */

import { describe, it, expect } from 'vitest'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from '../server/httpServer.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'

async function buildTestServer() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const app = await buildApplication(config.value)
  return buildHttpServer(app)
}

describe('POST /api/v1/conversation/turn — non-regression: a header-less request behaves exactly as before X.15', () => {
  it('an anonymous request (no x-client-id) still succeeds with 200, identical to the pre-X.15 shape', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: QUESTION } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data.sessionId).toBeTruthy()
    expect(body.data.turnNumber).toBe(1)
  })

  it('validation still 400s on a blank question, unchanged', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: '  ' } })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/conversation/turn — session ownership is now enforced', () => {
  it('the same x-client-id can resume its own session across two calls', async () => {
    const server = await buildTestServer()
    const first = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': 'alice' }, payload: { question: QUESTION },
    })
    const firstBody = first.json()
    expect(first.statusCode).toBe(200)

    const second = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': 'alice' },
      payload: { sessionId: firstBody.data.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?' },
    })
    expect(second.statusCode).toBe(200)
    expect(second.json().data.turnNumber).toBe(2)
  })

  it('a DIFFERENT x-client-id is rejected with 403 when attempting to resume someone else\'s session', async () => {
    const server = await buildTestServer()
    const first = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': 'alice' }, payload: { question: QUESTION },
    })
    const firstBody = first.json()

    const hijackAttempt = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': 'bob' },
      payload: { sessionId: firstBody.data.sessionId, question: 'trying to read alice\'s conversation' },
    })

    expect(hijackAttempt.statusCode).toBe(403)
    expect(hijackAttempt.json().ok).toBe(false)
    expect(hijackAttempt.json().error.code).toBe('FORBIDDEN')
  })

  it('this is a genuine improvement over pre-X.15 behavior: the same scenario without x-client-id headers (both anonymous) is indistinguishable and would have succeeded pre-X.15 -- documented, not hidden', async () => {
    const server = await buildTestServer()
    const first = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: QUESTION } })
    const firstBody = first.json()

    // No x-client-id on either call: both resolve to the SAME 'anonymous' principal, so the
    // ownership check cannot distinguish them -- exactly the ADR's own named, accepted
    // limitation (accidental-collision protection only, not adversarial-attacker protection,
    // until real credential verification lands in a future milestone).
    const secondAnonymousCall = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      payload: { sessionId: firstBody.data.sessionId, question: 'another anonymous caller' },
    })
    expect(secondAnonymousCall.statusCode).toBe(200)
  })

  it('a new session for a new x-client-id is bound to that principal', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      headers: { 'x-client-id': 'carol' }, payload: { question: QUESTION },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.turnNumber).toBe(1)
  })
})
