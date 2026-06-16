/**
 * P6-11C: CacheStore — test suite (56 tests, CS1–CS12).
 *
 * Plain TypeScript — no JSX.  TTL tests use vi.useFakeTimers() to
 * advance Date.now() without real delays.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheStore } from '../providers/CacheStore';

// ─── CS1: Constructor and size() (5 tests) ────────────────────────────────────

describe('CS1: constructor and size()', () => {
  it('CS1-01: new CacheStore() does not throw', () => {
    expect(() => new CacheStore()).not.toThrow();
  });

  it('CS1-02: size() returns 0 on an empty store', () => {
    const cache = new CacheStore();
    expect(cache.size()).toBe(0);
  });

  it('CS1-03: size() returns 1 after one set', () => {
    const cache = new CacheStore();
    cache.set('a', 1);
    expect(cache.size()).toBe(1);
  });

  it('CS1-04: size() returns 2 after two sets with different keys', () => {
    const cache = new CacheStore();
    cache.set('x', 1);
    cache.set('y', 2);
    expect(cache.size()).toBe(2);
  });

  it('CS1-05: size() returns 1 after set then delete', () => {
    const cache = new CacheStore();
    cache.set('keep', 'v');
    cache.set('drop', 'v');
    cache.delete('drop');
    expect(cache.size()).toBe(1);
  });
});

// ─── CS2: set() — basic insertion (5 tests) ───────────────────────────────────

describe('CS2: set() basic insertion', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS2-01: set() returns ok:true for a valid string key', () => {
    const r = cache.set('key', 'value');
    expect(r.ok).toBe(true);
  });

  it('CS2-02: set() with a primitive value returns ok:true', () => {
    expect(cache.set('num', 42).ok).toBe(true);
    expect(cache.set('bool', false).ok).toBe(true);
    expect(cache.set('str', 'hello').ok).toBe(true);
  });

  it('CS2-03: set() with an object value returns ok:true', () => {
    expect(cache.set('obj', { a: 1, b: 2 }).ok).toBe(true);
  });

  it('CS2-04: has() returns true immediately after set', () => {
    cache.set('k', 'v');
    expect(cache.has('k')).toBe(true);
  });

  it('CS2-05: set() overwrites an existing key with a new value', () => {
    cache.set('k', 'original');
    cache.set('k', 'updated');
    const r = cache.get<string>('k');
    expect(r.ok && r.value).toBe('updated');
  });
});

// ─── CS3: get() — retrieval (5 tests) ────────────────────────────────────────

describe('CS3: get() retrieval', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS3-01: get() returns ok:true with the stored primitive', () => {
    cache.set('n', 99);
    const r = cache.get<number>('n');
    expect(r.ok && r.value).toBe(99);
  });

  it('CS3-02: get() returns ok:true with the stored object', () => {
    cache.set('obj', { x: 7 });
    const r = cache.get<{ x: number }>('obj');
    expect(r.ok && r.value.x).toBe(7);
  });

  it('CS3-03: get() returns KEY_NOT_FOUND for an unknown key', () => {
    const r = cache.get('ghost');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('CS3-04: get() returns KEY_NOT_FOUND after the key was deleted', () => {
    cache.set('gone', 'bye');
    cache.delete('gone');
    const r = cache.get('gone');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('CS3-05: get() returns the updated value after overwrite', () => {
    cache.set('k', 'v1');
    cache.set('k', 'v2');
    const r = cache.get<string>('k');
    expect(r.ok && r.value).toBe('v2');
  });
});

// ─── CS4: has() (4 tests) ────────────────────────────────────────────────────

describe('CS4: has()', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS4-01: has() returns false for an unknown key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('CS4-02: has() returns true for a registered key', () => {
    cache.set('present', 1);
    expect(cache.has('present')).toBe(true);
  });

  it('CS4-03: has() returns false after the key is deleted', () => {
    cache.set('temp', 'x');
    cache.delete('temp');
    expect(cache.has('temp')).toBe(false);
  });

  it('CS4-04: has() returns false after clear()', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
  });
});

// ─── CS5: delete() (4 tests) ─────────────────────────────────────────────────

describe('CS5: delete()', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS5-01: delete() removes an existing key', () => {
    cache.set('k', 'v');
    cache.delete('k');
    expect(cache.has('k')).toBe(false);
  });

  it('CS5-02: delete() on an unknown key does not throw', () => {
    expect(() => cache.delete('no-such-key')).not.toThrow();
  });

  it('CS5-03: delete() twice on the same key does not throw', () => {
    cache.set('once', 'x');
    expect(() => {
      cache.delete('once');
      cache.delete('once');
    }).not.toThrow();
  });

  it('CS5-04: size() decrements correctly after delete', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.size()).toBe(1);
  });
});

// ─── CS6: clear() (4 tests) ──────────────────────────────────────────────────

describe('CS6: clear()', () => {
  let cache: CacheStore;
  beforeEach(() => {
    cache = new CacheStore();
    cache.set('p', 1);
    cache.set('q', 2);
  });

  it('CS6-01: clear() does not throw', () => {
    expect(() => cache.clear()).not.toThrow();
  });

  it('CS6-02: size() returns 0 after clear()', () => {
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('CS6-03: has() returns false for every key after clear()', () => {
    cache.clear();
    expect(cache.has('p')).toBe(false);
    expect(cache.has('q')).toBe(false);
  });

  it('CS6-04: clear() on an already-empty store does not throw', () => {
    cache.clear();
    expect(() => cache.clear()).not.toThrow();
  });
});

// ─── CS7: TTL expiration — basic (5 tests, fake timers) ──────────────────────

describe('CS7: TTL expiration basic', () => {
  let cache: CacheStore;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CS7-01: has() returns true before TTL elapses', () => {
    cache.set('k', 'v', 1000);
    vi.advanceTimersByTime(500);
    expect(cache.has('k')).toBe(true);
  });

  it('CS7-02: has() returns false after TTL elapses', () => {
    cache.set('k', 'v', 1000);
    vi.advanceTimersByTime(1001);
    expect(cache.has('k')).toBe(false);
  });

  it('CS7-03: get() returns KEY_NOT_FOUND after TTL elapses', () => {
    cache.set('k', 42, 500);
    vi.advanceTimersByTime(501);
    const r = cache.get('k');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('KEY_NOT_FOUND');
  });

  it('CS7-04: size() excludes expired entries', () => {
    cache.set('live', 'x', 2000);
    cache.set('dying', 'y', 100);
    vi.advanceTimersByTime(200);
    expect(cache.size()).toBe(1);
  });

  it('CS7-05: expired entry is removed from the store during has()', () => {
    cache.set('k', 'v', 100);
    vi.advanceTimersByTime(200);
    cache.has('k');           // triggers auto-remove
    // After auto-remove, get() also reports not-found
    const r = cache.get('k');
    expect(r.ok).toBe(false);
  });
});

// ─── CS8: TTL expiration — advanced (4 tests, fake timers) ───────────────────

describe('CS8: TTL expiration advanced', () => {
  let cache: CacheStore;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CS8-01: set() without ttlMs creates a non-expiring entry', () => {
    cache.set('forever', 'here');
    vi.advanceTimersByTime(999_999_999);
    expect(cache.has('forever')).toBe(true);
  });

  it('CS8-02: overwriting with a new TTL resets the expiry clock', () => {
    cache.set('k', 'v1', 200);
    vi.advanceTimersByTime(150);
    cache.set('k', 'v2', 500); // reset TTL — should survive another 500ms
    vi.advanceTimersByTime(400);
    expect(cache.has('k')).toBe(true);
  });

  it('CS8-03: overwriting without ttlMs clears a previously set TTL', () => {
    cache.set('k', 'v1', 200);
    vi.advanceTimersByTime(50);
    cache.set('k', 'v2');     // no TTL → entry should never expire
    vi.advanceTimersByTime(1000);
    expect(cache.has('k')).toBe(true);
  });

  it('CS8-04: size() returns accurate count with a mix of live and expired entries', () => {
    cache.set('a', 1, 100);
    cache.set('b', 2, 100);
    cache.set('c', 3, 5000);
    vi.advanceTimersByTime(200);
    expect(cache.size()).toBe(1); // only 'c' survives
  });
});

// ─── CS9: overwrite behaviour (4 tests) ──────────────────────────────────────

describe('CS9: overwrite behaviour', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS9-01: overwrite stores the new value', () => {
    cache.set('k', 'old');
    cache.set('k', 'new');
    const r = cache.get<string>('k');
    expect(r.ok && r.value).toBe('new');
  });

  it('CS9-02: size() stays the same when overwriting an existing key', () => {
    cache.set('k', 1);
    cache.set('k', 2);
    expect(cache.size()).toBe(1);
  });

  it('CS9-03: has() remains true after overwrite', () => {
    cache.set('k', 'x');
    cache.set('k', 'y');
    expect(cache.has('k')).toBe(true);
  });

  it('CS9-04: get() returns the latest value after multiple overwrites', () => {
    cache.set('k', 1);
    cache.set('k', 2);
    cache.set('k', 3);
    const r = cache.get<number>('k');
    expect(r.ok && r.value).toBe(3);
  });
});

// ─── CS10: defensive copies (4 tests) ────────────────────────────────────────

describe('CS10: defensive copies', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS10-01: mutating the object returned by get() does not corrupt the store', () => {
    cache.set('obj', { count: 1 });
    const r = cache.get<{ count: number }>('obj');
    if (r.ok) r.value.count = 999;
    const r2 = cache.get<{ count: number }>('obj');
    expect(r2.ok && r2.value.count).toBe(1);
  });

  it('CS10-02: mutating the input object after set() does not corrupt the store', () => {
    const input = { score: 10 };
    cache.set('input', input);
    input.score = 99;
    const r = cache.get<{ score: number }>('input');
    expect(r.ok && r.value.score).toBe(10);
  });

  it('CS10-03: two successive get() calls return independent copies', () => {
    cache.set('arr', [1, 2, 3]);
    const r1 = cache.get<number[]>('arr');
    const r2 = cache.get<number[]>('arr');
    if (r1.ok) r1.value.push(99);
    expect(r2.ok && r2.value.length).toBe(3);
  });

  it('CS10-04: null can be stored and retrieved as-is', () => {
    cache.set('nil', null);
    const r = cache.get<null>('nil');
    expect(r.ok && r.value).toBeNull();
  });
});

// ─── CS11: edge values (4 tests) ─────────────────────────────────────────────

describe('CS11: edge values', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS11-01: empty string value can be stored and retrieved', () => {
    cache.set('empty', '');
    const r = cache.get<string>('empty');
    expect(r.ok && r.value).toBe('');
  });

  it('CS11-02: zero (0) can be stored and retrieved', () => {
    cache.set('zero', 0);
    const r = cache.get<number>('zero');
    expect(r.ok && r.value).toBe(0);
  });

  it('CS11-03: false can be stored and retrieved', () => {
    cache.set('flag', false);
    const r = cache.get<boolean>('flag');
    expect(r.ok && r.value).toBe(false);
  });

  it('CS11-04: array value is stored and retrieved as a defensive copy', () => {
    cache.set('list', [10, 20, 30]);
    const r = cache.get<number[]>('list');
    expect(r.ok && r.value).toEqual([10, 20, 30]);
  });
});

// ─── CS12: malformed input and never-throw (8 tests) ─────────────────────────

describe('CS12: malformed input and never-throw', () => {
  let cache: CacheStore;
  beforeEach(() => { cache = new CacheStore(); });

  it('CS12-01: set() with empty string key returns INVALID_KEY', () => {
    const r = cache.set('', 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CS12-02: set() with non-string key (number) returns INVALID_KEY', () => {
    const r = cache.set(42 as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CS12-03: set() with null key returns INVALID_KEY', () => {
    const r = cache.set(null as unknown as string, 'v');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CS12-04: get() with empty string key returns INVALID_KEY', () => {
    const r = cache.get('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_KEY');
  });

  it('CS12-05: has() with non-string key returns false without throwing', () => {
    expect(() => cache.has(42 as unknown as string)).not.toThrow();
    expect(cache.has(42 as unknown as string)).toBe(false);
  });

  it('CS12-06: delete() with non-string key returns without throwing', () => {
    expect(() => cache.delete(null as unknown as string)).not.toThrow();
  });

  it('CS12-07: set() with negative ttlMs returns INVALID_TTL', () => {
    const r = cache.set('k', 'v', -1);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_TTL');
  });

  it('CS12-08: set() with zero ttlMs returns INVALID_TTL', () => {
    const r = cache.set('k', 'v', 0);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_TTL');
  });
});
