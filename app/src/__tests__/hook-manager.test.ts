/**
 * P6-12H: HookManager — sequential fire-and-forget hook runner tests.
 *
 * 56 tests grouped HM1-HM12.
 *
 * Groups:
 *   HM1  (5) Constructor / initial state
 *   HM2  (5) add() — valid hooks
 *   HM3  (5) add() — invalid hooks (INVALID_HOOK)
 *   HM4  (5) remove()
 *   HM5  (5) execute() — basic behavior
 *   HM6  (5) execute() — runs all hooks even on failure
 *   HM7  (4) Async hooks
 *   HM8  (4) Hook ordering
 *   HM9  (4) size()
 *   HM10 (4) clear()
 *   HM11 (4) list() + defensive copies
 *   HM12 (6) Never throw / edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import {
  HookManager,
  type HookResult,
  type HookError,
  type HookErrorCode,
  type HookFn,
} from '../providers/HookManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function passHook(): HookFn {
  return vi.fn(async () => { /* no-op */ });
}

function throwingHook(msg = 'hook-boom'): HookFn {
  return vi.fn(() => { throw new Error(msg); });
}

function rejectingHook(msg = 'async-boom'): HookFn {
  return vi.fn(async () => { throw new Error(msg); });
}

function extractIndex(r: HookResult<number>): number {
  if (!r.ok) throw new Error(`Expected ok result; got error: ${r.error.code}`);
  return r.value;
}

// ─── HM1: Constructor / initial state ────────────────────────────────────────

describe('HM1: Constructor / initial state', () => {
  it('HM1-01: new HookManager() constructs without throwing', () => {
    expect(() => new HookManager()).not.toThrow();
  });

  it('HM1-02: size() returns 0 initially', () => {
    expect(new HookManager().size()).toBe(0);
  });

  it('HM1-03: list() returns [] initially', () => {
    expect(new HookManager().list()).toEqual([]);
  });

  it('HM1-04: clear() on empty manager is a safe no-op', () => {
    const hm = new HookManager();
    expect(() => hm.clear()).not.toThrow();
    expect(hm.size()).toBe(0);
  });

  it('HM1-05: execute() with no hooks returns { ok: true }', async () => {
    const hm = new HookManager();
    const r = await hm.execute({ any: 'payload' });
    expect(r.ok).toBe(true);
  });
});

// ─── HM2: add() — valid hooks ─────────────────────────────────────────────────

