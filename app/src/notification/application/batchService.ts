import type { NotificationBatch } from '../types/notificationTypes.ts'
import { NotificationError } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import { buildBatch } from './notificationFactory.ts'
import { NotificationService, type CreateNotificationRequest } from './notificationService.ts'
import { DeliveryService } from './deliveryService.ts'

// ── BatchService ────────────────────────────────────────────────────────────────
// Bulk notification mode: many recipients, one template, tracked as a unit.

export class BatchService {
  constructor(
    private readonly repos: NotificationRepositories,
    private readonly notifications: NotificationService,
    private readonly delivery: DeliveryService,
  ) {}

  async createBatch(
    name: string,
    templateCode: string,
    requests: readonly Omit<CreateNotificationRequest, 'mode' | 'batchId' | 'templateCode'>[],
    createdBy: string,
  ): Promise<NotificationBatch> {
    if (requests.length === 0) {
      throw new NotificationError('VALIDATION_FAILED', 'requests', 'A batch must contain at least one notification request')
    }

    const batch = await this.repos.batches.create(buildBatch(name, templateCode, requests.length, createdBy))

    for (const req of requests) {
      await this.notifications.createNotification({
        ...req,
        templateCode,
        mode: 'BULK',
        batchId: batch.id,
      })
    }

    await this.repos.auditEvents.append({
      eventType: 'BATCH_CREATED',
      batchId: batch.id,
      userId: createdBy,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { templateCode, totalCount: String(requests.length) },
    })

    return batch
  }

  async sendBatch(batchId: string): Promise<NotificationBatch> {
    const batch = await this.repos.batches.findById(batchId)
    if (!batch) {
      throw new NotificationError('BATCH_NOT_FOUND', 'batchId', `Batch not found: ${batchId}`)
    }

    const notifications = await this.repos.notifications.findByBatchId(batchId)
    let sent = 0
    let failed = 0

    for (const n of notifications) {
      const deliveries = await this.delivery.queueNotification(n.id)
      for (const d of deliveries) {
        const result = await this.delivery.sendNotification(d.id)
        if (result.status === 'SENT') sent++
        else if (result.status === 'FAILED') failed++
      }
    }

    const updated = await this.repos.batches.update(batchId, {
      sentCount: sent,
      failedCount: failed,
      queuedCount: Math.max(0, batch.totalCount - sent - failed),
      status: failed > 0 && sent === 0 ? 'FAILED' : 'COMPLETED',
    })

    await this.repos.auditEvents.append({
      eventType: 'BATCH_COMPLETED',
      batchId,
      userId: 'system',
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { sentCount: String(sent), failedCount: String(failed) },
    })

    return updated
  }

  async getBatchStatus(batchId: string): Promise<NotificationBatch | null> {
    return this.repos.batches.findById(batchId)
  }
}
