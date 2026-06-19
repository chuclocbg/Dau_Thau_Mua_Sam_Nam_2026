/**
 * P9-04: AgentSessionStore — 56 tests
 *
 * Groups:
 *   SS-01 (7)  Module exports and constant
 *   SS-02 (7)  IDB path — basic CRUD (save / load / list / delete)
 *   SS-03 (7)  IDB path — ordering and list semantics
 *   SS-04 (7)  Eviction policy (10-session cap + custom cap)
 *   SS-05 (7)  In-memory / SSR fallback (no factory → globalThis.indexedDB absent in Node)
 *   SS-06 (7)  IDB open failure → silent fallback to in-memory
 *   SS-07 (7)  Round-trip deserialization fidelity
 *   SS-08 (7)  Edge cases (upsert, isolation, options)
 *
 * Note: vi.useFakeTimers() is NOT used because it blocks fake-indexeddb's internal
 * promise callbacks.  Instead, vi.spyOn(Date, 'now') provides a monotonic counter
 * so each serializeSession() call gets a distinct savedAt without breaking IDB.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  createAgentSessionStore,
  SESSION_STORE_MAX,
} from '../persistence/agentSessionStore';
import type { AgentSessionStore } from '../persistence/agentSessionStore';
import type { AgentSession } from '../agents/AutonomousAgent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSession(id = 'sess-001', opts: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   id,
    state:       'idle',
    goal:        'Mua thiết bị văn phòng',
    messageLog:  [],
    startedAt:   1_700_000_000_000,
    specRetries: 0,
    ...opts,
  };
}

/** Returns a monotonic Date.now spy so each save gets a unique savedAt. */
function mockDateNow(): () => void {
  let tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => ++tick);
  return () => vi.restoreAllMocks();
}

// ─── SS-01: Module exports and constant ──────────────────────────────────────

describe('SS-01 · module exports and constant', () => {
  it('SS-01-01: createAgentSessionStore is a function', () => {
    expect(typeof createAgentSessionStore).toBe('function');
  });

  it('SS-01-02: SESSION_STORE_MAX equals 10', () => {
    expect(SESSION_STORE_MAX).toBe(10);
  });

  it('SS-01-03: createAgentSessionStore() returns an object', () => {
    expect(typeof createAgentSessionStore()).toBe('object');
  });

  it('SS-01-04: returned store has saveSession method', () => {
    expect(typeof createAgentSessionStore().saveSession).toBe('function');
  });

  it('SS-01-05: returned store has loadSession method', () => {
    expect(typeof createAgentSessionStore().loadSession).toBe('function');
  });

  it('SS-01-06: returned store has listSessions method', () => {
    expect(typeof createAgentSessionStore().listSessions).toBe('function');
  });

  it('SS-01-07: returned store has deleteSession method', () => {
    expect(typeof createAgentSessionStore().deleteSession).toBe('function');
  });
});

// ─── SS-02: IDB path — basic CRUD ────────────────────────────────────────────

describe('SS-02 · IDB path — basic CRUD', () => {
  let store: AgentSessionStore;

  beforeEach(() => {
    store = createAgentSessionStore({ factory: new IDBFactory() });
  });

  it('SS-02-01: saveSession resolves without error', async () => {
    await expect(store.saveSession(makeSession())).resolves.toBeUndefined();
  });

  it('SS-02-02: loadSession returns the session after save', async () => {
    await store.saveSession(makeSession('s1'));
    const loaded = await store.loadSession('s1');
    expect(loaded).not.toBeNull();
  });

  it('SS-02-03: loadSession returns null for unknown id', async () => {
    expect(await store.loadSession('nonexistent')).toBeNull();
  });

  it('SS-02-04: loaded session has same sessionId', async () => {
    await store.saveSession(makeSession('s2'));
    expect((await store.loadSession('s2'))?.sessionId).toBe('s2');
  });

  it('SS-02-05: loaded session has same goal', async () => {
    await store.saveSession(makeSession('s3', { goal: 'Mua máy chiếu' }));
    expect((await store.loadSession('s3'))?.goal).toBe('Mua máy chiếu');
  });

  it('SS-02-06: loaded session has same state', async () => {
    await store.saveSession(makeSession('s4', { state: 'planning' }));
    expect((await store.loadSession('s4'))?.state).toBe('planning');
  });

  it('SS-02-07: loaded session has same startedAt', async () => {
    await store.saveSession(makeSession('s5', { startedAt: 9_999_999 }));
    expect((await store.loadSession('s5'))?.startedAt).toBe(9_999_999);
  });
});

