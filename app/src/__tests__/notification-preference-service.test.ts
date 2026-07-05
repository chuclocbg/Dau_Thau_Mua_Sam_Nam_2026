import { describe, it, expect, beforeEach } from 'vitest'
import { PreferenceService } from '../notification/application/preferenceService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'

let repos: NotificationRepositories
let service: PreferenceService

beforeEach(() => {
  repos = buildMemoryNotificationRepositories()
  service = new PreferenceService(repos)
})

describe('setPreference', () => {
  it('creates a new preference', async () => {
    const p = await service.setPreference('u1', 'EMAIL', false)
    expect(p.isOptedIn).toBe(false)
  })

  it('updates an existing preference for the same user+channel', async () => {
    await service.setPreference('u1', 'EMAIL', true)
    const updated = await service.setPreference('u1', 'EMAIL', false)
    expect(updated.isOptedIn).toBe(false)
    expect(await repos.preferences.count()).toBe(1)
  })

  it('records a PREFERENCE_UPDATED audit event', async () => {
    await service.setPreference('u1', 'SMS', true)
    const events = await repos.auditEvents.findByEventType('PREFERENCE_UPDATED')
    expect(events).toHaveLength(1)
  })
})

describe('getPreference', () => {
  it('returns null when no preference recorded', async () => {
    expect(await service.getPreference('u1', 'EMAIL')).toBeNull()
  })

  it('returns the recorded preference', async () => {
    await service.setPreference('u1', 'PUSH', true, '22:00', '06:00')
    const p = await service.getPreference('u1', 'PUSH')
    expect(p?.quietHoursStart).toBe('22:00')
  })
})

describe('isOptedIn', () => {
  it('defaults to true with no explicit preference', async () => {
    expect(await service.isOptedIn('u1', 'EMAIL')).toBe(true)
  })

  it('reflects an explicit opt-out', async () => {
    await service.setPreference('u1', 'EMAIL', false)
    expect(await service.isOptedIn('u1', 'EMAIL')).toBe(false)
  })

  it('reflects an explicit opt-in', async () => {
    await service.setPreference('u1', 'EMAIL', true)
    expect(await service.isOptedIn('u1', 'EMAIL')).toBe(true)
  })
})

describe('isQuietNow', () => {
  it('false when no quiet hours configured', async () => {
    await service.setPreference('u1', 'EMAIL', true)
    expect(await service.isQuietNow('u1', 'EMAIL', '23:00')).toBe(false)
  })

  it('true within configured quiet hours', async () => {
    await service.setPreference('u1', 'EMAIL', true, '22:00', '06:00')
    expect(await service.isQuietNow('u1', 'EMAIL', '23:00')).toBe(true)
  })

  it('false outside configured quiet hours', async () => {
    await service.setPreference('u1', 'EMAIL', true, '22:00', '06:00')
    expect(await service.isQuietNow('u1', 'EMAIL', '12:00')).toBe(false)
  })
})
