import { describe, it, expect, afterEach } from 'vitest'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from '../server/httpServer.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import type { Application } from '../bootstrap/buildApplication.ts'
import type { FastifyInstance } from 'fastify'

// True end-to-end integration test for Phase X.9.3 — a real Application (real memory-backed
// IKnowledgePlatform + LegalProvider, complete ReasoningEnginePipeline, real ToolExecutor) wired
// into a real Fastify instance via buildHttpServer(), exercised over a REAL listening socket
// with real fetch() requests.
//
// TOOLING FINDING (verified by direct probe, not assumed): Fastify's inject() (light-my-request)
// does not support reply.hijack() + raw-response streaming — a minimal reproduction showed the
// injected response's res.end(callback) callback never fires, hanging the request forever. This
// is a real gap in the test tool, not in this milestone's code (confirmed identically against a
// bare Fastify instance with no Phase X code involved at all). Every test below therefore binds
// a real socket (port: 0) and uses real fetch() — the same real-network verification already
// required by this milestone's "smoke tests using a real HTTP stream" instruction, applied
// throughout rather than only in one dedicated smoke test.

interface ParsedSSEEvent {
  readonly event: string
  readonly data: unknown
  readonly id?: string
}

function parseSSE(raw: string): ParsedSSEEvent[] {
  return raw.split('\n\n').filter(block => block.trim() !== '').map(block => {
    const lines = block.split('\n')
    const eventLine = lines.find(l => l.startsWith('event: '))!
    const dataLines = lines.filter(l => l.startsWith('data: ')).map(l => l.slice('data: '.length))
    const idLine = lines.find(l => l.startsWith('id: '))
    return {
      event: eventLine.slice('event: '.length),
      data: JSON.parse(dataLines.join('\n')),
      ...(idLine !== undefined ? { id: idLine.slice('id: '.length) } : {}),
    }
  })
}

interface RealTestServer {
  readonly app: Application
  readonly server: FastifyInstance
  readonly url: string
}

async function buildRealTestServer(appOverride?: Application): Promise<RealTestServer> {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const app = appOverride ?? await buildApplication(config.value)
  const server = buildHttpServer(app)
  await server.listen({ port: 0, host: '127.0.0.1' })
  const address = server.server.address()
  if (address === null || typeof address === 'string') throw new Error('unreachable: expected a real address')
  return { app, server, url: `http://127.0.0.1:${address.port}` }
}

const runningServers: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(s => s.close()))
})

async function trackedServer(): Promise<RealTestServer> {
  const instance = await buildRealTestServer()
  runningServers.push(instance.server)
  return instance
}

describe('POST /api/v1/reasoning/answer/stream — happy path (real reasoning chain, real socket)', () => {
  it('streams stage events followed by a result event carrying a real ToolAugmentedResponse', async () => {
    const { url } = await trackedServer()
    const res = await fetch(`${url}/api/v1/reasoning/answer/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-07' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const events = parseSSE(await res.text())
    const stageNames = events.filter(e => e.event === 'stage').map(e => (e.data as { stage: string }).stage)
    expect(stageNames).toEqual(['reasoning', 'reasoning', 'formatting', 'tool_calling'])

    const result = events.find(e => e.event === 'result')!
    const augmented = result.data as { response: { markdown: string }; toolInvoked: boolean }
    expect(augmented.response.markdown).toContain('## Kết luận')
    expect(augmented.toolInvoked).toBe(false)
  })

  it('rejects a request with a missing question before any SSE framing begins', async () => {
    const { url } = await trackedServer()
    const res = await fetch(`${url}/api/v1/reasoning/answer/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('INVALID_REQUEST')
  })
})

describe('POST /api/v1/reasoning/answer/stream — replay', () => {
  it('streaming the same question twice produces the same stage sequence and result markdown', async () => {
    const { url } = await trackedServer()
    const payload = JSON.stringify({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-07' })
    const headers = { 'Content-Type': 'application/json' }

    const firstRes = await fetch(`${url}/api/v1/reasoning/answer/stream`, { method: 'POST', headers, body: payload })
    const secondRes = await fetch(`${url}/api/v1/reasoning/answer/stream`, { method: 'POST', headers, body: payload })
    const first = parseSSE(await firstRes.text())
    const second = parseSSE(await secondRes.text())

    expect(first.map(e => e.event)).toEqual(second.map(e => e.event))
    const firstResult = first.find(e => e.event === 'result')!.data as { response: { markdown: string } }
    const secondResult = second.find(e => e.event === 'result')!.data as { response: { markdown: string } }
    expect(firstResult.response.markdown).toBe(secondResult.response.markdown)
  })
})

describe('POST /api/v1/reasoning/answer/stream — metrics side effects', () => {
  it('increments sse_streams_total and sse_streams_completed_total on the real Application metrics', async () => {
    const { app, url } = await trackedServer()
    await (await fetch(`${url}/api/v1/reasoning/answer/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Mức tạm ứng tối đa là bao nhiêu?' }),
    })).text()
    expect(app.metrics.get('sse_streams_total')).toBe(1)
    expect(app.metrics.get('sse_streams_completed_total')).toBe(1)
  })
})

describe('POST /api/v1/reasoning/answer/stream — real client-disconnect cancellation', () => {
  // A deliberately slow stand-in for reasoningPipeline.answer() is the one appropriately-scoped
  // substitution here: the real pipeline (proven real in every other test in this file) resolves
  // in well under a millisecond, leaving no reliable window for a real network disconnect to
  // race against it. Delaying the SAME real answer (not a fabricated one) by a fixed margin
  // makes the disconnect race deterministic without touching the frozen reasoning pipeline.
  function buildSlowApplication(app: Application, delayMs: number): Application {
    const realAnswer = app.reasoningPipeline.answer.bind(app.reasoningPipeline)
    return {
      ...app,
      reasoningPipeline: {
        answer: (intent) => new Promise(resolve => setTimeout(() => resolve(realAnswer(intent)), delayMs)),
      } as Application['reasoningPipeline'],
    }
  }

  it('detects a real client disconnect mid-stream and records it as an aborted stream', async () => {
    const config = loadAppConfigFromEnv({})
    if (!config.ok) throw new Error('unreachable')
    const baseApp = await buildApplication(config.value)
    const slowApp = buildSlowApplication(baseApp, 300)
    const { url } = await (async (): Promise<RealTestServer> => {
      const instance = await buildRealTestServer(slowApp)
      runningServers.push(instance.server)
      return instance
    })()

    const controller = new AbortController()
    const fetchPromise = fetch(`${url}/api/v1/reasoning/answer/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Mức tạm ứng tối đa là bao nhiêu?' }),
      signal: controller.signal,
    }).catch(() => undefined)

    await new Promise(r => setTimeout(r, 30))
    controller.abort()
    await fetchPromise

    await new Promise(r => setTimeout(r, 400))
    expect(slowApp.metrics.get('sse_streams_aborted_total')).toBe(1)
    expect(slowApp.metrics.get('sse_streams_completed_total')).toBe(0)
  }, 10_000)
})
