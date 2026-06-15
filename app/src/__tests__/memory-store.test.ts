/**
 * P6-10S: MemoryStore — test suite (56 tests)
 *
 * Groups:
 *   MS1 (7)  save / load
 *   MS2 (6)  overwrite semantics
 *   MS3 (6)  delete
 *   MS4 (6)  listMemories
 *   MS5 (5)  clear
 *   MS6 (6)  timestamps
 *   MS7 (7)  immutability
 *   MS8 (7)  edge cases
 *   MS9 (6)  never-throw contract
 */

import { describe, it, expect } from 'vitest';
import { MemoryStore } from '../providers/MemoryStore';
import type { MemoryMessage } from '../providers/ConversationMemory';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fresh(): MemoryStore {
  return new MemoryStore();
}

const MSGS: MemoryMessage[] = [
  { role: 'user',      content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
];

function save(
  store: MemoryStore,
  id   = 'session-1',
  msgs: MemoryMessage[] = MSGS,
) {
  return store.saveMemory(id, msgs);
}

// ─── MS1: save / load ─────────────────────────────────────────────────────────

describe('MS1: save / load', () => {
  it('MS1-01: saveMemory returns ok:true', () => {
    expect(save(fresh()).ok).toBe(true);
  });

  it('MS1-02: loadMemory returns the snapshot after save', () => {
    const store = fresh();
    save(store);
    expect(store.loadMemory('session-1').ok).toBe(true);
  });

  it('MS1-03: sessionId is preserved in the returned snapshot', () => {
    const store = fresh();
    const r     = save(store, 'my-session');
    expect(r.ok && r.value.sessionId).toBe('my-session');
  });

  it('MS1-04: messages are present in the loaded snapshot', () => {
    const store = fresh();
    save(store);
    const r = store.loadMemory('session-1');
    expect(r.ok && r.value.messages).toHaveLength(2);
    expect(r.ok && r.value.messages[0]?.role).toBe('user');
    expect(r.ok && r.value.messages[0]?.content).toBe('Hello');
  });

  it('MS1-05: loadMemory returns MEMORY_NOT_FOUND for unknown sessionId', () => {
    const r = fresh().loadMemory('ghost');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('MEMORY_NOT_FOUND');
  });

  it('MS1-06: saveMemory with an empty messages array is valid', () => {
    const store = fresh();
    const r     = store.saveMemory('empty-session', []);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.messages).toHaveLength(0);
  });

  it('MS1-07: saved message content matches the original exactly', () => {
    const store = fresh();
    const msgs: MemoryMessage[] = [{ role: 'user', content: 'Test content' }];
    store.saveMemory('s', msgs);
    const r = store.loadMemory('s');
    expect(r.ok && r.value.messages[0]?.content).toBe('Test content');
  });
});

// ─── MS2: overwrite ───────────────────────────────────────────────────────────

describe('MS2: overwrite semantics', () => {
  it('MS2-01: saveMemory with same sessionId overwrites and returns ok:true', () => {
    const store = fresh();
    save(store);
    const r = store.saveMemory('session-1', [{ role: 'user', content: 'New' }]);
    expect(r.ok).toBe(true);
  });

  it('MS2-02: loadMemory reflects the new messages after overwrite', () => {
    const store = fresh();
    save(store);
    store.saveMemory('session-1', [{ role: 'assistant', content: 'Updated' }]);
    const r = store.loadMemory('session-1');
    expect(r.ok && r.value.messages[0]?.content).toBe('Updated');
  });

  it('MS2-03: listMemories has only one entry after overwrite of same id', () => {
    const store = fresh();
    save(store);
    save(store); // overwrite
    expect(store.listMemories()).toHaveLength(1);
  });

  it('MS2-04: createdAt is preserved (not reset) after overwrite', () => {
    const store    = fresh();
    const r1       = save(store);
    const original = r1.ok ? r1.value.createdAt : -1;
    const r2       = save(store); // overwrite
    expect(r2.ok && r2.value.createdAt).toBe(original);
  });

  it('MS2-05: updatedAt after overwrite is >= original updatedAt', () => {
    const store    = fresh();
    const r1       = save(store);
    const firstAt  = r1.ok ? r1.value.updatedAt : -1;
    const r2       = save(store); // overwrite
    expect(r2.ok && r2.value.updatedAt).toBeGreaterThanOrEqual(firstAt);
  });

  it('MS2-06: overwriting with empty messages removes all prior messages', () => {
    const store = fresh();
    save(store);
    store.saveMemory('session-1', []);
    const r = store.loadMemory('session-1');
    expect(r.ok && r.value.messages).toHaveLength(0);
  });
});

