import type { AdvisoryConversationContext } from '../domain/conversationTypes.ts'

// ── ConversationContextManager — the mutable "what's happening right now" envelope ──
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md §4.
// Owns turn advancement only. Does not persist — persistence is
// memorySessionRepository.ts's responsibility (Task 5).

export class ConversationContextManager {
  private context: AdvisoryConversationContext

  constructor(sessionId: string, userId: string) {
    this.context = { sessionId, userId, activeAdvisorId: null, currentQuestion: null, turnNumber: 0 }
  }

  current(): AdvisoryConversationContext {
    return this.context
  }

  /** Advances to a new turn with the given question and advisor. Returns the new context. */
  beginTurn(question: string, advisorId: string): AdvisoryConversationContext {
    this.context = {
      ...this.context,
      currentQuestion: question,
      activeAdvisorId: advisorId,
      turnNumber: this.context.turnNumber + 1,
    }
    return this.context
  }

  /** Clears the current question/advisor without advancing the turn — used after a turn completes. */
  endTurn(): AdvisoryConversationContext {
    this.context = { ...this.context, currentQuestion: null, activeAdvisorId: null }
    return this.context
  }
}
