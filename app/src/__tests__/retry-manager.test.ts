/**
 * P6-11I: RetryManager — test suite (56 tests, RM1–RM12).
 *
 * Plain TypeScript — no JSX.
 * Delay groups (RM5, RM6) use vi.useFakeTimers() / vi.advanceTimersByTimeAsync()
 * so that tests run without real pauses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetryManager } from '../providers/RetryManager';

// ─── RM1: Constructor and initial state (4 tests) ─────────────────────────────

describe('RM1: constructor and initial state', () => {
  it('RM1-01: new RetryManager() does not throw', () => {
    expect(() => new RetryManager()).not.toThrow();
  });

  it('RM1-02: new RetryManager({ maxRetries: 5 }) does not throw', () => {
    expect(() => new RetryManager({ maxRetries: 5 })).not.toThrow();
  });

  it('RM1-03: retryCount() returns 0 before any execute() calls', () => {
    const mgr = new RetryManager();
    expect(mgr.retryCount()).toBe(0);
  });

  it('RM1-04: clear() on a fresh manager does not throw', () => {
    const mgr = new RetryManager();
    expect(() => mgr.clear()).not.toThrow();
  });
});

// ─── RM2: execute() — success on first try (5 tests) ─────────────────────────

describe('RM2: execute() — success on first try', () => {
  let mgr: RetryManager;
  beforeEach(() => { mgr = new RetryManager(); });

  it('RM2-01: execute() with a succeeding sync function returns ok:true', async () => {
    const result = await mgr.execute(() => 'value');
    expect(result.ok).toBe(true);
  });

  it('RM2-02: execute() returns the correct value on first-try success', async () => {
    const result = await mgr.execute(() => 42);
    expect(result.ok && result.value).toBe(42);
  });

  it('RM2-03: retryCount() is unchanged when fn succeeds on first try', async () => {
    await mgr.execute(() => 'ok');
    expect(mgr.retryCount()).toBe(0);
  });

  it('RM2-04: execute() with an async function that resolves returns ok:true', async () => {
    const result = await mgr.execute(() => Promise.resolve('async-value'));
    expect(result.ok).toBe(true);
  });

  it('RM2-05: execute() with async function returns the resolved value', async () => {
    const result = await mgr.execute(() => Promise.resolve({ msg: 'hello' }));
    expect(result.ok && (result.value as { msg: string }).msg).toBe('hello');
  });
});

// ─── RM3: execute() — retries on failure (5 tests) ───────────────────────────

describe('RM3: execute() — retries on failure', () => {
  it('RM3-01: fn always fails → returns ALL_RETRIES_FAILED', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
  });

  it('RM3-02: fn fails then succeeds → returns ok:true', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    let calls = 0;
    const fn = () => { calls++; if (calls < 2) throw new Error('not yet'); return 'done'; };
    const result = await mgr.execute(fn);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe('done');
  });

  it('RM3-03: retryCount() increments by the number of retries made', async () => {
    const mgr = new RetryManager({ maxRetries: 3, delayMs: 0 });
    let calls = 0;
    const fn = () => { calls++; if (calls < 3) throw new Error('not yet'); return 'ok'; };
    await mgr.execute(fn);
    expect(mgr.retryCount()).toBe(2); // 2 retries before success
  });

  it('RM3-04: fn is called maxRetries + 1 times total when all calls fail', async () => {
    const mgr = new RetryManager({ maxRetries: 3, delayMs: 0 });
    let calls = 0;
    await mgr.execute(() => { calls++; throw new Error('fail'); });
    expect(calls).toBe(4); // initial + 3 retries
  });

  it('RM3-05: fn is called only until first success (not all retries consumed)', async () => {
    const mgr = new RetryManager({ maxRetries: 5, delayMs: 0 });
    let calls = 0;
    const fn = () => { calls++; if (calls < 2) throw new Error('fail'); return 'ok'; };
    await mgr.execute(fn);
    expect(calls).toBe(2); // stopped after first success
  });
});

// ─── RM4: retryCount() (4 tests) ─────────────────────────────────────────────

describe('RM4: retryCount()', () => {
  it('RM4-01: retryCount() is 0 when fn always succeeds on first try', async () => {
    const mgr = new RetryManager();
    await mgr.execute(() => 1);
    await mgr.execute(() => 2);
    expect(mgr.retryCount()).toBe(0);
  });

  it('RM4-02: retryCount() is 1 after exactly one retry', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    let calls = 0;
    const fn = () => { calls++; if (calls < 2) throw new Error('x'); return 'ok'; };
    await mgr.execute(fn);
    expect(mgr.retryCount()).toBe(1);
  });

  it('RM4-03: retryCount() accumulates across multiple execute() calls', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    const alwaysFails = () => { throw new Error('fail'); };
    await mgr.execute(alwaysFails); // 2 retries
    await mgr.execute(alwaysFails); // 2 more retries
    expect(mgr.retryCount()).toBe(4);
  });

  it('RM4-04: a successful execute() after failures does not alter accumulated count', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    let attempt = 0;
    await mgr.execute(() => { attempt++; if (attempt < 3) throw new Error(); return 'ok'; });
    const countAfterFails = mgr.retryCount(); // 2
    await mgr.execute(() => 'immediate'); // no retries
    expect(mgr.retryCount()).toBe(countAfterFails); // still 2
  });
});

// ─── RM5: delay between retries — no backoff (4 tests) ───────────────────────

describe('RM5: delay between retries (no backoff)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('RM5-01: delayMs=0 — execute() resolves without timer advancement', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    let calls = 0;
    const fn = () => { calls++; if (calls < 3) throw new Error('x'); return 'ok'; };
    const result = await mgr.execute(fn);
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it('RM5-02: fn is not retried before delayMs has elapsed', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 500 });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    // Initial call fired synchronously.
    expect(calls).toBe(1);
    // Not enough time has passed — retry must not have fired.
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toBe(1);
    // Cross the delay threshold.
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(calls).toBe(2);
  });

  it('RM5-03: non-backoff retries wait the same delayMs each time', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 100, backoff: false });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100); // retry 1 fires
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(100); // retry 2 fires (same interval)
    expect(calls).toBe(3);
    await p;
  });

  it('RM5-04: no delay is applied before the initial call', async () => {
    const mgr = new RetryManager({ maxRetries: 3, delayMs: 1000 });
    let calls = 0;
    // fn succeeds on first try — no timer advancement needed.
    const result = await mgr.execute(() => { calls++; return 'immediate'; });
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
  });
});

// ─── RM6: exponential backoff (5 tests) ──────────────────────────────────────

describe('RM6: exponential backoff', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('RM6-01: backoff=true, first retry fires after delayMs', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 100, backoff: true });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100); // delay = 100 * 2^0 = 100
    await p;
    expect(calls).toBe(2);
  });

  it('RM6-02: backoff=true, second retry fires after 2× delayMs from the first retry', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 100, backoff: true });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100); // delay for retry 1 = 100 * 2^0 = 100
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(200); // delay for retry 2 = 100 * 2^1 = 200
    expect(calls).toBe(3);
    await p;
  });

  it('RM6-03: backoff=false uses same interval for every retry', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 150, backoff: false });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    await vi.advanceTimersByTimeAsync(150); // retry 1
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(150); // retry 2 — same delay, not doubled
    expect(calls).toBe(3);
    await p;
  });

  it('RM6-04: backoff=true with delayMs=0 resolves without timer advancement', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0, backoff: true });
    let calls = 0;
    const fn = () => { calls++; if (calls < 3) throw new Error(); return 'ok'; };
    const result = await mgr.execute(fn);
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it('RM6-05: cumulative backoff — two retries total 3× delayMs of wait', async () => {
    // retry 1 waits 100ms, retry 2 waits 200ms → total 300ms (= 3 × 100ms)
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 100, backoff: true });
    let calls = 0;
    const fn = () => { calls++; throw new Error('fail'); };
    const p = mgr.execute(fn);
    // Advance exactly 300ms to cover both retry delays (100 + 200).
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(calls).toBe(3);
  });
});

// ─── RM7: clear() (4 tests) ──────────────────────────────────────────────────

describe('RM7: clear()', () => {
  it('RM7-01: clear() resets retryCount() to 0', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    await mgr.execute(() => { throw new Error('fail'); });
    mgr.clear();
    expect(mgr.retryCount()).toBe(0);
  });

  it('RM7-02: retryCount() accumulates again from 0 after clear()', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    let c = 0;
    await mgr.execute(() => { c++; if (c < 2) throw new Error(); return 'ok'; });
    mgr.clear();
    expect(mgr.retryCount()).toBe(0);
    await mgr.execute(() => { throw new Error('fail'); });
    expect(mgr.retryCount()).toBe(1);
  });

  it('RM7-03: clear() does not prevent future execute() calls from working', async () => {
    const mgr = new RetryManager();
    mgr.clear();
    const result = await mgr.execute(() => 'still works');
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe('still works');
  });

  it('RM7-04: clear() on a manager with retryCount=0 is a no-op', () => {
    const mgr = new RetryManager();
    mgr.clear();
    expect(mgr.retryCount()).toBe(0);
  });
});

// ─── RM8: ALL_RETRIES_FAILED error detail (4 tests) ──────────────────────────

describe('RM8: ALL_RETRIES_FAILED error detail', () => {
  it('RM8-01: error code is ALL_RETRIES_FAILED when all attempts fail', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
  });

  it('RM8-02: ALL_RETRIES_FAILED error includes an attempts array', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    expect(!result.ok && Array.isArray(result.error.attempts)).toBe(true);
  });

  it('RM8-03: attempts array length equals maxRetries + 1', async () => {
    const maxRetries = 3;
    const mgr = new RetryManager({ maxRetries, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    expect(!result.ok && result.error.attempts?.length).toBe(maxRetries + 1);
  });

  it('RM8-04: each attempt records the error thrown by fn', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const sentinel = new Error('sentinel-error');
    const result = await mgr.execute(() => { throw sentinel; });
    const attempts = !result.ok ? result.error.attempts : undefined;
    expect(attempts?.[0].error).toBe(sentinel);
    expect(attempts?.[1].error).toBe(sentinel);
  });
});

// ─── RM9: Defensive copies (4 tests) ─────────────────────────────────────────

describe('RM9: defensive copies', () => {
  it('RM9-01: returned ok:true value is independent of the original return', async () => {
    const mgr = new RetryManager();
    const original = { count: 1 };
    const result = await mgr.execute(() => original);
    if (!result.ok) throw new Error('expected ok');
    (result.value as { count: number }).count = 999;
    // original should be unaffected (execute returned a clone)
    expect(original.count).toBe(1);
  });

  it('RM9-02: attempts array in error result is a defensive copy of internal records', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    if (result.ok) throw new Error('expected error');
    const attempts = result.error.attempts!;
    attempts.push({ attempt: 99, error: 'injected' }); // mutate returned array
    // A second failing call returns a fresh attempts array (unaffected by above)
    const result2 = await mgr.execute(() => { throw new Error('fail2'); });
    expect(!result2.ok && result2.error.attempts?.length).toBe(2);
  });

  it('RM9-03: mutating an attempt entry does not affect retryCount()', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const result = await mgr.execute(() => { throw new Error('fail'); });
    if (result.ok) throw new Error('expected error');
    // Tamper with the returned attempt object
    (result.error.attempts![0] as Record<string, unknown>)['attempt'] = 999;
    // retryCount is based on internal state, not the returned attempts array
    expect(mgr.retryCount()).toBe(1);
  });

  it('RM9-04: two execute() calls return independent error objects', async () => {
    const mgr = new RetryManager({ maxRetries: 0, delayMs: 0 });
    const r1 = await mgr.execute(() => { throw new Error('e1'); });
    const r2 = await mgr.execute(() => { throw new Error('e2'); });
    // Each call's error is its own object
    expect(!r1.ok && !r2.ok && r1.error !== r2.error).toBe(true);
  });
});

// ─── RM10: malformed input (5 tests) ─────────────────────────────────────────

describe('RM10: malformed input', () => {
  let mgr: RetryManager;
  beforeEach(() => { mgr = new RetryManager(); });

  it('RM10-01: execute(null) returns INVALID_FUNCTION error', async () => {
    const result = await mgr.execute(null as unknown as () => unknown);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('INVALID_FUNCTION');
  });

  it('RM10-02: execute(undefined) returns INVALID_FUNCTION error', async () => {
    const result = await mgr.execute(undefined as unknown as () => unknown);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('INVALID_FUNCTION');
  });

  it('RM10-03: execute("string") returns INVALID_FUNCTION error', async () => {
    const result = await mgr.execute('not-a-fn' as unknown as () => unknown);
    expect(!result.ok && result.error.code).toBe('INVALID_FUNCTION');
  });

  it('RM10-04: execute(42) returns INVALID_FUNCTION error', async () => {
    const result = await mgr.execute(42 as unknown as () => unknown);
    expect(!result.ok && result.error.code).toBe('INVALID_FUNCTION');
  });

  it('RM10-05: malformed execute() does not change retryCount()', async () => {
    await mgr.execute(null as unknown as () => unknown);
    await mgr.execute(undefined as unknown as () => unknown);
    expect(mgr.retryCount()).toBe(0);
  });
});

// ─── RM11: mixed operations (4 tests) ────────────────────────────────────────

describe('RM11: mixed operations', () => {
  it('RM11-01: retryCount() accumulates across successful and failed execute() calls', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    // First call: fails twice, succeeds on third try → 2 retries
    let c = 0;
    await mgr.execute(() => { c++; if (c < 3) throw new Error(); return 'ok'; });
    // Second call: always fails → 2 retries
    await mgr.execute(() => { throw new Error('fail'); });
    expect(mgr.retryCount()).toBe(4);
  });

  it('RM11-02: clear() between execute() calls resets accumulation', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    await mgr.execute(() => { throw new Error(); });
    mgr.clear();
    let c2 = 0;
    await mgr.execute(() => { c2++; if (c2 < 2) throw new Error(); return 'ok'; });
    expect(mgr.retryCount()).toBe(1); // only the 1 retry from the post-clear call
  });

  it('RM11-03: maxRetries=0 fails immediately on first fn() throw', async () => {
    const mgr = new RetryManager({ maxRetries: 0, delayMs: 0 });
    let calls = 0;
    const result = await mgr.execute(() => { calls++; throw new Error('x'); });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
    expect(calls).toBe(1); // called exactly once, no retries
    expect(mgr.retryCount()).toBe(0); // no retries made
  });

  it('RM11-04: multiple clear() calls in sequence are safe', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    await mgr.execute(() => { throw new Error(); });
    mgr.clear();
    mgr.clear();
    mgr.clear();
    expect(mgr.retryCount()).toBe(0);
  });
});

// ─── RM12: never-throw (8 tests) ─────────────────────────────────────────────

describe('RM12: never-throw', () => {
  it('RM12-01: execute() with a throwing function returns error (does not throw)', async () => {
    const mgr = new RetryManager({ maxRetries: 0 });
    await expect(mgr.execute(() => { throw new Error('boom'); })).resolves.toMatchObject({
      ok: false,
    });
  });

  it('RM12-02: execute(null) does not throw', async () => {
    const mgr = new RetryManager();
    await expect(mgr.execute(null as unknown as () => unknown)).resolves.toBeDefined();
  });

  it('RM12-03: retryCount() never throws', () => {
    const mgr = new RetryManager();
    expect(() => mgr.retryCount()).not.toThrow();
  });

  it('RM12-04: clear() never throws', () => {
    const mgr = new RetryManager();
    expect(() => mgr.clear()).not.toThrow();
  });

  it('RM12-05: execute() with fn throwing a non-Error value returns ALL_RETRIES_FAILED', async () => {
    const mgr = new RetryManager({ maxRetries: 0 });
    const result = await mgr.execute(() => { throw 'string-error'; });
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
  });

  it('RM12-06: execute() with fn throwing undefined returns ALL_RETRIES_FAILED', async () => {
    const mgr = new RetryManager({ maxRetries: 0 });
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    const result = await mgr.execute(() => { throw undefined; });
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
  });

  it('RM12-07: execute() with an async function that rejects returns ALL_RETRIES_FAILED', async () => {
    const mgr = new RetryManager({ maxRetries: 1, delayMs: 0 });
    const result = await mgr.execute(() => Promise.reject(new Error('async-fail')));
    expect(!result.ok && result.error.code).toBe('ALL_RETRIES_FAILED');
  });

  it('RM12-08: execute() handles a function that sometimes throws and sometimes rejects', async () => {
    const mgr = new RetryManager({ maxRetries: 2, delayMs: 0 });
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error('sync-ish');
      if (calls === 2) return Promise.reject(new Error('async-reject'));
      return 'final';
    };
    const result = await mgr.execute(fn);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe('final');
  });
});
