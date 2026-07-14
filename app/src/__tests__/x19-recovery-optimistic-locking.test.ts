/**
 * Phase X.19 — resolveIfPending() (optimistic locking / compare-and-swap) and the
 * concurrent-scan-safety fix it enables in conversationRecoveryCoordinator.recoverMarker().
 *
 * Uses `version` (a monotonically-incrementing Int column), not `updatedAt`, as the CAS token --
 * see X19_ARCHITECTURE_DECISION.md for why a DateTime-based token was tried first and rejected.
 *
 * Kept as a NEW file rather than extending the frozen X.13 recovery test files, so those remain
 * byte-for-byte untouched.
 */

import { describe, it, expect } from 'vitest'
import { buildMemoryRecoveryRepository } from '../runtime/recovery/memoryRecoveryRepository.ts'
import { PrismaRecoveryRepository } from '../runtime/recovery/prismaRecoveryRepository.ts'
import { recoverMarker } from '../runtime/recovery/conversationRecoveryCoordinator.ts'
import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'

const QUESTION = 'Mức tạm ứng tối đa là bao nhiêu?'

async function realRuntime() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  const application = await buildApplication(config.value)
  return buildRuntimeContext({ application })
}

describe('resolveIfPending — MemoryRecoveryRepository', () => {
  it('succeeds when the marker is still PENDING and version matches', async () => {
    const repo = buildMemoryRecoveryRepository()
    const marker = await repo.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })

    const result = await repo.resolveIfPending(marker.id, marker.version, { status: 'COMPLETED' })

    expect(result).not.toBeNull()
    expect(result?.status).toBe('COMPLETED')
    expect(result?.version).toBe(marker.version + 1)
  })

  it('returns null when the marker is no longer PENDING', async () => {
    const repo = buildMemoryRecoveryRepository()
    const marker = await repo.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    await repo.update(marker.id, { status: 'COMPLETED' })

    const result = await repo.resolveIfPending(marker.id, marker.version, { status: 'FAILED', error: 'too late' })
    expect(result).toBeNull()
  })

  it('returns null when version no longer matches (a stale read, the lost-race case)', async () => {
    const repo = buildMemoryRecoveryRepository()
    const marker = await repo.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })
    await repo.update(marker.id, { startedAt: marker.startedAt }) // bumps version without changing status

    const result = await repo.resolveIfPending(marker.id, marker.version, { status: 'COMPLETED' })
    expect(result).toBeNull()
  })

  it('returns null for an unknown marker id', async () => {
    const repo = buildMemoryRecoveryRepository()
    const result = await repo.resolveIfPending('missing', 0, { status: 'COMPLETED' })
    expect(result).toBeNull()
  })
})

describe('resolveIfPending — PrismaRecoveryRepository throws without DATABASE_URL', () => {
  it('throws a DATABASE_URL configuration error', async () => {
    const repo = new PrismaRecoveryRepository()
    await expect(repo.resolveIfPending('x', 0, { status: 'COMPLETED' }))
      .rejects.toThrow(/DATABASE_URL/)
  })
})

describe('recoverMarker — concurrent-scan safety (Phase X.19, the actual gap this phase closes)', () => {
  it('two simultaneous recovery attempts against the same marker yield exactly one success and one ALREADY_RESOLVED -- never two replays', async () => {
    const runtime = await realRuntime()
    const recoveryRepository = buildMemoryRecoveryRepository()
    const marker = await recoveryRepository.create({ question: QUESTION, status: 'PENDING', startedAt: new Date().toISOString() })

    const [first, second] = await Promise.all([
      recoverMarker(recoveryRepository, runtime, marker.id),
      recoverMarker(recoveryRepository, runtime, marker.id),
    ])

    const outcomes = [first, second]
    const recovered = outcomes.filter(o => o.recovered)
    const alreadyResolved = outcomes.filter(o => !o.recovered && o.reason === 'ALREADY_RESOLVED')

    expect(recovered).toHaveLength(1)
    expect(alreadyResolved).toHaveLength(1)

    // The strongest proof: the session itself shows exactly one turn appended, not two.
    const winner = recovered[0]
    if (winner?.recovered) {
      const sessionAfter = await runtime.sessionRepository.findBySessionId(winner.result.sessionId)
      expect(sessionAfter?.history.messages).toHaveLength(2) // one user + one assistant message, not four
    }
  })
})
