/**
 * Phase X.11 — true end-to-end integration test for runConversationTurn(): a real Application
 * (real memory-backed IKnowledgePlatform + LegalProvider, the complete frozen
 * ReasoningEnginePipeline, a real ToolExecutor -- the exact same "real Application" every
 * X.9.1+ integration test already uses, per http-server-integration.test.ts's own established
 * pattern) wired into a real RuntimeContext, exercising the full
 * detectIntent -> reasoningPipeline.answer -> formatConversationResponse -> runToolCallingStage
 * chain through the new Runtime orchestration layer.
 *
 * Also serves as the milestone's replay test: the same session is resumed across two separate
 * runConversationTurn() calls, proving conversation continuity (turnNumber increments, history
 * accumulates across both turns) is genuinely persisted and rehydrated, not just held in
 * in-process memory within a single call.
 */

import { describe, it, expect } from 'vitest'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
import { runConversationTurn } from '../runtime/conversationEntryOrchestrator.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'

async function realRuntime() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const application = await buildApplication(config.value)
  return buildRuntimeContext({ application })
}

describe('runConversationTurn — first turn (new session)', () => {
  it('creates a new session and returns a real ToolAugmentedResponse from the frozen reasoning chain', async () => {
    const runtime = await realRuntime()
    const result = await runConversationTurn(runtime, { question: QUESTION })

    expect(result.sessionId).toBeTruthy()
    expect(result.turnNumber).toBe(1)
    expect(result.response.response.markdown).toBeTruthy()
    expect(typeof result.response.toolInvoked).toBe('boolean')
  })

  it('persists the new session with exactly one USER and one ASSISTANT message', async () => {
    const runtime = await realRuntime()
    const result = await runConversationTurn(runtime, { question: QUESTION })
    const persisted = await runtime.sessionRepository.findBySessionId(result.sessionId)
    expect(persisted?.history.messages.map(m => m.role)).toEqual(['USER', 'ASSISTANT'])
    expect(persisted?.sessionState.status).toBe('ACTIVE')
  })
})

describe('runConversationTurn — replay across two turns on the same session', () => {
  it('the second turn resumes the same session, accumulating history and advancing turnNumber', async () => {
    const runtime = await realRuntime()
    const first = await runConversationTurn(runtime, { question: QUESTION })
    const second = await runConversationTurn(runtime, { sessionId: first.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?' })

    expect(second.sessionId).toBe(first.sessionId)
    expect(second.turnNumber).toBe(2)

    const persisted = await runtime.sessionRepository.findBySessionId(first.sessionId)
    expect(persisted?.history.messages).toHaveLength(4)
    expect(persisted?.sessionState.advisorHistory.length).toBeGreaterThan(0)
  })

  it('is deterministic: replaying the same two-question sequence twice yields the same turn counts', async () => {
    const runtimeA = await realRuntime()
    const firstA = await runConversationTurn(runtimeA, { question: QUESTION })
    const secondA = await runConversationTurn(runtimeA, { sessionId: firstA.sessionId, question: 'Câu hỏi tiếp theo?' })

    const runtimeB = await realRuntime()
    const firstB = await runConversationTurn(runtimeB, { question: QUESTION })
    const secondB = await runConversationTurn(runtimeB, { sessionId: firstB.sessionId, question: 'Câu hỏi tiếp theo?' })

    expect(secondA.turnNumber).toBe(secondB.turnNumber)
    expect(firstA.response.response.confidenceLabel).toBe(firstB.response.response.confidenceLabel)
  })
})

describe('runConversationTurn — unknown sessionId', () => {
  it('gracefully starts a new session rather than throwing', async () => {
    const runtime = await realRuntime()
    const result = await runConversationTurn(runtime, { sessionId: 'does-not-exist', question: QUESTION })
    expect(result.sessionId).not.toBe('does-not-exist')
    expect(result.turnNumber).toBe(1)
  })
})
