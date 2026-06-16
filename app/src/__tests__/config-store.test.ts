/**
 * P6-11D: ConfigStore — test suite (56 tests, CF1–CF12).
 *
 * Plain TypeScript — no JSX, no timers (ConfigStore has no TTL).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigStore } from '../providers/ConfigStore';

// ─── CF1: Constructor and listKeys() (5 tests) ───────────────────────────────

describe('CF1: constructor and listKeys()', () => {
  it('CF1-01: new ConfigStore() does not throw', () => {
    expect(() => new ConfigStore()).not.toThrow();
  });

  it('CF1-02: listKeys() returns [] on an empty store', () => {
    const cfg = new ConfigStore();
    expect(cfg.listKeys()).toEqual([]);
  });

  it('CF1-03: listKeys() returns keys in insertion order', () => {
    const cfg = new ConfigStore();
    cfg.set('c', 3);
    cfg.set('a', 1);
    cfg.set('b', 2);
    expect(cfg.listKeys()).toEqual(['c', 'a', 'b']);
  });

  it('CF1-04: listKeys() returns a defensive copy — push does not grow the store', () => {
    const cfg = new ConfigStore();
    cfg.set('x', 1);
    const keys = cfg.listKeys();
    keys.push('injected');
    expect(cfg.listKeys().length).toBe(1);
  });

  it('CF1-05: listKeys() updates after a key is deleted', () => {
    const cfg = new ConfigStore();
    cfg.set('keep', 1);
    cfg.set('drop', 2);
    cfg.delete('drop');
    expect(cfg.listKeys()).toEqual(['keep']);
  });
});

// ─── CF2: set() — basic insertion (5 tests) ──────────────────────────────────

describe('CF2: set() basic insertion', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF2-01: set() returns ok:true for a valid string key', () => {
    expect(cfg.set('k', 'v').ok).toBe(true);
  });

  it('CF2-02: set() with a primitive value returns ok:true', () => {
    expect(cfg.set('n', 42).ok).toBe(true);
    expect(cfg.set('b', true).ok).toBe(true);
    expect(cfg.set('s', 'hello').ok).toBe(true);
  });

  it('CF2-03: set() with an object value returns ok:true', () => {
    expect(cfg.set('obj', { host: 'localhost', port: 8080 }).ok).toBe(true);
  });

  it('CF2-04: has() returns true immediately after set()', () => {
    cfg.set('present', 1);
    expect(cfg.has('present')).toBe(true);
  });

  it('CF2-05: listKeys() includes the new key after set()', () => {
    cfg.set('newkey', 99);
    expect(cfg.listKeys()).toContain('newkey');
  });
});

// ─── CF3: get() — retrieval (5 tests) ────────────────────────────────────────

describe('CF3: get() retrieval', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF3-01: get() returns ok:true with the stored primitive', () => {
    cfg.set('n', 7);
    const r = cfg.get<number>('n');
    expect(r.ok && r.value).toBe(7);
  });

  it('CF3-02: get() returns ok:true with the stored object', () => {
    cfg.set('cfg', { timeout: 30 });
    const r = cfg.get<{ timeout: number }>('cfg');
    expect(r.ok && r.value.timeout).toBe(30);
  });

  it('CF3-03: get() returns KEY_NOT_FOUND for an unknown key', () => {
    const r = cfg.get('missing');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('CF3-04: get() returns KEY_NOT_FOUND after the key is deleted', () => {
    cfg.set('gone', 'bye');
    cfg.delete('gone');
    const r = cfg.get('gone');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('CF3-05: get() returns the updated value after overwrite', () => {
    cfg.set('k', 'v1');
    cfg.set('k', 'v2');
    const r = cfg.get<string>('k');
    expect(r.ok && r.value).toBe('v2');
  });
});

// ─── CF4: has() (4 tests) ────────────────────────────────────────────────────

describe('CF4: has()', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF4-01: has() returns false for an unknown key', () => {
    expect(cfg.has('ghost')).toBe(false);
  });

  it('CF4-02: has() returns true for a key that was set', () => {
    cfg.set('exists', 1);
    expect(cfg.has('exists')).toBe(true);
  });

  it('CF4-03: has() returns false after the key is deleted', () => {
    cfg.set('temp', 'x');
    cfg.delete('temp');
    expect(cfg.has('temp')).toBe(false);
  });

  it('CF4-04: has() returns false for every key after clear()', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    cfg.clear();
    expect(cfg.has('a')).toBe(false);
    expect(cfg.has('b')).toBe(false);
  });
});

// ─── CF5: delete() (4 tests) ─────────────────────────────────────────────────

describe('CF5: delete()', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF5-01: delete() removes the key from the store', () => {
    cfg.set('k', 'v');
    cfg.delete('k');
    expect(cfg.has('k')).toBe(false);
  });

  it('CF5-02: delete() on an unknown key does not throw', () => {
    expect(() => cfg.delete('no-such-key')).not.toThrow();
  });

  it('CF5-03: delete() called twice on the same key does not throw', () => {
    cfg.set('once', 'x');
    expect(() => {
      cfg.delete('once');
      cfg.delete('once');
    }).not.toThrow();
  });

  it('CF5-04: listKeys() excludes the deleted key', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    cfg.set('c', 3);
    cfg.delete('b');
    expect(cfg.listKeys()).toEqual(['a', 'c']);
  });
});

// ─── CF6: clear() (4 tests) ──────────────────────────────────────────────────

describe('CF6: clear()', () => {
  let cfg: ConfigStore;
  beforeEach(() => {
    cfg = new ConfigStore();
    cfg.set('p', 1);
    cfg.set('q', 2);
  });

  it('CF6-01: clear() does not throw', () => {
    expect(() => cfg.clear()).not.toThrow();
  });

  it('CF6-02: listKeys() returns [] after clear()', () => {
    cfg.clear();
    expect(cfg.listKeys()).toEqual([]);
  });

  it('CF6-03: has() returns false for all keys after clear()', () => {
    cfg.clear();
    expect(cfg.has('p')).toBe(false);
    expect(cfg.has('q')).toBe(false);
  });

  it('CF6-04: clear() on an already-empty store does not throw', () => {
    cfg.clear();
    expect(() => cfg.clear()).not.toThrow();
  });
});

// ─── CF7: Insertion order preservation (5 tests) ─────────────────────────────

describe('CF7: insertion order', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF7-01: listKeys() preserves the order multiple keys were inserted', () => {
    cfg.set('first', 1);
    cfg.set('second', 2);
    cfg.set('third', 3);
    expect(cfg.listKeys()).toEqual(['first', 'second', 'third']);
  });

  it('CF7-02: overwriting a key does not change its position in listKeys()', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    cfg.set('c', 3);
    cfg.set('b', 99);  // overwrite 'b' — should stay in second position
    expect(cfg.listKeys()).toEqual(['a', 'b', 'c']);
  });

  it('CF7-03: deleting a middle key removes it without affecting neighbouring order', () => {
    cfg.set('x', 1);
    cfg.set('y', 2);
    cfg.set('z', 3);
    cfg.delete('y');
    expect(cfg.listKeys()).toEqual(['x', 'z']);
  });

  it('CF7-04: re-inserting a deleted key appends it to the end', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    cfg.delete('a');
    cfg.set('a', 99);  // 'a' now re-appears at the end
    expect(cfg.listKeys()).toEqual(['b', 'a']);
  });

  it('CF7-05: listKeys() starts fresh after clear() and re-insert', () => {
    cfg.set('old', 1);
    cfg.clear();
    cfg.set('new', 2);
    expect(cfg.listKeys()).toEqual(['new']);
  });
});

// ─── CF8: overwrite behaviour (4 tests) ──────────────────────────────────────

describe('CF8: overwrite behaviour', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF8-01: overwrite stores the new value', () => {
    cfg.set('k', 'original');
    cfg.set('k', 'updated');
    const r = cfg.get<string>('k');
    expect(r.ok && r.value).toBe('updated');
  });

  it('CF8-02: listKeys() length stays the same when overwriting an existing key', () => {
    cfg.set('k', 1);
    cfg.set('k', 2);
    expect(cfg.listKeys().length).toBe(1);
  });

  it('CF8-03: has() remains true after overwrite', () => {
    cfg.set('k', 'a');
    cfg.set('k', 'b');
    expect(cfg.has('k')).toBe(true);
  });

  it('CF8-04: get() returns the latest value after multiple overwrites', () => {
    cfg.set('k', 1);
    cfg.set('k', 2);
    cfg.set('k', 3);
    const r = cfg.get<number>('k');
    expect(r.ok && r.value).toBe(3);
  });
});

// ─── CF9: defensive copies (4 tests) ─────────────────────────────────────────

describe('CF9: defensive copies', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF9-01: mutating the object returned by get() does not corrupt the store', () => {
    cfg.set('obj', { retries: 3 });
    const r = cfg.get<{ retries: number }>('obj');
    if (r.ok) r.value.retries = 999;
    const r2 = cfg.get<{ retries: number }>('obj');
    expect(r2.ok && r2.value.retries).toBe(3);
  });

  it('CF9-02: mutating the input object after set() does not corrupt the store', () => {
    const input = { debug: true };
    cfg.set('flags', input);
    (input as { debug: boolean }).debug = false;
    const r = cfg.get<{ debug: boolean }>('flags');
    expect(r.ok && r.value.debug).toBe(true);
  });

  it('CF9-03: two successive get() calls return independent copies', () => {
    cfg.set('list', [1, 2, 3]);
    const r1 = cfg.get<number[]>('list');
    const r2 = cfg.get<number[]>('list');
    if (r1.ok) r1.value.push(99);
    expect(r2.ok && r2.value.length).toBe(3);
  });

  it('CF9-04: pushing onto the listKeys() result does not affect the store', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    const keys = cfg.listKeys();
    keys.push('injected');
    expect(cfg.listKeys().length).toBe(2);
  });
});

// ─── CF10: edge values (4 tests) ─────────────────────────────────────────────

describe('CF10: edge values', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF10-01: empty string value can be stored and retrieved', () => {
    cfg.set('empty', '');
    const r = cfg.get<string>('empty');
    expect(r.ok && r.value).toBe('');
  });

  it('CF10-02: zero (0) can be stored and retrieved', () => {
    cfg.set('zero', 0);
    const r = cfg.get<number>('zero');
    expect(r.ok && r.value).toBe(0);
  });

  it('CF10-03: false can be stored and retrieved', () => {
    cfg.set('flag', false);
    const r = cfg.get<boolean>('flag');
    expect(r.ok && r.value).toBe(false);
  });

  it('CF10-04: null can be stored and retrieved', () => {
    cfg.set('nil', null);
    const r = cfg.get<null>('nil');
    expect(r.ok && r.value).toBeNull();
  });
});

// ─── CF11: multiple entries (4 tests) ────────────────────────────────────────

describe('CF11: multiple entries', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF11-01: multiple different keys can each be retrieved independently', () => {
    cfg.set('host', 'localhost');
    cfg.set('port', 3000);
    cfg.set('debug', true);
    expect(cfg.get<string>('host').ok && (cfg.get<string>('host') as { ok: true; value: string }).value).toBe('localhost');
    expect(cfg.get<number>('port').ok && (cfg.get<number>('port') as { ok: true; value: number }).value).toBe(3000);
    expect(cfg.get<boolean>('debug').ok && (cfg.get<boolean>('debug') as { ok: true; value: boolean }).value).toBe(true);
  });

  it('CF11-02: listKeys().length matches the number of unique keys', () => {
    cfg.set('a', 1);
    cfg.set('b', 2);
    cfg.set('c', 3);
    cfg.set('a', 99); // overwrite — no new key
    expect(cfg.listKeys().length).toBe(3);
  });

  it('CF11-03: deleting one key leaves others accessible', () => {
    cfg.set('keep1', 'v1');
    cfg.set('remove', 'v2');
    cfg.set('keep2', 'v3');
    cfg.delete('remove');
    expect(cfg.get<string>('keep1').ok).toBe(true);
    expect(cfg.get<string>('keep2').ok).toBe(true);
    expect(cfg.get('remove').ok).toBe(false);
  });

  it('CF11-04: overwriting one key does not change another key\'s value', () => {
    cfg.set('a', 'alpha');
    cfg.set('b', 'beta');
    cfg.set('a', 'ALPHA');
    const rb = cfg.get<string>('b');
    expect(rb.ok && rb.value).toBe('beta');
  });
});

// ─── CF12: malformed input and never-throw (8 tests) ─────────────────────────

describe('CF12: malformed input and never-throw', () => {
  let cfg: ConfigStore;
  beforeEach(() => { cfg = new ConfigStore(); });

  it('CF12-01: set() with empty string key returns INVALID_KEY', () => {
    const r = cfg.set('', 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CF12-02: set() with a numeric key returns INVALID_KEY', () => {
    const r = cfg.set(42 as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CF12-03: set() with null key returns INVALID_KEY', () => {
    const r = cfg.set(null as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CF12-04: get() with empty string key returns INVALID_KEY', () => {
    const r = cfg.get('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CF12-05: get() with non-string key returns INVALID_KEY', () => {
    const r = cfg.get(undefined as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CF12-06: has() with non-string key returns false without throwing', () => {
    expect(() => cfg.has(123 as unknown as string)).not.toThrow();
    expect(cfg.has(123 as unknown as string)).toBe(false);
  });

  it('CF12-07: delete() with non-string key does not throw', () => {
    expect(() => cfg.delete(null as unknown as string)).not.toThrow();
  });

  it('CF12-08: listKeys() never throws even after malformed set() attempts', () => {
    cfg.set('' as string, 'bad');
    cfg.set(42 as unknown as string, 'bad');
    expect(() => cfg.listKeys()).not.toThrow();
    expect(cfg.listKeys()).toEqual([]);
  });
});