// ─── MS3: delete ──────────────────────────────────────────────────────────────

describe('MS3: delete', () => {
  it('MS3-01: deleteMemory returns ok:true', () => {
    const store = fresh();
    save(store);
    expect(store.deleteMemory('session-1').ok).toBe(true);
  });

  it('MS3-02: loadMemory returns MEMORY_NOT_FOUND after deleteMemory', () => {
    const store = fresh();
    save(store);
    store.deleteMemory('session-1');
    expect(store.loadMemory('session-1').ok).toBe(false);
  });

  it('MS3-03: listMemories does not include the deleted entry', () => {
    const store = fresh();
    save(store);
    store.deleteMemory('session-1');
    expect(store.listMemories().some(s => s.sessionId === 'session-1')).toBe(false);
  });

  it('MS3-04: deleteMemory for unknown sessionId returns ok:false', () => {
    expect(fresh().deleteMemory('no-such-session').ok).toBe(false);
  });

  it('MS3-05: error code is MEMORY_NOT_FOUND', () => {
    const r = fresh().deleteMemory('ghost');
    expect(!r.ok && r.error.code).toBe('MEMORY_NOT_FOUND');
  });

  it('MS3-06: error message contains the unknown sessionId', () => {
    const r = fresh().deleteMemory('unknown-session-id');
    expect(!r.ok && r.error.message).toContain('unknown-session-id');
  });
});

// ─── MS4: listMemories ────────────────────────────────────────────────────────

describe('MS4: listMemories', () => {
  it('MS4-01: listMemories returns empty array on a new store', () => {
    expect(fresh().listMemories()).toHaveLength(0);
  });

  it('MS4-02: listMemories includes all saved sessions', () => {
    const store = fresh();
    store.saveMemory('a', MSGS);
    store.saveMemory('b', MSGS);
    store.saveMemory('c', MSGS);
    const ids = store.listMemories().map(s => s.sessionId);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('MS4-03: listMemories returns sessions in insertion order', () => {
    const store = fresh();
    store.saveMemory('z', MSGS);
    store.saveMemory('a', MSGS);
    store.saveMemory('m', MSGS);
    expect(store.listMemories().map(s => s.sessionId)).toEqual(['z', 'a', 'm']);
  });

  it('MS4-04: listMemories length decreases after deleteMemory', () => {
    const store = fresh();
    store.saveMemory('x', MSGS);
    store.saveMemory('y', MSGS);
    store.deleteMemory('x');
    expect(store.listMemories()).toHaveLength(1);
  });

  it('MS4-05: listMemories reflects updated messages after overwrite', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    store.saveMemory('s', [{ role: 'assistant', content: 'Overwritten' }]);
    const snapshot = store.listMemories().find(s => s.sessionId === 's');
    expect(snapshot?.messages[0]?.content).toBe('Overwritten');
  });

  it('MS4-06: overwrite does not change insertion-order position in listMemories', () => {
    const store = fresh();
    store.saveMemory('first', MSGS);
    store.saveMemory('second', MSGS);
    store.saveMemory('first', []); // overwrite 'first'
    expect(store.listMemories()[0]?.sessionId).toBe('first');
  });
});

// ─── MS5: clear ───────────────────────────────────────────────────────────────

describe('MS5: clear', () => {
  it('MS5-01: clear() removes all stored snapshots', () => {
    const store = fresh();
    store.saveMemory('a', MSGS);
    store.saveMemory('b', MSGS);
    store.clear();
    expect(store.listMemories()).toHaveLength(0);
  });

  it('MS5-02: listMemories returns empty array after clear()', () => {
    const store = fresh();
    store.saveMemory('x', MSGS);
    store.clear();
    expect(store.listMemories()).toEqual([]);
  });

  it('MS5-03: loadMemory returns MEMORY_NOT_FOUND after clear()', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    store.clear();
    expect(store.loadMemory('s').ok).toBe(false);
  });

  it('MS5-04: new snapshots can be saved after clear()', () => {
    const store = fresh();
    store.saveMemory('old', MSGS);
    store.clear();
    const r = store.saveMemory('new', MSGS);
    expect(r.ok).toBe(true);
    expect(store.listMemories()).toHaveLength(1);
  });

  it('MS5-05: clear() on an empty store is a no-op and does not throw', () => {
    const store = fresh();
    expect(() => store.clear()).not.toThrow();
    expect(store.listMemories()).toHaveLength(0);
  });
});

