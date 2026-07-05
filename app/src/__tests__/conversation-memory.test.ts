import { describe, it, expect, beforeEach } from 'vitest'
import { AdvisoryConversationMemory } from '../conversation/application/conversationMemory.ts'
import type { AdvisoryConversationMessage } from '../conversation/domain/conversationTypes.ts'

function msg(overrides: Partial<AdvisoryConversationMessage>): AdvisoryConversationMessage {
  return {
    messageId: 'm', role: 'USER', content: 'x', timestamp: '2026-07-05T00:00:00.000Z', tokenCount: 10,
    ...overrides,
  }
}

let memory: AdvisoryConversationMemory

beforeEach(() => {
  memory = new AdvisoryConversationMemory('session-1')
})

describe('AdvisoryConversationMemory', () => {
  it('starts empty with droppedTurnCount 0', () => {
    const history = memory.current()
    expect(history.messages).toEqual([])
    expect(history.droppedTurnCount).toBe(0)
  })

  it('append adds a message to the end of history', () => {
    memory.append(msg({ messageId: '1', role: 'USER', content: 'Q1' }))
    memory.append(msg({ messageId: '2', role: 'ASSISTANT', content: 'A1' }))
    const history = memory.current()
    expect(history.messages).toHaveLength(2)
    expect(history.messages[1]!.content).toBe('A1')
  })

  it('pruneToTokenBudget is a no-op when already under budget', () => {
    memory.append(msg({ messageId: '1', tokenCount: 10 }))
    const history = memory.pruneToTokenBudget(1000)
    expect(history.messages).toHaveLength(1)
    expect(history.droppedTurnCount).toBe(0)
  })

  it('drops the oldest turn first when over budget, keeping the 2 most recent turns', () => {
    // 3 turns of USER(10) + ASSISTANT(20) = 30 tokens each = 90 total
    for (let i = 1; i <= 3; i++) {
      memory.append(msg({ messageId: `u${i}`, role: 'USER', content: `Q${i}`, tokenCount: 10 }))
      memory.append(msg({ messageId: `a${i}`, role: 'ASSISTANT', content: `A${i}`, tokenCount: 20 }))
    }
    // Budget fits exactly 2 turns (60 tokens), not all 3 (90 tokens)
    const history = memory.pruneToTokenBudget(60)
    expect(history.messages).toHaveLength(4)
    expect(history.messages[0]!.content).toBe('Q2')
    expect(history.droppedTurnCount).toBe(1)   // 1 turn dropped, not 1 message-count-as-turns
  })

  it('never drops SYSTEM messages regardless of budget pressure', () => {
    memory.append(msg({ messageId: 'sys', role: 'SYSTEM', content: 'System prompt', tokenCount: 5 }))
    for (let i = 1; i <= 3; i++) {
      memory.append(msg({ messageId: `u${i}`, role: 'USER', content: `Q${i}`, tokenCount: 10 }))
      memory.append(msg({ messageId: `a${i}`, role: 'ASSISTANT', content: `A${i}`, tokenCount: 20 }))
    }
    const history = memory.pruneToTokenBudget(65)
    expect(history.messages.some(m => m.role === 'SYSTEM')).toBe(true)
  })

  it('never violates the 2-most-recent-turn floor even if still over budget', () => {
    for (let i = 1; i <= 3; i++) {
      memory.append(msg({ messageId: `u${i}`, role: 'USER', content: `Q${i}`, tokenCount: 10 }))
      memory.append(msg({ messageId: `a${i}`, role: 'ASSISTANT', content: `A${i}`, tokenCount: 20 }))
    }
    // Impossibly small budget — even 1 turn (30 tokens) doesn't fit
    const history = memory.pruneToTokenBudget(5)
    // Floor holds: last 2 turns (4 messages) are kept regardless
    expect(history.messages).toHaveLength(4)
    expect(history.messages[0]!.content).toBe('Q2')
    expect(history.messages[3]!.content).toBe('A3')
  })

  it('droppedTurnCount accumulates across repeated pruning calls', () => {
    for (let i = 1; i <= 3; i++) {
      memory.append(msg({ messageId: `u${i}`, tokenCount: 10, role: 'USER', content: `Q${i}` }))
      memory.append(msg({ messageId: `a${i}`, tokenCount: 20, role: 'ASSISTANT', content: `A${i}` }))
    }
    memory.pruneToTokenBudget(60)
    memory.append(msg({ messageId: 'u4', tokenCount: 10, role: 'USER', content: 'Q4' }))
    memory.append(msg({ messageId: 'a4', tokenCount: 20, role: 'ASSISTANT', content: 'A4' }))
    const history = memory.pruneToTokenBudget(60)
    expect(history.droppedTurnCount).toBe(2)   // 1 turn dropped per prune call, across 2 calls
  })
})
