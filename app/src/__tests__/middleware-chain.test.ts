/**
 * P6-12G: MiddlewareChain — classic (context, next) middleware runner tests.
 *
 * 56 tests grouped MC1-MC12.
 *
 * Groups:
 *   MC1  (5) Constructor / initial state
 *   MC2  (5) add() — valid middleware
 *   MC3  (5) add() — invalid middleware (INVALID_MIDDLEWARE)
 *   MC4  (5) remove()
 *   MC5  (5) execute() — basic behavior
 *   MC6  (5) execute() — next() behavior
 *   MC7  (4) execute() — middleware failures
 *   MC8  (4) Async middleware
 *   MC9  (4) size()
 *   MC10 (4) clear()
 *   MC11 (4) list() + defensive copies
 *   MC12 (6) Never throw / edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MiddlewareChain,
  type MiddlewareResult,
  type MiddlewareError,
  type MiddlewareErrorCode,
  type MiddlewareFn,
  type MiddlewareContext,
} from '../providers/MiddlewareChain';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Middleware that calls next() immediately and does nothing else. */
function passThrough(): MiddlewareFn {
  return vi.fn(async (_ctx, next) => { await next(); });
}

/** Middleware that does NOT call next() — short-circuits the chain. */
function shortCircuit(): MiddlewareFn {
  return vi.fn((_ctx, _next) => { /* intentionally no next() */ });
}

/** Sync middleware that throws. */
function throwingMiddleware(msg = 'mw-boom'): MiddlewareFn {
  return vi.fn(() => { throw new Error(msg); });
}

/** Async middleware that rejects. */
function rejectingMiddleware(msg = 'async-boom'): MiddlewareFn {
  return vi.fn(async () => { throw new Error(msg); });
}

function extractIndex(r: MiddlewareResult<number>): number {
  if (!r.ok) throw new Error(`Expected ok result; got error: ${r.error.code}`);
  return r.value;
}

// ─── MC1: Constructor / initial state ────────────────────────────────────────

describe('MC1: Constructor / initial state', () => {
  it('MC1-01: new MiddlewareChain() constructs without throwing', () => {
    expect(() => new MiddlewareChain()).not.toThrow();
  });

  it('MC1-02: size() returns 0 initially', () => {
    expect(new MiddlewareChain().size()).toBe(0);
  });

  it('MC1-03: list() returns [] initially', () => {
    expect(new MiddlewareChain().list()).toEqual([]);
  });

  it('MC1-04: clear() on empty chain is a safe no-op', () => {
    const mw = new MiddlewareChain();
    expect(() => mw.clear()).not.toThrow();
    expect(mw.size()).toBe(0);
  });

  it('MC1-05: execute() with no middleware returns context unchanged', async () => {
    const mw = new MiddlewareChain();
    const r = await mw.execute({ x: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ x: 1 });
  });
});

// ─── MC2: add() — valid middleware ───────────────────────────────────────────

