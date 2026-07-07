import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.9.2 (Logging / Metrics / Tracing / Error Middleware) ──
// X.3-X.9.1 are FROZEN. This milestone may touch src/config/appConfig.ts, src/bootstrap/
// buildApplication.ts, and src/server/httpServer.ts ONLY for additive dependency-injection
// wiring (constructing/passing a logger, metrics collector, and tracer) — never business logic.
// All other new code lives under src/logging/, src/metrics/, src/tracing/, src/middleware/.
// Checks run against comment-stripped code.

const REPO_ROOT = process.cwd()

function readRaw(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8')
}

function readCode(relativePath: string): string {
  return readRaw(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const NEW_FILES = [
  'src/logging/structuredLogger.ts',
  'src/logging/requestContext.ts',
  'src/tracing/tracingTypes.ts',
  'src/tracing/tracer.ts',
  'src/metrics/requestMetrics.ts',
  'src/middleware/errorMapper.ts',
  'src/middleware/requestLifecycleHooks.ts',
]

const DI_TOUCHED_FILES = [
  'src/config/appConfig.ts',
  'src/bootstrap/buildApplication.ts',
  'src/server/httpServer.ts',
]

describe('Architecture guard — Phase X.9.2 dependency direction', () => {
  it('no new observability file imports src/reasoning/, src/knowledge/, src/mcp/, src/multiagent/, src/conversation/, src/api/, or src/health/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of ['/reasoning/', '/knowledge/', '/mcp/', '/multiagent/', '/conversation/', '/api/', '/health/']) {
        expect(content, `${file} must not import ${forbidden}`).not.toMatch(new RegExp(`from ['"].*\\${forbidden}`))
      }
    }
  })

  it('requestLifecycleHooks.ts imports only fastify, logging/tracing/metrics/middleware, and config — never a frozen business-logic module', () => {
    const content = readCode('src/middleware/requestLifecycleHooks.ts')
    expect(content).toMatch(/from ['"]fastify['"]/)
    for (const required of [
      "from '../logging/requestContext.ts'", "from '../tracing/tracer.ts'",
      "from '../metrics/requestMetrics.ts'", "from './errorMapper.ts'",
    ]) {
      expect(content, `must import ${required}`).toContain(required)
    }
    expect(content).not.toMatch(/from ['"].*\/(reasoning|knowledge|mcp|multiagent)\//)
  })

  it('requestMetrics.ts genuinely delegates to MetricsCollector rather than reimplementing counter storage', () => {
    const content = readCode('src/metrics/requestMetrics.ts')
    expect(content).toMatch(/from ['"]\.\.\/providers\/MetricsCollector\.ts['"]/)
    expect(content).not.toMatch(/new Map\(|class MetricsCollector/)
  })

  it('tracer.ts and structuredLogger.ts have zero dependency on any vendor OpenTelemetry package', () => {
    for (const file of ['src/tracing/tracer.ts', 'src/tracing/tracingTypes.ts', 'src/logging/structuredLogger.ts']) {
      expect(readCode(file)).not.toMatch(/@opentelemetry/)
    }
  })

  it('buildApplication.ts (DI-touched) still constructs every X.9.1 core component and now additionally the X.9.2 observability trio', () => {
    const content = readCode('src/bootstrap/buildApplication.ts')
    for (const required of [
      'buildKnowledgePlatformRepository', 'buildReasoningEnginePipeline', 'new ToolRegistry()',
      'new ToolExecutor(', 'new CoordinatorAgent()',
      'createStructuredLogger(', 'new MetricsCollector()', 'new SimpleTracer()',
    ]) {
      expect(content, `must still contain ${required}`).toContain(required)
    }
  })

  it('httpServer.ts (DI-touched) still registers every X.9.1 route and now additionally the request lifecycle hooks', () => {
    const content = readCode('src/server/httpServer.ts')
    for (const required of [
      "server.get('/live'", "server.get('/ready'", "server.get('/health'",
      'registerReasoningRoutes(', 'registerCoordinatorRoutes(', 'registerRequestLifecycleHooks(',
    ]) {
      expect(content, `must still contain ${required}`).toContain(required)
    }
  })

  it('appConfig.ts (DI-touched) still validates PORT/NODE_ENV/SHUTDOWN_TIMEOUT_MS and now additionally LOG_FORMAT', () => {
    const content = readCode('src/config/appConfig.ts')
    for (const required of ['INVALID_PORT', 'INVALID_NODE_ENV', 'INVALID_SHUTDOWN_TIMEOUT', 'INVALID_LOG_FORMAT']) {
      expect(content, `must still validate ${required}`).toContain(required)
    }
  })

  it('never reimplements RetryPolicy, ConversationResponse, Tool Calling, MCP, or Reasoning pipeline logic', () => {
    for (const file of [...NEW_FILES, ...DI_TOUCHED_FILES]) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'class retrypolicy', 'class toolexecutor', 'class toolregistry', 'class mcpclient',
        'class coordinatoragent', 'class reasoningengine', 'evaluaterule(', 'resolveconflicts(',
        'computeconfidence', 'formatcitations', 'composedecision', 'runtoolcallingstage(',
        'interface conversationresponse',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })
})

describe('Architecture guard — frozen modules untouched (X.1 through X.9.1, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/multiagent/application/coordinatorAgent.ts', /Phase X\.8/],
      ['src/health/healthCheck.ts', /Phase X\.9\.1/],
      ['src/api/reasoningRoutes.ts', /Phase X\.9\.1/],
      ['src/api/coordinatorRoutes.ts', /Phase X\.9\.1/],
      ['src/startup/gracefulShutdown.ts', /Phase X\.9\.1/],
      ['src/server/main.ts', /Phase X\.9\.1/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer files and restAdapter.ts remain untouched', () => {
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
    expect(readRaw('src/providers/MetricsCollector.ts')).toMatch(/P6-11E/)
    expect(readRaw('src/interface/restAdapter.ts')).toMatch(/Phase 14/)
  })
})
