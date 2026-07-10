/**
 * Phase X.13 — unit tests for MemoryRecoveryRepository and the isUnfinished() predicate
 * (Recovery metadata + Recovery queue).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { buildMemoryRecoveryRepository } from '../runtime/recovery/memoryRecoveryRepository.ts'
import { isUnfinished } from '../runtime/recovery/recoveryTypes.ts'
import type { IRecoveryRepository, RecoveryMarker } from '../runtime/recovery/recoveryTypes.ts'

function markerInput(question: string, startedAt: string): Omit<RecoveryMarker, 'id' | 'createdAt' | 'updatedAt'> {
  return { question, status: 'PENDING', startedAt }
}

let repo: IRecoveryRepository

beforeEach(() => {
  repo = buildMemoryRecoveryRepository()
})

describe('isUnfinished', () => {
  it('is true only for PENDING markers', () => {
    expect(isUnfinished({ status: 'PENDING' } as RecoveryMarker)).toBe(true)
    expect(isUnfinished({ status: 'COMPLETED' } as RecoveryMarker)).toBe(false)
    expect(isUnfinished({ status: 'FAILED' } as RecoveryMarker)).toBe(false)
  })
})

describe('MemoryRecoveryRepository — CRUD', () => {
  it('create() assigns id/createdAt/updatedAt and defaults status as given', async () => {
    const marker = await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    expect(marker.id).toBeTruthy()
    expect(marker.createdAt).toBeTruthy()
    expect(marker.status).toBe('PENDING')
  })

  it('findById() returns the created marker, null for unknown', async () => {
    const created = await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    expect((await repo.findById(created.id))?.id).toBe(created.id)
    expect(await repo.findById('missing')).toBeNull()
  })

  it('update() merges changes and bumps updatedAt; throws for unknown id', async () => {
    const created = await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    const updated = await repo.update(created.id, { status: 'COMPLETED', completedAt: '2026-07-10T00:01:00.000Z' })
    expect(updated.status).toBe('COMPLETED')
    expect(updated.completedAt).toBe('2026-07-10T00:01:00.000Z')
    await expect(repo.update('missing', {})).rejects.toThrow(/not found/)
  })

  it('delete() removes the marker', async () => {
    const created = await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    await repo.delete(created.id)
    expect(await repo.findById(created.id)).toBeNull()
  })

  it('findAll()/count() reflect all created markers', async () => {
    await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    await repo.create(markerInput('q2', '2026-07-10T00:01:00.000Z'))
    expect(await repo.count()).toBe(2)
    expect(await repo.findAll()).toHaveLength(2)
  })
})

describe('MemoryRecoveryRepository — findPending (the recovery queue)', () => {
  it('returns only PENDING markers, oldest first', async () => {
    const c = await repo.create(markerInput('q-newest', '2026-07-10T00:02:00.000Z'))
    const a = await repo.create(markerInput('q-oldest', '2026-07-10T00:00:00.000Z'))
    const b = await repo.create(markerInput('q-middle', '2026-07-10T00:01:00.000Z'))
    await repo.update(c.id, { status: 'COMPLETED' })

    const pending = await repo.findPending()
    expect(pending.map(m => m.id)).toEqual([a.id, b.id])
  })

  it('returns an empty array once every marker is resolved', async () => {
    const a = await repo.create(markerInput('q1', '2026-07-10T00:00:00.000Z'))
    await repo.update(a.id, { status: 'FAILED', error: 'boom' })
    expect(await repo.findPending()).toEqual([])
  })
})

describe('MemoryRecoveryRepository — findBySessionId', () => {
  it('returns only markers for the given session', async () => {
    await repo.create({ ...markerInput('q1', '2026-07-10T00:00:00.000Z'), sessionId: 's-1' })
    await repo.create({ ...markerInput('q2', '2026-07-10T00:01:00.000Z'), sessionId: 's-2' })
    const results = await repo.findBySessionId('s-1')
    expect(results).toHaveLength(1)
    expect(results[0]?.sessionId).toBe('s-1')
  })
})
