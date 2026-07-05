import { describe, it, expect } from 'vitest'
import {
  isSchedulePast, isDue, computeNextOccurrence, isRecurrenceExhausted, isInQuietHours,
} from '../notification/domain/scheduling.ts'
import type { RecurrenceRule } from '../notification/types/notificationTypes.ts'

describe('isSchedulePast', () => {
  it('true when scheduledAt is before asOf', () => {
    expect(isSchedulePast('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(true)
  })
  it('false when scheduledAt is in the future', () => {
    expect(isSchedulePast('2026-12-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(false)
  })
  it('false when scheduledAt equals asOf', () => {
    expect(isSchedulePast('2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(false)
  })
})

describe('isDue', () => {
  it('true when scheduledAt is at or before asOf', () => {
    expect(isDue({ scheduledAt: '2026-01-01T00:00:00Z' }, '2026-01-01T00:00:00Z')).toBe(true)
    expect(isDue({ scheduledAt: '2026-01-01T00:00:00Z' }, '2026-02-01T00:00:00Z')).toBe(true)
  })
  it('false when scheduledAt is after asOf', () => {
    expect(isDue({ scheduledAt: '2026-12-01T00:00:00Z' }, '2026-01-01T00:00:00Z')).toBe(false)
  })
})

describe('computeNextOccurrence', () => {
  it('DAILY adds interval days', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 3 }
    expect(computeNextOccurrence('2026-01-01T00:00:00.000Z', rule)).toBe('2026-01-04T00:00:00.000Z')
  })

  it('WEEKLY adds interval*7 days', () => {
    const rule: RecurrenceRule = { frequency: 'WEEKLY', interval: 2 }
    expect(computeNextOccurrence('2026-01-01T00:00:00.000Z', rule)).toBe('2026-01-15T00:00:00.000Z')
  })

  it('MONTHLY adds interval months', () => {
    const rule: RecurrenceRule = { frequency: 'MONTHLY', interval: 1 }
    expect(computeNextOccurrence('2026-01-15T00:00:00.000Z', rule)).toBe('2026-02-15T00:00:00.000Z')
  })

  it('MONTHLY with interval > 1', () => {
    const rule: RecurrenceRule = { frequency: 'MONTHLY', interval: 3 }
    expect(computeNextOccurrence('2026-01-15T00:00:00.000Z', rule)).toBe('2026-04-15T00:00:00.000Z')
  })
})

describe('isRecurrenceExhausted', () => {
  it('false when neither endsAt nor occurrenceCount set', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1 }
    expect(isRecurrenceExhausted(rule, '2026-06-01T00:00:00Z', 100)).toBe(false)
  })

  it('true when occurrencesSoFar reaches occurrenceCount', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1, occurrenceCount: 3 }
    expect(isRecurrenceExhausted(rule, '2026-01-04T00:00:00Z', 3)).toBe(true)
  })

  it('false when occurrencesSoFar is below occurrenceCount', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1, occurrenceCount: 3 }
    expect(isRecurrenceExhausted(rule, '2026-01-02T00:00:00Z', 1)).toBe(false)
  })

  it('true when next occurrence is past endsAt', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1, endsAt: '2026-01-02T00:00:00Z' }
    expect(isRecurrenceExhausted(rule, '2026-01-05T00:00:00Z', 0)).toBe(true)
  })

  it('false when next occurrence is before endsAt', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1, endsAt: '2026-02-01T00:00:00Z' }
    expect(isRecurrenceExhausted(rule, '2026-01-05T00:00:00Z', 0)).toBe(false)
  })
})

describe('isInQuietHours', () => {
  it('true within a same-day window', () => {
    expect(isInQuietHours('13:00', '09:00', '17:00')).toBe(true)
  })
  it('false outside a same-day window', () => {
    expect(isInQuietHours('20:00', '09:00', '17:00')).toBe(false)
  })
  it('true within an overnight window (before midnight)', () => {
    expect(isInQuietHours('23:00', '22:00', '06:00')).toBe(true)
  })
  it('true within an overnight window (after midnight)', () => {
    expect(isInQuietHours('03:00', '22:00', '06:00')).toBe(true)
  })
  it('false outside an overnight window', () => {
    expect(isInQuietHours('12:00', '22:00', '06:00')).toBe(false)
  })
  it('boundary: start time is inclusive', () => {
    expect(isInQuietHours('09:00', '09:00', '17:00')).toBe(true)
  })
  it('boundary: end time is exclusive', () => {
    expect(isInQuietHours('17:00', '09:00', '17:00')).toBe(false)
  })
})
