import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4.4 (Reasoning Conflict Resolution) ───────
// Per this milestone's rules: deterministic conflict resolution only — zero confidence
// scoring, zero citation/explanation/answer generation, zero Tool Calling/MCP/LLM, zero
// repository/KnowledgePlatform access. No src/knowledge/, src/ai/, src/mcp/, or
// src/conversation/ import. Checks run against comment-stripped code.

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
  'src/reasoning/domain/conflictResolutionTypes.ts',
  'src/reasoning/application/conflictResolutionStage.ts',
]

describe('Architecture guard — Phase X.4.4 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('conflictResolutionStage.ts imports only rankingStrategy.ts and reasoning\'s own domain types — never a repository, platform, orchestrator, engine, or ruleEngine.ts directly', () => {
    const content = readCode('src/reasoning/application/conflictResolutionStage.ts')
    expect(content).toMatch(/from ['"]\.\/rankingStrategy\.ts['"]/)
    for (const forbidden of [
      "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
      "from './reasoningOrchestrator.ts'", "from './legalReasoningEngine.ts'", "from './ruleEngine.ts'",
      "from './ruleEvaluationStage.ts'", "from '../infrastructure/knowledgePlatformRepository.ts'",
      'IKnowledgePlatform', 'IKnowledgeRepository',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('references no MCP, Tool Calling, provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, LLM adapter, or Output Validation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/from ['"].*\/providers\//)
      expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content).not.toMatch(/llmAdapter/i)
      expect(content).not.toMatch(/outputValidator/i)
    }
  })

  it('performs zero confidence scoring, citation/explanation/answer generation, or rule/threshold execution', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'computeconfidence', 'composedecision', 'answercomposer', 'formatcitations',
        'citationformatter', 'buildexplanation', 'evaluaterule(', 'evaluatethreshold(',
        'detectexceptions', 'searchknowledge', 'resolveknowledge(', 'detectintent',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('conflict resolution is a fixed, unconditional tier cascade — no domain/type switch dispatch', () => {
    const content = readCode('src/reasoning/application/conflictResolutionStage.ts')
    expect(content).not.toMatch(/\bswitch\s*\(/)
  })

  it('resolveConflicts deep-freezes its result', () => {
    const content = readCode('src/reasoning/application/conflictResolutionStage.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('conflictResolutionTypes.ts reuses DetectedConflict rather than duplicating it', () => {
    const content = readCode('src/reasoning/domain/conflictResolutionTypes.ts')
    expect(content).toMatch(/from ['"]\.\/reasoningTypes\.ts['"]/)
    expect(content).not.toMatch(/interface\s+DetectedConflict\b/)
    expect(content).not.toMatch(/interface\s+ConflictingItem\b/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.4.3, and everything before)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('ruleEngine.ts and legalReasoningEngine.ts still carry their own markers, unmodified', () => {
    expect(readRaw('src/reasoning/application/ruleEngine.ts')).toMatch(/Stage 4 — Rule Engine/)
    expect(readRaw('src/reasoning/application/legalReasoningEngine.ts')).toMatch(/Stages 1, 3-7/)
  })
})
