import type { NotificationPreference, ChannelType } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import { isInQuietHours } from '../domain/scheduling.ts'
import { buildPreference } from './notificationFactory.ts'

// ── PreferenceService ──────────────────────────────────────────────────────────

export class PreferenceService {
  constructor(private readonly repos: NotificationRepositories) {}

  async setPreference(
    userId: string,
    channelType: ChannelType,
    isOptedIn: boolean,
    quietHoursStart?: string,
    quietHoursEnd?: string,
  ): Promise<NotificationPreference> {
    const existing = await this.repos.preferences.findByUserAndChannel(userId, channelType)
    const params = buildPreference(userId, channelType, isOptedIn, quietHoursStart, quietHoursEnd)

    const saved = existing
      ? await this.repos.preferences.update(existing.id, params)
      : await this.repos.preferences.create(params)

    await this.repos.auditEvents.append({
      eventType: 'PREFERENCE_UPDATED',
      userId,
      outcome: 'SUCCESS',
      occurredAt: new Date().toISOString(),
      metadata: { channelType, isOptedIn: String(isOptedIn) },
    })

    return saved
  }

  async getPreference(userId: string, channelType: ChannelType): Promise<NotificationPreference | null> {
    return this.repos.preferences.findByUserAndChannel(userId, channelType)
  }

  /** Defaults to opted-in when no explicit preference has been recorded. */
  async isOptedIn(userId: string, channelType: ChannelType): Promise<boolean> {
    const pref = await this.repos.preferences.findByUserAndChannel(userId, channelType)
    return pref ? pref.isOptedIn : true
  }

  /**
   * True if the current time falls within the user's configured quiet hours for the channel.
   * ponytail: recorded and queryable, but DeliveryService does not yet consult this before
   * sending — quiet-hours-aware dispatch deferral is a scheduling refinement for a later phase.
   */
  async isQuietNow(userId: string, channelType: ChannelType, currentTime: string): Promise<boolean> {
    const pref = await this.repos.preferences.findByUserAndChannel(userId, channelType)
    if (!pref?.quietHoursStart || !pref.quietHoursEnd) return false
    return isInQuietHours(currentTime, pref.quietHoursStart, pref.quietHoursEnd)
  }
}
