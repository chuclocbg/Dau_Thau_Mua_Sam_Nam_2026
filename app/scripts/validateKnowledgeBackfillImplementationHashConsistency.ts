#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 16 (SLICE16_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every KNOWLEDGE_UPDATE_BACKFILL.md entry's own "Authoritative source" commit-hash
 * citation and that same entry's own "Implementation commit hash" field (present only in Slices
 * 12+) agree with each other. Purely internal, intra-entry comparison -- no external
 * git-history validation (Slice 10's own responsibility), and no re-derivation of Slice 14's own
 * Authoritative-source-vs-Rollback comparison (validateKnowledgeBackfillRollbackConsistency.ts),
 * which never inspects the Implementation commit hash field at all. Has no relationship to
 * REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution
 * semantic.
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
const AUTH_SOURCE_PATTERN = /\*\*Authoritative source:\*\*\s*commit\s*`([0-9a-fA-F]+)`/
const IMPL_HASH_PATTERN = /\*\*Implementation commit hash:\*\*\s*`([0-9a-fA-F]+)`/

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

/** One hash is prefix-consistent with another if the shorter is an exact, case-sensitive prefix
 *  of the longer -- accounts for the document's own short-hash Authoritative-source vs
 *  full-hash Implementation-commit-hash citation styles. */
function isPrefixConsistent(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return longer.startsWith(shorter)
}

type Verdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'mismatch'; readonly authHash: string; readonly implHash: string }

function checkEntry(entry: Entry): Verdict {
  const authMatch = entry.block.match(AUTH_SOURCE_PATTERN)
  const implMatch = entry.block.match(IMPL_HASH_PATTERN)

  if (!authMatch || !implMatch) {
    return { kind: 'skipped' }
  }

  const authHash = authMatch[1]
  const implHash = implMatch[1]
  return isPrefixConsistent(authHash, implHash)
    ? { kind: 'ok' }
    : { kind: 'mismatch', authHash, implHash }
}

function main() {
  const root = repoRoot()
  const kbPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS', 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: Implementation-Hash Internal Consistency Check ===')
  console.log("Literal, internal cross-field check only. Confirms only that each entry's own")
  console.log('Authoritative-source hash and its own "Implementation commit hash" field (where')
  console.log('both exist) agree with each other. Takes no position on any entry\'s content or')
  console.log('the underlying Slice\'s own correctness, and performs no external git-history')
  console.log('validation of either hash.\n')

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
  const mismatched = verdicts.filter(v => v.verdict.kind === 'mismatch')
  const skipped = verdicts.filter(v => v.verdict.kind === 'skipped')

  console.log(`${entries.length} entry(ies) checked.`)
  console.log(`  ${ok.length} consistent.`)
  console.log(`  ${mismatched.length} implementation-hash mismatch(es).`)
  console.log(`  ${skipped.length} skipped (missing Authoritative-source hash and/or Implementation commit hash field).`)

  if (mismatched.length === 0) {
    console.log('\nNo implementation-hash mismatches found.')
  } else {
    console.log('')
    for (const { entry, verdict } of mismatched) {
      if (verdict.kind === 'mismatch') {
        console.log(`  [MISMATCH] ${entry.title} -- Authoritative source \`${verdict.authHash}\` vs Implementation commit hash \`${verdict.implHash}\``)
      }
    }
  }
}

main()
