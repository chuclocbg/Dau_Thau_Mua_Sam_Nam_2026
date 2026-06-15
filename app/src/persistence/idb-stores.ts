/**
 * P6-08D: IndexedDB persistence adapters.
 *
 * Implements ISessionStore, ITraceStore, and IExportStore on top of the
 * browser's IndexedDB API (or any injected IDBFactory, for tests).
 *
 * Design rules:
 *   - openPersistenceDb accepts an injectable factory for testing (fake-indexeddb).
 *   - Each store class takes an already-opened IDBDatabase so that the opening
 *     step is separate and testable in isolation.
 *   - Each public method uses a fresh transaction per operation — safe and
 *     straightforward for our single-record access patterns.
 *   - load*() returns null for both missing keys and corrupted records (records
 *     that fail the type guard).  Corrupted records are silently ignored rather
 *     than throwing, matching the "graceful handling" requirement.
 *   - list*() silently skips corrupted records.
 *   - All methods are async; every error surfaces as a Promise rejection so
 *     callers always control error handling.  No uncaught exceptions.
 *   - Stored values are plain JSON-safe objects matching the persisted schema
 *     types.  IndexedDB's structured clone preserves them faithfully.
 *   - schemaVersion is preserved on every round-trip; the P6-08C migration
 *     decorators can wrap these stores transparently.
 *
 * IndexedDB object store layout:
 *   sessions  — keyPath: 'sessionId'
 *   traces    — keyPath: 'traceId'
 *   exports   — keyPath: 'snapshotId'
 */

import {
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,
} from './schema';
import type {
  ISessionStore,
  ITraceStore,
  IExportStore,
  IPersistenceLayer,
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
} from './schema';

// ─── Internal helper ──────────────────────────────────────────────────────────

/** Wraps an IDBRequest in a Promise.  Rejects on request error. */
function idbRequest(req: IDBRequest): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as unknown);
    req.onerror   = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface IndexedDbOptions {
  /** IndexedDB database name.  Default: 'procurement-persistence'. */
  dbName?:       string;
  /**
   * Version number passed to indexedDB.open().  Increment this when the
   * object store layout changes to trigger onupgradeneeded.  Default: 1.
   */
  dbVersion?:    number;
  /** Object store name for sessions.          Default: 'sessions'. */
  sessionStore?: string;
  /** Object store name for traces.            Default: 'traces'. */
  traceStore?:   string;
  /** Object store name for export snapshots.  Default: 'exports'. */
  exportStore?:  string;
  /**
   * Injectable IDBFactory instance.  Defaults to globalThis.indexedDB.
   *
   * Pass a `new IDBFactory()` from `fake-indexeddb` in unit tests so each
   * test gets a completely isolated, in-process database.
   */
  factory?:      IDBFactory;
}

const DEFAULTS = {
  dbName:       'procurement-persistence',
  dbVersion:    1,
  sessionStore: 'sessions',
  traceStore:   'traces',
  exportStore:  'exports',
} as const;

// ─── Database opener ──────────────────────────────────────────────────────────

/**
 * Opens (or creates) the persistence IndexedDB.
 *
 * Creates the three object stores on first open (onupgradeneeded).
 * Returns a ready IDBDatabase that can be passed to the store constructors.
 */
export function openPersistenceDb(opts: IndexedDbOptions = {}): Promise<IDBDatabase> {
  const factory      = opts.factory      ?? globalThis.indexedDB;
  const dbName       = opts.dbName       ?? DEFAULTS.dbName;
  const dbVersion    = opts.dbVersion    ?? DEFAULTS.dbVersion;
  const sessionStore = opts.sessionStore ?? DEFAULTS.sessionStore;
  const traceStore   = opts.traceStore   ?? DEFAULTS.traceStore;
  const exportStore  = opts.exportStore  ?? DEFAULTS.exportStore;

  if (!factory) {
    return Promise.reject(new Error(
      'IndexedDB is not available.  Pass an IDBFactory via opts.factory or run in a browser.',
    ));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(dbName, dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(sessionStore)) {
        db.createObjectStore(sessionStore, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(traceStore)) {
        db.createObjectStore(traceStore, { keyPath: 'traceId' });
      }
      if (!db.objectStoreNames.contains(exportStore)) {
        db.createObjectStore(exportStore, { keyPath: 'snapshotId' });
      }
    };

    request.onsuccess  = () => resolve(request.result);
    request.onerror    = () => reject(request.error   ?? new Error('Failed to open IndexedDB'));
    request.onblocked  = () => reject(new Error('IndexedDB open blocked by another connection'));
  });
}

