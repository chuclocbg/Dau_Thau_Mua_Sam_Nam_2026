/**
 * P6-11D: ConfigStore — in-process configuration key-value store.
 *
 * String keys only.  Values are arbitrary (typed as unknown/T).
 * No expiry, no persistence, no size cap — a simple store for runtime
 * configuration with ordered key listing and defensive read semantics.
 *
 * Public API:
 *   set(key, value)  — insert or overwrite; preserves insertion position on overwrite
 *   get(key)         — return a defensive copy; KEY_NOT_FOUND when absent
 *   has(key)         — check existence; never fails
 *   delete(key)      — remove a key; succeeds silently for unknown keys
 *   clear()          — remove all entries; never fails
 *   listKeys()       — return all keys in insertion order as a defensive copy
 *
 * Error codes:
 *   INVALID_KEY    — empty or non-string key
 *   KEY_NOT_FOUND  — get() on an absent key
 *   CONFIG_ERROR   — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - Insertion order: Map guarantees that key order is preserved.
 *     Overwriting an existing key does NOT change its position in listKeys().
 *     A key re-added after deletion is appended to the end.
 *   - Defensive copies: values are shallow-cloned at write time (set) and
 *     again at read time (get).  listKeys() returns a fresh array each call.
 *   - delete(), clear(), has(), listKeys() never fail.
 *   - SSR-compatible: no browser APIs, no Date.now(), no timers.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type ConfigErrorCode =
  | 'INVALID_KEY'    // empty or non-string key
  | 'KEY_NOT_FOUND'  // get() on a key that is not in the store
  | 'CONFIG_ERROR';  // catch-all for unexpected failures

export interface ConfigError {
  code:    ConfigErrorCode;
  message: string;
}

export type ConfigResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ConfigError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function configErr(code: ConfigErrorCode, message: string): ConfigResult<never> {
  return { ok: false, error: { code, message } };
}

function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0;
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, and
 * undefined as-is.  Consistent with CacheStore and MemoryStore patterns.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── ConfigStore ──────────────────────────────────────────────────────────────

export class ConfigStore {
  private readonly store: Map<string, unknown> = new Map();

  // ── set ─────────────────────────────────────────────────────────────────────

  /**
   * Inserts or overwrites `key` with `value`.
   *
   * When the key already exists its position in listKeys() is preserved
   * (Map semantics: re-setting an existing key does not reorder it).
   * The value is shallow-cloned at write time.
   *
   * Returns INVALID_KEY for empty or non-string keys.
   */
  set<T = unknown>(key: string, value: T): ConfigResult<void> {
    if (!isValidKey(key)) {
      return configErr('INVALID_KEY',
        `Config key must be a non-empty string; received: ${String(key)}.`);
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
  get<T = unknown>(key: string): ConfigResult<T> {
    if (!isValidKey(key)) {
      return configErr('INVALID_KEY',
        `Config key must be a non-empty string; received: ${String(key)}.`);
    }

    if (!this.store.has(key)) {
      return configErr('KEY_NOT_FOUND',
        `No config entry found for key "${key}".`);
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

  // ── listKeys ─────────────────────────────────────────────────────────────────

  /**
   * Returns all keys in insertion order as a defensive copy of the key array.
   * Overwriting an existing key does not change its position.
   * A key re-added after deletion appears at the end.
   * Never fails; returns [] when the store is empty.
   */
  listKeys(): string[] {
    return Array.from(this.store.keys());
  }
}
