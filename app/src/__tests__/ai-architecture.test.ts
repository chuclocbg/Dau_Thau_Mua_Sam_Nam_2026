import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.2 Batch B ──────────────────────────────────
// Per the Batch B architecture gate review's mandatory test requirements:
// dependency direction, no cyclic imports, no provider leakage, AIContext
// immutability (see ai-context-builder.test.ts for the runtime mutation-attempt
// tests), PromptBuilder has no access to business-rule types, ModelSelector stays
// provider-independent, ClaudeLLMAdapter is the sole Anthropic boundary.
//
// Scoped to the new src/ai/{domain,application,infrastructure}/ subdirectories
// this milestone created — not the 32 pre-existing, unrelated flat files already
// under src/ai/ (an "8-G" legacy chat-agent track), which this milestone does not
// own (Finding D of the architecture gate review).

const AI_ROOT = join(process.cwd(), 'src', 'ai')

function readSrc(relativePath: string): string {
  return readFileSync(join(AI_ROOT, relativePath), 'utf-8')
}

// Strips comments before running any "must not reference X" check — this repo's
// files carry explanatory header comments that legitimately *discuss* forbidden
// concepts prose-wise (e.g. "not an Anthropic-specific concept", "cannot import
// src/reasoning/ at all") without actually importing or leaking them. Checking
// raw file text (including comments) against those same words produces false
// positives; these guards must inspect real code only.
function readCode(relativePath: string): string {
  return readSrc(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...listTsFiles(fullPath))
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

const PIPELINE_ORDER = [
  'application/aiContextBuilder.ts',
  'application/promptBuilder.ts',
  'application/promptRenderer.ts',
  'infrastructure/modelCapabilityRegistry.ts',
  'infrastructure/modelSelector.ts',
  'infrastructure/adapters/claudeLLMAdapter.ts',
] as const

describe('Architecture guard — Phase X.2 Batch B dependency direction', () => {
  it('AIContextBuilder imports Reasoning + Conversation domain types, never a downstream Batch B stage', () => {
    const content = readCode('application/aiContextBuilder.ts')
    expect(content).toMatch(/from ['"].*reasoning\/domain\/reasoningTypes\.ts['"]/)
    expect(content).toMatch(/from ['"].*conversation\/domain\/conversationTypes\.ts['"]/)
    for (const downstream of ['promptBuilder', 'promptRenderer', 'modelSelector', 'modelCapabilityRegistry', 'claudeLLMAdapter']) {
      expect(content).not.toContain(downstream)
    }
  })

  it('PromptBuilder imports only aiTypes — never Reasoning, Conversation, or any downstream stage', () => {
    const content = readCode('application/promptBuilder.ts')
    expect(content).toMatch(/from ['"]\.\.\/domain\/aiTypes\.ts['"]/)
    for (const forbidden of ['reasoning/', 'conversation/', 'modelSelector', 'modelCapabilityRegistry', 'claudeLLMAdapter', 'aiContextBuilder']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('PromptRenderer imports only aiTypes — never Reasoning, Conversation, PromptBuilder, or any downstream stage', () => {
    const content = readCode('application/promptRenderer.ts')
    expect(content).toMatch(/from ['"]\.\.\/domain\/aiTypes\.ts['"]/)
    for (const forbidden of ['reasoning/', 'conversation/', 'modelSelector', 'modelCapabilityRegistry', 'claudeLLMAdapter', 'aiContextBuilder', 'promptBuilder']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('ModelCapabilityRegistry is pure data — imports nothing from reasoning/conversation/application', () => {
    const content = readCode('infrastructure/modelCapabilityRegistry.ts')
    for (const forbidden of ['reasoning/', 'conversation/', 'aiContextBuilder', 'promptBuilder', 'promptRenderer', 'claudeLLMAdapter']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('ModelSelector imports only ModelCapabilityRegistry — never Reasoning, Conversation, Prompt*, or the adapter', () => {
    const content = readCode('infrastructure/modelSelector.ts')
    expect(content).toMatch(/from ['"]\.\/modelCapabilityRegistry\.ts['"]/)
    for (const forbidden of ['reasoning/', 'conversation/', 'aiContextBuilder', 'promptBuilder', 'promptRenderer', 'claudeLLMAdapter']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('ClaudeLLMAdapter imports aiTypes + ClaudeProvider only — never Reasoning, Conversation, or the selection/prompt stages', () => {
    const content = readCode('infrastructure/adapters/claudeLLMAdapter.ts')
    expect(content).toMatch(/from ['"].*providers\/ClaudeProvider\.ts['"]/)
    for (const forbidden of ['reasoning/', 'conversation/', 'promptBuilder', 'promptRenderer', 'modelSelector', 'modelCapabilityRegistry', 'aiContextBuilder']) {
      expect(content).not.toContain(forbidden)
    }
  })
})

describe('Architecture guard — no cyclic imports across the Batch B pipeline', () => {
  it('no earlier pipeline stage imports a later one, and no later stage imports an earlier one by name', () => {
    for (let i = 0; i < PIPELINE_ORDER.length; i++) {
      const content = readCode(PIPELINE_ORDER[i]!)
      for (let j = i + 1; j < PIPELINE_ORDER.length; j++) {
        const laterModuleName = PIPELINE_ORDER[j]!.split('/').pop()!.replace('.ts', '')
        expect(content, `${PIPELINE_ORDER[i]} must not import ${laterModuleName}`).not.toContain(laterModuleName)
      }
    }
  })
})

describe('Architecture guard — no provider (Anthropic SDK) leakage', () => {
  it('only claudeLLMAdapter.ts references Anthropic/ClaudeProvider among the Batch B pipeline files', () => {
    for (const file of PIPELINE_ORDER) {
      if (file === 'infrastructure/adapters/claudeLLMAdapter.ts') continue
      const content = readCode(file)
      expect(content, `${file} must not reference ClaudeProvider`).not.toMatch(/ClaudeProvider|ClaudeChatMessage|ClaudeProviderConfig/)
      expect(content, `${file} must not reference "Anthropic"`).not.toMatch(/Anthropic/)
    }
  })

  it('aiTypes.ts (the shared domain contract) contains no LLM-specific or provider-specific type', () => {
    const content = readCode('domain/aiTypes.ts')
    expect(content).not.toMatch(/Anthropic|ClaudeProvider|temperature|anthropic-version|x-api-key/)
  })
})

describe('Architecture guard — src/ai/ isolation from the pre-existing, unrelated flat files', () => {
  const PRE_EXISTING_FILES = [
    'llmBridge.ts', 'workflowOrchestrator.ts', 'procurementCopilot.ts', 'decisionAssistant.ts',
  ]

  it('none of the new domain/application/infrastructure files import a pre-existing flat src/ai/*.ts file', () => {
    const newFiles = ['domain', 'application', 'infrastructure'].flatMap(dir => listTsFiles(join(AI_ROOT, dir)))
    for (const file of newFiles) {
      const content = readFileSync(file, 'utf-8')
      for (const preExisting of PRE_EXISTING_FILES) {
        const bareName = preExisting.replace('.ts', '')
        expect(content, `${file} must not import pre-existing ${preExisting}`).not.toContain(bareName)
      }
    }
  })

  it('the pre-existing flat src/ai/llmBridge.ts remains untouched (still references its own "8-G" marker)', () => {
    const content = readSrc('llmBridge.ts')
    expect(content).toMatch(/8-G/)
  })
})

describe('Architecture guard — no import from src/knowledge/ or src/mcp/', () => {
  it('src/ai/{domain,application,infrastructure}/ import nothing from src/knowledge/ or src/mcp/', () => {
    const newFiles = ['domain', 'application', 'infrastructure'].flatMap(dir => listTsFiles(join(AI_ROOT, dir)))
    expect(newFiles.length).toBeGreaterThan(0)
    for (const file of newFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
    }
  })
})
