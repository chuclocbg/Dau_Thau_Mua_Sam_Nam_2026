#!/usr/bin/env -S npx tsx
/**
 * Governance Engine, rule REVIEW-3 (GOVERNANCE_ENGINE_DESIGN.md) -- post-push verification.
 *
 * Replaces the manual sequence run by hand after every push across X.16-X.20.1:
 *   1. HEAD == origin/<branch>?
 *   2. working tree clean (ignoring untracked files -- pre-existing foreign files are expected)?
 *   3. poll the GitHub Actions run for HEAD until it completes, then report per-step results.
 *
 * Step 3's one honest limitation, stated rather than hidden: the public Actions API reports a
 * step's *post-override* conclusion. A step with `continue-on-error: true` in the workflow file
 * always reports "success" via the API even when the underlying command actually failed (see
 * X.19's Type-check step). This script cannot resolve that ambiguity from the API alone -- doing
 * so would require either a repo-admin-scoped log download (unavailable) or reproducing the
 * command locally (out of scope for a read-only check). Instead it cross-references the workflow
 * file to flag exactly which "success" results are masked and therefore not guaranteed genuine,
 * which is the same judgment call made by hand throughout this session.
 *
 * Zero new dependencies: git via child_process, GitHub API via Node's built-in fetch (Node 18+).
 * Owner/repo/branch are derived from the actual repository, not hardcoded, so this script is a
 * reusable artifact, not a Dau_Thau_Mua_Sam_Nam_2026-specific one.
 *
 * Phase 1 (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md): the environment-detection helpers,
 * the CheckResult shape, the print format, the masked-step lookup, and the generic poll loop
 * shape now live in ./lib/governanceRuntime.ts, shared infrastructure extracted from this exact
 * file. checkHeadMatchesOrigin, checkWorkingTreeClean, and pollWorkflowRun's own GitHub-Actions
 * interpretation stay here -- they are this rule's own logic, not generic infrastructure.
 */

import {
  sh,
  repoRoot,
  currentBranch,
  ownerRepoFromRemote,
  findMaskedStepNames,
  pollUntil,
  printCheckResult,
  writeReport,
  writeSignalRecord,
  type CheckResult,
  type ExecutionContext,
  type RuleExecution,
  type Report,
  type SignalRecord,
} from './lib/governanceRuntime.ts'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function checkHeadMatchesOrigin(branch: string): CheckResult {
  const head = sh('git rev-parse HEAD')
  sh(`git fetch origin ${branch} --quiet`)
  const origin = sh(`git rev-parse origin/${branch}`)
  if (head === origin) {
    return { name: 'HEAD == origin', ok: true, detail: `${head} (in sync)` }
  }
  const ahead = sh(`git rev-list --count origin/${branch}..HEAD`)
  const behind = sh(`git rev-list --count HEAD..origin/${branch}`)
  return {
    name: 'HEAD == origin',
    ok: false,
    detail: `HEAD=${head} origin=${origin} -- local is ${ahead} ahead, ${behind} behind. Push or pull before proceeding.`,
  }
}

function checkWorkingTreeClean(): CheckResult {
  const status = sh('git status --porcelain')
  const trackedChanges = status
    .split('\n')
    .filter(line => line.length > 0 && !line.startsWith('??'))
  if (trackedChanges.length === 0) {
    return { name: 'Working tree clean (tracked files)', ok: true, detail: 'no uncommitted tracked changes' }
  }
  return {
    name: 'Working tree clean (tracked files)',
    ok: false,
    detail: `${trackedChanges.length} uncommitted tracked change(s):\n${trackedChanges.join('\n')}`,
  }
}

async function pollWorkflowRun(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  { intervalMs = 15000, maxAttempts = 40 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<CheckResult> {
  const result = await pollUntil<CheckResult>(
    async (attempt, attemptsTotal) => {
      const runsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?branch=${branch}&per_page=5`,
      )
      if (!runsRes.ok) {
        return { done: true, value: { name: 'CI result', ok: false, detail: `GitHub API error: ${runsRes.status} ${runsRes.statusText}` } }
      }
      const runsBody = (await runsRes.json()) as { workflow_runs: Array<{ id: number; head_sha: string; status: string; conclusion: string | null; html_url: string }> }
      const run = runsBody.workflow_runs.find(r => r.head_sha === sha)
      if (!run) {
        console.log(`[verifyPushState] no run found yet for ${sha}, waiting... (attempt ${attempt}/${attemptsTotal})`)
        return { done: false }
      } else if (run.status !== 'completed') {
        console.log(`[verifyPushState] run ${run.id} status=${run.status}, waiting... (attempt ${attempt}/${attemptsTotal})`)
        return { done: false }
      } else {
        const jobsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/jobs`)
        const jobsBody = (await jobsRes.json()) as { jobs: Array<{ steps: Array<{ name: string; conclusion: string | null }> }> }
        const masked = findMaskedStepNames(repoRoot())
        const steps = jobsBody.jobs.flatMap(j => j.steps)
        const maskedSuccesses = steps.filter(s => s.conclusion === 'success' && masked.has(s.name))
        const genuineFailures = steps.filter(s => s.conclusion === 'failure' && !masked.has(s.name))
        const detailLines = [
          `run ${run.id} (${run.html_url}): conclusion=${run.conclusion}`,
          ...steps.map(s => `  - ${s.name}: ${s.conclusion}${masked.has(s.name) ? '  [continue-on-error: "success" here is NOT a guarantee the underlying command passed]' : ''}`),
        ]
        if (genuineFailures.length > 0) {
          return { done: true, value: { name: 'CI result', ok: false, detail: detailLines.join('\n') } }
        }
        if (maskedSuccesses.length > 0) {
          detailLines.push(`\nNote: ${maskedSuccesses.length} step(s) report success only via continue-on-error masking (${maskedSuccesses.map(s => s.name).join(', ')}). Verify locally if certainty matters.`)
        }
        return { done: true, value: { name: 'CI result', ok: run.conclusion === 'success', detail: detailLines.join('\n') } }
      }
    },
    { intervalMs, maxAttempts },
  )
  return result ?? { name: 'CI result', ok: false, detail: `Timed out after ${maxAttempts} polling attempts` }
}

