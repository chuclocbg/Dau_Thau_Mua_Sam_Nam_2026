import { runSmokeChecks, allChecksPassed, formatSmokeCheckReport } from '../src/startup/smokeChecks.ts'

// ── Smoke Test CLI — Phase X.9.5 ────────────────────────────────────────────────
// npx tsx scripts/smokeTest.ts [baseUrl] — exercises a real, running deployment's health and
// reasoning/streaming endpoints from outside (black-box, over real HTTP), reporting pass/fail
// per check. Used by deployment/deploy.sh and deployment/rollback.sh after a deploy, and
// standalone against any environment (local/staging/production) by URL.

const baseUrl = process.argv[2] ?? process.env['SMOKE_TEST_URL'] ?? 'http://localhost:3000'

process.stdout.write(`[smoke-test] running against ${baseUrl}...\n`)
const results = await runSmokeChecks(baseUrl)
process.stdout.write(`${formatSmokeCheckReport(results)}\n`)

process.exitCode = allChecksPassed(results) ? 0 : 1
