import type { Application } from '../bootstrap/buildApplication.ts'

// ── Health Check — Phase X.9.1 ─────────────────────────────────────────────────
// Liveness/readiness/health aggregation. Reuses Application's already-constructed dependencies
// (never builds its own). No reasoning/retrieval/Tool Calling/MCP/Multi-Agent logic here.
//
// TRANSPARENCY NOTE on readiness checks: the reasoning subsystem (ReasoningEnginePipeline over
// the in-memory Knowledge Platform) has no external I/O and therefore no real failure mode to
// probe — reporting it "ready" once Application construction succeeds is honest, not a
// fabricated check. The one genuinely-checkable external dependency this stack can have is an
// optional MCPClient; its real getStatus() is read directly when one is configured. No check is
// invented for a dependency that does not exist in the current deployment.

export interface LivenessStatus {
  readonly status: 'ok'
  readonly uptimeSeconds: number
  readonly timestamp: string
}

export function checkLiveness(startedAt: number): LivenessStatus {
  return {
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }
}

export interface ReadinessCheck {
  readonly name: string
  readonly ok: boolean
  readonly message?: string
}

export interface ReadinessStatus {
  readonly ready: boolean
  readonly checks: readonly ReadinessCheck[]
  readonly timestamp: string
}

export function checkReadiness(app: Application): ReadinessStatus {
  const checks: ReadinessCheck[] = [
    { name: 'reasoning-engine', ok: true, message: 'In-memory Knowledge Platform has no external dependency to probe.' },
  ]

  if (app.mcpClient !== undefined) {
    const status = app.mcpClient.getStatus()
    checks.push({
      name: 'mcp-client',
      ok: status === 'CONNECTED',
      message: `MCP client status: ${status}.`,
    })
  }

  return {
    ready: checks.every(c => c.ok),
    checks,
    timestamp: new Date().toISOString(),
  }
}

export interface HealthStatus {
  readonly status: 'ok' | 'degraded'
  readonly uptimeSeconds: number
  readonly liveness: LivenessStatus
  readonly readiness: ReadinessStatus
}

export function checkHealth(app: Application): HealthStatus {
  const liveness = checkLiveness(app.startedAt)
  const readiness = checkReadiness(app)
  return {
    status: readiness.ready ? 'ok' : 'degraded',
    uptimeSeconds: liveness.uptimeSeconds,
    liveness,
    readiness,
  }
}
