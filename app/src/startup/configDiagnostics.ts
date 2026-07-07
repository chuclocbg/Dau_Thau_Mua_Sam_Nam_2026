import type { AppConfig } from '../config/appConfig.ts'
import type { ConfigProfile } from '../config/configProfiles.ts'

// ── Configuration Diagnostics — Phase X.9.4 ────────────────────────────────────
// A redacted, human-readable summary of the effective runtime configuration, for operators to
// confirm what a deployment actually picked up (via scripts/validate-environment.ts) without
// starting the server. AppConfig carries no secret-shaped fields today, but REDACTED_KEYS exists
// so a future field named like a credential is defensively masked rather than silently printed.

const REDACTED_KEYS = new Set(['apiKey', 'password', 'secret', 'token'])

export interface ConfigDiagnosticsReport {
  readonly profile: ConfigProfile
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value: string }>
}

export function buildConfigDiagnostics(config: AppConfig, profile: ConfigProfile): ConfigDiagnosticsReport {
  const fields = Object.entries(config).map(([key, value]) => ({
    key,
    value: isRedactedKey(key) ? '***REDACTED***' : String(value),
  }))
  return { profile, fields }
}

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase()
  for (const redacted of REDACTED_KEYS) {
    if (lower.includes(redacted.toLowerCase())) return true
  }
  return false
}

export function formatConfigDiagnostics(report: ConfigDiagnosticsReport): string {
  const lines = [`Effective configuration (profile: ${report.profile}):`]
  for (const field of report.fields) {
    lines.push(`  ${field.key} = ${field.value}`)
  }
  return lines.join('\n')
}
