/**
 * P6-08C: Schema migration runner tests
 *
 * Tests the migration pipeline, registry, and decorator stores.
 * All "stale" records use schemaVersion: 0 (below PERSISTENCE_SCHEMA_VERSION = 1).
 * Multi-step tests use runMigration with an explicit targetVersion to simulate
 * future schema versions without bumping PERSISTENCE_SCHEMA_VERSION itself.
 *
 * Groups:
 *   MR-01..MR-10  — MigrationRegistry (register, has, buildChain)
 *   RM-01..RM-13  — runMigration (skip, downgrade, single, multi, errors, integrity)
 *   CW-01..CW-03  — migrateSession / migrateTrace / migrateSnapshot wrappers
 *   MS-01..MS-09  — MigratingSessionStore (migrate-on-read decorator)
 *   MT-01..MT-05  — MigratingTraceStore
 *   ME-01..ME-04  — MigratingExportStore
 *   ML-01..ML-04  — createMigratingPersistenceLayer (factory)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  MigrationError,
  MigrationRegistry,
  runMigration,
  migrateSession,
  migrateTrace,
  migrateSnapshot,
} from '../persistence/migration';

import {
  MigratingSessionStore,
  MigratingTraceStore,
  MigratingExportStore,
  createMigratingPersistenceLayer,
} from '../persistence/migrating-stores';

import {
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryExportStore,
  PERSISTENCE_SCHEMA_VERSION,
  serializeSession,
  serializeTrace,
  createExportSnapshot,
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,
} from '../persistence';

import type {
  SchemaMigration,
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
} from '../persistence';

import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(traceId = 'trace-001'): AgentMessage {
  return {
    traceId,
    from:      'autonomous',
    to:        'planner',
    type:      'request',
    payload:   { action: 'run' },
    timestamp: 1_700_000_000_000,
  };
}

function makeV1Session(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    ...serializeSession({
      sessionId:   'sess-001',
      state:       'ready-for-export',
      goal:        'mua sắm văn phòng phẩm',
      messageLog:  [makeMsg()],
      startedAt:   1_700_000_000_000,
      completedAt: 1_700_000_001_000,
      specRetries: 0,
      totalBudget: 200_000_000,
      budgetYear:  2026,
    }),
    ...overrides,
  };
}

/** A stale session with a schemaVersion below the current schema. */
function makeStaleSession(schemaVersion = 0): PersistedSession {
  return { ...makeV1Session(), schemaVersion };
}

function makeV1Trace(traceId = 'trace-001', overrides: Partial<PersistedTrace> = {}): PersistedTrace {
  return {
    ...serializeTrace(traceId, [makeMsg(traceId)]),
    ...overrides,
  };
}

function makeStaleTrace(schemaVersion = 0): PersistedTrace {
  return { ...makeV1Trace(), schemaVersion };
}

function makeV1Snapshot(snapshotId = 'snap-001'): ExportSnapshot {
  return createExportSnapshot({
    snapshotId,
    session:    { sessionId: 'sess-001', state: 'ready-for-export', goal: 'test', messageLog: [makeMsg()], startedAt: 1_000, specRetries: 0 },
    traces:     [{ traceId: 'trace-001', messages: [makeMsg()] }],
    legalBasis: ['Điều 44 Luật Đấu thầu 22/2023/QH15'],
    summary:    'Hồ sơ đã hoàn tất.',
  });
}

function makeStaleSnapshot(schemaVersion = 0): ExportSnapshot {
  const snap = makeV1Snapshot();
  return { ...snap, schemaVersion, session: { ...snap.session, schemaVersion } };
}

// ─── Standard migrations used throughout tests ────────────────────────────────

/** Bumps schemaVersion from 0 to 1, preserving all other fields. */
const v0ToV1: SchemaMigration = {
  fromVersion: 0,
  toVersion:   1,
  description: 'v0→v1: bump schemaVersion (test fixture)',
  migrate:     (data) => ({ ...(data as Record<string, unknown>), schemaVersion: 1 }),
};

