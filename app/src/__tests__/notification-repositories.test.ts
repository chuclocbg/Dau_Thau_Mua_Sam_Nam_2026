import { describe, it, expect, beforeEach } from 'vitest'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import {
  buildNotification, buildRecipient, buildChannel, buildTemplate,
  buildDelivery, buildBatch, buildPreference, buildRule, buildEvent,
} from '../notification/application/notificationFactory.ts'

let repos: NotificationRepositories

beforeEach(() => {
  repos = buildMemoryNotificationRepositories()
})

describe('INotificationRepository', () => {
  it('create/findById round-trip', async () => {
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
    }))
    expect(await repos.notifications.findById(n.id)).toEqual(n)
  })

  it('findByModule filters by moduleType+moduleId', async () => {
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], moduleType: 'APPROVAL', moduleId: 'a1', createdBy: 'u1',
    }))
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], moduleType: 'APPROVAL', moduleId: 'a2', createdBy: 'u1',
    }))
    const found = await repos.notifications.findByModule('APPROVAL', 'a1')
    expect(found).toHaveLength(1)
  })

  it('findByBatchId filters correctly', async () => {
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], batchId: 'batch-1', createdBy: 'u1',
    }))
    expect(await repos.notifications.findByBatchId('batch-1')).toHaveLength(1)
    expect(await repos.notifications.findByBatchId('batch-2')).toHaveLength(0)
  })

  it('findByStatus filters correctly', async () => {
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
    }))
    await repos.notifications.markStatus(n.id, 'CANCELLED')
    expect(await repos.notifications.findByStatus('CANCELLED')).toHaveLength(1)
    expect(await repos.notifications.findByStatus('QUEUED')).toHaveLength(0)
  })

  it('findDueSchedules returns only QUEUED notifications with scheduledAt <= asOf', async () => {
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
      scheduleTime: { scheduledAt: '2026-01-01T00:00:00Z' },
    }))
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
      scheduleTime: { scheduledAt: '2027-01-01T00:00:00Z' },
    }))
    const due = await repos.notifications.findDueSchedules('2026-06-01T00:00:00Z')
    expect(due).toHaveLength(1)
  })

  it('markStatus updates status', async () => {
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
    }))
    const updated = await repos.notifications.markStatus(n.id, 'SENT')
    expect(updated.status).toBe('SENT')
  })

  it('count() reflects created rows', async () => {
    await repos.notifications.create(buildNotification({ templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1' }))
    expect(await repos.notifications.count()).toBe(1)
  })
})

describe('IRecipientRepository', () => {
  it('findByNotificationId filters correctly', async () => {
    await repos.recipients.create(buildRecipient('n1', 'u1', 'u1@x.com', 'EMAIL'))
    await repos.recipients.create(buildRecipient('n2', 'u2', 'u2@x.com', 'EMAIL'))
    expect(await repos.recipients.findByNotificationId('n1')).toHaveLength(1)
  })

  it('markStatus updates status', async () => {
    const r = await repos.recipients.create(buildRecipient('n1', 'u1', 'u1@x.com', 'EMAIL'))
    const updated = await repos.recipients.markStatus(r.id, 'DELIVERED')
    expect(updated.status).toBe('DELIVERED')
  })
})

describe('IChannelRepository', () => {
  it('findByChannelType filters correctly', async () => {
    await repos.channels.create(buildChannel({ channelType: 'EMAIL', providerType: 'smtp' }))
    await repos.channels.create(buildChannel({ channelType: 'SMS', providerType: 'zalo_oa' }))
    expect(await repos.channels.findByChannelType('EMAIL')).toHaveLength(1)
  })

  it('findEnabled filters isEnabled=true', async () => {
    const c = await repos.channels.create(buildChannel({ channelType: 'EMAIL', providerType: 'smtp' }))
    await repos.channels.update(c.id, { isEnabled: false })
    expect(await repos.channels.findEnabled()).toHaveLength(0)
  })
})

describe('ITemplateRepository', () => {
  it('findByCode returns the matching template', async () => {
    await repos.templates.create(buildTemplate({
      code: 'T1', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    }))
    const found = await repos.templates.findByCode('T1')
    expect(found?.code).toBe('T1')
  })

  it('findByCode returns null when not found', async () => {
    expect(await repos.templates.findByCode('MISSING')).toBeNull()
  })

  it('findActive filters by isActive', async () => {
    const t = await repos.templates.create(buildTemplate({
      code: 'T1', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    }))
    await repos.templates.update(t.id, { isActive: false })
    expect(await repos.templates.findActive()).toHaveLength(0)
  })
})

describe('IDeliveryRepository', () => {
  it('findByNotificationId / findByRecipientId / findByStatus', async () => {
    const d = await repos.deliveries.create(buildDelivery('n1', 'r1', 'EMAIL', 'smtp', 1))
    expect(await repos.deliveries.findByNotificationId('n1')).toHaveLength(1)
    expect(await repos.deliveries.findByRecipientId('r1')).toHaveLength(1)
    expect(await repos.deliveries.findByStatus('QUEUED')).toHaveLength(1)
    expect(d.attempt).toBe(1)
  })

  it('markStatus applies extra fields', async () => {
    const d = await repos.deliveries.create(buildDelivery('n1', 'r1', 'EMAIL', 'smtp', 1))
    const updated = await repos.deliveries.markStatus(d.id, 'SENT', { sentAt: '2026-01-01T00:00:00Z', providerMessageId: 'msg-1' })
    expect(updated.status).toBe('SENT')
    expect(updated.sentAt).toBe('2026-01-01T00:00:00Z')
    expect(updated.providerMessageId).toBe('msg-1')
  })
})

describe('IBatchRepository', () => {
  it('incrementCounts adds deltas to existing counts', async () => {
    const b = await repos.batches.create(buildBatch('Digest', 'T1', 10, 'u1'))
    const updated = await repos.batches.incrementCounts(b.id, { sent: 3, failed: 1 })
    expect(updated.sentCount).toBe(3)
    expect(updated.failedCount).toBe(1)
    const again = await repos.batches.incrementCounts(b.id, { sent: 2 })
    expect(again.sentCount).toBe(5)
  })
})

describe('IPreferenceRepository', () => {
  it('findByUserAndChannel returns the matching preference', async () => {
    await repos.preferences.create(buildPreference('u1', 'EMAIL', false))
    const found = await repos.preferences.findByUserAndChannel('u1', 'EMAIL')
    expect(found?.isOptedIn).toBe(false)
  })

  it('findByUserAndChannel returns null when absent', async () => {
    expect(await repos.preferences.findByUserAndChannel('u1', 'EMAIL')).toBeNull()
  })

  it('findByUserId returns all preferences for a user', async () => {
    await repos.preferences.create(buildPreference('u1', 'EMAIL', true))
    await repos.preferences.create(buildPreference('u1', 'SMS', false))
    expect(await repos.preferences.findByUserId('u1')).toHaveLength(2)
  })
})

describe('IRuleRepository', () => {
  it('findByEventType filters correctly', async () => {
    await repos.rules.create(buildRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'T1', channels: ['EMAIL'] }))
    expect(await repos.rules.findByEventType('APPROVAL_REQUESTED')).toHaveLength(1)
    expect(await repos.rules.findByEventType('OTHER')).toHaveLength(0)
  })

  it('findActive filters by isActive', async () => {
    const r = await repos.rules.create(buildRule({ eventType: 'X', templateCode: 'T1', channels: ['EMAIL'] }))
    await repos.rules.update(r.id, { isActive: false })
    expect(await repos.rules.findActive()).toHaveLength(0)
  })
})