// ─── MS6: timestamps ──────────────────────────────────────────────────────────

describe('MS6: timestamps', () => {
  it('MS6-01: createdAt is a positive unix-ms timestamp set at save time', () => {
    const before = Date.now();
    const r      = fresh().saveMemory('s', MSGS);
    const after  = Date.now();
    expect(r.ok && r.value.createdAt).toBeGreaterThanOrEqual(before);
    expect(r.ok && r.value.createdAt).toBeLessThanOrEqual(after);
  });

  it('MS6-02: updatedAt equals createdAt on the first save', () => {
    const r = fresh().saveMemory('s', MSGS);
    expect(r.ok && r.value.updatedAt).toBe(r.ok ? r.value.createdAt : -1);
  });

  it('MS6-03: updatedAt on overwrite is >= the original updatedAt', () => {
    const store  = fresh();
    const first  = store.saveMemory('s', MSGS);
    const second = store.saveMemory('s', []);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.updatedAt).toBeGreaterThanOrEqual(first.value.updatedAt);
    }
  });

  it('MS6-04: createdAt is identical before and after overwrite', () => {
    const store  = fresh();
    const first  = store.saveMemory('s', MSGS);
    const second = store.saveMemory('s', []);
    if (first.ok && second.ok) {
      expect(second.value.createdAt).toBe(first.value.createdAt);
    }
  });

  it('MS6-05: createdAt is a finite positive number', () => {
    const r = fresh().saveMemory('s', MSGS);
    expect(r.ok && Number.isFinite(r.value.createdAt)).toBe(true);
    expect(r.ok && r.value.createdAt).toBeGreaterThan(0);
  });

  it('MS6-06: updatedAt is always >= createdAt', () => {
    const store = fresh();
    // first save: equal
    const r1 = store.saveMemory('s', MSGS);
    expect(r1.ok && r1.value.updatedAt).toBeGreaterThanOrEqual(r1.ok ? r1.value.createdAt : 0);
    // after overwrite: still >=
    const r2 = store.saveMemory('s', []);
    expect(r2.ok && r2.value.updatedAt).toBeGreaterThanOrEqual(r2.ok ? r2.value.createdAt : 0);
  });
});

// ─── MS7: immutability ────────────────────────────────────────────────────────

describe('MS7: immutability', () => {
  it('MS7-01: mutating the snapshot returned from saveMemory does not affect stored data', () => {
    const store = fresh();
    const r     = store.saveMemory('s', MSGS);
    if (r.ok) r.value.messages[0]!.content = 'MUTATED';
    const loaded = store.loadMemory('s');
    expect(loaded.ok && loaded.value.messages[0]?.content).toBe('Hello');
  });

  it('MS7-02: mutating the snapshot returned from loadMemory does not affect stored data', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    const r1 = store.loadMemory('s');
    if (r1.ok) r1.value.messages[0]!.content = 'MUTATED';
    const r2 = store.loadMemory('s');
    expect(r2.ok && r2.value.messages[0]?.content).toBe('Hello');
  });

  it('MS7-03: mutating the messages array from loadMemory does not affect stored data', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    const r1 = store.loadMemory('s');
    if (r1.ok) r1.value.messages.push({ role: 'user', content: 'Extra' });
    const r2 = store.loadMemory('s');
    expect(r2.ok && r2.value.messages).toHaveLength(2);
  });

  it('MS7-04: mutating the input messages array after saveMemory does not corrupt stored data', () => {
    const store      = fresh();
    const mutableMsgs: MemoryMessage[] = [{ role: 'user', content: 'Original' }];
    store.saveMemory('s', mutableMsgs);
    mutableMsgs[0]!.content = 'MUTATED';
    const r = store.loadMemory('s');
    expect(r.ok && r.value.messages[0]?.content).toBe('Original');
  });

  it('MS7-05: two loadMemory calls return independent snapshot objects', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    const r1 = store.loadMemory('s');
    const r2 = store.loadMemory('s');
    if (r1.ok && r2.ok) expect(r1.value).not.toBe(r2.value);
  });

  it('MS7-06: mutating a snapshot from listMemories does not affect stored data', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    const [snap] = store.listMemories();
    snap!.messages[0]!.content = 'MUTATED';
    const r = store.loadMemory('s');
    expect(r.ok && r.value.messages[0]?.content).toBe('Hello');
  });

  it('MS7-07: pushing to the messages array of a listMemories snapshot does not affect stored data', () => {
    const store = fresh();
    store.saveMemory('s', MSGS);
    store.listMemories()[0]!.messages.push({ role: 'user', content: 'Injected' });
    expect(store.loadMemory('s').ok && (store.loadMemory('s') as any).value.messages).toHaveLength(2);
  });
});

