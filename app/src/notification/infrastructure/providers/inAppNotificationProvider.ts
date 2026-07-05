/**
 * Internal Message Center provider — a genuine (non-mock) IN_APP channel
 * implementation. In-app messages never leave the process, so there is no
 * external dependency to abstract: the "provider" is simply an inbox.
 */

import type { SendParams, ProviderSendResult, INotificationProvider } from '../../types/providerTypes.ts'

export interface InboxMessage {
  readonly id: string
  readonly address: string             // userId
  readonly subject: string
  readonly body: string
  readonly sentAt: string
  readonly readAt?: string
}

export class InAppNotificationProvider implements INotificationProvider {
  readonly providerId = 'internal-message-center'
  readonly providerType = 'internal_message_center' as const
  readonly channelType = 'IN_APP' as const

  private readonly inbox = new Map<string, InboxMessage[]>()   // userId → messages

  async send(params: SendParams): Promise<ProviderSendResult> {
    const message: InboxMessage = {
      id: crypto.randomUUID(),
      address: params.address,
      subject: params.subject,
      body: params.body,
      sentAt: new Date().toISOString(),
    }
    const existing = this.inbox.get(params.address) ?? []
    existing.push(message)
    this.inbox.set(params.address, existing)
    return { providerMessageId: message.id, sentAt: message.sentAt }
  }

  // ── Inbox access ─────────────────────────────────────────────────────────────

  getInbox(userId: string): readonly InboxMessage[] {
    return this.inbox.get(userId) ?? []
  }

  markRead(userId: string, messageId: string): void {
    const messages = this.inbox.get(userId)
    if (!messages) return
    const idx = messages.findIndex(m => m.id === messageId)
    if (idx === -1) return
    messages[idx] = { ...messages[idx], readAt: new Date().toISOString() }
  }

  unreadCount(userId: string): number {
    return this.getInbox(userId).filter(m => m.readAt === undefined).length
  }
}
