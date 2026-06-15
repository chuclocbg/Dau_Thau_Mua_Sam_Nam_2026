/**
 * P6-08B: In-memory persistence store tests
 *
 * Each test creates its own isolated store instance — no shared state between
 * tests.  Groups mirror the three concrete implementations plus the factory.
 *
 * Groups:
 *   IS-01..IS-10  — InMemorySessionStore
 *   IT-01..IT-08  — InMemoryTraceStore
 *   IE-01..IE-07  — InMemoryExportStore
 *   IL-01..IL-04  — createInMemoryPersistenceLayer (factory)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryExportStore,
  createInMemoryPersistenceLayer,
} from '../persistence/memory';

import {
  PERSISTENCE_SCHEMA_VERSION,
  serializeSession,
  serializeTrace,
  createExportSnapshot,
} from '../persistence/schema';

import type { PersistedSession, PersistedTrace, ExportSnapshot } from '../persistence/schema';
import type { AgentMessage }  from '../agents/types';
import type { AgentSession }  from '../agents/AutonomousAgent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(traceId = 'trace-001', ts = Date.now()): AgentMessage {
  return {
    traceId,
    from:      'autonomous',
    to:        'planner',
    type:      'request',
    payload:   { action: 'run' },
    timestamp: ts,
  };
}

function makeLiveSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'sess-001',
    state:       'ready-for-export',
    goal:        'mua sắm văn phòng phẩm',
    messageLog:  [makeMsg()],
    startedAt:   1_700_000_000_000,
    completedAt: 1_700_000_001_000,
    specRetries: 0,
    totalBudget: 200_000_000,
    budgetYear:  2026,
    ...overrides,
  };
}

function makePersistedSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    ...serializeSession(makeLiveSession()),
    ...overrides,
  };
}

function makePersistedTrace(traceId = 'trace-001', overrides: Partial<PersistedTrace> = {}): PersistedTrace {
  return {
    ...serializeTrace(traceId, [makeMsg(traceId, 1_000), makeMsg(traceId, 2_000)]),
    ...overrides,
  };
}

function makeSnapshot(snapshotId = 'snap-001', exportedAt = Date.now()): ExportSnapshot {
  return {
    ...createExportSnapshot({
      snapshotId,
      session:    makeLiveSession(),
      traces:     [{ traceId: 'trace-001', messages: [makeMsg()] }],
      legalBasis: ['Điều 44 Luật Đấu thầu 22/2023/QH15'],
      summary:    'Hồ sơ đã hoàn tất.',
    }),
    exportedAt,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// InMemorySessionStore
// ═════════════════════════════════════════════════════════════════════════════

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => { store = new InMemorySessionStore(); });

  it('IS-01: saveSession + loadSession round-trips the record', async () => {
    const session = makePersistedSession({ sessionId: 's-001', goal: 'test round-trip' });
    await store.saveSession(session);
    const loaded = await store.loadSession('s-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('s-001');
    expect(loaded!.goal).toBe('test round-trip');
  });

  it('IS-02: loaded record preserves schemaVersion', async () => {
    const session = makePersistedSession({ sessionId: 's-002' });
    await store.saveSession(session);
    const loaded = await store.loadSession('s-002');
    expect(loaded!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('IS-03: loadSession returns null for unknown sessionId', async () => {
    expect(await store.loadSession('does-not-exist')).toBeNull();
  });

  it('IS-04: deleteSession removes the record — subsequent load returns null', async () => {
    await store.saveSession(makePersistedSession({ sessionId: 's-004' }));
    await store.deleteSession('s-004');
    expect(await store.loadSession('s-004')).toBeNull();
  });

  it('IS-05: deleteSession on unknown id is a silent no-op', async () => {
    await expect(store.deleteSession('no-such-id')).resolves.toBeUndefined();
  });

  it('IS-06: listSessions returns all saved sessionIds', async () => {
    await store.saveSession(makePersistedSession({ sessionId: 'a', savedAt: 100 }));
    await store.saveSession(makePersistedSession({ sessionId: 'b', savedAt: 200 }));
    await store.saveSession(makePersistedSession({ sessionId: 'c', savedAt: 300 }));
    const list = await store.listSessions();
    expect(list).toHaveLength(3);
    expect(list).toContain('a');
    expect(list).toContain('b');
    expect(list).toContain('c');
  });

  it('IS-07: listSessions returns newest-first (by savedAt descending)', async () => {
    await store.saveSession(makePersistedSession({ sessionId: 'old',    savedAt: 100 }));
    await store.saveSession(makePersistedSession({ sessionId: 'middle', savedAt: 200 }));
    await store.saveSession(makePersistedSession({ sessionId: 'new',    savedAt: 300 }));
    const list = await store.listSessions();
    expect(list[0]).toBe('new');
    expect(list[1]).toBe('middle');
    expect(list[2]).toBe('old');
  });

  it('IS-08: listSessions returns empty array when store is empty', async () => {
    expect(await store.listSessions()).toEqual([]);
  });

  it('IS-09: saveSession again with same sessionId replaces the earlier record', async () => {
    await store.saveSession(makePersistedSession({ sessionId: 's-009', goal: 'original' }));
    await store.saveSession(makePersistedSession({ sessionId: 's-009', goal: 'updated'  }));
    const loaded = await store.loadSession('s-009');
    expect(loaded!.goal).toBe('updated');
    expect(await store.listSessions()).toHaveLength(1); // still only one entry
  });

  it('IS-10: mutating the saved object after saveSession does not affect stored record', async () => {
    const session = makePersistedSession({ sessionId: 's-010', goal: 'original' });
    await store.saveSession(session);
    session.goal = 'mutated after save';
    const loaded = await store.loadSession('s-010');
    expect(loaded!.goal).toBe('original');
  });

  it('IS-11: mutating the loaded object does not affect stored record', async () => {
    await store.saveSession(makePersistedSession({ sessionId: 's-011', goal: 'stable' }));
    const loaded = await store.loadSession('s-011');
    loaded!.goal = 'mutated after load';
    const reload = await store.loadSession('s-011');
    expect(reload!.goal).toBe('stable');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InMemoryTraceStore
// ═════════════════════════════════════════════════════════════════════════════

describe('InMemoryTraceStore', () => {
  let store: InMemoryTraceStore;

  beforeEach(() => { store = new InMemoryTraceStore(); });

  it('IT-01: saveTrace + loadTrace round-trips the record', async () => {
    const trace = makePersistedTrace('t-001');
    await store.saveTrace(trace);
    const loaded = await store.loadTrace('t-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.traceId).toBe('t-001');
    expect(loaded!.messages).toHaveLength(2);
  });

  it('IT-02: loadTrace returns null for unknown traceId', async () => {
    expect(await store.loadTrace('unknown')).toBeNull();
  });

  it('IT-03: deleteTrace removes the record', async () => {
    await store.saveTrace(makePersistedTrace('t-003'));
    await store.deleteTrace('t-003');
    expect(await store.loadTrace('t-003')).toBeNull();
  });

  it('IT-04: deleteTrace on unknown id is a silent no-op', async () => {
    await expect(store.deleteTrace('no-such-trace')).resolves.toBeUndefined();
  });

  it('IT-05: listTraces returns all stored traceIds', async () => {
    await store.saveTrace(makePersistedTrace('ta', { createdAt: 100, updatedAt: 100 }));
    await store.saveTrace(makePersistedTrace('tb', { createdAt: 200, updatedAt: 200 }));
    const list = await store.listTraces();
    expect(list).toHaveLength(2);
    expect(list).toContain('ta');
    expect(list).toContain('tb');
  });

  it('IT-06: listTraces returns newest-first (by createdAt descending)', async () => {
    await store.saveTrace(makePersistedTrace('old',    { createdAt: 100, updatedAt: 100 }));
    await store.saveTrace(makePersistedTrace('recent', { createdAt: 300, updatedAt: 300 }));
    await store.saveTrace(makePersistedTrace('middle', { createdAt: 200, updatedAt: 200 }));
    const list = await store.listTraces();
    expect(list[0]).toBe('recent');
    expect(list[2]).toBe('old');
  });

  it('IT-07: listTraces returns empty array when store is empty', async () => {
    expect(await store.listTraces()).toEqual([]);
  });

  it('IT-08: mutating the saved trace does not affect stored record', async () => {
    const trace = makePersistedTrace('t-008');
    await store.saveTrace(trace);
    trace.messages.push({ traceId: 't-008', from: 'risk', to: 'autonomous', type: 'response', payload: {}, timestamp: 9999 });
    const loaded = await store.loadTrace('t-008');
    expect(loaded!.messages).toHaveLength(2); // original length preserved
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InMemoryExportStore
// ═════════════════════════════════════════════════════════════════════════════

describe('InMemoryExportStore', () => {
  let store: InMemoryExportStore;

  beforeEach(() => { store = new InMemoryExportStore(); });

  it('IE-01: saveSnapshot + loadSnapshot round-trips the record', async () => {
    const snap = makeSnapshot('s-001', 1_000);
    await store.saveSnapshot(snap);
    const loaded = await store.loadSnapshot('s-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshotId).toBe('s-001');
    expect(loaded!.legalBasis).toEqual(snap.legalBasis);
  });

  it('IE-02: loadSnapshot returns null for unknown snapshotId', async () => {
    expect(await store.loadSnapshot('no-snap')).toBeNull();
  });

  it('IE-03: listSnapshots returns all stored snapshotIds', async () => {
    await store.saveSnapshot(makeSnapshot('snap-a', 100));
    await store.saveSnapshot(makeSnapshot('snap-b', 200));
    const list = await store.listSnapshots();
    expect(list).toHaveLength(2);
    expect(list).toContain('snap-a');
    expect(list).toContain('snap-b');
  });

  it('IE-04: listSnapshots returns newest-first (by exportedAt descending)', async () => {
    await store.saveSnapshot(makeSnapshot('newest', 300));
    await store.saveSnapshot(makeSnapshot('oldest', 100));
    await store.saveSnapshot(makeSnapshot('middle', 200));
    const list = await store.listSnapshots();
    expect(list[0]).toBe('newest');
    expect(list[2]).toBe('oldest');
  });

  it('IE-05: listSnapshots returns empty array when store is empty', async () => {
    expect(await store.listSnapshots()).toEqual([]);
  });

  it('IE-06: mutating the saved snapshot does not affect stored record', async () => {
    const snap = makeSnapshot('s-006', 1_000);
    await store.saveSnapshot(snap);
    snap.summary = 'mutated';
    const loaded = await store.loadSnapshot('s-006');
    expect(loaded!.summary).toBe('Hồ sơ đã hoàn tất.');
  });

  it('IE-07: mutating the loaded snapshot does not affect stored record', async () => {
    await store.saveSnapshot(makeSnapshot('s-007', 1_000));
    const loaded = await store.loadSnapshot('s-007');
    loaded!.summary = 'mutated after load';
    const reload = await store.loadSnapshot('s-007');
    expect(reload!.summary).toBe('Hồ sơ đã hoàn tất.');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createInMemoryPersistenceLayer (factory)
// ═════════════════════════════════════════════════════════════════════════════

describe('createInMemoryPersistenceLayer()', () => {
  it('IL-01: returns an object with sessions, traces, and exports properties', () => {
    const layer = createInMemoryPersistenceLayer();
    expect(layer.sessions).toBeDefined();
    expect(layer.traces).toBeDefined();
    expect(layer.exports).toBeDefined();
  });

  it('IL-02: sessions is an InMemorySessionStore instance', () => {
    const layer = createInMemoryPersistenceLayer();
    expect(layer.sessions).toBeInstanceOf(InMemorySessionStore);
  });

  it('IL-03: each call returns an independent layer — no shared state', async () => {
    const layer1 = createInMemoryPersistenceLayer();
    const layer2 = createInMemoryPersistenceLayer();

    await layer1.sessions.saveSession(makePersistedSession({ sessionId: 'shared-id' }));

    // layer2 must not see data saved into layer1
    expect(await layer2.sessions.loadSession('shared-id')).toBeNull();
  });

  it('IL-04: all three sub-stores work end-to-end through the layer interface', async () => {
    const layer = createInMemoryPersistenceLayer();

    const session = makePersistedSession({ sessionId: 'e2e-session' });
    const trace   = makePersistedTrace('e2e-trace');
    const snap    = makeSnapshot('e2e-snap');

    await layer.sessions.saveSession(session);
    await layer.traces.saveTrace(trace);
    await layer.exports.saveSnapshot(snap);

    expect(await layer.sessions.loadSession('e2e-session')).not.toBeNull();
    expect(await layer.traces.loadTrace('e2e-trace')).not.toBeNull();
    expect(await layer.exports.loadSnapshot('e2e-snap')).not.toBeNull();
  });
});