// ─── SS-03: IDB path — ordering and list semantics ───────────────────────────

describe('SS-03 · IDB path — ordering and list semantics', () => {
  let store: AgentSessionStore;
  let restoreDateNow: () => void;

  beforeEach(() => {
    store = createAgentSessionStore({ factory: new IDBFactory() });
    restoreDateNow = mockDateNow();
  });

  afterEach(() => restoreDateNow());

  it('SS-03-01: empty store → listSessions returns []', async () => {
    expect(await store.listSessions()).toEqual([]);
  });

  it('SS-03-02: one saved session → listSessions returns [sessionId]', async () => {
    await store.saveSession(makeSession('a'));
    expect(await store.listSessions()).toEqual(['a']);
  });

  it('SS-03-03: two saved sessions → list has 2 entries', async () => {
    await store.saveSession(makeSession('a'));
    await store.saveSession(makeSession('b'));
    expect((await store.listSessions()).length).toBe(2);
  });

  it('SS-03-04: list returns newest-first (higher savedAt comes first)', async () => {
    await store.saveSession(makeSession('older'));
    await store.saveSession(makeSession('newer'));
    const ids = await store.listSessions();
    expect(ids[0]).toBe('newer');
    expect(ids[1]).toBe('older');
  });

  it('SS-03-05: deleteSession removes sessionId from list', async () => {
    await store.saveSession(makeSession('x'));
    await store.deleteSession('x');
    expect(await store.listSessions()).not.toContain('x');
  });

  it('SS-03-06: deleteSession makes loadSession return null', async () => {
    await store.saveSession(makeSession('y'));
    await store.deleteSession('y');
    expect(await store.loadSession('y')).toBeNull();
  });

  it('SS-03-07: deleteSession on unknown id → no error', async () => {
    await expect(store.deleteSession('does-not-exist')).resolves.toBeUndefined();
  });
});

// ─── SS-04: Eviction policy ───────────────────────────────────────────────────

describe('SS-04 · Eviction policy', () => {
  let restoreDateNow: () => void;

  beforeEach(() => { restoreDateNow = mockDateNow(); });
  afterEach(() => restoreDateNow());

  async function saveBatch(store: AgentSessionStore, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await store.saveSession(makeSession(`sess-${i}`));
    }
  }

  it('SS-04-01: save 10 sessions → listSessions has exactly 10', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 10);
    expect((await store.listSessions()).length).toBe(10);
  });

  it('SS-04-02: save 11 sessions → listSessions has exactly 10', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 11);
    expect((await store.listSessions()).length).toBe(10);
  });

  it('SS-04-03: save 15 sessions → listSessions has exactly 10', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 15);
    expect((await store.listSessions()).length).toBe(10);
  });

  it('SS-04-04: newest 10 are retained; sess-0 (oldest) is absent after 11 saves', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 11);
    const ids = await store.listSessions();
    expect(ids).not.toContain('sess-0');
    expect(ids).toContain('sess-10');
  });

  it('SS-04-05: oldest evicted session is unloadable', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 11);
    expect(await store.loadSession('sess-0')).toBeNull();
  });

  it('SS-04-06: custom maxSessions cap is respected', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory(), maxSessions: 3 });
    await saveBatch(store, 5);
    expect((await store.listSessions()).length).toBe(3);
  });

  it('SS-04-07: upsert (re-save same id) does not push count past cap', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await saveBatch(store, 10);
    await store.saveSession(makeSession('sess-0', { goal: 'Updated' }));
    expect((await store.listSessions()).length).toBe(10);
  });
});

// ─── SS-05: In-memory / SSR fallback ─────────────────────────────────────────

