/**
 * P6-12G: MiddlewareChain — classic (context, next) middleware runner.
 *
 * Middleware functions are registered with add() and run in registration order
 * by execute().  Each middleware receives the shared mutable context and a
 * next() function that, when called, passes control to the next middleware.
 * Middleware may perform work before next(), await next() for post-processing,
 * or skip next() entirely to short-circuit the chain.
 *
 * This is the same "onion" model used by Koa, Express, and WHATWG Fetch
 * middleware stacks — see design notes below.
 *
 * Public API:
 *   add(fn)         — append middleware; returns { ok: true, value: index }
 *   remove(index)   — remove middleware at the given position
 *   execute(context)— run all middleware against a (cloned) context
 *   size()          — number of registered middleware; never fails
 *   clear()         — remove all middleware; never fails
 *   list()          — defensive snapshot of middleware metadata; never fails
 *
 * Error codes:
 *   INVALID_MIDDLEWARE — add() received a non-function argument
 *   INDEX_OUT_OF_RANGE — remove() index is negative, fractional, or >= size()
 *   MIDDLEWARE_FAILED  — a middleware function threw or rejected
 *   MIDDLEWARE_ERROR   — catch-all for unexpected failures
 *
 * Design rules (consistent with Pipeline and HttpInterceptor):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - execute() is async; all other public methods are synchronous.
 *   - size(), clear(), and list() never fail.
 *   - execute() shallow-clones the caller's context before passing it to the
 *     first middleware; the original is never mutated.
 *   - All middleware share the SAME cloned context object; mutations made
 *     by one middleware are visible to subsequent middleware.
 *   - The final context (after all middleware have completed) is
 *     shallow-cloned before being returned as { ok: true, value }.
 *   - execute() stops immediately when any middleware throws or rejects;
 *     remaining middleware that have not yet started do not run.
 *   - Middleware that does not call next() short-circuits the chain;
 *     subsequent middleware are skipped but execute() still returns
 *     { ok: true, value } with the current context state.
 *   - add() returns the insertion index so callers can remove the middleware
 *     later via remove().  Note: indices shift after any remove() call.
 *   - list() returns fresh { index } objects in a fresh array; mutations do
 *     not affect the chain.
 *   - SSR-compatible: no browser APIs, no timers, no DOM.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type MiddlewareErrorCode =
  | 'INVALID_MIDDLEWARE'  // add() received a non-function
  | 'INDEX_OUT_OF_RANGE'  // remove(index) out of bounds
  | 'MIDDLEWARE_FAILED'   // a middleware threw or rejected
  | 'MIDDLEWARE_ERROR';   // catch-all

export interface MiddlewareError {
  code:    MiddlewareErrorCode;
  message: string;
}

export type MiddlewareResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: MiddlewareError };

// ─── Context and function types ───────────────────────────────────────────────

/** Shared mutable state passed through the middleware chain. */
export type MiddlewareContext = Record<string, unknown>;

/**
 * A middleware function.  Receives the shared context and a next() function.
 * May be sync or async.  Calling next() advances to the next middleware;
 * not calling it short-circuits the chain.
 */
export type MiddlewareFn = (
  context: MiddlewareContext,
  next:    () => Promise<void>,
) => void | Promise<void>;

// ─── Middleware metadata (returned by list()) ─────────────────────────────────

/** Read-only metadata about a registered middleware returned by list(). */
export interface MiddlewareEntry {
  readonly index: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function mwErr(
  code:    MiddlewareErrorCode,
  message: string,
): MiddlewareResult<never> {
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

// ─── MiddlewareChain ──────────────────────────────────────────────────────────

export class MiddlewareChain {
  private readonly middlewares: MiddlewareFn[] = [];

  // ── add ───────────────────────────────────────────────────────────────────

  /**
   * Appends `fn` to the end of the chain.
   * Returns { ok: true, value: index } where `index` is the zero-based
   * position at which the middleware was inserted.
   * Returns INVALID_MIDDLEWARE when `fn` is not a function.
   * Never throws.
   */
  add(fn: MiddlewareFn): MiddlewareResult<number> {
    if (typeof fn !== 'function') {
      return mwErr(
        'INVALID_MIDDLEWARE',
        `add() requires a callable function; received: ${typeof fn}.`,
      );
    }
    this.middlewares.push(fn);
    return { ok: true, value: this.middlewares.length - 1 };
  }

  // ── remove ────────────────────────────────────────────────────────────────

  /**
   * Removes the middleware at position `index`.
   * Returns { ok: true } when the middleware is found and removed.
   * Returns INDEX_OUT_OF_RANGE when `index` is negative, non-integer, or
   * greater than or equal to size().
   * Never throws.
   *
   * Note: removing a middleware shifts all subsequent indices down by one.
   */
  remove(index: number): MiddlewareResult<void> {
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.middlewares.length
    ) {
      return mwErr(
        'INDEX_OUT_OF_RANGE',
        `remove() index ${String(index)} is out of range; ` +
          `${this.middlewares.length} middleware(s) registered.`,
      );
    }
    this.middlewares.splice(index, 1);
    return { ok: true, value: undefined };
  }

  // ── execute ───────────────────────────────────────────────────────────────

  /**
   * Runs all registered middleware against a shallow clone of `context`.
   *
   * Middleware are called in registration order via a recursive next() chain.
   * All middleware share the same cloned context object; mutations accumulate.
   * The final context state is shallow-cloned before being returned.
   *
   * Returns { ok: true, value: finalContext } when the chain completes
   * normally (even if some middleware skipped calling next()).
   * Returns MIDDLEWARE_FAILED when any middleware throws or rejects.
   * Returns { ok: true, value: clonedInput } immediately with no middleware.
   * Never throws.
   */
  async execute(
    context: MiddlewareContext,
  ): Promise<MiddlewareResult<MiddlewareContext>> {
    const ctx = cloneValue(context);

    const run = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) return;
      await this.middlewares[index](ctx, () => run(index + 1));
    };

    try {
      await run(0);
      return { ok: true, value: cloneValue(ctx) };
    } catch (err) {
      return mwErr('MIDDLEWARE_FAILED', `Middleware threw: ${String(err)}.`);
    }
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of registered middleware functions.
   * Never fails; returns 0 when the chain is empty.
   */
  size(): number {
    return this.middlewares.length;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered middleware without executing them.
   * Never fails.
   */
  clear(): void {
    this.middlewares.length = 0;
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of registered-middleware metadata in order.
   * Each element is a fresh { index } object; the array itself is fresh.
   * Mutations to the returned array or its items do not affect the chain.
   * Never fails; returns [] when the chain is empty.
   */
  list(): MiddlewareEntry[] {
    return this.middlewares.map((_, i) => ({ index: i }));
  }
}
