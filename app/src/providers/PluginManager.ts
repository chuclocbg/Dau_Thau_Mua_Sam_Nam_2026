/**
 * P6-12I: PluginManager — named plugin registry.
 *
 * Plugins are plain descriptor objects with at least a `name` string.  They
 * are registered by name, looked up by name, and removed by name.  Each
 * registered plugin is stored as a shallow clone so the caller cannot mutate
 * stored data through retained references.  All retrieval methods similarly
 * return clones.
 *
 * This is the primary design distinction from the ordered-list modules
 * (HookManager, Pipeline, MiddlewareChain):
 *   - Those modules — positional (index-based) insertion/removal.
 *   - PluginManager  — named (string-keyed) insertion/removal, O(1) lookup,
 *                      no execute(); the registry is the product.
 *
 * Public API:
 *   register(plugin) — validate, clone, and store a plugin descriptor
 *   unregister(name) — remove the plugin with the given name
 *   get(name)        — return a defensive copy of a registered plugin
 *   has(name)        — synchronous existence check; never fails
 *   size()           — number of registered plugins; never fails
 *   clear()          — remove all plugins; never fails
 *   list()           — defensive snapshot of all plugins; never fails
 *
 * Error codes:
 *   INVALID_PLUGIN   — register() received a non-object, null, array, or a
 *                      plugin whose name is missing or empty
 *   DUPLICATE_PLUGIN — register() called with a name already in the registry
 *   PLUGIN_NOT_FOUND — unregister() or get() called with an unknown name
 *   PLUGIN_ERROR     — catch-all for unexpected failures
 *
 * Design rules (consistent with HookManager and Pipeline):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - All methods are synchronous; no async API.
 *   - has(), size(), clear(), and list() never fail.
 *   - register() shallow-clones the caller's plugin before storing; the
 *     original object is never retained and cannot affect stored state.
 *   - register() returns a defensive copy of the stored plugin descriptor.
 *   - get() returns a fresh shallow clone on every call; no two get() calls
 *     return the same object reference.
 *   - list() returns a fresh array of fresh shallow clones; mutations to the
 *     array or its items do not affect the registry.
 *   - Insertion order is preserved; list() returns plugins in the order they
 *     were registered.
 *   - SSR-compatible: no browser APIs, no timers, no DOM.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type PluginErrorCode =
  | 'INVALID_PLUGIN'    // not an object / missing or empty name
  | 'DUPLICATE_PLUGIN'  // name already registered
  | 'PLUGIN_NOT_FOUND'  // name not in registry
  | 'PLUGIN_ERROR';     // catch-all

export interface PluginError {
  code:    PluginErrorCode;
  message: string;
}

export type PluginResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: PluginError };

// ─── Plugin descriptor ────────────────────────────────────────────────────────

/** Descriptor for a registered plugin. `name` is required; all else is optional. */
export interface PluginInfo {
  readonly name:         string;
  readonly version?:     string;
  readonly description?: string;
  readonly meta?:        Record<string, unknown>;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function pluginErr(
  code:    PluginErrorCode,
  message: string,
): PluginResult<never> {
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

// ─── PluginManager ────────────────────────────────────────────────────────────

export class PluginManager {
  private readonly registry = new Map<string, PluginInfo>();

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Validates, shallow-clones, and stores `plugin` in the registry.
   *
   * Returns { ok: true, value } with a defensive copy of the stored plugin.
   * Returns INVALID_PLUGIN when `plugin` is not a non-null, non-array object
   * or when its `name` field is missing or empty (after trimming).
   * Returns DUPLICATE_PLUGIN when a plugin with the same name already exists.
   * Never throws.
   */
  register(plugin: PluginInfo): PluginResult<PluginInfo> {
    const raw = plugin as unknown;

    if (
      raw === null ||
      raw === undefined ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      return pluginErr(
        'INVALID_PLUGIN',
        `register() requires a non-null, non-array object; received: ${
          raw === null ? 'null' : typeof raw
        }.`,
      );
    }

    const name = (raw as Record<string, unknown>)['name'];
    if (typeof name !== 'string' || name.trim().length === 0) {
      return pluginErr(
        'INVALID_PLUGIN',
        `Plugin must have a non-empty "name" string.`,
      );
    }

    if (this.registry.has(name)) {
      return pluginErr(
        'DUPLICATE_PLUGIN',
        `A plugin named "${name}" is already registered.`,
      );
    }

    const stored = cloneValue(plugin);
    this.registry.set(name, stored);
    return { ok: true, value: cloneValue(stored) };
  }

  // ── unregister ────────────────────────────────────────────────────────────

  /**
   * Removes the plugin with the given `name` from the registry.
   * Returns { ok: true } when the plugin is found and removed.
   * Returns PLUGIN_NOT_FOUND when no plugin with that name exists.
   * Never throws.
   */
  unregister(name: string): PluginResult<void> {
    if (!this.registry.has(name)) {
      return pluginErr('PLUGIN_NOT_FOUND', `No plugin named "${String(name)}" is registered.`);
    }
    this.registry.delete(name);
    return { ok: true, value: undefined };
  }

  // ── get ───────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive shallow clone of the registered plugin.
   * Returns PLUGIN_NOT_FOUND when no plugin with that name exists.
   * Each call returns a fresh object; no two calls return the same reference.
   * Never throws.
   */
  get(name: string): PluginResult<PluginInfo> {
    const stored = this.registry.get(name);
    if (stored === undefined) {
      return pluginErr('PLUGIN_NOT_FOUND', `No plugin named "${String(name)}" is registered.`);
    }
    return { ok: true, value: cloneValue(stored) };
  }

  // ── has ───────────────────────────────────────────────────────────────────

  /**
   * Returns true when a plugin with the given `name` is registered.
   * Never throws; returns false for any unknown or invalid name.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of registered plugins.
   * Never fails; returns 0 when the registry is empty.
   */
  size(): number {
    return this.registry.size;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered plugins.
   * Never fails.
   */
  clear(): void {
    this.registry.clear();
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of all registered plugins in insertion order.
   * Each element is a fresh shallow clone; the array itself is fresh.
   * Mutations to the returned array or its items do not affect the registry.
   * Never fails; returns [] when the registry is empty.
   */
  list(): PluginInfo[] {
    return Array.from(this.registry.values()).map((p) => cloneValue(p));
  }
}
