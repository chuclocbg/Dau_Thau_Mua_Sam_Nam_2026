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
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function repoRoot(): string {
  return sh('git rev-parse --show-toplevel')
}

function currentBranch(): string {
  return sh('git rev-parse --abbrev-ref HEAD')
}

function ownerRepoFromRemote(): { owner: string; repo: string } {
  const url = sh('git remote get-url origin')
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/)
  if (!match) throw new Error(`Could not parse owner/repo from origin remote: ${url}`)
  const [, owner, repo] = match
  return { owner, repo }
}

interface CheckResult {
  readonly name: string
  readonly ok: boolean
  readonly detail: string
}

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

/** Cross-references the workflow file for step names carrying `continue-on-error: true`, so a
 *  reported API "success" can be flagged as masked rather than taken at face value. */
function findMaskedStepNames(root: string): Set<string> {
  const workflowPath = join(root, '.github', 'workflows', 'ci.yml')
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

async function pollWorkflowRun(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  { intervalMs = 15000, maxAttempts = 40 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<CheckResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const runsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?branch=${branch}&per_page=5`,
    )
    if (!runsRes.ok) {
      return { name: 'CI result', ok: false, detail: `GitHub API error: ${runsRes.status} ${runsRes.statusText}` }
    }
    const runsBody = (await runsRes.json()) as { workflow_runs: Array<{ id: number; head_sha: string; status: string; conclusion: string | null; html_url: string }> }
    const run = runsBody.workflow_runs.find(r => r.head_sha === sha)
    if (!run) {
      console.log(`[verifyPushState] no run found yet for ${sha}, waiting... (attempt ${attempt}/${maxAttempts})`)
    } else if (run.status !== 'completed') {
      console.log(`[verifyPushState] run ${run.id} status=${run.status}, waiting... (attempt ${attempt}/${maxAttempts})`)
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
        return { name: 'CI result', ok: false, detail: detailLines.join('\n') }
      }
      if (maskedSuccesses.length > 0) {
        detailLines.push(`\nNote: ${maskedSuccesses.length} step(s) report success only via continue-on-error masking (${maskedSuccesses.map(s => s.name).join(', ')}). Verify locally if certainty matters.`)
      }
      return { name: 'CI result', ok: run.conclusion === 'success', detail: detailLines.join('\n') }
    }
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  return { name: 'CI result', ok: false, detail: `Timed out after ${maxAttempts} polling attempts` }
}

async function main() {
  const branch = currentBranch()
  const { owner, repo } = ownerRepoFromRemote()
  const head = sh('git rev-parse HEAD')

  const results: CheckResult[] = [
    checkHeadMatchesOrigin(branch),
    checkWorkingTreeClean(),
  ]

  console.log(`\n=== verifyPushState: ${owner}/${repo}@${branch} (${head}) ===\n`)
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} -- ${r.name}\n  ${r.detail.replace(/\n/g, '\n  ')}\n`)
  }

  console.log('Polling GitHub Actions for the current commit...')
  const ciResult = await pollWorkflowRun(owner, repo, branch, head)
  console.log(`${ciResult.ok ? 'PASS' : 'FAIL'} -- ${ciResult.name}\n  ${ciResult.detail.replace(/\n/g, '\n  ')}\n`)
  results.push(ciResult)

  const allOk = results.every(r => r.ok)
  console.log(`=== VERDICT: ${allOk ? 'ALL CHECKS PASSED' : 'FAILED -- see above'} ===\n`)
  process.exit(allOk ? 0 : 1)
}

main().catch(err => {
  console.error('[verifyPushState] error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
