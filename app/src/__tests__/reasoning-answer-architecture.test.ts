import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4.7 (Reasoning Answer Composition) ────────
// Per this milestone's rules: deterministic answer composition only — zero new rule
// evaluation, zero new conflict resolution, zero recomputed confidence, zero regenerated
// citations, zero repository/KnowledgePlatform/provider/LLM/PromptBuilder/MCP/Tool Calling/
// Multi-Agent access. No src/knowledge/, src/ai/, src/mcp/, or src/conversation/ import. Checks
// run against comment-stripped code.

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
  'src/reasoning/domain/reasoningAnswerTypes.ts',
  'src/reasoning/application/reasoningAnswerStage.ts',
]

describe('Architecture guard — Phase X.4.7 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('reasoningAnswerStage.ts imports only answerComposer.ts and reasoning\'s own domain types — never a repository, platform, orchestrator, engine, ruleEngine.ts, citationFormatter.ts, conflictResolutionStage.ts, or confidenceEvaluationStage.ts directly', () => {
    const content = readCode('src/reasoning/application/reasoningAnswerStage.ts')
    expect(content).toMatch(/from ['"]\.\/answerComposer\.ts['"]/)
    for (const forbidden of [
      "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
      "from './reasoningOrchestrator.ts'", "from './legalReasoningEngine.ts'", "from './ruleEngine.ts'",
      "from './ruleEvaluationStage.ts'", "from './conflictResolutionStage.ts'",
      "from './confidenceEvaluationStage.ts'", "from './citationFormatter.ts'", "from './citationGenerationStage.ts'",
      "from '../infrastructure/knowledgePlatformRepository.ts'", 'IKnowledgePlatform', 'IKnowledgeRepository',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('references no MCP, Tool Calling, Multi-Agent, provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, or LLM adapter', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/from ['"].*\/providers\//)
      expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content).not.toMatch(/llmAdapter/i)
      expect(content).not.toMatch(/outputValidator/i)
      expect(content).not.toMatch(/multiAgent|toolCalling|mcpGateway/i)
    }
  })

  it('performs zero rule evaluation, conflict resolution, confidence computation, or citation formatting', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(', 'resolvepair', 'computeconfidence',
        'formatcitations', 'detectexceptions', 'searchknowledge', 'resolveknowledge(', 'detectintent',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('never mutates or reassigns fields on any of its three result inputs (no assignment into their properties)', () => {
    const content = readCode('src/reasoning/application/reasoningAnswerStage.ts')
    expect(content).not.toMatch(/conflictResolution\.\w+\s*=/)
    expect(content).not.toMatch(/confidenceEvaluation\.\w+\s*=/)
    expect(content).not.toMatch(/citationGeneration\.\w+\s*=/)
  })

  it('composeAnswer deep-freezes its result', () => {
    const content = readCode('src/reasoning/application/reasoningAnswerStage.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('reasoningAnswerTypes.ts reuses ConfidenceComponents/DetectedConflict/FormattedCitation rather than duplicating them', () => {
    const content = readCode('src/reasoning/domain/reasoningAnswerTypes.ts')
    expect(content).toMatch(/from ['"]\.\/reasoningTypes\.ts['"]/)
    expect(content).not.toMatch(/interface\s+ConfidenceComponents\b/)
    expect(content).not.toMatch(/interface\s+DetectedConflict\b/)
    expect(content).not.toMatch(/interface\s+FormattedCitation\b/)
  })

  it('does not export any private helper name from an earlier milestone', () => {
    const content = readCode('src/reasoning/application/reasoningAnswerStage.ts')
    expect(content).not.toMatch(/export\s+function\s+toAppliedArticle/)
    expect(content).not.toMatch(/export\s+function\s+toAppliedDocument/)
    expect(content).not.toMatch(/export\s+function\s+roleFor/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.4.6, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts and legalReasoningEngine.ts still carry their own markers, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
    expect(readRaw('src/reasoning/application/legalReasoningEngine.ts')).toMatch(/Stages 1, 3-7/)
  })
})
