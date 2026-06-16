/**
 * P6-11G: TaskQueue — test suite (56 tests, TQ1–TQ12).
 *
 * Plain TypeScript — no JSX, no timers (TaskQueue has no TTL).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../providers/TaskQueue';

// ─── TQ1: Constructor and size() (5 tests) ───────────────────────────────────

describe('TQ1: constructor and size()', () => {
  it('TQ1-01: new TaskQueue() does not throw', () => {
    expect(() => new TaskQueue()).not.toThrow();
  });

  it('TQ1-02: size() returns 0 on an empty queue', () => {
    const q = new TaskQueue();
    expect(q.size()).toBe(0);
  });

  it('TQ1-03: size() returns 1 after one enqueue', () => {
    const q = new TaskQueue();
    q.enqueue('task');
    expect(q.size()).toBe(1);
  });

  it('TQ1-04: size() returns 2 after two enqueues', () => {
    const q = new TaskQueue();
    q.enqueue('a');
    q.enqueue('b');
    expect(q.size()).toBe(2);
  });

  it('TQ1-05: size() decrements after dequeue', () => {
    const q = new TaskQueue();
    q.enqueue('x');
    q.enqueue('y');
    q.dequeue();
    expect(q.size()).toBe(1);
  });
});

// ─── TQ2: enqueue() (5 tests) ────────────────────────────────────────────────

describe('TQ2: enqueue()', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ2-01: enqueue() returns ok:true for a valid task', () => {
    expect(q.enqueue('task').ok).toBe(true);
  });

  it('TQ2-02: enqueue() with a string task returns ok:true', () => {
    expect(q.enqueue('hello').ok).toBe(true);
  });

  it('TQ2-03: enqueue() with an object task returns ok:true', () => {
    expect(q.enqueue({ type: 'send-email', to: 'user@example.com' }).ok).toBe(true);
  });

  it('TQ2-04: enqueue() with a numeric task returns ok:true', () => {
    expect(q.enqueue(42).ok).toBe(true);
  });

  it('TQ2-05: size() increases with each valid enqueue', () => {
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    expect(q.size()).toBe(3);
  });
});

// ─── TQ3: dequeue() — basic (5 tests) ────────────────────────────────────────

describe('TQ3: dequeue() basic', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ3-01: dequeue() on an empty queue returns null', () => {
    expect(q.dequeue()).toBeNull();
  });

  it('TQ3-02: dequeue() on an empty queue does not throw', () => {
    expect(() => q.dequeue()).not.toThrow();
  });

  it('TQ3-03: dequeue() returns the enqueued task', () => {
    q.enqueue('payload');
    expect(q.dequeue()).toBe('payload');
  });

  it('TQ3-04: dequeue() removes the task from the queue', () => {
    q.enqueue('item');
    q.dequeue();
    expect(q.size()).toBe(0);
  });

  it('TQ3-05: dequeue() on a just-emptied queue returns null', () => {
    q.enqueue('one');
    q.dequeue();
    expect(q.dequeue()).toBeNull();
  });
});

// ─── TQ4: dequeue() — FIFO ordering (5 tests) ────────────────────────────────

describe('TQ4: dequeue() FIFO ordering', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ4-01: dequeue() returns items in first-in-first-out order', () => {
    q.enqueue('first');
    q.enqueue('second');
    q.enqueue('third');
    expect(q.dequeue()).toBe('first');
    expect(q.dequeue()).toBe('second');
    expect(q.dequeue()).toBe('third');
  });

  it('TQ4-02: second enqueued item is returned after the first is dequeued', () => {
    q.enqueue('alpha');
    q.enqueue('beta');
    q.dequeue();
    expect(q.dequeue()).toBe('beta');
  });

  it('TQ4-03: FIFO order is preserved across multiple full passes', () => {
    for (const item of ['x', 'y', 'z']) q.enqueue(item);
    const order: unknown[] = [];
    let item;
    while ((item = q.dequeue()) !== null) order.push(item);
    expect(order).toEqual(['x', 'y', 'z']);
  });

  it('TQ4-04: interleaved enqueue and dequeue maintains FIFO', () => {
    q.enqueue(1);
    q.enqueue(2);
    expect(q.dequeue()).toBe(1);
    q.enqueue(3);
    expect(q.dequeue()).toBe(2);
    expect(q.dequeue()).toBe(3);
  });

  it('TQ4-05: dequeue() always returns the oldest remaining task', () => {
    q.enqueue('old');
    q.enqueue('new');
    expect(q.dequeue()).toBe('old');
  });
});

// ─── TQ5: peek() (4 tests) ───────────────────────────────────────────────────

describe('TQ5: peek()', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ5-01: peek() on an empty queue returns null', () => {
    expect(q.peek()).toBeNull();
  });

  it('TQ5-02: peek() returns the front task without removing it', () => {
    q.enqueue('front');
    expect(q.peek()).toBe('front');
    expect(q.size()).toBe(1);
  });

  it('TQ5-03: size() is unchanged after peek()', () => {
    q.enqueue('task');
    q.peek();
    expect(q.size()).toBe(1);
  });

  it('TQ5-04: peek() returns the same value that dequeue() would return next', () => {
    q.enqueue('A');
    q.enqueue('B');
    const peeked  = q.peek();
    const dequeued = q.dequeue();
    expect(peeked).toBe(dequeued);
  });
});

// ─── TQ6: clear() (4 tests) ──────────────────────────────────────────────────

describe('TQ6: clear()', () => {
  let q: TaskQueue;
  beforeEach(() => {
    q = new TaskQueue();
    q.enqueue('a');
    q.enqueue('b');
  });

  it('TQ6-01: clear() does not throw', () => {
    expect(() => q.clear()).not.toThrow();
  });

  it('TQ6-02: size() returns 0 after clear()', () => {
    q.clear();
    expect(q.size()).toBe(0);
  });

  it('TQ6-03: dequeue() returns null after clear()', () => {
    q.clear();
    expect(q.dequeue()).toBeNull();
  });

  it('TQ6-04: clear() on an already-empty queue does not throw', () => {
    q.clear();
    expect(() => q.clear()).not.toThrow();
  });
});

// ─── TQ7: list() (5 tests) ───────────────────────────────────────────────────

describe('TQ7: list()', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ7-01: list() returns [] on an empty queue', () => {
    expect(q.list()).toEqual([]);
  });

  it('TQ7-02: list() returns tasks in FIFO order', () => {
    q.enqueue('first');
    q.enqueue('second');
    q.enqueue('third');
    expect(q.list()).toEqual(['first', 'second', 'third']);
  });

  it('TQ7-03: list() does not remove tasks — size is unchanged', () => {
    q.enqueue('a');
    q.enqueue('b');
    q.list();
    expect(q.size()).toBe(2);
  });

  it('TQ7-04: pushing onto the list() result does not grow the queue', () => {
    q.enqueue('item');
    const snapshot = q.list();
    snapshot.push('injected');
    expect(q.size()).toBe(1);
  });

  it('TQ7-05: list() sequence matches the order of successive dequeue() calls', () => {
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    const listed: unknown[] = q.list();
    const dequeued: unknown[] = [];
    let t;
    while ((t = q.dequeue()) !== null) dequeued.push(t);
    expect(listed).toEqual(dequeued);
  });
});

// ─── TQ8: Defensive copies (4 tests) ─────────────────────────────────────────

describe('TQ8: defensive copies', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ8-01: mutating the peeked object does not corrupt the stored task', () => {
    q.enqueue({ count: 1 });
    const peeked = q.peek() as { count: number };
    if (peeked) peeked.count = 999;
    const dequeued = q.dequeue() as { count: number };
    expect(dequeued?.count).toBe(1);
  });

  it('TQ8-02: mutating the input object after enqueue() does not corrupt the queue', () => {
    const original = { score: 10 };
    q.enqueue(original);
    original.score = 99;
    const result = q.dequeue() as { score: number };
    expect(result?.score).toBe(10);
  });

  it('TQ8-03: mutating a task from list() does not corrupt the stored task', () => {
    q.enqueue({ value: 5 });
    const listed = q.list() as Array<{ value: number }>;
    listed[0].value = 888;
    const dequeued = q.dequeue() as { value: number };
    expect(dequeued?.value).toBe(5);
  });

  it('TQ8-04: two list() calls return independent array instances', () => {
    q.enqueue('item');
    const list1 = q.list();
    const list2 = q.list();
    list1.push('extra');
    expect(list2.length).toBe(1);
  });
});

// ─── TQ9: Insertion order (4 tests) ──────────────────────────────────────────

describe('TQ9: insertion order', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ9-01: multiple enqueues preserve insertion order in list()', () => {
    q.enqueue('A');
    q.enqueue('B');
    q.enqueue('C');
    expect(q.list()).toEqual(['A', 'B', 'C']);
  });

  it('TQ9-02: after dequeue, list() starts from the new front', () => {
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    q.dequeue(); // removes 1
    expect(q.list()).toEqual([2, 3]);
  });

  it('TQ9-03: enqueue after dequeue appends to the back', () => {
    q.enqueue('first');
    q.enqueue('second');
    q.dequeue();        // removes 'first'
    q.enqueue('third'); // appended to back
    expect(q.list()).toEqual(['second', 'third']);
  });

  it('TQ9-04: after clear() and re-enqueue, list() reflects fresh state', () => {
    q.enqueue('old1');
    q.enqueue('old2');
    q.clear();
    q.enqueue('fresh');
    expect(q.list()).toEqual(['fresh']);
  });
});

// ─── TQ10: Edge values (3 tests) ─────────────────────────────────────────────

describe('TQ10: edge values', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ10-01: zero (0) can be enqueued and dequeued', () => {
    q.enqueue(0);
    expect(q.dequeue()).toBe(0);
  });

  it('TQ10-02: false can be enqueued and dequeued', () => {
    q.enqueue(false);
    expect(q.dequeue()).toBe(false);
  });

  it('TQ10-03: empty string can be enqueued and dequeued', () => {
    q.enqueue('');
    expect(q.dequeue()).toBe('');
  });
});

// ─── TQ11: Mixed operations (4 tests) ────────────────────────────────────────

describe('TQ11: mixed operations', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ11-01: enqueue then peek leaves size unchanged', () => {
    q.enqueue('task');
    q.peek();
    expect(q.size()).toBe(1);
  });

  it('TQ11-02: size reflects enqueue, dequeue, and clear correctly', () => {
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    expect(q.size()).toBe(3);
    q.dequeue();
    expect(q.size()).toBe(2);
    q.clear();
    expect(q.size()).toBe(0);
  });

  it('TQ11-03: list() after partial dequeue shows only remaining tasks in order', () => {
    q.enqueue('p');
    q.enqueue('q');
    q.enqueue('r');
    q.dequeue(); // removes 'p'
    expect(q.list()).toEqual(['q', 'r']);
  });

  it('TQ11-04: peek() after dequeue shows the new front task', () => {
    q.enqueue('first');
    q.enqueue('second');
    q.dequeue();
    expect(q.peek()).toBe('second');
  });
});

// ─── TQ12: Malformed input and never-throw (8 tests) ─────────────────────────

describe('TQ12: malformed input and never-throw', () => {
  let q: TaskQueue;
  beforeEach(() => { q = new TaskQueue(); });

  it('TQ12-01: enqueue(null) returns INVALID_TASK error', () => {
    const r = q.enqueue(null as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_TASK');
  });

  it('TQ12-02: enqueue(undefined) returns INVALID_TASK error', () => {
    const r = q.enqueue(undefined as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_TASK');
  });

  it('TQ12-03: malformed enqueue does not change size', () => {
    q.enqueue(null as unknown as string);
    expect(q.size()).toBe(0);
  });

  it('TQ12-04: dequeue() after only malformed enqueues returns null', () => {
    q.enqueue(null as unknown as string);
    q.enqueue(undefined as unknown as string);
    expect(q.dequeue()).toBeNull();
  });

  it('TQ12-05: peek() on empty queue returns null without throwing', () => {
    expect(() => q.peek()).not.toThrow();
    expect(q.peek()).toBeNull();
  });

  it('TQ12-06: repeated dequeue() on empty queue never throws', () => {
    expect(() => {
      for (let i = 0; i < 10; i++) q.dequeue();
    }).not.toThrow();
  });

  it('TQ12-07: list() never throws and always returns an array', () => {
    expect(() => q.list()).not.toThrow();
    expect(Array.isArray(q.list())).toBe(true);
  });

  it('TQ12-08: size() never throws', () => {
    expect(() => q.size()).not.toThrow();
    expect(typeof q.size()).toBe('number');
  });
});
