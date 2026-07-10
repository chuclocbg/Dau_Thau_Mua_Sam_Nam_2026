/**
 * Phase X.11 — unit tests for RuntimeSessionBuilder, exercised against a real
 * MemorySessionRepository (Phase X.1, unmodified) rather than a mock.
 */

import { describe, it, expect } from 'vitest'
import { RuntimeSessionBuilder } from '../runtime/runtimeSessionBuilder.ts'
import { buildMemorySessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'

describe('RuntimeSessionBuilder.createSession', () => {
  it('creates and persists a new CREATED session with a real repository-assigned repoId', async () => {
    const builder = new RuntimeSessionBuilder(buildMemorySessionRepository())
    const session = await builder.createSession()
    expect(session.repoId).toBeTruthy()
    expect(session.state.status).toBe('CREATED')
  })

  it('two created sessions get distinct repoId and sessionId values', async () => {
    const builder = new RuntimeSessionBuilder(buildMemorySessionRepository())
    const a = await builder.createSession()
    const b = await builder.createSession()
    expect(a.repoId).not.toBe(b.repoId)
    expect(a.sessionId).not.toBe(b.sessionId)
  })
})

describe('RuntimeSessionBuilder.resumeSession', () => {
  it('resumes a previously-created session by its business sessionId', async () => {
    const repo = buildMemorySessionRepository()
    const builder = new RuntimeSessionBuilder(repo)
    const created = await builder.createSession()
    created.recordAttachment('att-1')
    await builder.persist(created)

    const resumed = await builder.resumeSession(created.sessionId)
    expect(resumed?.repoId).toBe(created.repoId)
    expect(resumed?.state.attachmentRefs).toEqual(['att-1'])
  })

  it('returns null for an unknown sessionId', async () => {
    const builder = new RuntimeSessionBuilder(buildMemorySessionRepository())
    expect(await builder.resumeSession('unknown-session-id')).toBeNull()
  })

  it('transitions a long-idle session to IDLE on resume using caller-supplied thresholds', async () => {
    const repo = buildMemorySessionRepository()
    const builder = new RuntimeSessionBuilder(repo, { idleMinutes: 30, archiveMinutes: 1440 })
    const created = await builder.createSession()
    created.recordTurn(
      { messageId: 'm1', role: 'USER', content: 'q', timestamp: new Date().toISOString(), tokenCount: 1 },
      { messageId: 'm2', role: 'ASSISTANT', content: 'a', timestamp: new Date().toISOString(), tokenCount: 1 },
      'DECISION',
    )
    await builder.persist(created)

    const anHourLater = new Date(Date.now() + 60 * 60 * 1000)
    const resumed = await builder.resumeSession(created.sessionId, anHourLater)
    expect(resumed?.state.status).toBe('IDLE')
  })
})

describe('RuntimeSessionBuilder.persist', () => {
  it('persists the current session/history back to the repository', async () => {
    const repo = buildMemorySessionRepository()
    const builder = new RuntimeSessionBuilder(repo)
    const session = await builder.createSession()
    session.recordTurn(
      { messageId: 'm1', role: 'USER', content: 'q', timestamp: new Date().toISOString(), tokenCount: 1 },
      { messageId: 'm2', role: 'ASSISTANT', content: 'a', timestamp: new Date().toISOString(), tokenCount: 1 },
      'DECISION',
    )
    const persisted = await builder.persist(session)
    expect(persisted.history.messages).toHaveLength(2)
    expect(persisted.sessionState.status).toBe('ACTIVE')

    const reloaded = await repo.findById(session.repoId)
    expect(reloaded?.history.messages).toHaveLength(2)
  })
})
