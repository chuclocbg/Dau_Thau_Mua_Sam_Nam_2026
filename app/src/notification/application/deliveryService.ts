import type { NotificationDelivery } from '../types/notificationTypes.ts'
import { NotificationError, DEFAULT_RETRY_POLICY } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import type { NotificationProviderRegistry } from '../types/providerTypes.ts'
import { shouldRetry } from '../domain/retryPolicy.ts'
import { buildDelivery } from './notificationFactory.ts'
import { PreferenceService } from './preferenceService.ts'

// ── DeliveryService ─────────────────────────────────────────────────────────────
// The only place that resolves ChannelType → provider. Business modules and the
// rest of the application layer never see provider identity or type.

export class DeliveryService {
  private readonly preferences: PreferenceService

  constructor(
    private readonly repos: NotificationRepositories,
    private readonly registry: NotificationProviderRegistry,
  ) {
    this.preferences = new PreferenceService(repos)
  }

  /** Create a delivery record per non-opted-out recipient of a notification. */
  async queueNotification(notificationId: string): Promise<readonly NotificationDelivery[]> {
    const notification = await this.repos.notifications.findById(notificationId)
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'notificationId', `Notification not found: ${notificationId}`)
    }

    const recipients = await this.repos.recipients.findByNotificationId(notificationId)
    const created: NotificationDelivery[] = []

    for (const recipient of recipients) {
      if (recipient.status !== 'QUEUED') continue

      // Idempotency guard: a delivery is already in flight for this recipient (e.g.
      // queueNotification was called twice before it was sent) — do not create a second one.
      // Terminal deliveries from a previous recurrence cycle do not block a new one, because
      // rescheduleRecurrence() resets the recipient back to QUEUED for each new cycle.
      const existing = await this.repos.deliveries.findByRecipientId(recipient.id)
      if (existing.some(d => d.status === 'QUEUED')) continue

      const optedIn = await this.preferences.isOptedIn(recipient.userId, recipient.channelType)
      if (!optedIn) {
        await this.repos.recipients.markStatus(recipient.id, 'CANCELLED')
        continue
      }

      const provider = this.registry.resolve(recipient.channelType)
      if (!provider) {
        throw new NotificationError(
          'CHANNEL_NOT_CONFIGURED', 'channelType', `No provider registered for channel: ${recipient.channelType}`,
        )
      }

      const delivery = await this.repos.deliveries.create(
        buildDelivery(notificationId, recipient.id, recipient.channelType, provider.providerType, 1),
      )
      created.push(delivery)
    }

    await this.repos.auditEvents.append({
      eventType: 'NOTIFICATION_QUEUED',
      notificationId,
      userId: 'system',
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { deliveryCount: String(created.length) },
    })

    return created
  }

  /** Attempt delivery through the channel's registered provider. Never throws on provider failure. */
  async sendNotification(deliveryId: string): Promise<NotificationDelivery> {
    const delivery = await this.repos.deliveries.findById(deliveryId)
    if (!delivery) {
      throw new NotificationError('DELIVERY_NOT_FOUND', 'deliveryId', `Delivery not found: ${deliveryId}`)
    }

    const recipient = await this.repos.recipients.findById(delivery.recipientId)
    if (!recipient) {
      throw new NotificationError('INVALID_RECIPIENT', 'recipientId', `Recipient not found: ${delivery.recipientId}`)
    }

    const notification = await this.repos.notifications.findById(delivery.notificationId)
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'notificationId', `Notification not found: ${delivery.notificationId}`)
    }

    const provider = this.registry.resolve(delivery.channelType)
    if (!provider) {
      throw new NotificationError('PROVIDER_NOT_REGISTERED', 'channelType', `No provider registered for channel: ${delivery.channelType}`)
    }

    try {
      const result = await provider.send({
        address: recipient.address,
        subject: notification.subject,
        body: notification.body,
      })
      const now = result.sentAt
      const sent = await this.repos.deliveries.markStatus(deliveryId, 'SENT', {
        sentAt: now, providerMessageId: result.providerMessageId,
      })
      await this.repos.recipients.markStatus(recipient.id, 'SENT')

      await this.repos.auditEvents.append({
        eventType: 'NOTIFICATION_SENT',
        notificationId: delivery.notificationId,
        deliveryId,
        userId: 'system',
        outcome: 'SUCCESS',
        occurredAt: now,
        metadata: { channelType: delivery.channelType, providerMessageId: result.providerMessageId },
      })

      return sent
    } catch (err) {
      const now = new Date().toISOString()
      const reason = err instanceof Error ? err.message : String(err)
      const failed = await this.repos.deliveries.markStatus(deliveryId, 'FAILED', { failedAt: now, failureReason: reason })
      await this.repos.recipients.markStatus(recipient.id, 'FAILED')

      await this.repos.auditEvents.append({
        eventType: 'NOTIFICATION_FAILED',
        notificationId: delivery.notificationId,
        deliveryId,
        userId: 'system',
        outcome: 'FAILURE',
        reason,
        occurredAt: now,
        metadata: { channelType: delivery.channelType },
      })

      return failed
    }
  }

  /** Re-attempt a failed delivery as a new attempt, honoring the retry policy's attempt limit. */
  async retryNotification(deliveryId: string): Promise<NotificationDelivery> {
    const delivery = await this.repos.deliveries.findById(deliveryId)
    if (!delivery) {
      throw new NotificationError('DELIVERY_NOT_FOUND', 'deliveryId', `Delivery not found: ${deliveryId}`)
    }
    if (delivery.status !== 'FAILED') {
      throw new NotificationError('VALIDATION_FAILED', 'status', 'Only failed deliveries can be retried')
    }
    if (!shouldRetry(delivery.attempt, DEFAULT_RETRY_POLICY)) {
      throw new NotificationError('RETRY_LIMIT_EXCEEDED', 'attempt', `Retry limit (${DEFAULT_RETRY_POLICY.maxAttempts}) exceeded for delivery ${deliveryId}`)
    }

    await this.repos.deliveries.markStatus(deliveryId, 'RETRIED')

    const next = await this.repos.deliveries.create(
      buildDelivery(delivery.notificationId, delivery.recipientId, delivery.channelType, delivery.providerType, delivery.attempt + 1),
    )

    await this.repos.auditEvents.append({
      eventType: 'NOTIFICATION_RETRIED',
      notificationId: delivery.notificationId,
      deliveryId: next.id,
      userId: 'system',
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { previousDeliveryId: deliveryId, attempt: String(next.attempt) },
    })

    return this.sendNotification(next.id)
  }
}
