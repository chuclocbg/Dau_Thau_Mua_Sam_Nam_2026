#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 2 (SLICE2_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * signal summary reporter. Prints aggregate counts of the three raw signals already
 * accumulating in REPORTABLE_EXECUTION_SIGNALS.md (Slice 1's own artifact) -- symmetric across
 * all three, no interpretation, no scoring, no ranking. No semantic is chosen or implied by any
 * count shown.
 *
 * Fully self-contained: imports nothing from ./lib/governanceRuntime.ts or any other existing
 * script, per IMPLEMENTATION_SLICE_02_SELECTION.md's own independence requirement. Performs no
 * write of any kind, to any file, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

interface ParsedSignalEntry {
  readonly triggeredBy: string
  readonly contentDifferedFromPrevious: 'true' | 'false' | 'n/a'
  readonly explicitIntentFlagPresent: 'true' | 'false'
}

/** Parses REPORTABLE_EXECUTION_SIGNALS.md's entries, tolerant of minor formatting variation.
 *  Read-only -- never writes back to the file it parses. */
function parseSignalEntries(text: string): ParsedSignalEntry[] {
  const blocks = text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
  return blocks.map(block => {
    const triggeredByMatch = block.match(/-\s*triggeredBy:\s*(\S+)/)
    const contentMatch = block.match(/-\s*contentDifferedFromPrevious:\s*(\S+)/)
    const flagMatch = block.match(/-\s*explicitIntentFlagPresent:\s*(\S+)/)
    const contentRaw = contentMatch ? contentMatch[1] : 'n/a'
    return {
      triggeredBy: triggeredByMatch ? triggeredByMatch[1] : 'unknown',
      contentDifferedFromPrevious: contentRaw === 'true' ? 'true' : contentRaw === 'false' ? 'false' : 'n/a',
      explicitIntentFlagPresent: flagMatch && flagMatch[1] === 'true' ? 'true' : 'false',
    }
  })
}

function main() {
  const logPath = join(repoRoot(), 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REPORTABLE_EXECUTION_SIGNALS.md')

  console.log('=== Reportable Execution Signals: Summary ===')
  console.log('Raw signal counts only. No semantic is chosen, favored, or implied by any count below.\n')

  if (!existsSync(logPath)) {
    console.log('No entries yet -- REPORTABLE_EXECUTION_SIGNALS.md does not exist.')
    return
  }

  const text = readFileSync(logPath, 'utf8')
  const entries = parseSignalEntries(text)

  if (entries.length === 0) {
    console.log('No entries yet -- file exists but contains zero recorded invocations.')
    return
  }

  console.log(`Total entries: ${entries.length}\n`)

  const triggeredByCounts = new Map<string, number>()
  const contentDifferedCounts: Record<'true' | 'false' | 'n/a', number> = { true: 0, false: 0, 'n/a': 0 }
  const explicitIntentCounts: Record<'true' | 'false', number> = { true: 0, false: 0 }

  for (const e of entries) {
    triggeredByCounts.set(e.triggeredBy, (triggeredByCounts.get(e.triggeredBy) ?? 0) + 1)
    contentDifferedCounts[e.contentDifferedFromPrevious]++
    explicitIntentCounts[e.explicitIntentFlagPresent]++
  }

  console.log('triggeredBy distribution:')
  for (const [value, count] of [...triggeredByCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${value}: ${count}`)
  }

  console.log('\ncontentDifferedFromPrevious distribution:')
  console.log(`  true: ${contentDifferedCounts.true}`)
  console.log(`  false: ${contentDifferedCounts.false}`)
  console.log(`  n/a (no prior entry): ${contentDifferedCounts['n/a']}`)

  console.log('\nexplicitIntentFlagPresent distribution:')
  console.log(`  true: ${explicitIntentCounts.true}`)
  console.log(`  false: ${explicitIntentCounts.false}`)
}

main()
