/**
 * Phase X.11 (Application Runtime) — unit tests for ConversationSession and the additive
 * rehydration/attachment methods added to Phase X.1's SessionStateManager and
 * AdvisoryConversationMemory (fromState/fromHistory/addAttachmentRef — new methods only, zero
 * existing lines changed, verified separately by the architecture guard).
 */

import { describe, it, expect } from 'vitest'
import { ConversationSession } from '../runtime/conversationSession.ts'
import { SessionStateManager } from '../conversation/application/sessionState.ts'
import { AdvisoryConversationMemory } from '../conversation/application/conversationMemory.ts'
import type { AdvisoryConversationSession, AdvisoryConversationMessage } from '../conversation/domain/conversationTypes.ts'

function message(role: AdvisoryConversationMessage['role'], content: string): AdvisoryConversationMessage {
  return { messageId: crypto.randomUUID(), role, content, timestamp: new Date().toISOString(), tokenCount: content.length }
}

describe('SessionStateManager.fromState (additive)', () => {
  it('rehydrates the exact given state rather than a fresh CREATED one', () => {
    const persisted = new SessionStateManager('s-1').recordActivity('advisor-a')
    const rehydrated = SessionStateManager.fromState(persisted)
    expect(rehydrated.current()).toEqual(persisted)
  })

  it('rehydrated manager still applies existing transition rules (no reimplementation)', () => {
    const archived = new SessionStateManager('s-1').transitionTo('ARCHIVED')
    const rehydrated = SessionStateManager.fromState(archived)
    expect(() => rehydrated.transitionTo('ACTIVE')).toThrow(/Invalid session transition/)
  })

  it('addAttachmentRef appends a new id and is idempotent for duplicates', () => {
    const manager = new SessionStateManager('s-1')
    manager.addAttachmentRef('att-1')
    manager.addAttachmentRef('att-1')
    const state = manager.addAttachmentRef('att-2')
    expect(state.attachmentRefs).toEqual(['att-1', 'att-2'])
  })
})

describe('AdvisoryConversationMemory.fromHistory (additive)', () => {
  it('rehydrates the exact given history rather than a fresh empty one', () => {
    const memory = new AdvisoryConversationMemory('s-1')
    memory.append(message('USER', 'hello'))
    const persisted = memory.current()
    const rehydrated = AdvisoryConversationMemory.fromHistory(persisted)
    expect(rehydrated.current()).toEqual(persisted)
  })

  it('rehydrated memory still applies existing pruning rules (no reimplementation)', () => {
    const memory = new AdvisoryConversationMemory('s-1')
    for (let i = 0; i < 5; i++) {
      memory.append({ ...message('USER', `q${i}`), tokenCount: 100 })
      memory.append({ ...message('ASSISTANT', `a${i}`), tokenCount: 100 })
    }
    const rehydrated = AdvisoryConversationMemory.fromHistory(memory.current())
    const pruned = rehydrated.pruneToTokenBudget(300)
    expect(pruned.droppedTurnCount).toBeGreaterThan(0)
  })
})

describe('ConversationSession', () => {
  it('createNew() starts CREATED with empty history and a generated sessionId', () => {
    const session = ConversationSession.createNew()
    expect(session.sessionId).toBeTruthy()
    expect(session.repoId).toBe('')
    expect(session.state.status).toBe('CREATED')
    expect(session.history.messages).toHaveLength(0)
  })

  it('withRepoId() binds a repository-assigned id without altering session/history state', () => {
    const session = ConversationSession.createNew().withRepoId('repo-123')
    expect(session.repoId).toBe('repo-123')
    expect(session.state.status).toBe('CREATED')
  })

  it('fromPersisted() rehydrates repoId, sessionId, state, and history from a stored row', () => {
    const persisted: AdvisoryConversationSession = {
      id: 'repo-abc', createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
      sessionState: {
        sessionId: 'sess-xyz', status: 'ACTIVE', startedAt: '2026-07-10T00:00:00.000Z',
        lastActivityAt: '2026-07-10T00:00:00.000Z', advisorHistory: ['a'], attachmentRefs: [],
      },
      history: { sessionId: 'sess-xyz', messages: [message('USER', 'hi')], droppedTurnCount: 0 },
    }
    const session = ConversationSession.fromPersisted(persisted)
    expect(session.repoId).toBe('repo-abc')
    expect(session.sessionId).toBe('sess-xyz')
    expect(session.state.status).toBe('ACTIVE')
    expect(session.history.messages).toHaveLength(1)
  })

  it('repoId and sessionId are independent identifiers, exactly as ISessionRepository already models them', () => {
    const persisted: AdvisoryConversationSession = {
      id: 'repo-id-1', createdAt: 't', updatedAt: 't',
      sessionState: { sessionId: 'business-session-id-1', status: 'CREATED', startedAt: 't', lastActivityAt: 't', advisorHistory: [], attachmentRefs: [] },
      history: { sessionId: 'business-session-id-1', messages: [], droppedTurnCount: 0 },
    }
    const session = ConversationSession.fromPersisted(persisted)
    expect(session.repoId).not.toBe(session.sessionId)
  })

  it('recordTurn() records activity and appends both messages via the existing X.1 managers', () => {
    const session = ConversationSession.createNew()
    session.recordTurn(message('USER', 'question'), message('ASSISTANT', 'answer'), 'DECISION')
    expect(session.state.status).toBe('ACTIVE')
    expect(session.state.advisorHistory).toEqual(['DECISION'])
    expect(session.history.messages.map(m => m.role)).toEqual(['USER', 'ASSISTANT'])
  })

  it('recordAttachment() appends to sessionState.attachmentRefs', () => {
    const session = ConversationSession.createNew()
    session.recordAttachment('att-1')
    expect(session.state.attachmentRefs).toEqual(['att-1'])
  })

  it('applyLifecycleCheck() transitions ACTIVE -> IDLE -> ARCHIVED using the existing thresholds, never inventing new ones', () => {
    const session = ConversationSession.createNew()
    session.recordTurn(message('USER', 'q'), message('ASSISTANT', 'a'), 'DECISION')
    const farFuture = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    session.applyLifecycleCheck(farFuture, 30, 60)
    expect(session.state.status).toBe('ARCHIVED')
  })

  it('applyLifecycleCheck() is a no-op when the session is not due', () => {
    const session = ConversationSession.createNew()
    session.recordTurn(message('USER', 'q'), message('ASSISTANT', 'a'), 'DECISION')
    session.applyLifecycleCheck(new Date(), 30, 60)
    expect(session.state.status).toBe('ACTIVE')
  })

  it('toPersistedFields() returns the current sessionState/history pair', () => {
    const session = ConversationSession.createNew()
    const fields = session.toPersistedFields()
    expect(fields.sessionState).toEqual(session.state)
    expect(fields.history).toEqual(session.history)
  })
})
