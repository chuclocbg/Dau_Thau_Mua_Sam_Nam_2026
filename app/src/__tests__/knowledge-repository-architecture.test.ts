import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.2 (retrieval & repository wiring) ────────
// Per this milestone's repository constraints: repository access only through the approved
// interfaces, no direct database access, no provider-specific logic, no network, no MCP, no
// external APIs, no Anthropic/OpenAI code, no PromptBuilder usage. Checks run against
// comment-stripped code (this file's own header comments legitimately discuss "src/knowledge/"
// and "Anthropic" descriptively without importing them).

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

const REPOSITORY_INTERFACE = 'src/reasoning/domain/knowledgeRepositoryTypes.ts'
const REPOSITORY_ADAPTER = 'src/reasoning/infrastructure/knowledgePlatformRepository.ts'

describe('Architecture guard — Phase X.3.2 repository layer', () => {
  it('knowledgeRepositoryTypes.ts (the interface) imports nothing from src/knowledge/', () => {
    const content = readCode(REPOSITORY_INTERFACE)
    expect(content).not.toMatch(/from ['"].*\/knowledge\//)
  })

  it('knowledgePlatformRepository.ts is the only new file importing IKnowledgePlatform/knowledgeTypes', () => {
    const adapterContent = readCode(REPOSITORY_ADAPTER)
    expect(adapterContent).toMatch(/from ['"]\.\.\/\.\.\/knowledge\/platform\/knowledgePlatform\.ts['"]/)
    expect(adapterContent).toMatch(/from ['"]\.\.\/\.\.\/knowledge\/platform\/knowledgeTypes\.ts['"]/)

    const interfaceContent = readCode(REPOSITORY_INTERFACE)
    expect(interfaceContent).not.toMatch(/from ['"].*\/knowledge\//)
  })

  it('neither file references MCP, Tool Calling, Planner, or Multi-Agent concepts', () => {
    for (const file of [REPOSITORY_INTERFACE, REPOSITORY_ADAPTER]) {
      const content = readCode(file)
      expect(content, `${file} must not reference MCP`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not reference a Planner/Coordinator`).not.toMatch(/Planner|Coordinator|MultiAgent/)
    }
  })

  it('neither file references a provider implementation, Anthropic/OpenAI, or PromptBuilder', () => {
    for (const file of [REPOSITORY_INTERFACE, REPOSITORY_ADAPTER]) {
      const content = readCode(file)
      expect(content, `${file} must not reference src/providers/`).not.toMatch(/from ['"].*\/providers\//)
      expect(content, `${file} must not reference Anthropic/Claude/OpenAI`).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content, `${file} must not reference PromptBuilder/PromptRenderer`).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/)
    }
  })

  it('neither file performs ranking, scoring, conflict resolution, citation, or evidence-selection logic', () => {
    for (const file of [REPOSITORY_INTERFACE, REPOSITORY_ADAPTER]) {
      const content = readCode(file)
      for (const forbidden of ['rank', 'score', 'conflict', 'citation', 'evidence', 'Ranker']) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toMatch(new RegExp(forbidden, 'i'))
      }
    }
  })

  it('knowledgePlatformRepository.ts imports the mapper from X.3.1 (application layer) and reasoning\'s own domain types only', () => {
    const content = readCode(REPOSITORY_ADAPTER)
    expect(content).toMatch(/from ['"]\.\.\/application\/knowledgeReferenceMapper\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/knowledgeReferenceTypes\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/knowledgeRepositoryTypes\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/reasoningTypes\.ts['"]/)
    for (const forbidden of ['legalReasoningEngine', 'ruleEngine', 'evidenceCollector', 'citationFormatter', 'answerComposer', 'intentDetector']) {
      expect(content).not.toContain(forbidden)
    }
  })
})

describe('Architecture guard — frozen modules untouched (extends Phase X.3.1\'s guard)', () => {
  it('Conversation Core, Reasoning Pipeline Core, AI Context/Prompt/LLM Adapter, and Output Validation still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/reasoning/application/legalReasoningEngine.ts', /Stages 1, 3-7/],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/reasoning/application/knowledgeReferenceMapper.ts', /Repository mapping layer/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })
})