/** Bumps schemaVersion from 1 to 2, adds a hypothetical field (multi-step test). */
const v1ToV2: SchemaMigration = {
  fromVersion: 1,
  toVersion:   2,
  description: 'v1→v2: bump schemaVersion (test fixture)',
  migrate:     (data) => ({ ...(data as Record<string, unknown>), schemaVersion: 2 }),
};

/** Bumps schemaVersion from 2 to 3 (three-step test). */
const v2ToV3: SchemaMigration = {
  fromVersion: 2,
  toVersion:   3,
  description: 'v2→v3: bump schemaVersion (test fixture)',
  migrate:     (data) => ({ ...(data as Record<string, unknown>), schemaVersion: 3 }),
};

function makeRegistryWith(...migrations: SchemaMigration[]): MigrationRegistry {
  const r = new MigrationRegistry();
  for (const m of migrations) r.register(m);
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// MigrationRegistry
// ═════════════════════════════════════════════════════════════════════════════

describe('MigrationRegistry', () => {
  it('MR-01: register() accepts a valid fromVersion→toVersion migration', () => {
    const r = new MigrationRegistry();
    expect(() => r.register(v0ToV1)).not.toThrow();
  });

  it('MR-02: register() throws when toVersion !== fromVersion + 1 (skip forward)', () => {
    const r = new MigrationRegistry();
    expect(() =>
      r.register({ fromVersion: 0, toVersion: 2, description: 'skip', migrate: (d) => d }),
    ).toThrow('fromVersion + 1');
  });

  it('MR-03: register() throws when toVersion < fromVersion (backwards)', () => {
    const r = new MigrationRegistry();
    expect(() =>
      r.register({ fromVersion: 2, toVersion: 1, description: 'back', migrate: (d) => d }),
    ).toThrow('fromVersion + 1');
  });

  it('MR-04: has() returns true after registering a migration for that fromVersion', () => {
    const r = makeRegistryWith(v0ToV1);
    expect(r.has(0)).toBe(true);
  });

  it('MR-05: has() returns false for unregistered fromVersion', () => {
    const r = new MigrationRegistry();
    expect(r.has(0)).toBe(false);
  });

  it('MR-06: buildChain() returns empty array when fromVersion === toVersion', () => {
    const r = makeRegistryWith(v0ToV1);
    expect(r.buildChain(1, 1)).toEqual([]);
  });

  it('MR-07: buildChain() returns a single step for a one-version gap', () => {
    const r = makeRegistryWith(v0ToV1);
    const chain = r.buildChain(0, 1);
    expect(chain).toHaveLength(1);
    expect(chain[0].fromVersion).toBe(0);
    expect(chain[0].toVersion).toBe(1);
  });

  it('MR-08: buildChain() returns steps in ascending version order for a multi-version gap', () => {
    const r = makeRegistryWith(v0ToV1, v1ToV2, v2ToV3);
    const chain = r.buildChain(0, 3);
    expect(chain).toHaveLength(3);
    expect(chain.map((s) => s.fromVersion)).toEqual([0, 1, 2]);
  });

  it('MR-09: buildChain() throws MigrationError(MISSING_STEP) when a step is absent', () => {
    const r = makeRegistryWith(v0ToV1); // has 0→1 but not 1→2
    let err: unknown;
    try { r.buildChain(0, 2); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('MISSING_STEP');
    expect((err as MigrationError).fromVersion).toBe(1);
  });

  it('MR-10: registering the same fromVersion twice keeps the last registration', () => {
    const r = new MigrationRegistry();
    const first:  SchemaMigration = { fromVersion: 0, toVersion: 1, description: 'first',  migrate: () => ({ schemaVersion: 11 }) };
    const second: SchemaMigration = { fromVersion: 0, toVersion: 1, description: 'second', migrate: () => ({ schemaVersion: 99 }) };
    r.register(first);
    r.register(second);
    const chain = r.buildChain(0, 1);
    expect(chain[0].description).toBe('second');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// runMigration
// ═════════════════════════════════════════════════════════════════════════════

describe('runMigration()', () => {
  it('RM-01: skips migration when record.schemaVersion === targetVersion', () => {
    const session = makeV1Session();
    const result  = runMigration(session, new MigrationRegistry(), isPersistedSession, 1);
    expect(result.sessionId).toBe(session.sessionId);
  });

  it('RM-02: skipped record still passes type guard (validates on skip path)', () => {
    const session = makeV1Session();
    const result  = runMigration(session, new MigrationRegistry(), isPersistedSession, 1);
    expect(isPersistedSession(result)).toBe(true);
  });

  it('RM-03: throws MigrationError(DOWNGRADE) when record.schemaVersion > targetVersion', () => {
    const futureRecord = { ...makeV1Session(), schemaVersion: 99 };
    let err: unknown;
    try { runMigration(futureRecord, new MigrationRegistry(), isPersistedSession, 1); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('DOWNGRADE');
    expect((err as MigrationError).fromVersion).toBe(99);
    expect((err as MigrationError).toVersion).toBe(1);
  });

  it('RM-04: throws MigrationError(VALIDATION_FAILED) when current-version record fails guard', () => {
    const session       = makeV1Session();
    const alwaysFalse   = (_obj: unknown): _obj is PersistedSession => false;
    let err: unknown;
    try { runMigration(session, new MigrationRegistry(), alwaysFalse, 1); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('VALIDATION_FAILED');
  });

  it('RM-05: applies a single migration step and returns the updated record', () => {
    const stale  = makeStaleSession(0);
    const r      = makeRegistryWith(v0ToV1);
    const result = runMigration(stale, r, isPersistedSession, 1);
    expect(result.schemaVersion).toBe(1);
    expect(result.sessionId).toBe(stale.sessionId);
  });

  it('RM-06: applies multi-step chain in order (v0→v1→v2→v3)', () => {
    const stale  = makeStaleSession(0);
    const r      = makeRegistryWith(v0ToV1, v1ToV2, v2ToV3);
    // Use a lenient guard since schemaVersion will be 3 (above PERSISTENCE_SCHEMA_VERSION)
    const anyRecord = (obj: unknown): obj is PersistedSession =>
      typeof obj === 'object' && obj !== null && typeof (obj as Record<string,unknown>)['sessionId'] === 'string';
    const result = runMigration(stale, r, anyRecord, 3);
    expect((result as unknown as Record<string, unknown>)['schemaVersion']).toBe(3);
  });

  it('RM-07: multi-step chain executes in correct fromVersion order', () => {
    const executionOrder: number[] = [];
    const m0to1: SchemaMigration = {
      fromVersion: 0, toVersion: 1, description: 'step-0',
      migrate: (d) => { executionOrder.push(0); return { ...(d as Record<string,unknown>), schemaVersion: 1 }; },
    };
    const m1to2: SchemaMigration = {
      fromVersion: 1, toVersion: 2, description: 'step-1',
      migrate: (d) => { executionOrder.push(1); return { ...(d as Record<string,unknown>), schemaVersion: 2 }; },
    };
    const r = makeRegistryWith(m0to1, m1to2);
    const anyRecord = (obj: unknown): obj is PersistedSession =>
      typeof obj === 'object' && obj !== null && typeof (obj as Record<string,unknown>)['sessionId'] === 'string';
    runMigration(makeStaleSession(0), r, anyRecord, 2);
    expect(executionOrder).toEqual([0, 1]);
  });

  it('RM-08: throws MigrationError(MISSING_STEP) when a step in the chain is absent', () => {
    const stale = makeStaleSession(0);
    const r     = makeRegistryWith(v0ToV1); // has 0→1 but not 1→2
    let err: unknown;
    try { runMigration(stale, r, isPersistedSession, 2); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('MISSING_STEP');
  });

  it('RM-09: throws MigrationError(MIGRATION_FAILED) when migrate() function throws', () => {
    const stale: SchemaMigration = {
      fromVersion: 0, toVersion: 1, description: 'boom',
      migrate: () => { throw new Error('intentional test error'); },
    };
    const r = makeRegistryWith(stale);
    let err: unknown;
    try { runMigration(makeStaleSession(0), r, isPersistedSession, 1); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('MIGRATION_FAILED');
    expect((err as MigrationError).cause).toBeInstanceOf(Error);
  });

  it('RM-10: MIGRATION_FAILED carries the original error as .cause', () => {
    const originalErr = new TypeError('bad migration');
    const m: SchemaMigration = {
      fromVersion: 0, toVersion: 1, description: 'throws',
      migrate: () => { throw originalErr; },
    };
    let err: MigrationError | undefined;
    try { runMigration(makeStaleSession(0), makeRegistryWith(m), isPersistedSession, 1); }
    catch (e) { err = e as MigrationError; }
    expect(err!.cause).toBe(originalErr);
  });

  it('RM-11: throws MigrationError(VALIDATION_FAILED) when migrated result fails type guard', () => {
    const badMigration: SchemaMigration = {
      fromVersion: 0, toVersion: 1, description: 'produces invalid record',
      migrate: () => ({ schemaVersion: 1 }), // missing required session fields
    };
    let err: unknown;
    try { runMigration(makeStaleSession(0), makeRegistryWith(badMigration), isPersistedSession, 1); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('VALIDATION_FAILED');
  });

  it('RM-12: does not mutate the original record', () => {
    const original = makeStaleSession(0);
    const goalBefore = original.goal;
    const r = makeRegistryWith(v0ToV1);
    runMigration(original, r, isPersistedSession, 1);
    expect(original.goal).toBe(goalBefore);
    expect(original.schemaVersion).toBe(0); // original still v0
  });

  it('RM-13: throws MigrationError(VALIDATION_FAILED) when input is not an object', () => {
    let err: unknown;
    try { runMigration(null, new MigrationRegistry(), isPersistedSession, 1); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).code).toBe('VALIDATION_FAILED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Typed convenience wrappers
// ═════════════════════════════════════════════════════════════════════════════

describe('Typed convenience wrappers', () => {
  it('CW-01: migrateSession() returns a PersistedSession from a stale record', () => {
    const result = migrateSession(makeStaleSession(0), makeRegistryWith(v0ToV1));
    expect(isPersistedSession(result)).toBe(true);
    expect(result.schemaVersion).toBe(1);
  });

  it('CW-02: migrateTrace() returns a PersistedTrace from a stale record', () => {
    const result = migrateTrace(makeStaleTrace(0), makeRegistryWith(v0ToV1));
    expect(isPersistedTrace(result)).toBe(true);
    expect(result.schemaVersion).toBe(1);
  });

  it('CW-03: migrateSnapshot() returns an ExportSnapshot from a stale record', () => {
    const stale = makeStaleSnapshot(0);
    // The snapshot's inner session also has schemaVersion: 0; the migration must
    // handle the top-level field. isExportSnapshot defers to isPersistedSession
    // which accepts any numeric schemaVersion, so v1→session-guard still passes.
    const m: SchemaMigration = {
      fromVersion: 0, toVersion: 1, description: 'bump top-level version',
      migrate: (d) => {
        const rec = d as Record<string, unknown>;
        const sess = rec['session'] as Record<string, unknown>;
        return { ...rec, schemaVersion: 1, session: { ...sess, schemaVersion: 1 } };
      },
    };
    const result = migrateSnapshot(stale, makeRegistryWith(m));
    expect(isExportSnapshot(result)).toBe(true);
    expect(result.schemaVersion).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MigratingSessionStore
// ═════════════════════════════════════════════════════════════════════════════

describe('MigratingSessionStore', () => {
  let inner:    InMemorySessionStore;
  let registry: MigrationRegistry;
  let store:    MigratingSessionStore;

  beforeEach(() => {
    inner    = new InMemorySessionStore();
    registry = makeRegistryWith(v0ToV1);
    store    = new MigratingSessionStore(inner, registry);
  });

  it('MS-01: loadSession returns null when inner store has no record', async () => {
    expect(await store.loadSession('missing')).toBeNull();
  });

  it('MS-02: loadSession returns current-version record without triggering migration', async () => {
    const session = makeV1Session({ sessionId: 's-current' });
    await inner.saveSession(session);
    const loaded = await store.loadSession('s-current');
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MS-03: loadSession migrates a stale record and returns the upgraded record', async () => {
    // Save v0 record directly to inner store (bypassing decorator)
    await inner.saveSession(makeStaleSession(0));
    const loaded = await store.loadSession('sess-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MS-04: after migration, the upgraded record is written back to the inner store', async () => {
    await inner.saveSession(makeStaleSession(0));
    await store.loadSession('sess-001'); // triggers migration + write-back
    const stored = await inner.loadSession('sess-001');
    expect(stored!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MS-05: loadSession throws MigrationError(DOWNGRADE) for a future-version record', async () => {
    await inner.saveSession({ ...makeV1Session(), schemaVersion: 99 });
    await expect(store.loadSession('sess-001')).rejects.toBeInstanceOf(MigrationError);
    const err = await store.loadSession('sess-001').catch((e) => e as MigrationError);
    expect(err.code).toBe('DOWNGRADE');
  });

  it('MS-06: saveSession delegates to inner store', async () => {
    const session = makeV1Session({ sessionId: 'delegated' });
    await store.saveSession(session);
    expect(await inner.loadSession('delegated')).not.toBeNull();
  });

  it('MS-07: deleteSession delegates to inner store', async () => {
    await inner.saveSession(makeV1Session({ sessionId: 'to-delete' }));
    await store.deleteSession('to-delete');
    expect(await inner.loadSession('to-delete')).toBeNull();
  });

  it('MS-08: listSessions delegates to inner store and returns same list', async () => {
    await inner.saveSession(makeV1Session({ sessionId: 'a', savedAt: 200 }));
    await inner.saveSession(makeV1Session({ sessionId: 'b', savedAt: 100 }));
    expect(await store.listSessions()).toEqual(['a', 'b']);
  });

  it('MS-09: migrated record preserves all original fields (goal, specRetries, etc.)', async () => {
    const stale = { ...makeStaleSession(0), goal: 'preserve me', specRetries: 3 };
    await inner.saveSession(stale);
    const loaded = await store.loadSession('sess-001');
    expect(loaded!.goal).toBe('preserve me');
    expect(loaded!.specRetries).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MigratingTraceStore
// ═════════════════════════════════════════════════════════════════════════════

describe('MigratingTraceStore', () => {
  let inner:    InMemoryTraceStore;
  let store:    MigratingTraceStore;

  beforeEach(() => {
    inner = new InMemoryTraceStore();
    store = new MigratingTraceStore(inner, makeRegistryWith(v0ToV1));
  });

  it('MT-01: loadTrace returns null for a missing traceId', async () => {
    expect(await store.loadTrace('missing')).toBeNull();
  });

  it('MT-02: loadTrace returns a current-version trace without migrating', async () => {
    await inner.saveTrace(makeV1Trace('t-current'));
    const loaded = await store.loadTrace('t-current');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MT-03: loadTrace migrates a stale trace and returns the upgraded record', async () => {
    await inner.saveTrace(makeStaleTrace(0));
    const loaded = await store.loadTrace('trace-001');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MT-04: after migration, the upgraded trace is written back to the inner store', async () => {
    await inner.saveTrace(makeStaleTrace(0));
    await store.loadTrace('trace-001');
    const stored = await inner.loadTrace('trace-001');
    expect(stored!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('MT-05: saveTrace and listTraces delegate to inner store', async () => {
    const trace = makeV1Trace('delegated');
    await store.saveTrace(trace);
    expect(await inner.loadTrace('delegated')).not.toBeNull();
    expect(await store.listTraces()).toContain('delegated');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MigratingExportStore
// ═════════════════════════════════════════════════════════════════════════════

describe('MigratingExportStore', () => {
  let inner:    InMemoryExportStore;
  let store:    MigratingExportStore;

  /** A migration that bumps both the top-level and inner session schemaVersion. */
  const v0ToV1Snapshot: SchemaMigration = {
    fromVersion: 0, toVersion: 1, description: 'bump snapshot + session schemaVersion',
    migrate: (d) => {
      const rec  = d as Record<string, unknown>;
      const sess = rec['session'] as Record<string, unknown>;
      return { ...rec, schemaVersion: 1, session: { ...sess, schemaVersion: 1 } };
    },
  };

  beforeEach(() => {
    inner = new InMemoryExportStore();
    store = new MigratingExportStore(inner, makeRegistryWith(v0ToV1Snapshot));
  });

  it('ME-01: loadSnapshot returns null for a missing snapshotId', async () => {
    expect(await store.loadSnapshot('missing')).toBeNull();
  });

  it('ME-02: loadSnapshot returns a current-version snapshot without migrating', async () => {
    await inner.saveSnapshot(makeV1Snapshot('s-current'));
    const loaded = await store.loadSnapshot('s-current');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('ME-03: loadSnapshot migrates a stale snapshot and writes back to inner store', async () => {
    await inner.saveSnapshot(makeStaleSnapshot(0));
    const loaded = await store.loadSnapshot('snap-001');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    const stored = await inner.loadSnapshot('snap-001');
    expect(stored!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('ME-04: saveSnapshot and listSnapshots delegate to inner store', async () => {
    const snap = makeV1Snapshot('delegated');
    await store.saveSnapshot(snap);
    expect(await inner.loadSnapshot('delegated')).not.toBeNull();
    expect(await store.listSnapshots()).toContain('delegated');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createMigratingPersistenceLayer
// ═════════════════════════════════════════════════════════════════════════════

describe('createMigratingPersistenceLayer()', () => {
  it('ML-01: returns an IPersistenceLayer with sessions, traces, and exports properties', () => {
    const layer = createMigratingPersistenceLayer(new MigrationRegistry());
    expect(layer.sessions).toBeDefined();
    expect(layer.traces).toBeDefined();
    expect(layer.exports).toBeDefined();
  });

  it('ML-02: sessions is a MigratingSessionStore instance', () => {
    const layer = createMigratingPersistenceLayer(new MigrationRegistry());
    expect(layer.sessions).toBeInstanceOf(MigratingSessionStore);
  });

  it('ML-03: two calls return independent layers — data in one is not visible in the other', async () => {
    const layer1 = createMigratingPersistenceLayer(new MigrationRegistry());
    const layer2 = createMigratingPersistenceLayer(new MigrationRegistry());
    await layer1.sessions.saveSession(makeV1Session({ sessionId: 'shared-id' }));
    expect(await layer2.sessions.loadSession('shared-id')).toBeNull();
  });

  it('ML-04: all three sub-stores work end-to-end through the layer interface', async () => {
    const layer = createMigratingPersistenceLayer(makeRegistryWith(v0ToV1));
    await layer.sessions.saveSession(makeV1Session({ sessionId: 'e2e' }));
    await layer.traces.saveTrace(makeV1Trace('e2e-trace'));
    await layer.exports.saveSnapshot(makeV1Snapshot('e2e-snap'));
    expect(await layer.sessions.loadSession('e2e')).not.toBeNull();
    expect(await layer.traces.loadTrace('e2e-trace')).not.toBeNull();
    expect(await layer.exports.loadSnapshot('e2e-snap')).not.toBeNull();
  });
});
