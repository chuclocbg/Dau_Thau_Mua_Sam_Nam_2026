/**
 * P6-11E: MetricsCollector — test suite (56 tests, MC1–MC12).
 *
 * Plain TypeScript — no JSX, no timers (MetricsCollector has no TTL).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../providers/MetricsCollector';

// ─── MC1: Constructor and listMetrics() (5 tests) ────────────────────────────

describe('MC1: constructor and listMetrics()', () => {
  it('MC1-01: new MetricsCollector() does not throw', () => {
    expect(() => new MetricsCollector()).not.toThrow();
  });

  it('MC1-02: listMetrics() returns [] on an empty collector', () => {
    const mc = new MetricsCollector();
    expect(mc.listMetrics()).toEqual([]);
  });

  it('MC1-03: listMetrics() returns entries in insertion order', () => {
    const mc = new MetricsCollector();
    mc.increment('c');
    mc.increment('a');
    mc.increment('b');
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toEqual(['c', 'a', 'b']);
  });

  it('MC1-04: listMetrics() returns a fresh array each call', () => {
    const mc = new MetricsCollector();
    mc.increment('x');
    const a = mc.listMetrics();
    const b = mc.listMetrics();
    expect(a).not.toBe(b);
  });

  it('MC1-05: listMetrics() entries carry correct name and value', () => {
    const mc = new MetricsCollector();
    mc.set('score', 42);
    const entries = mc.listMetrics();
    expect(entries[0].name).toBe('score');
    expect(entries[0].value).toBe(42);
  });
});

// ─── MC2: increment() (5 tests) ──────────────────────────────────────────────

describe('MC2: increment()', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC2-01: increment() on a new metric returns ok:true with value 1', () => {
    const r = mc.increment('hits');
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toBe(1);
  });

  it('MC2-02: increment() twice on the same metric returns value 2', () => {
    mc.increment('hits');
    const r = mc.increment('hits');
    expect(r.ok && r.value).toBe(2);
  });

  it('MC2-03: increment() creates the metric at 1 when it does not exist', () => {
    mc.increment('new');
    expect(mc.get('new')).toBe(1);
  });

  it('MC2-04: increment() accumulates correctly over many calls', () => {
    for (let i = 0; i < 10; i++) mc.increment('counter');
    expect(mc.get('counter')).toBe(10);
  });

  it('MC2-05: get() returns updated value after increment()', () => {
    mc.increment('req');
    mc.increment('req');
    mc.increment('req');
    expect(mc.get('req')).toBe(3);
  });
});

// ─── MC3: add() (5 tests) ────────────────────────────────────────────────────

describe('MC3: add()', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC3-01: add() on a new metric returns ok:true with the added value', () => {
    const r = mc.add('bytes', 1024);
    expect(r.ok && r.value).toBe(1024);
  });

  it('MC3-02: add() on existing metric returns the accumulated value', () => {
    mc.add('bytes', 500);
    const r = mc.add('bytes', 300);
    expect(r.ok && r.value).toBe(800);
  });

  it('MC3-03: add() with a negative value decrements the metric', () => {
    mc.set('balance', 100);
    const r = mc.add('balance', -30);
    expect(r.ok && r.value).toBe(70);
  });

  it('MC3-04: add() with zero leaves the value unchanged', () => {
    mc.set('gauge', 55);
    const r = mc.add('gauge', 0);
    expect(r.ok && r.value).toBe(55);
  });

  it('MC3-05: get() returns the correct value after a series of add() calls', () => {
    mc.add('total', 10);
    mc.add('total', 20);
    mc.add('total', -5);
    expect(mc.get('total')).toBe(25);
  });
});

// ─── MC4: set() (5 tests) ────────────────────────────────────────────────────

describe('MC4: set()', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC4-01: set() on a new metric returns ok:true with the set value', () => {
    const r = mc.set('temp', 37);
    expect(r.ok && r.value).toBe(37);
  });

  it('MC4-02: set() on an existing metric replaces the value', () => {
    mc.set('level', 5);
    const r = mc.set('level', 99);
    expect(r.ok && r.value).toBe(99);
    expect(mc.get('level')).toBe(99);
  });

  it('MC4-03: set() with a negative value is valid', () => {
    const r = mc.set('delta', -7);
    expect(r.ok && r.value).toBe(-7);
  });

  it('MC4-04: set() with zero is valid', () => {
    mc.set('gauge', 100);
    const r = mc.set('gauge', 0);
    expect(r.ok && r.value).toBe(0);
    expect(mc.get('gauge')).toBe(0);
  });

  it('MC4-05: get() returns the correct value after set()', () => {
    mc.set('cpu', 73);
    expect(mc.get('cpu')).toBe(73);
  });
});

// ─── MC5: get() (4 tests) ────────────────────────────────────────────────────

describe('MC5: get()', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC5-01: get() returns 0 for an unknown metric name', () => {
    expect(mc.get('missing')).toBe(0);
  });

  it('MC5-02: get() returns the current stored value', () => {
    mc.set('x', 42);
    expect(mc.get('x')).toBe(42);
  });

  it('MC5-03: get() with a non-string name returns 0 without throwing', () => {
    expect(() => mc.get(null as unknown as string)).not.toThrow();
    expect(mc.get(null as unknown as string)).toBe(0);
  });

  it('MC5-04: get() with an empty string name returns 0 without throwing', () => {
    expect(() => mc.get('')).not.toThrow();
    expect(mc.get('')).toBe(0);
  });
});

// ─── MC6: reset() (4 tests) ──────────────────────────────────────────────────

describe('MC6: reset()', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC6-01: reset() on a known metric sets its value to 0', () => {
    mc.set('counter', 50);
    mc.reset('counter');
    expect(mc.get('counter')).toBe(0);
  });

  it('MC6-02: reset() on an unknown metric does not throw', () => {
    expect(() => mc.reset('ghost')).not.toThrow();
  });

  it('MC6-03: reset() keeps the metric in listMetrics() (does not remove it)', () => {
    mc.set('counter', 50);
    mc.reset('counter');
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toContain('counter');
  });

  it('MC6-04: reset() on an unknown metric does not create a new entry', () => {
    mc.reset('phantom');
    expect(mc.listMetrics().length).toBe(0);
  });
});

// ─── MC7: clear() (4 tests) ──────────────────────────────────────────────────

describe('MC7: clear()', () => {
  let mc: MetricsCollector;
  beforeEach(() => {
    mc = new MetricsCollector();
    mc.set('a', 1);
    mc.set('b', 2);
  });

  it('MC7-01: clear() does not throw', () => {
    expect(() => mc.clear()).not.toThrow();
  });

  it('MC7-02: listMetrics() returns [] after clear()', () => {
    mc.clear();
    expect(mc.listMetrics()).toEqual([]);
  });

  it('MC7-03: get() returns 0 for any metric after clear()', () => {
    mc.clear();
    expect(mc.get('a')).toBe(0);
    expect(mc.get('b')).toBe(0);
  });

  it('MC7-04: clear() on an already-empty collector does not throw', () => {
    mc.clear();
    expect(() => mc.clear()).not.toThrow();
  });
});

// ─── MC8: Insertion order (5 tests) ──────────────────────────────────────────

describe('MC8: insertion order', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC8-01: listMetrics() preserves the order metrics were first created', () => {
    mc.increment('first');
    mc.increment('second');
    mc.increment('third');
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toEqual(['first', 'second', 'third']);
  });

  it('MC8-02: increment() on an existing metric does not change its position', () => {
    mc.increment('a');
    mc.increment('b');
    mc.increment('c');
    mc.increment('b'); // second call — should not move 'b'
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('MC8-03: set() on an existing metric does not change its position', () => {
    mc.set('x', 1);
    mc.set('y', 2);
    mc.set('z', 3);
    mc.set('y', 99); // overwrite — position unchanged
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toEqual(['x', 'y', 'z']);
  });

  it('MC8-04: after clear() and re-add, insertion order resets', () => {
    mc.increment('old');
    mc.clear();
    mc.increment('new');
    const names = mc.listMetrics().map(e => e.name);
    expect(names).toEqual(['new']);
  });

  it('MC8-05: listMetrics() entries carry the current accumulated value', () => {
    mc.add('sum', 10);
    mc.add('sum', 5);
    const entry = mc.listMetrics()[0];
    expect(entry.value).toBe(15);
  });
});

// ─── MC9: defensive copies (4 tests) ─────────────────────────────────────────

describe('MC9: defensive copies', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC9-01: mutating a returned MetricEntry does not corrupt the store', () => {
    mc.set('gauge', 10);
    const entries = mc.listMetrics();
    // MetricEntry fields are readonly/primitive — reassign via cast to check isolation
    (entries[0] as { value: number }).value = 999;
    expect(mc.get('gauge')).toBe(10);
  });

  it('MC9-02: two listMetrics() calls return independent arrays', () => {
    mc.set('a', 1);
    const first  = mc.listMetrics();
    const second = mc.listMetrics();
    first.push({ name: 'injected', value: 0 });
    expect(second.length).toBe(1);
  });

  it('MC9-03: pushing onto a listMetrics() result does not grow the store', () => {
    mc.set('a', 1);
    const list = mc.listMetrics();
    list.push({ name: 'injected', value: 42 });
    expect(mc.listMetrics().length).toBe(1);
  });

  it('MC9-04: get() always returns a primitive — no reference aliasing possible', () => {
    mc.set('n', 7);
    const v = mc.get('n');
    // numbers are primitives; mutating the local variable cannot affect the store
    expect(v).toBe(7);
    expect(mc.get('n')).toBe(7);
  });
});

// ─── MC10: Method interactions (3 tests) ─────────────────────────────────────

describe('MC10: method interactions', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC10-01: increment, add, and set can be mixed for the same metric', () => {
    mc.set('x', 10);    // x = 10
    mc.add('x', 5);     // x = 15
    mc.increment('x');  // x = 16
    mc.set('x', 0);     // x = 0
    mc.add('x', 3);     // x = 3
    expect(mc.get('x')).toBe(3);
  });

  it('MC10-02: clear() then increment() starts fresh at 1', () => {
    mc.set('c', 100);
    mc.clear();
    mc.increment('c');
    expect(mc.get('c')).toBe(1);
  });

  it('MC10-03: multiple metrics are tracked independently', () => {
    mc.set('a', 1);
    mc.set('b', 2);
    mc.set('c', 3);
    mc.add('b', 10);
    mc.increment('c');
    expect(mc.get('a')).toBe(1);
    expect(mc.get('b')).toBe(12);
    expect(mc.get('c')).toBe(4);
  });
});

// ─── MC11: Edge cases (4 tests) ──────────────────────────────────────────────

describe('MC11: edge cases', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC11-01: add() with fractional values accumulates correctly', () => {
    mc.add('rate', 0.1);
    mc.add('rate', 0.2);
    // Use approximate equality to handle floating point
    expect(mc.get('rate')).toBeCloseTo(0.3, 10);
  });

  it('MC11-02: set() with a very large finite number is valid', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const r = mc.set('big', big);
    expect(r.ok && r.value).toBe(big);
    expect(mc.get('big')).toBe(big);
  });

  it('MC11-03: increment() called many times gives the correct total', () => {
    for (let i = 0; i < 100; i++) mc.increment('tick');
    expect(mc.get('tick')).toBe(100);
  });

  it('MC11-04: add() with alternating sign gives the correct net total', () => {
    mc.add('balance', 100);
    mc.add('balance', -40);
    mc.add('balance', 20);
    mc.add('balance', -5);
    expect(mc.get('balance')).toBe(75);
  });
});

// ─── MC12: Malformed input and never-throw (8 tests) ─────────────────────────

describe('MC12: malformed input and never-throw', () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  it('MC12-01: increment() with empty name returns INVALID_METRIC_NAME', () => {
    const r = mc.increment('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_METRIC_NAME');
  });

  it('MC12-02: increment() with non-string name returns INVALID_METRIC_NAME', () => {
    const r = mc.increment(42 as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_METRIC_NAME');
  });

  it('MC12-03: add() with empty name returns INVALID_METRIC_NAME', () => {
    const r = mc.add('', 10);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_METRIC_NAME');
  });

  it('MC12-04: add() with NaN value returns INVALID_VALUE', () => {
    const r = mc.add('x', NaN);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_VALUE');
  });

  it('MC12-05: add() with Infinity value returns INVALID_VALUE', () => {
    const r = mc.add('x', Infinity);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_VALUE');
  });

  it('MC12-06: set() with NaN value returns INVALID_VALUE', () => {
    const r = mc.set('x', NaN);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_VALUE');
  });

  it('MC12-07: set() with non-string name returns INVALID_METRIC_NAME', () => {
    const r = mc.set(null as unknown as string, 5);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_METRIC_NAME');
  });

  it('MC12-08: reset() with a non-string name does not throw', () => {
    expect(() => mc.reset(undefined as unknown as string)).not.toThrow();
  });
});
