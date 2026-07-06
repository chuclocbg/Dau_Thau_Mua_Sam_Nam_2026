import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.7 (final composition) ────────────────────
// Per this milestone's rules: compose ONLY the existing public surface of X.3.5/X.3.6 - no
// repository/retrieval/ranking/enrichment/orchestration logic changes, no src/knowledge/
// import, no provider/MCP/PromptBuilder/LLM/validation/citation/conflict-resolution/answer-
// generation reference, no network/database access. Checks run against comment-stripped code.

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
  'src/reasoning/application/finalKnowledgeResolutionPipeline.ts',
]

describe('Architecture guard — Phase X.3.7 dependency direction', () => {
  it('no final-pipeline file imports anything from src/knowledge/', () => {
    for (const file of NEW_FILES) {
      expect(readCode(file), `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
    }
  })

  it('finalKnowledgeResolutionPipeline.ts imports only knowledgeResolutionPipeline.ts (X.3.5) and knowledgeEnrichmentPipeline.ts (X.3.6) as its cross-milestone dependencies — never resolutionCoordinator.ts/resolutionExecutor.ts/intentResolutionPipeline.ts/knowledgeRankingPipeline.ts directly, never IKnowledgePlatform', () => {
    const content = readCode('src/reasoning/application/finalKnowledgeResolutionPipeline.ts')
    expect(content).toMatch(/from ['"]\.\/knowledgeResolutionPipeline\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/knowledgeEnrichmentPipeline\.ts['"]/)
    for (const forbidden of ['resolutionCoordinator', 'resolutionExecutor', 'intentResolutionPipeline', 'IKnowledgePlatform']) {
      expect(content, `must not directly reference ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('no final-pipeline file references MCP, a provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, an LLM adapter, or Output Validation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a provider implementation`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content, `${file} must not reference an LLM adapter`).not.toMatch(/llmAdapter/i)
      expect(content, `${file} must not reference Output Validation`).not.toMatch(/outputValidator/i)
    }
  })

  it('no final-pipeline file performs citation generation, conflict resolution, evidence formatting, answer composition, ranking/enrichment logic, or validation, network, or database access', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of [
        'citation', 'answerComposer', 'composeDecision', 'validat', 'detectAndResolveConflicts',
        'scoreItem', 'rankItems', 'selectCandidates', 'evaluateEffectivePeriod', 'parseRuleMetadata',
        'parseThresholdMetadata', 'prisma', 'fetch(',
      ]) {
        expect(content.toLowerCase(), `${file} must not reference "${forbidden}"`).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('FinalKnowledgeResolutionPipeline composes only via buildKnowledgeResolutionPipeline() and enrichKnowledge() — no new construction of IntentResolutionPipeline/KnowledgeRankingPipeline/KnowledgePlatformRepository', () => {
    const content = readCode('src/reasoning/application/finalKnowledgeResolutionPipeline.ts')
    expect(content).toMatch(/buildKnowledgeResolutionPipeline/)
    expect(content).toMatch(/enrichKnowledge/)
    expect(content).not.toMatch(/new\s+IntentResolutionPipeline/)
    expect(content).not.toMatch(/new\s+KnowledgeRankingPipeline/)
    expect(content).not.toMatch(/new\s+KnowledgePlatformRepository/)
  })
})

describe('Architecture guard — frozen modules untouched (X.3.1 through X.3.6, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/reasoning/application/legalReasoningEngine.ts', /Stages 1, 3-7/],
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
      ['src/reasoning/application/knowledgeResolutionPipeline.ts', /Phase X\.3\.5/],
      ['src/reasoning/domain/knowledgeEnrichmentTypes.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeEnrichmentPipeline.ts', /Phase X\.3\.6/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