describe('MC2: add() — valid middleware', () => {
  it('MC2-01: add(syncFn) returns { ok: true, value: number }', () => {
    const mw = new MiddlewareChain();
    const r = mw.add((_ctx, next) => next());
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('MC2-02: add(asyncFn) returns { ok: true, value: number }', () => {
    const mw = new MiddlewareChain();
    const r = mw.add(async (_ctx, next) => { await next(); });
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('MC2-03: first add() returns index 0', () => {
    const mw = new MiddlewareChain();
    const r = mw.add((_ctx, next) => next());
    if (r.ok) expect(r.value).toBe(0);
  });

  it('MC2-04: successive add() calls return incrementing indices', () => {
    const mw = new MiddlewareChain();
    const i0 = extractIndex(mw.add((_ctx, next) => next()));
    const i1 = extractIndex(mw.add((_ctx, next) => next()));
    const i2 = extractIndex(mw.add((_ctx, next) => next()));
    expect([i0, i1, i2]).toEqual([0, 1, 2]);
  });

  it('MC2-05: add() increases size()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    expect(mw.size()).toBe(2);
  });
});

// ─── MC3: add() — invalid middleware ─────────────────────────────────────────

describe('MC3: add() — invalid middleware (INVALID_MIDDLEWARE)', () => {
  it('MC3-01: add(null) returns INVALID_MIDDLEWARE error', () => {
    const mw = new MiddlewareChain();
    const r = mw.add(null as unknown as MiddlewareFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_MIDDLEWARE');
  });

  it('MC3-02: add(undefined) returns INVALID_MIDDLEWARE error', () => {
    const mw = new MiddlewareChain();
    const r = mw.add(undefined as unknown as MiddlewareFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_MIDDLEWARE');
  });

  it('MC3-03: add(42) returns INVALID_MIDDLEWARE error', () => {
    const mw = new MiddlewareChain();
    const r = mw.add(42 as unknown as MiddlewareFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_MIDDLEWARE');
  });

  it('MC3-04: add("string") returns INVALID_MIDDLEWARE error', () => {
    const mw = new MiddlewareChain();
    const r = mw.add('hello' as unknown as MiddlewareFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_MIDDLEWARE');
  });

  it('MC3-05: invalid add() does not change size()', () => {
    const mw = new MiddlewareChain();
    mw.add(null as unknown as MiddlewareFn);
    mw.add(42   as unknown as MiddlewareFn);
    expect(mw.size()).toBe(0);
  });
});

// ─── MC4: remove() ───────────────────────────────────────────────────────────

describe('MC4: remove()', () => {
  it('MC4-01: remove(0) returns { ok: true }', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    const r = mw.remove(0);
    expect(r.ok).toBe(true);
  });

  it('MC4-02: remove() decreases size()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    mw.remove(0);
    expect(mw.size()).toBe(1);
  });

  it('MC4-03: remove(out-of-range) returns INDEX_OUT_OF_RANGE', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    const r = mw.remove(5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('MC4-04: remove(negative) returns INDEX_OUT_OF_RANGE', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    const r = mw.remove(-1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INDEX_OUT_OF_RANGE');
  });

  it('MC4-05: remove() removes the correct middleware by index', async () => {
    const mw = new MiddlewareChain();
    const log: number[] = [];
    mw.add(async (_ctx, next) => { log.push(1); await next(); });
    mw.add(async (_ctx, next) => { log.push(2); await next(); }); // index 1 — removed
    mw.add(async (_ctx, next) => { log.push(3); await next(); });
    mw.remove(1);
    await mw.execute({});
    expect(log).toEqual([1, 3]);
  });
});

// ─── MC5: execute() — basic behavior ─────────────────────────────────────────

describe('MC5: execute() — basic behavior', () => {
  it('MC5-01: execute() with no middleware returns { ok: true, value: context }', async () => {
    const mw = new MiddlewareChain();
    const r = await mw.execute({ a: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1 });
  });

  it('MC5-02: execute() returns a clone of context — original is not mutated', async () => {
    const mw = new MiddlewareChain();
    const original = { a: 1 };
    const r = await mw.execute(original);
    if (r.ok) {
      expect(r.value).toEqual(original);
      expect(r.value).not.toBe(original);
    }
  });

  it('MC5-03: execute() passes context to the middleware', async () => {
    const mw = new MiddlewareChain();
    let received: MiddlewareContext | undefined;
    mw.add(async (ctx, next) => { received = ctx; await next(); });
    await mw.execute({ key: 'value' });
    expect(received).toEqual({ key: 'value' });
  });

  it('MC5-04: execute() returns the modified context after middleware runs', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => { ctx['added'] = true; await next(); });
    const r = await mw.execute({});
    if (r.ok) expect(r.value['added']).toBe(true);
  });

  it('MC5-05: returned value is a clone of final context — not the internal reference', async () => {
    const mw = new MiddlewareChain();
    let captured: MiddlewareContext | undefined;
    mw.add(async (ctx, next) => { captured = ctx; await next(); });
    const r = await mw.execute({ x: 1 });
    // The returned value must not be the same object that middleware received
    if (r.ok) expect(r.value).not.toBe(captured);
  });
});

// ─── MC6: execute() — next() behavior ────────────────────────────────────────

describe('MC6: execute() — next() behavior', () => {
  it('MC6-01: middleware that calls next() continues to the next middleware', async () => {
    const mw = new MiddlewareChain();
    const second = vi.fn(async (_ctx: MiddlewareContext, next: () => Promise<void>) => { await next(); });
    mw.add(async (_ctx, next) => { await next(); });
    mw.add(second);
    await mw.execute({});
    expect(second).toHaveBeenCalledOnce();
  });

  it('MC6-02: middleware that skips next() short-circuits the chain', async () => {
    const mw = new MiddlewareChain();
    const second = vi.fn(async (_ctx: MiddlewareContext, next: () => Promise<void>) => { await next(); });
    mw.add(shortCircuit());     // does NOT call next()
    mw.add(second);
    await mw.execute({});
    expect(second).not.toHaveBeenCalled();
  });

  it('MC6-03: middleware can modify context before calling next()', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => { ctx['before'] = true; await next(); });
    const r = await mw.execute({});
    if (r.ok) expect(r.value['before']).toBe(true);
  });

  it('MC6-04: middleware can modify context after awaiting next()', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => { await next(); ctx['after'] = true; });
    mw.add(async (ctx, next) => { ctx['inner'] = 'ran'; await next(); });
    const r = await mw.execute({});
    if (r.ok) {
      expect(r.value['inner']).toBe('ran');
      expect(r.value['after']).toBe(true);
    }
  });

  it('MC6-05: all middleware run in registration order when each calls next()', async () => {
    const mw = new MiddlewareChain();
    const log: number[] = [];
    mw.add(async (_ctx, next) => { log.push(1); await next(); });
    mw.add(async (_ctx, next) => { log.push(2); await next(); });
    mw.add(async (_ctx, next) => { log.push(3); await next(); });
    await mw.execute({});
    expect(log).toEqual([1, 2, 3]);
  });
});

// ─── MC7: execute() — middleware failures ────────────────────────────────────

describe('MC7: execute() — middleware failures', () => {
  it('MC7-01: execute() returns MIDDLEWARE_FAILED when middleware throws', async () => {
    const mw = new MiddlewareChain();
    mw.add(throwingMiddleware());
    const r = await mw.execute({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MIDDLEWARE_FAILED');
  });

  it('MC7-02: subsequent middleware do not run after one throws', async () => {
    const mw = new MiddlewareChain();
    const after = vi.fn(async (_ctx: MiddlewareContext, next: () => Promise<void>) => { await next(); });
    mw.add(throwingMiddleware());
    mw.add(after);
    await mw.execute({});
    expect(after).not.toHaveBeenCalled();
  });

  it('MC7-03: execute() returns MIDDLEWARE_FAILED when async middleware rejects', async () => {
    const mw = new MiddlewareChain();
    mw.add(rejectingMiddleware('async-fail'));
    const r = await mw.execute({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MIDDLEWARE_FAILED');
  });

  it('MC7-04: error message contains the text from the throwing middleware', async () => {
    const mw = new MiddlewareChain();
    mw.add(throwingMiddleware('specific-error-text'));
    const r = await mw.execute({});
    if (!r.ok) expect(r.error.message).toContain('specific-error-text');
  });
});

// ─── MC8: Async middleware ────────────────────────────────────────────────────

describe('MC8: Async middleware', () => {
  it('MC8-01: async middleware is fully awaited before next middleware starts', async () => {
    const mw = new MiddlewareChain();
    const log: string[] = [];
    mw.add(async (_ctx, next) => {
      await new Promise<void>(r => { setTimeout(r, 0); });
      log.push('first-done');
      await next();
    });
    mw.add(async (_ctx, next) => {
      log.push('second-start');
      await next();
    });
    await mw.execute({});
    expect(log).toEqual(['first-done', 'second-start']);
  });

  it('MC8-02: async middleware can set context properties before and after next()', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => {
      ctx['pre'] = 'set';
      await next();
      ctx['post'] = 'set';
    });
    mw.add(async (ctx, next) => { ctx['mid'] = 'set'; await next(); });
    const r = await mw.execute({});
    if (r.ok) {
      expect(r.value['pre']).toBe('set');
      expect(r.value['mid']).toBe('set');
      expect(r.value['post']).toBe('set');
    }
  });

  it('MC8-03: all-async middleware chain returns the correct final context', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => { ctx['a'] = 1; await next(); });
    mw.add(async (ctx, next) => { ctx['b'] = 2; await next(); });
    mw.add(async (ctx, next) => { ctx['c'] = 3; await next(); });
    const r = await mw.execute({});
    if (r.ok) expect(r.value).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('MC8-04: mix of sync and async middleware executes in registration order', async () => {
    const mw = new MiddlewareChain();
    const log: string[] = [];
    mw.add((_ctx, next)       => { log.push('sync');  return next(); });
    mw.add(async (_ctx, next) => { log.push('async'); await next(); });
    mw.add((_ctx, next)       => { log.push('sync2'); return next(); });
    await mw.execute({});
    expect(log).toEqual(['sync', 'async', 'sync2']);
  });
});

// ─── MC9: size() ─────────────────────────────────────────────────────────────

describe('MC9: size()', () => {
  it('MC9-01: size() returns 0 on a new instance', () => {
    expect(new MiddlewareChain().size()).toBe(0);
  });

  it('MC9-02: size() increments after add()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    expect(mw.size()).toBe(2);
  });

  it('MC9-03: size() decrements after remove()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    mw.remove(0);
    expect(mw.size()).toBe(1);
  });

  it('MC9-04: size() is 0 after clear()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.clear();
    expect(mw.size()).toBe(0);
  });
});

