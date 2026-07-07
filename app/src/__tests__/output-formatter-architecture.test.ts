import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.5 (Output Formatting) ─────────────────────
// Per this milestone's rules: pure presentation only — zero reasoning, retrieval, ranking,
// conflict resolution, confidence computation, citation generation, MCP, Tool Calling,
// Multi-Agent. No src/knowledge/, src/mcp/, src/conversation/ import, and critically — no
// src/ai/validation/ import at all (the "existing Output Formatter" there is for a different,
// LLM-text-based pipeline and is never reused or touched). Checks run against comment-stripped
// code.

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
  'src/reasoning/domain/conversationResponseTypes.ts',
  'src/reasoning/application/outputFormatter.ts',
]

describe('Architecture guard — Phase X.5 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/conversation/, or src/ai/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
      expect(content, `${file} must not import src/ai/ (including the existing, different Output Formatter in src/ai/validation/)`).not.toMatch(/from ['"].*\/ai\//)
    }
  })

  it('outputFormatter.ts imports only answerComposer.ts and reasoning\'s own domain types — never a repository, platform, orchestrator, engine, any earlier X.4.x stage, ruleEngine.ts, or citationFormatter.ts directly', () => {
    const content = readCode('src/reasoning/application/outputFormatter.ts')
    expect(content).toMatch(/from ['"]\.\/answerComposer\.ts['"]/)
    for (const forbidden of [
      "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
      "from './reasoningOrchestrator.ts'", "from './reasoningEnginePipeline.ts'",
      "from './legalReasoningEngine.ts'", "from './ruleEngine.ts'", "from './citationFormatter.ts'",
      "from './ruleEvaluationStage.ts'", "from './conflictResolutionStage.ts'",
      "from './confidenceEvaluationStage.ts'", "from './citationGenerationStage.ts'",
      "from './reasoningAnswerStage.ts'", "from '../infrastructure/knowledgePlatformRepository.ts'",
      'IKnowledgePlatform', 'IKnowledgeRepository',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('references no MCP, Tool Calling, Multi-Agent, provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, LLM adapter, or Output Validation (the existing, different formatter)', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/from ['"].*\/providers\//)
      expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content).not.toMatch(/llmAdapter/i)
      expect(content).not.toMatch(/outputValidator|responseFormatter|formatFinalAnswer/i)
      expect(content).not.toMatch(/multiAgent|toolCalling|mcpGateway/i)
    }
  })

  it('performs zero reasoning, retrieval, ranking, conflict resolution, confidence computation, or citation generation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(', 'resolvepair', 'computeconfidence',
        'formatcitations', 'detectexceptions', 'searchknowledge', 'resolveknowledge(', 'detectintent',
        'rankitems', 'selectcandidates',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('never mutates or reassigns fields on the input ReasoningAnswerResult (no assignment into its properties)', () => {
    const content = readCode('src/reasoning/application/outputFormatter.ts')
    expect(content).not.toMatch(/answer\.\w+\s*=/)
  })

  it('formatConversationResponse deep-freezes its result', () => {
    const content = readCode('src/reasoning/application/outputFormatter.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('conversationResponseTypes.ts reuses ConfidenceLabel rather than duplicating it', () => {
    const content = readCode('src/reasoning/domain/conversationResponseTypes.ts')
    expect(content).toMatch(/from ['"]\.\/reasoningTypes\.ts['"]/)
    expect(content).not.toMatch(/type\s+ConfidenceLabel\s*=/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through the Final X.4 Integration, and everything before)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })
})
