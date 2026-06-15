/**
 * P6-08D: IndexedDB persistence adapter tests
 *
 * Uses fake-indexeddb to provide a real, fully-functional IndexedDB
 * implementation in the Node.js test environment.  Each test creates a fresh
 * IDBFactory instance so all state is completely isolated between tests.
 *
 * Groups:
 *   IDB-OPEN-01..03  — openPersistenceDb (factory injection, store creation)
 *   IDB-SS-01..09   — IndexedDbSessionStore
 *   IDB-TS-01..07   — IndexedDbTraceStore
 *   IDB-ES-01..05   — IndexedDbExportStore
 *   IDB-FAC-01..04  — createIndexedDbPersistenceLayer (factory function)
 *   IDB-MC-01..03   — migration decorator compatibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  openPersistenceDb,
  IndexedDbSessionStore,
  IndexedDbTraceStore,
  IndexedDbExportStore,
  createIndexedDbPersistenceLayer,
} from '../persistence/idb-stores';

import {
  PERSISTENCE_SCHEMA_VERSION,
  serializeSession,
  serializeTrace,
  createExportSnapshot,
} from '../persistence/schema';

import {
  MigrationRegistry,
  MigratingSessionStore,
  createMigratingPersistenceLayer,
} from '../persistence';

import type {
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
  SchemaMigration,
} from '../persistence';

import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(traceId = 'trace-001'): AgentMessage {
  return {
    traceId,
    from: 'autonomous', to: 'planner', type: 'request',
    payload: { action: 'run' }, timestamp: 1_700_000_000_000,
  };
}

function makeLiveSession(sessionId = 'sess-001') {
  return {
    sessionId,
    state:       'ready-for-export' as const,
    goal:        'mua sắm văn phòng phẩm',
    messageLog:  [makeMsg()],
    startedAt:   1_700_000_000_000,
    completedAt: 1_700_000_001_000,
    specRetries: 0,
    totalBudget: 200_000_000,
    budgetYear:  2026,
  };
}

function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return { ...serializeSession(makeLiveSession()), ...overrides };
}

function makeTrace(traceId = 'trace-001', overrides: Partial<PersistedTrace> = {}): PersistedTrace {
  return { ...serializeTrace(traceId, [makeMsg(traceId)]), ...overrides };
}

function makeSnapshot(snapshotId = 'snap-001', exportedAt?: number): ExportSnapshot {
  const snap = createExportSnapshot({
    snapshotId,
    session:    makeLiveSession(),
    traces:     [{ traceId: 'trace-001', messages: [makeMsg()] }],
    legalBasis: ['Điều 44 Luật Đấu thầu 22/2023/QH15'],
    summary:    'Hồ sơ đã hoàn tất.',
  });
  return exportedAt !== undefined ? { ...snap, exportedAt } : snap;
}

/** Injects an arbitrary record directly into an IDB object store (bypasses type guards). */
function injectRaw(db: IDBDatabase, storeName: string, record: Record<string, unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Per-test factory ─────────────────────────────────────────────────────────

let factory: IDBFactory;
beforeEach(() => { factory = new IDBFactory(); });

// ═════════════════════════════════════════════════════════════════════════════
// openPersistenceDb
// ═════════════════════════════════════════════════════════════════════════════

describe('openPersistenceDb()', () => {
  it('IDB-OPEN-01: returns an IDBDatabase when given an injected IDBFactory', async () => {
    const db = await openPersistenceDb({ factory });
    expect(db).toBeDefined();
    expect(typeof db.transaction).toBe('function');
    db.close();
  });

  it('IDB-OPEN-02: creates sessions, traces, and exports object stores by default', async () => {
    const db = await openPersistenceDb({ factory });
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    expect(db.objectStoreNames.contains('traces')).toBe(true);
    expect(db.objectStoreNames.contains('exports')).toBe(true);
    db.close();
  });

  it('IDB-OPEN-03: uses custom store names when provided', async () => {
    const db = await openPersistenceDb({
      factory,
      sessionStore: 'my-sessions',
      traceStore:   'my-traces',
      exportStore:  'my-exports',
    });
    expect(db.objectStoreNames.contains('my-sessions')).toBe(true);
    expect(db.objectStoreNames.contains('my-traces')).toBe(true);
    expect(db.objectStoreNames.contains('my-exports')).toBe(true);
    db.close();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IndexedDbSessionStore
// ═════════════════════════════════════════════════════════════════════════════

describe('IndexedDbSessionStore', () => {
  let db:    IDBDatabase;
  let store: IndexedDbSessionStore;

  beforeEach(async () => {
    db    = await openPersistenceDb({ factory });
    store = new IndexedDbSessionStore(db);
  });

  it('IDB-SS-01: saveSession + loadSession round-trips the record', async () => {
    const session = makeSession({ sessionId: 's-001', goal: 'test round-trip' });
    await store.saveSession(session);
    const loaded = await store.loadSession('s-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('s-001');
    expect(loaded!.goal).toBe('test round-trip');
  });

  it('IDB-SS-02: loaded record preserves schemaVersion', async () => {
    await store.saveSession(makeSession({ sessionId: 's-002' }));
    const loaded = await store.loadSession('s-002');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('IDB-SS-03: loadSession returns null for unknown sessionId', async () => {
    expect(await store.loadSession('does-not-exist')).toBeNull();
  });

  it('IDB-SS-04: deleteSession removes the record — subsequent load returns null', async () => {
    await store.saveSession(makeSession({ sessionId: 's-004' }));
    await store.deleteSession('s-004');
    expect(await store.loadSession('s-004')).toBeNull();
  });

  it('IDB-SS-05: deleteSession on unknown id is a no-op (does not throw)', async () => {
    await expect(store.deleteSession('no-such-id')).resolves.toBeUndefined();
  });

  it('IDB-SS-06: listSessions returns all saved sessionIds', async () => {
    await store.saveSession(makeSession({ sessionId: 'a', savedAt: 100 }));
    await store.saveSession(makeSession({ sessionId: 'b', savedAt: 200 }));
    const list = await store.listSessions();
    expect(list).toContain('a');
    expect(list).toContain('b');
    expect(list).toHaveLength(2);
  });

  it('IDB-SS-07: listSessions returns newest-first (by savedAt descending)', async () => {
    await store.saveSession(makeSession({ sessionId: 'old',    savedAt: 100 }));
    await store.saveSession(makeSession({ sessionId: 'middle', savedAt: 200 }));
    await store.saveSession(makeSession({ sessionId: 'new',    savedAt: 300 }));
    const list = await store.listSessions();
    expect(list[0]).toBe('new');
    expect(list[1]).toBe('middle');
    expect(list[2]).toBe('old');
  });

  it('IDB-SS-08: saving again with the same sessionId replaces the earlier record (upsert)', async () => {
    await store.saveSession(makeSession({ sessionId: 's-008', goal: 'original' }));
    await store.saveSession(makeSession({ sessionId: 's-008', goal: 'updated'  }));
    const loaded = await store.loadSession('s-008');
    expect(loaded!.goal).toBe('updated');
    expect(await store.listSessions()).toHaveLength(1);
  });

  it('IDB-SS-09: loadSession returns null for a corrupted record that fails the type guard', async () => {
    // Inject a record that has the right key (sessionId) but wrong shape
    await injectRaw(db, 'sessions', { sessionId: 'corrupted', junk: true });
    expect(await store.loadSession('corrupted')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IndexedDbTraceStore
// ═════════════════════════════════════════════════════════════════════════════

describe('IndexedDbTraceStore', () => {
  let db:    IDBDatabase;
  let store: IndexedDbTraceStore;

  beforeEach(async () => {
    db    = await openPersistenceDb({ factory });
    store = new IndexedDbTraceStore(db);
  });

  it('IDB-TS-01: saveTrace + loadTrace round-trips the record', async () => {
    const trace = makeTrace('t-001');
    await store.saveTrace(trace);
    const loaded = await store.loadTrace('t-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.traceId).toBe('t-001');
    expect(loaded!.messages).toHaveLength(1);
  });

  it('IDB-TS-02: loadTrace returns null for unknown traceId', async () => {
    expect(await store.loadTrace('missing')).toBeNull();
  });

  it('IDB-TS-03: deleteTrace removes the record', async () => {
    await store.saveTrace(makeTrace('t-003'));
    await store.deleteTrace('t-003');
    expect(await store.loadTrace('t-003')).toBeNull();
  });

  it('IDB-TS-04: deleteTrace on unknown id is a no-op', async () => {
    await expect(store.deleteTrace('no-such-trace')).resolves.toBeUndefined();
  });

  it('IDB-TS-05: listTraces returns all stored traceIds', async () => {
    await store.saveTrace(makeTrace('ta', { createdAt: 100, updatedAt: 100 }));
    await store.saveTrace(makeTrace('tb', { createdAt: 200, updatedAt: 200 }));
    const list = await store.listTraces();
    expect(list).toHaveLength(2);
    expect(list).toContain('ta');
    expect(list).toContain('tb');
  });

  it('IDB-TS-06: listTraces returns newest-first (by createdAt descending)', async () => {
    await store.saveTrace(makeTrace('old',    { createdAt: 100, updatedAt: 100 }));
    await store.saveTrace(makeTrace('recent', { createdAt: 300, updatedAt: 300 }));
    await store.saveTrace(makeTrace('middle', { createdAt: 200, updatedAt: 200 }));
    const list = await store.listTraces();
    expect(list[0]).toBe('recent');
    expect(list[2]).toBe('old');
  });

  it('IDB-TS-07: loadTrace returns null for a corrupted record', async () => {
    await injectRaw(db, 'traces', { traceId: 'corrupted', junk: true });
    expect(await store.loadTrace('corrupted')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IndexedDbExportStore
// ═════════════════════════════════════════════════════════════════════════════

describe('IndexedDbExportStore', () => {
  let db:    IDBDatabase;
  let store: IndexedDbExportStore;

  beforeEach(async () => {
    db    = await openPersistenceDb({ factory });
    store = new IndexedDbExportStore(db);
  });

  it('IDB-ES-01: saveSnapshot + loadSnapshot round-trips the record', async () => {
    const snap = makeSnapshot('s-001');
    await store.saveSnapshot(snap);
    const loaded = await store.loadSnapshot('s-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshotId).toBe('s-001');
    expect(loaded!.summary).toBe('Hồ sơ đã hoàn tất.');
  });

  it('IDB-ES-02: loadSnapshot returns null for unknown snapshotId', async () => {
    expect(await store.loadSnapshot('missing')).toBeNull();
  });

  it('IDB-ES-03: listSnapshots returns newest-first (by exportedAt descending)', async () => {
    await store.saveSnapshot(makeSnapshot('newest', 300));
    await store.saveSnapshot(makeSnapshot('oldest', 100));
    await store.saveSnapshot(makeSnapshot('middle', 200));
    const list = await store.listSnapshots();
    expect(list[0]).toBe('newest');
    expect(list[2]).toBe('oldest');
  });

  it('IDB-ES-04: listSnapshots returns empty array when store is empty', async () => {
    expect(await store.listSnapshots()).toEqual([]);
  });

  it('IDB-ES-05: loadSnapshot returns null for a corrupted record', async () => {
    await injectRaw(db, 'exports', { snapshotId: 'corrupted', junk: true });
    expect(await store.loadSnapshot('corrupted')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createIndexedDbPersistenceLayer
// ═════════════════════════════════════════════════════════════════════════════

describe('createIndexedDbPersistenceLayer()', () => {
  it('IDB-FAC-01: returns an IPersistenceLayer with sessions, traces, and exports', async () => {
    const layer = await createIndexedDbPersistenceLayer({ factory });
    expect(layer.sessions).toBeDefined();
    expect(layer.traces).toBeDefined();
    expect(layer.exports).toBeDefined();
  });

  it('IDB-FAC-02: sessions is an IndexedDbSessionStore instance', async () => {
    const layer = await createIndexedDbPersistenceLayer({ factory });
    expect(layer.sessions).toBeInstanceOf(IndexedDbSessionStore);
  });

  it('IDB-FAC-03: two layers using the same factory and dbName share data', async () => {
    const layer1 = await createIndexedDbPersistenceLayer({ factory, dbName: 'shared-db' });
    const layer2 = await createIndexedDbPersistenceLayer({ factory, dbName: 'shared-db' });
    await layer1.sessions.saveSession(makeSession({ sessionId: 'shared' }));
    expect(await layer2.sessions.loadSession('shared')).not.toBeNull();
  });

  it('IDB-FAC-04: all three sub-stores work end-to-end through the layer interface', async () => {
    const layer = await createIndexedDbPersistenceLayer({ factory });
    await layer.sessions.saveSession(makeSession({ sessionId: 'e2e' }));
    await layer.traces.saveTrace(makeTrace('e2e-trace'));
    await layer.exports.saveSnapshot(makeSnapshot('e2e-snap'));
    expect(await layer.sessions.loadSession('e2e')).not.toBeNull();
    expect(await layer.traces.loadTrace('e2e-trace')).not.toBeNull();
    expect(await layer.exports.loadSnapshot('e2e-snap')).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Migration decorator compatibility
// ═════════════════════════════════════════════════════════════════════════════

describe('Migration decorator compatibility', () => {
  /** v0→v1 migration: bump schemaVersion to 1, preserving all other fields. */
  const v0ToV1: SchemaMigration = {
    fromVersion: 0, toVersion: 1, description: 'v0→v1 (test fixture)',
    migrate: (d) => ({ ...(d as Record<string, unknown>), schemaVersion: 1 }),
  };

  it('IDB-MC-01: MigratingSessionStore passes through a current-version record from IDB store', async () => {
    const db       = await openPersistenceDb({ factory });
    const inner    = new IndexedDbSessionStore(db);
    const registry = new MigrationRegistry();
    const migStore = new MigratingSessionStore(inner, registry);

    const session = makeSession({ sessionId: 'current' });
    await inner.saveSession(session);
    const loaded = await migStore.loadSession('current');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('IDB-MC-02: MigratingSessionStore migrates a stale record loaded from the IDB store', async () => {
    const db    = await openPersistenceDb({ factory });
    const inner = new IndexedDbSessionStore(db);
    const registry = new MigrationRegistry();
    registry.register(v0ToV1);
    const migStore = new MigratingSessionStore(inner, registry);

    // Inject a stale (v0) session directly into IDB, bypassing the store
    const stale = makeSession({ sessionId: 'stale', schemaVersion: 0 });
    await injectRaw(db, 'sessions', stale as unknown as Record<string, unknown>);

    const loaded = await migStore.loadSession('stale');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(loaded!.goal).toBe(stale.goal); // data preserved
  });

  it('IDB-MC-03: createMigratingPersistenceLayer wraps an IDB inner layer correctly', async () => {
    const inner    = await createIndexedDbPersistenceLayer({ factory });
    const registry = new MigrationRegistry();
    const layer    = createMigratingPersistenceLayer(registry, inner);

    expect(layer.sessions).toBeInstanceOf(MigratingSessionStore);

    const session = makeSession({ sessionId: 'mc-03' });
    await layer.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('mc-03');
    expect(loaded!.sessionId).toBe('mc-03');
  });
});
