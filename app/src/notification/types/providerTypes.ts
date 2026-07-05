import type { ChannelType } from './notificationTypes.ts'

// ── Provider discriminator ────────────────────────────────────────────────────
// Business modules and application services never reference these — only
// ChannelType. See NotificationProviderRegistry below (Map lookup, no switch/if).

export const NOTIFICATION_PROVIDER_TYPES = [
  'smtp', 'microsoft_graph', 'sms_gateway', 'zalo_oa', 'fcm',
  'web_push', 'internal_message_center', 'government_notification_gateway',
] as const
export type NotificationProviderType = typeof NOTIFICATION_PROVIDER_TYPES[number]

// ── INotificationProvider — the only surface a provider implements ───────────

export interface SendParams {
  readonly address: string
  readonly subject: string
  readonly body: string
  readonly metadata?: Readonly<Record<string, string>>
}

export interface ProviderSendResult {
  readonly providerMessageId: string
  readonly sentAt: string
}

export interface INotificationProvider {
  readonly providerId: string
  readonly providerType: NotificationProviderType
  readonly channelType: ChannelType

  /** Send a single message. Throws on failure — callers decide retry policy. */
  send(params: SendParams): Promise<ProviderSendResult>
}

// ── NotificationProviderRegistry — pure Map lookup, one active provider per channel ──

export interface NotificationProviderRegistry {
  register(provider: INotificationProvider): void
  resolve(channelType: ChannelType): INotificationProvider | undefined
  listChannels(): readonly ChannelType[]
}

export function createProviderRegistry(): NotificationProviderRegistry {
  const byChannel = new Map<ChannelType, INotificationProvider>()
  return {
    register(provider: INotificationProvider): void {
      byChannel.set(provider.channelType, provider)
    },
    resolve(channelType: ChannelType): INotificationProvider | undefined {
      return byChannel.get(channelType)
    },
    listChannels(): readonly ChannelType[] {
      return Array.from(byChannel.keys())
    },
  }
}
