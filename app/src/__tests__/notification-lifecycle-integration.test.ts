import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { DeliveryService } from '../notification/application/deliveryService.ts'
import { SchedulingService } from '../notification/application/schedulingService.ts'
import { BatchService } from '../notification/application/batchService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { PreferenceService } from '../notification/application/preferenceService.ts'
import { EventRuleService } from '../notification/application/eventRuleService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'
import { InAppNotificationProvider } from '../notification/infrastructure/providers/inAppNotificationProvider.ts'
import { buildChannel } from '../notification/application/notificationFactory.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import type { NotificationProviderRegistry } from '../notification/types/providerTypes.ts'

let repos: NotificationRepositories
let registry: NotificationProviderRegistry
let emailProvider: MockNotificationProvider
let inAppProvider: InAppNotificationProvider
let notifications: NotificationService
let delivery: DeliveryService
let scheduling: SchedulingService
let batch: BatchService
let templates: TemplateService
let preferences: PreferenceService
let eventRules: EventRuleService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  registry = createProviderRegistry()
  emailProvider = new MockNotificationProvider('EMAIL', 'smtp')
  inAppProvider = new InAppNotificationProvider()
  registry.register(emailProvider)
  registry.register(inAppProvider)

  notifications = new NotificationService(repos)
  delivery = new DeliveryService(repos, registry)
  scheduling = new SchedulingService(repos, notifications, delivery)
  batch = new BatchService(repos, notifications, delivery)
  templates = new TemplateService(repos)
  preferences = new PreferenceService(repos)
  eventRules = new EventRuleService(repos, notifications)

  await templates.registerTemplate({
    code: 'APPROVAL_NOTICE', name: 'Approval Notice',
    subjectTemplate: 'Approval {{approvalCode}} — {{status}}',
    bodyTemplate: 'Package {{packageCode}} approved by {{recipient}} on {{date}}',
    requiredVariables: ['approvalCode', 'status', 'packageCode', 'recipient', 'date'],
    channels: ['EMAIL', 'IN_APP'],
  })
})

describe('end-to-end: event-driven trigger through delivery and timeline', () => {
  it('an APPROVAL_REQUESTED event fires a matching rule, delivers over two channels, and the timeline records every step', async () => {
    await eventRules.registerRule({
      eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE',
      channels: ['EMAIL', 'IN_APP'], priority: 'HIGH', conditions: { status: 'PENDING' },
    })

    const event = await eventRules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'ap-1', {
      approvalCode: 'AP-1', status: 'PENDING', packageCode: 'PKG-9',
      recipient: '[Tổ trưởng tổ chuyên gia]', date: '2026-03-01',
    })

    const recipients = [
      { userId: 'u1', channelType: 'EMAIL' as const, address: 'u1@example.com' },
      { userId: 'u1', channelType: 'IN_APP' as const, address: 'u1' },
    ]
    const [created] = await eventRules.triggerFromEvent(event, recipients, 'system')
    expect(created.priority).toBe('HIGH')
    expect(created.ruleId).toBeTruthy()

    const deliveries = await delivery.queueNotification(created.id)
    expect(deliveries).toHaveLength(2)
    for (const d of deliveries) {
      const sent = await delivery.sendNotification(d.id)
      expect(sent.status).toBe('SENT')
    }

    expect(emailProvider.getSent()).toHaveLength(1)
    expect(inAppProvider.getInbox('u1')).toHaveLength(1)

    const timeline = await notifications.getNotificationTimeline(created.id)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_CREATED')).toBe(true)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_QUEUED')).toBe(true)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_SENT')).toBe(true)
  })

  it('an opted-out recipient never appears in the delivered set even for HIGH priority rules', async () => {
    await preferences.setPreference('u1', 'EMAIL', false)
    await eventRules.registerRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    const event = await eventRules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'ap-2', {
      approvalCode: 'AP-2', status: 'PENDING', packageCode: 'PKG-1', recipient: 'X', date: '2026-01-01',
    })
    const [created] = await eventRules.triggerFromEvent(
      event, [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }], 'system',
    )
    const deliveries = await delivery.queueNotification(created.id)
    expect(deliveries).toHaveLength(0)
    expect(emailProvider.getSent()).toHaveLength(0)
  })
})

