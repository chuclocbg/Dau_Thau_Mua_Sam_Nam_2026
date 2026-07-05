import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationContextManager } from '../conversation/application/conversationContext.ts'

let manager: ConversationContextManager

beforeEach(() => {
  manager = new ConversationContextManager('session-1', 'user-1')
})

describe('ConversationContextManager', () => {
  it('initializes with turnNumber 0 and no active question/advisor', () => {
    const context = manager.current()
    expect(context.sessionId).toBe('session-1')
    expect(context.userId).toBe('user-1')
    expect(context.turnNumber).toBe(0)
    expect(context.currentQuestion).toBeNull()
    expect(context.activeAdvisorId).toBeNull()
  })

  it('beginTurn advances turnNumber and sets question/advisor', () => {
    const context = manager.beginTurn('Mức tạm ứng tối đa là bao nhiêu?', 'legal')
    expect(context.turnNumber).toBe(1)
    expect(context.currentQuestion).toBe('Mức tạm ứng tối đa là bao nhiêu?')
    expect(context.activeAdvisorId).toBe('legal')
  })

  it('beginTurn called twice advances turnNumber each time', () => {
    manager.beginTurn('Q1', 'legal')
    const second = manager.beginTurn('Q2', 'procurement')
    expect(second.turnNumber).toBe(2)
    expect(second.currentQuestion).toBe('Q2')
    expect(second.activeAdvisorId).toBe('procurement')
  })

  it('endTurn clears question/advisor without changing turnNumber', () => {
    manager.beginTurn('Q1', 'legal')
    const ended = manager.endTurn()
    expect(ended.turnNumber).toBe(1)
    expect(ended.currentQuestion).toBeNull()
    expect(ended.activeAdvisorId).toBeNull()
  })

  it('current() returns the same object reference until the next mutation', () => {
    const a = manager.current()
    const b = manager.current()
    expect(a).toBe(b)
    manager.beginTurn('Q', 'legal')
    expect(manager.current()).not.toBe(a)
  })
})
