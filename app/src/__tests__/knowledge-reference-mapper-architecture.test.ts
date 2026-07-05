import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.3.1 (pure mapping) ──────────────────────────
// Per this milestone's explicit rules: no imports from Knowledge Platform, no MCP, no Tool
// Calling, no Planner, no Multi-Agent, no external providers, no repository queries. Checks
// run against comment-stripped code, per the lesson learned in the Batch B/X.4 guards
// (explanatory comments legitimately discuss forbidden concepts in prose without importing
// them — e.g. this milestone's own header comments mention "src/knowledge/" descriptively).

const REPO_ROOT = process.cwd()

function readCode(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const NEW_FILES = [
  'src/reasoning/domain/knowledgeReferenceTypes.ts',
  'src/reasoning/application/knowledgeReferenceMapper.ts',
]

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"].*\/knowledge\//,      // Knowledge Platform
  /from ['"].*\/mcp\//,            // MCP
  /from ['"].*\/financial\//,      // src/shared/financial/ (the real LegalBasis source)
  /from ['"].*\/conversation\//,   // Conversation Core internals
  /from ['"].*\/providers\//,      // external/provider implementations
]

const FORBIDDEN_IDENTIFIERS = [
  'IKnowledgePlatform', 'KnowledgeContext', 'KnowledgeItem\\b', 'searchKnowledge',
  'resolveLegalBasis', 'resolveContext', 'DefaultKnowledgePlatform',
]

describe('Architecture guard — Phase X.3.1 pure mapping isolation', () => {
  it('imports nothing from Knowledge Platform, MCP, financial, conversation, or providers', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) violations.push(`${file} matches ${pattern}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('references no IKnowledgePlatform method or type — pure mapping, zero repository queries', () => {
    const violations: string[] = []
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const identifier of FORBIDDEN_IDENTIFIERS) {
        if (new RegExp(identifier).test(content)) violations.push(`${file} references ${identifier}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('knowledgeReferenceMapper.ts imports only knowledgeReferenceTypes.ts and reasoningTypes.ts (both within src/reasoning/)', () => {
    const content = readCode('src/reasoning/application/knowledgeReferenceMapper.ts')
    expect(content).toMatch(/from ['"]\.\.\/domain\/knowledgeReferenceTypes\.ts['"]/)
    expect(content).toMatch(/from ['"]\.\.\/domain\/reasoningTypes\.ts['"]/)
    // No import of the orchestrator or any other Batch A stage — pure mapping only.
    for (const forbidden of ['legalReasoningEngine', 'ruleEngine', 'evidenceCollector', 'citationFormatter', 'answerComposer', 'intentDetector']) {
      expect(content).not.toContain(forbidden)
    }
  })
})

describe('Architecture guard — frozen modules untouched', () => {
  it('Conversation Core, Reasoning Core, AI Context/Prompt/LLM Adapter, and Output Validation still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/reasoning/application/legalReasoningEngine.ts', /Stages 1, 3-7/],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
    ]
    for (const [file, marker] of markers) {
      expect(readFileSync(join(REPO_ROOT, file), 'utf-8'), `${file} marker changed`).toMatch(marker)
    }
  })
})
