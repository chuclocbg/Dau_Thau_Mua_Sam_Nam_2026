/**
 * P6-08C: Migrate-on-read decorator stores.
 *
 * Each class wraps an existing ISessionStore / ITraceStore / IExportStore and
 * intercepts load*() calls.  If the returned record has a stale schemaVersion,
 * the decorator automatically:
 *   1. Runs the migration pipeline via runMigration.
 *   2. Writes the migrated record back to the inner store (upgrade-in-place).
 *   3. Returns the up-to-date record to the caller.
 *
 * Records at the current version are returned immediately without any overhead.
 * Records newer than targetVersion (downgrade) surface as MigrationError so the
 * caller can handle the incompatibility.
 *
 * Write / delete / list operations are passed through to the inner store unchanged.
 *
 * IndexedDB note: the decorator wraps any ISessionStore / ITraceStore / IExportStore
 * implementation and does not depend on the concrete InMemory* classes.  The same
 * decorator will work transparently once an IndexedDB backend is introduced.
 */

import {
  PERSISTENCE_SCHEMA_VERSION,
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,
} from './schema';
import type {
  ISessionStore,
  ITraceStore,
  IExportStore,
  IPersistenceLayer,
  PersistedSession,
  PersistedTrace,
  ExportSnapshot,
} from './schema';
import { MigrationRegistry, runMigration } from './migration';
import { createInMemoryPersistenceLayer } from './memory';

// ─── MigratingSessionStore ────────────────────────────────────────────────────

export class MigratingSessionStore implements ISessionStore {
  constructor(
    private readonly inner:         ISessionStore,
    private readonly registry:      MigrationRegistry,
    private readonly targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
  ) {}

  async saveSession(session: PersistedSession): Promise<void> {
    return this.inner.saveSession(session);
  }

  async loadSession(sessionId: string): Promise<PersistedSession | null> {
    const raw = await this.inner.loadSession(sessionId);
    if (raw === null) return null;
    if (raw.schemaVersion === this.targetVersion) return raw;
    const migrated = runMigration(raw, this.registry, isPersistedSession, this.targetVersion);
    await this.inner.saveSession(migrated);
    return migrated;
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.inner.deleteSession(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return this.inner.listSessions();
  }
}

// ─── MigratingTraceStore ──────────────────────────────────────────────────────

export class MigratingTraceStore implements ITraceStore {
  constructor(
    private readonly inner:         ITraceStore,
    private readonly registry:      MigrationRegistry,
    private readonly targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
  ) {}

  async saveTrace(trace: PersistedTrace): Promise<void> {
    return this.inner.saveTrace(trace);
  }

  async loadTrace(traceId: string): Promise<PersistedTrace | null> {
    const raw = await this.inner.loadTrace(traceId);
    if (raw === null) return null;
    if (raw.schemaVersion === this.targetVersion) return raw;
    const migrated = runMigration(raw, this.registry, isPersistedTrace, this.targetVersion);
    await this.inner.saveTrace(migrated);
    return migrated;
  }

  async deleteTrace(traceId: string): Promise<void> {
    return this.inner.deleteTrace(traceId);
  }

  async listTraces(): Promise<string[]> {
    return this.inner.listTraces();
  }
}

// ─── MigratingExportStore ─────────────────────────────────────────────────────

export class MigratingExportStore implements IExportStore {
  constructor(
    private readonly inner:         IExportStore,
    private readonly registry:      MigrationRegistry,
    private readonly targetVersion: number = PERSISTENCE_SCHEMA_VERSION,
  ) {}

  async saveSnapshot(snapshot: ExportSnapshot): Promise<void> {
    return this.inner.saveSnapshot(snapshot);
  }

  async loadSnapshot(snapshotId: string): Promise<ExportSnapshot | null> {
    const raw = await this.inner.loadSnapshot(snapshotId);
    if (raw === null) return null;
    if (raw.schemaVersion === this.targetVersion) return raw;
    const migrated = runMigration(raw, this.registry, isExportSnapshot, this.targetVersion);
    await this.inner.saveSnapshot(migrated);
    return migrated;
  }

  async listSnapshots(): Promise<string[]> {
    return this.inner.listSnapshots();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an IPersistenceLayer where each store automatically migrates stale
 * records on load and writes the migrated record back to the inner store.
 *
 * @param registry - Migration step registry.  Pass `new MigrationRegistry()`
 *                   when no migrations exist yet (schema is still at v1).
 * @param inner    - Optional inner persistence layer.  Defaults to a fresh
 *                   in-memory layer.  Pass a custom layer to wrap an IndexedDB
 *                   or file-system backend once it is implemented.
 */
export function createMigratingPersistenceLayer(
  registry: MigrationRegistry,
  inner:    IPersistenceLayer = createInMemoryPersistenceLayer(),
): IPersistenceLayer {
  return {
    sessions: new MigratingSessionStore(inner.sessions, registry),
    traces:   new MigratingTraceStore(inner.traces,     registry),
    exports:  new MigratingExportStore(inner.exports,   registry),
  };
}
