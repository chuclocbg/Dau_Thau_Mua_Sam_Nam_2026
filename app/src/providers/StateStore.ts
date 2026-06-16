/**
 * P6-11F: StateStore — in-process key-value state store with full snapshots.
 *
 * String keys only.  Values are arbitrary (typed as unknown/T).
 * No expiry, no persistence, no size cap.  Designed for holding runtime
 * application state that must be observable as a whole via snapshot().
 *
 * Public API:
 *   set(key, value)  — insert or overwrite; preserves insertion position on overwrite
 *   get(key)         — return a defensive copy; KEY_NOT_FOUND when absent
 *   has(key)         — check existence; never fails
 *   delete(key)      — remove a key; succeeds silently for unknown keys
 *   clear()          — remove all entries; never fails
 *   snapshot()       — return a full defensive copy of the current store state
 *
 * Error codes:
 *   INVALID_KEY    — empty or non-string key
 *   KEY_NOT_FOUND  — get() on an absent key
 *   STATE_ERROR    — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - Insertion order: Map guarantees that key order is preserved.
 *     Overwriting an existing key does NOT change its position in snapshot().
 *   - Defensive copies at write time (set) and at read time (get, snapshot).
 *     snapshot() returns a fresh StateSnapshot with shallow-cloned values.
 *   - delete(), clear(), has(), snapshot() never fail.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── StateSnapshot ────────────────────────────────────────────────────────────

/**
 * A point-in-time copy of the entire store.
 * Returned by snapshot(); independent of the live store.
 */
export interface StateSnapshot {
  /** All entries in insertion order with shallow-cloned values. */
  entries: Array<{ key: string; value: unknown }>;
  /** Total number of entries at snapshot time. */
  size: number;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type StateErrorCode =
  | 'INVALID_KEY'    // empty or non-string key
  | 'KEY_NOT_FOUND'  // get() on a key that is not in the store
  | 'STATE_ERROR';   // catch-all for unexpected failures

export interface StateError {
  code:    StateErrorCode;
  message: string;
}

export type StateResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: StateError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function stateErr(code: StateErrorCode, message: string): StateResult<never> {
  return { ok: false, error: { code, message } };
}

function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0;
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, and
 * undefined as-is.  Consistent with CacheStore, ConfigStore, MemoryStore.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── StateStore ───────────────────────────────────────────────────────────────

export class StateStore {
  private readonly store: Map<string, unknown> = new Map();

  // ── set ─────────────────────────────────────────────────────────────────────

  /**
   * Inserts or overwrites `key` with `value`.
   *
   * When the key already exists its position in snapshot().entries is preserved
   * (Map semantics: re-setting an existing key does not reorder it).
   * The value is shallow-cloned at write time.
   *
   * Returns INVALID_KEY for empty or non-string keys.
   */
  set<T = unknown>(key: string, value: T): StateResult<void> {
    if (!isValidKey(key)) {
      return stateErr('INVALID_KEY',
        `State key must be a non-empty string; received: ${String(key)}.`);
    }

    this.store.set(key, cloneValue(value));
    return { ok: true, value: undefined };
  }

  // ── get ─────────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of the stored value for `key`.
   *
   * Returns INVALID_KEY for empty or non-string keys.
   * Returns KEY_NOT_FOUND when the key is absent.
   */
  get<T = unknown>(key: string): StateResult<T> {
    if (!isValidKey(key)) {
      return stateErr('INVALID_KEY',
        `State key must be a non-empty string; received: ${String(key)}.`);
    }

    if (!this.store.has(key)) {
      return stateErr('KEY_NOT_FOUND',
        `No state entry found for key "${key}".`);
    }

    return { ok: true, value: cloneValue(this.store.get(key)) as T };
  }

  // ── has ─────────────────────────────────────────────────────────────────────

  /**
   * Returns true when `key` exists in the store; false otherwise.
   * Never fails; returns false for any invalid key.
   */
  has(key: string): boolean {
    if (!isValidKey(key)) return false;
    return this.store.has(key);
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  /**
   * Removes `key` from the store.
   * Succeeds silently when the key is absent or the key argument is invalid.
   * Never fails.
   */
  delete(key: string): void {
    if (typeof key !== 'string') return;
    this.store.delete(key);
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * Removes all entries.  Never fails.
   */
  clear(): void {
    this.store.clear();
  }

  // ── snapshot ─────────────────────────────────────────────────────────────────

  /**
   * Returns a full defensive copy of the current store state.
   *
   * The returned StateSnapshot is independent of the live store:
   *   - Its entries array is a fresh array.
   *   - Each entry object is a fresh { key, value } plain object.
   *   - Values are shallow-cloned (same semantics as get()).
   *
   * Mutations to the snapshot (adding/removing entries, changing values)
   * have no effect on the store.  Never fails; returns size:0 on empty store.
   */
  snapshot(): StateSnapshot {
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of this.store) {
      entries.push({ key, value: cloneValue(value) });
    }
    return { entries, size: entries.length };
  }
}
