import { describe, it, expect } from 'vitest'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from '../server/httpServer.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'

// True end-to-end integration test for Phase X.9.1 — a real Application (real memory-backed
// IKnowledgePlatform + LegalProvider, the complete ReasoningEnginePipeline, a real ToolExecutor,
// a real CoordinatorAgent) wired into a real Fastify instance, exercised via Fastify's own
// in-process inject() — the exact same, already-established pattern src/interface/
// restAdapter.ts's own tests use. No fake adapters, no real network socket.

async function buildTestServer() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const app = await buildApplication(config.value)
  return { app, server: buildHttpServer(app) }
}

describe('HTTP server — health/liveness/readiness', () => {
  it('GET /live always returns 200', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({ method: 'GET', url: '/live' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })

  it('GET /ready returns 200 when no external dependency is configured', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(200)
    expect(res.json().ready).toBe(true)
  })

  it('GET /health aggregates liveness and readiness', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })
})

describe('HTTP server — POST /api/v1/reasoning/answer (real reasoning chain)', () => {
  it('answers a real question through the complete Reasoning Engine + Tool Calling chain', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({
      method: 'POST', url: '/api/v1/reasoning/answer',
      payload: { question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-07' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data.toolInvoked).toBe(false)
    expect(body.data.response.markdown).toContain('## Kết luận')
  })

  it('rejects a request with a missing question', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/reasoning/answer', payload: {} })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
  })
})

describe('HTTP server — POST /api/v1/reasoning/batch (real Multi-Agent chain)', () => {
  it('coordinates multiple questions in parallel through the real Coordinator + Reasoning Engine', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({
      method: 'POST', url: '/api/v1/reasoning/batch',
      payload: { questions: ['Mức tạm ứng tối đa là bao nhiêu?', 'Câu hỏi khác?'], asOfDate: '2026-07-07' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data.status).toBe('COMPLETED')
    expect(body.data.outcomes).toHaveLength(2)
  })

  it('rejects an empty questions array', async () => {
    const { server } = await buildTestServer()
    const res = await server.inject({ method: 'POST', url: '/api/v1/reasoning/batch', payload: { questions: [] } })
    expect(res.statusCode).toBe(400)
  })
})

describe('HTTP server — deterministic replay', () => {
  it('answering the same question twice produces identical markdown (aside from timestamps)', async () => {
    const { server } = await buildTestServer()
    const payload = { question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-07' }
    const first = await server.inject({ method: 'POST', url: '/api/v1/reasoning/answer', payload })
    const second = await server.inject({ method: 'POST', url: '/api/v1/reasoning/answer', payload })
    expect(first.json().data.response.markdown).toBe(second.json().data.response.markdown)
  })
})
