import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { DeliveryService } from '../notification/application/deliveryService.ts'
import { SchedulingService } from '../notification/application/schedulingService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let provider: MockNotificationProvider
let notifications: NotificationService
let delivery: DeliveryService
let scheduling: SchedulingService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  const registry = createProviderRegistry()
  provider = new MockNotificationProvider('EMAIL', 'smtp')
  registry.register(provider)

  notifications = new NotificationService(repos)
  delivery = new DeliveryService(repos, registry)
  scheduling = new SchedulingService(repos, notifications, delivery)

  const templates = new TemplateService(repos)
  await templates.registerTemplate({
    code: 'T1', name: 'N', subjectTemplate: 'S {{x}}', bodyTemplate: 'B {{x}}',
    requiredVariables: ['x'], channels: ['EMAIL'],
  })
})

const recipients = [{ userId: 'u1', channelType: 'EMAIL' as const, address: 'u1@x.com' }]

describe('scheduleNotification — IMMEDIATE', () => {
  it('creates and sends immediately', async () => {
    const n = await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, createdBy: 'tester',
    })
    expect(provider.getSent()).toHaveLength(1)
    const deliveries = await repos.deliveries.findByNotificationId(n.id)
    expect(deliveries[0].status).toBe('SENT')
  })
})

describe('scheduleNotification — SCHEDULED', () => {
  it('requires a scheduleTime', async () => {
    await expect(scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED', createdBy: 'tester',
    }, '2026-01-01T00:00:00Z')).rejects.toThrow(NotificationError)
  })

  it('rejects a scheduleTime in the past', async () => {
    await expect(scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2020-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2026-01-01T00:00:00Z')).rejects.toThrow(NotificationError)
  })

  it('does not send immediately — remains QUEUED until due', async () => {
    const n = await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2027-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2026-01-01T00:00:00Z')
    expect(provider.getSent()).toHaveLength(0)
    expect(n.status).toBe('QUEUED')
  })
})

describe('processDueSchedules', () => {
  it('dispatches notifications whose scheduledAt has passed', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2026-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')

    const processed = await scheduling.processDueSchedules('2026-06-01T00:00:00Z')
    expect(processed).toHaveLength(1)
    expect(provider.getSent()).toHaveLength(1)
  })

  it('does not dispatch schedules that are not yet due', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2027-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')

    const processed = await scheduling.processDueSchedules('2026-01-01T00:00:00Z')
    expect(processed).toHaveLength(0)
    expect(provider.getSent()).toHaveLength(0)
  })

  it('reschedules a RECURRING notification to its next occurrence', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'RECURRING',
      scheduleTime: { scheduledAt: '2026-01-01T00:00:00Z', recurrence: { frequency: 'DAILY', interval: 1 } },
      createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')

    await scheduling.processDueSchedules('2026-01-01T00:00:00Z')
    const [n] = await repos.notifications.findAll()
    expect(n.status).toBe('QUEUED')
    expect(n.scheduleTime?.scheduledAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('marks a RECURRING notification EXPIRED once occurrenceCount is exhausted', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'RECURRING',
      scheduleTime: {
        scheduledAt: '2026-01-01T00:00:00Z',
        recurrence: { frequency: 'DAILY', interval: 1, occurrenceCount: 1 },
      },
      createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')

    await scheduling.processDueSchedules('2026-01-01T00:00:00Z')
    const [n] = await repos.notifications.findAll()
    expect(n.status).toBe('EXPIRED')
  })

  it('processes multiple due notifications in one pass', async () => {
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2026-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')
    await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'DELAYED',
      scheduleTime: { scheduledAt: '2026-01-02T00:00:00Z' }, createdBy: 'tester',
    }, '2025-01-01T00:00:00Z')

    const processed = await scheduling.processDueSchedules('2026-06-01T00:00:00Z')
    expect(processed).toHaveLength(2)
  })
})

describe('cancelSchedule', () => {
  it('delegates to NotificationService.cancelNotification', async () => {
    const n = await scheduling.scheduleNotification({
      templateCode: 'T1', variables: { x: '1' }, recipients, mode: 'SCHEDULED',
      scheduleTime: { scheduledAt: '2027-01-01T00:00:00Z' }, createdBy: 'tester',
    }, '2026-01-01T00:00:00Z')
    const cancelled = await scheduling.cancelSchedule(n.id, 'admin')
    expect(cancelled.status).toBe('CANCELLED')
  })
})
