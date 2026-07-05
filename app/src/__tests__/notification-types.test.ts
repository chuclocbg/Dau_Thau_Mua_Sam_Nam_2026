import { describe, it, expect } from 'vitest'
import {
  CHANNEL_TYPES, PRIORITIES, DELIVERY_STATUSES, NOTIFICATION_MODES,
  RECURRENCE_FREQUENCIES, BATCH_STATUSES, NOTIFICATION_ERROR_CODES,
  NotificationError, DEFAULT_RETRY_POLICY,
} from '../notification/types/notificationTypes.ts'

describe('Channel types', () => {
  it('includes EMAIL, SMS, PUSH, IN_APP, WEBHOOK', () => {
    expect(CHANNEL_TYPES).toContain('EMAIL')
    expect(CHANNEL_TYPES).toContain('SMS')
    expect(CHANNEL_TYPES).toContain('PUSH')
    expect(CHANNEL_TYPES).toContain('IN_APP')
    expect(CHANNEL_TYPES).toContain('WEBHOOK')
    expect(CHANNEL_TYPES).toHaveLength(5)
  })
})

describe('Priorities', () => {
  it('covers LOW, NORMAL, HIGH, CRITICAL', () => {
    expect(PRIORITIES).toEqual(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  })
})

describe('Delivery statuses', () => {
  it('covers the full lifecycle', () => {
    expect(DELIVERY_STATUSES).toContain('QUEUED')
    expect(DELIVERY_STATUSES).toContain('SENT')
    expect(DELIVERY_STATUSES).toContain('DELIVERED')
    expect(DELIVERY_STATUSES).toContain('FAILED')
    expect(DELIVERY_STATUSES).toContain('EXPIRED')
    expect(DELIVERY_STATUSES).toContain('CANCELLED')
    expect(DELIVERY_STATUSES).toContain('RETRIED')
    expect(DELIVERY_STATUSES).toHaveLength(7)
  })
})

describe('Notification modes', () => {
  it('supports immediate, scheduled, delayed, recurring, bulk, event-driven', () => {
    expect(NOTIFICATION_MODES).toEqual([
      'IMMEDIATE', 'SCHEDULED', 'DELAYED', 'RECURRING', 'BULK', 'EVENT_DRIVEN',
    ])
  })
})

describe('Recurrence frequencies', () => {
  it('supports DAILY, WEEKLY, MONTHLY', () => {
    expect(RECURRENCE_FREQUENCIES).toEqual(['DAILY', 'WEEKLY', 'MONTHLY'])
  })
})

describe('Batch statuses', () => {
  it('covers PENDING, PROCESSING, COMPLETED, FAILED', () => {
    expect(BATCH_STATUSES).toEqual(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
  })
})

describe('Notification error codes', () => {
  it('defines 17 error codes', () => {
    expect(NOTIFICATION_ERROR_CODES).toHaveLength(17)
    expect(NOTIFICATION_ERROR_CODES).toContain('TEMPLATE_NOT_FOUND')
    expect(NOTIFICATION_ERROR_CODES).toContain('RETRY_LIMIT_EXCEEDED')
    expect(NOTIFICATION_ERROR_CODES).toContain('SCHEDULE_IN_PAST')
    expect(NOTIFICATION_ERROR_CODES).toContain('RECIPIENT_OPTED_OUT')
  })
})

describe('NotificationError', () => {
  it('constructs with code, field, message', () => {
    const err = new NotificationError('TEMPLATE_NOT_FOUND', 'templateCode', 'Not found')
    expect(err.code).toBe('TEMPLATE_NOT_FOUND')
    expect(err.field).toBe('templateCode')
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('NotificationError')
    expect(err).toBeInstanceOf(Error)
  })

  it('is an instanceof Error', () => {
    const err = new NotificationError('VALIDATION_FAILED', 'x', 'bad')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(NotificationError)
  })
})

describe('DEFAULT_RETRY_POLICY', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(5)
    expect(DEFAULT_RETRY_POLICY.baseDelayMs).toBe(1_000)
    expect(DEFAULT_RETRY_POLICY.maxDelayMs).toBe(60_000)
    expect(DEFAULT_RETRY_POLICY.backoffMultiplier).toBe(2)
  })
})