describe('SS-05 · In-memory / SSR fallback (no factory)', () => {
  it('SS-05-01: createAgentSessionStore() resolves without error in Node.js', async () => {
    const store = createAgentSessionStore();
    await expect(store.listSessions()).resolves.toBeDefined();
  });

  it('SS-05-02: saveSession works in fallback', async () => {
    const store = createAgentSessionStore();
    await expect(store.saveSession(makeSession('f1'))).resolves.toBeUndefined();
  });

  it('SS-05-03: loadSession returns saved session in fallback', async () => {
    const store = createAgentSessionStore();
    await store.saveSession(makeSession('f2'));
    expect(await store.loadSession('f2')).not.toBeNull();
  });

  it('SS-05-04: listSessions returns stored id in fallback', async () => {
    const store = createAgentSessionStore();
    await store.saveSession(makeSession('f3'));
    expect(await store.listSessions()).toContain('f3');
  });

  it('SS-05-05: deleteSession works in fallback', async () => {
    const store = createAgentSessionStore();
    await store.saveSession(makeSession('f4'));
    await store.deleteSession('f4');
    expect(await store.loadSession('f4')).toBeNull();
  });

  it('SS-05-06: eviction (11 sessions → 10) works in fallback', async () => {
    const store = createAgentSessionStore();
    const restore = mockDateNow();
    for (let i = 0; i <= 10; i++) {
      await store.saveSession(makeSession(`fb-${i}`));
    }
    restore();
    expect((await store.listSessions()).length).toBe(10);
  });

  it('SS-05-07: two stores are isolated — each has its own in-memory Map', async () => {
    const storeA = createAgentSessionStore();
    const storeB = createAgentSessionStore();
    await storeA.saveSession(makeSession('shared-id'));
    expect(await storeB.loadSession('shared-id')).toBeNull();
  });
});

// ─── SS-06: IDB open failure → silent fallback ───────────────────────────────

describe('SS-06 · IDB open failure → in-memory fallback', () => {
  const failingFactory = {
    open() { throw new Error('IDB unavailable in test'); },
  } as unknown as IDBFactory;

  it('SS-06-01: createAgentSessionStore() with failing factory does not throw', () => {
    expect(() => createAgentSessionStore({ factory: failingFactory })).not.toThrow();
  });

  it('SS-06-02: saveSession resolves after IDB failure', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    await expect(store.saveSession(makeSession('e1'))).resolves.toBeUndefined();
  });

  it('SS-06-03: loadSession returns saved session after IDB failure', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    await store.saveSession(makeSession('e2'));
    expect(await store.loadSession('e2')).not.toBeNull();
  });

  it('SS-06-04: listSessions resolves to array after IDB failure', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    expect(Array.isArray(await store.listSessions())).toBe(true);
  });

  it('SS-06-05: deleteSession resolves after IDB failure', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    await store.saveSession(makeSession('e3'));
    await expect(store.deleteSession('e3')).resolves.toBeUndefined();
  });

  it('SS-06-06: eviction works in IDB-failure fallback', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    const restore = mockDateNow();
    for (let i = 0; i <= 10; i++) {
      await store.saveSession(makeSession(`ef-${i}`));
    }
    restore();
    expect((await store.listSessions()).length).toBe(10);
  });

  it('SS-06-07: empty list returned when nothing saved (fallback)', async () => {
    const store = createAgentSessionStore({ factory: failingFactory });
    expect(await store.listSessions()).toEqual([]);
  });
});

// ─── SS-07: Round-trip deserialization fidelity ───────────────────────────────

