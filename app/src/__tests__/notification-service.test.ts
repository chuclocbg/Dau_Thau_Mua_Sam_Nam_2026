import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let templates: TemplateService
let service: NotificationService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  templates = new TemplateService(repos)
  service = new NotificationService(repos)
  await templates.registerTemplate({
    code: 'APPROVAL_NOTICE', name: 'Approval Notice',
    subjectTemplate: 'Approval {{approvalCode}} for {{supplier}}',
    bodyTemplate: 'Amount {{amount}} approved on {{date}}',
    requiredVariables: ['approvalCode', 'supplier', 'amount', 'date'],
    channels: ['EMAIL', 'IN_APP'],
  })
})

const variables = { approvalCode: 'AP-1', supplier: '[Nhà cung cấp số 1]', amount: '1000000', date: '2026-01-01' }

describe('createNotification', () => {
  it('renders the template and persists the notification', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    expect(n.subject).toBe('Approval AP-1 for [Nhà cung cấp số 1]')
    expect(n.body).toBe('Amount 1000000 approved on 2026-01-01')
    expect(n.status).toBe('QUEUED')
  })

  it('creates one recipient row per requested recipient', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [
        { userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' },
        { userId: 'u2', channelType: 'IN_APP', address: 'u2' },
      ],
      createdBy: 'tester',
    })
    const recipients = await repos.recipients.findByNotificationId(n.id)
    expect(recipients).toHaveLength(2)
  })

  it('derives channels as the unique set from recipients', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [
        { userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' },
        { userId: 'u2', channelType: 'EMAIL', address: 'u2@example.com' },
        { userId: 'u3', channelType: 'IN_APP', address: 'u3' },
      ],
      createdBy: 'tester',
    })
    expect(n.channels.sort()).toEqual(['EMAIL', 'IN_APP'])
  })

  it('rejects when there are no recipients', async () => {
    await expect(service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables, recipients: [], createdBy: 'tester',
    })).rejects.toThrow(NotificationError)
  })

  it('rejects an invalid recipient address for EMAIL channel', async () => {
    await expect(service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'not-an-email' }],
      createdBy: 'tester',
    })).rejects.toThrow(NotificationError)
  })

  it('rejects an unknown template code', async () => {
    await expect(service.createNotification({
      templateCode: 'MISSING', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })).rejects.toThrow(NotificationError)
  })

  it('records a NOTIFICATION_CREATED audit event', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    const timeline = await service.getNotificationTimeline(n.id)
    expect(timeline.some(e => e.eventType === 'NOTIFICATION_CREATED')).toBe(true)
  })
})

describe('getNotification / listByModule', () => {
  it('getNotification returns the created notification', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    expect((await service.getNotification(n.id))?.id).toBe(n.id)
  })

  it('listByModule filters by moduleType+moduleId', async () => {
    await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      moduleType: 'APPROVAL', moduleId: 'a1', createdBy: 'tester',
    })
    const found = await service.listByModule('APPROVAL', 'a1')
    expect(found).toHaveLength(1)
  })
})

describe('cancelNotification', () => {
  it('marks the notification CANCELLED', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    const cancelled = await service.cancelNotification(n.id, 'admin')
    expect(cancelled.status).toBe('CANCELLED')
  })

  it('cancels QUEUED recipients too', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    await service.cancelNotification(n.id, 'admin')
    const recipients = await repos.recipients.findByNotificationId(n.id)
    expect(recipients[0].status).toBe('CANCELLED')
  })

  it('throws NOTIFICATION_NOT_FOUND for unknown id', async () => {
    await expect(service.cancelNotification('missing', 'admin')).rejects.toThrow(NotificationError)
  })

  it('throws NOTIFICATION_CANCELLED when already cancelled', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    await service.cancelNotification(n.id, 'admin')
    await expect(service.cancelNotification(n.id, 'admin')).rejects.toThrow(NotificationError)
  })

  it('throws NOTIFICATION_ALREADY_SENT when already delivered', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    await repos.notifications.markStatus(n.id, 'DELIVERED')
    await expect(service.cancelNotification(n.id, 'admin')).rejects.toThrow(NotificationError)
  })
})

describe('markDelivered / markFailed', () => {
  async function createDelivery() {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    const recipients = await repos.recipients.findByNotificationId(n.id)
    const delivery = await repos.deliveries.create({
      notificationId: n.id, recipientId: recipients[0].id, channelType: 'EMAIL', providerType: 'smtp', status: 'QUEUED', attempt: 1,
    })
    return { notification: n, delivery, recipientId: recipients[0].id }
  }

  it('markDelivered sets status DELIVERED and deliveredAt', async () => {
    const { delivery } = await createDelivery()
    const updated = await service.markDelivered(delivery.id)
    expect(updated.status).toBe('DELIVERED')
    expect(updated.deliveredAt).toBeTruthy()
  })

  it('markDelivered updates the recipient status', async () => {
    const { delivery, recipientId } = await createDelivery()
    await service.markDelivered(delivery.id)
    const recipient = await repos.recipients.findById(recipientId)
    expect(recipient?.status).toBe('DELIVERED')
  })

  it('markDelivered syncs Notification.status to DELIVERED when all recipients delivered', async () => {
    const { notification, delivery } = await createDelivery()
    await service.markDelivered(delivery.id)
    const updated = await service.getNotification(notification.id)
    expect(updated?.status).toBe('DELIVERED')
  })

  it('markDelivered throws DELIVERY_NOT_FOUND for unknown id', async () => {
    await expect(service.markDelivered('missing')).rejects.toThrow(NotificationError)
  })

  it('markFailed sets status FAILED with reason', async () => {
    const { delivery } = await createDelivery()
    const updated = await service.markFailed(delivery.id, 'SMTP timeout')
    expect(updated.status).toBe('FAILED')
    expect(updated.failureReason).toBe('SMTP timeout')
    expect(updated.failedAt).toBeTruthy()
  })

  it('markFailed updates the recipient status', async () => {
    const { delivery, recipientId } = await createDelivery()
    await service.markFailed(delivery.id, 'error')
    const recipient = await repos.recipients.findById(recipientId)
    expect(recipient?.status).toBe('FAILED')
  })

  it('markFailed throws DELIVERY_NOT_FOUND for unknown id', async () => {
    await expect(service.markFailed('missing', 'x')).rejects.toThrow(NotificationError)
  })
})

describe('getNotificationTimeline', () => {
  it('returns events sorted by occurredAt', async () => {
    const n = await service.createNotification({
      templateCode: 'APPROVAL_NOTICE', variables,
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@example.com' }],
      createdBy: 'tester',
    })
    await service.cancelNotification(n.id, 'admin')
    const timeline = await service.getNotificationTimeline(n.id)
    expect(timeline.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].occurredAt >= timeline[i - 1].occurredAt).toBe(true)
    }
  })

  it('returns empty array for a notification with no events', async () => {
    expect(await service.getNotificationTimeline('no-such-id')).toEqual([])
  })
})
