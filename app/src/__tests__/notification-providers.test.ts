import { describe, it, expect } from 'vitest'
import { InAppNotificationProvider } from '../notification/infrastructure/providers/inAppNotificationProvider.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'

describe('InAppNotificationProvider', () => {
  it('has the fixed IN_APP channel and internal_message_center provider type', () => {
    const provider = new InAppNotificationProvider()
    expect(provider.channelType).toBe('IN_APP')
    expect(provider.providerType).toBe('internal_message_center')
    expect(provider.providerId).toBe('internal-message-center')
  })

  it('send() delivers a message into the recipient inbox', async () => {
    const provider = new InAppNotificationProvider()
    const result = await provider.send({ address: 'user-1', subject: 'Hi', body: 'Body' })
    expect(result.providerMessageId).toBeTruthy()
    const inbox = provider.getInbox('user-1')
    expect(inbox).toHaveLength(1)
    expect(inbox[0].subject).toBe('Hi')
  })

  it('keeps inboxes isolated per user', async () => {
    const provider = new InAppNotificationProvider()
    await provider.send({ address: 'user-1', subject: 'A', body: 'B' })
    await provider.send({ address: 'user-2', subject: 'C', body: 'D' })
    expect(provider.getInbox('user-1')).toHaveLength(1)
    expect(provider.getInbox('user-2')).toHaveLength(1)
  })

  it('unreadCount reflects unread messages', async () => {
    const provider = new InAppNotificationProvider()
    await provider.send({ address: 'user-1', subject: 'A', body: 'B' })
    await provider.send({ address: 'user-1', subject: 'C', body: 'D' })
    expect(provider.unreadCount('user-1')).toBe(2)
  })

  it('markRead reduces unreadCount', async () => {
    const provider = new InAppNotificationProvider()
    await provider.send({ address: 'user-1', subject: 'A', body: 'B' })
    const [message] = provider.getInbox('user-1')
    provider.markRead('user-1', message.id)
    expect(provider.unreadCount('user-1')).toBe(0)
    expect(provider.getInbox('user-1')[0].readAt).toBeTruthy()
  })

  it('markRead is a no-op for an unknown user or message', () => {
    const provider = new InAppNotificationProvider()
    expect(() => provider.markRead('nobody', 'nothing')).not.toThrow()
  })

  it('empty inbox for a user with no messages', () => {
    const provider = new InAppNotificationProvider()
    expect(provider.getInbox('nobody')).toEqual([])
    expect(provider.unreadCount('nobody')).toBe(0)
  })
})

describe('MockNotificationProvider channel/type wiring', () => {
  it('defaults providerType to internal_message_center when omitted', () => {
    const provider = new MockNotificationProvider('IN_APP')
    expect(provider.providerType).toBe('internal_message_center')
  })

  it('derives providerId from the channel', () => {
    const provider = new MockNotificationProvider('SMS', 'zalo_oa')
    expect(provider.providerId).toBe('mock-sms')
  })
})
