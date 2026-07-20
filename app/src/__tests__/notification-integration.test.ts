import { describe, it, expect } from 'vitest'
import {
  resolveDepartmentForNotification, recordEventFromModule, resolveNotificationsForModule,
  NOTIFICATION_SOURCE_MODULES,
} from '../notification/integration/notificationIntegration.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import { buildNotification } from '../notification/application/notificationFactory.ts'
import type { MasterDataRepositories } from '../masterdata/masterdataRepository.ts'
import type { Department } from '../masterdata/masterdataTypes.ts'

function mockMasterData(departments: readonly Department[]): MasterDataRepositories {
  return {
    departments: { findAll: async () => departments } as unknown as MasterDataRepositories['departments'],
  } as unknown as MasterDataRepositories
}

const dept = (code: string): Department => ({
  id: `dept-${code}`, code, name: `Department ${code}`, level: 1,
  isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Department)

describe('NOTIFICATION_SOURCE_MODULES', () => {
  it('lists the 5 frozen business modules that may originate events', () => {
    expect(NOTIFICATION_SOURCE_MODULES).toEqual(['WORKFLOW', 'APPROVAL', 'CONTRACT', 'ACCEPTANCE', 'PAYMENT'])
  })
})

describe('resolveDepartmentForNotification', () => {
  it('resolves the department matching notification.moduleType', async () => {
    const repos = buildMemoryNotificationRepositories()
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'],
      moduleType: 'APPROVAL', moduleId: 'a1', createdBy: 'u1',
    }))
    const masterdata = mockMasterData([dept('APPROVAL'), dept('CONTRACT')])

    const found = await resolveDepartmentForNotification(n, masterdata)
    expect(found?.code).toBe('APPROVAL')
  })

  it('returns null when notification has no moduleType', async () => {
    const repos = buildMemoryNotificationRepositories()
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
    }))
    const masterdata = mockMasterData([dept('APPROVAL')])
    expect(await resolveDepartmentForNotification(n, masterdata)).toBeNull()
  })

  it('returns null when no department matches', async () => {
    const repos = buildMemoryNotificationRepositories()
    const n = await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'],
      moduleType: 'PAYMENT', moduleId: 'p1', createdBy: 'u1',
    }))
    const masterdata = mockMasterData([dept('APPROVAL')])
    expect(await resolveDepartmentForNotification(n, masterdata)).toBeNull()
  })
})

describe('recordEventFromModule', () => {
  it('persists an event tagged with the originating module', async () => {
    const repos = buildMemoryNotificationRepositories()
    const event = await recordEventFromModule('APPROVAL', 'APPROVAL_REQUESTED', 'a1', { amount: '1000' }, repos, '2026-01-01T00:00:00Z')
    expect(event.sourceModule).toBe('APPROVAL')
    expect(event.eventType).toBe('APPROVAL_REQUESTED')
    expect(event.sourceId).toBe('a1')
  })

  it('records an EVENT_RECEIVED audit entry', async () => {
    const repos = buildMemoryNotificationRepositories()
    await recordEventFromModule('CONTRACT', 'CONTRACT_SIGNED', 'c1', {}, repos)
    const events = await repos.auditEvents.findByEventType('EVENT_RECEIVED')
    expect(events).toHaveLength(1)
  })

  it('accepts each of the 5 documented source modules', async () => {
    const repos = buildMemoryNotificationRepositories()
    for (const mod of NOTIFICATION_SOURCE_MODULES) {
      const event = await recordEventFromModule(mod, `${mod}_EVENT`, 'x1', {}, repos)
      expect(event.sourceModule).toBe(mod)
    }
  })
})

describe('resolveNotificationsForModule', () => {
  it('returns notifications raised for a specific business entity', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'],
      moduleType: 'CONTRACT', moduleId: 'c1', createdBy: 'u1',
    }))
    await repos.notifications.create(buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'],
      moduleType: 'CONTRACT', moduleId: 'c2', createdBy: 'u1',
    }))

    const found = await resolveNotificationsForModule('CONTRACT', 'c1', repos)
    expect(found).toHaveLength(1)
  })

  it('returns empty array when none found', async () => {
    const repos = buildMemoryNotificationRepositories()
    expect(await resolveNotificationsForModule('PAYMENT', 'p-99', repos)).toHaveLength(0)
  })
})
