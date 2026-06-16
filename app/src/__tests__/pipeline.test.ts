/**
 * P6-12F: Pipeline — sequential stage processor tests.
 *
 * 56 tests grouped PF1-PF12.
 *
 * Groups:
 *   PF1  (5) Constructor / initial state
 *   PF2  (5) add() — valid stages
 *   PF3  (5) add() — invalid stages (INVALID_STAGE)
 *   PF4  (5) remove()
 *   PF5  (5) execute() — success cases
 *   PF6  (5) execute() — stage errors
 *   PF7  (4) Async stages
 *   PF8  (4) Stage ordering
 *   PF9  (4) size()
 *   PF10 (4) clear()
 *   PF11 (4) list() + defensive copies
 *   PF12 (6) Never throw / edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Pipeline,
  type PipelineResult,
  type PipelineError,
  type PipelineErrorCode,
} from '../providers/Pipeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStage(
  transform: (v: unknown) => unknown = (v) => v,
): (v: unknown) => unknown {
  return vi.fn(transform);
}

function makeAsyncStage(
  transform: (v: unknown) => unknown = (v) => v,
): (v: unknown) => Promise<unknown> {
  return vi.fn(async (v) => transform(v));
}

function makeThrowingStage(msg = 'stage-boom'): (v: unknown) => never {
  return vi.fn(() => { throw new Error(msg); });
}

function makeRejectingStage(msg = 'async-boom'): (v: unknown) => Promise<never> {
  return vi.fn(async () => { throw new Error(msg); });
}

function extractIndex(r: PipelineResult<number>): number {
  if (!r.ok) throw new Error(`Expected ok result; got error: ${r.error.code}`);
  return r.value;
}

// ─── PF1: Constructor / initial state ────────────────────────────────────────

describe('PF1: Constructor / initial state', () => {
  it('PF1-01: new Pipeline() constructs without throwing', () => {
    expect(() => new Pipeline()).not.toThrow();
  });

  it('PF1-02: size() returns 0 initially', () => {
    expect(new Pipeline().size()).toBe(0);
  });

  it('PF1-03: list() returns [] initially', () => {
    expect(new Pipeline().list()).toEqual([]);
  });

  it('PF1-04: clear() on empty pipeline is a safe no-op', () => {
    const p = new Pipeline();
    expect(() => p.clear()).not.toThrow();
    expect(p.size()).toBe(0);
  });

  it('PF1-05: execute() with no stages returns input value unchanged', async () => {
    const p = new Pipeline();
    const r = await p.execute('hello');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('hello');
  });
});

// ─── PF2: add() — valid stages ───────────────────────────────────────────────

describe('PF2: add() — valid stages', () => {
  it('PF2-01: add(syncFn) returns { ok: true, value: number }', () => {
    const p = new Pipeline();
    const r = p.add((v) => v);
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('PF2-02: add(asyncFn) returns { ok: true, value: number }', () => {
    const p = new Pipeline();
    const r = p.add(async (v) => v);
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('PF2-03: first add() returns index 0', () => {
    const p = new Pipeline();
    const r = p.add((v) => v);
    if (r.ok) expect(r.value).toBe(0);
  });

  it('PF2-04: successive add() calls return incrementing indices', () => {
    const p = new Pipeline();
    const i0 = extractIndex(p.add((v) => v));
    const i1 = extractIndex(p.add((v) => v));
    const i2 = extractIndex(p.add((v) => v));
    expect([i0, i1, i2]).toEqual([0, 1, 2]);
  });

  it('PF2-05: add() increases size()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    expect(p.size()).toBe(2);
  });
});

// ─── PF3: add() — invalid stages ─────────────────────────────────────────────

describe('PF3: add() — invalid stages (INVALID_STAGE)', () => {
  it('PF3-01: add(null) returns INVALID_STAGE error', () => {
    const p = new Pipeline();
    const r = p.add(null as unknown as (v: unknown) => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_STAGE');
  });

  it('PF3-02: add(undefined) returns INVALID_STAGE error', () => {
    const p = new Pipeline();
    const r = p.add(undefined as unknown as (v: unknown) => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_STAGE');
  });

  it('PF3-03: add(42) returns INVALID_STAGE error', () => {
    const p = new Pipeline();
    const r = p.add(42 as unknown as (v: unknown) => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_STAGE');
  });

  it('PF3-04: add("string") returns INVALID_STAGE error', () => {
    const p = new Pipeline();
    const r = p.add('hello' as unknown as (v: unknown) => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_STAGE');
  });

  it('PF3-05: invalid add() does not change size()', () => {
    const p = new Pipeline();
    p.add(null as unknown as (v: unknown) => unknown);
    p.add(42   as unknown as (v: unknown) => unknown);
    expect(p.size()).toBe(0);
  });
});

// ─── PF4: remove() ───────────────────────────────────────────────────────────

describe('PF4: remove()', () => {
  it('PF4-01: remove(0) returns { ok: true }', () => {
    const p = new Pipeline();
    p.add((v) => v);
    const r = p.remove(0);
    expect(r.ok).toBe(true);
  });

  it('PF4-02: remove() decreases size()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    p.remove(0);
    expect(p.size()).toBe(1);
  });

  it('PF4-03: remove(out-of-range) returns INDEX_OUT_OF_RANGE', () => {
    const p = new Pipeline();
    p.add((v) => v);
    const r = p.remove(5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('PF4-04: remove(negative index) returns INDEX_OUT_OF_RANGE', () => {
    const p = new Pipeline();
    p.add((v) => v);
    const r = p.remove(-1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('PF4-05: remove() removes the correct middle stage by index', async () => {
    const p = new Pipeline();
    const log: number[] = [];
    p.add(() => { log.push(1); return 'a'; });
    p.add(() => { log.push(2); return 'b'; }); // index 1 — will be removed
    p.add(() => { log.push(3); return 'c'; });
    p.remove(1);
    await p.execute('start');
    expect(log).toEqual([1, 3]);
  });
});

// ─── PF5: execute() — success cases ──────────────────────────────────────────

describe('PF5: execute() — success cases', () => {
  it('PF5-01: execute() with no stages returns input as-is', async () => {
    const p = new Pipeline();
    const r = await p.execute(99);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(99);
  });

  it('PF5-02: execute() passes input through a single stage', async () => {
    const p = new Pipeline();
    p.add((v) => (v as number) * 2);
    const r = await p.execute(5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10);
  });

  it('PF5-03: execute() chains multiple stages sequentially', async () => {
    const p = new Pipeline();
    p.add((v) => (v as number) + 1);   // 10 → 11
    p.add((v) => (v as number) * 3);   // 11 → 33
    p.add((v) => (v as number) - 3);   // 33 → 30
    const r = await p.execute(10);
    if (r.ok) expect(r.value).toBe(30);
  });

  it('PF5-04: execute() shallow-clones an object return value', async () => {
    const p = new Pipeline();
    const obj = { x: 1, y: 2 };
    p.add(() => obj);
    const r = await p.execute('start');
    if (r.ok && typeof r.value === 'object' && r.value !== null) {
      expect(r.value).toEqual(obj);
      expect(r.value).not.toBe(obj);
    }
  });

  it('PF5-05: execute() shallow-clones an array return value', async () => {
    const p = new Pipeline();
    const arr = [1, 2, 3];
    p.add(() => arr);
    const r = await p.execute('start');
    if (r.ok) {
      expect(r.value).toEqual(arr);
      expect(r.value).not.toBe(arr);
    }
  });
});

// ─── PF6: execute() — stage errors ───────────────────────────────────────────

describe('PF6: execute() — stage errors', () => {
  it('PF6-01: execute() returns STAGE_FAILED when a stage throws', async () => {
    const p = new Pipeline();
    p.add(makeThrowingStage());
    const r = await p.execute('start');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STAGE_FAILED');
  });

  it('PF6-02: execute() stops after the failing stage', async () => {
    const p = new Pipeline();
    const afterFail = vi.fn((v: unknown) => v);
    p.add(makeThrowingStage('boom'));
    p.add(afterFail);
    await p.execute('start');
    expect(afterFail).not.toHaveBeenCalled();
  });

  it('PF6-03: execute() returns STAGE_FAILED when async stage rejects', async () => {
    const p = new Pipeline();
    p.add(makeRejectingStage('async-fail'));
    const r = await p.execute('start');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STAGE_FAILED');
  });

  it('PF6-04: error message contains the failing stage index', async () => {
    const p = new Pipeline();
    p.add((v) => v);             // stage 0 — passes
    p.add(makeThrowingStage());  // stage 1 — throws
    p.add((v) => v);             // stage 2 — not reached
    const r = await p.execute('start');
    if (!r.ok) expect(r.error.message).toContain('Stage 1');
  });

  it('PF6-05: failing middle stage leaves subsequent stages unrun', async () => {
    const p = new Pipeline();
    const log: number[] = [];
    p.add(() => { log.push(1); return 'a'; });
    p.add(() => { log.push(2); throw new Error('fail'); });
    p.add(() => { log.push(3); return 'c'; });
    await p.execute('start');
    expect(log).toEqual([1, 2]);
  });
});

// ─── PF7: Async stages ───────────────────────────────────────────────────────

describe('PF7: Async stages', () => {
  it('PF7-01: async stage return value flows to the next stage', async () => {
    const p = new Pipeline();
    p.add(makeAsyncStage(() => 'from-async'));
    p.add((v) => `${v as string}-continued`);
    const r = await p.execute('start');
    if (r.ok) expect(r.value).toBe('from-async-continued');
  });

  it('PF7-02: mix of sync and async stages executes in FIFO order', async () => {
    const p = new Pipeline();
    const log: string[] = [];
    p.add((v)       => { log.push('sync');  return v; });
    p.add(async (v) => { log.push('async'); return v; });
    p.add((v)       => { log.push('sync2'); return v; });
    await p.execute('x');
    expect(log).toEqual(['sync', 'async', 'sync2']);
  });

  it('PF7-03: all-async pipeline returns the correct final result', async () => {
    const p = new Pipeline();
    p.add(async () => 1);
    p.add(async (v) => (v as number) + 1);
    p.add(async (v) => (v as number) * 10);
    const r = await p.execute('start');
    if (r.ok) expect(r.value).toBe(20);
  });

  it('PF7-04: each stage receives a clone of the previous stage\'s output', async () => {
    const p = new Pipeline();
    const src = { x: 1 };
    let receivedBySecond: unknown;
    p.add(async () => src);
    p.add((v) => { receivedBySecond = v; return v; });
    await p.execute('start');
    expect(receivedBySecond).toEqual(src);
    expect(receivedBySecond).not.toBe(src);
  });
});

// ─── PF8: Stage ordering ─────────────────────────────────────────────────────

describe('PF8: Stage ordering', () => {
  it('PF8-01: stages execute in registration (FIFO) order', async () => {
    const p = new Pipeline();
    const log: number[] = [];
    p.add(() => { log.push(1); return 'a'; });
    p.add(() => { log.push(2); return 'b'; });
    p.add(() => { log.push(3); return 'c'; });
    await p.execute('start');
    expect(log).toEqual([1, 2, 3]);
  });

  it('PF8-02: output of stage N becomes the input of stage N+1', async () => {
    const p = new Pipeline();
    const received: unknown[] = [];
    p.add(() => 'transformed');
    p.add((v) => { received.push(v); return v; });
    await p.execute('original');
    expect(received[0]).toBe('transformed');
  });

  it('PF8-03: remove(0) promotes former stage[1] to position 0', async () => {
    const p = new Pipeline();
    const log: number[] = [];
    p.add(() => { log.push(0); return 'a'; }); // index 0 — removed
    p.add(() => { log.push(1); return 'b'; }); // index 1 → becomes 0
    p.remove(0);
    await p.execute('start');
    expect(log).toEqual([1]);
  });

  it('PF8-04: list() indices reflect the current stage positions', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    p.add((v) => v);
    p.remove(1); // remove middle; former [2] shifts to [1]
    const indices = p.list().map((e) => e.index);
    expect(indices).toEqual([0, 1]);
  });
});

// ─── PF9: size() ─────────────────────────────────────────────────────────────

describe('PF9: size()', () => {
  it('PF9-01: size() returns 0 on a new instance', () => {
    expect(new Pipeline().size()).toBe(0);
  });

  it('PF9-02: size() increments after add()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    expect(p.size()).toBe(2);
  });

  it('PF9-03: size() decrements after remove()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    p.remove(0);
    expect(p.size()).toBe(1);
  });

  it('PF9-04: size() is 0 after clear()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.clear();
    expect(p.size()).toBe(0);
  });
});

// ─── PF10: clear() ───────────────────────────────────────────────────────────

describe('PF10: clear()', () => {
  it('PF10-01: clear() empties the pipeline', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    p.clear();
    expect(p.size()).toBe(0);
  });

  it('PF10-02: execute() after clear() returns input unchanged', async () => {
    const p = new Pipeline();
    p.add(() => 'modified');
    p.clear();
    const r = await p.execute('original');
    if (r.ok) expect(r.value).toBe('original');
  });

  it('PF10-03: list() returns [] after clear()', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.clear();
    expect(p.list()).toEqual([]);
  });

  it('PF10-04: clear() is idempotent — double-clear is safe', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.clear();
    expect(() => p.clear()).not.toThrow();
    expect(p.size()).toBe(0);
  });
});

// ─── PF11: list() + defensive copies ─────────────────────────────────────────

describe('PF11: list() + defensive copies', () => {
  it('PF11-01: list() returns one PipelineStageEntry per registered stage', () => {
    const p = new Pipeline();
    p.add((v) => v);
    p.add((v) => v);
    p.add((v) => v);
    expect(p.list()).toHaveLength(3);
  });

  it('PF11-02: mutating the returned array does not affect the pipeline', () => {
    const p = new Pipeline();
    p.add((v) => v);
    const arr = p.list();
    arr.push({ index: 99 });
    expect(p.size()).toBe(1);
  });

  it('PF11-03: each list() call returns an independent array', () => {
    const p = new Pipeline();
    p.add((v) => v);
    const a = p.list();
    const b = p.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('PF11-04: list() after remove() excludes the removed stage and re-indexes', () => {
    const p = new Pipeline();
    p.add((v) => v); // 0
    p.add((v) => v); // 1 — removed
    p.add((v) => v); // 2 → becomes 1
    p.remove(1);
    const indices = p.list().map((e) => e.index);
    expect(indices).toEqual([0, 1]);
  });
});

// ─── PF12: Never throw / edge cases ──────────────────────────────────────────

describe('PF12: Never throw / edge cases', () => {
  it('PF12-01: execute() never throws when a stage throws', async () => {
    const p = new Pipeline();
    p.add(makeThrowingStage());
    await expect(p.execute('x')).resolves.not.toThrow();
  });

  it('PF12-02: execute() never throws when a stage rejects', async () => {
    const p = new Pipeline();
    p.add(makeRejectingStage());
    await expect(p.execute('x')).resolves.not.toThrow();
  });

  it('PF12-03: add() never throws for any argument', () => {
    const p = new Pipeline();
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], true, Symbol()];
    for (const v of inputs) {
      expect(() => p.add(v as (x: unknown) => unknown)).not.toThrow();
    }
  });

  it('PF12-04: remove() never throws for any argument', () => {
    const p = new Pipeline();
    const inputs: unknown[] = [null, undefined, -1, 0, 1.5, Infinity, NaN, '0'];
    for (const v of inputs) {
      expect(() => p.remove(v as number)).not.toThrow();
    }
  });

  it('PF12-05: size() never throws', () => {
    expect(() => new Pipeline().size()).not.toThrow();
  });

  it('PF12-06: clear() never throws', () => {
    expect(() => new Pipeline().clear()).not.toThrow();
  });
});
