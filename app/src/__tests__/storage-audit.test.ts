import { describe, it, expect } from 'vitest'
import { MemoryStorageAuditRepository } from '../storage/infrastructure/memoryStorageRepositories.ts'
import type { StorageAuditEvent } from '../storage/types/auditTypes.ts'

const event = (overrides: Partial<Omit<StorageAuditEvent, 'id' | 'createdAt'>> = {}): Omit<StorageAuditEvent, 'id' | 'createdAt'> => ({
  eventType: 'OBJECT_UPLOADED',
  objectKey: 'contract/c-1/contract/2024-01-01/doc.pdf',
  userId: 'user-1',
  outcome: 'SUCCESS',
  occurredAt: '2024-01-01T10:00:00Z',
  metadata: {},
  ...overrides,
})

describe('MemoryStorageAuditRepository', () => {
  it('appends an event and assigns id + createdAt', async () => {
    const repo = new MemoryStorageAuditRepository()
    const stored = await repo.append(event())
    expect(stored.id).toBeTruthy()
    expect(stored.createdAt).toBeTruthy()
    expect(stored.eventType).toBe('OBJECT_UPLOADED')
  })

  it('does not expose update or delete methods', () => {
    const repo = new MemoryStorageAuditRepository()
    expect((repo as unknown as Record<string, unknown>)['update']).toBeUndefined()
    expect((repo as unknown as Record<string, unknown>)['delete']).toBeUndefined()
  })

  it('count reflects total appended events', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event())
    await repo.append(event({ eventType: 'OBJECT_DOWNLOADED' }))
    expect(await repo.count()).toBe(2)
  })

  it('findById returns the event', async () => {
    const repo = new MemoryStorageAuditRepository()
    const stored = await repo.append(event())
    const found = await repo.findById(stored.id)
    expect(found?.id).toBe(stored.id)
  })

  it('findByObjectKey returns matching events', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ objectKey: 'key-a' }))
    await repo.append(event({ objectKey: 'key-b' }))
    await repo.append(event({ objectKey: 'key-a' }))
    const result = await repo.findByObjectKey('key-a')
    expect(result).toHaveLength(2)
  })

  it('findByUserId returns events for that user', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ userId: 'user-1' }))
    await repo.append(event({ userId: 'user-2' }))
    const result = await repo.findByUserId('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('user-1')
  })

  it('findByEventType filters by type', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ eventType: 'OBJECT_UPLOADED' }))
    await repo.append(event({ eventType: 'OBJECT_DOWNLOADED' }))
    await repo.append(event({ eventType: 'OBJECT_UPLOADED' }))
    const uploads = await repo.findByEventType('OBJECT_UPLOADED')
    expect(uploads).toHaveLength(2)
    const downloads = await repo.findByEventType('OBJECT_DOWNLOADED')
    expect(downloads).toHaveLength(1)
  })

  it('findByModule returns events for moduleType+moduleId', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ moduleType: 'CONTRACT', moduleId: 'c-1' }))
    await repo.append(event({ moduleType: 'CONTRACT', moduleId: 'c-2' }))
    const result = await repo.findByModule('CONTRACT', 'c-1')
    expect(result).toHaveLength(1)
  })

  it('findByObjectId returns events for that objectId', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ objectId: 'obj-1' }))
    await repo.append(event({ objectId: 'obj-2' }))
    const result = await repo.findByObjectId('obj-1')
    expect(result).toHaveLength(1)
    expect(result[0].objectId).toBe('obj-1')
  })

  it('findByTimeRange returns events within the range', async () => {
    const repo = new MemoryStorageAuditRepository()
    await repo.append(event({ occurredAt: '2024-01-01T09:00:00Z' }))
    await repo.append(event({ occurredAt: '2024-01-01T10:00:00Z' }))
    await repo.append(event({ occurredAt: '2024-01-01T11:00:00Z' }))
    const result = await repo.findByTimeRange('2024-01-01T09:30:00Z', '2024-01-01T10:30:00Z')
    expect(result).toHaveLength(1)
    expect(result[0].occurredAt).toBe('2024-01-01T10:00:00Z')
  })

  it('respects limit parameter', async () => {
    const repo = new MemoryStorageAuditRepository()
    for (let i = 0; i < 5; i++) await repo.append(event({ userId: 'user-1' }))
    const result = await repo.findByUserId('user-1', 3)
    expect(result).toHaveLength(3)
  })
})
