import type { Notification } from '../types/notificationTypes.ts'
import { NotificationError } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import { computeNextOccurrence, isRecurrenceExhausted } from '../domain/scheduling.ts'
import { validateScheduleTime } from '../validation/notificationValidation.ts'
import { NotificationService, type CreateNotificationRequest } from './notificationService.ts'
import { DeliveryService } from './deliveryService.ts'

// ── SchedulingService ──────────────────────────────────────────────────────────
// Orchestrates IMMEDIATE / SCHEDULED / DELAYED / RECURRING notification modes.
// BULK and EVENT_DRIVEN modes are handled by BatchService and eventRuleService
// respectively, which both create notifications via NotificationService directly.

export class SchedulingService {
  constructor(
    private readonly repos: NotificationRepositories,
    private readonly notifications: NotificationService,
    private readonly delivery: DeliveryService,
  ) {}

  async scheduleNotification(request: CreateNotificationRequest, asOf: string = new Date().toISOString()): Promise<Notification> {
    const mode = request.mode ?? 'IMMEDIATE'

    if (mode === 'SCHEDULED' || mode === 'DELAYED' || mode === 'RECURRING') {
      if (!request.scheduleTime) {
        throw new NotificationError('VALIDATION_FAILED', 'scheduleTime', `scheduleTime is required for mode ${mode}`)
      }
      validateScheduleTime(request.scheduleTime, asOf)
    }

    const notification = await this.notifications.createNotification(request)

    if (mode === 'IMMEDIATE') {
      const deliveries = await this.delivery.queueNotification(notification.id)
      for (const d of deliveries) {
        await this.delivery.sendNotification(d.id)
      }
    }

    return notification
  }

  /** Find and dispatch all notifications whose scheduleTime has come due. */
  async processDueSchedules(asOf: string = new Date().toISOString()): Promise<readonly Notification[]> {
    const due = await this.repos.notifications.findDueSchedules(asOf)
    const processed: Notification[] = []

    for (const n of due) {
      const deliveries = await this.delivery.queueNotification(n.id)
      for (const d of deliveries) {
        await this.delivery.sendNotification(d.id)
      }

      if (n.mode === 'RECURRING' && n.scheduleTime?.recurrence) {
        await this.rescheduleRecurrence(n)
      }

      processed.push(n)
    }

    return processed
  }

  private async rescheduleRecurrence(notification: Notification): Promise<void> {
    const schedule = notification.scheduleTime
    if (!schedule?.recurrence) return

    const occurrencesSoFar = (await this.repos.auditEvents.findByNotificationId(notification.id))
      .filter(e => e.eventType === 'NOTIFICATION_QUEUED').length
    const nextAt = computeNextOccurrence(schedule.scheduledAt, schedule.recurrence)

    if (isRecurrenceExhausted(schedule.recurrence, nextAt, occurrencesSoFar)) {
      await this.repos.notifications.markStatus(notification.id, 'EXPIRED')
      return
    }

    await this.repos.notifications.update(notification.id, {
      scheduleTime: { scheduledAt: nextAt, recurrence: schedule.recurrence },
      status: 'QUEUED',
    })

    // Reset recipients back to QUEUED so the next due cycle re-queues them; the previous
    // cycle's deliveries remain as historical records (terminal status, never mutated).
    const recipients = await this.repos.recipients.findByNotificationId(notification.id)
    for (const r of recipients) {
      if (r.status !== 'CANCELLED') {
        await this.repos.recipients.markStatus(r.id, 'QUEUED')
      }
    }
  }

  async cancelSchedule(id: string, cancelledBy: string): Promise<Notification> {
    return this.notifications.cancelNotification(id, cancelledBy)
  }
}
