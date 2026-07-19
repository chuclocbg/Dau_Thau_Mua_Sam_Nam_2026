#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 18 (SLICE18_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every KNOWLEDGE_UPDATE_BACKFILL.md entry's own header Slice number (`## Runtime
 * Iteration N Slice M`) and that same entry's own `**Slice number:** Runtime Iteration N, Slice
 * M.` field agree with each other. Compares Slice numbers only -- the Iteration number is never
 * extracted or compared, per this candidate's own approved scope. Unlike the hash-citation family
 * (Slices 14, 16, 17), the two values compared here are small integers, so comparison is by
 * numeric equality, never string equality, to avoid a spurious mismatch from a purely cosmetic
 * formatting difference. Has no relationship to REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md,
 * or any candidate reportable-execution semantic.
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
const HEADER_SLICE_NUMBER_PATTERN = /^## Runtime Iteration \d+ Slice (\d+)/
const FIELD_SLICE_NUMBER_PATTERN = /\*\*Slice number:\*\*\s*Runtime Iteration\s+\d+,\s*Slice\s+(\d+)\./

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
  | { readonly kind: 'mismatch'; readonly headerNumber: number; readonly fieldNumber: number }

function checkEntry(entry: Entry): Verdict {
  const headerMatch = entry.title.match(HEADER_SLICE_NUMBER_PATTERN)
  const fieldMatch = entry.block.match(FIELD_SLICE_NUMBER_PATTERN)

  if (!fieldMatch) {
    return { kind: 'skipped' }
  }

  // headerMatch is structurally guaranteed non-null: ENTRY_HEADER_PATTERN itself requires a
  // digit group in this exact position to produce the entry in the first place.
  const headerNumber = Number(headerMatch![1])
  const fieldNumber = Number(fieldMatch[1])
  return headerNumber === fieldNumber
    ? { kind: 'ok' }
    : { kind: 'mismatch', headerNumber, fieldNumber }
}

function main() {
  const root = repoRoot()
  const kbPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '01_PROJECT_DOCS', 'KNOWLEDGE_UPDATE_BACKFILL.md')

  console.log('=== Knowledge Backfill: Header / Slice-number Field Internal Consistency Check ===')
  console.log("Literal, internal cross-field check only. Confirms only that each entry's own")
  console.log('header Slice number and its own "Slice number:" field agree with each other.')
  console.log('Takes no position on any entry\'s content or the underlying Slice\'s own')
  console.log('correctness, and performs no external git-history validation of either value.\n')

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
  console.log(`  ${mismatched.length} header/field slice-number mismatch(es).`)
  console.log(`  ${skipped.length} skipped (missing Slice number field).`)

  if (mismatched.length === 0) {
    console.log('\nNo header/field slice-number mismatches found.')
  } else {
    console.log('')
    for (const { entry, verdict } of mismatched) {
      if (verdict.kind === 'mismatch') {
        console.log(`  [MISMATCH] ${entry.title} -- header Slice ${verdict.headerNumber} vs field Slice ${verdict.fieldNumber}`)
      }
    }
  }
}

main()
