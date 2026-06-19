/**
 * P6-08A/B/C: Persistence layer — public API barrel.
 *
 * Import from this path rather than directly from the individual modules so
 * that future milestones (alternative backends, additional migrations) can
 * be wired in here without changing call sites.
 */

export {
  PERSISTENCE_SCHEMA_VERSION,

  // Interfaces — storage contracts
  type PersistedMessage,
  type PersistedTrace,
  type PersistedSession,
  type ExportSnapshot,
  type ISessionStore,
  type ITraceStore,
  type IExportStore,
  type IPersistenceLayer,
  type SchemaMigration,

  // Type guards
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,

  // Migration helpers
  needsMigration,
  isNewerSchema,

  // Serializers
  serializeMessage,
  serializeSession,
  serializeTrace,
  createExportSnapshot,
} from './schema';

// ─── P6-08B: In-memory implementations ───────────────────────────────────────

export {
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryExportStore,
  createInMemoryPersistenceLayer,
} from './memory';

// ─── P6-08C: Migration runner ─────────────────────────────────────────────────

export {
  type MigrationErrorCode,
  MigrationError,
  MigrationRegistry,
  runMigration,
  migrateSession,
  migrateTrace,
  migrateSnapshot,
} from './migration';

export {
  MigratingSessionStore,
  MigratingTraceStore,
  MigratingExportStore,
  createMigratingPersistenceLayer,
} from './migrating-stores';

// ─── P9-04: AgentSession store (bounded, SSR-safe) ───────────────────────────

export {
  SESSION_STORE_MAX,
  createAgentSessionStore,
  type AgentSessionStoreOptions,
  type AgentSessionStore,
} from './agentSessionStore';

// ─── P6-08D: IndexedDB adapters ───────────────────────────────────────────────

export {
  type IndexedDbOptions,
  openPersistenceDb,
  IndexedDbSessionStore,
  IndexedDbTraceStore,
  IndexedDbExportStore,
  createIndexedDbPersistenceLayer,
} from './idb-stores';
