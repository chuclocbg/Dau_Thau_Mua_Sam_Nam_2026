#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 14 (SLICE14_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every KNOWLEDGE_UPDATE_BACKFILL.md entry's own "Authoritative source" commit-hash
 * citation and that same entry's own "git revert <hash>" citation have not drifted apart from
 * each other. Purely internal, intra-entry comparison -- no external git-history validation
 * (Slice 10's own responsibility), no commit-message content checking (Slice 11's own
 * responsibility), no planning-document citation checking (Slice 13's own responsibility). Has
 * no relationship to REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate
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

const ENTRY_HEADER_PATTERN = /^## Runtime Iteration \d+ Slice \d+.*$/gm
const REVERT_PATTERN = /git revert\s+([0-9a-fA-F]+)/
const AUTH_SOURCE_PATTERN = /\*\*Authoritative source:\*\*\s*commit\s*`([0-9a-fA-F]+)`/

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
 *  of the longer -- accounts for the document's own short-hash (Slices 1-11) vs full-hash
 *  (Slices 12+) Rollback-section citation styles. */
function isPrefixConsistent(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return longer.startsWith(shorter)
}

type Verdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'missing-rollback-citation' }
  | { readonly kind: 'mismatch'; readonly authHash: string; readonly revertHash: string }
  | { readonly kind: 'skipped-no-authoritative-source' }

function checkEntry(entry: Entry): Verdict {
  const revertMatch = entry.block.match(REVERT_PATTERN)
  if (!revertMatch) {
    return { kind: 'missing-rollback-citation' }
  }

  const authMatch = entry.block.match(AUTH_SOURCE_PATTERN)
  if (!authMatch) {
    return { kind: 'skipped-no-authoritative-source' }
  }

  const authHash = authMatch[1]
  const revertHash = revertMatch[1]
  return isPrefixConsistent(authHash, revertHash)
    ? { kind: 'ok' }
    : { kind: 'mismatch', authHash, revertHash }
}

function main() {
  const root = repoRoot()
  const kbPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS', 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: Rollback-Hash Internal Consistency Check ===')
  console.log("Literal, internal cross-field check only. Confirms only that each entry's own")
  console.log('Authoritative-source hash and its own "git revert" hash citation agree with each')
  console.log('other. Takes no position on any entry\'s content or the underlying Slice\'s own')
  console.log('correctness, and performs no external git-history validation of either hash.\n')

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
  const missing = verdicts.filter(v => v.verdict.kind === 'missing-rollback-citation')
  const mismatched = verdicts.filter(v => v.verdict.kind === 'mismatch')
  const skipped = verdicts.filter(v => v.verdict.kind === 'skipped-no-authoritative-source')

  console.log(`${entries.length} entry(ies) checked.`)
  console.log(`  ${ok.length} consistent.`)
  console.log(`  ${mismatched.length} rollback-hash mismatch(es).`)
  console.log(`  ${missing.length} missing rollback citation(s).`)
  console.log(`  ${skipped.length} skipped (no extractable Authoritative-source hash).`)

  if (mismatched.length === 0 && missing.length === 0) {
    console.log('\nNo rollback-hash mismatches or missing rollback citations found.')
  } else {
    console.log('')
    for (const { entry, verdict } of mismatched) {
      if (verdict.kind === 'mismatch') {
        console.log(`  [MISMATCH] ${entry.title} -- Authoritative source \`${verdict.authHash}\` vs git revert \`${verdict.revertHash}\``)
      }
    }
    for (const { entry } of missing) {
      console.log(`  [MISSING]  ${entry.title} -- no "git revert" citation found`)
    }
  }
}

main()
