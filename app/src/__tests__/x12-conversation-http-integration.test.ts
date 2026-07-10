/**
 * Phase X.12 (Conversation HTTP Entry Verification) — true end-to-end integration test.
 *
 * A real Application (real memory-backed IKnowledgePlatform + LegalProvider, the complete
 * frozen ReasoningEnginePipeline, a real ToolExecutor) wired into a real Fastify instance via
 * buildHttpServer(), exercised via Fastify's own in-process inject() — the exact same pattern
 * http-server-integration.test.ts (X.9.1) already uses. Proves POST /api/v1/conversation/turn
 * is the first HTTP entry to reach the complete chain: detectIntent -> RuntimeSessionBuilder ->
 * reasoningPipeline.answer() -> formatConversationResponse() -> runToolCallingStage() -- and
 * that a second call resuming the same sessionId genuinely continues the conversation (proving
 * the dependency graph is wired correctly end-to-end over real HTTP, not just in-process).
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

describe('POST /api/v1/conversation/turn — validation', () => {
  it('400s when question is missing or blank', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: '  ' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().ok).toBe(false)
  })
})

describe('POST /api/v1/conversation/turn — first turn (new session)', () => {
  it('reaches the complete chain and returns a sessionId, turnNumber, and real response', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: QUESTION } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data.sessionId).toBeTruthy()
    expect(body.data.turnNumber).toBe(1)
    expect(body.data.response.response.markdown).toBeTruthy()
    expect(typeof body.data.response.toolInvoked).toBe('boolean')
  })
})

describe('POST /api/v1/conversation/turn — replay across two HTTP calls', () => {
  it('a second call with the same sessionId resumes the session over real HTTP', async () => {
    const server = await buildTestServer()
    const first = await server.inject({ method: 'POST', url: '/api/v1/conversation/turn', payload: { question: QUESTION } })
    const firstBody = first.json()

    const second = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      payload: { sessionId: firstBody.data.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?' },
    })
    const secondBody = second.json()

    expect(secondBody.ok).toBe(true)
    expect(secondBody.data.sessionId).toBe(firstBody.data.sessionId)
    expect(secondBody.data.turnNumber).toBe(2)
  })

  it('an unknown sessionId gracefully starts a new session rather than erroring', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'POST', url: '/api/v1/conversation/turn',
      payload: { sessionId: 'does-not-exist', question: QUESTION },
    })
    const body = res.json()
    expect(res.statusCode).toBe(200)
    expect(body.data.sessionId).not.toBe('does-not-exist')
    expect(body.data.turnNumber).toBe(1)
  })
})

describe('POST /api/v1/conversation/turn — coexists with the pre-existing stateless route', () => {
  it('POST /api/v1/reasoning/answer (X.9.1) still works unchanged, side by side with the new route', async () => {
    const server = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/reasoning/answer', payload: { question: QUESTION } })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
