/**
 * Phase X.13 — true end-to-end recovery scenarios ("recovery tests") and deterministic replay
 * verification, against a real Application (real memory-backed IKnowledgePlatform +
 * LegalProvider, the complete frozen ReasoningEnginePipeline, a real ToolExecutor -- the same
 * "real Application" every X.9.1+ integration test already uses).
 *
 * "Crash" is simulated the only honest way possible in a single test process: a PENDING marker
 * is written directly via IRecoveryRepository (exactly what runRecoverableConversationTurn()
 * would have left behind had the process actually died before completing), never by killing a
 * real process -- consistent with this repository's established discipline of simulating
 * failure conditions precisely rather than fabricating an untestable claim.
 */

import { describe, it, expect } from 'vitest'
import { runStartupRecoveryScan } from '../runtime/recovery/runtimeRecoveryManager.ts'
import { buildMemoryRecoveryRepository } from '../runtime/recovery/memoryRecoveryRepository.ts'
import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { runConversationTurn } from '../runtime/conversationEntryOrchestrator.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'

async function realRuntime() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const application = await buildApplication(config.value)
  return buildRuntimeContext({ application })
}

describe('Recovery scenario — crash during a brand-new session\'s first turn', () => {
  it('the startup recovery scan completes the interrupted turn, creating the session that never got persisted', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()

    // Simulate: runRecoverableConversationTurn() wrote this marker, then the process died before
    // runConversationTurn() ever created/persisted a session.
    await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    expect(await runtime.sessionRepository.count()).toBe(0)

    const scanResult = await runStartupRecoveryScan(recoveryRepository, runtime)

    expect(scanResult.recovered).toBe(1)
    expect(await runtime.sessionRepository.count()).toBe(1)
  })
})

describe('Recovery scenario — crash during an existing session\'s second turn', () => {
  it('the startup recovery scan resumes the SAME session and completes the missed turn', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()

    const first = await runConversationTurn(runtime, { question: QUESTION })
    await recoveryRepository.create({
      sessionId: first.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?',
      status: 'PENDING', startedAt: new Date().toISOString(),
    })

    const scanResult = await runStartupRecoveryScan(recoveryRepository, runtime)

    expect(scanResult.recovered).toBe(1)
    expect(await runtime.sessionRepository.count()).toBe(1) // still one session, not two
    const session = await runtime.sessionRepository.findBySessionId(first.sessionId)
    expect(session?.history.messages).toHaveLength(4) // both turns present
  })
})

describe('Recovery scenario — multiple crashed sessions recovered in one scan', () => {
  it('recovers each independently, in startedAt order', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    await recoveryRepository.create({ question: 'Q1', status: 'PENDING', startedAt: '2026-07-10T00:00:00.000Z' })
    await recoveryRepository.create({ question: 'Q2', status: 'PENDING', startedAt: '2026-07-10T00:00:01.000Z' })
    await recoveryRepository.create({ question: 'Q3', status: 'PENDING', startedAt: '2026-07-10T00:00:02.000Z' })

    const scanResult = await runStartupRecoveryScan(recoveryRepository, runtime)

    expect(scanResult.scanned).toBe(3)
    expect(scanResult.recovered).toBe(3)
    expect(await runtime.sessionRepository.count()).toBe(3) // three independent new sessions
  })
})

describe('Deterministic replay verification', () => {
  it('recovering the same interrupted request twice (fresh runtimes) yields the same confidence label and turn count', async () => {
    const runtimeA = await realRuntime()
    const recoveryA = buildMemoryRecoveryRepository()
    await recoveryA.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    const scanA = await runStartupRecoveryScan(recoveryA, runtimeA)

    const runtimeB = await realRuntime()
    const recoveryB = buildMemoryRecoveryRepository()
    await recoveryB.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    const scanB = await runStartupRecoveryScan(recoveryB, runtimeB)

    const outcomeA = scanA.outcomes[0]
    const outcomeB = scanB.outcomes[0]
    expect(outcomeA?.recovered).toBe(true)
    expect(outcomeB?.recovered).toBe(true)
    if (outcomeA?.recovered && outcomeB?.recovered) {
      expect(outcomeA.result.turnNumber).toBe(outcomeB.result.turnNumber)
      expect(outcomeA.result.response.response.confidenceLabel).toBe(outcomeB.result.response.response.confidenceLabel)
      expect(outcomeA.result.response.response.markdown).toBe(outcomeB.result.response.response.markdown)
    }
  })

  it('a recovered turn produces output identical to what an uninterrupted turn would have produced', async () => {
    const uninterruptedRuntime = await realRuntime()
    const direct = await runConversationTurn(uninterruptedRuntime, { question: QUESTION })

    const recoveredRuntime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    const scanResult = await runStartupRecoveryScan(recoveryRepository, recoveredRuntime)
    const outcome = scanResult.outcomes[0]

    expect(outcome?.recovered).toBe(true)
    if (outcome?.recovered) {
      expect(outcome.result.response.response.markdown).toBe(direct.response.response.markdown)
      expect(outcome.result.response.response.confidenceLabel).toBe(direct.response.response.confidenceLabel)
      expect(outcome.result.turnNumber).toBe(direct.turnNumber)
    }
  })
})
