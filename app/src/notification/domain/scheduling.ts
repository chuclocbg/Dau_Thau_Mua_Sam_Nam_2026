import type { ScheduleTime, RecurrenceRule } from '../types/notificationTypes.ts'

// ── Schedule checks — pure functions ──────────────────────────────────────────

/** True if the scheduled time is strictly in the past relative to `asOf`. */
export function isSchedulePast(scheduledAt: string, asOf: string): boolean {
  return new Date(scheduledAt).getTime() < new Date(asOf).getTime()
}

/** True if a schedule is due to fire at or before `asOf`. */
export function isDue(schedule: ScheduleTime, asOf: string): boolean {
  return new Date(schedule.scheduledAt).getTime() <= new Date(asOf).getTime()
}

/** Compute the next occurrence of a recurrence rule after `fromDate`. */
export function computeNextOccurrence(fromDate: string, rule: RecurrenceRule): string {
  const d = new Date(fromDate)
  switch (rule.frequency) {
    case 'DAILY':
      d.setUTCDate(d.getUTCDate() + rule.interval)
      break
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() + rule.interval * 7)
      break
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + rule.interval)
      break
  }
  return d.toISOString()
}

/** True if a recurrence has exhausted its end condition (endsAt or occurrenceCount). */
export function isRecurrenceExhausted(
  rule: RecurrenceRule,
  nextOccurrence: string,
  occurrencesSoFar: number,
): boolean {
  if (rule.occurrenceCount !== undefined && occurrencesSoFar >= rule.occurrenceCount) return true
  if (rule.endsAt !== undefined && new Date(nextOccurrence).getTime() > new Date(rule.endsAt).getTime()) return true
  return false
}

// ── Quiet hours ────────────────────────────────────────────────────────────────
// HH:mm strings, comparable lexicographically. Supports overnight windows
// (e.g. start="22:00" end="06:00" spans midnight).

export function isInQuietHours(currentTime: string, quietStart: string, quietEnd: string): boolean {
  if (quietStart <= quietEnd) {
    return currentTime >= quietStart && currentTime < quietEnd
  }
  // Overnight window: quiet period wraps past midnight
  return currentTime >= quietStart || currentTime < quietEnd
}
