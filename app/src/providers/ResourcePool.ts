/**
 * P6-11H: ResourcePool — in-process generic object pool with FIFO reuse.
 *
 * Resources are held in a FIFO queue.  acquire() checks out the front
 * resource; release() returns it to the back so resources cycle in
 * first-released-first-reused order.
 *
 * Public API:
 *   acquire()          — check out the front available resource
 *   release(resource)  — return a resource to the back of the pool
 *   size()             — total managed resources (available + acquired)
 *   available()        — resources currently available to acquire
 *   clear()            — discard all resources; never fails
 *   list()             — defensive copy of available resources; never fails
 *
 * Constructor:
 *   new ResourcePool(resources?, options?)
 *     resources — initial resource array (cloned at write time)
 *     options.maxSize — hard cap on total resources (constructor truncates)
 *
 * Error codes:
 *   POOL_EMPTY   — acquire() when no resources are available
 *   POOL_ERROR   — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — acquire() errors surface as { ok: false, error }.
 *   - release(), size(), available(), clear(), list() never fail.
 *   - release() with null, undefined, or an unknown resource succeeds silently.
 *   - Duplicate release (resource not in acquired set) is a silent no-op.
 *   - acquire() returns the internal reference so release() can match by ===.
 *   - list() returns shallow clones so inspection cannot corrupt pool state.
 *   - Constructor clones each resource (pool owns its own copies).
 *   - FIFO: acquire shifts from front; release pushes to back.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type ResourcePoolErrorCode =
  | 'POOL_EMPTY'   // acquire() when no resources are available
  | 'POOL_ERROR';  // catch-all for unexpected failures

export interface ResourcePoolError {
  code:    ResourcePoolErrorCode;
  message: string;
}

export type ResourcePoolResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ResourcePoolError };

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ResourcePoolOptions {
  /** Maximum total resources the pool may hold. Defaults to unlimited. */
  maxSize?: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function poolErr(
  code:    ResourcePoolErrorCode,
  message: string,
): ResourcePoolResult<never> {
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

// ─── ResourcePool ─────────────────────────────────────────────────────────────

export class ResourcePool<T = unknown> {
  /** Available resources in FIFO order. */
  private readonly pool: T[] = [];
  /** Resources currently acquired (checked out). */
  private readonly inUse: T[] = [];
  /** Hard cap on total resources managed by this pool. */
  private readonly maxSize: number;

  constructor(resources: T[] = [], options: ResourcePoolOptions = {}) {
    const cap = options.maxSize;
    this.maxSize = (typeof cap === 'number' && Number.isFinite(cap) && cap > 0)
      ? cap
      : Infinity;

    const limit = this.maxSize === Infinity
      ? resources.length
      : Math.min(resources.length, this.maxSize);

    for (let i = 0; i < limit; i++) {
      const r = resources[i];
      if (r !== null && r !== undefined) {
        this.pool.push(cloneValue(r));
      }
    }
  }

  // ── acquire ──────────────────────────────────────────────────────────────────

  /**
   * Checks out the front available resource.
   *
   * Returns POOL_EMPTY when no resources are available.
   * The returned value is the internal reference — pass it back to release()
   * unchanged so the pool can match it by reference identity (===).
   */
  acquire(): ResourcePoolResult<T> {
    if (this.pool.length === 0) {
      return poolErr('POOL_EMPTY', 'No resources available in the pool.');
    }

    const resource = this.pool.shift()!;
    this.inUse.push(resource);
    return { ok: true, value: resource };
  }

  // ── release ──────────────────────────────────────────────────────────────────

  /**
   * Returns `resource` to the back of the available queue.
   *
   * Always returns ok:true — the following are all silent no-ops:
   *   - Releasing null or undefined.
   *   - Releasing a resource not acquired from this pool (unknown resource).
   *   - Releasing a resource that was already released (duplicate release).
   */
  release(resource: T): ResourcePoolResult<void> {
    if (resource === null || resource === undefined) {
      return { ok: true, value: undefined };
    }

    const idx = this.inUse.indexOf(resource);
    if (idx === -1) {
      // Unknown resource or already released — succeed silently.
      return { ok: true, value: undefined };
    }

    this.inUse.splice(idx, 1);
    this.pool.push(resource);
    return { ok: true, value: undefined };
  }

  // ── size ─────────────────────────────────────────────────────────────────────

  /**
   * Total resources managed by this pool (available + currently acquired).
   * Never fails; returns 0 when the pool is empty.
   */
  size(): number {
    return this.pool.length + this.inUse.length;
  }

  // ── available ────────────────────────────────────────────────────────────────

  /**
   * Number of resources currently available to acquire.
   * Never fails; returns 0 when all resources are in use or the pool is empty.
   */
  available(): number {
    return this.pool.length;
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * Discards all resources (available and acquired).
   * After clear(), size() and available() both return 0.
   * Never fails.
   */
  clear(): void {
    this.pool.length  = 0;
    this.inUse.length = 0;
  }

  // ── list ─────────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of all currently available resources in FIFO order.
   * Each resource is shallow-cloned; the returned array is fresh.
   * Acquired resources are NOT included.
   * Mutations to the returned array or its items do not affect the pool.
   * Never fails; returns [] when no resources are available.
   */
  list(): T[] {
    return this.pool.map(cloneValue);
  }
}
