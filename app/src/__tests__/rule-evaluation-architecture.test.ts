import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4.3 (Reasoning Rule Evaluation) ────────────
// Per this milestone's rules: deterministic rule execution only — zero conflict resolution,
// zero ranking of competing conclusions, zero explanation/citation/answer generation, zero
// confidence scoring, zero Tool Calling/MCP/LLM, zero Knowledge Resolution/Output Validation
// modification. No src/knowledge/, src/ai/, src/mcp/, or src/conversation/ import. Checks run
// against comment-stripped code.

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
  'src/reasoning/domain/ruleEvaluationTypes.ts',
  'src/reasoning/application/ruleEvaluationStage.ts',
]

describe('Architecture guard — Phase X.4.3 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('ruleEvaluationStage.ts imports only ruleEngine.ts, effectivePeriodEvaluator.ts, knowledgeApplicabilityEvaluator.ts, rankingStrategy.ts, and reasoning\'s own domain types — never a repository, platform, orchestrator, or engine class', () => {
    const content = readCode('src/reasoning/application/ruleEvaluationStage.ts')
    expect(content).toMatch(/from ['"]\.\/ruleEngine\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/effectivePeriodEvaluator\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/knowledgeApplicabilityEvaluator\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/rankingStrategy\.ts['"]/)
    for (const forbidden of [
      "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
      "from './reasoningOrchestrator.ts'", "from './legalReasoningEngine.ts'",
      "from '../infrastructure/knowledgePlatformRepository.ts'", 'IKnowledgePlatform',
      'IKnowledgeRepository',
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

  it('performs zero conflict resolution, ranking of competing conclusions, confidence scoring, or citation/explanation/answer generation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'detectandresolveconflicts', 'resolveconflict', 'computeconfidence', 'composedecision',
        'answercomposer', 'formatcitations', 'citationformatter', 'buildexplanation',
        'rankitems', 'selectcandidates', 'scoreitem(', 'searchknowledge', 'resolveknowledge(',
        'detectintent',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('has no branching dispatch on domain/type (no switch statement deciding which sub-evaluator to call) — a fixed, unconditional sequence of map/filter calls over each bucket', () => {
    const content = readCode('src/reasoning/application/ruleEvaluationStage.ts')
    expect(content).not.toMatch(/\bswitch\s*\(/)
    // deepFreeze()'s own null/frozen guard is a generic recursion base case, not orchestration
    // dispatch — every `if` in the file must be confined to that one helper.
    const ifCount = (content.match(/\bif\s*\(/g) ?? []).length
    expect(ifCount).toBeLessThanOrEqual(1)
  })

  it('evaluateRules deep-freezes its result', () => {
    const content = readCode('src/reasoning/application/ruleEvaluationStage.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('ruleEvaluationTypes.ts introduces no new duplicate of EffectivePeriodStatus/ApplicabilityStatus/LegalRuleResult/LegalThresholdResult — reuses them', () => {
    const content = readCode('src/reasoning/domain/ruleEvaluationTypes.ts')
    expect(content).toMatch(/from ['"]\.\/knowledgeEnrichmentTypes\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/reasoningTypes\.ts['"]/)
    expect(content).not.toMatch(/type\s+EffectivePeriodStatus\s*=/)
    expect(content).not.toMatch(/interface\s+LegalRuleResult\b/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.4.2, and everything before)', () => {
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
