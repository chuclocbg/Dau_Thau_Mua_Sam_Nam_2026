import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RateLimiter,
  type RateLimiterOptions,
  type RateLimiterResult,
} from '../providers/RateLimiter';

// ─── RL1: Constructor / initial state ────────────────────────────────────────

describe('RL1: Constructor / initial state', () => {
  it('RL1-01: default constructor (no options) creates 60-rpm capacity', () => {
    const rl = new RateLimiter();
    expect(rl.remaining()).toBe(60);
  });

  it('RL1-02: { rps: 3 } creates a 3-rps window', () => {
    const rl = new RateLimiter({ rps: 3 });
    expect(rl.remaining()).toBe(3);
  });

  it('RL1-03: { rpm: 10 } creates a 10-rpm window', () => {
    const rl = new RateLimiter({ rpm: 10 });
    expect(rl.remaining()).toBe(10);
  });

  it('RL1-04: { rps: 5, rpm: 30 } — remaining() returns min of both windows', () => {
    const rl = new RateLimiter({ rps: 5, rpm: 30 });
    expect(rl.remaining()).toBe(5); // min(5, 30)
  });

  it('RL1-05: invalid rps and rpm both fall back to default 60-rpm', () => {
    const rl = new RateLimiter({ rps: -1, rpm: 0 } as RateLimiterOptions);
    expect(rl.remaining()).toBe(60);
  });
});

// ─── RL2: Execute success — synchronous function ──────────────────────────────

describe('RL2: Execute success — sync function', () => {
  it('RL2-01: sync fn returning a string → { ok: true, value: string }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(() => 'hello');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('hello');
  });

  it('RL2-02: sync fn returning a number → { ok: true, value: number }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(() => 42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('RL2-03: sync fn returning null → { ok: true, value: null }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(() => null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it('RL2-04: sync fn returning an object → value is a shallow clone', async () => {
    const rl = new RateLimiter();
    const obj = { x: 1, y: 2 };
    const r = await rl.execute(() => obj);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(obj);
      expect(r.value).not.toBe(obj);
    }
  });

  it('RL2-05: sync fn returning an array → value is a shallow clone', async () => {
    const rl = new RateLimiter();
    const arr = [1, 2, 3];
    const r = await rl.execute(() => arr);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(arr);
      expect(r.value).not.toBe(arr);
    }
  });
});

// ─── RL3: Execute success — async function ────────────────────────────────────

describe('RL3: Execute success — async function', () => {
  it('RL3-01: async fn returning a string → { ok: true, value: string }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(async () => 'async');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('async');
  });

  it('RL3-02: async fn returning a number → { ok: true, value: number }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(async () => 99);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(99);
  });

  it('RL3-03: async fn returning null → { ok: true, value: null }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(async () => null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it('RL3-04: async fn returning an object → value is a shallow clone', async () => {
    const rl = new RateLimiter();
    const obj = { a: 'b' };
    const r = await rl.execute(async () => obj);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(obj);
      expect(r.value).not.toBe(obj);
    }
  });

  it('RL3-05: async fn returning an array → value is a shallow clone', async () => {
    const rl = new RateLimiter();
    const arr = ['x', 'y'];
    const r = await rl.execute(async () => arr);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(arr);
      expect(r.value).not.toBe(arr);
    }
  });
});

// ─── RL4: RATE_LIMIT_EXCEEDED ────────────────────────────────────────────────

describe('RL4: RATE_LIMIT_EXCEEDED', () => {
  it('RL4-01: 3rd call with rps:2 returns ok: false', async () => {
    const rl = new RateLimiter({ rps: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    const r = await rl.execute(() => 3);
    expect(r.ok).toBe(false);
  });

  it('RL4-02: error.code is RATE_LIMIT_EXCEEDED', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('RL4-03: error.message mentions the limit', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0);
  });

  it('RL4-04: error.retryAfter is a non-negative number', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(typeof r.error.retryAfter).toBe('number');
      expect(r.error.retryAfter!).toBeGreaterThanOrEqual(0);
    }
  });

  it('RL4-05: repeated calls while limited all return RATE_LIMIT_EXCEEDED', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    const r1 = await rl.execute(() => 2);
    const r2 = await rl.execute(() => 3);
    const r3 = await rl.execute(() => 4);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe('RATE_LIMIT_EXCEEDED');
    if (!r2.ok) expect(r2.error.code).toBe('RATE_LIMIT_EXCEEDED');
    if (!r3.ok) expect(r3.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

// ─── RL5: INVALID_FUNCTION ───────────────────────────────────────────────────

describe('RL5: INVALID_FUNCTION', () => {
  it('RL5-01: execute(null) → { ok: false, error.code: INVALID_FUNCTION }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(null as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_FUNCTION');
  });

  it('RL5-02: execute(undefined) → { ok: false, error.code: INVALID_FUNCTION }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(undefined as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_FUNCTION');
  });

  it('RL5-03: execute(42) → { ok: false, error.code: INVALID_FUNCTION }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(42 as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_FUNCTION');
  });

  it('RL5-04: execute("string") → { ok: false, error.code: INVALID_FUNCTION }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute('string' as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_FUNCTION');
  });

  it('RL5-05: execute({}) → { ok: false, error.code: INVALID_FUNCTION }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute({} as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_FUNCTION');
  });
});

