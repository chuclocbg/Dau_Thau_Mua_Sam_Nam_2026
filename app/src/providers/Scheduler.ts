/**
 * P6-12E: Scheduler — FIFO job scheduler for sync and async functions.
 *
 * Jobs are zero-argument functions (sync or async) registered with
 * schedule() and executed in first-in-first-out order by runNext() or
 * runAll().  Each job receives a stable string ID that can be used with
 * cancel() to remove it before it runs.
 *
 * Public API:
 *   schedule(job)  — register a job; returns { ok: true, value: id }
 *   cancel(id)     — remove a pending job by id
 *   runNext()      — execute and remove the oldest pending job
 *   runAll()       — execute and remove all pending jobs in FIFO order
 *   size()         — number of pending jobs; never fails
 *   clear()        — remove all pending jobs; never fails
 *   list()         — defensive snapshot of pending-job metadata; never fails
 *
 * Error codes:
 *   INVALID_JOB      — schedule() received a non-function argument
 *   JOB_NOT_FOUND    — cancel() received an unknown or already-removed id
 *   NO_JOBS          — runNext() called on an empty scheduler
 *   JOB_FAILED       — a job function threw or rejected
 *   SCHEDULER_ERROR  — catch-all for unexpected failures
 *
 * Design rules (consistent with TaskQueue and RetryManager):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - runNext() / runAll() return Promises; all other public methods are sync.
 *   - size(), clear(), and list() never fail.
 *   - runNext() removes the job from the queue before executing it; a job
 *     that throws is still considered "run" and is not re-queued.
 *   - runAll() snapshots and clears the queue before execution so jobs
 *     added by a running job are not consumed by the same runAll() call.
 *   - runAll() continues executing remaining jobs even when one fails;
 *     the result is JOB_FAILED if any job failed.
 *   - Return values from jobs are shallow-cloned (consistent with the
 *     rest of the provider layer).
 *   - list() returns a fresh array of ScheduledJob metadata objects;
 *     mutations to the array or its items do not affect the scheduler.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type SchedulerErrorCode =
  | 'INVALID_JOB'      // schedule() received a non-function
  | 'JOB_NOT_FOUND'    // cancel() id is unknown / already removed
  | 'NO_JOBS'          // runNext() on an empty queue
  | 'JOB_FAILED'       // a job threw or rejected
  | 'SCHEDULER_ERROR'; // catch-all

export interface SchedulerError {
  code:    SchedulerErrorCode;
  message: string;
}

export type SchedulerResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: SchedulerError };

// ─── Job type ─────────────────────────────────────────────────────────────────

/** A zero-argument function (sync or async) that can be registered with schedule(). */
export type SchedulerJob = () => unknown | Promise<unknown>;

// ─── Job metadata (returned by list()) ───────────────────────────────────────

/** Read-only metadata about a pending job returned by list(). */
export interface ScheduledJob {
  readonly id: string;
}

// ─── Private types ────────────────────────────────────────────────────────────

interface StoredJob {
  readonly id: string;
  readonly fn: SchedulerJob;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function schedErr(
  code:    SchedulerErrorCode,
  message: string,
): SchedulerResult<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, and undefined
 * as-is.  Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  private readonly stored: StoredJob[] = [];
  private nextId = 1;

  // ── schedule ──────────────────────────────────────────────────────────────

  /**
   * Registers `job` at the back of the queue.
   * Returns { ok: true, value: id } on success.
   * Returns INVALID_JOB when `job` is not a function.
   * Never throws.
   */
  schedule(job: SchedulerJob): SchedulerResult<string> {
    if (typeof job !== 'function') {
      return schedErr(
        'INVALID_JOB',
        `schedule() requires a callable function; received: ${typeof job}.`,
      );
    }
    const id = `sched_${this.nextId++}`;
    this.stored.push({ id, fn: job });
    return { ok: true, value: id };
  }

  // ── cancel ────────────────────────────────────────────────────────────────

  /**
   * Removes the pending job identified by `id`.
   * Returns { ok: true } if the job was found and removed.
   * Returns JOB_NOT_FOUND if the id is unknown or the job has already run.
   * Never throws.
   */
  cancel(id: string): SchedulerResult<void> {
    if (typeof id !== 'string') {
      return schedErr(
        'JOB_NOT_FOUND',
        `cancel() requires a string id; received: ${typeof id}.`,
      );
    }
    const idx = this.stored.findIndex(j => j.id === id);
    if (idx === -1) {
      return schedErr('JOB_NOT_FOUND', `No pending job with id "${id}".`);
    }
    this.stored.splice(idx, 1);
    return { ok: true, value: undefined };
  }

  // ── runNext ───────────────────────────────────────────────────────────────

  /**
   * Removes the oldest pending job from the queue and executes it.
   *
   * Returns { ok: true, value } where `value` is a shallow clone of the
   * job's return value.
   * Returns NO_JOBS when the queue is empty.
   * Returns JOB_FAILED when the job throws or rejects (job is not re-queued).
   * Never throws.
   */
  async runNext(): Promise<SchedulerResult<unknown>> {
    if (this.stored.length === 0) {
      return schedErr('NO_JOBS', 'No pending jobs to run.');
    }
    const job = this.stored.shift()!;
    try {
      const result = await job.fn();
      return { ok: true, value: cloneValue(result) };
    } catch (err) {
      return schedErr(
        'JOB_FAILED',
        `Job "${job.id}" threw: ${String(err)}.`,
      );
    }
  }

  // ── runAll ────────────────────────────────────────────────────────────────

  /**
   * Snapshots and clears the current queue, then executes every job in FIFO
   * order.  Jobs added to the scheduler while runAll() is running are NOT
   * consumed by this call.
   *
   * Continues executing remaining jobs even if one throws or rejects.
   * Returns { ok: true } when every job succeeded.
   * Returns JOB_FAILED (with the first error message) if any job failed.
   * Returns { ok: true } immediately on an empty queue.
   * Never throws.
   */
  async runAll(): Promise<SchedulerResult<void>> {
    const jobs = this.stored.splice(0); // snapshot + clear atomically
    let failed    = 0;
    let firstMsg  = '';

    for (const job of jobs) {
      try {
        await job.fn();
      } catch (err) {
        failed += 1;
        if (failed === 1) firstMsg = String(err);
      }
    }

    if (failed > 0) {
      return schedErr(
        'JOB_FAILED',
        `${failed} job(s) failed. First error: ${firstMsg}.`,
      );
    }
    return { ok: true, value: undefined };
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of pending jobs.
   * Never fails; returns 0 when the queue is empty.
   */
  size(): number {
    return this.stored.length;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all pending jobs without executing them.
   * Never fails.
   */
  clear(): void {
    this.stored.length = 0;
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of pending-job metadata in FIFO order.
   * Each element is a fresh { id } object; the array itself is fresh.
   * Mutations to the returned array or its items do not affect the scheduler.
   * Never fails; returns [] when the queue is empty.
   */
  list(): ScheduledJob[] {
    return this.stored.map(j => ({ id: j.id }));
  }
}
