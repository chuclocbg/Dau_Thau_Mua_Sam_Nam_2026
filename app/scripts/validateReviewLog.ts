#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 5 (SLICE5_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * structural/well-formedness validator for REVIEW_LOG.md -- the foundational Contract Phase 3
 * artifact every other Runtime Iteration 2 slice reads from or correlates against. Checks
 * structure only (required-parts presence, chronological ordering, sourceId uniqueness), never
 * content meaning. REVIEW_LOG.md has no triggeredBy/contentDifferedFromPrevious/
 * explicitIntentFlagPresent fields at all, so this capability cannot touch reportable-execution
 * semantics even in principle. No semantic is chosen, scored, ranked, or implied by any finding
 * reported.
 *
 * Fully self-contained: imports nothing from ./lib/governanceRuntime.ts, verifyPushState.ts,
 * validateGovernanceRule.ts, summarizeReportableExecutionSignals.ts,
 * validateReportableExecutionSignals.ts, or correlateReportableExecutionSignals.ts. Performs no
 * write of any kind, to any file, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

interface RawEntry {
  readonly sourceId: string | null
  readonly createdAt: string | null
  readonly contentRaw: string | null
}

/** Splits REVIEW_LOG.md into raw per-entry blocks, tolerant of minor formatting variation.
 *  Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

function parseRawEntry(block: string): RawEntry {
  const headerMatch = block.match(/##\s*(\S+)\s*\n\n_([^\n]*)_\n\n([\s\S]*)$/)
  return {
    sourceId: headerMatch ? headerMatch[1] : null,
    createdAt: headerMatch ? headerMatch[2] : null,
    contentRaw: headerMatch ? headerMatch[3] : null,
  }
}

interface Anomaly {
  readonly sourceId: string
  readonly description: string
}

function findAnomalies(entries: RawEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  const seenSourceIds = new Set<string>()
  let previousTimestamp: string | null = null
  let unnamedCounter = 0

  for (const entry of entries) {
    const label = entry.sourceId ?? `(entry ${++unnamedCounter}, unparseable header)`

    // (a) required-parts presence: sourceId, timestamp, non-empty content
    if (entry.sourceId === null || entry.sourceId.length === 0) {
      anomalies.push({ sourceId: label, description: 'sourceId missing or unparseable' })
    }
    if (entry.createdAt === null || entry.createdAt.length === 0) {
      anomalies.push({ sourceId: label, description: 'timestamp missing or unparseable' })
    }
    if (entry.contentRaw === null || entry.contentRaw.trim().length === 0) {
      anomalies.push({ sourceId: label, description: 'content missing or empty' })
    }

    // (b) chronological non-decreasing ordering (append-only guarantee actually held)
    if (entry.createdAt !== null) {
      if (previousTimestamp !== null && entry.createdAt < previousTimestamp) {
        anomalies.push({
          sourceId: label,
          description: `timestamp out of order (${entry.createdAt} follows ${previousTimestamp})`,
        })
      }
      previousTimestamp = entry.createdAt
    }

    // (c) sourceId uniqueness
    if (entry.sourceId !== null) {
      if (seenSourceIds.has(entry.sourceId)) {
        anomalies.push({ sourceId: label, description: 'duplicate sourceId' })
      }
      seenSourceIds.add(entry.sourceId)
    }
  }

  return anomalies
}

function main() {
  const logPath = join(repoRoot(), 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REVIEW_LOG.md')

  console.log('=== Review Log: Structural Validity Check ===')
  console.log('Checks structure only (required-parts presence, ordering, sourceId uniqueness).')
  console.log('No semantic is chosen, scored, ranked, or implied by any finding below.\n')

  if (!existsSync(logPath)) {
    console.log('No entries yet -- REVIEW_LOG.md does not exist. Nothing to validate.')
    return
  }

  const text = readFileSync(logPath, 'utf8')
  const blocks = splitEntryBlocks(text)

  if (blocks.length === 0) {
    console.log('No entries yet -- file exists but contains zero recorded entries. Nothing to validate.')
    return
  }

  const entries = blocks.map(parseRawEntry)
  const anomalies = findAnomalies(entries)

  console.log(`Entries checked: ${entries.length}\n`)

  if (anomalies.length === 0) {
    console.log('No anomalies found.')
    return
  }

  console.log(`${anomalies.length} anomaly(ies) found:`)
  for (const a of anomalies) {
    console.log(`  - ${a.sourceId}: ${a.description}`)
  }
}

main()
