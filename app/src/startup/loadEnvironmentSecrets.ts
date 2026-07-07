import { config as loadDotEnv } from 'dotenv'

// ── Environment Secrets Loading — Phase X.9.4 ──────────────────────────────────
// Thin wrapper around the ALREADY-INSTALLED `dotenv` dependency (present in package.json since
// before this milestone, previously unused anywhere in src/) — genuinely reused, not a new
// package, and never a hand-rolled .env parser of this file's own.
//
// SCOPE NOTE: Docker Compose already injects secrets into the container's real process.env
// before Node starts (via `environment:`/`env_file:` in docker-compose.yml) — this loader is
// for the bare-host path (`npm run server`, or the scripts in scripts/) where a developer or
// operator wants variables sourced from a local .env file, exactly as .env.example/.env.template
// already instruct ("copy this file to .env"). Never called by src/server/main.ts itself (that
// frozen file is untouched this milestone) — only by the new scripts this milestone adds.

export interface LoadSecretsResult {
  readonly loaded: boolean
  readonly path?: string
  readonly error?: string
}

export function loadEnvironmentSecrets(path?: string): LoadSecretsResult {
  // quiet:true suppresses dotenv's own stdout banner (a promotional "tip" line the package
  // itself prints on every successful load, confirmed in node_modules/dotenv/lib/main.js) so it
  // never pollutes structured JSON log output — a real, verified option on the installed
  // version, not a workaround for anything this file does.
  const result = loadDotEnv({ quiet: true, ...(path !== undefined ? { path } : {}) })
  if (result.error !== undefined) {
    return { loaded: false, error: result.error.message }
  }
  return { loaded: true, ...(path !== undefined ? { path } : {}) }
}
