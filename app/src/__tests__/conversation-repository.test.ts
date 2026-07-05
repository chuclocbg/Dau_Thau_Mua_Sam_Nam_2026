import { describe, it, expect, beforeEach } from 'vitest'
import { buildMemorySessionRepository, type ISessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import type { AdvisoryConversationSession } from '../conversation/domain/conversationTypes.ts'

function sessionInput(sessionId: string): Omit<AdvisoryConversationSession, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    sessionState: {
      sessionId, status: 'CREATED', startedAt: '2026-07-05T00:00:00.000Z',
      lastActivityAt: '2026-07-05T00:00:00.000Z', advisorHistory: [], attachmentRefs: [],
    },
    history: { sessionId, messages: [], droppedTurnCount: 0 },
  }
}

let repo: ISessionRepository

beforeEach(() => {
  repo = buildMemorySessionRepository()
})

describe('MemorySessionRepository', () => {
  it('create() assigns id/createdAt/updatedAt', async () => {
    const session = await repo.create(sessionInput('session-1'))
    expect(session.id).toBeTruthy()
    expect(session.createdAt).toBeTruthy()
    expect(session.updatedAt).toBe(session.createdAt)
  })

  it('findById() returns the created session', async () => {
    const created = await repo.create(sessionInput('session-1'))
    const found = await repo.findById(created.id)
    expect(found?.id).toBe(created.id)
  })

  it('findById() returns null for an unknown id', async () => {
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findBySessionId() finds a session by its inner sessionState.sessionId', async () => {
    await repo.create(sessionInput('session-abc'))
    const found = await repo.findBySessionId('session-abc')
    expect(found?.sessionState.sessionId).toBe('session-abc')
  })

  it('findBySessionId() returns null for an unknown sessionId', async () => {
    expect(await repo.findBySessionId('missing')).toBeNull()
  })

  it('update() merges changes and bumps updatedAt', async () => {
    const created = await repo.create(sessionInput('session-1'))
    const updated = await repo.update(created.id, {
      sessionState: { ...created.sessionState, status: 'ACTIVE' },
    })
    expect(updated.sessionState.status).toBe('ACTIVE')
    expect(updated.id).toBe(created.id)
  })

  it('update() throws for an unknown id', async () => {
    await expect(repo.update('missing', {})).rejects.toThrow(/not found/)
  })

  it('delete() removes the session', async () => {
    const created = await repo.create(sessionInput('session-1'))
    await repo.delete(created.id)
    expect(await repo.findById(created.id)).toBeNull()
  })

  it('findAll() and count() reflect all created sessions', async () => {
    await repo.create(sessionInput('a'))
    await repo.create(sessionInput('b'))
    expect(await repo.count()).toBe(2)
    expect(await repo.findAll()).toHaveLength(2)
  })
})