// ─── IndexedDbSessionStore ────────────────────────────────────────────────────

/**
 * ISessionStore backed by an IndexedDB object store.
 *
 * Corrupted records (those that fail isPersistedSession) are treated as null
 * on load and omitted from list results rather than surfaced as errors.
 */
export class IndexedDbSessionStore implements ISessionStore {
  constructor(
    private readonly db:        IDBDatabase,
    private readonly storeName: string = DEFAULTS.sessionStore,
  ) {}

  async saveSession(session: PersistedSession): Promise<void> {
    const tx    = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await idbRequest(store.put(session));
  }

  async loadSession(sessionId: string): Promise<PersistedSession | null> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const raw   = await idbRequest(store.get(sessionId));
    if (raw == null) return null;
    if (!isPersistedSession(raw)) return null; // corrupted — graceful no-op
    return raw;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const tx    = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await idbRequest(store.delete(sessionId));
  }

  /** Returns sessionIds sorted by savedAt descending (most recently saved first). */
  async listSessions(): Promise<string[]> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const all   = await idbRequest(store.getAll()) as unknown[];
    return all
      .filter((r): r is PersistedSession => isPersistedSession(r))
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(s => s.sessionId);
  }
}

// ─── IndexedDbTraceStore ──────────────────────────────────────────────────────

export class IndexedDbTraceStore implements ITraceStore {
  constructor(
    private readonly db:        IDBDatabase,
    private readonly storeName: string = DEFAULTS.traceStore,
  ) {}

  async saveTrace(trace: PersistedTrace): Promise<void> {
    const tx    = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await idbRequest(store.put(trace));
  }

  async loadTrace(traceId: string): Promise<PersistedTrace | null> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const raw   = await idbRequest(store.get(traceId));
    if (raw == null) return null;
    if (!isPersistedTrace(raw)) return null;
    return raw;
  }

  async deleteTrace(traceId: string): Promise<void> {
    const tx    = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await idbRequest(store.delete(traceId));
  }

  /** Returns traceIds sorted by createdAt descending (most recently created first). */
  async listTraces(): Promise<string[]> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const all   = await idbRequest(store.getAll()) as unknown[];
    return all
      .filter((r): r is PersistedTrace => isPersistedTrace(r))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(t => t.traceId);
  }
}

// ─── IndexedDbExportStore ─────────────────────────────────────────────────────

export class IndexedDbExportStore implements IExportStore {
  constructor(
    private readonly db:        IDBDatabase,
    private readonly storeName: string = DEFAULTS.exportStore,
  ) {}

  async saveSnapshot(snapshot: ExportSnapshot): Promise<void> {
    const tx    = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await idbRequest(store.put(snapshot));
  }

  async loadSnapshot(snapshotId: string): Promise<ExportSnapshot | null> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const raw   = await idbRequest(store.get(snapshotId));
    if (raw == null) return null;
    if (!isExportSnapshot(raw)) return null;
    return raw;
  }

  /** Returns snapshotIds sorted by exportedAt descending (most recently exported first). */
  async listSnapshots(): Promise<string[]> {
    const tx    = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const all   = await idbRequest(store.getAll()) as unknown[];
    return all
      .filter((r): r is ExportSnapshot => isExportSnapshot(r))
      .sort((a, b) => b.exportedAt - a.exportedAt)
      .map(s => s.snapshotId);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Opens an IndexedDB and returns an IPersistenceLayer backed by the three
 * IndexedDb* store classes.
 *
 * The returned layer is compatible with the P6-08C migration decorators:
 *
 *   const inner    = await createIndexedDbPersistenceLayer({ factory });
 *   const registry = new MigrationRegistry();
 *   const layer    = createMigratingPersistenceLayer(registry, inner);
 *
 * @param opts - Storage names, database version, and injectable factory.
 */
export async function createIndexedDbPersistenceLayer(
  opts: IndexedDbOptions = {},
): Promise<IPersistenceLayer> {
  const db           = await openPersistenceDb(opts);
  const sessionStore = opts.sessionStore ?? DEFAULTS.sessionStore;
  const traceStore   = opts.traceStore   ?? DEFAULTS.traceStore;
  const exportStore  = opts.exportStore  ?? DEFAULTS.exportStore;
  return {
    sessions: new IndexedDbSessionStore(db, sessionStore),
    traces:   new IndexedDbTraceStore(db, traceStore),
    exports:  new IndexedDbExportStore(db, exportStore),
  };
}