// ─── RL6: RATE_LIMITER_ERROR (fn throws) ─────────────────────────────────────

describe('RL6: RATE_LIMITER_ERROR — fn throws', () => {
  it('RL6-01: sync fn that throws Error → { ok: false, code: RATE_LIMITER_ERROR }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(() => { throw new Error('boom'); });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITER_ERROR');
  });

  it('RL6-02: sync fn that throws a string → { ok: false, code: RATE_LIMITER_ERROR }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(() => { throw 'kaboom'; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITER_ERROR');
  });

  it('RL6-03: async fn that rejects → { ok: false, code: RATE_LIMITER_ERROR }', async () => {
    const rl = new RateLimiter();
    const r = await rl.execute(async () => Promise.reject(new Error('async boom')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITER_ERROR');
  });

  it('RL6-04: a throwing fn still consumes a rate-limit slot', async () => {
    const rl = new RateLimiter({ rps: 2 });
    expect(rl.remaining()).toBe(2);
    await rl.execute(() => { throw new Error('oops'); });
    expect(rl.remaining()).toBe(1); // slot consumed even though fn threw
  });
});

// ─── RL7: Sliding window / fake timers ───────────────────────────────────────

describe('RL7: Sliding window / fake timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('RL7-01: rps:2 — 2 calls succeed, 3rd is RATE_LIMIT_EXCEEDED', async () => {
    const rl = new RateLimiter({ rps: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    const r = await rl.execute(() => 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('RL7-02: after advancing 1001ms, the rps slot reopens', async () => {
    const rl = new RateLimiter({ rps: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    const blocked = await rl.execute(() => 3);
    expect(blocked.ok).toBe(false);
    await vi.advanceTimersByTimeAsync(1001);
    const r = await rl.execute(() => 4);
    expect(r.ok).toBe(true);
  });

  it('RL7-03: retryAfter is a non-negative number no greater than windowMs', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.retryAfter).toBeGreaterThanOrEqual(0);
      expect(r.error.retryAfter!).toBeLessThanOrEqual(1000);
    }
  });

  it('RL7-04: rpm:2 — 2 calls succeed, 3rd is RATE_LIMIT_EXCEEDED', async () => {
    const rl = new RateLimiter({ rpm: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    const r = await rl.execute(() => 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('RL7-05: after advancing 60001ms, the rpm slot reopens', async () => {
    const rl = new RateLimiter({ rpm: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    const blocked = await rl.execute(() => 3);
    expect(blocked.ok).toBe(false);
    await vi.advanceTimersByTimeAsync(60001);
    const r = await rl.execute(() => 4);
    expect(r.ok).toBe(true);
  });

  it('RL7-06: execute() prunes stale timestamps, restoring capacity', async () => {
    const rl = new RateLimiter({ rps: 3 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    await rl.execute(() => 3);
    expect(rl.remaining()).toBe(0);
    await vi.advanceTimersByTimeAsync(1001);
    const r = await rl.execute(() => 4);
    expect(r.ok).toBe(true);
    // Only the T+1001 timestamp is in the window now; 2 slots remain.
    expect(rl.remaining()).toBe(2);
  });
});

// ─── RL8: remaining() ────────────────────────────────────────────────────────

describe('RL8: remaining()', () => {
  it('RL8-01: starts at the full configured limit', () => {
    const rl = new RateLimiter({ rps: 5 });
    expect(rl.remaining()).toBe(5);
  });

  it('RL8-02: decreases by 1 after each successful execute()', async () => {
    const rl = new RateLimiter({ rps: 5 });
    await rl.execute(() => 1);
    expect(rl.remaining()).toBe(4);
    await rl.execute(() => 2);
    expect(rl.remaining()).toBe(3);
  });

  it('RL8-03: returns 0 when the window is exhausted', async () => {
    const rl = new RateLimiter({ rps: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    expect(rl.remaining()).toBe(0);
  });

  it('RL8-04: calling remaining() twice returns the same value (read-only)', async () => {
    const rl = new RateLimiter({ rps: 5 });
    await rl.execute(() => 1);
    const a = rl.remaining();
    const b = rl.remaining();
    expect(a).toBe(b);
  });
});

// ─── RL9: reset() ────────────────────────────────────────────────────────────

describe('RL9: reset()', () => {
  it('RL9-01: reset() on a fresh limiter is a safe no-op', () => {
    const rl = new RateLimiter({ rps: 5 });
    expect(() => rl.reset()).not.toThrow();
    expect(rl.remaining()).toBe(5);
  });

  it('RL9-02: reset() after reaching the limit restores full capacity', async () => {
    const rl = new RateLimiter({ rps: 2 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    expect(rl.remaining()).toBe(0);
    rl.reset();
    expect(rl.remaining()).toBe(2);
  });

  it('RL9-03: execute() succeeds after reset() when limit was previously hit', async () => {
    const rl = new RateLimiter({ rps: 1 });
    await rl.execute(() => 1);
    rl.reset();
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(true);
  });

  it('RL9-04: reset() does not change the configured limits', async () => {
    const rl = new RateLimiter({ rps: 3 });
    rl.reset();
    expect(rl.remaining()).toBe(3);
    await rl.execute(() => 1);
    expect(rl.remaining()).toBe(2);
  });
});

// ─── RL10: Dual windows (rps + rpm) ──────────────────────────────────────────

describe('RL10: Dual windows (rps + rpm)', () => {
  it('RL10-01: remaining() returns the minimum across both windows', () => {
    const rl = new RateLimiter({ rps: 5, rpm: 3 });
    expect(rl.remaining()).toBe(3); // min(5, 3)
  });

  it('RL10-02: rps exhaustion blocks even when rpm has capacity', async () => {
    const rl = new RateLimiter({ rps: 1, rpm: 100 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('RL10-03: rpm exhaustion blocks even when rps has capacity', async () => {
    const rl = new RateLimiter({ rps: 100, rpm: 1 });
    await rl.execute(() => 1);
    const r = await rl.execute(() => 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('RL10-04: reset() clears both windows simultaneously', async () => {
    const rl = new RateLimiter({ rps: 2, rpm: 5 });
    await rl.execute(() => 1);
    await rl.execute(() => 2);
    expect(rl.remaining()).toBe(0); // rps window exhausted
    rl.reset();
    expect(rl.remaining()).toBe(2); // min(rps=2, rpm=5) restored
  });
});

// ─── RL11: Defensive copies ───────────────────────────────────────────────────

describe('RL11: Defensive copies', () => {
  it('RL11-01: returned object is a shallow clone, not the original reference', async () => {
    const rl = new RateLimiter();
    const obj = { x: 1 };
    const r = await rl.execute(() => obj);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toBe(obj);
  });

  it('RL11-02: mutating the returned object does not affect the original', async () => {
    const rl = new RateLimiter();
    const obj = { x: 1 };
    const r = await rl.execute(() => obj);
    if (r.ok) (r.value as { x: number }).x = 999;
    expect(obj.x).toBe(1);
  });

  it('RL11-03: returned array is a shallow clone, not the original reference', async () => {
    const rl = new RateLimiter();
    const arr = [1, 2, 3];
    const r = await rl.execute(() => arr);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toBe(arr);
  });

  it('RL11-04: mutating the returned array does not affect the original', async () => {
    const rl = new RateLimiter();
    const arr = [1, 2, 3];
    const r = await rl.execute(() => arr);
    if (r.ok) (r.value as number[]).push(99);
    expect(arr).toHaveLength(3);
  });
});

// ─── RL12: Never throw / edge cases ──────────────────────────────────────────

describe('RL12: Never throw / edge cases', () => {
  it('RL12-01: execute(null) returns ok: false without throwing', async () => {
    const rl = new RateLimiter();
    await expect(
      rl.execute(null as unknown as () => unknown),
    ).resolves.toMatchObject({ ok: false });
  });

  it('RL12-02: execute(undefined) returns ok: false without throwing', async () => {
    const rl = new RateLimiter();
    await expect(
      rl.execute(undefined as unknown as () => unknown),
    ).resolves.toMatchObject({ ok: false });
  });

  it('RL12-03: constructor with all-invalid option values does not throw', () => {
    expect(() => new RateLimiter({ rps: NaN, rpm: -Infinity } as RateLimiterOptions)).not.toThrow();
    expect(() => new RateLimiter({ rps: 0, rpm: 0 } as RateLimiterOptions)).not.toThrow();
    expect(() => new RateLimiter({} as RateLimiterOptions)).not.toThrow();
  });

  it('RL12-04: remaining() never throws', () => {
    const rl = new RateLimiter();
    expect(() => rl.remaining()).not.toThrow();
  });

  it('RL12-05: reset() never throws', () => {
    const rl = new RateLimiter();
    expect(() => rl.reset()).not.toThrow();
  });
});
