import { describe, it, expect } from 'vitest'
import { runSmokeChecks, allChecksPassed, formatSmokeCheckReport } from '../startup/smokeChecks.ts'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function allHealthyFetch(): typeof fetch {
  return (async (url: string) => {
    if (url.endsWith('/live')) return jsonResponse(200, { status: 'ok' })
    if (url.endsWith('/ready')) return jsonResponse(200, { ready: true, checks: [] })
    if (url.endsWith('/health')) return jsonResponse(200, { status: 'ok' })
    if (url.endsWith('/api/v1/reasoning/answer')) {
      return jsonResponse(200, { ok: true, data: { response: { markdown: '## Kết luận' }, toolInvoked: false } })
    }
    if (url.endsWith('/api/v1/reasoning/batch')) {
      return jsonResponse(200, { ok: true, data: { status: 'COMPLETED', outcomes: [{}, {}] } })
    }
    if (url.endsWith('/api/v1/reasoning/answer/stream')) {
      return {
        ok: true, status: 200,
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
        text: async () => 'event: stage\ndata: {}\n\nevent: result\ndata: {}\n\n',
      } as unknown as Response
    }
    throw new Error(`unexpected url: ${url}`)
  }) as unknown as typeof fetch
}

describe('runSmokeChecks — all healthy', () => {
  it('reports every check as ok', async () => {
    const results = await runSmokeChecks('http://x', allHealthyFetch())
    expect(results).toHaveLength(6)
    expect(allChecksPassed(results)).toBe(true)
    expect(results.every(r => r.ok)).toBe(true)
  })
})

describe('runSmokeChecks — individual failure modes', () => {
  it('fails the /live check on a non-ok status', async () => {
    const fetchFn = (async () => jsonResponse(500, {})) as unknown as typeof fetch
    const results = await runSmokeChecks('http://x', fetchFn)
    const live = results.find(r => r.name === 'GET /live')!
    expect(live.ok).toBe(false)
    expect(live.detail).toContain('500')
  })

  it('fails the /ready check when the ready field is missing', async () => {
    const fetchFn = ((url: string) => {
      if (url.endsWith('/ready')) return Promise.resolve(jsonResponse(200, {}))
      return Promise.resolve(jsonResponse(200, { status: 'ok' }))
    }) as unknown as typeof fetch
    const results = await runSmokeChecks('http://x', fetchFn)
    const ready = results.find(r => r.name === 'GET /ready')!
    expect(ready.ok).toBe(false)
    expect(ready.detail).toContain('ready')
  })

  it('accepts /ready returning 503 with a valid ready:false body (not itself a check failure)', async () => {
    const fetchFn = ((url: string) => {
      if (url.endsWith('/live')) return Promise.resolve(jsonResponse(200, { status: 'ok' }))
      if (url.endsWith('/ready')) return Promise.resolve(jsonResponse(503, { ready: false, checks: [] }))
      if (url.endsWith('/health')) return Promise.resolve(jsonResponse(200, { status: 'ok' }))
      return Promise.resolve(jsonResponse(200, { ok: true, data: {} }))
    }) as unknown as typeof fetch
    const results = await runSmokeChecks('http://x', fetchFn)
    const ready = results.find(r => r.name === 'GET /ready')!
    expect(ready.ok).toBe(true)
  })

  it('fails the reasoning/answer check when the response envelope is malformed', async () => {
    const fetchFn = ((url: string) => {
      if (url.endsWith('/api/v1/reasoning/answer')) return Promise.resolve(jsonResponse(200, { ok: true, data: {} }))
      return Promise.resolve(jsonResponse(200, { status: 'ok', ready: true, checks: [] }))
    }) as unknown as typeof fetch
    const results = await runSmokeChecks('http://x', fetchFn)
    const answer = results.find(r => r.name === 'POST /api/v1/reasoning/answer')!
    expect(answer.ok).toBe(false)
    expect(answer.detail).toContain('markdown')
  })

  it('fails the SSE check when the result event frame is missing', async () => {
    const fetchFn = ((url: string) => {
      if (url.endsWith('/api/v1/reasoning/answer/stream')) {
        return Promise.resolve({
          ok: true, status: 200,
          headers: { get: () => 'text/event-stream' },
          text: async () => 'event: stage\ndata: {}\n\n',
        } as unknown as Response)
      }
      return Promise.resolve(jsonResponse(200, { status: 'ok', ready: true, checks: [], ok: true, data: { status: 'COMPLETED', outcomes: [] } }))
    }) as unknown as typeof fetch
    const results = await runSmokeChecks('http://x', fetchFn)
    const sse = results.find(r => r.name === 'POST /api/v1/reasoning/answer/stream (SSE)')!
    expect(sse.ok).toBe(false)
    expect(sse.detail).toContain('result')
  })

  it('never throws even when fetch itself rejects', async () => {
    const fetchFn = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    await expect(runSmokeChecks('http://x', fetchFn)).resolves.toBeDefined()
    const results = await runSmokeChecks('http://x', fetchFn)
    expect(results.every(r => !r.ok)).toBe(true)
  })
})

describe('allChecksPassed / formatSmokeCheckReport', () => {
  it('allChecksPassed is false when any check failed', async () => {
    const results = [{ name: 'a', ok: true }, { name: 'b', ok: false, detail: 'boom' }]
    expect(allChecksPassed(results)).toBe(false)
  })

  it('formatSmokeCheckReport renders PASS/FAIL lines with details', () => {
    const report = formatSmokeCheckReport([{ name: 'a', ok: true }, { name: 'b', ok: false, detail: 'boom' }])
    expect(report).toContain('PASS  a')
    expect(report).toContain('FAIL  b — boom')
  })
})