// ─── MC10: clear() ───────────────────────────────────────────────────────────

describe('MC10: clear()', () => {
  it('MC10-01: clear() empties the chain', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    mw.clear();
    expect(mw.size()).toBe(0);
  });

  it('MC10-02: execute() after clear() returns context unchanged', async () => {
    const mw = new MiddlewareChain();
    mw.add(async (ctx, next) => { ctx['x'] = 99; await next(); });
    mw.clear();
    const r = await mw.execute({ x: 1 });
    if (r.ok) expect(r.value['x']).toBe(1);
  });

  it('MC10-03: list() returns [] after clear()', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.clear();
    expect(mw.list()).toEqual([]);
  });

  it('MC10-04: clear() is idempotent — double-clear is safe', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.clear();
    expect(() => mw.clear()).not.toThrow();
    expect(mw.size()).toBe(0);
  });
});

// ─── MC11: list() + defensive copies ─────────────────────────────────────────

describe('MC11: list() + defensive copies', () => {
  it('MC11-01: list() returns one MiddlewareEntry per registered middleware', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    mw.add((_ctx, next) => next());
    expect(mw.list()).toHaveLength(3);
  });

  it('MC11-02: mutating the returned array does not affect chain size', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    const arr = mw.list();
    arr.push({ index: 99 });
    expect(mw.size()).toBe(1);
  });

  it('MC11-03: each list() call returns an independent array', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next());
    const a = mw.list();
    const b = mw.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('MC11-04: list() after remove() reflects updated indices', () => {
    const mw = new MiddlewareChain();
    mw.add((_ctx, next) => next()); // 0
    mw.add((_ctx, next) => next()); // 1 — removed
    mw.add((_ctx, next) => next()); // 2 → becomes 1
    mw.remove(1);
    const indices = mw.list().map((e) => e.index);
    expect(indices).toEqual([0, 1]);
  });
});

