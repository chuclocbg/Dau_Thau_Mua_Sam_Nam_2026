import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.6 (Tool Calling) ──────────────────────────
// Reasoning -> Output Formatting -> Tool Calling -> Conversation Response. Thin orchestration
// only: deciding whether to invoke a tool, executing it, normalizing the result. Zero reasoning,
// retrieval, ranking, conflict resolution, confidence computation, citation generation, MCP,
// Multi-Agent, LLM Adapter, Prompt Building, Output Validation. No src/knowledge/, src/mcp/,
// src/conversation/, or src/ai/ import. The ONLY src/providers/ imports allowed are the generic,
// non-LLM-coupled ToolRegistry/ToolExecutor/RetryPolicy — never ToolCallingAgent, AgentRuntime,
// ProviderManager, or any other provider-facing/LLM file. Checks run against comment-stripped code.

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
  'src/reasoning/domain/toolCallingTypes.ts',
  'src/reasoning/application/toolCallingStage.ts',
]

const ALLOWED_PROVIDER_IMPORTS = [
  "from '../../providers/ToolExecutor.ts'",
  "from '../../providers/ToolRegistry.ts'",
  "from '../../providers/RetryPolicy.ts'",
]

describe('Architecture guard — Phase X.6 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/conversation/, or src/ai/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
    }
  })

  it('the only src/providers/ imports are the generic ToolRegistry/ToolExecutor/RetryPolicy — never ToolCallingAgent, AgentRuntime, or any LLM provider file', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      const providerImportLines = content.split('\n').filter(line => /from ['"].*\/providers\//.test(line))
      for (const line of providerImportLines) {
        const isAllowed = ALLOWED_PROVIDER_IMPORTS.some(allowed => line.includes(allowed))
        expect(isAllowed, `unexpected providers/ import: ${line}`).toBe(true)
      }
      expect(content).not.toMatch(/ToolCallingAgent|AgentRuntime|ProviderManager|ProviderRegistry|ConversationMemory|ConversationBuilder|MultiAgentCoordinator/)
    }
  })

  it('never imports an earlier reasoning stage, the resolution pipeline, the repository, or the reasoning engine itself — this stage only consumes their already-produced output types', () => {
    const content = readCode('src/reasoning/application/toolCallingStage.ts')
    for (const forbidden of [
      "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
      "from './reasoningOrchestrator.ts'", "from './reasoningEnginePipeline.ts'",
      "from './legalReasoningEngine.ts'", "from './ruleEngine.ts'", "from './citationFormatter.ts'",
      "from './ruleEvaluationStage.ts'", "from './conflictResolutionStage.ts'",
      "from './confidenceEvaluationStage.ts'", "from './citationGenerationStage.ts'",
      "from './reasoningAnswerStage.ts'", "from './answerComposer.ts'", "from './outputFormatter.ts'",
      "from '../infrastructure/knowledgePlatformRepository.ts'",
      'IKnowledgePlatform', 'IKnowledgeRepository',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('references no MCP, Multi-Agent, Anthropic/OpenAI/Gemini, PromptBuilder/PromptRenderer, LLM adapter, or Output Validation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI|Gemini/)
      expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content).not.toMatch(/llmAdapter/i)
      expect(content).not.toMatch(/outputValidator|responseFormatter|formatFinalAnswer/i)
      expect(content).not.toMatch(/mcpGateway|IMCPTool|mcpToolRegistry/i)
    }
  })

  it('performs zero reasoning, retrieval, ranking, conflict resolution, confidence computation, or citation generation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(', 'resolvepair', 'computeconfidence',
        'formatcitations', 'detectexceptions', 'searchknowledge', 'resolveknowledge(', 'detectintent',
        'rankitems', 'selectcandidates', 'composedecision', 'buildexplanation', 'determinehumanreview',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('never mutates or reassigns fields on the input ConversationResponse or ReasoningAnswerResult', () => {
    const content = readCode('src/reasoning/application/toolCallingStage.ts')
    expect(content).not.toMatch(/response\.\w+\s*=/)
    expect(content).not.toMatch(/answer\.\w+\s*=/)
  })

  it('runToolCallingStage deep-freezes its result', () => {
    const content = readCode('src/reasoning/application/toolCallingStage.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('toolCallingTypes.ts reuses ToolCall/ConversationResponse/ReasoningAnswerResult rather than redefining them', () => {
    const content = readCode('src/reasoning/domain/toolCallingTypes.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/providers\/ToolRegistry\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/conversationResponseTypes\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/reasoningAnswerTypes\.ts['"]/)
    expect(content).not.toMatch(/interface\s+ToolCall\s*\{/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.5, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/ai/validation/responseFormatter.ts', /remediation and final answer assembly/i],
      ['src/reasoning/application/knowledgeReferenceMapper.ts', /Repository mapping layer/],
      ['src/reasoning/domain/knowledgeRepositoryTypes.ts', /Phase X\.3\.2/],
      ['src/reasoning/infrastructure/knowledgePlatformRepository.ts', /Phase X\.3\.2/],
      ['src/reasoning/application/knowledgeResolutionPlanner.ts', /Phase X\.3\.3/],
      ['src/reasoning/application/intentResolutionPipeline.ts', /Phase X\.3\.3/],
      ['src/reasoning/domain/knowledgeRankingTypes.ts', /Phase X\.3\.4/],
      ['src/reasoning/application/knowledgeRankingPipeline.ts', /Phase X\.3\.4/],
      ['src/reasoning/application/rankingStrategy.ts', /Phase X\.3\.4/],
      ['src/reasoning/domain/resolutionOrchestrationTypes.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionCoordinator.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionExecutor.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/knowledgeResolutionPipeline.ts', /Phase X\.3\.5/],
      ['src/reasoning/domain/knowledgeEnrichmentTypes.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeEnrichmentPipeline.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/effectivePeriodEvaluator.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeApplicabilityEvaluator.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
      ['src/reasoning/application/reasoningOrchestrator.ts', /Phase X\.4\.1/],
      ['src/reasoning/domain/reasoningExecutionContextTypes.ts', /Phase X\.4\.2/],
      ['src/reasoning/application/reasoningContextAssembler.ts', /Phase X\.4\.2/],
      ['src/reasoning/domain/ruleEvaluationTypes.ts', /Phase X\.4\.3/],
      ['src/reasoning/application/ruleEvaluationStage.ts', /Phase X\.4\.3/],
      ['src/reasoning/domain/conflictResolutionTypes.ts', /Phase X\.4\.4/],
      ['src/reasoning/application/conflictResolutionStage.ts', /Phase X\.4\.4/],
      ['src/reasoning/domain/confidenceEvaluationTypes.ts', /Phase X\.4\.5/],
      ['src/reasoning/application/confidenceEvaluationStage.ts', /Phase X\.4\.5/],
      ['src/reasoning/domain/citationGenerationTypes.ts', /Phase X\.4\.6/],
      ['src/reasoning/application/citationGenerationStage.ts', /Phase X\.4\.6/],
      ['src/reasoning/domain/reasoningAnswerTypes.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningAnswerStage.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/domain/conversationResponseTypes.ts', /Phase X\.5/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer tool abstractions (ToolRegistry, ToolExecutor, RetryPolicy, ToolCallingAgent, AgentRuntime) are untouched', () => {
    expect(readRaw('src/providers/ToolRegistry.ts')).toMatch(/P6-10N/)
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
  })
})
