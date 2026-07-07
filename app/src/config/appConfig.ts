// ── Application Config — Phase X.9.1 ───────────────────────────────────────────
// Server-level configuration only (port/host/env/log level/shutdown timeout). Deliberately
// separate from src/providers/env.ts (frozen, LLM-provider-API-key loading only) — no overlap,
// no duplication: this file has never read OPENAI_API_KEY/ANTHROPIC_API_KEY/GEMINI_API_KEY and
// never will, since Phase X's reasoning path is LLM-free by design (REJECTED_DESIGNS.md's
// "Rejected: Multi-LLM-Agent Conversations"). Never throws — same never-throw Result<T,E>
// discipline used throughout src/reasoning/src/mcp/src/multiagent, applied here for consistency,
// not because any frozen file is imported.

export type NodeEnv = 'development' | 'production' | 'test'

export interface AppConfig {
  readonly port: number
  readonly host: string
  readonly nodeEnv: NodeEnv
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error'
  readonly shutdownTimeoutMs: number
}

export type AppConfigErrorCode = 'INVALID_PORT' | 'INVALID_NODE_ENV' | 'INVALID_LOG_LEVEL' | 'INVALID_SHUTDOWN_TIMEOUT'

export interface AppConfigError {
  readonly code: AppConfigErrorCode
  readonly message: string
}

export type AppConfigResult =
  | { readonly ok: true; readonly value: AppConfig }
  | { readonly ok: false; readonly error: AppConfigError }

const VALID_NODE_ENVS = new Set<NodeEnv>(['development', 'production', 'test'])
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])

const DEFAULTS = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'development' as NodeEnv,
  logLevel: 'info' as const,
  shutdownTimeoutMs: 10_000,
}

export function loadAppConfigFromEnv(env: Record<string, string | undefined> = process.env): AppConfigResult {
  const portRaw = env['PORT']?.trim()
  let port = DEFAULTS.port
  if (portRaw !== undefined && portRaw !== '') {
    const parsed = Number(portRaw)
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      return { ok: false, error: { code: 'INVALID_PORT', message: `PORT must be an integer in 1-65535; received: '${portRaw}'.` } }
    }
    port = parsed
  }

  const host = env['HOST']?.trim() || DEFAULTS.host

  const nodeEnvRaw = env['NODE_ENV']?.trim()
  let nodeEnv = DEFAULTS.nodeEnv
  if (nodeEnvRaw !== undefined && nodeEnvRaw !== '') {
    if (!VALID_NODE_ENVS.has(nodeEnvRaw as NodeEnv)) {
      return { ok: false, error: { code: 'INVALID_NODE_ENV', message: `NODE_ENV must be one of development|production|test; received: '${nodeEnvRaw}'.` } }
    }
    nodeEnv = nodeEnvRaw as NodeEnv
  }

  const logLevelRaw = env['LOG_LEVEL']?.trim()
  let logLevel: AppConfig['logLevel'] = DEFAULTS.logLevel
  if (logLevelRaw !== undefined && logLevelRaw !== '') {
    if (!VALID_LOG_LEVELS.has(logLevelRaw)) {
      return { ok: false, error: { code: 'INVALID_LOG_LEVEL', message: `LOG_LEVEL must be one of debug|info|warn|error; received: '${logLevelRaw}'.` } }
    }
    logLevel = logLevelRaw as AppConfig['logLevel']
  }

  const shutdownRaw = env['SHUTDOWN_TIMEOUT_MS']?.trim()
  let shutdownTimeoutMs = DEFAULTS.shutdownTimeoutMs
  if (shutdownRaw !== undefined && shutdownRaw !== '') {
    const parsed = Number(shutdownRaw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: { code: 'INVALID_SHUTDOWN_TIMEOUT', message: `SHUTDOWN_TIMEOUT_MS must be a positive integer; received: '${shutdownRaw}'.` } }
    }
    shutdownTimeoutMs = parsed
  }

  return { ok: true, value: { port, host, nodeEnv, logLevel, shutdownTimeoutMs } }
}
