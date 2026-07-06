import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4.1 (Reasoning Engine Wiring — Batch A) ─────
// Per this milestone's rules: the orchestrator only coordinates two already-completed
// components (X.3.7's FinalKnowledgeResolutionPipeline, Batch A's LegalReasoningEngine) — zero
// business logic, zero ranking, zero retrieval, zero answer generation, zero citation
// formatting, zero conflict resolution, zero confidence scoring, no src/knowledge/ import, no
// MCP/provider/PromptBuilder/LLM/OutputValidator reference. Checks run against
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

const NEW_FILES = ['src/reasoning/application/reasoningOrchestrator.ts']

describe('Architecture guard — Phase X.4.1 dependency direction', () => {
  it('the orchestrator imports nothing from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    const content = readCode(NEW_FILES[0]!)
    expect(content).not.toMatch(/from ['"].*\/knowledge\//)
    expect(content).not.toMatch(/from ['"].*\/mcp\//)
    expect(content).not.toMatch(/from ['"].*\/ai\//)
    expect(content).not.toMatch(/from ['"].*\/conversation\//)
  })

  it('the orchestrator imports only finalKnowledgeResolutionPipeline.ts, legalReasoningEngine.ts, knowledgeRankingPipeline.ts (for the RankingPlanner type), and reasoning\'s own domain types — never X.3.1-X.3.6\'s internals directly, never a provider/platform implementation', () => {
    const content = readCode(NEW_FILES[0]!)
    expect(content).toMatch(/from ['"]\.\/finalKnowledgeResolutionPipeline\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/legalReasoningEngine\.ts['"]/)
    for (const forbidden of [
      "from './resolutionCoordinator.ts'", "from './resolutionExecutor.ts'",
      "from './intentResolutionPipeline.ts'", "from './knowledgeResolutionPlanner.ts'",
      "from './rankingStrategy.ts'", "from './candidateSelector.ts'", "from './rankingPlanner.ts'",
      "from './knowledgeReferenceMapper.ts'", "from '../infrastructure/knowledgePlatformRepository.ts'",
      'IKnowledgePlatform', "from './ruleMetadataParser.ts'", "from './thresholdMetadataParser.ts'",
      "from './effectivePeriodEvaluator.ts'",
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('references no MCP, Tool Calling, provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, LLM adapter, or Output Validation', () => {
    const content = readCode(NEW_FILES[0]!)
    expect(content).not.toMatch(/from ['"].*\/providers\//)
    expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
    expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
    expect(content).not.toMatch(/llmAdapter/i)
    expect(content).not.toMatch(/outputValidator/i)
  })

  it('performs zero ranking, retrieval, answer generation, citation formatting, conflict resolution, or confidence scoring', () => {
    const content = readCode(NEW_FILES[0]!)
    for (const forbidden of [
      'scoreitem', 'rankitems', 'selectcandidates', 'searchknowledge', 'resolveknowledge(',
      'composedecision', 'answercomposer', 'formatcitations', 'citationformatter',
      'detectandresolveconflicts', 'resolveconflict', 'computeconfidence',
    ]) {
      expect(content.toLowerCase(), `must not reference "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('ReasoningOrchestrator composes only via buildFinalKnowledgeResolutionPipeline() and buildLegalReasoningEngine() — no new construction of any earlier X.3 class', () => {
    const content = readCode(NEW_FILES[0]!)
    expect(content).toMatch(/buildFinalKnowledgeResolutionPipeline/)
    expect(content).toMatch(/buildLegalReasoningEngine/)
    expect(content).not.toMatch(/new\s+(IntentResolutionPipeline|KnowledgeRankingPipeline|KnowledgePlatformRepository|ResolutionCoordinator|LegalReasoningEngine)\b/)
  })

  it('answer() calls resolve() before reason(), in that order, textually', () => {
    const content = readCode(NEW_FILES[0]!)
    const resolveIndex = content.indexOf('.resolve(')
    const reasonIndex = content.indexOf('.reason(')
    expect(resolveIndex).toBeGreaterThan(-1)
    expect(reasonIndex).toBeGreaterThan(-1)
    expect(resolveIndex).toBeLessThan(reasonIndex)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.3.7, and everything before)', () => {
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
      ['src/reasoning/domain/resolutionOrchestrationTypes.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionCoordinator.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionExecutor.ts', /Phase X\.3\.5/],
      ['src/reasoning/domain/knowledgeEnrichmentTypes.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeEnrichmentPipeline.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('legalReasoningEngine.ts still carries its Stage marker and no longer imports detectIntent (pre-X.4 API cleanup, already frozen)', () => {
    const content = readRaw('src/reasoning/application/legalReasoningEngine.ts')
    expect(content).toMatch(/Stages 1, 3-7/)
    expect(content).not.toMatch(/import \{ detectIntent \}/)
  })
})
