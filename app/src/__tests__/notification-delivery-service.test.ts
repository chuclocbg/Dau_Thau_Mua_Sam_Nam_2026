import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { DeliveryService } from '../notification/application/deliveryService.ts'
import { PreferenceService } from '../notification/application/preferenceService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import type { NotificationProviderRegistry } from '../notification/types/providerTypes.ts'
import { NotificationError, DEFAULT_RETRY_POLICY } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let registry: NotificationProviderRegistry
let emailProvider: MockNotificationProvider
let inAppProvider: MockNotificationProvider
let notifications: NotificationService
let preferences: PreferenceService
let delivery: DeliveryService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  registry = createProviderRegistry()
  emailProvider = new MockNotificationProvider('EMAIL', 'smtp')
  inAppProvider = new MockNotificationProvider('IN_APP', 'internal_message_center')
  registry.register(emailProvider)
  registry.register(inAppProvider)

  notifications = new NotificationService(repos)
  preferences = new PreferenceService(repos)
  delivery = new DeliveryService(repos, registry)

  const templates = new TemplateService(repos)
  await templates.registerTemplate({
    code: 'T1', name: 'N', subjectTemplate: 'S {{x}}', bodyTemplate: 'B {{x}}',
    requiredVariables: ['x'], channels: ['EMAIL', 'IN_APP'],
  })
})

async function createNotification(recipients: { userId: string; channelType: 'EMAIL' | 'IN_APP'; address: string }[]) {
  return notifications.createNotification({
    templateCode: 'T1', variables: { x: '1' }, recipients, createdBy: 'tester',
  })
}

describe('queueNotification', () => {
  it('creates one delivery per recipient', async () => {
    const n = await createNotification([
      { userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' },
      { userId: 'u2', channelType: 'IN_APP', address: 'u2' },
    ])
    const deliveries = await delivery.queueNotification(n.id)
    expect(deliveries).toHaveLength(2)
  })

  it('skips recipients who have opted out and marks them CANCELLED', async () => {
    await preferences.setPreference('u1', 'EMAIL', false)
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const deliveries = await delivery.queueNotification(n.id)
    expect(deliveries).toHaveLength(0)
    const recipients = await repos.recipients.findByNotificationId(n.id)
    expect(recipients[0].status).toBe('CANCELLED')
  })

  it('throws CHANNEL_NOT_CONFIGURED when no provider is registered for the channel', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'IN_APP', address: 'u1' }])
    const emptyRegistry = createProviderRegistry()
    const noProviderDelivery = new DeliveryService(repos, emptyRegistry)
    await expect(noProviderDelivery.queueNotification(n.id)).rejects.toThrow(NotificationError)
  })

  it('throws NOTIFICATION_NOT_FOUND for an unknown notification id', async () => {
    await expect(delivery.queueNotification('missing')).rejects.toThrow(NotificationError)
  })

  it('records a NOTIFICATION_QUEUED audit event', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    await delivery.queueNotification(n.id)
    const events = await repos.auditEvents.findByEventType('NOTIFICATION_QUEUED')
    expect(events).toHaveLength(1)
  })

  it('only queues recipients still in QUEUED status', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const first = await delivery.queueNotification(n.id)
    const second = await delivery.queueNotification(n.id)
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0) // recipient already progressed past QUEUED after first pass
  })
})

describe('sendNotification', () => {
  it('routes to the correct channel provider and marks SENT', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    const sent = await delivery.sendNotification(d.id)
    expect(sent.status).toBe('SENT')
    expect(sent.providerMessageId).toBeTruthy()
    expect(emailProvider.getSent()).toHaveLength(1)
    expect(inAppProvider.getSent()).toHaveLength(0)
  })

  it('never routes EMAIL recipients through the IN_APP provider', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'IN_APP', address: 'u1' }])
    const [d] = await delivery.queueNotification(n.id)
    await delivery.sendNotification(d.id)
    expect(inAppProvider.getSent()).toHaveLength(1)
    expect(emailProvider.getSent()).toHaveLength(0)
  })

  it('marks FAILED (not throw) when the provider send() rejects', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    emailProvider.simulateFailure()
    const result = await delivery.sendNotification(d.id)
    expect(result.status).toBe('FAILED')
    expect(result.failureReason).toBeTruthy()
  })

  it('updates the recipient status to SENT on success', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    await delivery.sendNotification(d.id)
    const recipients = await repos.recipients.findByNotificationId(n.id)
    expect(recipients[0].status).toBe('SENT')
  })

  it('throws PROVIDER_NOT_REGISTERED when channel has no provider', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    const emptyDelivery = new DeliveryService(repos, createProviderRegistry())
    await expect(emptyDelivery.sendNotification(d.id)).rejects.toThrow(NotificationError)
  })

  it('throws DELIVERY_NOT_FOUND for unknown delivery id', async () => {
    await expect(delivery.sendNotification('missing')).rejects.toThrow(NotificationError)
  })
})

describe('retryNotification', () => {
  it('creates a new attempt and re-sends successfully', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    emailProvider.simulateFailure()
    const failed = await delivery.sendNotification(d.id)
    expect(failed.status).toBe('FAILED')

    const retried = await delivery.retryNotification(failed.id)
    expect(retried.status).toBe('SENT')
    expect(retried.attempt).toBe(2)
  })

  it('marks the original delivery RETRIED', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    emailProvider.simulateFailure()
    const failed = await delivery.sendNotification(d.id)
    await delivery.retryNotification(failed.id)
    const original = await repos.deliveries.findById(failed.id)
    expect(original?.status).toBe('RETRIED')
  })

  it('throws RETRY_LIMIT_EXCEEDED once maxAttempts is reached', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)

    let current = d
    for (let attempt = 1; attempt < DEFAULT_RETRY_POLICY.maxAttempts; attempt++) {
      emailProvider.simulateFailure()
      current = await delivery.sendNotification(current.id)
      current = await delivery.retryNotification(current.id)
    }
    // current.attempt is now DEFAULT_RETRY_POLICY.maxAttempts; force one more failure to hit the cap
    emailProvider.simulateFailure()
    current = await delivery.sendNotification(current.id)
    await expect(delivery.retryNotification(current.id)).rejects.toThrow(NotificationError)
  })

  it('throws VALIDATION_FAILED when retrying a non-FAILED delivery', async () => {
    const n = await createNotification([{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }])
    const [d] = await delivery.queueNotification(n.id)
    const sent = await delivery.sendNotification(d.id)
    await expect(delivery.retryNotification(sent.id)).rejects.toThrow(NotificationError)
  })

  it('throws DELIVERY_NOT_FOUND for unknown delivery id', async () => {
    await expect(delivery.retryNotification('missing')).rejects.toThrow(NotificationError)
  })
})

describe('multi-channel dispatch', () => {
  it('a single notification can dispatch simultaneously over EMAIL and IN_APP', async () => {
    const n = await createNotification([
      { userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' },
      { userId: 'u1', channelType: 'IN_APP', address: 'u1' },
    ])
    const deliveries = await delivery.queueNotification(n.id)
    for (const d of deliveries) {
      await delivery.sendNotification(d.id)
    }
    expect(emailProvider.getSent()).toHaveLength(1)
    expect(inAppProvider.getSent()).toHaveLength(1)
  })
})
