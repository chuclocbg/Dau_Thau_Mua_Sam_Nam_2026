import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Channel types ─────────────────────────────────────────────────────────────
// Business modules never see providers — only channels. See providerTypes.ts.

export const CHANNEL_TYPES = ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK'] as const
export type ChannelType = typeof CHANNEL_TYPES[number]

// ── Priority ──────────────────────────────────────────────────────────────────
// Mirrors the project-wide audit severity scale (CLAUDE.md AUDIT-FIRST PRINCIPLE).

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const
export type Priority = typeof PRIORITIES[number]

// ── Delivery status ───────────────────────────────────────────────────────────

export const DELIVERY_STATUSES = [
  'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED', 'CANCELLED', 'RETRIED',
] as const
export type DeliveryStatus = typeof DELIVERY_STATUSES[number]

// ── Notification mode ─────────────────────────────────────────────────────────

export const NOTIFICATION_MODES = [
  'IMMEDIATE', 'SCHEDULED', 'DELAYED', 'RECURRING', 'BULK', 'EVENT_DRIVEN',
] as const
export type NotificationMode = typeof NOTIFICATION_MODES[number]

// ── Recurrence ────────────────────────────────────────────────────────────────

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
export type RecurrenceFrequency = typeof RECURRENCE_FREQUENCIES[number]

export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency
  readonly interval: number              // every N frequency units
  readonly endsAt?: string               // ISO 8601; recurrence stops after this date
  readonly occurrenceCount?: number      // recurrence stops after N occurrences
}

// ── Value objects ─────────────────────────────────────────────────────────────

export interface ScheduleTime {
  readonly scheduledAt: string           // ISO 8601 — first (or only) fire time
  readonly recurrence?: RecurrenceRule
}

export interface RetryPolicy {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  readonly backoffMultiplier: number
}

// ── Batch status ──────────────────────────────────────────────────────────────

export const BATCH_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const
export type BatchStatus = typeof BATCH_STATUSES[number]

// ── Error codes ───────────────────────────────────────────────────────────────

export const NOTIFICATION_ERROR_CODES = [
  'TEMPLATE_NOT_FOUND', 'TEMPLATE_RENDER_FAILED', 'INVALID_RECIPIENT',
  'CHANNEL_NOT_CONFIGURED', 'PROVIDER_NOT_REGISTERED', 'PROVIDER_ERROR',
  'VALIDATION_FAILED', 'NOTIFICATION_NOT_FOUND', 'NOTIFICATION_ALREADY_SENT',
  'NOTIFICATION_CANCELLED', 'RETRY_LIMIT_EXCEEDED', 'SCHEDULE_IN_PAST',
  'RECIPIENT_OPTED_OUT', 'BATCH_NOT_FOUND', 'RULE_NOT_FOUND',
  'EVENT_NOT_SUPPORTED', 'DELIVERY_NOT_FOUND',
] as const
export type NotificationErrorCode = typeof NOTIFICATION_ERROR_CODES[number]

export class NotificationError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

// ── Notification (central entity) ─────────────────────────────────────────────

export interface Notification {
  readonly id: string
  readonly templateCode: string
  readonly subject: string
  readonly body: string                              // rendered from template
  readonly priority: Priority
  readonly mode: NotificationMode
  readonly channels: readonly ChannelType[]
  readonly variables: Readonly<Record<string, string>>
  readonly moduleType?: string                        // originating business module
  readonly moduleId?: string
  readonly scheduleTime?: ScheduleTime
  readonly batchId?: string
  readonly ruleId?: string                            // set when created by an event-driven rule
  readonly status: DeliveryStatus                      // aggregate status across all deliveries
  readonly createdBy: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationRecipient ─────────────────────────────────────────────────────

export interface NotificationRecipient {
  readonly id: string
  readonly notificationId: string
  readonly userId: string
  readonly address: string                            // email / phone / device token / webhook URL
  readonly channelType: ChannelType
  readonly status: DeliveryStatus
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationChannel — per-channel routing configuration ───────────────────

export interface NotificationChannel {
  readonly id: string
  readonly channelType: ChannelType
  readonly providerType: string                       // NotificationProviderType, see providerTypes.ts
  readonly isEnabled: boolean
  readonly priority: number                           // ordering when >1 provider registered for fallback
  readonly config: Readonly<Record<string, string>>   // provider-neutral opaque config
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationTemplate ──────────────────────────────────────────────────────

export interface NotificationTemplate {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly subjectTemplate: string
  readonly bodyTemplate: string
  readonly requiredVariables: readonly string[]
  readonly channels: readonly ChannelType[]
  readonly legalBasis: readonly LegalBasis[]           // empty when not a legally-mandated notice
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationDelivery — per-recipient, per-attempt record ──────────────────

export interface NotificationDelivery {
  readonly id: string
  readonly notificationId: string
  readonly recipientId: string
  readonly channelType: ChannelType
  readonly providerType: string
  readonly status: DeliveryStatus
  readonly attempt: number
  readonly sentAt?: string
  readonly deliveredAt?: string
  readonly failedAt?: string
  readonly failureReason?: string
  readonly providerMessageId?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationBatch ──────────────────────────────────────────────────────────

export interface NotificationBatch {
  readonly id: string
  readonly name: string
  readonly templateCode: string
  readonly totalCount: number
  readonly queuedCount: number
  readonly sentCount: number
  readonly failedCount: number
  readonly status: BatchStatus
  readonly createdBy: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationPreference ────────────────────────────────────────────────────

export interface NotificationPreference {
  readonly id: string
  readonly userId: string
  readonly channelType: ChannelType
  readonly isOptedIn: boolean
  readonly quietHoursStart?: string                    // "HH:mm"
  readonly quietHoursEnd?: string                       // "HH:mm"
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationRule — event-driven trigger configuration ────────────────────

export interface NotificationRule {
  readonly id: string
  readonly eventType: string
  readonly templateCode: string
  readonly channels: readonly ChannelType[]
  readonly priority: Priority
  readonly isActive: boolean
  readonly conditions: Readonly<Record<string, string>>  // simple equality matching against event payload
  readonly createdAt: string
  readonly updatedAt: string
}

// ── NotificationEvent — inbound event from a business module ─────────────────

export interface NotificationEvent {
  readonly id: string
  readonly eventType: string
  readonly sourceModule: string                        // 'WORKFLOW' | 'APPROVAL' | 'CONTRACT' | 'ACCEPTANCE' | 'PAYMENT'
  readonly sourceId: string
  readonly payload: Readonly<Record<string, string>>
  readonly occurredAt: string
  readonly processedAt?: string
  readonly createdAt: string
}

// ── Default retry policy ──────────────────────────────────────────────────────

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  backoffMultiplier: 2,
})
