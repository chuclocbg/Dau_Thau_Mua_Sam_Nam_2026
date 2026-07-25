import { describe, it, expect } from 'vitest'
import { NOTIFICATION_PROVIDER_TYPES, createProviderRegistry } from '../notification/types/providerTypes.ts'
import { MockNotificationProvider } from '../notification/infrastructure/providers/mockNotificationProvider.ts'

describe('Notification provider types', () => {
  it('includes all 8 supported providers', () => {
    expect(NOTIFICATION_PROVIDER_TYPES).toEqual([
      'smtp', 'microsoft_graph', 'sms_gateway', 'zalo_oa', 'fcm',
      'web_push', 'internal_message_center', 'government_notification_gateway',
    ])
  })
})

describe('createProviderRegistry', () => {
  it('registers and resolves a provider by channel type', () => {
    const registry = createProviderRegistry()
    const provider = new MockNotificationProvider('EMAIL', 'smtp')
    registry.register(provider)
    expect(registry.resolve('EMAIL')).toBe(provider)
  })

  it('returns undefined for an unregistered channel', () => {
    const registry = createProviderRegistry()
    expect(registry.resolve('SMS')).toBeUndefined()
  })

  it('lists all registered channels', () => {
    const registry = createProviderRegistry()
    registry.register(new MockNotificationProvider('EMAIL', 'smtp'))
    registry.register(new MockNotificationProvider('SMS', 'sms_gateway'))
    expect([...registry.listChannels()].sort()).toEqual(['EMAIL', 'SMS'])
  })

  it('overwrites a previously registered provider for the same channel', () => {
    const registry = createProviderRegistry()
    const first = new MockNotificationProvider('PUSH', 'fcm')
    const second = new MockNotificationProvider('PUSH', 'web_push')
    registry.register(first)
    registry.register(second)
    expect(registry.resolve('PUSH')).toBe(second)
  })

  it('business logic never sees provider identity — only ChannelType is used to resolve', () => {
    const registry = createProviderRegistry()
    const provider = new MockNotificationProvider('WEBHOOK', 'government_notification_gateway')
    registry.register(provider)
    const resolved = registry.resolve('WEBHOOK')
    expect(resolved?.channelType).toBe('WEBHOOK')
  })
})

describe('MockNotificationProvider', () => {
  it('sends and records the message', async () => {
    const provider = new MockNotificationProvider('EMAIL')
    const result = await provider.send({ address: 'a@b.com', subject: 'Hi', body: 'Body' })
    expect(result.providerMessageId).toBeTruthy()
    expect(result.sentAt).toBeTruthy()
    expect(provider.getSent()).toHaveLength(1)
  })

  it('simulateFailure causes the next send to throw once', async () => {
    const provider = new MockNotificationProvider('EMAIL')
    provider.simulateFailure()
    await expect(provider.send({ address: 'a@b.com', subject: 'Hi', body: 'Body' })).rejects.toThrow()
    const result = await provider.send({ address: 'a@b.com', subject: 'Hi', body: 'Body' })
    expect(result.providerMessageId).toBeTruthy()
  })

  it('clear() empties the sent log', async () => {
    const provider = new MockNotificationProvider('EMAIL')
    await provider.send({ address: 'a@b.com', subject: 'Hi', body: 'Body' })
    provider.clear()
    expect(provider.getSent()).toHaveLength(0)
  })
})
