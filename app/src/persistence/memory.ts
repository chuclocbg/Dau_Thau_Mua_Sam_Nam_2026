/**
 * P6-08B: In-memory persistence implementations.
 *
 * Implements ISessionStore, ITraceStore, and IExportStore using plain Maps.
 * Every public method is async so that call sites are compatible with a future
 * IndexedDB (or server-side) backend without changing their signatures.
 *
 * Design rules:
 *   - Deep-clone on both save and load — callers cannot accidentally corrupt
 *     stored records by mutating the object they passed in or received back.
 *   - list*() methods always return newest-first (sorted by the record's
 *     primary timestamp field: savedAt / createdAt / exportedAt).
 *   - delete*() on an unknown key is a silent no-op (matches IndexedDB behaviour).
 *   - No migration logic — records are stored as-is and returned as-is.
 *     Migration belongs to P6-08C.
 *
 * IndexedDB compatibility notes:
 *   - All stored types are plain JSON objects (no class instances, no Date
 *     objects, no undefined values that would be stripped by structuredClone).
 *   - deepClone uses JSON round-trip rather than structuredClone so that the
 *     behaviour is identical in every runtime (Node.js, browser, worker).
 *   - Key spaces are flat strings (sessionId / traceId / snapshotId) matching
 *     what IndexedDB object store keyPath fields would look like.
 */

import type {
  ISessionStore,
  ITraceStore,
  IExportStore,
  IPersistenceLayer,
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
} from './schema';

// ─── Deep-clone helper ────────────────────────────────────────────────────────

/**
 * JSON-safe deep clone.  Produces a completely independent copy of any
 * JSON-serialisable value.  Throws if the value contains a non-serialisable
 * type (function, symbol, circular reference) — which should never happen
 * because all persisted types are constrained to JSON-safe primitives.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── InMemorySessionStore ─────────────────────────────────────────────────────

/**
 * In-memory implementation of ISessionStore.
 *
 * saveSession upserts: calling it twice with the same sessionId replaces the
 * earlier record.  This matches checkpoint behaviour — only the latest snapshot
 * for a given workflow session is kept.
 */
export class InMemorySessionStore implements ISessionStore {
  private readonly store = new Map<string, PersistedSession>();

  async saveSession(session: PersistedSession): Promise<void> {
    this.store.set(session.sessionId, deepClone(session));
  }

  async loadSession(sessionId: string): Promise<PersistedSession | null> {
    const record = this.store.get(sessionId);
    return record !== undefined ? deepClone(record) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  /** Returns sessionIds sorted by savedAt descending (most recently saved first). */
  async listSessions(): Promise<string[]> {
    return [...this.store.values()]
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(s => s.sessionId);
  }
}

// ─── InMemoryTraceStore ───────────────────────────────────────────────────────

/**
 * In-memory implementation of ITraceStore.
 *
 * saveTrace upserts: calling it twice with the same traceId replaces the
 * earlier record.  Callers that want to append messages should load, merge,
 * then save (or call saveTrace with the complete updated list).
 */
export class InMemoryTraceStore implements ITraceStore {
  private readonly store = new Map<string, PersistedTrace>();

  async saveTrace(trace: PersistedTrace): Promise<void> {
    this.store.set(trace.traceId, deepClone(trace));
  }

  async loadTrace(traceId: string): Promise<PersistedTrace | null> {
    const record = this.store.get(traceId);
    return record !== undefined ? deepClone(record) : null;
  }

  async deleteTrace(traceId: string): Promise<void> {
    this.store.delete(traceId);
  }

  /** Returns traceIds sorted by createdAt descending (most recently started first). */
  async listTraces(): Promise<string[]> {
    return [...this.store.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(t => t.traceId);
  }
}

// ─── InMemoryExportStore ──────────────────────────────────────────────────────

/**
 * In-memory implementation of IExportStore.
 *
 * Export snapshots are treated as immutable once saved.  Calling saveSnapshot
 * twice with the same snapshotId silently overwrites — callers should use a
 * fresh UUID from generateTraceId() for every new export to avoid collisions.
 */
export class InMemoryExportStore implements IExportStore {
  private readonly store = new Map<string, ExportSnapshot>();

  async saveSnapshot(snapshot: ExportSnapshot): Promise<void> {
    this.store.set(snapshot.snapshotId, deepClone(snapshot));
  }

  async loadSnapshot(snapshotId: string): Promise<ExportSnapshot | null> {
    const record = this.store.get(snapshotId);
    return record !== undefined ? deepClone(record) : null;
  }

  /** Returns snapshotIds sorted by exportedAt descending (most recently exported first). */
  async listSnapshots(): Promise<string[]> {
    return [...this.store.values()]
      .sort((a, b) => b.exportedAt - a.exportedAt)
      .map(s => s.snapshotId);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a fresh IPersistenceLayer backed by three independent in-memory stores.
 *
 * Intended for:
 *   - Tests (each test gets its own isolated layer)
 *   - Development / prototyping (no disk or browser storage required)
 *
 * Every call returns a new, completely isolated instance — there is no shared
 * singleton state.
 */
export function createInMemoryPersistenceLayer(): IPersistenceLayer {
  return {
    sessions: new InMemorySessionStore(),
    traces:   new InMemoryTraceStore(),
    exports:  new InMemoryExportStore(),
  };
}
