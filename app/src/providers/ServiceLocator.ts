/**
 * P6-12J: ServiceLocator — string-keyed service registry.
 *
 * Services are arbitrary values (objects, functions, primitives, null) bound
 * to string names.  Names are validated separately from values, so any value
 * including null and undefined is a valid service.  The registry prevents
 * duplicate names and returns typed errors on every failure path.
 *
 * Compared to the related modules:
 *   - ConfigStore     — set() overwrites duplicates silently; delete() is
 *                       silent for unknown keys; stores configuration scalars.
 *   - PluginManager   — register(plugin) combines name+descriptor in one
 *                       argument; stores structured plugin objects only.
 *   - ServiceLocator  — register(name, service) separates name from value;
 *                       stores any value; resolve()/unregister() return errors
 *                       for unknown names; duplicates are rejected.
 *
 * Public API:
 *   register(name, service) — validate name, store service, return ServiceEntry
 *   unregister(name)        — remove a service by name
 *   resolve(name)           — return a defensive copy of a stored service
 *   has(name)               — synchronous existence check; never fails
 *   size()                  — number of registered services; never fails
 *   clear()                 — remove all services; never fails
 *   list()                  — defensive snapshot of all entries; never fails
 *
 * Error codes:
 *   INVALID_NAME       — name is null, non-string, or empty/whitespace-only
 *   DUPLICATE_SERVICE  — register() called with an already-registered name
 *   SERVICE_NOT_FOUND  — resolve() or unregister() called with unknown name
 *   SERVICE_ERROR      — catch-all for unexpected failures
 *
 * Design rules (consistent with PluginManager and ConfigStore):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - All methods are synchronous; no async API.
 *   - has(), size(), clear(), and list() never fail.
 *   - Any value (including null and undefined) is a valid service.
 *   - register() shallow-clones the service before storing; cloneValue()
 *     passes through primitives, null, undefined, and functions as-is.
 *   - register() returns a ServiceEntry with a defensive copy of the service.
 *   - resolve() returns a fresh defensive copy on every call.
 *   - list() returns a fresh array of fresh ServiceEntry objects;
 *     mutations do not affect the registry.
 *   - Insertion order is preserved; list() returns entries in registration order.
 *   - SSR-compatible: no browser APIs, no timers, no DOM.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type ServiceErrorCode =
  | 'INVALID_NAME'       // name is not a non-empty string
  | 'DUPLICATE_SERVICE'  // name already in the registry
  | 'SERVICE_NOT_FOUND'  // unknown name passed to resolve() or unregister()
  | 'SERVICE_ERROR';     // catch-all

export interface ServiceError {
  code:    ServiceErrorCode;
  message: string;
}

export type ServiceResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ServiceError };

// ─── Service entry ────────────────────────────────────────────────────────────

/** A name–value pair returned by register(), resolve(), and list(). */
export interface ServiceEntry {
  readonly name:    string;
  readonly service: unknown;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function svcErr(
  code:    ServiceErrorCode,
  message: string,
): ServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function isValidName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0;
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, undefined,
 * and functions as-is.  Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── ServiceLocator ───────────────────────────────────────────────────────────

export class ServiceLocator {
  private readonly registry = new Map<string, unknown>();

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Validates `name`, shallow-clones `service`, and stores the pair.
   *
   * Returns { ok: true, value: ServiceEntry } with a defensive copy of the
   * stored entry on success.
   * Returns INVALID_NAME when `name` is null, non-string, or empty/whitespace.
   * Returns DUPLICATE_SERVICE when `name` is already registered.
   * Any value (including null, undefined, functions) is a valid `service`.
   * Never throws.
   */
  register(name: string, service: unknown): ServiceResult<ServiceEntry> {
    if (!isValidName(name)) {
      return svcErr(
        'INVALID_NAME',
        `register() requires a non-empty string name; received: ${
          name === null ? 'null' : typeof name
        }.`,
      );
    }
    if (this.registry.has(name)) {
      return svcErr(
        'DUPLICATE_SERVICE',
        `A service named "${name}" is already registered.`,
      );
    }
    const stored = cloneValue(service);
    this.registry.set(name, stored);
    return { ok: true, value: { name, service: cloneValue(stored) } };
  }

  // ── unregister ────────────────────────────────────────────────────────────

  /**
   * Removes the service bound to `name`.
   * Returns { ok: true } when the service is found and removed.
   * Returns SERVICE_NOT_FOUND when no service with that name exists.
   * Never throws.
   */
  unregister(name: string): ServiceResult<void> {
    if (!this.registry.has(name)) {
      return svcErr(
        'SERVICE_NOT_FOUND',
        `No service named "${String(name)}" is registered.`,
      );
    }
    this.registry.delete(name);
    return { ok: true, value: undefined };
  }

  // ── resolve ───────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of the service bound to `name`.
   * Primitives, null, undefined, and functions are returned as-is;
   * objects and arrays are shallow-cloned.
   * Returns SERVICE_NOT_FOUND when no service with that name exists.
   * Never throws.
   */
  resolve(name: string): ServiceResult<unknown> {
    if (!this.registry.has(name)) {
      return svcErr(
        'SERVICE_NOT_FOUND',
        `No service named "${String(name)}" is registered.`,
      );
    }
    return { ok: true, value: cloneValue(this.registry.get(name)) };
  }

  // ── has ───────────────────────────────────────────────────────────────────

  /**
   * Returns true when a service with the given `name` is registered.
   * Never throws; returns false for any unregistered or invalid name.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of registered services.
   * Never fails; returns 0 when the registry is empty.
   */
  size(): number {
    return this.registry.size;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered services.
   * Never fails.
   */
  clear(): void {
    this.registry.clear();
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of all registered services in insertion order.
   * Each ServiceEntry is a fresh object with a fresh defensive copy of its service.
   * The array itself is fresh; mutations do not affect the registry.
   * Never fails; returns [] when the registry is empty.
   */
  list(): ServiceEntry[] {
    return Array.from(this.registry.entries()).map(([name, svc]) => ({
      name,
      service: cloneValue(svc),
    }));
  }
}
