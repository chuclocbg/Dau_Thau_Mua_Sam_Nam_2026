// ── Storage audit event types ─────────────────────────────────────────────────
// Append-only. No update, no delete.

export const STORAGE_AUDIT_EVENT_TYPES = [
  // Object lifecycle
  'OBJECT_UPLOADED',
  'OBJECT_DOWNLOADED',
  'OBJECT_DELETED',
  'OBJECT_COPIED',
  'OBJECT_VERSION_CREATED',
  'OBJECT_SOFT_DELETED',
  // Upload sessions
  'UPLOAD_INITIATED',
  'UPLOAD_CHUNK_RECEIVED',
  'UPLOAD_COMPLETED',
  'UPLOAD_ABORTED',
  // Virus scan
  'SCAN_CLEAN',
  'SCAN_INFECTED',
  'SCAN_ERROR',
  // Attachment references
  'ATTACHMENT_LINKED',
  'ATTACHMENT_DEACTIVATED',
  // Signed URLs
  'SIGNED_URL_GENERATED',
  'SIGNED_URL_ACCESSED',
  // Retention & legal hold
  'RETENTION_POLICY_APPLIED',
  'LEGAL_HOLD_PLACED',
  'LEGAL_HOLD_RELEASED',
  'OBJECT_PURGED',
  // Access control
  'ACCESS_DENIED',
] as const
export type StorageAuditEventType = typeof STORAGE_AUDIT_EVENT_TYPES[number]

export const STORAGE_AUDIT_OUTCOMES = ['SUCCESS', 'FAILURE'] as const
export type StorageAuditOutcome = typeof STORAGE_AUDIT_OUTCOMES[number]

// ── StorageAuditEvent — append-only; no updatedAt ────────────────────────────

export interface StorageAuditEvent {
  readonly id: string
  readonly eventType: StorageAuditEventType
  readonly objectKey?: string
  readonly objectId?: string
  readonly attachmentId?: string
  readonly uploadSessionId?: string
  readonly userId: string              // acting user
  readonly moduleType?: string
  readonly moduleId?: string
  readonly outcome: StorageAuditOutcome
  readonly reason?: string
  readonly sizeBytes?: bigint
  readonly checksum?: string
  readonly metadata: Readonly<Record<string, string>>
  readonly occurredAt: string          // ISO 8601
  readonly createdAt: string           // ISO 8601
}

// ── IStorageAuditRepository — append-only ─────────────────────────────────────

export interface IStorageAuditRepository {
  append(event: Omit<StorageAuditEvent, 'id' | 'createdAt'>): Promise<StorageAuditEvent>
  findById(id: string): Promise<StorageAuditEvent | null>
  findByObjectKey(objectKey: string, limit?: number): Promise<readonly StorageAuditEvent[]>
  findByObjectId(objectId: string, limit?: number): Promise<readonly StorageAuditEvent[]>
  findByUserId(userId: string, limit?: number): Promise<readonly StorageAuditEvent[]>
  findByModule(moduleType: string, moduleId: string, limit?: number): Promise<readonly StorageAuditEvent[]>
  findByEventType(type: StorageAuditEventType, limit?: number): Promise<readonly StorageAuditEvent[]>
  findByTimeRange(from: string, to: string, limit?: number): Promise<readonly StorageAuditEvent[]>
  count(): Promise<number>
}
