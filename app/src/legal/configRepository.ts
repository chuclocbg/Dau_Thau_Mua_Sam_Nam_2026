/**
 * Phase 11.5.2 — Configuration Repository
 *
 * Storage abstraction for GovernanceConfig objects.
 * The ConfigRepository interface is the single contract — any storage backend
 * (in-memory JSON, SQLite, PostgreSQL, API, Knowledge Service) implements it.
 *
 * ConfigRepository API:
 *   add(config)          — store one config; throws on duplicate id
 *   getById(id)          — O(1) lookup by id
 *   getByType(type)      — all configs of a given ConfigType
 *   getAll()             — all configs in the repository
 *   getActive()          — all configs with status === 'ACTIVE'
 *   getEffectiveOn(date) — configs whose date range includes `date`
 *                          (effectiveDate <= date < expiredDate;
 *                           no expiredDate = open-ended)
 *   remove(id)           — returns true if found and removed
 *
 * createInMemoryRepository() is the current implementation.
 * Future implementations (SQLite, REST) replace only this factory — all
 * callers (ConfigResolver, ConfigValidator) depend on the interface only.
 *
 * Validation (duplicate detection, overlapping dates, orphan checks) is the
 * responsibility of configValidator.ts, not the repository.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { ConfigType, GovernanceConfig } from './governanceConfig';

// ─── Repository interface ─────────────────────────────────────────────────────

export interface ConfigRepository {
  /** Stores config. Throws if a config with the same id already exists. */
  add(config: GovernanceConfig): void;
  /** Returns the config for this id, or undefined if not found. */
  getById(id: string): GovernanceConfig | undefined;
  /** Returns all configs with the given type. */
  getByType(type: ConfigType): readonly GovernanceConfig[];
  /** Returns all stored configs. */
  getAll(): readonly GovernanceConfig[];
  /** Returns all configs with status === 'ACTIVE'. */
  getActive(): readonly GovernanceConfig[];
  /**
   * Returns all configs where effectiveDate <= date AND
   * (no expiredDate OR expiredDate > date).
   * Note: expiredDate is exclusive — config is NOT effective on expiredDate.
   */
  getEffectiveOn(date: string): readonly GovernanceConfig[];
  /** Removes the config with this id. Returns true if removed. */
  remove(id: string): boolean;
}

// ─── In-memory implementation ─────────────────────────────────────────────────

/**
 * Creates a mutable in-memory ConfigRepository backed by a Map.
 * Returns an object implementing ConfigRepository; no class inheritance used.
 *
 * @param initial  Optional seed data. Throws on duplicate id in seed.
 */
export function createInMemoryRepository(
  initial?: readonly GovernanceConfig[],
): ConfigRepository {
  const store = new Map<string, GovernanceConfig>();

  if (initial) {
    for (const c of initial) {
      if (store.has(c.id)) {
        throw new Error(`Duplicate config id in initial data: "${c.id}"`);
      }
      store.set(c.id, c);
    }
  }

  return {
    add(config: GovernanceConfig): void {
      if (store.has(config.id)) {
        throw new Error(`Duplicate config id: "${config.id}"`);
      }
      store.set(config.id, config);
    },

    getById(id: string): GovernanceConfig | undefined {
      return store.get(id);
    },

    getByType(type: ConfigType): readonly GovernanceConfig[] {
      return Object.freeze([...store.values()].filter(c => c.type === type));
    },

    getAll(): readonly GovernanceConfig[] {
      return Object.freeze([...store.values()]);
    },

    getActive(): readonly GovernanceConfig[] {
      return Object.freeze([...store.values()].filter(c => c.status === 'ACTIVE'));
    },

    getEffectiveOn(date: string): readonly GovernanceConfig[] {
      return Object.freeze(
        [...store.values()].filter(c =>
          c.effectiveDate <= date &&
          (!c.expiredDate || c.expiredDate > date)
        )
      );
    },

    remove(id: string): boolean {
      return store.delete(id);
    },
  };
}
