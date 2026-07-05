import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.2 Batch A ──────────────────────────────────
// Per PHASE_X_EXECUTION_PLAN.md / PHASE_X2_IMPLEMENTATION_STRATEGY.md §3: the
// deterministic reasoning pipeline (Batch A) must never call the frozen Knowledge
// Platform directly — that is exclusively X.3's knowledgeResolver.ts. Scoped to the
// subdirectories this milestone actually created (domain/application/testing) —
// not the pre-existing, unrelated src/reasoning/{reasoningEngine,decisionModel}.ts
// (Phase 15 Governance Reasoning Engine track), which this milestone does not own.

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"].*\/knowledge\//,
  /from ['"].*\/ai\//,
  /from ['"].*\/mcp\//,
]

const SCANNED_DIRS = ['domain', 'application', 'testing']

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

describe('Architecture guard — Phase X.2 Batch A reasoning pipeline isolation', () => {
  it('src/reasoning/{domain,application,testing}/ import nothing from src/knowledge/, src/ai/, or src/mcp/', () => {
    const reasoningRoot = join(process.cwd(), 'src', 'reasoning')
    const files = SCANNED_DIRS.flatMap(dir => listTsFiles(join(reasoningRoot, dir)))
    expect(files.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) violations.push(`${file} matches ${pattern}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('does not modify the pre-existing, unrelated src/reasoning/{reasoningEngine,decisionModel}.ts (Phase 15 track)', () => {
    const reasoningRoot = join(process.cwd(), 'src', 'reasoning')
    const preExisting = ['reasoningEngine.ts', 'decisionModel.ts']
    for (const fileName of preExisting) {
      const content = readFileSync(join(reasoningRoot, fileName), 'utf-8')
      expect(content).toMatch(/Phase 15/)
    }
  })
})
