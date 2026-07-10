/**
 * Phase X.13 — unit/integration tests for conversationRecoveryCoordinator
 * (pending-session restoration, idempotent recovery execution) and runtimeRecoveryManager
 * (startup recovery scan / recovery queue draining), against a real Application.
 */

import { describe, it, expect } from 'vitest'
import { recoverMarker, restorePendingMarker } from '../runtime/recovery/conversationRecoveryCoordinator.ts'
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

describe('restorePendingMarker', () => {
  it('returns the marker only while it is still PENDING', async () => {
    const recoveryRepository = buildMemoryRecoveryRepository()
    const marker = await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    expect((await restorePendingMarker(recoveryRepository, marker.id))?.id).toBe(marker.id)

    await recoveryRepository.update(marker.id, { status: 'COMPLETED' })
    expect(await restorePendingMarker(recoveryRepository, marker.id)).toBeNull()
  })

  it('returns null for an unknown marker id', async () => {
    const recoveryRepository = buildMemoryRecoveryRepository()
    expect(await restorePendingMarker(recoveryRepository, 'missing')).toBeNull()
  })
})

describe('recoverMarker — pending-session restoration (new session)', () => {
  it('a marker with no sessionId recovers by creating a fresh session, matching the original request', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    const marker = await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })

    const outcome = await recoverMarker(recoveryRepository, runtime, marker.id)

    expect(outcome.recovered).toBe(true)
    if (outcome.recovered) {
      expect(outcome.result.sessionId).toBeTruthy()
      expect(outcome.result.turnNumber).toBe(1)
    }
    expect((await recoveryRepository.findById(marker.id))?.status).toBe('COMPLETED')
  })
})

describe('recoverMarker — pending-session restoration (existing session)', () => {
  it('a marker with a real sessionId resumes THAT session rather than creating a new one', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()

    // A completed first turn establishes a real session, exactly as production traffic would.
    const first = await runConversationTurn(runtime, { question: QUESTION })

    // Simulate a crash mid-second-turn: a PENDING marker was written but the turn never finished.
    const marker = await recoveryRepository.create({
      sessionId: first.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?',
      status: 'PENDING', startedAt: new Date().toISOString(),
    })

    const outcome = await recoverMarker(recoveryRepository, runtime, marker.id)

    expect(outcome.recovered).toBe(true)
    if (outcome.recovered) {
      expect(outcome.result.sessionId).toBe(first.sessionId)
      expect(outcome.result.turnNumber).toBe(2)
    }
  })
})

describe('recoverMarker — idempotent recovery execution', () => {
  it('recovering the same marker twice only replays once', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    const marker = await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })

    const first = await recoverMarker(recoveryRepository, runtime, marker.id)
    const second = await recoverMarker(recoveryRepository, runtime, marker.id)

    expect(first.recovered).toBe(true)
    expect(second.recovered).toBe(false)
    if (!second.recovered) expect(second.reason).toBe('ALREADY_RESOLVED')

    if (first.recovered) {
      const sessionAfter = await runtime.sessionRepository.findBySessionId(first.result.sessionId)
      expect(sessionAfter?.history.messages).toHaveLength(2) // not 4 -- no duplicate turn from the second call
    }
  })
})

describe('runStartupRecoveryScan — drains the recovery queue', () => {
  it('recovers every PENDING marker and leaves resolved ones alone', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    await recoveryRepository.create({ question: 'q1', status: 'PENDING', startedAt: '2026-07-10T00:00:00.000Z' })
    await recoveryRepository.create({ question: 'q2', status: 'PENDING', startedAt: '2026-07-10T00:01:00.000Z' })
    const alreadyDone = await recoveryRepository.create({ question: 'q3', status: 'COMPLETED', startedAt: '2026-07-10T00:02:00.000Z' })

    const scanResult = await runStartupRecoveryScan(recoveryRepository, runtime)

    expect(scanResult.scanned).toBe(2)
    expect(scanResult.recovered).toBe(2)
    expect(scanResult.failed).toBe(0)
    expect(await recoveryRepository.findPending()).toEqual([])
    expect((await recoveryRepository.findById(alreadyDone.id))?.status).toBe('COMPLETED')
  })

  it('is idempotent across two full scans -- the second scan finds nothing to do', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })

    const firstScan = await runStartupRecoveryScan(recoveryRepository, runtime)
    const secondScan = await runStartupRecoveryScan(recoveryRepository, runtime)

    expect(firstScan.recovered).toBe(1)
    expect(secondScan.scanned).toBe(0)
    expect(secondScan.recovered).toBe(0)
  })

  it('an empty queue is a clean no-op', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    const result = await runStartupRecoveryScan(recoveryRepository, runtime)
    expect(result).toEqual({ scanned: 0, recovered: 0, failed: 0, alreadyResolved: 0, outcomes: [] })
  })
})
