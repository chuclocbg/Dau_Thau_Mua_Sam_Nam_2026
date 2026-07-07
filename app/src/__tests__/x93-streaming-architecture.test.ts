import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.9.3 (Streaming / SSE / HTTP Cancellation) ─────────
// X.3-X.9.2 are FROZEN. This milestone may touch src/config/appConfig.ts, src/bootstrap/
// buildApplication.ts, and src/server/httpServer.ts ONLY for additive dependency-injection/
// wiring (streamTimeoutMs, registering the new SSE route) — never business logic. All other new
// code lives under src/streaming/, src/http/, src/cancellation/. Checks run against
// comment-stripped code.

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

const PURE_FILES = [
  'src/streaming/sseTypes.ts',
  'src/streaming/sseWriter.ts',
  'src/streaming/streamRace.ts',
  'src/cancellation/requestAbortSignal.ts',
]

const ALL_NEW_FILES = [...PURE_FILES, 'src/http/reasoningStreamRoute.ts']

const DI_TOUCHED_FILES = [
  'src/config/appConfig.ts',
  'src/bootstrap/buildApplication.ts',
  'src/server/httpServer.ts',
]

describe('Architecture guard — Phase X.9.3 dependency direction', () => {
  it('sseTypes.ts/sseWriter.ts/streamRace.ts/requestAbortSignal.ts import nothing beyond Node builtins and their own types', () => {
    for (const file of PURE_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import any src/ module`).not.toMatch(/from ['"]\.\.\/(?!streaming|cancellation)/)
    }
  })

  it('reasoningStreamRoute.ts imports only top-level, already-frozen reasoning entry points — never an internal stage, MCP, or Multi-Agent module', () => {
    const content = readCode('src/http/reasoningStreamRoute.ts')
    for (const required of [
      "from '../reasoning/application/intentDetector.ts'", "from '../reasoning/application/outputFormatter.ts'",
      "from '../reasoning/application/toolCallingStage.ts'",
    ]) {
      expect(content, `must import ${required}`).toContain(required)
    }
    for (const forbidden of [
      "from '../reasoning/application/ruleEvaluationStage.ts'", "from '../reasoning/application/conflictResolutionStage.ts'",
      "from '../reasoning/application/confidenceEvaluationStage.ts'", "from '../reasoning/application/citationGenerationStage.ts'",
      "from '../reasoning/application/reasoningAnswerStage.ts'", "from '../reasoning/application/ruleEngine.ts'",
      "from '../reasoning/application/legalReasoningEngine.ts'", "from '../reasoning/application/citationFormatter.ts'",
      "from '../reasoning/application/answerComposer.ts'", "from '../mcp/application/mcpClient.ts'",
      "from '../multiagent/application/coordinatorAgent.ts'",
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('never reimplements RetryPolicy, ConversationResponse, Tool Calling, MCP, or Reasoning pipeline logic', () => {
    for (const file of [...ALL_NEW_FILES, ...DI_TOUCHED_FILES]) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'class retrypolicy', 'class toolexecutor', 'class toolregistry', 'class mcpclient',
        'class coordinatoragent', 'evaluaterule(', 'resolveconflicts(', 'computeconfidence',
        'formatcitations', 'composedecision', 'interface conversationresponse',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('reasoningStreamRoute.ts genuinely calls the real chain — never bypasses formatConversationResponse or runToolCallingStage', () => {
    const content = readCode('src/http/reasoningStreamRoute.ts')
    expect(content).toMatch(/detectIntent\(/)
    expect(content).toMatch(/formatConversationResponse\(/)
    expect(content).toMatch(/runToolCallingStage\(/)
  })

  it('buildApplication.ts (DI-touched) still constructs every X.9.1/X.9.2 core component and now additionally threads streamTimeoutMs', () => {
    const content = readCode('src/bootstrap/buildApplication.ts')
    for (const required of [
      'buildKnowledgePlatformRepository', 'buildReasoningEnginePipeline', 'new ToolRegistry()',
      'new ToolExecutor(', 'new CoordinatorAgent()', 'createStructuredLogger(', 'new MetricsCollector()',
      'new SimpleTracer()', 'streamTimeoutMs',
    ]) {
      expect(content, `must still contain ${required}`).toContain(required)
    }
  })

  it('httpServer.ts (DI-touched) still registers every X.9.1/X.9.2 route/hook and now additionally the SSE stream route', () => {
    const content = readCode('src/server/httpServer.ts')
    for (const required of [
      "server.get('/live'", "server.get('/ready'", "server.get('/health'",
      'registerReasoningRoutes(', 'registerCoordinatorRoutes(', 'registerRequestLifecycleHooks(',
      'registerReasoningStreamRoute(',
    ]) {
      expect(content, `must still contain ${required}`).toContain(required)
    }
  })

  it('appConfig.ts (DI-touched) still validates every prior field and now additionally STREAM_TIMEOUT_MS', () => {
    const content = readCode('src/config/appConfig.ts')
    for (const required of ['INVALID_PORT', 'INVALID_NODE_ENV', 'INVALID_LOG_FORMAT', 'INVALID_SHUTDOWN_TIMEOUT', 'INVALID_STREAM_TIMEOUT']) {
      expect(content, `must still validate ${required}`).toContain(required)
    }
  })

  it('reasoningStreamRoute.ts reuses the real logger/metrics/tracer from Application rather than constructing its own', () => {
    const content = readCode('src/http/reasoningStreamRoute.ts')
    expect(content).not.toMatch(/createStructuredLogger\(|new MetricsCollector\(|new SimpleTracer\(/)
    expect(content).toMatch(/app\.logger/)
    expect(content).toMatch(/app\.metrics/)
    expect(content).toMatch(/app\.tracer/)
  })
})

describe('Architecture guard — frozen modules untouched (X.1 through X.9.2, and everything before)', () => {
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
      ['src/logging/structuredLogger.ts', /Phase X\.9\.2/],
      ['src/logging/requestContext.ts', /Phase X\.9\.2/],
      ['src/tracing/tracer.ts', /Phase X\.9\.2/],
      ['src/metrics/requestMetrics.ts', /Phase X\.9\.2/],
      ['src/middleware/errorMapper.ts', /Phase X\.9\.2/],
      ['src/middleware/requestLifecycleHooks.ts', /Phase X\.9\.2/],
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
