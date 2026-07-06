import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.6 (deterministic knowledge enrichment) ───
// Per this milestone's rules: enrichment is pure metadata parsing/classification, never
// ranking, retrieval, orchestration, conflict resolution, citation generation, answer
// generation, or provider/platform/network/database logic. Checks run against comment-stripped
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
  'src/reasoning/domain/knowledgeEnrichmentTypes.ts',
  'src/reasoning/application/resolutionMetadataNormalizer.ts',
  'src/reasoning/application/effectivePeriodEvaluator.ts',
  'src/reasoning/application/ruleMetadataParser.ts',
  'src/reasoning/application/thresholdMetadataParser.ts',
  'src/reasoning/application/knowledgeApplicabilityEvaluator.ts',
  'src/reasoning/application/resolutionDiagnostics.ts',
  'src/reasoning/application/knowledgeEnrichmentPipeline.ts',
]

const PRIOR_ORCHESTRATION_MODULES = [
  'knowledgeRepositoryTypes', 'knowledgePlatformRepository',
  'knowledgeResolutionPlanner', 'resolveKnowledgeWarnings', 'intentResolutionPipeline',
  'rankingStrategy', 'candidateSelector', 'rankingPlanner', 'knowledgeRankingPipeline',
  'resolutionExecutor', 'resolutionCoordinator', 'knowledgeResolutionPipeline',
  'IKnowledgeRepository', 'IKnowledgePlatform',
]

describe('Architecture guard — Phase X.3.6 dependency direction', () => {
  it('no enrichment file imports anything from src/knowledge/', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      if (/from ['"].*\/knowledge\//.test(readCode(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  it('no enrichment file imports the X.3.2/X.3.3/X.3.4/X.3.5 modules — enrichment consumes only the ResolvedKnowledge output value', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of PRIOR_ORCHESTRATION_MODULES) {
        expect(content, `${file} must not reference ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('no enrichment file references MCP, Tool Calling, a provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, or an LLM adapter', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a provider implementation`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content, `${file} must not reference an LLM adapter`).not.toMatch(/llmAdapter/i)
    }
  })

  it('no enrichment file performs citation generation, conflict resolution, evidence formatting/collection, answer composition, or validation logic', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of ['citation', 'answerComposer', 'composeDecision', 'validat', 'evidenceCollector', 'detectAndResolveConflicts']) {
        expect(content.toLowerCase(), `${file} must not reference "${forbidden}"`).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('no enrichment file performs network or database access', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not perform network access`).not.toMatch(/\bfetch\(|http:\/\/|https:\/\/|node:https?/)
      expect(content, `${file} must not reference Prisma or a database client`).not.toMatch(/prisma|PrismaClient/i)
    }
  })

  it('knowledgeEnrichmentPipeline.ts depends only on this milestone\'s own files (plus reasoning\'s frozen domain types)', () => {
    const content = readCode('src/reasoning/application/knowledgeEnrichmentPipeline.ts')
    expect(content).toMatch(/from ['"]\.\/effectivePeriodEvaluator\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/ruleMetadataParser\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/thresholdMetadataParser\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/knowledgeApplicabilityEvaluator\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/resolutionDiagnostics\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/reasoningTypes\.ts['"]/)
  })
})

describe('Architecture guard — frozen modules untouched (X.3.1 through X.3.5, and everything before)', () => {
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
      ['src/reasoning/application/knowledgeResolutionPipeline.ts', /Phase X\.3\.5/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
