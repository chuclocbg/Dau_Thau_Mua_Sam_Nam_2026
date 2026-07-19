#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 13 (SLICE13_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every Selection/Disclosure planning-document filename KNOWLEDGE_UPDATE_BACKFILL.md
 * cites, in backtick-quoted spans matching one of two known naming patterns, actually exists on
 * disk in PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/. Distinct from Slices 9-11 (which check the
 * document's own internal structure and its commit citations, never citations to other
 * documents) and from Slice 12 (which checks link targets inside REGISTRY.md, an unrelated
 * file). Existence only -- a cited document's own content is never opened or read. Has no
 * relationship to REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate
 * reportable-execution semantic.
 *
 * Fully self-contained: imports nothing from any other script in this repository. Performs no
 * write of any kind, under any circumstance.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

const SELECTION_PATTERN = /^IMPLEMENTATION_SLICE_\d+_SELECTION\.md$/
const DISCLOSURE_PATTERN = /^SLICE\d+_PRE_IMPLEMENTATION_DISCLOSURE\.md$/

/** Extracts every backtick-delimited span from raw text, normalizes embedded whitespace
 *  (including markdown word-wrap newlines) to nothing, and keeps only spans matching one of the
 *  two known planning-document naming patterns. De-duplicated. */
function extractCitations(text: string): string[] {
  const citations = new Set<string>()
  const spanPattern = /`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = spanPattern.exec(text)) !== null) {
    const normalized = match[1].replace(/\s+/g, '')
    if (SELECTION_PATTERN.test(normalized) || DISCLOSURE_PATTERN.test(normalized)) {
      citations.add(normalized)
    }
  }
  return [...citations].sort()
}

interface CitationResult {
  readonly filename: string
  readonly exists: boolean
  readonly resolvedPath: string
}

function checkCitation(filename: string, docsDir: string): CitationResult {
  const resolvedPath = join(docsDir, filename)
  return { filename, exists: existsSync(resolvedPath), resolvedPath }
}

function main() {
  const root = repoRoot()
  const docsDir = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS')
  const kbPath = join(docsDir, 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: Planning-Document Citation Existence Check ===')
  console.log('Literal filename-existence check only. Takes no position on any entry\'s content')
  console.log('or on the underlying Slice\'s own correctness. Scope is limited to citations')
  console.log('matching IMPLEMENTATION_SLICE_<N>_SELECTION.md or SLICE<N>_PRE_IMPLEMENTATION_')
  console.log('DISCLOSURE.md -- every other backtick-quoted filename is silently excluded.\n')

  if (!existsSync(kbPath)) {
    console.log('Nothing to check -- KNOWLEDGE_UPDATE_BACKFILL.md does not exist.')
    return
  }

  const citations = extractCitations(readFileSync(kbPath, 'utf8'))

  if (citations.length === 0) {
    console.log('No planning-document citations found matching the known naming patterns.')
    console.log('Nothing to check.')
    return
  }

  const results = citations.map(c => checkCitation(c, docsDir))
  const missing = results.filter(r => !r.exists)

  console.log(`${results.length} distinct planning-document citation(s) checked.`)
  console.log(`  ${results.length - missing.length} resolved to a real file.`)
  console.log(`  ${missing.length} missing.`)

  if (missing.length === 0) {
    console.log('\nNo missing planning documents found.')
    return
  }

  console.log('')
  for (const r of missing) {
    console.log(`  [MISSING] ${r.filename} -- expected at ${r.resolvedPath}`)
  }
}

main()
