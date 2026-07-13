/**
 * Phase X.14 — integration tests for runAuthorizedConversationTurn() (Runtime authorization,
 * Session identity binding), against a real Application (real memory-backed IKnowledgePlatform +
 * LegalProvider, the complete frozen ReasoningEnginePipeline, a real ToolExecutor -- the same
 * "real Application" every X.9.1+ integration test already uses).
 */

import { describe, it, expect } from 'vitest'
import { runAuthorizedConversationTurn } from '../identity/application/runtimeAuthorization.ts'
import { buildAnonymousContext, buildUserContext, buildServiceContext } from '../identity/application/authenticationContext.ts'
import type { AuthenticationContext } from '../identity/application/authenticationContext.ts'
import { buildMemorySessionIdentityRepository } from '../identity/infrastructure/sessionIdentityRepository.ts'
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

describe('runAuthorizedConversationTurn — anonymous callers', () => {
  it('an anonymous principal is authorized to ask a question (matches current, real behavior)', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const outcome = await runAuthorizedConversationTurn(buildAnonymousContext(), sessionIdentityRepository, runtime, { question: QUESTION })
    expect(outcome.authorized).toBe(true)
    if (outcome.authorized) expect(outcome.result.turnNumber).toBe(1)
  })

  it('a new session is bound to the anonymous principal that created it', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const outcome = await runAuthorizedConversationTurn(buildAnonymousContext(), sessionIdentityRepository, runtime, { question: QUESTION })
    if (outcome.authorized) {
      const binding = await sessionIdentityRepository.findBySessionId(outcome.result.sessionId)
      expect(binding?.principalId).toBe('anonymous')
    }
  })
})

describe('runAuthorizedConversationTurn — a principal with no permissions is denied', () => {
  it('denies before ever calling the reasoning pipeline', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const noPermissions: AuthenticationContext = { principal: { id: 'p-none', kind: 'USER', claims: { subject: 'p-none', issuedAt: new Date().toISOString(), attributes: {} }, roles: [] }, permissions: [] }

    const outcome = await runAuthorizedConversationTurn(noPermissions, sessionIdentityRepository, runtime, { question: QUESTION })

    expect(outcome.authorized).toBe(false)
    expect(await runtime.sessionRepository.count()).toBe(0) // no session was ever created
  })
})

describe('runAuthorizedConversationTurn — session ownership', () => {
  it('a second turn from the SAME user resumes their own session', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const user = buildUserContext('user-alice')

    const first = await runAuthorizedConversationTurn(user, sessionIdentityRepository, runtime, { question: QUESTION })
    if (!first.authorized) throw new Error('expected authorized')
    const second = await runAuthorizedConversationTurn(user, sessionIdentityRepository, runtime, {
      sessionId: first.result.sessionId, question: 'Còn mức tạm ứng tối thiểu thì sao?',
    })

    expect(second.authorized).toBe(true)
    if (second.authorized) expect(second.result.turnNumber).toBe(2)
  })

  it('a DIFFERENT user (OWN scope) is denied access to someone else\'s session', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const alice = buildUserContext('user-alice')
    const bob = buildUserContext('user-bob')

    const first = await runAuthorizedConversationTurn(alice, sessionIdentityRepository, runtime, { question: QUESTION })
    if (!first.authorized) throw new Error('expected authorized')

    const outcome = await runAuthorizedConversationTurn(bob, sessionIdentityRepository, runtime, {
      sessionId: first.result.sessionId, question: 'trying to hijack the session',
    })

    expect(outcome.authorized).toBe(false)
    if (!outcome.authorized) expect(outcome.decision.reason).toMatch(/different principal/)
  })

  it('a SERVICE principal (ALL scope) CAN access another principal\'s session', async () => {
    const runtime = await realRuntime()
    const sessionIdentityRepository = buildMemorySessionIdentityRepository()
    const alice = buildUserContext('user-alice')
    const service = buildServiceContext('support-tool')

    const first = await runAuthorizedConversationTurn(alice, sessionIdentityRepository, runtime, { question: QUESTION })
    if (!first.authorized) throw new Error('expected authorized')

    const outcome = await runAuthorizedConversationTurn(service, sessionIdentityRepository, runtime, {
      sessionId: first.result.sessionId, question: 'support follow-up',
    })

    expect(outcome.authorized).toBe(true)
    if (outcome.authorized) expect(outcome.result.turnNumber).toBe(2)
  })
})