describe('IEventRepository', () => {
  it('create/findById round-trip', async () => {
    const e = await repos.events.create(buildEvent('X', 'APPROVAL', 'a1', {}, '2026-01-01T00:00:00Z'))
    expect(await repos.events.findById(e.id)).toEqual(e)
  })

  it('findUnprocessed excludes processed events', async () => {
    const e = await repos.events.create(buildEvent('X', 'APPROVAL', 'a1', {}, '2026-01-01T00:00:00Z'))
    expect(await repos.events.findUnprocessed()).toHaveLength(1)
    await repos.events.markProcessed(e.id, '2026-01-02T00:00:00Z')
    expect(await repos.events.findUnprocessed()).toHaveLength(0)
  })

  it('markProcessed sets processedAt', async () => {
    const e = await repos.events.create(buildEvent('X', 'APPROVAL', 'a1', {}, '2026-01-01T00:00:00Z'))
    const updated = await repos.events.markProcessed(e.id, '2026-01-02T00:00:00Z')
    expect(updated.processedAt).toBe('2026-01-02T00:00:00Z')
  })

  it('findByEventType filters correctly', async () => {
    await repos.events.create(buildEvent('A', 'APPROVAL', 'a1', {}, '2026-01-01T00:00:00Z'))
    await repos.events.create(buildEvent('B', 'APPROVAL', 'a2', {}, '2026-01-01T00:00:00Z'))
    expect(await repos.events.findByEventType('A')).toHaveLength(1)
  })
})
