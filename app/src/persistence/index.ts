/**
 * P6-08A: Persistence layer — public API barrel.
 *
 * Import from this path rather than directly from schema.ts so that
 * future milestones (P6-08B store implementations, P6-08C migration runner)
 * can be added here without changing call sites.
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
