import { loadEnvironmentSecrets } from '../src/startup/loadEnvironmentSecrets.ts'
import { validateEnvironment, formatEnvironmentReport } from '../src/config/environmentValidator.ts'
import { buildConfigDiagnostics, formatConfigDiagnostics } from '../src/startup/configDiagnostics.ts'

// ── Configuration Diagnostics / Environment Validation CLI — Phase X.9.4 ──────
// Standalone script (run via `npx tsx scripts/validateEnvironment.ts`), not wired into
// package.json — package.json is left untouched this milestone since a direct tsx invocation
// works without a script alias. Loads .env (if present), validates the environment for the
// active profile, prints a diagnostics report, and exits 0/1 — usable both by a human operator
// and as the pre-flight check inside scripts/start-prod.sh / scripts/start-dev.sh.

loadEnvironmentSecrets()
const result = validateEnvironment()

process.stdout.write(`${formatEnvironmentReport(result)}\n`)
if (result.ok) {
  process.stdout.write(`${formatConfigDiagnostics(buildConfigDiagnostics(result.config, result.profile))}\n`)
}

process.exitCode = result.ok ? 0 : 1
