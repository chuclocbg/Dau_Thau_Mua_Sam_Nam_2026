import type { AdvisoryConversationHistory, AdvisoryConversationMessage } from '../domain/conversationTypes.ts'

// ── AdvisoryConversationMemory — token-budget-governed conversation history ───
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md §4 and
// PHASE_X_EXECUTION_PLAN.md's X.1 exit criteria: "the 2-most-recent-turn floor is
// never violated under maximum pressure."
//
// Pruning strategy (already specified, not invented here):
//   1. Always keep the 2 most recent user turns and their assistant responses
//   2. Drop oldest turns first
//   3. Never drop system messages
// Note: this is the SAME 3-rule strategy already documented for the future
// AIContextBuilder's conversationHistory pruning (AI_CONTEXT_SCHEMA.md) — X.1
// implements it once, here, for the raw ConversationHistory; X.2's AIContextBuilder
// consumes this module's output rather than re-implementing pruning.

/** Named prefix: named for the exported class, not the file, since a
 *  pre-existing, unrelated `ConversationMemory` class already exists in
 *  src/providers/ConversationMemory.ts — see conversationTypes.ts's naming note. */
export class AdvisoryConversationMemory {
  private history: AdvisoryConversationHistory

  constructor(sessionId: string) {
    this.history = { sessionId, messages: [], droppedTurnCount: 0 }
  }

  current(): AdvisoryConversationHistory {
    return this.history
  }

  append(message: AdvisoryConversationMessage): AdvisoryConversationHistory {
    this.history = { ...this.history, messages: [...this.history.messages, message] }
    return this.history
  }

  /**
   * Prunes to fit within maxTokens, applying the 3-rule strategy above.
   * A "turn" here is one USER message plus the ASSISTANT message(s) immediately
   * following it. SYSTEM messages are never dropped. The 2 most recent turns are
   * never dropped even if maxTokens is exceeded — in that case the returned
   * history simply remains over budget, since violating the floor is not a
   * valid way to satisfy the budget (per the exit criterion).
   */
  pruneToTokenBudget(maxTokens: number): AdvisoryConversationHistory {
    const totalTokens = () => this.history.messages.reduce((sum, m) => sum + m.tokenCount, 0)
    if (totalTokens() <= maxTokens) return this.history

    const systemMessages = this.history.messages.filter(m => m.role === 'SYSTEM')
    const turnMessages = this.history.messages.filter(m => m.role !== 'SYSTEM')
    const turnBoundaries = this.groupIntoTurns(turnMessages)

    let dropped = 0
    while (turnBoundaries.length > 2) {
      turnBoundaries.shift()
      dropped += 1   // droppedTurnCount counts TURNS dropped, not messages within them
      const remainingTurns = turnBoundaries.flat()
      const remainingTokens = [...systemMessages, ...remainingTurns].reduce((sum, m) => sum + m.tokenCount, 0)
      if (remainingTokens <= maxTokens) {
        this.history = {
          ...this.history,
          messages: [...systemMessages, ...remainingTurns],
          droppedTurnCount: this.history.droppedTurnCount + dropped,
        }
        return this.history
      }
    }

    // Floor reached (<= 2 turns remain) — return as-is, even if still over budget.
    const flooredTurns = turnBoundaries.flat()
    this.history = {
      ...this.history,
      messages: [...systemMessages, ...flooredTurns],
      droppedTurnCount: this.history.droppedTurnCount + dropped,
    }
    return this.history
  }

  private groupIntoTurns(messages: readonly AdvisoryConversationMessage[]): AdvisoryConversationMessage[][] {
    const turns: AdvisoryConversationMessage[][] = []
    let current: AdvisoryConversationMessage[] = []
    for (const message of messages) {
      if (message.role === 'USER' && current.length > 0) {
        turns.push(current)
        current = []
      }
      current.push(message)
    }
    if (current.length > 0) turns.push(current)
    return turns
  }
}
