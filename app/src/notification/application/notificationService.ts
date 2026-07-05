import type {
  Notification, NotificationDelivery, ChannelType, Priority, NotificationMode, ScheduleTime,
} from '../types/notificationTypes.ts'
import { NotificationError } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import type { NotificationAuditEvent } from '../types/auditTypes.ts'
import { renderMessage } from '../domain/template.ts'
import { validateRecipientAddress } from '../validation/notificationValidation.ts'
import { buildNotification, buildRecipient } from './notificationFactory.ts'

// ── Request shapes ─────────────────────────────────────────────────────────────

export interface RecipientInput {
  readonly userId: string
  readonly channelType: ChannelType
  readonly address: string
}

export interface CreateNotificationRequest {
  readonly templateCode: string
  readonly variables: Readonly<Record<string, string>>
  readonly recipients: readonly RecipientInput[]
  readonly priority?: Priority
  readonly mode?: NotificationMode
  readonly moduleType?: string
  readonly moduleId?: string
  readonly scheduleTime?: ScheduleTime
  readonly batchId?: string
  readonly ruleId?: string
  readonly createdBy: string
}

// ── NotificationService ────────────────────────────────────────────────────────

export class NotificationService {
  constructor(private readonly repos: NotificationRepositories) {}

  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    if (request.recipients.length === 0) {
      throw new NotificationError('INVALID_RECIPIENT', 'recipients', 'At least one recipient is required')
    }
    for (const r of request.recipients) {
      validateRecipientAddress(r.channelType, r.address)
    }

    const template = await this.repos.templates.findByCode(request.templateCode)
    if (!template) {
      throw new NotificationError('TEMPLATE_NOT_FOUND', 'templateCode', `Template not found: ${request.templateCode}`)
    }
    const rendered = renderMessage(
      template.subjectTemplate, template.bodyTemplate, template.requiredVariables, request.variables,
    )

    const channels = Array.from(new Set(request.recipients.map(r => r.channelType)))

    const notification = await this.repos.notifications.create(buildNotification({
      templateCode: request.templateCode,
      subject: rendered.subject,
      body: rendered.body,
      priority: request.priority,
      mode: request.mode,
      channels,
      variables: request.variables,
      moduleType: request.moduleType,
      moduleId: request.moduleId,
      scheduleTime: request.scheduleTime,
      batchId: request.batchId,
      ruleId: request.ruleId,
      createdBy: request.createdBy,
    }))

    for (const r of request.recipients) {
      await this.repos.recipients.create(buildRecipient(notification.id, r.userId, r.address, r.channelType))
    }

    await this.audit({
      eventType: 'NOTIFICATION_CREATED',
      notificationId: notification.id,
      userId: request.createdBy,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { templateCode: request.templateCode, recipientCount: String(request.recipients.length) },
    })

    return notification
  }

  async getNotification(id: string): Promise<Notification | null> {
    return this.repos.notifications.findById(id)
  }

  async listByModule(moduleType: string, moduleId: string): Promise<readonly Notification[]> {
    return this.repos.notifications.findByModule(moduleType, moduleId)
  }

  async cancelNotification(id: string, cancelledBy: string): Promise<Notification> {
    const notification = await this.repos.notifications.findById(id)
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'id', `Notification not found: ${id}`)
    }
    if (notification.status === 'DELIVERED' || notification.status === 'SENT') {
      throw new NotificationError('NOTIFICATION_ALREADY_SENT', 'id', 'Notification has already been sent')
    }
    if (notification.status === 'CANCELLED') {
      throw new NotificationError('NOTIFICATION_CANCELLED', 'id', 'Notification is already cancelled')
    }

    const cancelled = await this.repos.notifications.markStatus(id, 'CANCELLED')

    const recipients = await this.repos.recipients.findByNotificationId(id)
    for (const r of recipients) {
      if (r.status === 'QUEUED') {
        await this.repos.recipients.markStatus(r.id, 'CANCELLED')
      }
    }

    await this.audit({
      eventType: 'NOTIFICATION_CANCELLED',
      notificationId: id,
      userId: cancelledBy,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: {},
    })

    return cancelled
  }

  async markDelivered(deliveryId: string): Promise<NotificationDelivery> {
    const delivery = await this.repos.deliveries.findById(deliveryId)
    if (!delivery) {
      throw new NotificationError('DELIVERY_NOT_FOUND', 'deliveryId', `Delivery not found: ${deliveryId}`)
    }
    const now = new Date().toISOString()
    const updated = await this.repos.deliveries.markStatus(deliveryId, 'DELIVERED', { deliveredAt: now })
    await this.repos.recipients.markStatus(delivery.recipientId, 'DELIVERED')
    await this.syncNotificationStatus(delivery.notificationId)

    await this.audit({
      eventType: 'NOTIFICATION_DELIVERED',
      notificationId: delivery.notificationId,
      deliveryId,
      userId: 'system',
      outcome: 'SUCCESS',
      occurredAt: now,
      metadata: {},
    })

    return updated
  }

  async markFailed(deliveryId: string, reason: string): Promise<NotificationDelivery> {
    const delivery = await this.repos.deliveries.findById(deliveryId)
    if (!delivery) {
      throw new NotificationError('DELIVERY_NOT_FOUND', 'deliveryId', `Delivery not found: ${deliveryId}`)
    }
    const now = new Date().toISOString()
    const updated = await this.repos.deliveries.markStatus(deliveryId, 'FAILED', { failedAt: now, failureReason: reason })
    await this.repos.recipients.markStatus(delivery.recipientId, 'FAILED')

    await this.audit({
      eventType: 'NOTIFICATION_FAILED',
      notificationId: delivery.notificationId,
      deliveryId,
      userId: 'system',
      outcome: 'FAILURE',
      reason,
      occurredAt: now,
      metadata: {},
    })

    return updated
  }

  async getNotificationTimeline(notificationId: string): Promise<readonly NotificationAuditEvent[]> {
    const events = await this.repos.auditEvents.findByNotificationId(notificationId)
    return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  }

  // ── Aggregate status sync ────────────────────────────────────────────────────
  // Notification.status = DELIVERED only when every recipient has been delivered.

  private async syncNotificationStatus(notificationId: string): Promise<void> {
    const recipients = await this.repos.recipients.findByNotificationId(notificationId)
    if (recipients.length > 0 && recipients.every(r => r.status === 'DELIVERED')) {
      await this.repos.notifications.markStatus(notificationId, 'DELIVERED')
    }
  }

  private async audit(event: Omit<NotificationAuditEvent, 'id' | 'createdAt'>): Promise<void> {
    await this.repos.auditEvents.append(event)
  }
}
