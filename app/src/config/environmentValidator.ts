import { loadAppConfigFromEnv } from './appConfig.ts'
import type { AppConfig, AppConfigError } from './appConfig.ts'
import { resolveProfile, applyProfileDefaults } from './configProfiles.ts'
import type { ConfigProfile } from './configProfiles.ts'

// ── Environment Validator — Phase X.9.4 ────────────────────────────────────────
// Genuinely reuses the existing, frozen loadAppConfigFromEnv() (X.9.1) — this file adds zero
// parsing/validation logic of its own beyond selecting profile-aware defaults
// (configProfiles.ts) before delegating. "Environment validation" here means: resolve the
// active profile, apply its defaults, run them through the one real parser, and report the
// outcome in a form scripts/CI/operators can act on — never a second implementation of PORT/
// NODE_ENV/LOG_LEVEL/etc. rules.

export type EnvironmentValidationResult =
  | { readonly ok: true; readonly profile: ConfigProfile; readonly config: AppConfig }
  | { readonly ok: false; readonly profile: ConfigProfile; readonly error: AppConfigError }

export function validateEnvironment(
  env: Record<string, string | undefined> = process.env,
): EnvironmentValidationResult {
  const profile = resolveProfile(env['NODE_ENV'])
  const effectiveEnv = applyProfileDefaults(profile, env)
  const result = loadAppConfigFromEnv(effectiveEnv)

  if (!result.ok) {
    return { ok: false, profile, error: result.error }
  }
  return { ok: true, profile, config: result.value }
}

export function formatEnvironmentReport(result: EnvironmentValidationResult): string {
  if (!result.ok) {
    return `Environment validation FAILED (profile: ${result.profile})\n  [${result.error.code}] ${result.error.message}`
  }
  const c = result.config
  return [
    `Environment validation OK (profile: ${result.profile})`,
    `  port=${c.port} host=${c.host} nodeEnv=${c.nodeEnv}`,
    `  logLevel=${c.logLevel} logFormat=${c.logFormat}`,
    `  shutdownTimeoutMs=${c.shutdownTimeoutMs} streamTimeoutMs=${c.streamTimeoutMs}`,
  ].join('\n')
}
