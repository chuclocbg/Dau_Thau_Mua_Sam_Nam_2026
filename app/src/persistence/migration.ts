/**
 * P6-08C: Schema migration runner.
 *
 * Provides:
 *   MigrationErrorCode   — discriminant union for all failure reasons
 *   MigrationError       — typed Error subclass carrying code + version context
 *   MigrationRegistry    — registry of SchemaMigration steps, chain builder
 *   runMigration<T>      — core migration pipeline (pure function, no I/O)
 *   migrateSession       — typed convenience wrapper for PersistedSession
 *   migrateTrace         — typed convenience wrapper for PersistedTrace
 *   migrateSnapshot      — typed convenience wrapper for ExportSnapshot
 *
 * Design rules:
 *   - runMigration is a pure function — it only transforms the data it receives.
 *     Persisting the migrated record back to storage is the caller's job.
 *   - Downgrade attempts (record newer than running code) always throw immediately
 *     before any migration step runs.
 *   - Pre-condition: input must be a non-null object with a numeric schemaVersion.
 *   - Post-condition: the returned value passes the caller-supplied type guard.
 *   - Validation runs only on the final result (after all steps complete) so
 *     intermediate states are allowed to violate the target type guard.
 *   - The original input record is never mutated; each migration step receives
 *     the output of the previous step.
 */

import {
  PERSISTENCE_SCHEMA_VERSION,
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,
} from './schema';
import type {
  SchemaMigration,
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
} from './schema';

// ─── Error ────────────────────────────────────────────────────────────────────

export type MigrationErrorCode =
  | 'DOWNGRADE'          // record.schemaVersion > targetVersion
  | 'MISSING_STEP'       // no migration registered for a required version gap
  | 'MIGRATION_FAILED'   // the migrate() function threw an error
  | 'VALIDATION_FAILED'; // post-migration type guard returned false

export class MigrationError extends Error {
  readonly code:        MigrationErrorCode;
  readonly fromVersion: number;
  readonly toVersion:   number;
  readonly cause:       unknown;

  constructor(
    code:        MigrationErrorCode,
    fromVersion: number,
    toVersion:   number,
    message:     string,
    cause?:      unknown,
  ) {
    super(message);
    this.name        = 'MigrationError';
    this.code        = code;
    this.fromVersion = fromVersion;
    this.toVersion   = toVersion;
    this.cause       = cause;
  }
}

// ─── MigrationRegistry ────────────────────────────────────────────────────────

/**
 * Registry of SchemaMigration steps indexed by fromVersion.
 *
 * Enforced at registration time:
 *   - toVersion must equal fromVersion + 1 (no version skipping).
 *   - Registering the same fromVersion a second time overwrites the first
 *     (last-write-wins, matching test-fixture override patterns).
 */
export class MigrationRegistry {
  private readonly steps = new Map<number, SchemaMigration>();

  register(migration: SchemaMigration): void {
    if (migration.toVersion !== migration.fromVersion + 1) {
      throw new Error(
        `Invalid migration: toVersion must equal fromVersion + 1 ` +
        `(got ${migration.fromVersion}→${migration.toVersion})`,
      );
    }
    this.steps.set(migration.fromVersion, migration);
  }

  /** Returns true if a migration step is registered from `fromVersion`. */
  has(fromVersion: number): boolean {
    return this.steps.has(fromVersion);
  }

  /**
   * Builds the ordered list of migrations needed to advance a record from
   * `fromVersion` to `toVersion`.  Returns an empty array when they are equal.
   *
   * Throws `MigrationError('MISSING_STEP')` if any intermediate step is absent.
   */
  buildChain(fromVersion: number, toVersion: number): SchemaMigration[] {
    const chain: SchemaMigration[] = [];
    for (let v = fromVersion; v < toVersion; v++) {
      const step = this.steps.get(v);
      if (!step) {
        throw new MigrationError(
          'MISSING_STEP', v, v + 1,
          `No migration registered from version ${v} to ${v + 1}`,
        );
      }
      chain.push(step);
    }
    return chain;
  }
}

// ─── Migration pipeline ───────────────────────────────────────────────────────

/**
 * Core migration runner — pure function, no side-effects.
 *
 * Behaviour by case:
 *   record.schemaVersion === targetVersion → skip all steps, validate, return.
 *   record.schemaVersion  > targetVersion  → throw DOWNGRADE immediately.
 *   record.schemaVersion  < targetVersion  → build chain, execute in order,
 *                                            validate result, return.
 *
 * @param record        Raw (possibly stale) persisted object.
 * @param registry      Registry of migration steps.
 * @param guard         Type guard for the expected output type T.
 * @param targetVersion Version to migrate toward; defaults to PERSISTENCE_SCHEMA_VERSION.
 */
export function runMigration<T>(
  record:        unknown,
  registry:      MigrationRegistry,
  guard:         (obj: unknown) => obj is T,
  targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
): T {
  if (!record || typeof record !== 'object') {
    throw new MigrationError(
      'VALIDATION_FAILED', -1, targetVersion,
      'Input record is not an object',
    );
  }

  const versioned = record as Record<string, unknown>;
  const recordVersion =
    typeof versioned['schemaVersion'] === 'number'
      ? (versioned['schemaVersion'] as number)
      : -1;

  if (recordVersion > targetVersion) {
    throw new MigrationError(
      'DOWNGRADE', recordVersion, targetVersion,
      `Cannot downgrade record from schema v${recordVersion} to v${targetVersion}`,
    );
  }

  if (recordVersion === targetVersion) {
    if (!guard(record)) {
      throw new MigrationError(
        'VALIDATION_FAILED', recordVersion, targetVersion,
        `Record at schema v${recordVersion} failed type guard validation`,
      );
    }
    return record as T;
  }

  // Build the ordered migration chain (may throw MISSING_STEP)
  const chain = registry.buildChain(recordVersion, targetVersion);

  // Execute each step sequentially; each step receives the previous step's output
  let current: unknown = record;
  for (const step of chain) {
    try {
      current = step.migrate(current);
    } catch (err) {
      throw new MigrationError(
        'MIGRATION_FAILED', step.fromVersion, step.toVersion,
        `Migration v${step.fromVersion}→v${step.toVersion} threw: ${String(err)}`,
        err,
      );
    }
  }

  // Validate the final result after all steps complete
  if (!guard(current)) {
    throw new MigrationError(
      'VALIDATION_FAILED', recordVersion, targetVersion,
      `Record failed type guard validation after migration to v${targetVersion}`,
    );
  }

  return current as T;
}

// ─── Typed convenience wrappers ───────────────────────────────────────────────

/** Migrate an unknown record to a validated PersistedSession. */
export function migrateSession(
  record:        unknown,
  registry:      MigrationRegistry,
  targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
): PersistedSession {
  return runMigration(record, registry, isPersistedSession, targetVersion);
}

/** Migrate an unknown record to a validated PersistedTrace. */
export function migrateTrace(
  record:        unknown,
  registry:      MigrationRegistry,
  targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
): PersistedTrace {
  return runMigration(record, registry, isPersistedTrace, targetVersion);
}

/** Migrate an unknown record to a validated ExportSnapshot. */
export function migrateSnapshot(
  record:        unknown,
  registry:      MigrationRegistry,
  targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
): ExportSnapshot {
  return runMigration(record, registry, isExportSnapshot, targetVersion);
}
