/**
 * P6-11C: CacheStore — in-process key-value cache with optional TTL.
 *
 * String keys only.  Values are arbitrary (typed as unknown/T).
 * Expired entries are detected and removed automatically on every read.
 * Insertion order is preserved by the underlying Map.
 *
 * Public API:
 *   set(key, value, ttlMs?)  — insert or overwrite an entry
 *   get(key)                 — retrieve a defensive copy; KEY_NOT_FOUND if absent or expired
 *   has(key)                 — check existence; false if expired (auto-removes)
 *   delete(key)              — remove a key; succeeds even if key is absent
 *   clear()                  — remove all entries; never fails
 *   size()                   — count of live (non-expired) entries; auto-removes expired
 *
 * Error codes:
 *   INVALID_KEY    — empty or non-string key
 *   INVALID_TTL    — ttlMs provided but not a positive finite number
 *   KEY_NOT_FOUND  — get() on an absent or expired entry
 *   CACHE_ERROR    — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - Defensive copies: values are shallow-cloned at write time (set) and
 *     again at read time (get) so neither the caller's input nor returned
 *     values can mutate the internal store.
 *   - delete(), clear(), has(), size() never fail.
 *   - SSR-compatible: no browser APIs; Date.now() is the only external call.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type CacheErrorCode =
  | 'INVALID_KEY'    // empty or non-string key
  | 'INVALID_TTL'    // ttlMs is not a positive finite number
  | 'KEY_NOT_FOUND'  // key absent from store or entry has expired
  | 'CACHE_ERROR';   // catch-all for unexpected failures

export interface CacheError {
  code:    CacheErrorCode;
  message: string;
}

export type CacheResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: CacheError };

// ─── Private types ────────────────────────────────────────────────────────────

interface CacheEntry {
  value:     unknown;
  /** Unix-ms deadline, or null if the entry never expires. */
  expiresAt: number | null;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function cacheErr(code: CacheErrorCode, message: string): CacheResult<never> {
  return { ok: false, error: { code, message } };
}

function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0;
}

function isExpired(entry: CacheEntry): boolean {
  if (entry.expiresAt === null) return false;
  return Date.now() >= entry.expiresAt;
}

/**
 * Shallow-clones objects and arrays; returns primitives and null/undefined
 * as-is.  This is consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── CacheStore ───────────────────────────────────────────────────────────────

export class CacheStore {
  private readonly store: Map<string, CacheEntry> = new Map();

  // ── set ─────────────────────────────────────────────────────────────────────

  /**
   * Inserts or overwrites `key` with `value`.
   *
   * When `ttlMs` is provided it must be a positive finite number; the entry
   * will be treated as expired once Date.now() ≥ (insertion time + ttlMs).
   * Omitting `ttlMs` creates a non-expiring entry (existing TTL is cleared
   * when overwriting).
   *
   * Returns INVALID_KEY for empty or non-string keys.
   * Returns INVALID_TTL when ttlMs is present but ≤ 0, non-finite, or NaN.
   * Shallow-clones the value at write time.
   */
  set<T = unknown>(key: string, value: T, ttlMs?: number): CacheResult<void> {
    if (!isValidKey(key)) {
      return cacheErr('INVALID_KEY',
        `Cache key must be a non-empty string; received: ${String(key)}.`);
    }

    if (ttlMs !== undefined) {
      if (
        typeof ttlMs !== 'number' ||
        !Number.isFinite(ttlMs)   ||
        ttlMs <= 0
      ) {
        return cacheErr('INVALID_TTL',
          `ttlMs must be a positive finite number; received: ${String(ttlMs)}.`);
      }
    }

    const expiresAt: number | null =
      ttlMs !== undefined ? Date.now() + ttlMs : null;

    this.store.set(key, {
      value:     cloneValue(value),
      expiresAt,
    });

    return { ok: true, value: undefined };
  }

  // ── get ─────────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of the stored value for `key`.
   *
   * If the entry has expired it is removed from the store and
   * KEY_NOT_FOUND is returned (same result as for an absent key).
   *
   * Returns INVALID_KEY for empty or non-string keys.
   * Returns KEY_NOT_FOUND when the key is absent or expired.
   */
  get<T = unknown>(key: string): CacheResult<T> {
    if (!isValidKey(key)) {
      return cacheErr('INVALID_KEY',
        `Cache key must be a non-empty string; received: ${String(key)}.`);
    }

    const entry = this.store.get(key);

    if (entry === undefined) {
      return cacheErr('KEY_NOT_FOUND',
        `No cache entry found for key "${key}".`);
    }

    if (isExpired(entry)) {
      this.store.delete(key); // auto-remove
      return cacheErr('KEY_NOT_FOUND',
        `Cache entry for key "${key}" has expired.`);
    }

    return { ok: true, value: cloneValue(entry.value) as T };
  }

  // ── has ─────────────────────────────────────────────────────────────────────

  /**
   * Returns true when `key` exists and has not expired; false otherwise.
   * Expired entries are removed from the store during this check.
   * Never fails; returns false for any invalid key.
   */
  has(key: string): boolean {
    if (typeof key !== 'string' || key.length === 0) return false;

    const entry = this.store.get(key);
    if (entry === undefined) return false;

    if (isExpired(entry)) {
      this.store.delete(key); // auto-remove
      return false;
    }

    return true;
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  /**
   * Removes `key` from the store.
   * Succeeds silently when the key is absent or invalid.
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

  // ── size ─────────────────────────────────────────────────────────────────────

  /**
   * Returns the count of live (non-expired) entries.
   * Expired entries encountered during the count are removed.
   * Never fails; returns 0 when the store is empty.
   */
  size(): number {
    const toDelete: string[] = [];
    let count = 0;

    for (const [key, entry] of this.store) {
      if (isExpired(entry)) {
        toDelete.push(key);
      } else {
        count++;
      }
    }

    for (const key of toDelete) {
      this.store.delete(key);
    }

    return count;
  }
}
