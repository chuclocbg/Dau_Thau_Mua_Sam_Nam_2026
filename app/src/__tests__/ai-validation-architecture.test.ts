import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4 (Output Validation) ─────────────────────
// Per this milestone's "Architecture rules": validation depends only on
// AIContext / the provider-agnostic LLMOutput shape (never Knowledge Platform,
// Retriever, MCP, Tools, Conversation internals, or a provider implementation).
// Scoped to src/ai/validation/ — the only new directory this milestone creates.
// Checks run against comment-stripped code, per the lesson learned in the
// Batch B architecture guard (explanatory comments legitimately discuss
// forbidden concepts in prose without importing them).

const VALIDATION_ROOT = join(process.cwd(), 'src', 'ai', 'validation')
const AI_ROOT = join(process.cwd(), 'src', 'ai')

function readRaw(root: string, relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf-8')
}

function readCode(relativePath: string): string {
  return readRaw(VALIDATION_ROOT, relativePath)
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

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"].*\/knowledge\//, /from ['"].*\/mcp\//, /from ['"].*\/conversation\//,
  /from ['"].*\/providers\//, /from ['"].*\/reasoning\//,
]

const LEAF_VALIDATORS = ['citationValidator.ts', 'confidenceValidator.ts', 'legalConsistencyValidator.ts']

describe('Architecture guard — Phase X.4 dependency direction', () => {
  it('no file under src/ai/validation/ imports Knowledge Platform, MCP, Conversation, a provider, or Reasoning directly', () => {
    const files = listTsFiles(VALIDATION_ROOT)
    expect(files.length).toBeGreaterThan(0)
    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) violations.push(`${file} matches ${pattern}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('the three leaf validators (Citation/Confidence/LegalConsistency) import only aiTypes and validationTypes', () => {
    for (const file of LEAF_VALIDATORS) {
      const content = readCode(file)
      expect(content, `${file} must import aiTypes`).toMatch(/from ['"]\.\.\/domain\/aiTypes\.ts['"]/)
      expect(content, `${file} must import validationTypes`).toMatch(/from ['"]\.\/validationTypes\.ts['"]/)
      for (const forbidden of ['outputValidator', 'responseFormatter', 'validationPipeline']) {
        expect(content, `${file} must not import ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('OutputValidator imports the three leaf validators + aiTypes/validationTypes — never ResponseFormatter or ValidationPipeline', () => {
    const content = readCode('outputValidator.ts')
    for (const leaf of ['citationValidator', 'confidenceValidator', 'legalConsistencyValidator']) {
      expect(content).toContain(leaf)
    }
    for (const forbidden of ['responseFormatter', 'validationPipeline']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('ResponseFormatter imports only aiTypes/validationTypes — never OutputValidator or the leaf validators', () => {
    const content = readCode('responseFormatter.ts')
    for (const forbidden of ['outputValidator', 'validationPipeline', 'citationValidator', 'confidenceValidator', 'legalConsistencyValidator']) {
      expect(content).not.toContain(forbidden)
    }
  })

  it('ValidationPipeline imports OutputValidator + ResponseFormatter only — never the leaf validators directly', () => {
    const content = readCode('validationPipeline.ts')
    expect(content).toContain('outputValidator')
    expect(content).toContain('responseFormatter')
    for (const leaf of ['citationValidator', 'confidenceValidator', 'legalConsistencyValidator']) {
      expect(content).not.toContain(leaf)
    }
  })
})

describe('Architecture guard — no cyclic imports within src/ai/validation/', () => {
  it('leaf validators never import OutputValidator/ResponseFormatter/ValidationPipeline (already asserted above); reverse direction holds too', () => {
    const outputValidatorContent = readCode('outputValidator.ts')
    expect(outputValidatorContent).not.toContain('validationPipeline')
    const responseFormatterContent = readCode('responseFormatter.ts')
    expect(responseFormatterContent).not.toContain('outputValidator')
  })
})

describe('Architecture guard — frozen modules untouched (Conversation Core, Reasoning Core, Batch B)', () => {
  it('src/ai/application/{aiContextBuilder,promptBuilder,promptRenderer}.ts and the ClaudeLLMAdapter still carry their own frozen-milestone markers', () => {
    expect(readRaw(AI_ROOT, 'application/aiContextBuilder.ts')).toMatch(/Batch B/)
    expect(readRaw(AI_ROOT, 'application/promptBuilder.ts')).toMatch(/presentation only/)
    expect(readRaw(AI_ROOT, 'application/promptRenderer.ts')).toMatch(/deterministic rendering only/)
    expect(readRaw(AI_ROOT, 'infrastructure/adapters/claudeLLMAdapter.ts')).toMatch(/outer boundary/i)
  })

  it('none of the new validation files import from the frozen Batch B application/infrastructure modules', () => {
    const files = listTsFiles(VALIDATION_ROOT)
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      for (const frozenModule of ['aiContextBuilder', 'promptBuilder', 'promptRenderer', 'modelSelector', 'modelCapabilityRegistry', 'claudeLLMAdapter']) {
        expect(content, `${file} must not import frozen module ${frozenModule}`).not.toContain(frozenModule)
      }
    }
  })
})
