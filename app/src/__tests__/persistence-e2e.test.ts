/**
 * P6-08E: Persistence end-to-end tests
 *
 * Exercises the complete persistence stack through the public IPersistenceLayer
 * interface, backed by real IndexedDB (via fake-indexeddb).  Tests do not reach
 * into implementation internals except where raw IDB access is needed to inject
 * corrupted or stale records.
 *
 * Each describe block gets its own IDBFactory instance so all state is isolated.
 *
 * Groups:
 *   E1-01..E1-04  — Session lifecycle (save, load, delete, list)
 *   E2-01..E2-04  — Trace lifecycle
 *   E3-01..E3-03  — Export snapshot lifecycle (IExportStore has no deleteSnapshot)
 *   E4-01..E4-04  — Migration decorator + IndexedDB integration
 *   E5-01..E5-05  — Corrupted records: null returns, list skipping, no throws
 *   E6-01..E6-03  — Full layer integration (createIndexedDbPersistenceLayer)
 *   E7-01..E7-04  — Isolation between records (different keys, different stores)
 *   E8-01..E8-05  — Serialization round-trip fidelity
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
  MigrationRegistry,
  MigratingSessionStore,
  createMigratingPersistenceLayer,
} from '../persistence';

import type {
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
  SchemaMigration,
  IPersistenceLayer,
} from '../persistence';

import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(
  traceId = 'trace-001',
  ts      = 1_700_000_000_000,
  opts: Partial<AgentMessage> = {},
): AgentMessage {
  return {
    traceId,
    from:      'autonomous',
    to:        'planner',
    type:      'request',
    payload:   { action: 'run' },
    timestamp: ts,
    ...opts,
  };
}

function makeLiveSession(sessionId = 'sess-001') {
  return {
    sessionId,
    state:       'ready-for-export' as const,
    goal:        'mua sắm văn phòng phẩm',
    messageLog:  [
      makeMsg('trace-001', 1_700_000_000_000, { from: 'autonomous', to: 'planner',   type: 'request'  }),
      makeMsg('trace-001', 1_700_000_001_000, { from: 'planner',    to: 'autonomous', type: 'response', legalBasis: ['Điều 38 Luật Đấu thầu 22/2023/QH15'] }),
    ],
    startedAt:   1_700_000_000_000,
    completedAt: 1_700_000_010_000,
    specRetries: 2,
    totalBudget: 250_000_000,
    budgetYear:  2026,
  };
}

function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return { ...serializeSession(makeLiveSession()), ...overrides };
}

function makeTrace(traceId = 'trace-001', overrides: Partial<PersistedTrace> = {}): PersistedTrace {
  return {
    ...serializeTrace(traceId, [
      makeMsg(traceId, 1_700_000_000_000),
      makeMsg(traceId, 1_700_000_005_000),
    ]),
    ...overrides,
  };
}

function makeSnapshot(snapshotId = 'snap-001', overrides: Partial<ExportSnapshot> = {}): ExportSnapshot {
  return {
    ...createExportSnapshot({
      snapshotId,
      session:    makeLiveSession(),
      traces:     [{ traceId: 'trace-001', messages: [makeMsg(), makeMsg('trace-001', 1_700_000_005_000)] }],
      legalBasis: [
        'Điều 44 Luật Đấu thầu 22/2023/QH15',
        'Điều 38 Luật Đấu thầu 22/2023/QH15',
        'Điều 44 Luật Đấu thầu 22/2023/QH15', // intentional duplicate — should be deduped
      ],
      summary: 'Hồ sơ mua sắm văn phòng phẩm đã hoàn tất.',
    }),
    ...overrides,
  };
}

/** Inserts a raw record directly into an IDB object store (bypasses type guards). */
function injectRaw(
  db:        IDBDatabase,
  storeName: string,
  record:    Record<string, unknown>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Migration that bumps schemaVersion from 0 to 1, preserving all other fields. */
const v0ToV1: SchemaMigration = {
  fromVersion: 0,
  toVersion:   1,
  description: 'v0→v1: bump schemaVersion (E2E fixture)',
  migrate:     (d) => ({ ...(d as Record<string, unknown>), schemaVersion: 1 }),
};

// ═════════════════════════════════════════════════════════════════════════════
// E1 — Session lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('E1: Session lifecycle', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E1-01: save a session then load it back by sessionId', async () => {
    const session = makeSession({ sessionId: 'e1-01' });
    await layer.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('e1-01');
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('e1-01');
  });

  it('E1-02: load returns null when sessionId does not exist', async () => {
    expect(await layer.sessions.loadSession('no-such-session')).toBeNull();
  });

  it('E1-03: delete session — subsequent load returns null', async () => {
    await layer.sessions.saveSession(makeSession({ sessionId: 'e1-03' }));
    await layer.sessions.deleteSession('e1-03');
    expect(await layer.sessions.loadSession('e1-03')).toBeNull();
  });

  it('E1-04: list sessions returns saved ids newest-first', async () => {
    await layer.sessions.saveSession(makeSession({ sessionId: 'alpha', savedAt: 100 }));
    await layer.sessions.saveSession(makeSession({ sessionId: 'beta',  savedAt: 300 }));
    await layer.sessions.saveSession(makeSession({ sessionId: 'gamma', savedAt: 200 }));
    const list = await layer.sessions.listSessions();
    expect(list).toEqual(['beta', 'gamma', 'alpha']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E2 — Trace lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('E2: Trace lifecycle', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E2-01: save a trace then load it back by traceId', async () => {
    const trace = makeTrace('e2-01');
    await layer.traces.saveTrace(trace);
    const loaded = await layer.traces.loadTrace('e2-01');
    expect(loaded).not.toBeNull();
    expect(loaded!.traceId).toBe('e2-01');
  });

  it('E2-02: load returns null when traceId does not exist', async () => {
    expect(await layer.traces.loadTrace('no-such-trace')).toBeNull();
  });

  it('E2-03: delete trace — subsequent load returns null', async () => {
    await layer.traces.saveTrace(makeTrace('e2-03'));
    await layer.traces.deleteTrace('e2-03');
    expect(await layer.traces.loadTrace('e2-03')).toBeNull();
  });

  it('E2-04: list traces returns saved ids newest-first by createdAt', async () => {
    await layer.traces.saveTrace(makeTrace('first',  { createdAt: 100, updatedAt: 100 }));
    await layer.traces.saveTrace(makeTrace('last',   { createdAt: 300, updatedAt: 300 }));
    await layer.traces.saveTrace(makeTrace('middle', { createdAt: 200, updatedAt: 200 }));
    const list = await layer.traces.listTraces();
    expect(list[0]).toBe('last');
    expect(list[2]).toBe('first');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E3 — Export snapshot lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('E3: Export snapshot lifecycle', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E3-01: save a snapshot then load it back by snapshotId', async () => {
    const snap = makeSnapshot('e3-01');
    await layer.exports.saveSnapshot(snap);
    const loaded = await layer.exports.loadSnapshot('e3-01');
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshotId).toBe('e3-01');
  });

  it('E3-02: load returns null when snapshotId does not exist', async () => {
    expect(await layer.exports.loadSnapshot('no-such-snap')).toBeNull();
  });

  it('E3-03: list snapshots returns saved ids newest-first by exportedAt', async () => {
    await layer.exports.saveSnapshot(makeSnapshot('newest', { exportedAt: 300 }));
    await layer.exports.saveSnapshot(makeSnapshot('oldest', { exportedAt: 100 }));
    await layer.exports.saveSnapshot(makeSnapshot('middle', { exportedAt: 200 }));
    const list = await layer.exports.listSnapshots();
    expect(list[0]).toBe('newest');
    expect(list[2]).toBe('oldest');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E4 — Migration decorator + IndexedDB integration
// ═════════════════════════════════════════════════════════════════════════════

describe('E4: Migration decorator + IndexedDB integration', () => {
  let db:       IDBDatabase;
  let inner:    IPersistenceLayer;
  let registry: MigrationRegistry;

  beforeEach(async () => {
    const factory = new IDBFactory();
    db       = await openPersistenceDb({ factory });
    inner    = {
      sessions: new IndexedDbSessionStore(db),
      traces:   new IndexedDbTraceStore(db),
      exports:  new IndexedDbExportStore(db),
    };
    registry = new MigrationRegistry();
    registry.register(v0ToV1);
  });

  it('E4-01: current-version record passes through migration decorator unchanged', async () => {
    const layer   = createMigratingPersistenceLayer(registry, inner);
    const session = makeSession({ sessionId: 'e4-01' });
    await inner.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('e4-01');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(loaded!.sessionId).toBe('e4-01');
  });

  it('E4-02: stale (v0) record is auto-upgraded to current version on load', async () => {
    const layer = createMigratingPersistenceLayer(registry, inner);
    const stale = makeSession({ sessionId: 'e4-02', schemaVersion: 0 });
    await injectRaw(db, 'sessions', stale as unknown as Record<string, unknown>);
    const loaded = await layer.sessions.loadSession('e4-02');
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('E4-03: upgraded record is written back to the IDB store after migration', async () => {
    const layer = createMigratingPersistenceLayer(registry, inner);
    const stale = makeSession({ sessionId: 'e4-03', schemaVersion: 0 });
    await injectRaw(db, 'sessions', stale as unknown as Record<string, unknown>);
    // Load through migrating layer — triggers migration + write-back
    await layer.sessions.loadSession('e4-03');
    // Verify the inner store now holds the migrated record
    const stored = await inner.sessions.loadSession('e4-03');
    expect(stored!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('E4-04: migration preserves all field values when upgrading schema version', async () => {
    const layer = createMigratingPersistenceLayer(registry, inner);
    const stale = makeSession({
      sessionId:   'e4-04',
      schemaVersion: 0,
      goal:        'preserve this goal',
      specRetries: 5,
      totalBudget: 999_000_000,
    });
    await injectRaw(db, 'sessions', stale as unknown as Record<string, unknown>);
    const loaded = await layer.sessions.loadSession('e4-04');
    expect(loaded!.goal).toBe('preserve this goal');
    expect(loaded!.specRetries).toBe(5);
    expect(loaded!.totalBudget).toBe(999_000_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E5 — Corrupted records: null returns, list skipping, no throws
// ═════════════════════════════════════════════════════════════════════════════

describe('E5: Corrupted records', () => {
  let db:    IDBDatabase;
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    const factory = new IDBFactory();
    db    = await openPersistenceDb({ factory });
    layer = {
      sessions: new IndexedDbSessionStore(db),
      traces:   new IndexedDbTraceStore(db),
      exports:  new IndexedDbExportStore(db),
    };
  });

  it('E5-01: loadSession returns null for a record that fails the type guard', async () => {
    await injectRaw(db, 'sessions', { sessionId: 'bad-session', malformed: true });
    expect(await layer.sessions.loadSession('bad-session')).toBeNull();
  });

  it('E5-02: loadTrace returns null for a record that fails the type guard', async () => {
    await injectRaw(db, 'traces', { traceId: 'bad-trace', malformed: true });
    expect(await layer.traces.loadTrace('bad-trace')).toBeNull();
  });

  it('E5-03: loadSnapshot returns null for a record that fails the type guard', async () => {
    await injectRaw(db, 'exports', { snapshotId: 'bad-snap', malformed: true });
    expect(await layer.exports.loadSnapshot('bad-snap')).toBeNull();
  });

  it('E5-04: listSessions silently skips corrupted records — valid records still appear', async () => {
    await injectRaw(db, 'sessions', { sessionId: 'corrupted-1', garbage: true });
    await injectRaw(db, 'sessions', { sessionId: 'corrupted-2', garbage: true });
    await layer.sessions.saveSession(makeSession({ sessionId: 'valid' }));
    const list = await layer.sessions.listSessions();
    expect(list).toContain('valid');
    expect(list).not.toContain('corrupted-1');
    expect(list).not.toContain('corrupted-2');
    expect(list).toHaveLength(1);
  });

  it('E5-05: loadSession on missing + corrupted both resolve (not reject) with null', async () => {
    await injectRaw(db, 'sessions', { sessionId: 'corrupted', broken: true });
    await expect(layer.sessions.loadSession('corrupted')).resolves.toBeNull();
    await expect(layer.sessions.loadSession('missing')).resolves.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E6 — Full layer integration
// ═════════════════════════════════════════════════════════════════════════════

describe('E6: Full layer integration (createIndexedDbPersistenceLayer)', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E6-01: layer has sessions, traces, and exports sub-stores', () => {
    expect(layer.sessions).toBeDefined();
    expect(layer.traces).toBeDefined();
    expect(layer.exports).toBeDefined();
  });

  it('E6-02: sessions, traces, and exports are independent stores — different key spaces', async () => {
    // Saving a session with id 'shared' does not affect trace or snapshot lookups with same id
    await layer.sessions.saveSession(makeSession({ sessionId: 'shared' }));
    expect(await layer.traces.loadTrace('shared')).toBeNull();
    expect(await layer.exports.loadSnapshot('shared')).toBeNull();
  });

  it('E6-03: full workflow — save session + trace + snapshot, load all three', async () => {
    await layer.sessions.saveSession(makeSession({ sessionId: 'e6-sess' }));
    await layer.traces.saveTrace(makeTrace('e6-trace'));
    await layer.exports.saveSnapshot(makeSnapshot('e6-snap'));

    const sess = await layer.sessions.loadSession('e6-sess');
    const trc  = await layer.traces.loadTrace('e6-trace');
    const snap = await layer.exports.loadSnapshot('e6-snap');

    expect(sess).not.toBeNull();
    expect(trc).not.toBeNull();
    expect(snap).not.toBeNull();
    expect(sess!.sessionId).toBe('e6-sess');
    expect(trc!.traceId).toBe('e6-trace');
    expect(snap!.snapshotId).toBe('e6-snap');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E7 — Isolation between records
// ═════════════════════════════════════════════════════════════════════════════

describe('E7: Isolation between records', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E7-01: multiple sessions stored independently — loading one does not return another', async () => {
    await layer.sessions.saveSession(makeSession({ sessionId: 'sess-a', goal: 'goal A' }));
    await layer.sessions.saveSession(makeSession({ sessionId: 'sess-b', goal: 'goal B' }));
    const a = await layer.sessions.loadSession('sess-a');
    const b = await layer.sessions.loadSession('sess-b');
    expect(a!.goal).toBe('goal A');
    expect(b!.goal).toBe('goal B');
  });

  it('E7-02: multiple traces stored independently — distinct traceIds', async () => {
    await layer.traces.saveTrace(makeTrace('trace-x', { createdAt: 100, updatedAt: 100 }));
    await layer.traces.saveTrace(makeTrace('trace-y', { createdAt: 200, updatedAt: 200 }));
    const x = await layer.traces.loadTrace('trace-x');
    const y = await layer.traces.loadTrace('trace-y');
    expect(x!.traceId).toBe('trace-x');
    expect(y!.traceId).toBe('trace-y');
  });

  it('E7-03: export snapshots stored independently — distinct snapshotIds', async () => {
    await layer.exports.saveSnapshot(makeSnapshot('snap-p'));
    await layer.exports.saveSnapshot(makeSnapshot('snap-q'));
    const p = await layer.exports.loadSnapshot('snap-p');
    const q = await layer.exports.loadSnapshot('snap-q');
    expect(p!.snapshotId).toBe('snap-p');
    expect(q!.snapshotId).toBe('snap-q');
  });

  it('E7-04: deleting one session does not affect other sessions', async () => {
    await layer.sessions.saveSession(makeSession({ sessionId: 'keep-me' }));
    await layer.sessions.saveSession(makeSession({ sessionId: 'delete-me' }));
    await layer.sessions.deleteSession('delete-me');
    expect(await layer.sessions.loadSession('keep-me')).not.toBeNull();
    expect(await layer.sessions.loadSession('delete-me')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E8 — Serialization round-trip fidelity
// ═════════════════════════════════════════════════════════════════════════════

describe('E8: Serialization round-trip fidelity', () => {
  let layer: IPersistenceLayer;

  beforeEach(async () => {
    layer = await createIndexedDbPersistenceLayer({ factory: new IDBFactory() });
  });

  it('E8-01: legalBasis array is preserved exactly through the snapshot round-trip', async () => {
    const snap = makeSnapshot('e8-01');
    await layer.exports.saveSnapshot(snap);
    const loaded = await layer.exports.loadSnapshot('e8-01');
    // createExportSnapshot deduplicates; loaded value should match the stored (deduped) array
    expect(loaded!.legalBasis).toEqual(snap.legalBasis);
    expect(loaded!.legalBasis.length).toBeGreaterThanOrEqual(1);
  });

  it('E8-02: messageLog is preserved — length and field values survive the round-trip', async () => {
    const session = makeSession({ sessionId: 'e8-02' });
    await layer.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('e8-02');
    expect(loaded!.messageLog).toHaveLength(session.messageLog.length);
    expect(loaded!.messageLog[0].from).toBe(session.messageLog[0].from);
    expect(loaded!.messageLog[0].timestamp).toBe(session.messageLog[0].timestamp);
  });

  it('E8-03: timestamps (startedAt, completedAt, savedAt) are preserved exactly', async () => {
    const session = makeSession({
      sessionId:   'e8-03',
      startedAt:   1_700_000_000_000,
      completedAt: 1_700_000_010_000,
      savedAt:     1_700_000_020_000,
    });
    await layer.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('e8-03');
    expect(loaded!.startedAt).toBe(1_700_000_000_000);
    expect(loaded!.completedAt).toBe(1_700_000_010_000);
    expect(loaded!.savedAt).toBe(1_700_000_020_000);
  });

  it('E8-04: numeric optional fields (totalBudget, budgetYear, specRetries) are preserved', async () => {
    const session = makeSession({
      sessionId:   'e8-04',
      totalBudget: 500_000_000,
      budgetYear:  2026,
      specRetries: 3,
    });
    await layer.sessions.saveSession(session);
    const loaded = await layer.sessions.loadSession('e8-04');
    expect(loaded!.totalBudget).toBe(500_000_000);
    expect(loaded!.budgetYear).toBe(2026);
    expect(loaded!.specRetries).toBe(3);
  });

  it('E8-05: nested traces inside an export snapshot are preserved with their messages', async () => {
    const snap = makeSnapshot('e8-05');
    await layer.exports.saveSnapshot(snap);
    const loaded = await layer.exports.loadSnapshot('e8-05');
    expect(loaded!.traces).toHaveLength(snap.traces.length);
    const firstTrace = loaded!.traces[0];
    expect(firstTrace.traceId).toBe(snap.traces[0].traceId);
    expect(firstTrace.messages).toHaveLength(snap.traces[0].messages.length);
    expect(firstTrace.messages[0].from).toBe(snap.traces[0].messages[0].from);
  });
});
