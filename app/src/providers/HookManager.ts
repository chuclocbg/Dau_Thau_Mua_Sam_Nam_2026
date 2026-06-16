/**
 * P6-12H: HookManager — sequential fire-and-forget hook runner.
 *
 * Hooks are zero-or-one-argument functions (sync or async) registered with
 * add() and fired in registration order by execute().  Each hook receives an
 * independent shallow clone of the payload, so mutations made by one hook are
 * invisible to all other hooks.
 *
 * This is the primary design distinction from MiddlewareChain:
 *   - MiddlewareChain  — shared mutable context, (ctx, next) signature,
 *                        stops on first failure.
 *   - HookManager      — isolated payload copies, (payload) signature,
 *                        runs ALL hooks even when some fail.
 *
 * Public API:
 *   add(fn)         — append a hook; returns { ok: true, value: index }
 *   remove(index)   — remove hook at the given position
 *   execute(payload)— fire all hooks with independent payload copies
 *   size()          — number of registered hooks; never fails
 *   clear()         — remove all hooks; never fails
 *   list()          — defensive snapshot of hook metadata; never fails
 *
 * Error codes:
 *   INVALID_HOOK       — add() received a non-function argument
 *   INDEX_OUT_OF_RANGE — remove() index is negative, fractional, or >= size()
 *   HOOK_FAILED        — one or more hooks threw or rejected
 *   HOOK_ERROR         — catch-all for unexpected failures
 *
 * Design rules (consistent with Pipeline and MiddlewareChain):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - execute() is async; all other public methods are synchronous.
 *   - size(), clear(), and list() never fail.
 *   - execute() passes a fresh shallow clone of the caller's payload to EACH
 *     hook independently; the original payload is never mutated and hook
 *     mutations are not visible to other hooks.
 *   - execute() runs ALL registered hooks even when some throw or reject;
 *     it returns HOOK_FAILED (with first-error text) if any hook failed.
 *   - execute() returns { ok: true, value: undefined } immediately when no
 *     hooks are registered.
 *   - add() returns the insertion index so callers can remove the hook later
 *     via remove().  Note: indices shift after any remove() call.
 *   - list() returns fresh { index } objects in a fresh array; mutations do
 *     not affect the manager.
 *   - SSR-compatible: no browser APIs, no timers, no DOM.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type HookErrorCode =
  | 'INVALID_HOOK'       // add() received a non-function
  | 'INDEX_OUT_OF_RANGE' // remove(index) out of bounds
  | 'HOOK_FAILED'        // one or more hooks threw or rejected
  | 'HOOK_ERROR';        // catch-all

export interface HookError {
  code:    HookErrorCode;
  message: string;
}

export type HookResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: HookError };

// ─── Hook function type ───────────────────────────────────────────────────────

/**
 * A hook function.  Receives an independent shallow clone of the payload.
 * Return values are ignored; hooks are fire-and-forget observers.
 * May be sync or async.
 */
export type HookFn = (payload: unknown) => void | Promise<void>;

// ─── Hook metadata (returned by list()) ──────────────────────────────────────

/** Read-only metadata about a registered hook returned by list(). */
export interface HookEntry {
  readonly index: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function hookErr(
  code:    HookErrorCode,
  message: string,
): HookResult<never> {
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

// ─── HookManager ─────────────────────────────────────────────────────────────

export class HookManager {
  private readonly hooks: HookFn[] = [];

  // ── add ───────────────────────────────────────────────────────────────────

  /**
   * Appends `fn` to the end of the hook list.
   * Returns { ok: true, value: index } where `index` is the zero-based
   * position at which the hook was inserted.
   * Returns INVALID_HOOK when `fn` is not a function.
   * Never throws.
   */
  add(fn: HookFn): HookResult<number> {
    if (typeof fn !== 'function') {
      return hookErr(
        'INVALID_HOOK',
        `add() requires a callable function; received: ${typeof fn}.`,
      );
    }
    this.hooks.push(fn);
    return { ok: true, value: this.hooks.length - 1 };
  }

  // ── remove ────────────────────────────────────────────────────────────────

  /**
   * Removes the hook at position `index`.
   * Returns { ok: true } when the hook is found and removed.
   * Returns INDEX_OUT_OF_RANGE when `index` is negative, non-integer, or
   * greater than or equal to size().
   * Never throws.
   *
   * Note: removing a hook shifts all subsequent hook indices down by one.
   */
  remove(index: number): HookResult<void> {
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.hooks.length
    ) {
      return hookErr(
        'INDEX_OUT_OF_RANGE',
        `remove() index ${String(index)} is out of range; ` +
          `${this.hooks.length} hook(s) registered.`,
      );
    }
    this.hooks.splice(index, 1);
    return { ok: true, value: undefined };
  }

  // ── execute ───────────────────────────────────────────────────────────────

  /**
   * Fires all registered hooks sequentially, each receiving an independent
   * shallow clone of `payload`.
   *
   * Runs ALL hooks even when some throw or reject — a failing hook does not
   * prevent subsequent hooks from firing.
   *
   * Returns { ok: true } when every hook completes without error.
   * Returns HOOK_FAILED (with first-error text and total failure count) if
   * any hook threw or rejected.
   * Returns { ok: true } immediately when no hooks are registered.
   * Never throws.
   */
  async execute(payload: unknown): Promise<HookResult<void>> {
    let failed   = 0;
    let firstMsg = '';

    for (const hook of this.hooks) {
      try {
        await hook(cloneValue(payload));
      } catch (err) {
        failed += 1;
        if (failed === 1) firstMsg = String(err);
      }
    }

    if (failed > 0) {
      return hookErr(
        'HOOK_FAILED',
        `${failed} hook(s) failed. First error: ${firstMsg}.`,
      );
    }
    return { ok: true, value: undefined };
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of registered hooks.
   * Never fails; returns 0 when no hooks are registered.
   */
  size(): number {
    return this.hooks.length;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered hooks without executing them.
   * Never fails.
   */
  clear(): void {
    this.hooks.length = 0;
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of registered-hook metadata in order.
   * Each element is a fresh { index } object; the array itself is fresh.
   * Mutations to the returned array or its items do not affect the manager.
   * Never fails; returns [] when no hooks are registered.
   */
  list(): HookEntry[] {
    return this.hooks.map((_, i) => ({ index: i }));
  }
}
