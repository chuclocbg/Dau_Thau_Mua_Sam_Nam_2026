#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 3 (SLICE3_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * structural/well-formedness validator for REPORTABLE_EXECUTION_SIGNALS.md. Surfaces malformed
 * or anomalous entries that Slice 2's summarizer currently tolerates silently -- checks
 * structure only (field presence, chronological ordering, sourceId uniqueness), never content
 * meaning. No semantic is chosen, scored, ranked, or implied by any finding reported.
 *
 * Fully self-contained: imports nothing from ./lib/governanceRuntime.ts, verifyPushState.ts, or
 * summarizeReportableExecutionSignals.ts. Performs no write of any kind, to any file, under any
 * circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

interface RawEntry {
  readonly sourceId: string
  readonly createdAt: string
  readonly triggeredByRaw: string | null
  readonly contentDifferedRaw: string | null
  readonly explicitIntentRaw: string | null
}

/** Splits REPORTABLE_EXECUTION_SIGNALS.md into raw per-entry blocks, tolerant of minor
 *  formatting variation. Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

function parseRawEntry(block: string): RawEntry {
  const headerMatch = block.match(/##\s*(\S+)\s*\n\n_([^\n]*)_/)
  const triggeredByMatch = block.match(/-\s*triggeredBy:\s*(\S+)/)
  const contentMatch = block.match(/-\s*contentDifferedFromPrevious:\s*(\S+)/)
  const flagMatch = block.match(/-\s*explicitIntentFlagPresent:\s*(\S+)/)
  return {
    sourceId: headerMatch ? headerMatch[1] : '(unparseable header)',
    createdAt: headerMatch ? headerMatch[2] : '',
    triggeredByRaw: triggeredByMatch ? triggeredByMatch[1] : null,
    contentDifferedRaw: contentMatch ? contentMatch[1] : null,
    explicitIntentRaw: flagMatch ? flagMatch[1] : null,
  }
}

interface Anomaly {
  readonly sourceId: string
  readonly description: string
}

// Presence-based, not exact-literal-value-based: triggeredBy's own value set is Contract-adjacent
// and potentially extensible by a future, properly-authorized phase, so only presence is checked.
// contentDifferedFromPrevious/explicitIntentFlagPresent's value sets are closed and owned entirely
// by this document chain (Slice 1's own SignalRecord shape), so checking against their known,
// recognized forms is not over-fitting to incidental, currently-observed data.
const RECOGNIZED_CONTENT_DIFFERED = new Set(['true', 'false', 'n/a'])
const RECOGNIZED_EXPLICIT_INTENT = new Set(['true', 'false'])

function findAnomalies(entries: RawEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  const seenSourceIds = new Set<string>()
  let previousTimestamp: string | null = null

  for (const entry of entries) {
    // (a) required-field presence, in recognized form
    if (entry.triggeredByRaw === null || entry.triggeredByRaw.length === 0) {
      anomalies.push({ sourceId: entry.sourceId, description: 'triggeredBy field missing or empty' })
    }
    if (entry.contentDifferedRaw === null || !RECOGNIZED_CONTENT_DIFFERED.has(entry.contentDifferedRaw)) {
      anomalies.push({
        sourceId: entry.sourceId,
        description: `contentDifferedFromPrevious field missing or unrecognized (${entry.contentDifferedRaw ?? 'absent'})`,
      })
    }
    if (entry.explicitIntentRaw === null || !RECOGNIZED_EXPLICIT_INTENT.has(entry.explicitIntentRaw)) {
      anomalies.push({
        sourceId: entry.sourceId,
        description: `explicitIntentFlagPresent field missing or unrecognized (${entry.explicitIntentRaw ?? 'absent'})`,
      })
    }

    // (b) chronological non-decreasing ordering (append-only guarantee actually held)
    if (previousTimestamp !== null && entry.createdAt < previousTimestamp) {
      anomalies.push({
        sourceId: entry.sourceId,
        description: `timestamp out of order (${entry.createdAt} follows ${previousTimestamp})`,
      })
    }
    previousTimestamp = entry.createdAt

    // (c) sourceId uniqueness
    if (seenSourceIds.has(entry.sourceId)) {
      anomalies.push({ sourceId: entry.sourceId, description: 'duplicate sourceId' })
    }
    seenSourceIds.add(entry.sourceId)
  }

  return anomalies
}

function main() {
  const logPath = join(repoRoot(), 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REPORTABLE_EXECUTION_SIGNALS.md')

  console.log('=== Reportable Execution Signals: Structural Validity Check ===')
  console.log('Checks structure only (field presence, ordering, sourceId uniqueness). No semantic')
  console.log('is chosen, scored, ranked, or implied by any finding below.\n')

  if (!existsSync(logPath)) {
    console.log('No entries yet -- REPORTABLE_EXECUTION_SIGNALS.md does not exist. Nothing to validate.')
    return
  }

  const text = readFileSync(logPath, 'utf8')
  const blocks = splitEntryBlocks(text)

  if (blocks.length === 0) {
    console.log('No entries yet -- file exists but contains zero recorded invocations. Nothing to validate.')
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
