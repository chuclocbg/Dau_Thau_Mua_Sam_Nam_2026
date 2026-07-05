import type { NotificationTemplate, NotificationRule, ScheduleTime } from '../types/notificationTypes.ts'
import { NotificationError, CHANNEL_TYPES } from '../types/notificationTypes.ts'
import { isSchedulePast } from '../domain/scheduling.ts'

// ── Subject / body validation ─────────────────────────────────────────────────

export function validateSubject(subject: string): void {
  if (!subject || !subject.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'subject', 'subject is required')
  }
  if (subject.length > 500) {
    throw new NotificationError('VALIDATION_FAILED', 'subject', 'subject must be <= 500 characters')
  }
}

export function validateMessageBody(body: string): void {
  if (!body || !body.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'body', 'body is required')
  }
}

// ── Template code ──────────────────────────────────────────────────────────────

export function validateTemplateCode(code: string): void {
  if (!code || !/^[A-Z0-9_]+$/.test(code)) {
    throw new NotificationError('VALIDATION_FAILED', 'templateCode', `Invalid template code: ${code}`)
  }
}

// ── Channels ───────────────────────────────────────────────────────────────────

export function validateChannels(channels: readonly string[]): void {
  if (channels.length === 0) {
    throw new NotificationError('VALIDATION_FAILED', 'channels', 'At least one channel is required')
  }
  for (const c of channels) {
    if (!(CHANNEL_TYPES as readonly string[]).includes(c)) {
      throw new NotificationError('VALIDATION_FAILED', 'channels', `Unknown channel type: ${c}`)
    }
  }
}

// ── Template validation ────────────────────────────────────────────────────────

export function validateTemplate(template: Partial<NotificationTemplate>): void {
  if (!template.code) {
    throw new NotificationError('VALIDATION_FAILED', 'code', 'Template code is required')
  }
  validateTemplateCode(template.code)
  if (!template.subjectTemplate?.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'subjectTemplate', 'subjectTemplate is required')
  }
  if (!template.bodyTemplate?.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'bodyTemplate', 'bodyTemplate is required')
  }
  if (!template.channels?.length) {
    throw new NotificationError('VALIDATION_FAILED', 'channels', 'Template must declare at least one channel')
  }
  validateChannels(template.channels)
}

// ── Schedule validation ─────────────────────────────────────────────────────────

export function validateScheduleTime(schedule: ScheduleTime, asOf: string): void {
  if (isSchedulePast(schedule.scheduledAt, asOf)) {
    throw new NotificationError('SCHEDULE_IN_PAST', 'scheduledAt', `Scheduled time ${schedule.scheduledAt} is in the past`)
  }
  if (schedule.recurrence) {
    if (schedule.recurrence.interval < 1 || !Number.isInteger(schedule.recurrence.interval)) {
      throw new NotificationError('VALIDATION_FAILED', 'recurrence.interval', 'interval must be a positive integer')
    }
  }
}

// ── Rule validation ─────────────────────────────────────────────────────────────

export function validateRule(rule: Partial<NotificationRule>): void {
  if (!rule.eventType?.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'eventType', 'eventType is required')
  }
  if (!rule.templateCode?.trim()) {
    throw new NotificationError('VALIDATION_FAILED', 'templateCode', 'templateCode is required')
  }
  if (!rule.channels?.length) {
    throw new NotificationError('VALIDATION_FAILED', 'channels', 'Rule must declare at least one channel')
  }
  validateChannels(rule.channels)
}

// ── Recipient address validation (channel-appropriate) ────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRecipientAddress(channelType: string, address: string): void {
  if (!address || !address.trim()) {
    throw new NotificationError('INVALID_RECIPIENT', 'address', 'Recipient address is required')
  }
  if (channelType === 'EMAIL' && !EMAIL_PATTERN.test(address)) {
    throw new NotificationError('INVALID_RECIPIENT', 'address', `Invalid email address: ${address}`)
  }
}
