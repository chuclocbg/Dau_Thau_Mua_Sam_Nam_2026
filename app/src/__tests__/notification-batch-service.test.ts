import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { DeliveryService } from '../notification/application/deliveryService.ts'
import { BatchService } from '../notification/application/batchService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let provider: MockNotificationProvider
let batch: BatchService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  const registry = createProviderRegistry()
  provider = new MockNotificationProvider('EMAIL', 'smtp')
  registry.register(provider)

  const notifications = new NotificationService(repos)
  const delivery = new DeliveryService(repos, registry)
  batch = new BatchService(repos, notifications, delivery)

  const templates = new TemplateService(repos)
  await templates.registerTemplate({
    code: 'DIGEST', name: 'Digest', subjectTemplate: 'Hi {{name}}', bodyTemplate: 'Body {{name}}',
    requiredVariables: ['name'], channels: ['EMAIL'],
  })
})

function requestsFor(names: string[]) {
  return names.map((name, i) => ({
    variables: { name },
    recipients: [{ userId: `u${i}`, channelType: 'EMAIL' as const, address: `u${i}@x.com` }],
    createdBy: 'tester',
  }))
}

describe('createBatch', () => {
  it('creates a batch and one notification per request', async () => {
    const b = await batch.createBatch('Monthly Digest', 'DIGEST', requestsFor(['A', 'B', 'C']), 'admin')
    expect(b.totalCount).toBe(3)
    expect(b.queuedCount).toBe(3)
    expect(b.status).toBe('PENDING')

    const notifications = await repos.notifications.findByBatchId(b.id)
    expect(notifications).toHaveLength(3)
    expect(notifications.every(n => n.mode === 'BULK')).toBe(true)
  })

  it('rejects an empty batch', async () => {
    await expect(batch.createBatch('Empty', 'DIGEST', [], 'admin')).rejects.toThrow(NotificationError)
  })

  it('records a BATCH_CREATED audit event', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A']), 'admin')
    const events = await repos.auditEvents.findByEventType('BATCH_CREATED')
    expect(events.some(e => e.batchId === b.id)).toBe(true)
  })
})

describe('sendBatch', () => {
  it('queues and sends every notification in the batch', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A', 'B']), 'admin')
    const updated = await batch.sendBatch(b.id)
    expect(updated.sentCount).toBe(2)
    expect(updated.failedCount).toBe(0)
    expect(updated.status).toBe('COMPLETED')
    expect(provider.getSent()).toHaveLength(2)
  })

  it('counts failures separately from successes', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A', 'B']), 'admin')
    provider.simulateFailure() // fails exactly the first send() call
    const updated = await batch.sendBatch(b.id)
    expect(updated.sentCount).toBe(1)
    expect(updated.failedCount).toBe(1)
    expect(updated.status).toBe('COMPLETED')
  })

  it('marks status FAILED when every notification fails', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A']), 'admin')
    provider.simulateFailure()
    const updated = await batch.sendBatch(b.id)
    expect(updated.status).toBe('FAILED')
  })

  it('throws BATCH_NOT_FOUND for an unknown batch id', async () => {
    await expect(batch.sendBatch('missing')).rejects.toThrow(NotificationError)
  })

  it('records a BATCH_COMPLETED audit event', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A']), 'admin')
    await batch.sendBatch(b.id)
    const events = await repos.auditEvents.findByEventType('BATCH_COMPLETED')
    expect(events.some(e => e.batchId === b.id)).toBe(true)
  })
})

describe('getBatchStatus', () => {
  it('returns the batch by id', async () => {
    const b = await batch.createBatch('Digest', 'DIGEST', requestsFor(['A']), 'admin')
    expect((await batch.getBatchStatus(b.id))?.id).toBe(b.id)
  })

  it('returns null for unknown id', async () => {
    expect(await batch.getBatchStatus('missing')).toBeNull()
  })
})
