import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.5 (orchestration wiring) ─────────────────
// Per this milestone's rules: the composition layer only calls existing public interfaces of
// X.3.3 (IntentResolutionPipeline) and X.3.4 (KnowledgeRankingPipeline) — no repository
// implementation changes, no ranking/retrieval/orchestration logic changes, no direct
// src/knowledge/ import, no provider/MCP/PromptBuilder/LLM/validation reference. Checks run
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
  'src/reasoning/domain/resolutionOrchestrationTypes.ts',
  'src/reasoning/application/resolutionExecutor.ts',
  'src/reasoning/application/resolutionCoordinator.ts',
  'src/reasoning/application/knowledgeResolutionPipeline.ts',
]

describe('Architecture guard — Phase X.3.5 dependency direction', () => {
  it('no orchestration-wiring file imports anything from src/knowledge/', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      if (/from ['"].*\/knowledge\//.test(readCode(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  it('no orchestration-wiring file references MCP, a provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, or an LLM adapter', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a provider implementation`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content, `${file} must not reference an LLM adapter`).not.toMatch(/llmAdapter/i)
    }
  })

  it('no orchestration-wiring file performs citation generation, conflict resolution, evidence formatting, answer composition, ranking scoring, or validation logic', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of ['citation', 'answerComposer', 'composeDecision', 'validat', 'detectAndResolveConflicts', 'scoreItem', 'rankItems', 'selectCandidates']) {
        expect(content.toLowerCase(), `${file} must not reference "${forbidden}"`).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('KnowledgeResolutionPipeline composes only via the existing build*() factories of X.3.2/X.3.3/X.3.4, never new concrete logic', () => {
    const content = readCode('src/reasoning/application/knowledgeResolutionPipeline.ts')
    expect(content).toMatch(/buildIntentResolutionPipeline/)
    expect(content).toMatch(/buildKnowledgeRankingPipeline/)
    expect(content).not.toMatch(/new\s+KnowledgePlatformRepository/)
  })

  it('ResolutionCoordinator sequences exactly two stages — no third stage, no branching keyword', () => {
    const content = readCode('src/reasoning/application/resolutionCoordinator.ts')
    expect(content).not.toMatch(/\bif\s*\(/)
    expect(content).not.toMatch(/\bswitch\s*\(/)
  })
})

describe('Architecture guard — frozen modules untouched (X.3.1 through X.3.4, and everything before)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
