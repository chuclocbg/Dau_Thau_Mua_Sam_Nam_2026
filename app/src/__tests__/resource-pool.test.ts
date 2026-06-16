/**
 * P6-11H: ResourcePool — test suite (56 tests, RP1–RP12).
 *
 * Plain TypeScript — no JSX, no timers (ResourcePool has no TTL).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResourcePool } from '../providers/ResourcePool';

// ─── RP1: Constructor and initial state (5 tests) ─────────────────────────────

describe('RP1: constructor and initial state', () => {
  it('RP1-01: new ResourcePool() does not throw', () => {
    expect(() => new ResourcePool()).not.toThrow();
  });

  it('RP1-02: size() returns 0 on an empty pool', () => {
    const pool = new ResourcePool();
    expect(pool.size()).toBe(0);
  });

  it('RP1-03: available() returns 0 on an empty pool', () => {
    const pool = new ResourcePool();
    expect(pool.available()).toBe(0);
  });

  it('RP1-04: new ResourcePool([r]) gives size()=1 and available()=1', () => {
    const pool = new ResourcePool(['resource-A']);
    expect(pool.size()).toBe(1);
    expect(pool.available()).toBe(1);
  });

  it('RP1-05: new ResourcePool respects maxSize from options', () => {
    const pool = new ResourcePool(['A', 'B', 'C', 'D', 'E'], { maxSize: 3 });
    expect(pool.size()).toBe(3);
    expect(pool.available()).toBe(3);
  });
});

// ─── RP2: acquire() basic (5 tests) ──────────────────────────────────────────

describe('RP2: acquire() basic', () => {
  it('RP2-01: acquire() on an empty pool returns POOL_EMPTY error', () => {
    const pool = new ResourcePool();
    const result = pool.acquire();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('POOL_EMPTY');
  });

  it('RP2-02: acquire() on a populated pool returns ok:true', () => {
    const pool = new ResourcePool(['conn']);
    expect(pool.acquire().ok).toBe(true);
  });

  it('RP2-03: acquire() reduces available() by 1', () => {
    const pool = new ResourcePool(['A', 'B']);
    pool.acquire();
    expect(pool.available()).toBe(1);
  });

  it('RP2-04: size() is unchanged after acquire()', () => {
    const pool = new ResourcePool(['A', 'B']);
    pool.acquire();
    expect(pool.size()).toBe(2);
  });

  it('RP2-05: acquiring the last resource causes the next acquire() to return POOL_EMPTY', () => {
    const pool = new ResourcePool(['only']);
    pool.acquire();
    const second = pool.acquire();
    expect(second.ok).toBe(false);
    expect(!second.ok && second.error.code).toBe('POOL_EMPTY');
  });
});

// ─── RP3: acquire() FIFO ordering (5 tests) ──────────────────────────────────

describe('RP3: acquire() FIFO ordering', () => {
  let pool: ResourcePool<string>;
  beforeEach(() => { pool = new ResourcePool(['A', 'B', 'C']); });

  it('RP3-01: acquire() returns resources in FIFO order', () => {
    const r1 = pool.acquire();
    const r2 = pool.acquire();
    const r3 = pool.acquire();
    expect(r1.ok && r1.value).toBe('A');
    expect(r2.ok && r2.value).toBe('B');
    expect(r3.ok && r3.value).toBe('C');
  });

  it('RP3-02: after release, released resource goes to back of queue', () => {
    const r1 = pool.acquire(); // A — pool becomes [B, C]
    if (!r1.ok) throw new Error('expected ok');
    pool.release(r1.value);    // A → back: pool becomes [B, C, A]
    const next = pool.acquire(); // should get B (oldest remaining)
    expect(next.ok && next.value).toBe('B');
  });

  it('RP3-03: acquiring all resources empties the available queue', () => {
    pool.acquire();
    pool.acquire();
    pool.acquire();
    expect(pool.available()).toBe(0);
  });

  it('RP3-04: first acquire() always returns the first resource added', () => {
    const result = pool.acquire();
    expect(result.ok && result.value).toBe('A');
  });

  it('RP3-05: FIFO order is preserved across a full acquire-release-acquire cycle', () => {
    const r1 = pool.acquire(); // A
    const r2 = pool.acquire(); // B
    if (!r1.ok || !r2.ok) throw new Error('expected ok');
    pool.release(r1.value);   // A → back: [C, A]
    pool.release(r2.value);   // B → back: [C, A, B]
    const order = [pool.acquire(), pool.acquire(), pool.acquire()].map(
      r => (r.ok ? r.value : null),
    );
    expect(order).toEqual(['C', 'A', 'B']);
  });
});

// ─── RP4: release() basic (4 tests) ──────────────────────────────────────────

describe('RP4: release() basic', () => {
  let pool: ResourcePool<string>;
  beforeEach(() => { pool = new ResourcePool(['X', 'Y']); });

  it('RP4-01: release() returns ok:true', () => {
    const r = pool.acquire();
    if (!r.ok) throw new Error('expected ok');
    expect(pool.release(r.value).ok).toBe(true);
  });

  it('RP4-02: release() increases available() by 1', () => {
    const r = pool.acquire();
    if (!r.ok) throw new Error('expected ok');
    const before = pool.available();
    pool.release(r.value);
    expect(pool.available()).toBe(before + 1);
  });

  it('RP4-03: size() is unchanged after release()', () => {
    const r = pool.acquire();
    if (!r.ok) throw new Error('expected ok');
    pool.release(r.value);
    expect(pool.size()).toBe(2);
  });

  it('RP4-04: after release, the resource can be acquired again', () => {
    const r1 = pool.acquire();
    if (!r1.ok) throw new Error('expected ok');
    pool.release(r1.value);
    const r2 = pool.acquire();
    expect(r2.ok).toBe(true);
  });
});

// ─── RP5: release() safety (5 tests) ─────────────────────────────────────────

describe('RP5: release() safety', () => {
  let pool: ResourcePool<string>;
  beforeEach(() => { pool = new ResourcePool(['A']); });

  it('RP5-01: releasing an unknown resource returns ok:true', () => {
    expect(pool.release('not-from-pool' as unknown as string).ok).toBe(true);
  });

  it('RP5-02: releasing null returns ok:true', () => {
    expect(pool.release(null as unknown as string).ok).toBe(true);
  });

  it('RP5-03: releasing undefined returns ok:true', () => {
    expect(pool.release(undefined as unknown as string).ok).toBe(true);
  });

  it('RP5-04: duplicate release does not add an extra copy to the pool', () => {
    const r = pool.acquire();
    if (!r.ok) throw new Error('expected ok');
    pool.release(r.value);   // first release: back in pool
    pool.release(r.value);   // second release: no-op (already available)
    expect(pool.available()).toBe(1);
  });

  it('RP5-05: size() is unchanged after releasing an unknown resource', () => {
    const before = pool.size();
    pool.release('unknown' as unknown as string);
    expect(pool.size()).toBe(before);
  });
});

// ─── RP6: size() and available() (4 tests) ────────────────────────────────────

describe('RP6: size() and available()', () => {
  it('RP6-01: size() equals available() when no resources are acquired', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    expect(pool.size()).toBe(pool.available());
  });

  it('RP6-02: size() = available() + count of acquired resources', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    pool.acquire();
    pool.acquire();
    expect(pool.size()).toBe(3);
    expect(pool.available()).toBe(1);
  });

  it('RP6-03: available() decrements on acquire and increments on release', () => {
    const pool = new ResourcePool(['R']);
    expect(pool.available()).toBe(1);
    const r = pool.acquire();
    expect(pool.available()).toBe(0);
    if (r.ok) pool.release(r.value);
    expect(pool.available()).toBe(1);
  });

  it('RP6-04: after clear(), both size() and available() return 0', () => {
    const pool = new ResourcePool(['A', 'B']);
    pool.clear();
    expect(pool.size()).toBe(0);
    expect(pool.available()).toBe(0);
  });
});

// ─── RP7: clear() (4 tests) ──────────────────────────────────────────────────

describe('RP7: clear()', () => {
  let pool: ResourcePool<string>;
  beforeEach(() => {
    pool = new ResourcePool(['a', 'b', 'c']);
  });

  it('RP7-01: clear() does not throw', () => {
    expect(() => pool.clear()).not.toThrow();
  });

  it('RP7-02: clear() resets size() and available() to 0', () => {
    pool.clear();
    expect(pool.size()).toBe(0);
    expect(pool.available()).toBe(0);
  });

  it('RP7-03: acquire() returns POOL_EMPTY after clear()', () => {
    pool.clear();
    const result = pool.acquire();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('POOL_EMPTY');
  });

  it('RP7-04: clear() on an already-empty pool does not throw', () => {
    pool.clear();
    expect(() => pool.clear()).not.toThrow();
  });
});

// ─── RP8: list() (5 tests) ───────────────────────────────────────────────────

describe('RP8: list()', () => {
  it('RP8-01: list() returns [] on an empty pool', () => {
    const pool = new ResourcePool();
    expect(pool.list()).toEqual([]);
  });

  it('RP8-02: list() returns available resources in FIFO order', () => {
    const pool = new ResourcePool(['first', 'second', 'third']);
    expect(pool.list()).toEqual(['first', 'second', 'third']);
  });

  it('RP8-03: list() does not affect size() or available()', () => {
    const pool = new ResourcePool(['A', 'B']);
    pool.list();
    expect(pool.size()).toBe(2);
    expect(pool.available()).toBe(2);
  });

  it('RP8-04: pushing onto the list() result does not grow the pool', () => {
    const pool = new ResourcePool(['R']);
    const snapshot = pool.list();
    snapshot.push('injected');
    expect(pool.size()).toBe(1);
    expect(pool.available()).toBe(1);
  });

  it('RP8-05: acquired resources do NOT appear in list()', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    pool.acquire(); // removes A from available
    const listed = pool.list();
    expect(listed).not.toContain('A');
    expect(listed).toEqual(['B', 'C']);
  });
});

// ─── RP9: Defensive copies (4 tests) ─────────────────────────────────────────

describe('RP9: defensive copies', () => {
  it('RP9-01: mutating a resource from list() does not corrupt the pool', () => {
    const pool = new ResourcePool([{ count: 1 }]);
    const listed = pool.list() as Array<{ count: number }>;
    listed[0].count = 999;
    const acquired = pool.acquire();
    expect(acquired.ok && (acquired.value as { count: number }).count).toBe(1);
  });

  it('RP9-02: two list() calls return independent array instances', () => {
    const pool = new ResourcePool(['item']);
    const list1 = pool.list();
    const list2 = pool.list();
    list1.push('extra');
    expect(list2.length).toBe(1);
  });

  it('RP9-03: mutating the original input after construction does not corrupt the pool', () => {
    const original = { score: 10 };
    const pool = new ResourcePool([original]);
    original.score = 99;
    const r = pool.acquire();
    expect(r.ok && (r.value as { score: number }).score).toBe(10);
  });

  it('RP9-04: list() reflects current state after acquire and release', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    const r = pool.acquire(); // A removed
    expect(pool.list()).toEqual(['B', 'C']);
    if (r.ok) pool.release(r.value); // A goes to back
    expect(pool.list()).toEqual(['B', 'C', 'A']);
  });
});

// ─── RP10: maxSize (3 tests) ──────────────────────────────────────────────────

describe('RP10: maxSize', () => {
  it('RP10-01: constructor truncates resources to maxSize', () => {
    const pool = new ResourcePool(['A', 'B', 'C', 'D', 'E'], { maxSize: 2 });
    expect(pool.size()).toBe(2);
    expect(pool.available()).toBe(2);
  });

  it('RP10-02: size() never exceeds maxSize across acquire/release cycles', () => {
    const pool = new ResourcePool(['A', 'B'], { maxSize: 2 });
    const r1 = pool.acquire();
    const r2 = pool.acquire();
    if (r1.ok) pool.release(r1.value);
    if (r2.ok) pool.release(r2.value);
    expect(pool.size()).toBe(2);
    expect(pool.available()).toBe(2);
  });

  it('RP10-03: list() length never exceeds maxSize', () => {
    const pool = new ResourcePool(['X', 'Y', 'Z'], { maxSize: 2 });
    expect(pool.list().length).toBeLessThanOrEqual(2);
  });
});

// ─── RP11: Mixed operations (4 tests) ────────────────────────────────────────

describe('RP11: mixed operations', () => {
  it('RP11-01: acquire all then release all restores original available count', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    const r1 = pool.acquire();
    const r2 = pool.acquire();
    const r3 = pool.acquire();
    if (r1.ok) pool.release(r1.value);
    if (r2.ok) pool.release(r2.value);
    if (r3.ok) pool.release(r3.value);
    expect(pool.available()).toBe(3);
    expect(pool.size()).toBe(3);
  });

  it('RP11-02: interleaved acquire and release maintains correct size and available', () => {
    const pool = new ResourcePool(['P', 'Q', 'R']);
    const r1 = pool.acquire(); // avail: 2, size: 3
    expect(pool.available()).toBe(2);
    if (r1.ok) pool.release(r1.value); // avail: 3, size: 3
    expect(pool.available()).toBe(3);
    pool.acquire(); // avail: 2, size: 3
    expect(pool.size()).toBe(3);
  });

  it('RP11-03: clear() after partial acquire/release resets completely', () => {
    const pool = new ResourcePool(['A', 'B', 'C']);
    pool.acquire();
    pool.clear();
    expect(pool.size()).toBe(0);
    expect(pool.available()).toBe(0);
    expect(pool.list()).toEqual([]);
  });

  it('RP11-04: pool can be used again after clear() with new resources via release()', () => {
    const pool = new ResourcePool(['old']);
    pool.clear();
    // After clear, releasing an unknown resource is a no-op (still empty)
    pool.release('new' as unknown as string);
    // Pool remains empty (release of unknown is ignored)
    expect(pool.size()).toBe(0);
    expect(pool.acquire().ok).toBe(false);
  });
});

// ─── RP12: Malformed input and never-throw (8 tests) ─────────────────────────

describe('RP12: malformed input and never-throw', () => {
  let pool: ResourcePool;
  beforeEach(() => { pool = new ResourcePool(); });

  it('RP12-01: acquire() on an empty pool does not throw', () => {
    expect(() => pool.acquire()).not.toThrow();
  });

  it('RP12-02: release(null) does not throw', () => {
    expect(() => pool.release(null as unknown)).not.toThrow();
  });

  it('RP12-03: release(undefined) does not throw', () => {
    expect(() => pool.release(undefined as unknown)).not.toThrow();
  });

  it('RP12-04: release() with a value not from this pool does not throw', () => {
    expect(() => pool.release({ random: true } as unknown)).not.toThrow();
  });

  it('RP12-05: list() never throws and always returns an array', () => {
    expect(() => pool.list()).not.toThrow();
    expect(Array.isArray(pool.list())).toBe(true);
  });

  it('RP12-06: size() never throws and returns a number', () => {
    expect(() => pool.size()).not.toThrow();
    expect(typeof pool.size()).toBe('number');
  });

  it('RP12-07: available() never throws and returns a number', () => {
    expect(() => pool.available()).not.toThrow();
    expect(typeof pool.available()).toBe('number');
  });

  it('RP12-08: clear() never throws on a pool of any state', () => {
    const p = new ResourcePool(['X', 'Y']);
    p.acquire();
    expect(() => p.clear()).not.toThrow();
  });
});
