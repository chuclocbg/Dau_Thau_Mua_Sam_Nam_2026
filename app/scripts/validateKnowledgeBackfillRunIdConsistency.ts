#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 15 (SLICE15_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every KNOWLEDGE_UPDATE_BACKFILL.md entry's own GitHub Actions run-ID citations,
 * wherever they appear within that same entry, agree with each other. Purely internal,
 * intra-entry comparison -- no GitHub API call, no external validation of any run ID's own real
 * existence or conclusion. Distinct from Slice 14's own validateKnowledgeBackfillRollbackConsistency.ts,
 * which compares commit-hash citations via a prefix rule (real data contains both short and full
 * hash forms); run-ID citations are always cited in full, 11-digit form in real data, so this
 * candidate compares by exact string equality instead. Has no relationship to REVIEW_LOG.md,
 * REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution semantic.
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

const ENTRY_HEADER_PATTERN = /^## Runtime Iteration \d+ Slice \d+.*$/gm
const RUN_ID_PATTERN = /`(\d{6,})`/g

interface Entry {
  readonly title: string
  readonly block: string
}

/** Splits raw text into per-entry blocks at each header line. Each block runs from its own
 *  header up to (not including) the next header, or to end of text for the last entry. */
function splitEntries(text: string): Entry[] {
  const headers = [...text.matchAll(ENTRY_HEADER_PATTERN)]
  const entries: Entry[] = []
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!
    const end = i + 1 < headers.length ? headers[i + 1].index! : text.length
    entries.push({ title: headers[i][0].trim(), block: text.slice(start, end) })
  }
  return entries
}

/** Every backtick-quoted, purely-numeric token of at least 6 digits in the block, in document
 *  order. A 6-digit threshold safely excludes the document's own only other backtick-quoted
 *  numeric token (a lone `0`, 1 digit) while including every genuine 11-digit run-ID citation. */
function extractRunIds(block: string): string[] {
  return [...block.matchAll(RUN_ID_PATTERN)].map(m => m[1])
}

type Verdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'missing-run-id-citation' }
  | { readonly kind: 'mismatch'; readonly reference: string; readonly differing: readonly string[] }

function checkEntry(entry: Entry): Verdict {
  const runIds = extractRunIds(entry.block)

  if (runIds.length === 0) {
    return { kind: 'missing-run-id-citation' }
  }
  if (runIds.length === 1) {
    return { kind: 'ok' }
  }

  const reference = runIds[0]
  const differing = runIds.slice(1).filter(id => id !== reference)
  return differing.length === 0 ? { kind: 'ok' } : { kind: 'mismatch', reference, differing }
}

function main() {
  const root = repoRoot()
  const kbPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS', 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: GitHub-Actions-Run-ID Internal Consistency Check ===')
  console.log("Literal, internal cross-field check only. Confirms only that each entry's own")
  console.log('GitHub Actions run-ID citations agree with each other. Takes no position on any')
  console.log('entry\'s content, and performs no external validation of any run ID\'s own real')
  console.log('existence or conclusion.\n')

  if (!existsSync(kbPath)) {
    console.log('Nothing to check -- KNOWLEDGE_UPDATE_BACKFILL.md does not exist.')
    return
  }

  const entries = splitEntries(readFileSync(kbPath, 'utf8'))

  if (entries.length === 0) {
    console.log('No entries found in KNOWLEDGE_UPDATE_BACKFILL.md. Nothing to check.')
    return
  }

  const verdicts = entries.map(entry => ({ entry, verdict: checkEntry(entry) }))
  const ok = verdicts.filter(v => v.verdict.kind === 'ok')
  const missing = verdicts.filter(v => v.verdict.kind === 'missing-run-id-citation')
  const mismatched = verdicts.filter(v => v.verdict.kind === 'mismatch')

  console.log(`${entries.length} entry(ies) checked.`)
  console.log(`  ${ok.length} consistent.`)
  console.log(`  ${mismatched.length} run-ID mismatch(es).`)
  console.log(`  ${missing.length} missing run-ID citation(s).`)

  if (mismatched.length === 0 && missing.length === 0) {
    console.log('\nNo run-ID mismatches or missing run-ID citations found.')
  } else {
    console.log('')
    for (const { entry, verdict } of mismatched) {
      if (verdict.kind === 'mismatch') {
        console.log(`  [MISMATCH] ${entry.title} -- reference \`${verdict.reference}\` vs ${verdict.differing.map(d => `\`${d}\``).join(', ')}`)
      }
    }
    for (const { entry } of missing) {
      console.log(`  [MISSING]  ${entry.title} -- no run-ID citation found`)
    }
  }
}

main()
