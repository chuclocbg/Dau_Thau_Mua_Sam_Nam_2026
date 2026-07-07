import { describe, it, expect } from 'vitest'
import { checkLiveness, checkReadiness, checkHealth } from '../health/healthCheck.ts'
import type { Application } from '../bootstrap/buildApplication.ts'
import type { MCPClient } from '../mcp/application/mcpClient.ts'

function fakeApp(overrides: Partial<Application> = {}): Application {
  return {
    repository: {} as Application['repository'],
    reasoningPipeline: {} as Application['reasoningPipeline'],
    toolRegistry: {} as Application['toolRegistry'],
    toolExecutor: {} as Application['toolExecutor'],
    coordinator: {} as Application['coordinator'],
    startedAt: Date.now() - 5000,
    logger: {} as Application['logger'],
    metrics: {} as Application['metrics'],
    tracer: {} as Application['tracer'],
    nodeEnv: 'test',
    streamTimeoutMs: 30_000,
    ...overrides,
  }
}

describe('checkLiveness', () => {
  it('always reports ok with a non-negative uptime', () => {
    const liveness = checkLiveness(Date.now() - 2000)
    expect(liveness.status).toBe('ok')
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})

describe('checkReadiness', () => {
  it('reports ready with no MCP client configured', () => {
    const readiness = checkReadiness(fakeApp())
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.map(c => c.name)).toEqual(['reasoning-engine'])
  })

  it('reports ready when a configured MCP client is CONNECTED', () => {
    const mcpClient = { getStatus: () => 'CONNECTED' } as unknown as MCPClient
    const readiness = checkReadiness(fakeApp({ mcpClient }))
    expect(readiness.ready).toBe(true)
    expect(readiness.checks.find(c => c.name === 'mcp-client')!.ok).toBe(true)
  })

  it('reports not ready when a configured MCP client is DISCONNECTED', () => {
    const mcpClient = { getStatus: () => 'DISCONNECTED' } as unknown as MCPClient
    const readiness = checkReadiness(fakeApp({ mcpClient }))
    expect(readiness.ready).toBe(false)
    expect(readiness.checks.find(c => c.name === 'mcp-client')!.ok).toBe(false)
  })
})

describe('checkHealth', () => {
  it('aggregates liveness and readiness into status ok', () => {
    const health = checkHealth(fakeApp())
    expect(health.status).toBe('ok')
    expect(health.liveness.status).toBe('ok')
    expect(health.readiness.ready).toBe(true)
  })

  it('reports degraded when readiness fails', () => {
    const mcpClient = { getStatus: () => 'DISCONNECTED' } as unknown as MCPClient
    const health = checkHealth(fakeApp({ mcpClient }))
    expect(health.status).toBe('degraded')
  })
})
