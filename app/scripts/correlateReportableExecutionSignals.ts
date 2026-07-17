#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 4 (SLICE4_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only,
 * one-directional signal-to-report correlation check. Confirms every sourceId recorded in
 * REPORTABLE_EXECUTION_SIGNALS.md (Slice 1's own artifact) also appears in REVIEW_LOG.md
 * (Contract Phase 3's own artifact) -- a construction-level regression guard, not a currently-
 * active problem detector (see IMPLEMENTATION_SLICE_04_SELECTION.md's own Risks). Checks
 * sourceId presence only, never content meaning; no semantic is chosen, scored, ranked, or
 * implied by any finding reported.
 *
 * Fully self-contained: imports nothing from ./lib/governanceRuntime.ts, verifyPushState.ts,
 * summarizeReportableExecutionSignals.ts, or validateReportableExecutionSignals.ts. Performs no
 * write of any kind, to either file it reads, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

/** Splits a Report-style append-only markdown log into raw per-entry blocks, tolerant of minor
 *  formatting variation. Shared shape between REVIEW_LOG.md and REPORTABLE_EXECUTION_SIGNALS.md
 *  (both written via the same "## sourceId\n\n_timestamp_\n\n...\n\n---\n\n" convention).
 *  Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

function extractSourceId(block: string): string | null {
  const headerMatch = block.match(/##\s*(\S+)\s*\n\n_[^\n]*_/)
  return headerMatch ? headerMatch[1] : null
}

/** Returns null if the log does not exist yet (a valid, expected state -- not an error). */
function readSourceIds(logPath: string): Set<string> | null {
  if (!existsSync(logPath)) return null
  const text = readFileSync(logPath, 'utf8')
  const blocks = splitEntryBlocks(text)
  const sourceIds = new Set<string>()
  for (const block of blocks) {
    const id = extractSourceId(block)
    if (id !== null) sourceIds.add(id)
  }
  return sourceIds
}

function main() {
  const root = repoRoot()
  const signalsPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REPORTABLE_EXECUTION_SIGNALS.md')
  const reviewLogPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REVIEW_LOG.md')

  console.log('=== Reportable Execution Signals: Signal-to-Report Correlation Check ===')
  console.log('One-directional only: does every REPORTABLE_EXECUTION_SIGNALS.md entry have a')
  console.log('matching REVIEW_LOG.md entry? Checks sourceId presence only. No semantic is chosen,')
  console.log('scored, ranked, or implied by any finding below.\n')

  const signalsSourceIds = readSourceIds(signalsPath)
  if (signalsSourceIds === null) {
    console.log('No entries yet -- REPORTABLE_EXECUTION_SIGNALS.md does not exist. Nothing to correlate.')
    return
  }
  if (signalsSourceIds.size === 0) {
    console.log('No entries yet -- REPORTABLE_EXECUTION_SIGNALS.md exists but contains zero recorded invocations. Nothing to correlate.')
    return
  }

  const reviewLogSourceIds = readSourceIds(reviewLogPath)
  if (reviewLogSourceIds === null) {
    console.log(`REVIEW_LOG.md does not exist, but REPORTABLE_EXECUTION_SIGNALS.md has ${signalsSourceIds.size} entry(ies) -- all are orphaned by definition.`)
    for (const id of signalsSourceIds) console.log(`  - ${id}: orphaned (no REVIEW_LOG.md to match against)`)
    return
  }

  console.log(`Signals entries checked: ${signalsSourceIds.size}\n`)

  const orphaned = [...signalsSourceIds].filter(id => !reviewLogSourceIds.has(id))

  if (orphaned.length === 0) {
    console.log('No orphaned entries found -- every recorded signal has a matching report.')
    return
  }

  console.log(`${orphaned.length} orphaned entry(ies) found (present in REPORTABLE_EXECUTION_SIGNALS.md, absent from REVIEW_LOG.md):`)
  for (const id of orphaned) {
    console.log(`  - ${id}`)
  }
}

main()
