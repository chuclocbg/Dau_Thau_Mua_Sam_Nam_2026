import type {
  Notification, NotificationRecipient, NotificationChannel, NotificationTemplate,
  NotificationDelivery, NotificationBatch, NotificationPreference, NotificationRule, NotificationEvent,
  ChannelType, Priority, NotificationMode, ScheduleTime,
} from '../types/notificationTypes.ts'
import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Create param types ────────────────────────────────────────────────────────

export type CreateNotificationParams = Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
export type CreateRecipientParams = Omit<NotificationRecipient, 'id' | 'createdAt' | 'updatedAt'>
export type CreateChannelParams = Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>
export type CreateTemplateParams = Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>
export type CreateDeliveryParams = Omit<NotificationDelivery, 'id' | 'createdAt' | 'updatedAt'>
export type CreateBatchParams = Omit<NotificationBatch, 'id' | 'createdAt' | 'updatedAt'>
export type CreatePreferenceParams = Omit<NotificationPreference, 'id' | 'createdAt' | 'updatedAt'>
export type CreateRuleParams = Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>
export type CreateEventParams = Omit<NotificationEvent, 'id' | 'createdAt'>

// ── Notification builder ──────────────────────────────────────────────────────

export interface BuildNotificationParams {
  readonly templateCode: string
  readonly subject: string
  readonly body: string
  readonly priority?: Priority
  readonly mode?: NotificationMode
  readonly channels: readonly ChannelType[]
  readonly variables?: Readonly<Record<string, string>>
  readonly moduleType?: string
  readonly moduleId?: string
  readonly scheduleTime?: ScheduleTime
  readonly batchId?: string
  readonly ruleId?: string
  readonly createdBy: string
}

export function buildNotification(params: BuildNotificationParams): CreateNotificationParams {
  return {
    templateCode: params.templateCode,
    subject: params.subject,
    body: params.body,
    priority: params.priority ?? 'NORMAL',
    mode: params.mode ?? 'IMMEDIATE',
    channels: params.channels,
    variables: params.variables ?? {},
    moduleType: params.moduleType,
    moduleId: params.moduleId,
    scheduleTime: params.scheduleTime,
    batchId: params.batchId,
    ruleId: params.ruleId,
    status: 'QUEUED',
    createdBy: params.createdBy,
  }
}

// ── Recipient builder ──────────────────────────────────────────────────────────

export function buildRecipient(
  notificationId: string,
  userId: string,
  address: string,
  channelType: ChannelType,
): CreateRecipientParams {
  return { notificationId, userId, address, channelType, status: 'QUEUED' }
}

// ── Channel builder ────────────────────────────────────────────────────────────

export interface BuildChannelParams {
  readonly channelType: ChannelType
  readonly providerType: string
  readonly priority?: number
  readonly config?: Readonly<Record<string, string>>
}

export function buildChannel(params: BuildChannelParams): CreateChannelParams {
  return {
    channelType: params.channelType,
    providerType: params.providerType,
    isEnabled: true,
    priority: params.priority ?? 0,
    config: params.config ?? {},
  }
}

// ── Template builder ───────────────────────────────────────────────────────────

export interface BuildTemplateParams {
  readonly code: string
  readonly name: string
  readonly subjectTemplate: string
  readonly bodyTemplate: string
  readonly requiredVariables: readonly string[]
  readonly channels: readonly ChannelType[]
  readonly legalBasis?: readonly LegalBasis[]
}

export function buildTemplate(params: BuildTemplateParams): CreateTemplateParams {
  return {
    code: params.code,
    name: params.name,
    subjectTemplate: params.subjectTemplate,
    bodyTemplate: params.bodyTemplate,
    requiredVariables: params.requiredVariables,
    channels: params.channels,
    legalBasis: params.legalBasis ?? [],
    isActive: true,
  }
}

// ── Delivery builder ───────────────────────────────────────────────────────────

export function buildDelivery(
  notificationId: string,
  recipientId: string,
  channelType: ChannelType,
  providerType: string,
  attempt: number,
): CreateDeliveryParams {
  return { notificationId, recipientId, channelType, providerType, status: 'QUEUED', attempt }
}

// ── Batch builder ──────────────────────────────────────────────────────────────

export function buildBatch(name: string, templateCode: string, totalCount: number, createdBy: string): CreateBatchParams {
  return {
    name, templateCode, totalCount,
    queuedCount: totalCount, sentCount: 0, failedCount: 0,
    status: 'PENDING', createdBy,
  }
}

// ── Preference builder ─────────────────────────────────────────────────────────

export function buildPreference(
  userId: string,
  channelType: ChannelType,
  isOptedIn: boolean,
  quietHoursStart?: string,
  quietHoursEnd?: string,
): CreatePreferenceParams {
  return { userId, channelType, isOptedIn, quietHoursStart, quietHoursEnd }
}

// ── Rule builder ───────────────────────────────────────────────────────────────

export interface BuildRuleParams {
  readonly eventType: string
  readonly templateCode: string
  readonly channels: readonly ChannelType[]
  readonly priority?: Priority
  readonly conditions?: Readonly<Record<string, string>>
}

export function buildRule(params: BuildRuleParams): CreateRuleParams {
  return {
    eventType: params.eventType,
    templateCode: params.templateCode,
    channels: params.channels,
    priority: params.priority ?? 'NORMAL',
    isActive: true,
    conditions: params.conditions ?? {},
  }
}

// ── Event builder ──────────────────────────────────────────────────────────────

export function buildEvent(
  eventType: string,
  sourceModule: string,
  sourceId: string,
  payload: Readonly<Record<string, string>>,
  occurredAt: string,
): CreateEventParams {
  return { eventType, sourceModule, sourceId, payload, occurredAt }
}
