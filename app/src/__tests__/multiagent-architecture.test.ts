import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.8 (Multi-Agent Orchestration) ────────────
// Agents never perform reasoning independently; reasoning remains centralized. CoordinatorAgent
// and taskScheduler.ts must have ZERO knowledge of reasoning/retrieval/Tool Calling/MCP/
// formatting — every WorkerTask is an opaque callback. reasoningWorkerAdapter.ts is the ONE
// permitted composition point into the reasoning layer, and it may only call already-frozen,
// already-exported functions — never reimplement them. Checks run against comment-stripped code.

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

const CORE_FILES = [
  'src/multiagent/domain/multiAgentTypes.ts',
  'src/multiagent/application/taskScheduler.ts',
  'src/multiagent/application/coordinatorAgent.ts',
]

const ALL_NEW_FILES = [...CORE_FILES, 'src/multiagent/application/reasoningWorkerAdapter.ts']

describe('Architecture guard — Phase X.8 dependency direction', () => {
  it('multiAgentTypes.ts, taskScheduler.ts, and coordinatorAgent.ts never import src/reasoning/, src/knowledge/, src/mcp/, src/ai/, or src/conversation/ at all', () => {
    for (const file of CORE_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/reasoning/`).not.toMatch(/from ['"].*\/reasoning\//)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('reasoningWorkerAdapter.ts is the only new file importing src/reasoning/, and only the already-frozen entry points it needs', () => {
    const content = readCode('src/multiagent/application/reasoningWorkerAdapter.ts')
    for (const required of [
      "from '../../reasoning/application/outputFormatter.ts'",
      "from '../../reasoning/application/toolCallingStage.ts'",
      "from '../../reasoning/application/reasoningEnginePipeline.ts'",
    ]) {
      expect(content, `must import ${required}`).toContain(required)
    }
    for (const forbidden of [
      "from '../../reasoning/application/ruleEngine.ts'", "from '../../reasoning/application/legalReasoningEngine.ts'",
      "from '../../reasoning/application/citationFormatter.ts'", "from '../../reasoning/application/answerComposer.ts'",
      "from '../../reasoning/application/finalKnowledgeResolutionPipeline.ts'",
      "from '../../reasoning/infrastructure/knowledgePlatformRepository.ts'",
      'IKnowledgePlatform', 'IKnowledgeRepository',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('the only src/providers/ imports across all new files are RetryPolicy.ts (types) and ToolExecutor.ts (types) — never ToolCallingAgent, AgentRuntime, MultiAgentCoordinator, ProviderManager, or ProviderRegistry', () => {
    const allowed = ["from '../../providers/RetryPolicy.ts'", "from '../../providers/ToolExecutor.ts'"]
    for (const file of ALL_NEW_FILES) {
      const content = readCode(file)
      const providerImportLines = content.split('\n').filter(line => /from ['"].*\/providers\//.test(line))
      for (const line of providerImportLines) {
        expect(allowed.some(a => line.includes(a)), `unexpected providers/ import in ${file}: ${line}`).toBe(true)
      }
      expect(content).not.toMatch(/ToolCallingAgent|AgentRuntime|MultiAgentCoordinator|ProviderManager|ProviderRegistry|ConversationMemory|ConversationBuilder/)
    }
  })

  it('never duplicates reasoning, retrieval, Tool Calling, MCP, or formatting logic (no reimplemented business logic)', () => {
    for (const file of ALL_NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(', 'computeconfidence',
        'formatcitations', 'composedecision', 'buildexplanation', 'determinehumanreview',
        'detectintent', 'rankitems', 'selectcandidates', 'searchknowledge', 'resolveknowledge(',
        'mcpclient', 'registermcptools', 'httpmcptransport',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('coordinatorAgent.ts and taskScheduler.ts never call runToolCallingStage or formatConversationResponse directly', () => {
    for (const file of ['src/multiagent/application/coordinatorAgent.ts', 'src/multiagent/application/taskScheduler.ts']) {
      const content = readCode(file)
      expect(content).not.toContain('runToolCallingStage')
      expect(content).not.toContain('formatConversationResponse')
    }
  })

  it('reasoningWorkerAdapter.ts never reimplements RetryPolicy\'s or ToolExecutor\'s own logic — only imports their types', () => {
    const content = readCode('src/multiagent/application/reasoningWorkerAdapter.ts')
    expect(content).not.toMatch(/class RetryPolicy|class ToolExecutor|new RetryPolicy|new ToolExecutor/)
  })

  it('CoordinatorAgent reuses RetryPolicy directly rather than reimplementing backoff', () => {
    const content = readCode('src/multiagent/application/coordinatorAgent.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/providers\/RetryPolicy\.ts['"]/)
    expect(content).toMatch(/new RetryPolicy\(/)
    expect(content).not.toMatch(/class RetryPolicy/)
  })

  it('worker tasks never mutate the shared dependencyResults map passed to them (coordinator owns writes)', () => {
    const content = readCode('src/multiagent/application/coordinatorAgent.ts')
    expect(content).toMatch(/ReadonlyMap<string, unknown>/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.7, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/ai/validation/responseFormatter.ts', /remediation and final answer assembly/i],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
      ['src/reasoning/application/reasoningOrchestrator.ts', /Phase X\.4\.1/],
      ['src/reasoning/application/reasoningContextAssembler.ts', /Phase X\.4\.2/],
      ['src/reasoning/application/ruleEvaluationStage.ts', /Phase X\.4\.3/],
      ['src/reasoning/application/conflictResolutionStage.ts', /Phase X\.4\.4/],
      ['src/reasoning/application/confidenceEvaluationStage.ts', /Phase X\.4\.5/],
      ['src/reasoning/application/citationGenerationStage.ts', /Phase X\.4\.6/],
      ['src/reasoning/application/reasoningAnswerStage.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
      ['src/mcp/domain/mcpTypes.ts', /Phase X\.7/],
      ['src/mcp/application/mcpClient.ts', /Phase X\.7/],
      ['src/mcp/application/mcpToolAdapter.ts', /Phase X\.7/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer files (RetryPolicy, ToolExecutor, ToolRegistry, MultiAgentCoordinator, AgentRuntime) are untouched', () => {
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/ToolRegistry.ts')).toMatch(/P6-10N/)
    expect(readRaw('src/providers/MultiAgentCoordinator.ts')).toMatch(/P6-10V/)
  })
})
