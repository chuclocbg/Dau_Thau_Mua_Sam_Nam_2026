// ── Configuration Profiles — Phase X.9.4 ───────────────────────────────────────
// Environment-variable overlay, not a second config parser: applyProfileDefaults() only fills
// in profile-appropriate STRING defaults for env vars the caller has not already set, then the
// existing, unmodified loadAppConfigFromEnv() (src/config/appConfig.ts, frozen since X.9.1)
// parses/validates the resulting env map exactly as it always has. This file never duplicates
// PORT/NODE_ENV/LOG_LEVEL/etc. validation — it only decides what a given profile's *defaults*
// should be before that validation runs, and an explicit env var always wins over a profile
// default.

export type ConfigProfile = 'development' | 'production' | 'test'

const PROFILE_DEFAULTS: Record<ConfigProfile, Record<string, string>> = {
  development: { LOG_LEVEL: 'debug', LOG_FORMAT: 'pretty' },
  production: { LOG_LEVEL: 'info', LOG_FORMAT: 'json' },
  test: { LOG_LEVEL: 'error', LOG_FORMAT: 'json' },
}

export function resolveProfile(nodeEnv: string | undefined): ConfigProfile {
  if (nodeEnv === 'production' || nodeEnv === 'test') return nodeEnv
  return 'development'
}

/**
 * Returns a new env map: profile defaults filled in only for keys absent (or blank) in `env`.
 * Every key already present and non-blank in `env` is returned unchanged.
 */
export function applyProfileDefaults(
  profile: ConfigProfile, env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const defaults = PROFILE_DEFAULTS[profile]
  const result: Record<string, string | undefined> = { ...env }
  for (const [key, value] of Object.entries(defaults)) {
    if (result[key] === undefined || result[key]!.trim() === '') {
      result[key] = value
    }
  }
  return result
}
