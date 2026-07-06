import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.3 (intent-driven orchestration) ──────────
// Per this milestone's architecture rules: no cyclic dependencies, orchestration depends
// only on approved repository interfaces, no direct provider access, no database logic, no
// platform-specific logic, no network, no provider SDK, no Anthropic/OpenAI code. Checks run
// against comment-stripped code (this file's own header comments, and the new modules' own
// header comments, legitimately discuss forbidden concepts in prose without importing them).

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
  'src/reasoning/domain/knowledgeResolutionTypes.ts',
  'src/reasoning/application/knowledgeResolutionPlanner.ts',
  'src/reasoning/application/resolveKnowledgeWarnings.ts',
  'src/reasoning/application/intentResolutionPipeline.ts',
]

describe('Architecture guard — Phase X.3.3 dependency direction', () => {
  it('no new orchestration file imports anything from src/knowledge/', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      if (/from ['"].*\/knowledge\//.test(readCode(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  it('IntentResolutionPipeline depends only on the IKnowledgeRepository interface — never on knowledgePlatformRepository.ts (the concrete adapter)', () => {
    const content = readCode('src/reasoning/application/intentResolutionPipeline.ts')
    expect(content).toMatch(/from ['"]\.\.\/domain\/knowledgeRepositoryTypes\.ts['"]/)
    expect(content).not.toContain('knowledgePlatformRepository')
    expect(content).not.toContain('IKnowledgePlatform')
  })

  it('the planner and warnings modules import only reasoning\'s own domain types — no repository or platform dependency at all', () => {
    const plannerContent = readCode('src/reasoning/application/knowledgeResolutionPlanner.ts')
    expect(plannerContent).not.toMatch(/knowledgeRepositoryTypes|knowledgePlatformRepository|IKnowledgePlatform/)

    const warningsContent = readCode('src/reasoning/application/resolveKnowledgeWarnings.ts')
    expect(warningsContent).not.toMatch(/knowledgeRepositoryTypes|knowledgePlatformRepository|IKnowledgePlatform|reasoningTypes/)
  })

  it('no orchestration file references MCP, Tool Calling, a Coordinator/Multi-Agent concept, a provider implementation, Anthropic/OpenAI, or PromptBuilder/PromptRenderer', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a provider implementation`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content, `${file} must not reference a Coordinator/Multi-Agent concept`).not.toMatch(/Coordinator|MultiAgent/)
    }
  })

  it('no orchestration file performs ranking, scoring, confidence computation, evidence ordering, citation formatting, conflict resolution, or answer generation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of ['rank', 'score(', 'confidence', 'citation', 'conflict', 'composeDecision', 'answerComposer']) {
        expect(content.toLowerCase(), `${file} must not reference "${forbidden}"`).not.toContain(forbidden.toLowerCase())
      }
    }
  })
})

describe('Architecture guard — frozen modules untouched (Conversation Core, Reasoning Core, AI Context/Prompt/LLM Adapter, Output Validation, X.3.1, X.3.2)', () => {
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
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