describe('SS-07 · Round-trip deserialization fidelity', () => {
  let store: AgentSessionStore;

  beforeEach(() => {
    store = createAgentSessionStore({ factory: new IDBFactory() });
  });

  it('SS-07-01: sessionId preserved across save/load', async () => {
    await store.saveSession(makeSession('rt-001'));
    expect((await store.loadSession('rt-001'))?.sessionId).toBe('rt-001');
  });

  it('SS-07-02: goal preserved across save/load', async () => {
    await store.saveSession(makeSession('rt-002', { goal: 'Mua hóa chất' }));
    expect((await store.loadSession('rt-002'))?.goal).toBe('Mua hóa chất');
  });

  it('SS-07-03: state preserved across save/load', async () => {
    await store.saveSession(makeSession('rt-003', { state: 'legal-review' }));
    expect((await store.loadSession('rt-003'))?.state).toBe('legal-review');
  });

  it('SS-07-04: startedAt preserved across save/load', async () => {
    await store.saveSession(makeSession('rt-004', { startedAt: 1_234_567 }));
    expect((await store.loadSession('rt-004'))?.startedAt).toBe(1_234_567);
  });

  it('SS-07-05: specRetries preserved across save/load', async () => {
    await store.saveSession(makeSession('rt-005', { specRetries: 2 }));
    expect((await store.loadSession('rt-005'))?.specRetries).toBe(2);
  });

  it('SS-07-06: messageLog length preserved across save/load', async () => {
    const msg = {
      traceId: 'tr-1', from: 'user' as const, to: 'planner' as const,
      type: 'request' as const, payload: {}, timestamp: 1000,
    };
    await store.saveSession(makeSession('rt-006', { messageLog: [msg] }));
    expect((await store.loadSession('rt-006'))?.messageLog.length).toBe(1);
  });

  it('SS-07-07: completedAt round-trips (present and absent)', async () => {
    await store.saveSession(makeSession('rt-007', { completedAt: 9_999 }));
    expect((await store.loadSession('rt-007'))?.completedAt).toBe(9_999);

    await store.saveSession(makeSession('rt-008'));
    expect((await store.loadSession('rt-008'))?.completedAt).toBeUndefined();
  });
});

// ─── SS-08: Edge cases ────────────────────────────────────────────────────────

describe('SS-08 · Edge cases', () => {
  it('SS-08-01: totalBudget and budgetYear round-trip', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await store.saveSession(makeSession('ec-1', { totalBudget: 5_000_000, budgetYear: 2026 }));
    const loaded = await store.loadSession('ec-1');
    expect(loaded?.totalBudget).toBe(5_000_000);
    expect(loaded?.budgetYear).toBe(2026);
  });

  it('SS-08-02: upsert (re-save same id) replaces goal in store', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await store.saveSession(makeSession('ec-2', { goal: 'original' }));
    await store.saveSession(makeSession('ec-2', { goal: 'updated' }));
    expect((await store.loadSession('ec-2'))?.goal).toBe('updated');
  });

  it('SS-08-03: upsert does not create duplicate in listSessions', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await store.saveSession(makeSession('ec-3'));
    await store.saveSession(makeSession('ec-3'));
    expect((await store.listSessions()).filter(id => id === 'ec-3').length).toBe(1);
  });

  it('SS-08-04: listSessions returns strings (not objects)', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await store.saveSession(makeSession('ec-4'));
    const ids = await store.listSessions();
    expect(typeof ids[0]).toBe('string');
  });

  it('SS-08-05: two createAgentSessionStore instances are isolated (IDB)', async () => {
    const storeA = createAgentSessionStore({ factory: new IDBFactory() });
    const storeB = createAgentSessionStore({ factory: new IDBFactory() });
    await storeA.saveSession(makeSession('ec-5'));
    expect(await storeB.loadSession('ec-5')).toBeNull();
  });

  it('SS-08-06: pendingQuestion field is preserved on round-trip', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    const q = { questionId: 'q1', agentId: 'planner' as const, question: 'Phương thức?', required: true };
    await store.saveSession(makeSession('ec-6', { pendingQuestion: q }));
    expect((await store.loadSession('ec-6'))?.pendingQuestion?.questionId).toBe('q1');
  });

  it('SS-08-07: save + delete + save same id works correctly', async () => {
    const store = createAgentSessionStore({ factory: new IDBFactory() });
    await store.saveSession(makeSession('ec-7', { goal: 'first' }));
    await store.deleteSession('ec-7');
    await store.saveSession(makeSession('ec-7', { goal: 'second' }));
    expect((await store.loadSession('ec-7'))?.goal).toBe('second');
  });
});