// ─── MC12: Never throw / edge cases ──────────────────────────────────────────

describe('MC12: Never throw / edge cases', () => {
  it('MC12-01: execute() never throws when middleware throws', async () => {
    const mw = new MiddlewareChain();
    mw.add(throwingMiddleware());
    await expect(mw.execute({})).resolves.not.toThrow();
  });

  it('MC12-02: execute() never throws when middleware rejects', async () => {
    const mw = new MiddlewareChain();
    mw.add(rejectingMiddleware());
    await expect(mw.execute({})).resolves.not.toThrow();
  });

  it('MC12-03: add() never throws for any argument', () => {
    const mw = new MiddlewareChain();
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], true, Symbol()];
    for (const v of inputs) {
      expect(() => mw.add(v as MiddlewareFn)).not.toThrow();
    }
  });

  it('MC12-04: remove() never throws for any argument', () => {
    const mw = new MiddlewareChain();
    const inputs: unknown[] = [null, undefined, -1, 0, 1.5, Infinity, NaN, '0'];
    for (const v of inputs) {
      expect(() => mw.remove(v as number)).not.toThrow();
    }
  });

  it('MC12-05: size() never throws', () => {
    expect(() => new MiddlewareChain().size()).not.toThrow();
  });

  it('MC12-06: clear() never throws', () => {
    expect(() => new MiddlewareChain().clear()).not.toThrow();
  });
});