describe('end-to-end: failure, retry, and eventual delivery', () => {
  it('recovers a notification after one failed attempt via retryNotification', async () => {
    const n = await notifications.createNotification({
      templateCode: 'APPROVAL_NOTICE',
      variables: { approvalCode: 'AP-3', status: 'PENDING', packageCode: 'PKG-3', recipient: 'X', date: '2026-01-01' },
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    const [d] = await delivery.queueNotification(n.id)

    emailProvider.simulateFailure()
    const failed = await delivery.sendNotification(d.id)
    expect(failed.status).toBe('FAILED')

    const retried = await delivery.retryNotification(failed.id)
    expect(retried.status).toBe('SENT')

    await notifications.markDelivered(retried.id)
    const updated = await notifications.getNotification(n.id)
    expect(updated?.status).toBe('DELIVERED')

    const timeline = await notifications.getNotificationTimeline(n.id)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_FAILED')).toBe(true)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_RETRIED')).toBe(true)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_DELIVERED')).toBe(true)
  })
})

describe('end-to-end: bulk batch with mixed outcomes', () => {
  it('sends a batch where some recipients fail and the rest succeed', async () => {
    const requests = ['A', 'B', 'C'].map((name, i) => ({
      variables: { approvalCode: `AP-${i}`, status: 'PENDING', packageCode: 'PKG', recipient: name, date: '2026-01-01' },
      recipients: [{ userId: `u${i}`, channelType: 'EMAIL' as const, address: `u${i}@x.com` }],
      createdBy: 'admin',
    }))
    const b = await batch.createBatch('Approval digest', 'APPROVAL_NOTICE', requests, 'admin')

    emailProvider.simulateFailure() // fails exactly the first send

    const result = await batch.sendBatch(b.id)
    expect(result.sentCount).toBe(2)
    expect(result.failedCount).toBe(1)
    expect(result.status).toBe('COMPLETED')
  })
})

describe('end-to-end: recurring schedule across multiple due cycles', () => {
  it('a weekly recurring notification fires once per processDueSchedules call until exhausted', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'APPROVAL_NOTICE',
      variables: { approvalCode: 'AP-R', status: 'PENDING', packageCode: 'PKG', recipient: 'X', date: '2026-01-01' },
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }],
      mode: 'RECURRING',
      scheduleTime: {
        scheduledAt: '2026-01-01T00:00:00Z',
        recurrence: { frequency: 'WEEKLY', interval: 1, occurrenceCount: 2 },
      },
      createdBy: 'tester',
    }, '2025-12-01T00:00:00Z')

    const firstPass = await scheduling.processDueSchedules('2026-01-01T00:00:00Z')
    expect(firstPass).toHaveLength(1)
    expect(emailProvider.getSent()).toHaveLength(1)

    const [afterFirst] = await repos.notifications.findAll()
    expect(afterFirst.status).toBe('QUEUED')
    expect(afterFirst.scheduleTime?.scheduledAt).toBe('2026-01-08T00:00:00.000Z')

    const secondPass = await scheduling.processDueSchedules('2026-01-08T00:00:00Z')
    expect(secondPass).toHaveLength(1)
    expect(emailProvider.getSent()).toHaveLength(2)

    const [afterSecond] = await repos.notifications.findAll()
    expect(afterSecond.status).toBe('EXPIRED')

    const thirdPass = await scheduling.processDueSchedules('2026-01-15T00:00:00Z')
    expect(thirdPass).toHaveLength(0)
    expect(emailProvider.getSent()).toHaveLength(2)
  })
})

describe('NotificationChannel configuration entity', () => {
  it('stores per-channel provider configuration independent of business logic', async () => {
    const channel = await repos.channels.create(buildChannel({
      channelType: 'EMAIL', providerType: 'microsoft_graph', priority: 1, config: { tenantId: 't-1' },
    }))
    expect(channel.providerType).toBe('microsoft_graph')
    const enabled = await repos.channels.findEnabled()
    expect(enabled.map(c => c.id)).toContain(channel.id)
  })

  it('a disabled channel is excluded from findEnabled', async () => {
    const channel = await repos.channels.create(buildChannel({ channelType: 'SMS', providerType: 'sms_gateway' }))
    await repos.channels.update(channel.id, { isEnabled: false })
    const enabled = await repos.channels.findEnabled()
    expect(enabled.map(c => c.id)).not.toContain(channel.id)
  })
})

describe('cross-cutting: cancel prevents further delivery', () => {
  it('a cancelled notification cannot be queued for delivery again after cancellation', async () => {
    const n = await notifications.createNotification({
      templateCode: 'APPROVAL_NOTICE',
      variables: { approvalCode: 'AP-C', status: 'PENDING', packageCode: 'PKG', recipient: 'X', date: '2026-01-01' },
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }],
      createdBy: 'tester',
    })
    await notifications.cancelNotification(n.id, 'admin')

    const deliveries = await delivery.queueNotification(n.id)
    expect(deliveries).toHaveLength(0) // recipient already CANCELLED, not QUEUED
    expect(emailProvider.getSent()).toHaveLength(0)
  })
})
