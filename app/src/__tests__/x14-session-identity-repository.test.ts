/**
 * Phase X.14 — unit tests for MemorySessionIdentityRepository (Session identity binding).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { buildMemorySessionIdentityRepository } from '../identity/infrastructure/sessionIdentityRepository.ts'
import type { ISessionIdentityRepository, SessionIdentityBinding } from '../identity/infrastructure/sessionIdentityRepository.ts'

function bindingInput(sessionId: string, principalId: string): Omit<SessionIdentityBinding, 'id' | 'createdAt' | 'updatedAt'> {
  return { sessionId, principalId, principalKind: 'USER' }
}

let repo: ISessionIdentityRepository

beforeEach(() => {
  repo = buildMemorySessionIdentityRepository()
})

describe('MemorySessionIdentityRepository — CRUD', () => {
  it('create() assigns id/createdAt/updatedAt', async () => {
    const binding = await repo.create(bindingInput('s-1', 'p-1'))
    expect(binding.id).toBeTruthy()
    expect(binding.createdAt).toBeTruthy()
  })

  it('findById() returns the created binding, null for unknown', async () => {
    const created = await repo.create(bindingInput('s-1', 'p-1'))
    expect((await repo.findById(created.id))?.id).toBe(created.id)
    expect(await repo.findById('missing')).toBeNull()
  })

  it('update() merges changes; throws for unknown id', async () => {
    const created = await repo.create(bindingInput('s-1', 'p-1'))
    const updated = await repo.update(created.id, { principalKind: 'SERVICE' })
    expect(updated.principalKind).toBe('SERVICE')
    await expect(repo.update('missing', {})).rejects.toThrow(/not found/)
  })

  it('delete() removes the binding', async () => {
    const created = await repo.create(bindingInput('s-1', 'p-1'))
    await repo.delete(created.id)
    expect(await repo.findById(created.id)).toBeNull()
  })

  it('findAll()/count() reflect all created bindings', async () => {
    await repo.create(bindingInput('s-1', 'p-1'))
    await repo.create(bindingInput('s-2', 'p-2'))
    expect(await repo.count()).toBe(2)
    expect(await repo.findAll()).toHaveLength(2)
  })
})

describe('MemorySessionIdentityRepository — findBySessionId', () => {
  it('finds the binding for a given session', async () => {
    await repo.create(bindingInput('s-1', 'p-1'))
    const found = await repo.findBySessionId('s-1')
    expect(found?.principalId).toBe('p-1')
  })

  it('returns null for a session with no binding', async () => {
    expect(await repo.findBySessionId('unbound')).toBeNull()
  })
})
