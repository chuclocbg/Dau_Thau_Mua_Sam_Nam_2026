/**
 * Governance Engine Runtime -- shared execution infrastructure.
 *
 * Phase 1 (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md), extracted from
 * app/scripts/verifyPushState.ts (Governance Rule REVIEW-3). Every export below already existed,
 * unchanged in behavior, inside that one script -- this is an extraction, not a rewrite. See
 * GOVERNANCE_ENGINE_RUNTIME.md's "REVIEW-3 Pieces That Become Runtime Components" table for the
 * design decision this file implements.
 *
 * Rule-specific logic (checkHeadMatchesOrigin, checkWorkingTreeClean, pollWorkflowRun's own
 * GitHub-Actions-specific interpretation) deliberately stays in verifyPushState.ts, per
 * GOVERNANCE_OBJECT_MODEL.md's Check entry: "each rule defines its own Checks freely -- this is
 * the one object in the entire model explicitly designed to be authored fresh per rule, not
 * reused."
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function repoRoot(): string {
  return sh('git rev-parse --show-toplevel')
}

export function currentBranch(): string {
  return sh('git rev-parse --abbrev-ref HEAD')
}

export function ownerRepoFromRemote(): { owner: string; repo: string } {
  const url = sh('git remote get-url origin')
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/)
  if (!match) throw new Error(`Could not parse owner/repo from origin remote: ${url}`)
  const [, owner, repo] = match
  return { owner, repo }
}

/** The environment a RuleExecution runs within (GOVERNANCE_OBJECT_MODEL.md's ExecutionContext
 *  entry) -- maps directly onto what this module's own repoRoot()/currentBranch()/
 *  ownerRepoFromRemote() already gather at the start of every run. Constructed fresh per
 *  execution; not independently persisted (that entry's own Serialization note: "ephemeral"). */
export interface ExecutionContext {
  readonly repoRoot: string
  readonly branch: string
  readonly owner: string
  readonly repo: string
  readonly headSha: string
}

/** One specific, timestamped run of a rule's script (GOVERNANCE_OBJECT_MODEL.md's RuleExecution
 *  entry). Phase 2 (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md): constructed explicitly and
 *  in-memory so "the script ran" is a real, typed fact instead of an implicit, untracked event.
 *  Not yet persisted -- that is Phase 3's Report, out of this phase's scope. `triggeredBy` is
 *  REVIEW-3's own execution_points value set (RULE_DEFINITION_FORMAT.md), already excluding
 *  "scheduled" per the Reduction Plan's trim -- no new enum value introduced here. */
export interface RuleExecution {
  readonly ruleId: string
  readonly version: number
  readonly triggeredBy: 'command' | 'dogfood' | 'ci' | 'pre-commit' | 'ai-review'
  readonly timestamp: string
  readonly executionContext: ExecutionContext
}

/** The Rule Execution API's standard per-check result shape (GOVERNANCE_ENGINE_RUNTIME.md §19,
 *  §4's Rule Execution Pipeline). Every future rule's script returns arrays of this. */
export interface CheckResult {
  readonly name: string
  readonly ok: boolean
  readonly detail: string
}

/** Prints one CheckResult in the standard PASS/FAIL format. Extracted because this exact format
 *  was already duplicated twice within verifyPushState.ts itself (once for the synchronous
 *  checks, once for the CI-poll result) -- a real, present duplication, not a speculative one. */
export function printCheckResult(r: CheckResult): void {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} -- ${r.name}\n  ${r.detail.replace(/\n/g, '\n  ')}\n`)
}

/** Cross-references a GitHub Actions workflow file for step names carrying
 *  `continue-on-error: true`, so a reported API "success" can be flagged as masked rather than
 *  taken at face value. Named in GOVERNANCE_ENGINE_RUNTIME.md's extraction table as reusable by
 *  any future CI-category rule (CI-3, CI-4) -- both designed, not yet implemented. */
export function findMaskedStepNames(root: string, workflowRelativePath = '.github/workflows/ci.yml'): Set<string> {
  const workflowPath = join(root, ...workflowRelativePath.split('/'))
  if (!existsSync(workflowPath)) return new Set()
  const lines = readFileSync(workflowPath, 'utf8').split('\n')
  const masked = new Set<string>()
  let currentStepName: string | null = null
  for (const line of lines) {
    const nameMatch = line.match(/^\s*-\s*name:\s*(.+)$/)
    if (nameMatch) {
      currentStepName = nameMatch[1].trim()
      continue
    }
    if (currentStepName && /continue-on-error:\s*true/.test(line)) {
      masked.add(currentStepName)
    }
  }
  return masked
}

/** The durable, human-readable record produced after a RuleExecution (GOVERNANCE_OBJECT_MODEL.md's
 *  Report entry) -- today, console output only; this is that entry's designed extension into a
 *  durable, queryable log (GOVERNANCE_ENGINE_RUNTIME.md §6). Append-only once written, mirroring
 *  MILESTONE_HISTORY.md's own "archive, never overwrite" discipline -- reused here, not reinvented. */
export interface Report {
  readonly sourceId: string
  readonly content: string
  readonly createdAt: string
}

/** Appends one Report entry to a durable Markdown log, creating it (with a one-time header) on
 *  first use. Never overwrites an existing entry -- always appends, matching Report's own
 *  immutability rule (Object Model: "a Report entry, once written, is never edited"). The log
 *  starts empty and grows only from real executions -- no historical data is ever backfilled
 *  (Phase 3's own explicit scope boundary, GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md). */
export function writeReport(
  root: string,
  report: Report,
  logRelativePath = 'PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REVIEW_LOG.md',
): void {
  const logPath = join(root, ...logRelativePath.split('/'))
  const header = existsSync(logPath)
    ? ''
    : '# Review Log\n\nAppend-only. One entry per RuleExecution -- never edited after being ' +
      'written, only superseded by a later entry (GOVERNANCE_OBJECT_MODEL.md\'s Report entry).\n\n'
  const entry = `## ${report.sourceId}\n\n_${report.createdAt}_\n\n${report.content}\n\n---\n\n`
  writeFileSync(logPath, header + entry, { flag: 'a' })
}

/** Generic bounded-poll primitive: calls fn() repeatedly, waiting intervalMs between attempts,
 *  until it reports done or maxAttempts is exhausted (returning null in that case). Extracted
 *  from pollWorkflowRun's own retry-loop shape -- named in GOVERNANCE_ENGINE_RUNTIME.md's
 *  extraction table as reusable by any rule waiting on an async external result (e.g. a future
 *  REVIEW-2 rerun-and-compare flow, designed, not yet implemented). The GitHub-Actions-specific
 *  interpretation inside each attempt stays in verifyPushState.ts's own pollWorkflowRun -- only
 *  the attempt/interval/max-attempts loop shape is generic. */
export async function pollUntil<T>(
  fn: (attempt: number, maxAttempts: number) => Promise<{ done: true; value: T } | { done: false }>,
  { intervalMs = 15000, maxAttempts = 40 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn(attempt, maxAttempts)
    if (result.done) return result.value
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  return null
}
