/**
 * Phase X.11 — unit tests for buildRuntimeContext (Runtime dependency composition).
 */

import { describe, it, expect } from 'vitest'
import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
import { buildMemorySessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import { buildMemoryStorageRepositories } from '../storage/infrastructure/memoryStorageRepositories.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'
import { buildApplication } from '../bootstrap/buildApplication.ts'

async function realApplication() {
  const config = loadAppConfigFromEnv({})
  if (!config.ok) throw new Error('unreachable: default config must be valid')
  return buildApplication(config.value)
}

describe('buildRuntimeContext', () => {
  it('defaults to memory-backed session and attachment repositories when none are supplied', async () => {
    const application = await realApplication()
    const runtime = buildRuntimeContext({ application })
    expect(runtime.application).toBe(application)
    expect(await runtime.sessionRepository.count()).toBe(0)
    expect(await runtime.attachmentRepository.count()).toBe(0)
  })

  it('uses caller-supplied repositories instead of defaults when provided', async () => {
    const application = await realApplication()
    const sessionRepository = buildMemorySessionRepository()
    const attachmentRepository = buildMemoryStorageRepositories().attachmentReferences
    await sessionRepository.create({
      sessionState: { sessionId: 's', status: 'CREATED', startedAt: 't', lastActivityAt: 't', advisorHistory: [], attachmentRefs: [] },
      history: { sessionId: 's', messages: [], droppedTurnCount: 0 },
    })

    const runtime = buildRuntimeContext({ application, sessionRepository, attachmentRepository })
    expect(runtime.sessionRepository).toBe(sessionRepository)
    expect(runtime.attachmentRepository).toBe(attachmentRepository)
    expect(await runtime.sessionRepository.count()).toBe(1)
  })
})
