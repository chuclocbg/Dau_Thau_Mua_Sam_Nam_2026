// ── Structured Logger — Phase X.9.2 ────────────────────────────────────────────
// Writes structured, level-filtered log lines to stdout (JSON or pretty), with a .child()
// method for request-scoped context (requestId/correlationId/traceId) — the standard
// production pattern of "let the container runtime/log aggregator capture stdout."
//
// TRANSPARENCY NOTE on why src/providers/Logger.ts (pre-existing, frozen, P6-11A) is NOT reused:
// it is an in-memory, query-later log STORE with zero output sink (no stdout, no file, no
// aggregator hook) — genuinely a different concern from "emit structured lines for a real
// production process to be captured by its environment." Its shape (level/message/metadata,
// level filtering via minLevel) is mirrored here deliberately (level names, filtering
// semantics) because that convention is already proven in this codebase, but its
// store-and-query implementation is not reusable for this milestone's actual need.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export interface StructuredLogger {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  child(bindings: LogFields): StructuredLogger
}

export type LogFormat = 'json' | 'pretty'

export interface StructuredLoggerOptions {
  readonly level: LogLevel
  readonly format: LogFormat
  readonly write?: (line: string) => void
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function defaultWrite(line: string): void {
  process.stdout.write(line)
}

function formatPretty(entry: Record<string, unknown>): string {
  const { timestamp, level, message, ...rest } = entry
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  return `[${String(timestamp)}] ${String(level).toUpperCase()}: ${String(message)}${extra}`
}

class StructuredLoggerImpl implements StructuredLogger {
  private readonly options: StructuredLoggerOptions
  private readonly bindings: LogFields

  constructor(options: StructuredLoggerOptions, bindings: LogFields = {}) {
    this.options = options
    this.bindings = bindings
  }

  private emit(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.options.level]) return
    const entry = { timestamp: new Date().toISOString(), level, message, ...this.bindings, ...fields }
    const line = this.options.format === 'json' ? JSON.stringify(entry) : formatPretty(entry)
    ;(this.options.write ?? defaultWrite)(`${line}\n`)
  }

  debug(message: string, fields?: LogFields): void { this.emit('debug', message, fields) }
  info(message: string, fields?: LogFields): void { this.emit('info', message, fields) }
  warn(message: string, fields?: LogFields): void { this.emit('warn', message, fields) }
  error(message: string, fields?: LogFields): void { this.emit('error', message, fields) }

  child(bindings: LogFields): StructuredLogger {
    return new StructuredLoggerImpl(this.options, { ...this.bindings, ...bindings })
  }
}

export function createStructuredLogger(options: StructuredLoggerOptions): StructuredLogger {
  return new StructuredLoggerImpl(options)
}
