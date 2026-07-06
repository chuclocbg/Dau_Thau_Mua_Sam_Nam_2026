import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.4 (deterministic ranking) ────────────────
// Per this milestone's architecture rules: ranking consumes ONLY the output of X.3.3 (the
// ResolvedKnowledge value/type), never the X.3.3 orchestration module or the X.3.2 retrieval
// module directly. No repository access, no database logic, no provider logic, no network,
// no MCP, no Anthropic/OpenAI, no PromptBuilder. Checks run against comment-stripped code.

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
  'src/reasoning/domain/knowledgeRankingTypes.ts',
  'src/reasoning/application/rankingStrategy.ts',
  'src/reasoning/application/candidateSelector.ts',
  'src/reasoning/application/rankingPlanner.ts',
  'src/reasoning/application/knowledgeRankingPipeline.ts',
]

const RETRIEVAL_AND_ORCHESTRATION_MODULES = [
  'knowledgeRepositoryTypes', 'knowledgePlatformRepository',
  'knowledgeResolutionPlanner', 'resolveKnowledgeWarnings', 'intentResolutionPipeline',
  'IKnowledgeRepository', 'IKnowledgePlatform',
]

describe('Architecture guard — Phase X.3.4 dependency direction', () => {
  it('no ranking file imports anything from src/knowledge/', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      if (/from ['"].*\/knowledge\//.test(readCode(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  it('no ranking file imports the X.3.2 retrieval layer or the X.3.3 orchestration layer — ranking consumes only the ResolvedKnowledge output value', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of RETRIEVAL_AND_ORCHESTRATION_MODULES) {
        expect(content, `${file} must not reference ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('no ranking file references MCP, Tool Calling, a provider implementation, Anthropic/OpenAI, or PromptBuilder/PromptRenderer', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a provider implementation`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
    }
  })

  it('no ranking file performs citation generation, conflict resolution, evidence formatting, answer composition, or LLM/validation logic', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of ['citation', 'answerComposer', 'composeDecision', 'validat', 'llmAdapter', 'detectAndResolveConflicts']) {
        expect(content.toLowerCase(), `${file} must not reference "${forbidden}"`).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('KnowledgeRankingPipeline depends only on rankingPlanner.ts and candidateSelector.ts (plus reasoning\'s own domain types)', () => {
    const content = readCode('src/reasoning/application/knowledgeRankingPipeline.ts')
    expect(content).toMatch(/from ['"]\.\/rankingPlanner\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\/candidateSelector\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/reasoningTypes\.ts['"]/)
  })
})

describe('Architecture guard — frozen modules untouched (Conversation Core, Reasoning Core, AI Context/Prompt/LLM Adapter, Output Validation, X.3.1, X.3.2, X.3.3)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
