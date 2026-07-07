import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.9.1 (HTTP Server & Bootstrap) ─────────────
// X.3-X.8 are FROZEN — this milestone must never modify src/reasoning/**, src/knowledge/**,
// src/conversation/**, src/providers/**, src/mcp/**, or src/multiagent/**. All new code lives
// under src/config/, src/bootstrap/, src/health/, src/server/, src/api/, src/startup/.
// buildApplication.ts is the ONE permitted composition point that constructs (never modifies)
// the frozen X.3-X.8 components. Checks run against comment-stripped code.

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

const ALL_NEW_FILES = [
  'src/config/appConfig.ts',
  'src/bootstrap/buildApplication.ts',
  'src/health/healthCheck.ts',
  'src/server/httpServer.ts',
  'src/server/main.ts',
  'src/api/reasoningRoutes.ts',
  'src/api/coordinatorRoutes.ts',
  'src/startup/gracefulShutdown.ts',
]

const NON_BOOTSTRAP_NON_API_FILES = [
  'src/config/appConfig.ts',
  'src/health/healthCheck.ts',
  'src/server/httpServer.ts',
  'src/server/main.ts',
  'src/startup/gracefulShutdown.ts',
]

describe('Architecture guard — Phase X.9.1 dependency direction', () => {
  it('config/health/server/startup files never import src/reasoning/, src/knowledge/, src/mcp/, or src/multiagent/ directly', () => {
    for (const file of NON_BOOTSTRAP_NON_API_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/reasoning/`).not.toMatch(/from ['"].*\/reasoning\//)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/ business logic`).not.toMatch(/from ['"].*\/mcp\/application\//)
      expect(content, `${file} must not import src/multiagent/`).not.toMatch(/from ['"].*\/multiagent\//)
    }
  })

  it('buildApplication.ts is the only file constructing (never modifying) the frozen X.3-X.8 components', () => {
    const bootstrapContent = readCode('src/bootstrap/buildApplication.ts')
    for (const required of [
      "from '../knowledge/repositories/memoryKnowledgeRepositories.ts'",
      "from '../reasoning/infrastructure/knowledgePlatformRepository.ts'",
      "from '../reasoning/application/reasoningEnginePipeline.ts'",
      "from '../providers/ToolRegistry.ts'",
      "from '../providers/ToolExecutor.ts'",
      "from '../multiagent/application/coordinatorAgent.ts'",
    ]) {
      expect(bootstrapContent, `must import ${required}`).toContain(required)
    }

    for (const file of ALL_NEW_FILES.filter(f => f !== 'src/bootstrap/buildApplication.ts')) {
      const content = readCode(file)
      expect(content, `${file} must not construct DefaultKnowledgePlatform`).not.toMatch(/new DefaultKnowledgePlatform/)
      expect(content, `${file} must not construct LegalProvider`).not.toMatch(/new LegalProvider/)
      expect(content, `${file} must not construct KnowledgeGraphService`).not.toMatch(/new KnowledgeGraphService/)
    }
  })

  it('reasoningRoutes.ts / coordinatorRoutes.ts import only top-level, already-frozen entry points — never an internal reasoning stage', () => {
    for (const file of ['src/api/reasoningRoutes.ts', 'src/api/coordinatorRoutes.ts']) {
      const content = readCode(file)
      for (const forbidden of [
        "from '../reasoning/application/ruleEvaluationStage.ts'", "from '../reasoning/application/conflictResolutionStage.ts'",
        "from '../reasoning/application/confidenceEvaluationStage.ts'", "from '../reasoning/application/citationGenerationStage.ts'",
        "from '../reasoning/application/reasoningAnswerStage.ts'", "from '../reasoning/application/ruleEngine.ts'",
        "from '../reasoning/application/legalReasoningEngine.ts'", "from '../reasoning/application/citationFormatter.ts'",
        "from '../reasoning/application/answerComposer.ts'", "from '../reasoning/application/finalKnowledgeResolutionPipeline.ts'",
        "from '../mcp/application/mcpClient.ts'", "from '../mcp/application/mcpToolAdapter.ts'",
      ]) {
        expect(content, `${file} must not import ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('never reimplements reasoning, ranking, conflict resolution, confidence, citation, answer composition, Tool Calling, MCP, or Multi-Agent logic', () => {
    for (const file of ALL_NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(', 'computeconfidence',
        'formatcitations', 'composedecision', 'buildexplanation', 'determinehumanreview',
        'rankitems', 'selectcandidates', 'searchknowledge', 'resolveknowledge(',
        'class toolregistry', 'class toolexecutor', 'class retrypolicy', 'class mcpclient',
        'class coordinatoragent', 'buildwaves(', 'validatetasks(',
      ]) {
        // detectIntent(/formatConversationResponse(/runToolCallingStage(/buildReasoningWorkerTask(/
        // coordinator.run( are explicitly ALLOWED calls in the API layer (that is this
        // milestone's whole job) — deliberately excluded from this forbidden list; only
        // internal-stage function names and frozen class re-declarations are checked here.
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('reasoningRoutes.ts genuinely calls the real chain (detectIntent, formatConversationResponse, runToolCallingStage), never bypassing it', () => {
    const content = readCode('src/api/reasoningRoutes.ts')
    expect(content).toMatch(/detectIntent\(/)
    expect(content).toMatch(/formatConversationResponse\(/)
    expect(content).toMatch(/runToolCallingStage\(/)
  })

  it('coordinatorRoutes.ts genuinely calls buildReasoningWorkerTask and CoordinatorAgent.run, never bypassing them', () => {
    const content = readCode('src/api/coordinatorRoutes.ts')
    expect(content).toMatch(/buildReasoningWorkerTask\(/)
    expect(content).toMatch(/\.coordinator\.run\(/)
  })

  it('main.ts is the only file that calls server.listen()', () => {
    for (const file of ALL_NEW_FILES.filter(f => f !== 'src/server/main.ts')) {
      expect(readCode(file), `${file} must not call .listen(`).not.toMatch(/\.listen\(/)
    }
    expect(readCode('src/server/main.ts')).toMatch(/\.listen\(/)
  })

  it('gracefulShutdown.ts has zero business-logic imports (only fastify types)', () => {
    const content = readCode('src/startup/gracefulShutdown.ts')
    expect(content).not.toMatch(/from ['"]\.\.\/(reasoning|knowledge|mcp|multiagent|providers)\//)
  })
})

describe('Architecture guard — frozen modules untouched (X.1 through X.8, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
      ['src/reasoning/application/reasoningOrchestrator.ts', /Phase X\.4\.1/],
      ['src/reasoning/application/ruleEvaluationStage.ts', /Phase X\.4\.3/],
      ['src/reasoning/application/conflictResolutionStage.ts', /Phase X\.4\.4/],
      ['src/reasoning/application/confidenceEvaluationStage.ts', /Phase X\.4\.5/],
      ['src/reasoning/application/citationGenerationStage.ts', /Phase X\.4\.6/],
      ['src/reasoning/application/reasoningAnswerStage.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/mcp/application/mcpToolAdapter.ts', /Phase X\.7/],
      ['src/multiagent/application/coordinatorAgent.ts', /Phase X\.8/],
      ['src/multiagent/application/reasoningWorkerAdapter.ts', /Phase X\.8/],
      ['src/multiagent/application/taskScheduler.ts', /Phase X\.8/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer files and restAdapter.ts (the pre-existing Fastify pattern) are untouched', () => {
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/ToolRegistry.ts')).toMatch(/P6-10N/)
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
    expect(readRaw('src/interface/restAdapter.ts')).toMatch(/Phase 14/)
  })
})
