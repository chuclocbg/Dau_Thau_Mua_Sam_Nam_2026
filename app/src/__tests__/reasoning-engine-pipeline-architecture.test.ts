import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for the final Phase X.4 Integration milestone ─────────
// Per this milestone's rules: integrate only — zero new reasoning capability, zero redesign,
// zero architecture change, zero Tool Calling/MCP/Multi-Agent/Output Formatting. No
// src/knowledge/, src/ai/, src/mcp/, or src/conversation/ import beyond what X.3.7 itself
// already permits. Checks run against comment-stripped code.

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

const NEW_FILE = 'src/reasoning/application/reasoningEnginePipeline.ts'

describe('Architecture guard — dependency graph (integration milestone)', () => {
  it('imports nothing from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    const content = readCode(NEW_FILE)
    expect(content).not.toMatch(/from ['"].*\/knowledge\//)
    expect(content).not.toMatch(/from ['"].*\/mcp\//)
    expect(content).not.toMatch(/from ['"].*\/ai\//)
    expect(content).not.toMatch(/from ['"].*\/conversation\//)
  })

  it('imports exactly the seven X.4/X.3.7 stage modules named in this milestone\'s flow, and nothing else from src/reasoning/application/', () => {
    const content = readCode(NEW_FILE)
    const required = [
      "from './finalKnowledgeResolutionPipeline.ts'",
      "from './reasoningContextAssembler.ts'",
      "from './ruleEvaluationStage.ts'",
      "from './conflictResolutionStage.ts'",
      "from './confidenceEvaluationStage.ts'",
      "from './citationGenerationStage.ts'",
      "from './reasoningAnswerStage.ts'",
    ]
    for (const spec of required) expect(content, `must import ${spec}`).toContain(spec)

    const forbidden = [
      "from './reasoningOrchestrator.ts'", "from './legalReasoningEngine.ts'", "from './ruleEngine.ts'",
      "from './answerComposer.ts'", "from './citationFormatter.ts'",
      "from '../infrastructure/knowledgePlatformRepository.ts'", 'IKnowledgePlatform',
    ]
    for (const spec of forbidden) expect(content, `must not import ${spec}`).not.toContain(spec)
  })

  it('never constructs any earlier stage\'s internals directly (new IntentResolutionPipeline/KnowledgeRankingPipeline/KnowledgePlatformRepository/ResolutionCoordinator/LegalReasoningEngine)', () => {
    const content = readCode(NEW_FILE)
    expect(content).not.toMatch(/new\s+(IntentResolutionPipeline|KnowledgeRankingPipeline|KnowledgePlatformRepository|ResolutionCoordinator|LegalReasoningEngine)\b/)
  })

  it('composes only via each stage\'s existing public factory/function — build*() for FinalKnowledgeResolutionPipeline, direct calls for the five pure stage functions', () => {
    const content = readCode(NEW_FILE)
    expect(content).toMatch(/buildFinalKnowledgeResolutionPipeline/)
    expect(content).toMatch(/assembleReasoningContext/)
    expect(content).toMatch(/evaluateRules/)
    expect(content).toMatch(/resolveConflicts/)
    expect(content).toMatch(/evaluateConfidence/)
    expect(content).toMatch(/generateCitations/)
    expect(content).toMatch(/composeAnswer/)
  })

  it('references no MCP, Tool Calling, Multi-Agent, Output Formatting, PromptBuilder, LLM adapter, provider implementation, or Anthropic/OpenAI', () => {
    const content = readCode(NEW_FILE)
    expect(content).not.toMatch(/from ['"].*\/providers\//)
    expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
    expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
    expect(content).not.toMatch(/llmAdapter/i)
    expect(content).not.toMatch(/outputValidator|outputFormat(ter|ting)/i)
    expect(content).not.toMatch(/multiAgent|toolCalling|mcpGateway/i)
  })

  it('introduces zero new reasoning logic — no scoring, conflict-resolution, rule-execution, or citation-formatting keywords', () => {
    const content = readCode(NEW_FILE).toLowerCase()
    for (const forbidden of [
      'computeconfidence', 'resolvepair', 'evaluatethreshold(', 'formatcitations', 'composedecision',
      'detectexceptions', 'searchknowledge', 'resolveknowledge(', 'detectintent',
    ]) {
      expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('the seven pipeline steps appear in the required order (Knowledge Resolution -> Context -> Rules -> Conflicts -> Confidence -> Citations -> Answer)', () => {
    const content = readCode(NEW_FILE)
    const positions = [
      'resolutionPipeline.resolve(',
      'assembleReasoningContext(',
      'evaluateRules(',
      'resolveConflicts(',
      'evaluateConfidence(',
      'generateCitations(',
      'composeAnswer(',
    ].map(marker => content.indexOf(marker))

    for (const position of positions) expect(position).toBeGreaterThan(-1)
    for (let i = 1; i < positions.length; i++) expect(positions[i]!).toBeGreaterThan(positions[i - 1]!)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.4.7, and everything before)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('legalReasoningEngine.ts, ruleEngine.ts, answerComposer.ts, and citationFormatter.ts (Batch A) still carry their own markers, unmodified', () => {
    expect(readRaw('src/reasoning/application/legalReasoningEngine.ts')).toMatch(/Stages 1, 3-7/)
    expect(readRaw('src/reasoning/application/ruleEngine.ts')).toMatch(/Stage 4 — Rule Engine/)
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
    expect(readRaw('src/reasoning/application/citationFormatter.ts')).toMatch(/Stage 6 — Citation Formatter/)
  })
})
