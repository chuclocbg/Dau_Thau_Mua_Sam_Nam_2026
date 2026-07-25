import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { DeliveryService } from '../notification/application/deliveryService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import type { ChannelType } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let notifications: NotificationService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  notifications = new NotificationService(repos)
  const templates = new TemplateService(repos)
  await templates.registerTemplate({
    code: 'MULTI', name: 'Multi-channel', subjectTemplate: 'S {{x}}', bodyTemplate: 'B {{x}}',
    requiredVariables: ['x'], channels: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK'],
  })
})

const cases: { channel: ChannelType; provider: string; address: string }[] = [
  { channel: 'SMS', provider: 'sms_gateway', address: '+84901234567' },
  { channel: 'PUSH', provider: 'fcm', address: 'device-token-abc' },
  { channel: 'WEBHOOK', provider: 'government_notification_gateway', address: 'https://gov.example/webhook' },
]

describe.each(cases)('DeliveryService routes $channel through its own provider', ({ channel, provider, address }) => {
  it('sends successfully and never touches another channel\'s provider', async () => {
    const registry = createProviderRegistry()
    const target = new MockNotificationProvider(channel, provider as never)
    const other = new MockNotificationProvider(channel === 'SMS' ? 'PUSH' : 'SMS', 'fcm')
    registry.register(target)
    registry.register(other)
    const delivery = new DeliveryService(repos, registry)

    const n = await notifications.createNotification({
      templateCode: 'MULTI', variables: { x: '1' },
      recipients: [{ userId: 'u1', channelType: channel, address }],
      createdBy: 'tester',
    })
    const [d] = await delivery.queueNotification(n.id)
    const sent = await delivery.sendNotification(d.id)

    expect(sent.status).toBe('SENT')
    expect(sent.providerType).toBe(provider)
    expect(target.getSent()).toHaveLength(1)
    expect(other.getSent()).toHaveLength(0)
  })
})

describe('NotificationService edge cases', () => {
  it('getNotification returns null for an unknown id', async () => {
    expect(await notifications.getNotification('missing')).toBeNull()
  })

  it('listByModule returns empty array when nothing matches', async () => {
    expect(await notifications.listByModule('PAYMENT', 'p-404')).toEqual([])
  })

  it('createNotification with multiple channels for the same user creates one recipient per channel', async () => {
    const n = await notifications.createNotification({
      templateCode: 'MULTI', variables: { x: '1' },
      recipients: [
        { userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' },
        { userId: 'u1', channelType: 'SMS', address: '+84900000000' },
        { userId: 'u1', channelType: 'WEBHOOK', address: 'https://x.example/hook' },
      ],
      createdBy: 'tester',
    })
    const recipients = await repos.recipients.findByNotificationId(n.id)
    expect(recipients).toHaveLength(3)
    expect([...n.channels].sort()).toEqual(['EMAIL', 'SMS', 'WEBHOOK'])
  })
})

describe('Priority propagation', () => {
  it('CRITICAL priority notifications are created and stored as CRITICAL', async () => {
    const n = await notifications.createNotification({
      templateCode: 'MULTI', variables: { x: '1' }, priority: 'CRITICAL',
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }],
      createdBy: 'tester',
    })
    expect(n.priority).toBe('CRITICAL')
  })

  it('LOW priority is preserved end to end', async () => {
    const n = await notifications.createNotification({
      templateCode: 'MULTI', variables: { x: '1' }, priority: 'LOW',
      recipients: [{ userId: 'u1', channelType: 'EMAIL', address: 'u1@x.com' }],
      createdBy: 'tester',
    })
    expect((await notifications.getNotification(n.id))?.priority).toBe('LOW')
  })
})
