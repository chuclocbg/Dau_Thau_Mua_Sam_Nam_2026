import { describe, it, expect } from 'vitest'
import type {
  AdvisoryConversationContext, AdvisorySessionState, AdvisoryConversationMessage,
  AdvisoryConversationHistory, AdvisoryConversationSession,
} from '../conversation/domain/conversationTypes.ts'

describe('Advisory conversation domain types', () => {
  it('constructs a valid AdvisoryConversationContext', () => {
    const context: AdvisoryConversationContext = {
      sessionId: 'session-1', userId: 'user-1', activeAdvisorId: null, currentQuestion: null, turnNumber: 0,
    }
    expect(context.sessionId).toBe('session-1')
    expect(context.turnNumber).toBe(0)
  })

  it('constructs a valid AdvisorySessionState with no ToolCalls field (deferred to X.5)', () => {
    const state: AdvisorySessionState = {
      sessionId: 'session-1', status: 'CREATED', startedAt: '2026-07-05T00:00:00.000Z',
      lastActivityAt: '2026-07-05T00:00:00.000Z', advisorHistory: [], attachmentRefs: [],
    }
    expect(state.status).toBe('CREATED')
    expect('toolCalls' in state).toBe(false)
  })

  it('constructs a valid AdvisoryConversationMessage', () => {
    const message: AdvisoryConversationMessage = {
      messageId: 'msg-1', role: 'USER', content: 'Câu hỏi test',
      timestamp: '2026-07-05T00:00:00.000Z', tokenCount: 3,
    }
    expect(message.role).toBe('USER')
  })

  it('constructs a valid AdvisoryConversationHistory', () => {
    const history: AdvisoryConversationHistory = {
      sessionId: 'session-1', messages: [], droppedTurnCount: 0,
    }
    expect(history.messages).toHaveLength(0)
  })

  it('constructs a valid AdvisoryConversationSession (repository-persisted shape)', () => {
    const session: AdvisoryConversationSession = {
      id: 'sess-uuid', createdAt: '2026-07-05T00:00:00.000Z', updatedAt: '2026-07-05T00:00:00.000Z',
      sessionState: {
        sessionId: 'sess-uuid', status: 'CREATED', startedAt: '2026-07-05T00:00:00.000Z',
        lastActivityAt: '2026-07-05T00:00:00.000Z', advisorHistory: [], attachmentRefs: [],
      },
      history: { sessionId: 'sess-uuid', messages: [], droppedTurnCount: 0 },
    }
    expect(session.id).toBe('sess-uuid')
    expect(session.sessionState.sessionId).toBe(session.history.sessionId)
  })
})