describe('HM2: add() — valid hooks', () => {
  it('HM2-01: add(syncFn) returns { ok: true, value: number }', () => {
    const hm = new HookManager();
    const r = hm.add(() => {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('HM2-02: add(asyncFn) returns { ok: true, value: number }', () => {
    const hm = new HookManager();
    const r = hm.add(async () => {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('HM2-03: first add() returns index 0', () => {
    const hm = new HookManager();
    const r = hm.add(() => {});
    if (r.ok) expect(r.value).toBe(0);
  });

  it('HM2-04: successive add() calls return incrementing indices', () => {
    const hm = new HookManager();
    const i0 = extractIndex(hm.add(() => {}));
    const i1 = extractIndex(hm.add(() => {}));
    const i2 = extractIndex(hm.add(() => {}));
    expect([i0, i1, i2]).toEqual([0, 1, 2]);
  });

  it('HM2-05: add() increases size()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    expect(hm.size()).toBe(2);
  });
});

// ─── HM3: add() — invalid hooks ───────────────────────────────────────────────

describe('HM3: add() — invalid hooks (INVALID_HOOK)', () => {
  it('HM3-01: add(null) returns INVALID_HOOK error', () => {
    const hm = new HookManager();
    const r = hm.add(null as unknown as HookFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_HOOK');
  });

  it('HM3-02: add(undefined) returns INVALID_HOOK error', () => {
    const hm = new HookManager();
    const r = hm.add(undefined as unknown as HookFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_HOOK');
  });

  it('HM3-03: add(42) returns INVALID_HOOK error', () => {
    const hm = new HookManager();
    const r = hm.add(42 as unknown as HookFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_HOOK');
  });

  it('HM3-04: add("string") returns INVALID_HOOK error', () => {
    const hm = new HookManager();
    const r = hm.add('hello' as unknown as HookFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_HOOK');
  });

  it('HM3-05: invalid add() does not change size()', () => {
    const hm = new HookManager();
    hm.add(null as unknown as HookFn);
    hm.add(42   as unknown as HookFn);
    expect(hm.size()).toBe(0);
  });
});

// ─── HM4: remove() ───────────────────────────────────────────────────────────

describe('HM4: remove()', () => {
  it('HM4-01: remove(0) returns { ok: true }', () => {
    const hm = new HookManager();
    hm.add(() => {});
    const r = hm.remove(0);
    expect(r.ok).toBe(true);
  });

  it('HM4-02: remove() decreases size()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    hm.remove(0);
    expect(hm.size()).toBe(1);
  });

  it('HM4-03: remove(out-of-range) returns INDEX_OUT_OF_RANGE', () => {
    const hm = new HookManager();
    hm.add(() => {});
    const r = hm.remove(5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('HM4-04: remove(negative) returns INDEX_OUT_OF_RANGE', () => {
    const hm = new HookManager();
    hm.add(() => {});
    const r = hm.remove(-1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('HM4-05: remove() removes the correct hook by index', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(1); });
    hm.add(() => { log.push(2); }); // index 1 — removed
    hm.add(() => { log.push(3); });
    hm.remove(1);
    await hm.execute({});
    expect(log).toEqual([1, 3]);
  });
});

// ─── HM5: execute() — basic behavior ─────────────────────────────────────────

describe('HM5: execute() — basic behavior', () => {
  it('HM5-01: execute() with no hooks returns { ok: true, value: undefined }', async () => {
    const hm = new HookManager();
    const r = await hm.execute('payload');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeUndefined();
  });

  it('HM5-02: execute() calls each registered hook', async () => {
    const hm = new HookManager();
    const h1 = passHook();
    const h2 = passHook();
    hm.add(h1);
    hm.add(h2);
    await hm.execute({});
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('HM5-03: execute() calls hooks in registration order', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(1); });
    hm.add(() => { log.push(2); });
    hm.add(() => { log.push(3); });
    await hm.execute({});
    expect(log).toEqual([1, 2, 3]);
  });

  it('HM5-04: each hook receives a defensive clone of the payload', async () => {
    const hm = new HookManager();
    const original = { x: 1 };
    let received: unknown;
    hm.add((p) => { received = p; });
    await hm.execute(original);
    expect(received).toEqual(original);
    expect(received).not.toBe(original);
  });

  it('HM5-05: hook mutations do not affect the copies received by other hooks', async () => {
    const hm = new HookManager();
    const snapshots: unknown[] = [];
    hm.add((p) => {
      (p as Record<string, unknown>)['mutated'] = true; // mutate own copy
      snapshots.push(JSON.parse(JSON.stringify(p)));
    });
    hm.add((p) => {
      snapshots.push(JSON.parse(JSON.stringify(p)));    // capture own copy
    });
    await hm.execute({ mutated: false });
    expect((snapshots[0] as Record<string, unknown>)['mutated']).toBe(true);
    expect((snapshots[1] as Record<string, unknown>)['mutated']).toBe(false);
  });
});

// ─── HM6: execute() — runs all hooks even on failure ─────────────────────────

describe('HM6: execute() — runs all hooks even on failure', () => {
  it('HM6-01: execute() returns HOOK_FAILED when a hook throws', async () => {
    const hm = new HookManager();
    hm.add(throwingHook());
    const r = await hm.execute({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HOOK_FAILED');
  });

  it('HM6-02: execute() continues running remaining hooks after one throws', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(1); });
    hm.add(() => { log.push(2); throw new Error('fail'); });
    hm.add(() => { log.push(3); });
    await hm.execute({});
    expect(log).toEqual([1, 2, 3]);
  });

  it('HM6-03: execute() returns HOOK_FAILED when async hook rejects', async () => {
    const hm = new HookManager();
    hm.add(rejectingHook('async-fail'));
    const r = await hm.execute({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HOOK_FAILED');
  });

  it('HM6-04: execute() returns HOOK_FAILED even when only one of many hooks fails', async () => {
    const hm = new HookManager();
    hm.add(passHook());
    hm.add(throwingHook());
    hm.add(passHook());
    const r = await hm.execute({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HOOK_FAILED');
  });

  it('HM6-05: error message contains the text from the failing hook', async () => {
    const hm = new HookManager();
    hm.add(throwingHook('specific-error-text'));
    const r = await hm.execute({});
    if (!r.ok) expect(r.error.message).toContain('specific-error-text');
  });
});

// ─── HM7: Async hooks ────────────────────────────────────────────────────────

describe('HM7: Async hooks', () => {
  it('HM7-01: async hook is fully awaited before the next hook starts', async () => {
    const hm = new HookManager();
    const log: string[] = [];
    hm.add(async () => {
      await new Promise<void>((r) => { setTimeout(r, 0); });
      log.push('first-done');
    });
    hm.add(() => { log.push('second-start'); });
    await hm.execute({});
    expect(log).toEqual(['first-done', 'second-start']);
  });

  it('HM7-02: all-async hook chain runs in registration order', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(async () => { log.push(1); });
    hm.add(async () => { log.push(2); });
    hm.add(async () => { log.push(3); });
    await hm.execute({});
    expect(log).toEqual([1, 2, 3]);
  });

  it('HM7-03: mix of sync and async hooks runs in registration order', async () => {
    const hm = new HookManager();
    const log: string[] = [];
    hm.add(()       => { log.push('sync');  });
    hm.add(async () => { log.push('async'); });
    hm.add(()       => { log.push('sync2'); });
    await hm.execute({});
    expect(log).toEqual(['sync', 'async', 'sync2']);
  });

  it('HM7-04: async hook rejection still allows remaining hooks to run', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(async () => { log.push(1); });
    hm.add(rejectingHook('async-fail'));
    hm.add(async () => { log.push(3); });
    await hm.execute({});
    expect(log).toEqual([1, 3]);
  });
});

// ─── HM8: Hook ordering ───────────────────────────────────────────────────────

describe('HM8: Hook ordering', () => {
  it('HM8-01: hooks fire in registration (FIFO) order', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(1); });
    hm.add(() => { log.push(2); });
    hm.add(() => { log.push(3); });
    await hm.execute({});
    expect(log).toEqual([1, 2, 3]);
  });

  it('HM8-02: remove(0) promotes the former hook[1] to position 0', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(0); }); // index 0 — removed
    hm.add(() => { log.push(1); }); // index 1 → becomes 0
    hm.remove(0);
    await hm.execute({});
    expect(log).toEqual([1]);
  });

  it('HM8-03: remove() in the middle preserves surrounding order', async () => {
    const hm = new HookManager();
    const log: number[] = [];
    hm.add(() => { log.push(1); });
    hm.add(() => { log.push(2); }); // index 1 — removed
    hm.add(() => { log.push(3); });
    hm.remove(1);
    await hm.execute({});
    expect(log).toEqual([1, 3]);
  });

  it('HM8-04: list() reflects current hook indices after removals', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    hm.add(() => {});
    hm.remove(1); // former [2] shifts to [1]
    const indices = hm.list().map((e) => e.index);
    expect(indices).toEqual([0, 1]);
  });
});

// ─── HM9: size() ─────────────────────────────────────────────────────────────

describe('HM9: size()', () => {
  it('HM9-01: size() returns 0 on a new instance', () => {
    expect(new HookManager().size()).toBe(0);
  });

  it('HM9-02: size() increments after add()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    expect(hm.size()).toBe(2);
  });

  it('HM9-03: size() decrements after remove()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    hm.remove(0);
    expect(hm.size()).toBe(1);
  });

  it('HM9-04: size() is 0 after clear()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.clear();
    expect(hm.size()).toBe(0);
  });
});

// ─── HM10: clear() ───────────────────────────────────────────────────────────

describe('HM10: clear()', () => {
  it('HM10-01: clear() empties the hook manager', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    hm.clear();
    expect(hm.size()).toBe(0);
  });

  it('HM10-02: execute() after clear() returns { ok: true } immediately', async () => {
    const hm = new HookManager();
    const hook = throwingHook();
    hm.add(hook);
    hm.clear();
    const r = await hm.execute({});
    expect(r.ok).toBe(true);
    expect(hook).not.toHaveBeenCalled();
  });

  it('HM10-03: list() returns [] after clear()', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.clear();
    expect(hm.list()).toEqual([]);
  });

  it('HM10-04: clear() is idempotent — double-clear is safe', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.clear();
    expect(() => hm.clear()).not.toThrow();
    expect(hm.size()).toBe(0);
  });
});