/** Runtime Contract Iteration 2 Slice 1 (SLICE1_PRE_IMPLEMENTATION_DISCLOSURE.md): reads the
 *  immediately preceding REVIEW_LOG.md entry's content for the given rule, if any, to compute
 *  the content-differed signal. Read-only -- REVIEW_LOG.md's own append-only writer (writeReport)
 *  is untouched by this function. Returns null if no prior entry exists yet. */
function readPreviousReviewLogEntryContent(root: string, ruleId: string): string | null {
  const logPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '04_PROJECT_MEMORY', 'REVIEW_LOG.md')
  if (!existsSync(logPath)) return null
  const text = readFileSync(logPath, 'utf8')
  const entries = text.split('\n---\n\n').filter(block => block.includes(`## ${ruleId}@`))
  if (entries.length === 0) return null
  const last = entries[entries.length - 1]
  const match = last.match(/\n\n_[^\n]*_\n\n([\s\S]*)$/)
  return match ? match[1] : null
}

async function main() {
  const branch = currentBranch()
  const { owner, repo } = ownerRepoFromRemote()
  const head = sh('git rev-parse HEAD')

  // Phase 2 (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md): construct an explicit RuleExecution
  // record instead of treating "the script ran" as an implicit, untracked event. Purely additive
  // -- does not replace or feed into any of the three checks below, whose own logic is unchanged.
  const executionContext: ExecutionContext = { repoRoot: repoRoot(), branch, owner, repo, headSha: head }
  const ruleExecution: RuleExecution = {
    ruleId: 'REVIEW-3',
    version: 1,
    // No signal exists today to distinguish which of REVIEW-3's declared execution_points
    // (command | dogfood) triggered this specific run -- both invoke the identical command
    // line. Disclosed limitation, not resolved here; out of Phase 2's stated scope.
    triggeredBy: 'command',
    timestamp: new Date().toISOString(),
    executionContext,
  }
  console.log(`[verifyPushState] RuleExecution constructed: ${ruleExecution.ruleId}@v${ruleExecution.version} triggeredBy=${ruleExecution.triggeredBy} at ${ruleExecution.timestamp}`)

  const results: CheckResult[] = [
    checkHeadMatchesOrigin(branch),
    checkWorkingTreeClean(),
  ]

  console.log(`\n=== verifyPushState: ${owner}/${repo}@${branch} (${head}) ===\n`)
  for (const r of results) {
    printCheckResult(r)
  }

  console.log('Polling GitHub Actions for the current commit...')
  const ciResult = await pollWorkflowRun(owner, repo, branch, head)
  printCheckResult(ciResult)
  results.push(ciResult)

  const allOk = results.every(r => r.ok)
  console.log(`=== VERDICT: ${allOk ? 'ALL CHECKS PASSED' : 'FAILED -- see above'} ===\n`)

  // Phase 3 (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md): append this RuleExecution's result
  // to a durable, queryable log -- not only printed to console. Purely additive; does not affect
  // any check's own verdict or the exit code below.
  const report: Report = {
    sourceId: `${ruleExecution.ruleId}@${ruleExecution.timestamp}`,
    content: [
      `**Verdict:** ${allOk ? 'ALL CHECKS PASSED' : 'FAILED'}`,
      '',
      ...results.map(r => `- ${r.ok ? 'PASS' : 'FAIL'} -- ${r.name}: ${r.detail.replace(/\n/g, ' ')}`),
    ].join('\n'),
    createdAt: ruleExecution.timestamp,
  }
  // Runtime Contract Iteration 2 Slice 1: capture the previous REVIEW_LOG.md entry's content
  // before this run's own writeReport() call appends a new one, so the comparison reflects prior
  // state, not this run's own entry.
  const previousReviewLogContent = readPreviousReviewLogEntryContent(executionContext.repoRoot, ruleExecution.ruleId)

  writeReport(executionContext.repoRoot, report)
  console.log(`[verifyPushState] Report appended to PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REVIEW_LOG.md`)

  // Runtime Contract Iteration 2 Slice 1 (SLICE1_PRE_IMPLEMENTATION_DISCLOSURE.md): compute and
  // record the three raw signals a future reportable-execution semantic decision could be
  // evaluated against (RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md). Purely additive -- never gates
  // writeReport() or any Check above, and chooses no semantic; see SLICE1_PRE_IMPLEMENTATION_
  // DISCLOSURE.md's Explicit non-goals.
  const signalRecord: SignalRecord = {
    sourceId: report.sourceId,
    triggeredBy: ruleExecution.triggeredBy,
    contentDifferedFromPrevious: previousReviewLogContent === null ? null : previousReviewLogContent !== report.content,
    explicitIntentFlagPresent: process.argv.includes('--explicit-intent'),
    createdAt: ruleExecution.timestamp,
  }
  writeSignalRecord(executionContext.repoRoot, signalRecord)
  console.log(`[verifyPushState] Signal record appended to PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REPORTABLE_EXECUTION_SIGNALS.md`)

  process.exit(allOk ? 0 : 1)
}

main().catch(err => {
  console.error('[verifyPushState] error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
