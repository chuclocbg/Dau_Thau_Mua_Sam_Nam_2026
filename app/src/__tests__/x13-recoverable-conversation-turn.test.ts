/**
 * Phase X.13 — unit tests for runRecoverableConversationTurn (the producer side): proves it
 * wraps runConversationTurn() (Phase X.11, frozen) with PENDING -> COMPLETED/FAILED marker
 * bookkeeping without altering the underlying result or swallowing errors.
 */

import { describe, it, expect } from 'vitest'
import { runRecoverableConversationTurn } from '../runtime/recovery/recoverableConversationTurn.ts'
import { buildMemoryRecoveryRepository } from '../runtime/recovery/memoryRecoveryRepository.ts'
import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { buildMemorySessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import type { ISessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import type { AdvisoryConversationSession } from '../conversation/domain/conversationTypes.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'

async function realRuntime() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const application = await buildApplication(config.value)
  return buildRuntimeContext({ application })
}

/** A session repository that fails update() -- simulating a real persistence failure inside
 *  runConversationTurn()'s own builder.persist() call, without modifying any frozen file. */
class FailingUpdateSessionRepository implements ISessionRepository {
  private readonly inner = buildMemorySessionRepository()
  create(entity: Parameters<ISessionRepository['create']>[0]) { return this.inner.create(entity) }
  update(_id: string, _updates: unknown): Promise<AdvisoryConversationSession> {
    return Promise.reject(new Error('simulated persistence failure'))
  }
  delete(id: string) { return this.inner.delete(id) }
  findById(id: string) { return this.inner.findById(id) }
  findAll() { return this.inner.findAll() }
  count() { return this.inner.count() }
  findBySessionId(sessionId: string) { return this.inner.findBySessionId(sessionId) }
}

describe('runRecoverableConversationTurn — success path', () => {
  it('creates a PENDING marker, then marks it COMPLETED with the real sessionId', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()

    const result = await runRecoverableConversationTurn(recoveryRepository, runtime, { question: QUESTION })

    const markers = await recoveryRepository.findAll()
    expect(markers).toHaveLength(1)
    expect(markers[0]?.status).toBe('COMPLETED')
    expect(markers[0]?.sessionId).toBe(result.sessionId)
    expect(markers[0]?.completedAt).toBeTruthy()
  })

  it('the recovery queue is empty after a successful turn', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    await runRecoverableConversationTurn(recoveryRepository, runtime, { question: QUESTION })
    expect(await recoveryRepository.findPending()).toEqual([])
  })
})

describe('runRecoverableConversationTurn — failure path', () => {
  it('marks the marker FAILED with the real error and re-throws rather than swallowing it', async () => {
    const application = (await realRuntime()).application
    const runtime = buildRuntimeContext({ application, sessionRepository: new FailingUpdateSessionRepository() })
    const recoveryRepository = buildMemoryRecoveryRepository()

    await expect(
      runRecoverableConversationTurn(recoveryRepository, runtime, { question: QUESTION }),
    ).rejects.toThrow(/simulated persistence failure/)

    const markers = await recoveryRepository.findAll()
    expect(markers).toHaveLength(1)
    expect(markers[0]?.status).toBe('FAILED')
    expect(markers[0]?.error).toMatch(/simulated persistence failure/)
  })

  it('a FAILED marker is terminal, not left in the recovery queue (distinct from a crashed/still-PENDING one)', async () => {
    const application = (await realRuntime()).application
    const runtime = buildRuntimeContext({ application, sessionRepository: new FailingUpdateSessionRepository() })
    const recoveryRepository = buildMemoryRecoveryRepository()

    await expect(
      runRecoverableConversationTurn(recoveryRepository, runtime, { question: QUESTION }),
    ).rejects.toThrow()

    expect(await recoveryRepository.findPending()).toEqual([])
  })
})
