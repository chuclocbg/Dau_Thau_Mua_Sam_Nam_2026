#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 9 (SLICE9_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * structural validator for KNOWLEDGE_UPDATE_BACKFILL.md. Every one of Slices 1-8's own Knowledge
 * Backfill updates has manually appended a new "## Runtime Iteration N Slice M" section in
 * strictly increasing M order, by hand, re-verified by direct reading at each prior update cycle
 * -- but never once mechanically checked by any tool until now. This script checks two structural
 * properties per entry: (1) header sequencing -- M forms a strictly increasing, gap-free,
 * duplicate-free sequence starting at 1, within each Iteration N group, in file-physical order;
 * (2) Authoritative-source presence -- each entry states a commit hash in backticks. Checks
 * structure only, never content meaning. This capability is scoped entirely to one document's own
 * structural shape and has no relationship whatsoever to REVIEW_LOG.md,
 * REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution semantic.
 *
 * Fully self-contained: imports only node:child_process, node:fs, node:path. Performs no write of
 * any kind, to any file it reads, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

interface ParsedEntry {
  readonly raw: string
  readonly iteration: number | null
  readonly slice: number | null
  readonly hasAuthoritativeSource: boolean
}

/** Splits KNOWLEDGE_UPDATE_BACKFILL.md into raw per-entry blocks, tolerant of minor formatting
 *  variation -- the same technique already used identically by validateReviewLog.ts and
 *  summarizeReportableExecutionSignals.ts. Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

function parseEntry(block: string): ParsedEntry {
  const headerMatch = block.match(/^##\s*Runtime Iteration\s+(\d+)\s+Slice\s+(\d+)/m)
  const sourceMatch = block.match(/\*\*Authoritative source:\*\*\s*commit\s*`([^`]+)`/)
  return {
    raw: block,
    iteration: headerMatch ? Number(headerMatch[1]) : null,
    slice: headerMatch ? Number(headerMatch[2]) : null,
    hasAuthoritativeSource: !!(sourceMatch && sourceMatch[1].trim().length > 0),
  }
}

interface Anomaly {
  readonly description: string
}

/** Checks one Iteration group's Slice numbers for strict, gap-free, duplicate-free sequencing in
 *  file-physical order -- a stricter rule than REVIEW_LOG.md's own "chronological non-decreasing"
 *  check, deliberately: this document's Slice numbers are appended one at a time, sequentially, by
 *  a single actor, so gap-free strict sequencing is the correct property to check here. */
function checkGroupSequencing(iteration: number, sliceNumbers: readonly number[]): Anomaly[] {
  const anomalies: Anomaly[] = []

  const seen = new Set<number>()
  const duplicates = new Set<number>()
  for (const m of sliceNumbers) {
    if (seen.has(m)) duplicates.add(m)
    seen.add(m)
  }
  for (const m of duplicates) {
    anomalies.push({ description: `Iteration ${iteration}: duplicate Slice ${m}` })
  }

  const uniqueSorted = [...seen].sort((a, b) => a - b)
  for (let i = 0; i < uniqueSorted.length; i++) {
    if (uniqueSorted[i] !== i + 1) {
      anomalies.push({
        description: `Iteration ${iteration}: gap in Slice numbering (expected Slice ${i + 1}, found Slice ${uniqueSorted[i]})`,
      })
      break
    }
  }

  if (duplicates.size === 0 && anomalies.length === 0) {
    for (let i = 0; i < sliceNumbers.length; i++) {
      if (sliceNumbers[i] !== i + 1) {
        anomalies.push({
          description: `Iteration ${iteration}: entries out of file order (position ${i + 1} holds Slice ${sliceNumbers[i]}, expected Slice ${i + 1})`,
        })
        break
      }
    }
  }

  return anomalies
}

function main() {
  const backfillPath = join(
    repoRoot(),
    'PROJECT_KNOWLEDGE_SYSTEM',
    '01_PROJECT_DOCS',
    'KNOWLEDGE_UPDATE_BACKFILL.md',
  )

  console.log('=== Knowledge Backfill: Structural Validity Check ===')
  console.log('Structural check only. Takes no position on any entry\'s content -- flags only')
  console.log('header sequencing (Iteration/Slice numbering) and Authoritative-source presence.')
  console.log('No semantic is chosen, scored, ranked, recommended, or interpreted by any finding')
  console.log('below.\n')

  if (!existsSync(backfillPath)) {
    console.log('KNOWLEDGE_UPDATE_BACKFILL.md does not exist. Nothing to validate.')
    return
  }

  const text = readFileSync(backfillPath, 'utf8')
  const blocks = splitEntryBlocks(text)

  if (blocks.length === 0) {
    console.log('No entries yet -- file exists but contains zero recorded entries. Nothing to validate.')
    return
  }

  const entries = blocks.map(parseEntry)
  const anomalies: Anomaly[] = []

  let unparsedCounter = 0
  for (const e of entries) {
    if (e.iteration === null || e.slice === null) {
      unparsedCounter++
      anomalies.push({
        description: `Entry ${unparsedCounter}: header does not parse into a valid Iteration/Slice pair`,
      })
    }
    if (!e.hasAuthoritativeSource) {
      const label = e.iteration !== null && e.slice !== null
        ? `Iteration ${e.iteration} Slice ${e.slice}`
        : `entry with unparseable header`
      anomalies.push({
        description: `${label}: missing or malformed Authoritative-source line`,
      })
    }
  }

  const groups = new Map<number, number[]>()
  for (const e of entries) {
    if (e.iteration === null || e.slice === null) continue
    const list = groups.get(e.iteration) ?? []
    list.push(e.slice)
    groups.set(e.iteration, list)
  }
  for (const [iteration, sliceNumbers] of groups) {
    anomalies.push(...checkGroupSequencing(iteration, sliceNumbers))
  }

  console.log(`Entries checked: ${entries.length}\n`)

  if (anomalies.length === 0) {
    console.log('No anomalies found.')
    return
  }

  console.log(`${anomalies.length} anomaly(ies) found:`)
  for (const a of anomalies) {
    console.log(`  - ${a.description}`)
  }
}

main()
