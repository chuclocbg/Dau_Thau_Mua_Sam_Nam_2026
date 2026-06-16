/**
 * P6-11F: StateStore — test suite (56 tests, SS1–SS12).
 *
 * Plain TypeScript — no JSX, no timers (StateStore has no TTL).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateStore } from '../providers/StateStore';

// ─── SS1: Constructor and snapshot() basics (5 tests) ────────────────────────

describe('SS1: constructor and snapshot() basics', () => {
  it('SS1-01: new StateStore() does not throw', () => {
    expect(() => new StateStore()).not.toThrow();
  });

  it('SS1-02: snapshot() on an empty store returns size:0 and empty entries', () => {
    const store = new StateStore();
    const snap = store.snapshot();
    expect(snap.size).toBe(0);
    expect(snap.entries).toEqual([]);
  });

  it('SS1-03: snapshot().entries are in insertion order', () => {
    const store = new StateStore();
    store.set('c', 3);
    store.set('a', 1);
    store.set('b', 2);
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toEqual(['c', 'a', 'b']);
  });

  it('SS1-04: snapshot().size matches the number of stored entries', () => {
    const store = new StateStore();
    store.set('x', 1);
    store.set('y', 2);
    expect(store.snapshot().size).toBe(2);
  });

  it('SS1-05: snapshot() does not throw on any store state', () => {
    const store = new StateStore();
    store.set('k', { nested: { deep: true } });
    expect(() => store.snapshot()).not.toThrow();
  });
});

// ─── SS2: set() basic insertion (5 tests) ────────────────────────────────────

describe('SS2: set() basic insertion', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS2-01: set() returns ok:true for a valid string key', () => {
    expect(store.set('k', 'v').ok).toBe(true);
  });

  it('SS2-02: set() with a primitive value returns ok:true', () => {
    expect(store.set('n', 42).ok).toBe(true);
    expect(store.set('b', false).ok).toBe(true);
  });

  it('SS2-03: set() with an object value returns ok:true', () => {
    expect(store.set('obj', { mode: 'dark' }).ok).toBe(true);
  });

  it('SS2-04: has() returns true immediately after set()', () => {
    store.set('present', 1);
    expect(store.has('present')).toBe(true);
  });

  it('SS2-05: snapshot() includes the new entry after set()', () => {
    store.set('newkey', 99);
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toContain('newkey');
  });
});

// ─── SS3: get() retrieval (5 tests) ──────────────────────────────────────────

describe('SS3: get() retrieval', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS3-01: get() returns ok:true with the stored primitive', () => {
    store.set('n', 7);
    const r = store.get<number>('n');
    expect(r.ok && r.value).toBe(7);
  });

  it('SS3-02: get() returns ok:true with the stored object', () => {
    store.set('cfg', { theme: 'dark' });
    const r = store.get<{ theme: string }>('cfg');
    expect(r.ok && r.value.theme).toBe('dark');
  });

  it('SS3-03: get() returns KEY_NOT_FOUND for an unknown key', () => {
    const r = store.get('missing');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('SS3-04: get() returns KEY_NOT_FOUND after the key is deleted', () => {
    store.set('gone', 'bye');
    store.delete('gone');
    const r = store.get('gone');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('SS3-05: get() returns the updated value after overwrite', () => {
    store.set('k', 'v1');
    store.set('k', 'v2');
    const r = store.get<string>('k');
    expect(r.ok && r.value).toBe('v2');
  });
});

// ─── SS4: has() (4 tests) ────────────────────────────────────────────────────

describe('SS4: has()', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS4-01: has() returns false for an unknown key', () => {
    expect(store.has('ghost')).toBe(false);
  });

  it('SS4-02: has() returns true for a key that was set', () => {
    store.set('exists', 1);
    expect(store.has('exists')).toBe(true);
  });

  it('SS4-03: has() returns false after the key is deleted', () => {
    store.set('temp', 'x');
    store.delete('temp');
    expect(store.has('temp')).toBe(false);
  });

  it('SS4-04: has() returns false for all keys after clear()', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.clear();
    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(false);
  });
});

// ─── SS5: delete() (4 tests) ─────────────────────────────────────────────────

describe('SS5: delete()', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS5-01: delete() removes the key from the store', () => {
    store.set('k', 'v');
    store.delete('k');
    expect(store.has('k')).toBe(false);
  });

  it('SS5-02: delete() on an unknown key does not throw', () => {
    expect(() => store.delete('no-such-key')).not.toThrow();
  });

  it('SS5-03: delete() called twice on the same key does not throw', () => {
    store.set('once', 'x');
    expect(() => {
      store.delete('once');
      store.delete('once');
    }).not.toThrow();
  });

  it('SS5-04: snapshot().entries excludes deleted keys', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    store.delete('b');
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toEqual(['a', 'c']);
  });
});

// ─── SS6: clear() (4 tests) ──────────────────────────────────────────────────

describe('SS6: clear()', () => {
  let store: StateStore;
  beforeEach(() => {
    store = new StateStore();
    store.set('p', 1);
    store.set('q', 2);
  });

  it('SS6-01: clear() does not throw', () => {
    expect(() => store.clear()).not.toThrow();
  });

  it('SS6-02: snapshot().size is 0 after clear()', () => {
    store.clear();
    expect(store.snapshot().size).toBe(0);
  });

  it('SS6-03: snapshot().entries is [] after clear()', () => {
    store.clear();
    expect(store.snapshot().entries).toEqual([]);
  });

  it('SS6-04: clear() on an already-empty store does not throw', () => {
    store.clear();
    expect(() => store.clear()).not.toThrow();
  });
});

// ─── SS7: snapshot() defensive copy (5 tests) ────────────────────────────────

describe('SS7: snapshot() defensive copy', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS7-01: pushing onto snapshot().entries does not grow the store', () => {
    store.set('a', 1);
    const snap = store.snapshot();
    snap.entries.push({ key: 'injected', value: 99 });
    expect(store.snapshot().size).toBe(1);
  });

  it('SS7-02: mutating a value in a snapshot entry does not corrupt the store', () => {
    store.set('obj', { count: 1 });
    const snap = store.snapshot();
    (snap.entries[0].value as { count: number }).count = 999;
    const r = store.get<{ count: number }>('obj');
    expect(r.ok && r.value.count).toBe(1);
  });

  it('SS7-03: two snapshot() calls return independent objects', () => {
    store.set('x', 1);
    const s1 = store.snapshot();
    const s2 = store.snapshot();
    expect(s1).not.toBe(s2);
    expect(s1.entries).not.toBe(s2.entries);
  });

  it('SS7-04: mutating the input to set() does not corrupt a later snapshot', () => {
    const obj = { level: 5 };
    store.set('state', obj);
    obj.level = 99;
    const snap = store.snapshot();
    expect((snap.entries[0].value as { level: number }).level).toBe(5);
  });

  it('SS7-05: snapshot() entry values match get() values for each key', () => {
    store.set('a', 10);
    store.set('b', 20);
    const snap = store.snapshot();
    for (const { key, value } of snap.entries) {
      const r = store.get<number>(key);
      expect(r.ok && r.value).toBe(value);
    }
  });
});

// ─── SS8: Insertion order (5 tests) ──────────────────────────────────────────

describe('SS8: insertion order', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS8-01: snapshot().entries preserves insertion order', () => {
    store.set('first', 1);
    store.set('second', 2);
    store.set('third', 3);
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toEqual(['first', 'second', 'third']);
  });

  it('SS8-02: overwriting a key does not change its position in snapshot()', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    store.set('b', 99);
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('SS8-03: deleting a middle key removes it without reordering others', () => {
    store.set('x', 1);
    store.set('y', 2);
    store.set('z', 3);
    store.delete('y');
    const keys = store.snapshot().entries.map(e => e.key);
    expect(keys).toEqual(['x', 'z']);
  });

  it('SS8-04: after clear() and re-set, snapshot() reflects the fresh state', () => {
    store.set('old', 1);
    store.clear();
    store.set('new', 2);
    const snap = store.snapshot();
    expect(snap.size).toBe(1);
    expect(snap.entries[0].key).toBe('new');
  });

  it('SS8-05: successive snapshot() calls reflect store mutations between them', () => {
    store.set('a', 1);
    const snap1 = store.snapshot();
    store.set('b', 2);
    const snap2 = store.snapshot();
    expect(snap1.size).toBe(1);
    expect(snap2.size).toBe(2);
  });
});

// ─── SS9: overwrite behaviour (4 tests) ──────────────────────────────────────

describe('SS9: overwrite behaviour', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS9-01: overwrite stores the new value', () => {
    store.set('k', 'original');
    store.set('k', 'updated');
    const r = store.get<string>('k');
    expect(r.ok && r.value).toBe('updated');
  });

  it('SS9-02: snapshot().size stays the same when overwriting an existing key', () => {
    store.set('k', 1);
    store.set('k', 2);
    expect(store.snapshot().size).toBe(1);
  });

  it('SS9-03: has() remains true after overwrite', () => {
    store.set('k', 'a');
    store.set('k', 'b');
    expect(store.has('k')).toBe(true);
  });

  it('SS9-04: get() returns the latest value after multiple overwrites', () => {
    store.set('k', 1);
    store.set('k', 2);
    store.set('k', 3);
    const r = store.get<number>('k');
    expect(r.ok && r.value).toBe(3);
  });
});

// ─── SS10: defensive copies (4 tests) ────────────────────────────────────────

describe('SS10: defensive copies', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS10-01: mutating the object returned by get() does not corrupt the store', () => {
    store.set('obj', { retries: 3 });
    const r = store.get<{ retries: number }>('obj');
    if (r.ok) r.value.retries = 999;
    const r2 = store.get<{ retries: number }>('obj');
    expect(r2.ok && r2.value.retries).toBe(3);
  });

  it('SS10-02: mutating the input object after set() does not corrupt the store', () => {
    const input = { debug: true };
    store.set('flags', input);
    (input as { debug: boolean }).debug = false;
    const r = store.get<{ debug: boolean }>('flags');
    expect(r.ok && r.value.debug).toBe(true);
  });

  it('SS10-03: two successive get() calls return independent copies', () => {
    store.set('list', [1, 2, 3]);
    const r1 = store.get<number[]>('list');
    const r2 = store.get<number[]>('list');
    if (r1.ok) r1.value.push(99);
    expect(r2.ok && r2.value.length).toBe(3);
  });

  it('SS10-04: null can be stored and retrieved as-is', () => {
    store.set('nil', null);
    const r = store.get<null>('nil');
    expect(r.ok && r.value).toBeNull();
  });
});

// ─── SS11: edge values (3 tests) ─────────────────────────────────────────────

describe('SS11: edge values', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS11-01: zero (0) can be stored and retrieved', () => {
    store.set('zero', 0);
    const r = store.get<number>('zero');
    expect(r.ok && r.value).toBe(0);
  });

  it('SS11-02: false can be stored and retrieved', () => {
    store.set('flag', false);
    const r = store.get<boolean>('flag');
    expect(r.ok && r.value).toBe(false);
  });

  it('SS11-03: empty string value can be stored and retrieved', () => {
    store.set('empty', '');
    const r = store.get<string>('empty');
    expect(r.ok && r.value).toBe('');
  });
});

// ─── SS12: malformed input and never-throw (8 tests) ─────────────────────────

describe('SS12: malformed input and never-throw', () => {
  let store: StateStore;
  beforeEach(() => { store = new StateStore(); });

  it('SS12-01: set() with empty string key returns INVALID_KEY', () => {
    const r = store.set('', 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('SS12-02: set() with numeric key returns INVALID_KEY', () => {
    const r = store.set(42 as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('SS12-03: set() with null key returns INVALID_KEY', () => {
    const r = store.set(null as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('SS12-04: get() with empty string key returns INVALID_KEY', () => {
    const r = store.get('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('SS12-05: get() with non-string key returns INVALID_KEY', () => {
    const r = store.get(undefined as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('SS12-06: has() with non-string key returns false without throwing', () => {
    expect(() => store.has(123 as unknown as string)).not.toThrow();
    expect(store.has(123 as unknown as string)).toBe(false);
  });

  it('SS12-07: delete() with non-string key does not throw', () => {
    expect(() => store.delete(null as unknown as string)).not.toThrow();
  });

  it('SS12-08: snapshot() still works correctly after malformed set() attempts', () => {
    store.set('' as string, 'bad');
    store.set(42 as unknown as string, 'bad');
    store.set('valid', 'good');
    const snap = store.snapshot();
    expect(snap.size).toBe(1);
    expect(snap.entries[0].key).toBe('valid');
  });
});