// ─── MS8: edge cases ──────────────────────────────────────────────────────────

describe('MS8: edge cases', () => {
  it('MS8-01: saveMemory with empty sessionId returns INVALID_INPUT', () => {
    const r = fresh().saveMemory('', MSGS);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('MS8-02: saveMemory with whitespace-only sessionId returns INVALID_INPUT', () => {
    const r = fresh().saveMemory('   ', MSGS);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('MS8-03: loadMemory with empty sessionId returns INVALID_INPUT', () => {
    const r = fresh().loadMemory('');
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('MS8-04: deleteMemory with empty sessionId returns INVALID_INPUT', () => {
    const r = fresh().deleteMemory('');
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('MS8-05: a single message is stored and retrieved correctly', () => {
    const store = fresh();
    store.saveMemory('s', [{ role: 'assistant', content: 'One message' }]);
    const r = store.loadMemory('s');
    expect(r.ok && r.value.messages).toHaveLength(1);
    expect(r.ok && r.value.messages[0]?.content).toBe('One message');
  });

  it('MS8-06: multiple sessions are stored and retrieved independently', () => {
    const store = fresh();
    store.saveMemory('alice', [{ role: 'user', content: 'Alice' }]);
    store.saveMemory('bob',   [{ role: 'user', content: 'Bob' }]);
    const alice = store.loadMemory('alice');
    const bob   = store.loadMemory('bob');
    expect(alice.ok && alice.value.messages[0]?.content).toBe('Alice');
    expect(bob.ok && bob.value.messages[0]?.content).toBe('Bob');
  });

  it('MS8-07: sessionId with dots, dashes, and colons is stored and retrieved', () => {
    const store = fresh();
    const id    = 'session.123:user-abc';
    store.saveMemory(id, MSGS);
    const r = store.loadMemory(id);
    expect(r.ok && r.value.sessionId).toBe(id);
  });
});

// ─── MS9: never-throw contract ────────────────────────────────────────────────

describe('MS9: never-throw contract', () => {
  it('MS9-01: saveMemory never throws for any input', () => {
    const store = fresh();
    expect(() => store.saveMemory('', MSGS)).not.toThrow();
    expect(() => store.saveMemory('ok', MSGS)).not.toThrow();
    expect(() => store.saveMemory('ok', [])).not.toThrow(); // overwrite
  });

  it('MS9-02: loadMemory never throws for any sessionId', () => {
    const store = fresh();
    expect(() => store.loadMemory('')).not.toThrow();
    expect(() => store.loadMemory('missing')).not.toThrow();
  });

  it('MS9-03: deleteMemory never throws for any sessionId', () => {
    const store = fresh();
    expect(() => store.deleteMemory('')).not.toThrow();
    expect(() => store.deleteMemory('ghost')).not.toThrow();
  });

  it('MS9-04: listMemories never throws on any store state', () => {
    const store = fresh();
    expect(() => store.listMemories()).not.toThrow();
    store.saveMemory('s', MSGS);
    expect(() => store.listMemories()).not.toThrow();
    store.clear();
    expect(() => store.listMemories()).not.toThrow();
  });

  it('MS9-05: clear never throws', () => {
    const store = fresh();
    expect(() => store.clear()).not.toThrow();
    store.saveMemory('x', MSGS);
    expect(() => store.clear()).not.toThrow();
    expect(() => store.clear()).not.toThrow(); // second clear on empty
  });

  it('MS9-06: rapid successive saves and loads never throw', () => {
    const store = fresh();
    expect(() => {
      for (let i = 0; i < 20; i++) {
        store.saveMemory(`session-${i}`, MSGS);
      }
      for (let i = 0; i < 20; i++) {
        store.loadMemory(`session-${i}`);
      }
      store.clear();
      store.listMemories();
    }).not.toThrow();
  });
});
