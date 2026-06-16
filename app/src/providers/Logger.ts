/**
 * P6-11A: Logger — structured in-process log store.
 *
 * Supports four log levels (debug | info | warn | error).
 * Every entry captures the level, message, timestamp (Date.now()),
 * and an optional metadata bag.
 *
 * Public API:
 *   log(level, message, metadata?)  — add an entry at an explicit level
 *   debug(message, metadata?)       — convenience: log at 'debug'
 *   info(message, metadata?)        — convenience: log at 'info'
 *   warn(message, metadata?)        — convenience: log at 'warn'
 *   error(message, metadata?)       — convenience: log at 'error'
 *   listLogs()                      — all entries in insertion order (defensive copies)
 *   listByLevel(level)              — entries for one level (defensive copies)
 *   clear()                         — remove all entries; never fails
 *   count                           — current number of stored entries
 *
 * Constructor options:
 *   maxEntries  — rolling cap; oldest entries are dropped when exceeded
 *   minLevel    — entries below this level are silently discarded
 *
 * Error codes:
 *   INVALID_LEVEL   — log() called with an unrecognised level string
 *   INVALID_INPUT   — message is empty, whitespace-only, or not a string
 *   LOG_ERROR       — catch-all for unexpected failures
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — log() returns { ok: false, error } on bad input.
 *   - Defensive copies: every read path clones entries so mutations
 *     by the caller cannot corrupt stored state.
 *   - listLogs() and listByLevel() never fail; clear() never fails.
 *   - SSR-compatible: no browser APIs; Date.now() is the only external
 *     call and is available in all JavaScript runtimes.
 *   - Metadata is shallow-cloned at write time and again at read time.
 */

// ─── Log level ────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

const VALID_LEVELS: ReadonlySet<string> = new Set<LogLevel>([
  'debug', 'info', 'warn', 'error',
]);

// ─── LogEntry ─────────────────────────────────────────────────────────────────

export interface LogEntry {
  /** Auto-incremented integer; stable insertion-order key. */
  id:         number;
  /** Severity level. */
  level:      LogLevel;
  /** Human-readable log message. */
  message:    string;
  /** Unix-ms timestamp captured at log() call time. */
  timestamp:  number;
  /** Optional structured metadata; shallow-cloned on write and read. */
  metadata?:  Record<string, unknown>;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface LoggerOptions {
  /**
   * Rolling capacity.  When the store exceeds this limit the oldest
   * entries are dropped to keep the size at maxEntries.
   * Ignored when ≤ 0 or not a finite integer.
   */
  maxEntries?: number;
  /**
   * Minimum level to store.  Entries below this level are silently
   * discarded rather than returning an error.
   */
  minLevel?: LogLevel;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type LoggerErrorCode =
  | 'INVALID_LEVEL'   // unrecognised level string
  | 'INVALID_INPUT'   // empty / whitespace-only / non-string message
  | 'LOG_ERROR';      // catch-all for unexpected failures

export interface LoggerError {
  code:    LoggerErrorCode;
  message: string;
}

export type LoggerResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: LoggerError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function logErr(code: LoggerErrorCode, message: string): LoggerResult<never> {
  return { ok: false, error: { code, message } };
}

function cloneEntry(e: LogEntry): LogEntry {
  return {
    id:        e.id,
    level:     e.level,
    message:   e.message,
    timestamp: e.timestamp,
    ...(e.metadata !== undefined ? { metadata: { ...e.metadata } } : {}),
  };
}

function safeMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (meta === null || meta === undefined) return undefined;
  if (typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  return { ...meta };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export class Logger {
  private readonly entries: LogEntry[] = [];
  private          seq     = 0;
  private readonly maxEntries: number;
  private readonly minRank:    number;

  constructor(options: LoggerOptions = {}) {
    const rawMax = options.maxEntries;
    this.maxEntries =
      typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax > 0
        ? Math.floor(rawMax)
        : Infinity;

    const minLvl = options.minLevel;
    this.minRank = VALID_LEVELS.has(minLvl ?? '')
      ? LEVEL_RANK[minLvl as LogLevel]
      : 0;
  }

  /**
   * Stores a log entry at the given level.
   *
   * Returns INVALID_LEVEL when level is not one of debug|info|warn|error.
   * Returns INVALID_INPUT when message is not a non-empty string.
   * Silently discards entries below minLevel (returns ok:true with the
   * entry that would have been stored, with id: -1 as a sentinel).
   */
  log(
    level:    LogLevel | string,
    message:  string,
    metadata?: Record<string, unknown>,
  ): LoggerResult<LogEntry> {
    // Validate level
    if (typeof level !== 'string' || !VALID_LEVELS.has(level)) {
      return logErr('INVALID_LEVEL',
        `Unknown log level: ${String(level)}. Must be debug|info|warn|error.`);
    }

    // Validate message
    if (typeof message !== 'string' || message.trim() === '') {
      return logErr('INVALID_INPUT',
        'Log message must be a non-empty, non-whitespace string.');
    }

    // Apply minLevel filter — return synthetic entry rather than error
    if (LEVEL_RANK[level as LogLevel] < this.minRank) {
      const filtered: LogEntry = {
        id:        -1,
        level:     level as LogLevel,
        message,
        timestamp: Date.now(),
        ...( safeMetadata(metadata) !== undefined
          ? { metadata: safeMetadata(metadata) }
          : {} ),
      };
      return { ok: true, value: filtered };
    }

    const entry: LogEntry = {
      id:        ++this.seq,
      level:     level as LogLevel,
      message,
      timestamp: Date.now(),
      ...( safeMetadata(metadata) !== undefined
        ? { metadata: safeMetadata(metadata) }
        : {} ),
    };

    this.entries.push(entry);

    // Enforce rolling cap
    if (
      Number.isFinite(this.maxEntries) &&
      this.entries.length > this.maxEntries
    ) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }

    return { ok: true, value: cloneEntry(entry) };
  }

  /** Convenience: log at 'debug' level. */
  debug(message: string, metadata?: Record<string, unknown>): LoggerResult<LogEntry> {
    return this.log('debug', message, metadata);
  }

  /** Convenience: log at 'info' level. */
  info(message: string, metadata?: Record<string, unknown>): LoggerResult<LogEntry> {
    return this.log('info', message, metadata);
  }

  /** Convenience: log at 'warn' level. */
  warn(message: string, metadata?: Record<string, unknown>): LoggerResult<LogEntry> {
    return this.log('warn', message, metadata);
  }

  /** Convenience: log at 'error' level. */
  error(message: string, metadata?: Record<string, unknown>): LoggerResult<LogEntry> {
    return this.log('error', message, metadata);
  }

  /**
   * Returns defensive copies of all entries in insertion order.
   * Never fails; returns [] when the store is empty.
   */
  listLogs(): LogEntry[] {
    return this.entries.map(cloneEntry);
  }

  /**
   * Returns defensive copies of entries matching the given level in
   * insertion order.  Returns [] for unknown levels; never fails.
   */
  listByLevel(level: LogLevel | string): LogEntry[] {
    if (!VALID_LEVELS.has(level as string)) return [];
    return this.entries
      .filter(e => e.level === level)
      .map(cloneEntry);
  }

  /**
   * Removes all stored entries.  Resets the id counter.
   * Never fails.
   */
  clear(): void {
    this.entries.length = 0;
    this.seq = 0;
  }

  /** Number of entries currently in the store. */
  get count(): number {
    return this.entries.length;
  }
}