// ─── HM11: list() + defensive copies ─────────────────────────────────────────

describe('HM11: list() + defensive copies', () => {
  it('HM11-01: list() returns one HookEntry per registered hook', () => {
    const hm = new HookManager();
    hm.add(() => {});
    hm.add(() => {});
    hm.add(() => {});
    expect(hm.list()).toHaveLength(3);
  });

  it('HM11-02: mutating the returned array does not affect hook manager', () => {
    const hm = new HookManager();
    hm.add(() => {});
    const arr = hm.list();
    arr.push({ index: 99 });
    expect(hm.size()).toBe(1);
  });

  it('HM11-03: each list() call returns an independent array', () => {
    const hm = new HookManager();
    hm.add(() => {});
    const a = hm.list();
    const b = hm.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('HM11-04: list() after remove() reflects updated indices', () => {
    const hm = new HookManager();
    hm.add(() => {}); // 0
    hm.add(() => {}); // 1 — removed
    hm.add(() => {}); // 2 → becomes 1
    hm.remove(1);
    const indices = hm.list().map((e) => e.index);
    expect(indices).toEqual([0, 1]);
  });
});

// ─── HM12: Never throw / edge cases ──────────────────────────────────────────

describe('HM12: Never throw / edge cases', () => {
  it('HM12-01: execute() never throws when a hook throws', async () => {
    const hm = new HookManager();
    hm.add(throwingHook());
    await expect(hm.execute({})).resolves.not.toThrow();
  });

  it('HM12-02: execute() never throws when a hook rejects', async () => {
    const hm = new HookManager();
    hm.add(rejectingHook());
    await expect(hm.execute({})).resolves.not.toThrow();
  });

  it('HM12-03: add() never throws for any argument', () => {
    const hm = new HookManager();
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], true, Symbol()];
    for (const v of inputs) {
      expect(() => hm.add(v as HookFn)).not.toThrow();
    }
  });

  it('HM12-04: remove() never throws for any argument', () => {
    const hm = new HookManager();
    const inputs: unknown[] = [null, undefined, -1, 0, 1.5, Infinity, NaN, '0'];
    for (const v of inputs) {
      expect(() => hm.remove(v as number)).not.toThrow();
    }
  });

  it('HM12-05: size() never throws', () => {
    expect(() => new HookManager().size()).not.toThrow();
  });

  it('HM12-06: clear() never throws', () => {
    expect(() => new HookManager().clear()).not.toThrow();
  });
});
