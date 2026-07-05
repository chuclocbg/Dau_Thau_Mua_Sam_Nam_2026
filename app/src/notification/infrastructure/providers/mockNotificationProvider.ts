/**
 * In-memory notification provider for tests and local development.
 * Never makes network calls — safe for jsdom test environment.
 */

import type { ChannelType } from '../../types/notificationTypes.ts'
import type { INotificationProvider, SendParams, ProviderSendResult, NotificationProviderType } from '../../types/providerTypes.ts'

interface SentEntry extends SendParams {
  readonly providerMessageId: string
  readonly sentAt: string
}

export class MockNotificationProvider implements INotificationProvider {
  readonly providerId: string
  readonly providerType: NotificationProviderType
  readonly channelType: ChannelType

  private readonly sent: SentEntry[] = []
  private failNext = false

  constructor(channelType: ChannelType, providerType: NotificationProviderType = 'internal_message_center') {
    this.channelType = channelType
    this.providerType = providerType
    this.providerId = `mock-${channelType.toLowerCase()}`
  }

  async send(params: SendParams): Promise<ProviderSendResult> {
    if (this.failNext) {
      this.failNext = false
      throw new Error(`Mock provider forced failure for ${params.address}`)
    }
    const providerMessageId = crypto.randomUUID()
    const sentAt = new Date().toISOString()
    this.sent.push({ ...params, providerMessageId, sentAt })
    return { providerMessageId, sentAt }
  }

  // ── Test helpers ────────────────────────────────────────────────────────────

  /** Make the next send() call throw, to exercise failure/retry paths. */
  simulateFailure(): void { this.failNext = true }

  getSent(): readonly SentEntry[] { return this.sent }
  clear(): void { this.sent.length = 0 }
}
