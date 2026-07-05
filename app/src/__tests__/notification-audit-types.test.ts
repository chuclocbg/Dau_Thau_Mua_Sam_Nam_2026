import { describe, it, expect } from 'vitest'
import { NOTIFICATION_AUDIT_EVENT_TYPES, NOTIFICATION_AUDIT_OUTCOMES } from '../notification/types/auditTypes.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'

describe('Notification audit event types', () => {
  it('defines 15 event types', () => {
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toHaveLength(15)
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_CREATED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_SENT')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_DELIVERED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_FAILED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_EXPIRED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_CANCELLED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('NOTIFICATION_RETRIED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('RULE_TRIGGERED')
    expect(NOTIFICATION_AUDIT_EVENT_TYPES).toContain('EVENT_RECEIVED')
  })
})

describe('Notification audit outcomes', () => {
  it('covers SUCCESS and FAILURE', () => {
    expect(NOTIFICATION_AUDIT_OUTCOMES).toEqual(['SUCCESS', 'FAILURE'])
  })
})

describe('INotificationAuditRepository (memory impl)', () => {
  it('append() assigns id and createdAt', async () => {
    const repos = buildMemoryNotificationRepositories()
    const event = await repos.auditEvents.append({
      eventType: 'NOTIFICATION_CREATED',
      userId: 'u1',
      outcome: 'SUCCESS',
      occurredAt: '2026-01-01T00:00:00Z',
      metadata: {},
    })
    expect(event.id).toBeTruthy()
    expect(event.createdAt).toBeTruthy()
  })

  it('is append-only — no update or delete method exists', async () => {
    const repos = buildMemoryNotificationRepositories()
    expect((repos.auditEvents as unknown as Record<string, unknown>).update).toBeUndefined()
    expect((repos.auditEvents as unknown as Record<string, unknown>).delete).toBeUndefined()
  })

  it('findByNotificationId filters correctly', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_CREATED', notificationId: 'n1', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_SENT', notificationId: 'n2', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    const found = await repos.auditEvents.findByNotificationId('n1')
    expect(found).toHaveLength(1)
  })

  it('findByUserId filters correctly', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_CREATED', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_CREATED', userId: 'u2', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    const found = await repos.auditEvents.findByUserId('u2')
    expect(found).toHaveLength(1)
  })

  it('findByEventType filters correctly', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_SENT', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_FAILED', userId: 'u1', outcome: 'FAILURE', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    const found = await repos.auditEvents.findByEventType('NOTIFICATION_FAILED')
    expect(found).toHaveLength(1)
    expect(found[0].outcome).toBe('FAILURE')
  })

  it('findByTimeRange filters inclusively', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_SENT', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_SENT', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-06-01T00:00:00Z', metadata: {} })
    const found = await repos.auditEvents.findByTimeRange('2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z')
    expect(found).toHaveLength(1)
  })

  it('count() reflects the number of appended events', async () => {
    const repos = buildMemoryNotificationRepositories()
    await repos.auditEvents.append({ eventType: 'NOTIFICATION_SENT', userId: 'u1', outcome: 'SUCCESS', occurredAt: '2026-01-01T00:00:00Z', metadata: {} })
    expect(await repos.auditEvents.count()).toBe(1)
  })

  it('findById returns null for unknown id', async () => {
    const repos = buildMemoryNotificationRepositories()
    expect(await repos.auditEvents.findById('nope')).toBeNull()
  })
})
