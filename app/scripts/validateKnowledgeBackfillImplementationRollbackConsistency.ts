#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 17 (SLICE17_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every KNOWLEDGE_UPDATE_BACKFILL.md entry's own "Implementation commit hash" field
 * and that same entry's own "git revert <hash>" citation agree with each other. This is the
 * third and final pairwise relationship among the document's three per-entry hash citations
 * (Authoritative source, Implementation commit hash, git-revert) -- Slice 14's own
 * validateKnowledgeBackfillRollbackConsistency.ts already checks Authoritative source vs.
 * git-revert; Slice 16's own validateKnowledgeBackfillImplementationHashConsistency.ts already
 * checks Authoritative source vs. Implementation commit hash; neither checks -- nor, since
 * prefix-consistency is weaker than equality, logically guarantees -- this third pairing. Unlike
 * those two slices, this candidate compares by exact string equality, never a prefix
 * relationship, since real data confirms both values are always cited in full, 40-character
 * form. Has no relationship to REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate
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
const IMPL_HASH_PATTERN = /\*\*Implementation commit hash:\*\*\s*`([0-9a-fA-F]+)`/
const REVERT_PATTERN = /git revert\s+([0-9a-fA-F]+)/

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

type Verdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'mismatch'; readonly implHash: string; readonly revertHash: string }

function checkEntry(entry: Entry): Verdict {
  const implMatch = entry.block.match(IMPL_HASH_PATTERN)
  const revertMatch = entry.block.match(REVERT_PATTERN)

  if (!implMatch || !revertMatch) {
    return { kind: 'skipped' }
  }

  const implHash = implMatch[1]
  const revertHash = revertMatch[1]
  return implHash === revertHash
    ? { kind: 'ok' }
    : { kind: 'mismatch', implHash, revertHash }
}

function main() {
  const root = repoRoot()
  const kbPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS', 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: Implementation-Hash / Rollback-Hash Internal Consistency Check ===')
  console.log("Literal, internal cross-field check only. Confirms only that each entry's own")
  console.log('"Implementation commit hash" field and its own "git revert" citation agree with')
  console.log('each other. Takes no position on any entry\'s content or the underlying Slice\'s')
  console.log('own correctness, and performs no external git-history validation of either hash.\n')

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
  console.log(`  ${mismatched.length} implementation-hash/rollback-hash mismatch(es).`)
  console.log(`  ${skipped.length} skipped (missing Implementation commit hash field and/or git-revert citation).`)

  if (mismatched.length === 0) {
    console.log('\nNo implementation-hash/rollback-hash mismatches found.')
  } else {
    console.log('')
    for (const { entry, verdict } of mismatched) {
      if (verdict.kind === 'mismatch') {
        console.log(`  [MISMATCH] ${entry.title} -- Implementation commit hash \`${verdict.implHash}\` vs git revert \`${verdict.revertHash}\``)
      }
    }
  }
}

main()
