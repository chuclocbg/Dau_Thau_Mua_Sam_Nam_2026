import { describe, it, expect } from 'vitest'
import { runToolCallingStage, neverInvokeTool } from '../reasoning/application/toolCallingStage.ts'
import { ToolExecutor } from '../providers/ToolExecutor.ts'
import { ToolRegistry } from '../providers/ToolRegistry.ts'
import type { ToolDecider } from '../reasoning/domain/toolCallingTypes.ts'
import type { ConversationResponse } from '../reasoning/domain/conversationResponseTypes.ts'
import type { ReasoningAnswerResult } from '../reasoning/domain/reasoningAnswerTypes.ts'

function response(overrides: Partial<ConversationResponse> = {}): ConversationResponse {
  return {
    markdown: '## Kết luận\n\nx', sections: [{ heading: 'Kết luận', body: 'x' }],
    confidenceLabel: 'HIGH', confidenceScore: 1, warnings: [], humanReviewRecommended: false,
    citationCount: 0, language: 'vi', formattedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

function answer(overrides: Partial<ReasoningAnswerResult> = {}): ReasoningAnswerResult {
  return {
    decision: null, primaryCitations: [], supportingCitations: [], disputedCitations: [],
    confidenceSummary: { baseScore: 1, deductions: [], finalScore: 1, label: 'HIGH' },
    conflicts: [], composedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

function buildExecutor(handler: (args: Record<string, unknown>) => unknown): ToolExecutor {
  const registry = new ToolRegistry()
  registry.registerTool({ name: 'echo', description: 'echo', parameters: {}, required: [], handler })
  return new ToolExecutor(registry)
}

describe('runToolCallingStage — decision logic', () => {
  it('never invokes a tool with the default decider', async () => {
    const executor = buildExecutor(() => 'unused')
    const result = await runToolCallingStage(response(), answer(), executor)
    expect(result.toolInvoked).toBe(false)
    expect(result.toolResults).toEqual([])
    expect(result.response).toEqual(response())
  })

  it('invokes the tool the decider selects', async () => {
    const executor = buildExecutor(() => 'ok')
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'echo', arguments: {} }, reason: 'test' })
    const result = await runToolCallingStage(response(), answer(), executor, { decider })
    expect(result.toolInvoked).toBe(true)
    expect(result.toolResults).toHaveLength(1)
    expect(result.toolResults[0]!.success).toBe(true)
    expect(result.toolResults[0]!.output).toBe('ok')
  })

  it('treats shouldInvoke:true with no call as a decline', async () => {
    const executor = buildExecutor(() => 'ok')
    const decider: ToolDecider = () => ({ shouldInvoke: true, reason: 'missing call' })
    const result = await runToolCallingStage(response(), answer(), executor, { decider })
    expect(result.toolInvoked).toBe(false)
  })
})

describe('runToolCallingStage — retry behavior', () => {
  it('retries a transient TOOL_EXECUTION_FAILED error up to maxAttempts', async () => {
    let calls = 0
    const executor = buildExecutor(() => { calls++; throw new Error('boom') })
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'echo', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, {
      decider, retry: { maxAttempts: 3, retryDelayMs: 0 },
    })
    expect(calls).toBe(3)
    expect(result.toolResults[0]!.attempts).toBe(3)
    expect(result.toolResults[0]!.success).toBe(false)
  })

  it('does not retry a non-retryable INVALID_ARGUMENTS error', async () => {
    let calls = 0
    const registry = new ToolRegistry()
    registry.registerTool({ name: 'needsArg', description: 'x', parameters: {}, required: ['x'], handler: () => { calls++; return 'ok' } })
    const executor = new ToolExecutor(registry)
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'needsArg', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, {
      decider, retry: { maxAttempts: 3, retryDelayMs: 0 },
    })
    expect(calls).toBe(0)
    expect(result.toolResults[0]!.attempts).toBe(1)
    expect(result.toolResults[0]!.errorMessage).toContain('x')
  })

  it('stops retrying as soon as the tool succeeds', async () => {
    let calls = 0
    const executor = buildExecutor(() => { calls++; if (calls < 2) throw new Error('boom'); return 'ok' })
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'echo', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, {
      decider, retry: { maxAttempts: 5, retryDelayMs: 0 },
    })
    expect(calls).toBe(2)
    expect(result.toolResults[0]!.attempts).toBe(2)
    expect(result.toolResults[0]!.success).toBe(true)
  })
})

describe('runToolCallingStage — normalization, immutability, determinism', () => {
  it('normalizes a failure with an error message and no output', async () => {
    const executor = buildExecutor(() => { throw new Error('nope') })
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'echo', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, { decider, retry: { maxAttempts: 1 } })
    expect(result.toolResults[0]!.success).toBe(false)
    expect(result.toolResults[0]!.output).toBeUndefined()
    expect(result.toolResults[0]!.errorMessage).toBeDefined()
  })

  it('deep-freezes the result, including the wrapped response', async () => {
    const executor = buildExecutor(() => 'ok')
    const result = await runToolCallingStage(response(), answer(), executor)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.toolResults)).toBe(true)
  })

  it('never mutates the input ConversationResponse', async () => {
    const input = response()
    const executor = buildExecutor(() => 'ok')
    await runToolCallingStage(input, answer(), executor)
    expect(input).toEqual(response())
  })

  it('is deterministic for a declined invocation: identical inputs produce identical output', async () => {
    const executor = buildExecutor(() => 'ok')
    const first = await runToolCallingStage(response(), answer(), executor)
    const second = await runToolCallingStage(response(), answer(), executor)
    expect(first).toEqual(second)
  })

  it('neverInvokeTool always declines with a stable reason', () => {
    const decision = neverInvokeTool(response(), answer())
    expect(decision.shouldInvoke).toBe(false)
    expect(decision.call).toBeUndefined()
    expect(typeof decision.reason).toBe('string')
  })
})

describe('runToolCallingStage — timeout wiring', () => {
  it('passes timeoutMs through to the executor and surfaces a TIMEOUT failure', async () => {
    const executor = buildExecutor(() => new Promise(resolve => setTimeout(() => resolve('late'), 50)))
    const decider: ToolDecider = () => ({ shouldInvoke: true, call: { name: 'echo', arguments: {} }, reason: 'r' })
    const result = await runToolCallingStage(response(), answer(), executor, {
      decider, timeoutMs: 5, retry: { maxAttempts: 1 },
    })
    expect(result.toolResults[0]!.success).toBe(false)
    expect(result.toolResults[0]!.errorMessage).toMatch(/timeout/i)
  })
})
