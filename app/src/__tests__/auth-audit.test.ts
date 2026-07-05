import { describe, it, expect, beforeEach } from 'vitest'
import { AUTH_AUDIT_EVENT_TYPES } from '../auth/types/auditTypes.ts'
import { MemoryAuditEventRepository } from '../auth/infrastructure/memoryAuthRepositories.ts'

describe('IAuditEventRepository (MemoryAuditEventRepository)', () => {
  let repo: MemoryAuditEventRepository

  beforeEach(() => { repo = new MemoryAuditEventRepository() })

  it('append returns stored event with id and createdAt', async () => {
    const e = await repo.append({
      eventType: 'ACCESS_DENIED', userId: 'user-1', outcome: 'FAILURE',
      resource: 'PACKAGE', action: 'APPROVE',
      metadata: { reason: 'no perm' }, occurredAt: '2026-01-01T10:00:00.000Z',
    })
    expect(e.id).toBeTruthy()
    expect(e.createdAt).toBeTruthy()
    expect(e.eventType).toBe('ACCESS_DENIED')
  })

  it('has no update or delete (append-only)', () => {
    expect((repo as Record<string, unknown>)['update']).toBeUndefined()
    expect((repo as Record<string, unknown>)['delete']).toBeUndefined()
  })

  it('findById returns the appended event', async () => {
    const e = await repo.append({ eventType: 'LOGIN', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    expect((await repo.findById(e.id))?.id).toBe(e.id)
  })

  it('findBySessionId returns events for session', async () => {
    await repo.append({ eventType: 'LOGIN', userId: 'u1', sessionId: 'sess-1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    await repo.append({ eventType: 'LOGOUT', userId: 'u1', sessionId: 'sess-1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T01:00:00.000Z' })
    await repo.append({ eventType: 'LOGIN', userId: 'u2', sessionId: 'sess-2', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    expect(await repo.findBySessionId('sess-1')).toHaveLength(2)
  })

  it('findByTimeRange returns events in range', async () => {
    await repo.append({ eventType: 'LOGIN', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T08:00:00.000Z' })
    await repo.append({ eventType: 'LOGIN', userId: 'u2', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-02T08:00:00.000Z' })
    await repo.append({ eventType: 'LOGIN', userId: 'u3', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-10T08:00:00.000Z' })
    const events = await repo.findByTimeRange('2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z')
    expect(events).toHaveLength(2)
  })

  it('findByTargetUser returns events where targetUserId matches', async () => {
    await repo.append({ eventType: 'ROLE_ASSIGNED', userId: 'admin', targetUserId: 'user-1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    await repo.append({ eventType: 'ROLE_REVOKED', userId: 'admin', targetUserId: 'user-2', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    expect(await repo.findByTargetUser('user-1')).toHaveLength(1)
  })

  it('count increments with each append', async () => {
    expect(await repo.count()).toBe(0)
    await repo.append({ eventType: 'LOGIN', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    await repo.append({ eventType: 'LOGOUT', userId: 'u1', outcome: 'SUCCESS', metadata: {}, occurredAt: '2026-01-01T00:00:00.000Z' })
    expect(await repo.count()).toBe(2)
  })

  it('AUTH_AUDIT_EVENT_TYPES covers all 23 event types', () => {
    expect(AUTH_AUDIT_EVENT_TYPES).toContain('LOGIN')
    expect(AUTH_AUDIT_EVENT_TYPES).toContain('DELEGATION_USED')
    expect(AUTH_AUDIT_EVENT_TYPES).toContain('POLICY_OVERRIDDEN')
    expect(AUTH_AUDIT_EVENT_TYPES.length).toBe(23)
  })

  it('stores metadata correctly', async () => {
    const e = await repo.append({
      eventType: 'ACCESS_DENIED', userId: 'u1', outcome: 'FAILURE',
      metadata: { resource: 'PACKAGE', reason: 'scope' },
      occurredAt: '2026-01-01T00:00:00.000Z',
    })
    expect(e.metadata['resource']).toBe('PACKAGE')
  })
})
