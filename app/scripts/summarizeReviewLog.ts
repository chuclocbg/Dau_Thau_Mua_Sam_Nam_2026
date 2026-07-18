#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 7 (SLICE7_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * summary reporter for REVIEW_LOG.md -- Contract Phase 3's own durable Report log. Prints
 * aggregate counts of the overall Verdict and each of the three named Check results
 * (HEAD == origin, Working tree clean (tracked files), CI result) already written to every
 * entry. REVIEW_LOG.md's Verdict/Check fields belong entirely to Contract Phase 3's three
 * pre-existing Checks and have no relationship to REPORTABLE_EXECUTION_SIGNALS.md or any
 * candidate reportable-execution semantic -- this capability cannot touch that decision even in
 * principle. No semantic is chosen, scored, ranked, recommended, or interpreted by any count
 * shown.
 *
 * Fully self-contained: imports nothing from ./lib/governanceRuntime.ts, verifyPushState.ts,
 * validateGovernanceRule.ts, summarizeReportableExecutionSignals.ts,
 * correlateReportableExecutionSignals.ts, validateReportableExecutionSignals.ts,
 * validateReviewLog.ts, or validateGovernanceRegistry.ts. Performs no write of any kind, to the
 * one file it reads, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

type Verdict = 'ALL CHECKS PASSED' | 'FAILED' | 'not recognized'
type CheckResult = 'PASS' | 'FAIL' | 'not recognized'

interface ParsedLogEntry {
  readonly verdict: Verdict
  readonly headMatchesOrigin: CheckResult
  readonly workingTreeClean: CheckResult
  readonly ciResult: CheckResult
}

/** Splits REVIEW_LOG.md into raw per-entry blocks, tolerant of minor formatting variation.
 *  Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

function parseVerdict(block: string): Verdict {
  const m = block.match(/\*\*Verdict:\*\*\s*(.+)/)
  const value = m ? m[1].trim() : null
  if (value === 'ALL CHECKS PASSED') return 'ALL CHECKS PASSED'
  if (value === 'FAILED') return 'FAILED'
  return 'not recognized'
}

/** Parses one of the three fixed-name "PASS -- <name>: ..." / "FAIL -- <name>: ..." Check
 *  lines every entry carries. Returns 'not recognized' if the named line is missing or
 *  malformed, rather than silently defaulting to PASS or FAIL. */
function parseCheckLine(block: string, checkNamePattern: string): CheckResult {
  const m = block.match(new RegExp(`-\\s*(PASS|FAIL)\\s*--\\s*${checkNamePattern}:`))
  if (!m) return 'not recognized'
  return m[1] === 'PASS' ? 'PASS' : 'FAIL'
}

function parseLogEntry(block: string): ParsedLogEntry {
  return {
    verdict: parseVerdict(block),
    headMatchesOrigin: parseCheckLine(block, 'HEAD == origin'),
    workingTreeClean: parseCheckLine(block, 'Working tree clean \\(tracked files\\)'),
    ciResult: parseCheckLine(block, 'CI result'),
  }
}

function printDistribution(label: string, counts: Record<string, number>) {
  console.log(`\n${label} distribution:`)
  for (const [value, count] of Object.entries(counts)) {
    console.log(`  ${value}: ${count}`)
  }
}

function main() {
  const logPath = join(repoRoot(), 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REVIEW_LOG.md')

  console.log('=== Review Log: Summary ===')
  console.log("Observational counts only, read directly from REVIEW_LOG.md's own Contract Phase 3")
  console.log('Verdict/Check fields. No relationship to, and no weight toward, any candidate')
  console.log('reportable-execution semantic (trigger-based/content-based/explicit-intent-based) --')
  console.log('REPORTABLE_EXECUTION_SIGNALS.md is a separate, unrelated artifact this script does not')
  console.log('read. No semantic is chosen, scored, ranked, recommended, or interpreted by any count')
  console.log('below.')

  if (!existsSync(logPath)) {
    console.log('\nNo entries yet -- REVIEW_LOG.md does not exist.')
    return
  }

  const text = readFileSync(logPath, 'utf8')
  const blocks = splitEntryBlocks(text)

  if (blocks.length === 0) {
    console.log('\nNo entries yet -- file exists but contains zero recorded entries.')
    return
  }

  const entries = blocks.map(parseLogEntry)

  console.log(`\nTotal entries: ${entries.length}`)

  const verdictCounts: Record<Verdict, number> = { 'ALL CHECKS PASSED': 0, FAILED: 0, 'not recognized': 0 }
  const headCounts: Record<CheckResult, number> = { PASS: 0, FAIL: 0, 'not recognized': 0 }
  const treeCounts: Record<CheckResult, number> = { PASS: 0, FAIL: 0, 'not recognized': 0 }
  const ciCounts: Record<CheckResult, number> = { PASS: 0, FAIL: 0, 'not recognized': 0 }

  for (const e of entries) {
    verdictCounts[e.verdict]++
    headCounts[e.headMatchesOrigin]++
    treeCounts[e.workingTreeClean]++
    ciCounts[e.ciResult]++
  }

  printDistribution('Verdict', verdictCounts)
  printDistribution('HEAD == origin', headCounts)
  printDistribution('Working tree clean (tracked files)', treeCounts)
  printDistribution('CI result', ciCounts)
}

main()
