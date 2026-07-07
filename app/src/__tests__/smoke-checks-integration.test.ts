import { describe, it, expect, afterEach } from 'vitest'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildHttpServer } from '../server/httpServer.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { runSmokeChecks, allChecksPassed } from '../startup/smokeChecks.ts'
import { waitForReady } from '../startup/waitForReady.ts'
import type { FastifyInstance } from 'fastify'

// True end-to-end integration test for Phase X.9.5 — runSmokeChecks()/waitForReady() exercised
// against a REAL Application wired into a REAL Fastify instance bound to a REAL listening
// socket (matching the established X.9.3/X.9.4 real-server precedent — Fastify's inject() does
// not support the SSE route's reply.hijack(), confirmed in X.9.3). Proves this milestone's
// black-box HTTP checks genuinely pass against the real, complete X.9.1-X.9.3 chain, not a fake.

const runningServers: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(s => s.close()))
})

async function buildRealServer(): Promise<{ url: string; server: FastifyInstance }> {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const app = await buildApplication(config.value)
  const server = buildHttpServer(app)
  runningServers.push(server)
  await server.listen({ port: 0, host: '127.0.0.1' })
  const address = server.server.address()
  if (address === null || typeof address === 'string') throw new Error('unreachable: expected a real address')
  return { url: `http://127.0.0.1:${address.port}`, server }
}

describe('runSmokeChecks — real server integration', () => {
  it('every check passes against a real, freshly-started Application', async () => {
    const { url } = await buildRealServer()
    const results = await runSmokeChecks(url)
    expect(allChecksPassed(results)).toBe(true)
    expect(results).toHaveLength(6)
  })

  it('is deterministic aside from timestamps: two runs against the same server both pass identically', async () => {
    const { url } = await buildRealServer()
    const first = await runSmokeChecks(url)
    const second = await runSmokeChecks(url)
    expect(first.map(r => ({ name: r.name, ok: r.ok }))).toEqual(second.map(r => ({ name: r.name, ok: r.ok })))
  })
})

describe('waitForReady — real server integration', () => {
  it('reports ready:true immediately for an already-started real server', async () => {
    const { url } = await buildRealServer()
    const result = await waitForReady(`${url}/ready`, { retry: { maxAttempts: 3, retryDelayMs: 10 } })
    expect(result.ready).toBe(true)
    expect(result.attempts).toBe(1)
    expect(result.lastStatus).toBe(200)
  })

  it('reports ready:false for a URL nothing is listening on', async () => {
    const result = await waitForReady('http://127.0.0.1:1/ready', { retry: { maxAttempts: 2, retryDelayMs: 10 } })
    expect(result.ready).toBe(false)
    expect(result.attempts).toBe(2)
  })
})
