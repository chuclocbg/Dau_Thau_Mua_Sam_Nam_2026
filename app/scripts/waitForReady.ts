import { waitForReady } from '../src/startup/waitForReady.ts'

// ── Startup Verification CLI — Phase X.9.5 ─────────────────────────────────────
// npx tsx scripts/waitForReady.ts [url] — polls the given URL (default: local /ready) until it
// responds 2xx or the retry budget is exhausted. Used by deployment/deploy.sh and
// deployment/rollback.sh right after starting/restarting the app container, and standalone by
// an operator confirming a deploy actually came up.

const url = process.argv[2] ?? process.env['WAIT_FOR_READY_URL'] ?? 'http://localhost:3000/ready'
const maxAttempts = Number(process.env['WAIT_FOR_READY_MAX_ATTEMPTS'] ?? 30)
const retryDelayMs = Number(process.env['WAIT_FOR_READY_DELAY_MS'] ?? 2000)

const result = await waitForReady(url, { retry: { maxAttempts, retryDelayMs } })

if (result.ready) {
  process.stdout.write(`[wait-for-ready] READY after ${result.attempts} attempt(s): ${url}\n`)
  process.exitCode = 0
} else {
  const status = result.lastStatus !== undefined ? ` [last status ${result.lastStatus}]` : ''
  const error = result.lastError !== undefined ? ` (${result.lastError})` : ''
  process.stderr.write(`[wait-for-ready] NOT READY after ${result.attempts} attempt(s): ${url}${status}${error}\n`)
  process.exitCode = 1
}
