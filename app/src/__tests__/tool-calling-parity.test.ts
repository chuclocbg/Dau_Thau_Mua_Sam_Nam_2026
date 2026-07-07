import { describe, it, expect, vi } from 'vitest'
import { runToolCallingStage } from '../reasoning/application/toolCallingStage.ts'
import { ToolExecutor } from '../providers/ToolExecutor.ts'
import { ToolRegistry } from '../providers/ToolRegistry.ts'
import { RetryPolicy } from '../providers/RetryPolicy.ts'
import type { ToolDecider } from '../reasoning/domain/toolCallingTypes.ts'
import type { ConversationResponse } from '../reasoning/domain/conversationResponseTypes.ts'
import type { ReasoningAnswerResult } from '../reasoning/domain/reasoningAnswerTypes.ts'

// ── Parity — Phase X.6 ──────────────────────────────────────────────────────
// Proves runToolCallingStage genuinely delegates execution to ToolExecutor.execute() and
// backoff timing to RetryPolicy.sleep()/.maxAttempts, rather than reimplementing either.

function response(): ConversationResponse {
  return {
    markdown: 'x', sections: [], confidenceLabel: 'HIGH', confidenceScore: 1, warnings: [],
    humanReviewRecommended: false, citationCount: 0, language: 'vi', formattedAt: '2026-07-07T00:00:00.000Z',
  }
}

function answer(): ReasoningAnswerResult {
  return {
    decision: null, primaryCitations: [], supportingCitations: [], disputedCitations: [],
    confidenceSummary: { baseScore: 1, deductions: [], finalScore: 1, label: 'HIGH' },
    conflicts: [], composedAt: '2026-07-07T00:00:00.000Z',
  }
}

describe('runToolCallingStage — delegates to ToolExecutor.execute() (not reimplemented)', () => {
  it('calls ToolExecutor.execute() with the exact ToolCall the decider produced', async () => {
    const registry = new ToolRegistry()
    registry.registerTool({ name: 'echo', description: 'x', parameters: {}, required: [], handler: (a) => a })
    const executor = new ToolExecutor(registry)
    const executeSpy = vi.spyOn(executor, 'execute')

    const decider: ToolDecider = () => ({
      shouldInvoke: true, call: { name: 'echo', arguments: { a: 1 } }, reason: 'r',
    })
    await runToolCallingStage(response(), answer(), executor, { decider, timeoutMs: 500 })

    expect(executeSpy).toHaveBeenCalledWith({ name: 'echo', arguments: { a: 1 } }, { timeoutMs: 500 })
  })

  it('every invocation attempt is a real ToolExecutor.execute() call, one per attempt', async () => {
    const registry = new ToolRegistry()
    let calls = 0
    registry.registerTool({ name: 'flaky', description: 'x', parameters: {}, required: [], handler: () => { calls++; throw new Error('boom') } })
    const executor = new ToolExecutor(registry)
    const executeSpy = vi.spyOn(executor, 'execute')

    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'flaky', arguments: {} }, reason: 'r' })
    await runToolCallingStage(response(), answer(), executor, { decider, retry: { maxAttempts: 3, retryDelayMs: 0 } })

    expect(calls).toBe(3)
    expect(executeSpy).toHaveBeenCalledTimes(3)
  })
})

describe('runToolCallingStage — delegates to RetryPolicy.sleep() for backoff (not reimplemented)', () => {
  it('sleeps exactly maxAttempts-1 times between failing attempts', async () => {
    const sleepSpy = vi.spyOn(RetryPolicy.prototype, 'sleep')
    const registry = new ToolRegistry()
    registry.registerTool({ name: 'alwaysFails', description: 'x', parameters: {}, required: [], handler: () => { throw new Error('boom') } })
    const executor = new ToolExecutor(registry)

    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'alwaysFails', arguments: {} }, reason: 'r' })
    await runToolCallingStage(response(), answer(), executor, { decider, retry: { maxAttempts: 3, retryDelayMs: 0 } })

    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 0)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1)
    sleepSpy.mockRestore()
  })

  it('constructs RetryPolicy with the caller-supplied RetryOptions, honoring maxAttempts', async () => {
    let calls = 0
    const registry = new ToolRegistry()
    registry.registerTool({ name: 'alwaysFails', description: 'x', parameters: {}, required: [], handler: () => { calls++; throw new Error('boom') } })
    const executor = new ToolExecutor(registry)

    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'alwaysFails', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, { decider, retry: { maxAttempts: 1, retryDelayMs: 0 } })

    expect(calls).toBe(1)
    expect(result.toolResults[0]!.attempts).toBe(1)
  })
})
