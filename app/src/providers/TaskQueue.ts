/**
 * P6-11G: TaskQueue — in-process FIFO task queue.
 *
 * Enqueued tasks are delivered in first-in-first-out order.
 * Values are arbitrary (typed as unknown/T); null and undefined are
 * rejected at enqueue time so that a null return from dequeue() / peek()
 * unambiguously means the queue is empty.
 *
 * Public API:
 *   enqueue(task)  — add a task to the back of the queue
 *   dequeue()      — remove and return the front task, or null when empty
 *   peek()         — inspect the front task without removing it, or null
 *   size()         — number of queued tasks; never fails
 *   clear()        — remove all tasks; never fails
 *   list()         — defensive copy of all tasks in FIFO order; never fails
 *
 * Error codes:
 *   INVALID_TASK       — task is null or undefined
 *   TASK_QUEUE_ERROR   — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — enqueue() errors surface as { ok: false, error }.
 *   - dequeue(), peek(), size(), clear(), list() never fail.
 *   - dequeue() on an empty queue returns null (not an error).
 *   - peek() on an empty queue returns null (not an error).
 *   - Defensive copies: tasks are shallow-cloned at write time (enqueue)
 *     and again at read time (peek, list).  dequeue() removes the item so
 *     only the read-time clone is needed there.
 *   - Insertion order: FIFO — first enqueued is first dequeued.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type TaskQueueErrorCode =
  | 'INVALID_TASK'       // task is null or undefined
  | 'TASK_QUEUE_ERROR';  // catch-all for unexpected failures

export interface TaskQueueError {
  code:    TaskQueueErrorCode;
  message: string;
}

export type TaskQueueResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: TaskQueueError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function queueErr(
  code:    TaskQueueErrorCode,
  message: string,
): TaskQueueResult<never> {
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

// ─── TaskQueue ────────────────────────────────────────────────────────────────

export class TaskQueue<T = unknown> {
  private readonly tasks: T[] = [];

  // ── enqueue ─────────────────────────────────────────────────────────────────

  /**
   * Adds `task` to the back of the queue.
   * The task is shallow-cloned at write time so later mutations to the
   * caller's reference do not affect the stored item.
   *
   * Returns INVALID_TASK when task is null or undefined.
   */
  enqueue(task: T): TaskQueueResult<void> {
    if (task === null || task === undefined) {
      return queueErr('INVALID_TASK',
        `Task must not be null or undefined; received: ${String(task)}.`);
    }

    this.tasks.push(cloneValue(task));
    return { ok: true, value: undefined };
  }

  // ── dequeue ──────────────────────────────────────────────────────────────────

  /**
   * Removes and returns the front task.
   * Returns null when the queue is empty (not an error).
   * The returned value is a fresh shallow clone so the caller cannot corrupt
   * internal state through the returned reference.
   * Never fails.
   */
  dequeue(): T | null {
    if (this.tasks.length === 0) return null;
    // shift() is safe here: the item is removed from storage, so a
    // read-time clone is only needed to give the caller an independent copy.
    return cloneValue(this.tasks.shift()!);
  }

  // ── peek ─────────────────────────────────────────────────────────────────────

  /**
   * Returns the front task without removing it, or null when empty.
   * Returns a fresh shallow clone so mutations to the returned value do not
   * affect the item still held in the queue.
   * Never fails.
   */
  peek(): T | null {
    if (this.tasks.length === 0) return null;
    return cloneValue(this.tasks[0]);
  }

  // ── size ─────────────────────────────────────────────────────────────────────

  /**
   * Returns the number of tasks currently in the queue.
   * Never fails; returns 0 when empty.
   */
  size(): number {
    return this.tasks.length;
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * Removes all tasks.  Never fails.
   */
  clear(): void {
    this.tasks.length = 0;
  }

  // ── list ─────────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of all tasks in FIFO order (front first).
   * Each task is shallow-cloned; the returned array is fresh.
   * Mutations to the returned array or its items do not affect the queue.
   * Never fails; returns [] when empty.
   */
  list(): T[] {
    return this.tasks.map(cloneValue);
  }
}
