import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.1 ──────────────────────────────────────────
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/PHASE_X_EXECUTION_PLAN.md's stated
// X.1 freeze checkpoint: "an architecture test confirms src/conversation/ imports
// nothing from src/knowledge/, src/reasoning/, src/ai/, or src/mcp/." None of the
// latter three exist yet — this test is a standing regression guard for when they do.

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"].*\/knowledge\//,
  /from ['"].*\/reasoning\//,
  /from ['"].*\/ai\//,
  /from ['"].*\/mcp\//,
]

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

describe('Architecture guard — src/conversation/ isolation', () => {
  it('imports nothing from src/knowledge/, src/reasoning/, src/ai/, or src/mcp/', () => {
    const conversationDir = join(process.cwd(), 'src', 'conversation')
    const files = listTsFiles(conversationDir)
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
})
