import { describe, it, expect } from 'vitest'
import {
  validateSubject, validateMessageBody, validateTemplateCode, validateChannels,
  validateTemplate, validateScheduleTime, validateRule, validateRecipientAddress,
} from '../notification/validation/notificationValidation.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

describe('validateSubject', () => {
  it('throws on empty subject', () => {
    expect(() => validateSubject('')).toThrow(NotificationError)
    expect(() => validateSubject('   ')).toThrow(NotificationError)
  })
  it('throws on subject over 500 characters', () => {
    expect(() => validateSubject('x'.repeat(501))).toThrow(NotificationError)
  })
  it('passes for a valid subject', () => {
    expect(() => validateSubject('Hello')).not.toThrow()
  })
})

describe('validateMessageBody', () => {
  it('throws on empty body', () => {
    expect(() => validateMessageBody('')).toThrow(NotificationError)
  })
  it('passes for a non-empty body', () => {
    expect(() => validateMessageBody('Content')).not.toThrow()
  })
})

describe('validateTemplateCode', () => {
  it('accepts uppercase letters, digits, underscore', () => {
    expect(() => validateTemplateCode('APPROVAL_NOTICE_1')).not.toThrow()
  })
  it('rejects lowercase or special characters', () => {
    expect(() => validateTemplateCode('approval-notice')).toThrow(NotificationError)
    expect(() => validateTemplateCode('')).toThrow(NotificationError)
  })
})

describe('validateChannels', () => {
  it('throws when empty', () => {
    expect(() => validateChannels([])).toThrow(NotificationError)
  })
  it('throws on unknown channel type', () => {
    expect(() => validateChannels(['CARRIER_PIGEON'])).toThrow(NotificationError)
  })
  it('passes for known channel types', () => {
    expect(() => validateChannels(['EMAIL', 'SMS'])).not.toThrow()
  })
})

describe('validateTemplate', () => {
  const valid = {
    code: 'T1', subjectTemplate: 'S', bodyTemplate: 'B', channels: ['EMAIL'] as const,
  }
  it('passes for a complete valid template', () => {
    expect(() => validateTemplate(valid)).not.toThrow()
  })
  it('throws when code is missing', () => {
    expect(() => validateTemplate({ ...valid, code: undefined })).toThrow(NotificationError)
  })
  it('throws when subjectTemplate is blank', () => {
    expect(() => validateTemplate({ ...valid, subjectTemplate: '  ' })).toThrow(NotificationError)
  })
  it('throws when bodyTemplate is blank', () => {
    expect(() => validateTemplate({ ...valid, bodyTemplate: '' })).toThrow(NotificationError)
  })
  it('throws when channels is empty', () => {
    expect(() => validateTemplate({ ...valid, channels: [] })).toThrow(NotificationError)
  })
})

describe('validateScheduleTime', () => {
  it('throws SCHEDULE_IN_PAST for a past scheduledAt', () => {
    expect(() => validateScheduleTime({ scheduledAt: '2020-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'))
      .toThrow(NotificationError)
  })
  it('passes for a future scheduledAt', () => {
    expect(() => validateScheduleTime({ scheduledAt: '2027-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z'))
      .not.toThrow()
  })
  it('throws for non-positive recurrence interval', () => {
    expect(() => validateScheduleTime(
      { scheduledAt: '2027-01-01T00:00:00Z', recurrence: { frequency: 'DAILY', interval: 0 } },
      '2026-01-01T00:00:00Z',
    )).toThrow(NotificationError)
  })
  it('passes for a valid recurrence', () => {
    expect(() => validateScheduleTime(
      { scheduledAt: '2027-01-01T00:00:00Z', recurrence: { frequency: 'WEEKLY', interval: 2 } },
      '2026-01-01T00:00:00Z',
    )).not.toThrow()
  })
})

describe('validateRule', () => {
  const valid = { eventType: 'APPROVAL_REQUESTED', templateCode: 'T1', channels: ['EMAIL'] as const }
  it('passes for a valid rule', () => {
    expect(() => validateRule(valid)).not.toThrow()
  })
  it('throws when eventType is missing', () => {
    expect(() => validateRule({ ...valid, eventType: '' })).toThrow(NotificationError)
  })
  it('throws when templateCode is missing', () => {
    expect(() => validateRule({ ...valid, templateCode: '' })).toThrow(NotificationError)
  })
  it('throws when channels is empty', () => {
    expect(() => validateRule({ ...valid, channels: [] })).toThrow(NotificationError)
  })
})

describe('validateRecipientAddress', () => {
  it('throws for empty address', () => {
    expect(() => validateRecipientAddress('EMAIL', '')).toThrow(NotificationError)
  })
  it('throws for invalid email format', () => {
    expect(() => validateRecipientAddress('EMAIL', 'not-an-email')).toThrow(NotificationError)
  })
  it('passes for a valid email', () => {
    expect(() => validateRecipientAddress('EMAIL', 'user@example.com')).not.toThrow()
  })
  it('does not apply email format check to non-EMAIL channels', () => {
    expect(() => validateRecipientAddress('SMS', '+84123456789')).not.toThrow()
  })
})
