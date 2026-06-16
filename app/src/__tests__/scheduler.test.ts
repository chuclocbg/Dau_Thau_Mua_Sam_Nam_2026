/**
 * P6-12E: Scheduler — FIFO job scheduler tests.
 *
 * 56 tests grouped E1-E12.
 *
 * Groups:
 *   E1  (5) Constructor / initial state
 *   E2  (5) schedule() — valid sync and async jobs
 *   E3  (5) schedule() — invalid jobs (INVALID_JOB)
 *   E4  (5) cancel()
 *   E5  (5) runNext() — success cases
 *   E6  (4) runNext() — error cases (empty queue, job throws)
 *   E7  (5) runAll() — all succeed
 *   E8  (4) runAll() — job failure handling
 *   E9  (4) size()
 *   E10 (4) clear()
 *   E11 (5) list() + defensive copies
 *   E12 (6) Never throw / edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Scheduler,
  type SchedulerResult,
  type SchedulerError,
  type SchedulerErrorCode,
} from '../providers/Scheduler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(value: unknown = undefined): () => unknown {
  return vi.fn(() => value);
}

function makeAsyncJob(value: unknown = undefined, delayMs = 0): () => Promise<unknown> {
  return vi.fn(async () => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    return value;
  });
}

function makeThrowingJob(msg = 'job-boom'): () => never {
  return vi.fn(() => { throw new Error(msg); });
}

function makeRejectingJob(msg = 'async-boom'): () => Promise<never> {
  return vi.fn(async () => { throw new Error(msg); });
}

function extractId(r: SchedulerResult<string>): string {
  if (!r.ok) throw new Error(`Expected ok result, got error: ${r.error.code}`);
  return r.value;
}

// ─── E1: Constructor / initial state ─────────────────────────────────────────

describe('E1: Constructor / initial state', () => {
  it('E1-01: new Scheduler() constructs without throwing', () => {
    expect(() => new Scheduler()).not.toThrow();
  });

  it('E1-02: size() returns 0 initially', () => {
    const s = new Scheduler();
    expect(s.size()).toBe(0);
  });

  it('E1-03: list() returns [] initially', () => {
    const s = new Scheduler();
    expect(s.list()).toEqual([]);
  });

  it('E1-04: clear() on empty scheduler is a safe no-op', () => {
    const s = new Scheduler();
    expect(() => s.clear()).not.toThrow();
    expect(s.size()).toBe(0);
  });

  it('E1-05: constructor takes no required arguments', () => {
    const s = new Scheduler();
    expect(s).toBeInstanceOf(Scheduler);
  });
});

// ─── E2: schedule() — valid sync and async jobs ───────────────────────────────

describe('E2: schedule() — valid sync and async jobs', () => {
  it('E2-01: schedule(syncFn) returns { ok: true, value: string }', () => {
    const s = new Scheduler();
    const r = s.schedule(() => 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('string');
  });

  it('E2-02: schedule(asyncFn) returns { ok: true, value: string }', () => {
    const s = new Scheduler();
    const r = s.schedule(async () => 'hello');
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('string');
  });

  it('E2-03: schedule() adds the job — size() reflects it', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.schedule(() => 2);
    expect(s.size()).toBe(2);
  });

  it('E2-04: returned id starts with "sched_"', () => {
    const s = new Scheduler();
    const r = s.schedule(() => 0);
    if (r.ok) expect(r.value).toMatch(/^sched_\d+$/);
  });

  it('E2-05: each schedule() call returns a unique id', () => {
    const s = new Scheduler();
    const ids = Array.from({ length: 5 }, () => extractId(s.schedule(() => 0)));
    expect(new Set(ids).size).toBe(5);
  });
});

// ─── E3: schedule() — invalid jobs ───────────────────────────────────────────

describe('E3: schedule() — invalid jobs (INVALID_JOB)', () => {
  it('E3-01: schedule(null) returns INVALID_JOB error', () => {
    const s = new Scheduler();
    const r = s.schedule(null as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_JOB');
  });

  it('E3-02: schedule(undefined) returns INVALID_JOB error', () => {
    const s = new Scheduler();
    const r = s.schedule(undefined as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_JOB');
  });

  it('E3-03: schedule(42) returns INVALID_JOB error', () => {
    const s = new Scheduler();
    const r = s.schedule(42 as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_JOB');
  });

  it('E3-04: schedule("string") returns INVALID_JOB error', () => {
    const s = new Scheduler();
    const r = s.schedule('hello' as unknown as () => unknown);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_JOB');
  });

  it('E3-05: invalid schedule() does not change size()', () => {
    const s = new Scheduler();
    s.schedule(null as unknown as () => unknown);
    expect(s.size()).toBe(0);
  });
});

// ─── E4: cancel() ─────────────────────────────────────────────────────────────

describe('E4: cancel()', () => {
  it('E4-01: cancel(known-id) returns { ok: true }', () => {
    const s = new Scheduler();
    const id = extractId(s.schedule(() => 1));
    const r = s.cancel(id);
    expect(r.ok).toBe(true);
  });

  it('E4-02: cancel() removes the job from the queue', () => {
    const s = new Scheduler();
    const id = extractId(s.schedule(() => 1));
    s.cancel(id);
    expect(s.size()).toBe(0);
  });

  it('E4-03: cancel(unknown-id) returns JOB_NOT_FOUND error', () => {
    const s = new Scheduler();
    const r = s.cancel('sched_9999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JOB_NOT_FOUND');
  });

  it('E4-04: cancel(id) twice returns JOB_NOT_FOUND on the second call', () => {
    const s = new Scheduler();
    const id = extractId(s.schedule(() => 1));
    s.cancel(id);
    const r2 = s.cancel(id);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('JOB_NOT_FOUND');
  });

  it('E4-05: cancel() preserves remaining jobs in FIFO order', () => {
    const s = new Scheduler();
    const id1 = extractId(s.schedule(() => 1));
    const id2 = extractId(s.schedule(() => 2));
    const id3 = extractId(s.schedule(() => 3));
    s.cancel(id2);
    const ids = s.list().map(j => j.id);
    expect(ids).toEqual([id1, id3]);
  });
});

// ─── E5: runNext() — success cases ───────────────────────────────────────────

describe('E5: runNext() — success cases', () => {
  it('E5-01: runNext() executes the oldest pending job', async () => {
    const s = new Scheduler();
    const fn1 = makeJob(1);
    const fn2 = makeJob(2);
    s.schedule(fn1);
    s.schedule(fn2);
    await s.runNext();
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('E5-02: runNext() returns { ok: true, value } with the job\'s return value', async () => {
    const s = new Scheduler();
    s.schedule(() => 42);
    const r = await s.runNext();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('E5-03: runNext() awaits async jobs', async () => {
    const s = new Scheduler();
    s.schedule(makeAsyncJob('async-val'));
    const r = await s.runNext();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('async-val');
  });

  it('E5-04: runNext() removes the executed job from the queue', async () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    expect(s.size()).toBe(1);
    await s.runNext();
    expect(s.size()).toBe(0);
  });

  it('E5-05: consecutive runNext() calls execute jobs in FIFO order', async () => {
    const s = new Scheduler();
    const log: number[] = [];
    s.schedule(() => { log.push(1); });
    s.schedule(() => { log.push(2); });
    s.schedule(() => { log.push(3); });
    await s.runNext();
    await s.runNext();
    await s.runNext();
    expect(log).toEqual([1, 2, 3]);
  });
});

// ─── E6: runNext() — error cases ─────────────────────────────────────────────

describe('E6: runNext() — error cases', () => {
  it('E6-01: runNext() on empty scheduler returns NO_JOBS error', async () => {
    const s = new Scheduler();
    const r = await s.runNext();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_JOBS');
  });

  it('E6-02: runNext() when job throws returns JOB_FAILED', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob());
    const r = await s.runNext();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JOB_FAILED');
  });

  it('E6-03: runNext() removes the job even when it throws', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob());
    await s.runNext();
    expect(s.size()).toBe(0);
  });

  it('E6-04: runNext() when async job rejects returns JOB_FAILED', async () => {
    const s = new Scheduler();
    s.schedule(makeRejectingJob('async fail'));
    const r = await s.runNext();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('JOB_FAILED');
      expect(r.error.message).toContain('async fail');
    }
  });
});

// ─── E7: runAll() — all succeed ───────────────────────────────────────────────

describe('E7: runAll() — all succeed', () => {
  it('E7-01: runAll() on empty scheduler returns { ok: true }', async () => {
    const s = new Scheduler();
    const r = await s.runAll();
    expect(r.ok).toBe(true);
  });

  it('E7-02: runAll() executes all pending jobs', async () => {
    const s = new Scheduler();
    const log: number[] = [];
    s.schedule(() => { log.push(1); });
    s.schedule(() => { log.push(2); });
    s.schedule(() => { log.push(3); });
    await s.runAll();
    expect(log).toEqual([1, 2, 3]);
  });

  it('E7-03: runAll() returns { ok: true, value: undefined } when all succeed', async () => {
    const s = new Scheduler();
    s.schedule(() => 'a');
    s.schedule(() => 'b');
    const r = await s.runAll();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeUndefined();
  });

  it('E7-04: runAll() empties the queue', async () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.schedule(() => 2);
    await s.runAll();
    expect(s.size()).toBe(0);
  });

  it('E7-05: runAll() awaits async jobs in FIFO order', async () => {
    const s = new Scheduler();
    const log: string[] = [];
    s.schedule(async () => { log.push('a'); });
    s.schedule(async () => { log.push('b'); });
    s.schedule(async () => { log.push('c'); });
    await s.runAll();
    expect(log).toEqual(['a', 'b', 'c']);
  });
});

// ─── E8: runAll() — job failure handling ─────────────────────────────────────

describe('E8: runAll() — job failure handling', () => {
  it('E8-01: runAll() continues running after a job throws', async () => {
    const s = new Scheduler();
    const log: number[] = [];
    s.schedule(() => { log.push(1); throw new Error('fail'); });
    s.schedule(() => { log.push(2); });
    s.schedule(() => { log.push(3); });
    await s.runAll();
    expect(log).toEqual([1, 2, 3]);
  });

  it('E8-02: runAll() returns JOB_FAILED if any job throws', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob('boom'));
    s.schedule(() => 'ok');
    const r = await s.runAll();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('JOB_FAILED');
  });

  it('E8-03: runAll() error message includes the first failure text', async () => {
    const s = new Scheduler();
    s.schedule(() => { throw new Error('first-error'); });
    s.schedule(() => { throw new Error('second-error'); });
    const r = await s.runAll();
    if (!r.ok) expect(r.error.message).toContain('first-error');
  });

  it('E8-04: runAll() empties the queue even when jobs fail', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob());
    s.schedule(makeThrowingJob());
    await s.runAll();
    expect(s.size()).toBe(0);
  });
});

// ─── E9: size() ───────────────────────────────────────────────────────────────

describe('E9: size()', () => {
  it('E9-01: size() returns 0 on new instance', () => {
    expect(new Scheduler().size()).toBe(0);
  });

  it('E9-02: size() increments with each schedule() call', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.schedule(() => 2);
    expect(s.size()).toBe(2);
  });

  it('E9-03: size() decrements after cancel()', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    const id = extractId(s.schedule(() => 2));
    s.cancel(id);
    expect(s.size()).toBe(1);
  });

  it('E9-04: size() decrements after runNext()', async () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.schedule(() => 2);
    await s.runNext();
    expect(s.size()).toBe(1);
  });
});

// ─── E10: clear() ─────────────────────────────────────────────────────────────

describe('E10: clear()', () => {
  it('E10-01: clear() empties the scheduler', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.schedule(() => 2);
    s.clear();
    expect(s.size()).toBe(0);
  });

  it('E10-02: list() returns [] after clear()', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.clear();
    expect(s.list()).toEqual([]);
  });

  it('E10-03: runNext() returns NO_JOBS after clear()', async () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    s.clear();
    const r = await s.runNext();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_JOBS');
  });

  it('E10-04: clear() on an already-empty scheduler is a safe no-op', () => {
    const s = new Scheduler();
    expect(() => { s.clear(); s.clear(); }).not.toThrow();
    expect(s.size()).toBe(0);
  });
});

// ─── E11: list() + defensive copies ──────────────────────────────────────────

describe('E11: list() + defensive copies', () => {
  it('E11-01: list() returns ScheduledJob entries with correct ids', () => {
    const s = new Scheduler();
    const id1 = extractId(s.schedule(() => 1));
    const id2 = extractId(s.schedule(() => 2));
    const ids = s.list().map(j => j.id);
    expect(ids).toEqual([id1, id2]);
  });

  it('E11-02: list() after cancel() excludes the cancelled id', () => {
    const s = new Scheduler();
    const id = extractId(s.schedule(() => 1));
    s.schedule(() => 2);
    s.cancel(id);
    const ids = s.list().map(j => j.id);
    expect(ids).not.toContain(id);
    expect(ids).toHaveLength(1);
  });

  it('E11-03: mutating the returned list does not affect scheduler size', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    const arr = s.list();
    arr.push({ id: 'fake_99' });
    expect(s.size()).toBe(1);
  });

  it('E11-04: each list() call returns an independent array', () => {
    const s = new Scheduler();
    s.schedule(() => 1);
    const a = s.list();
    const b = s.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('E11-05: runNext() shallow-clones an object return value', async () => {
    const s = new Scheduler();
    const obj = { x: 1, y: 2 };
    s.schedule(() => obj);
    const r = await s.runNext();
    if (r.ok && typeof r.value === 'object' && r.value !== null) {
      expect(r.value).toEqual(obj);
      expect(r.value).not.toBe(obj);
    }
  });
});

// ─── E12: Never throw / edge cases ───────────────────────────────────────────

describe('E12: Never throw / edge cases', () => {
  it('E12-01: runNext() never throws even when the job throws', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob());
    await expect(s.runNext()).resolves.not.toThrow();
  });

  it('E12-02: runAll() never throws even when all jobs throw', async () => {
    const s = new Scheduler();
    s.schedule(makeThrowingJob());
    s.schedule(makeThrowingJob());
    await expect(s.runAll()).resolves.not.toThrow();
  });

  it('E12-03: schedule() never throws for any argument', () => {
    const s = new Scheduler();
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], true, Symbol()];
    for (const v of inputs) {
      expect(() => s.schedule(v as () => unknown)).not.toThrow();
    }
  });

  it('E12-04: cancel() never throws for any argument', () => {
    const s = new Scheduler();
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], 'nonexistent'];
    for (const v of inputs) {
      expect(() => s.cancel(v as string)).not.toThrow();
    }
  });

  it('E12-05: size() never throws', () => {
    const s = new Scheduler();
    expect(() => s.size()).not.toThrow();
  });

  it('E12-06: runAll() does not run jobs added by a running job', async () => {
    const s = new Scheduler();
    const innerFn = vi.fn(() => {});
    s.schedule(() => {
      // schedule a new job while runAll is executing
      s.schedule(innerFn);
    });
    await s.runAll();
    // innerFn should NOT have been called by this runAll
    expect(innerFn).not.toHaveBeenCalled();
    // but it should remain in the queue for the next call
    expect(s.size()).toBe(1);
  });
});
