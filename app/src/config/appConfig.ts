// ── Application Config — Phase X.9.1, extended X.9.2, extended X.9.3 ──────────
// Server-level configuration only (port/host/env/log level+format/shutdown timeout).
// Deliberately separate from src/providers/env.ts (frozen, LLM-provider-API-key loading only) —
// no overlap, no duplication: this file has never read OPENAI_API_KEY/ANTHROPIC_API_KEY/
// GEMINI_API_KEY and never will, since Phase X's reasoning path is LLM-free by design
// (REJECTED_DESIGNS.md's "Rejected: Multi-LLM-Agent Conversations"). Never throws — same
// never-throw Result<T,E> discipline used throughout src/reasoning/src/mcp/src/multiagent,
// applied here for consistency, not because any frozen file is imported.
//
// X.9.2 addition: logFormat ('json'|'pretty'), consumed by src/logging/structuredLogger.ts.
// X.9.3 addition: streamTimeoutMs, consumed by src/http/reasoningStreamRoute.ts's
// raceSignalAndTimeout() bound on each SSE stage. src/config/ is an explicitly allowed
// directory for both X.9.2 and X.9.3 — these extensions are authorized, not frozen-file
// violations.
//
// X.16 Step 2 addition: credentialSigningSecret, per X16_PROTOCOL_DECISION.md (Option A --
// stdlib-only HMAC bearer token). Loaded via CREDENTIAL_SIGNING_SECRET, optional (undefined if
// unset -- matching this project's "never throws" discipline and letting every existing
// caller/test that builds a server without this variable keep working unchanged). A non-empty
// value shorter than MIN_SECRET_LENGTH is rejected rather than silently accepted, since this
// value is the entire security boundary for the credential-token design (see that decision
// document's Security Considerations).

export type NodeEnv = 'development' | 'production' | 'test'
export type LogFormat = 'json' | 'pretty'

const MIN_SECRET_LENGTH = 32

export interface AppConfig {
  readonly port: number
  readonly host: string
  readonly nodeEnv: NodeEnv
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error'
  readonly logFormat: LogFormat
  readonly shutdownTimeoutMs: number
  readonly streamTimeoutMs: number
  readonly credentialSigningSecret: string | undefined
}

export type AppConfigErrorCode =
  | 'INVALID_PORT' | 'INVALID_NODE_ENV' | 'INVALID_LOG_LEVEL' | 'INVALID_LOG_FORMAT'
  | 'INVALID_SHUTDOWN_TIMEOUT' | 'INVALID_STREAM_TIMEOUT' | 'INVALID_CREDENTIAL_SIGNING_SECRET'

export interface AppConfigError {
  readonly code: AppConfigErrorCode
  readonly message: string
}

export type AppConfigResult =
  | { readonly ok: true; readonly value: AppConfig }
  | { readonly ok: false; readonly error: AppConfigError }

const VALID_NODE_ENVS = new Set<NodeEnv>(['development', 'production', 'test'])
const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])
const VALID_LOG_FORMATS = new Set<LogFormat>(['json', 'pretty'])

const DEFAULTS = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'development' as NodeEnv,
  logLevel: 'info' as const,
  logFormat: 'json' as const,
  shutdownTimeoutMs: 10_000,
  streamTimeoutMs: 30_000,
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

  const logFormatRaw = env['LOG_FORMAT']?.trim()
  let logFormat: LogFormat = DEFAULTS.logFormat
  if (logFormatRaw !== undefined && logFormatRaw !== '') {
    if (!VALID_LOG_FORMATS.has(logFormatRaw as LogFormat)) {
      return { ok: false, error: { code: 'INVALID_LOG_FORMAT', message: `LOG_FORMAT must be one of json|pretty; received: '${logFormatRaw}'.` } }
    }
    logFormat = logFormatRaw as LogFormat
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

  const streamTimeoutRaw = env['STREAM_TIMEOUT_MS']?.trim()
  let streamTimeoutMs = DEFAULTS.streamTimeoutMs
  if (streamTimeoutRaw !== undefined && streamTimeoutRaw !== '') {
    const parsed = Number(streamTimeoutRaw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: { code: 'INVALID_STREAM_TIMEOUT', message: `STREAM_TIMEOUT_MS must be a positive integer; received: '${streamTimeoutRaw}'.` } }
    }
    streamTimeoutMs = parsed
  }

  const credentialSigningSecretRaw = env['CREDENTIAL_SIGNING_SECRET']?.trim()
  let credentialSigningSecret: string | undefined
  if (credentialSigningSecretRaw !== undefined && credentialSigningSecretRaw !== '') {
    if (credentialSigningSecretRaw.length < MIN_SECRET_LENGTH) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIAL_SIGNING_SECRET',
          message: `CREDENTIAL_SIGNING_SECRET must be at least ${MIN_SECRET_LENGTH} characters; received length ${credentialSigningSecretRaw.length}.`,
        },
      }
    }
    credentialSigningSecret = credentialSigningSecretRaw
  }

  return { ok: true, value: { port, host, nodeEnv, logLevel, logFormat, shutdownTimeoutMs, streamTimeoutMs, credentialSigningSecret } }
}
