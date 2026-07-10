/**
 * Phase X.11 — PrismaSessionRepository (Conversation persistence). DATABASE_URL is not
 * configured in this environment (Docker unavailable — see docs/infrastructure.md), matching
 * the established repo-wide test convention (see legal-repo-document.test.ts's LRD-12): real
 * calls surface getPrismaClient()'s own "DATABASE_URL is not set" guard error rather than being
 * mocked away.
 */

import { describe, it, expect } from 'vitest'
import { PrismaSessionRepository } from '../conversation/infrastructure/prismaSessionRepository.ts'
import type { ISessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'

describe('PrismaSessionRepository throws without DATABASE_URL', () => {
  const repo: ISessionRepository = new PrismaSessionRepository()

  it('create throws a DATABASE_URL configuration error', async () => {
    await expect(repo.create({
      sessionState: { sessionId: 's', status: 'CREATED', startedAt: 't', lastActivityAt: 't', advisorHistory: [], attachmentRefs: [] },
      history: { sessionId: 's', messages: [], droppedTurnCount: 0 },
    })).rejects.toThrow(/DATABASE_URL/)
  })

  it('findById throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findById('x')).rejects.toThrow(/DATABASE_URL/)
  })

  it('findBySessionId throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findBySessionId('x')).rejects.toThrow(/DATABASE_URL/)
  })

  it('findAll throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findAll()).rejects.toThrow(/DATABASE_URL/)
  })
})
