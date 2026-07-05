// ── Notification audit event types ────────────────────────────────────────────
// Append-only. No update, no delete.

export const NOTIFICATION_AUDIT_EVENT_TYPES = [
  'NOTIFICATION_CREATED',
  'NOTIFICATION_QUEUED',
  'NOTIFICATION_SCHEDULED',
  'NOTIFICATION_SENT',
  'NOTIFICATION_DELIVERED',
  'NOTIFICATION_FAILED',
  'NOTIFICATION_EXPIRED',
  'NOTIFICATION_CANCELLED',
  'NOTIFICATION_RETRIED',
  'TEMPLATE_RENDERED',
  'BATCH_CREATED',
  'BATCH_COMPLETED',
  'RULE_TRIGGERED',
  'PREFERENCE_UPDATED',
  'EVENT_RECEIVED',
] as const
export type NotificationAuditEventType = typeof NOTIFICATION_AUDIT_EVENT_TYPES[number]

export const NOTIFICATION_AUDIT_OUTCOMES = ['SUCCESS', 'FAILURE'] as const
export type NotificationAuditOutcome = typeof NOTIFICATION_AUDIT_OUTCOMES[number]

// ── NotificationAuditEvent — append-only; no updatedAt ────────────────────────

export interface NotificationAuditEvent {
  readonly id: string
  readonly eventType: NotificationAuditEventType
  readonly notificationId?: string
  readonly recipientId?: string
  readonly deliveryId?: string
  readonly batchId?: string
  readonly ruleId?: string
  readonly userId: string                              // acting user, or 'system' for automated events
  readonly outcome: NotificationAuditOutcome
  readonly reason?: string
  readonly metadata: Readonly<Record<string, string>>
  readonly occurredAt: string
  readonly createdAt: string
}

// ── INotificationAuditRepository — append-only ────────────────────────────────

export interface INotificationAuditRepository {
  append(event: Omit<NotificationAuditEvent, 'id' | 'createdAt'>): Promise<NotificationAuditEvent>
  findById(id: string): Promise<NotificationAuditEvent | null>
  findByNotificationId(notificationId: string, limit?: number): Promise<readonly NotificationAuditEvent[]>
  findByUserId(userId: string, limit?: number): Promise<readonly NotificationAuditEvent[]>
  findByEventType(type: NotificationAuditEventType, limit?: number): Promise<readonly NotificationAuditEvent[]>
  findByTimeRange(from: string, to: string, limit?: number): Promise<readonly NotificationAuditEvent[]>
  count(): Promise<number>
}
