/**
 * Phase X.13 — PrismaRecoveryRepository. DATABASE_URL is not configured in this environment
 * (Docker unavailable — see docs/infrastructure.md), matching the established repo-wide test
 * convention (see legal-repo-document.test.ts's LRD-12, Phase X.10/X.11's own precedent): real
 * calls surface getPrismaClient()'s own "DATABASE_URL is not set" guard error rather than being
 * mocked away.
 *
 * Also the migration test for this milestone: runs the real `npx prisma validate` CLI against
 * prisma/schema.prisma (no live database required) rather than fabricating a pass.
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { PrismaRecoveryRepository } from '../runtime/recovery/prismaRecoveryRepository.ts'
import type { IRecoveryRepository } from '../runtime/recovery/recoveryTypes.ts'

describe('PrismaRecoveryRepository throws without DATABASE_URL', () => {
  const repo: IRecoveryRepository = new PrismaRecoveryRepository()

  it('create throws a DATABASE_URL configuration error', async () => {
    await expect(repo.create({ question: 'q', status: 'PENDING', startedAt: new Date().toISOString() }))
      .rejects.toThrow(/DATABASE_URL/)
  })

  it('findById throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findById('x')).rejects.toThrow(/DATABASE_URL/)
  })

  it('findPending throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findPending()).rejects.toThrow(/DATABASE_URL/)
  })

  it('findBySessionId throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findBySessionId('x')).rejects.toThrow(/DATABASE_URL/)
  })
})

describe('Migration test — prisma schema validity', () => {
  it('`prisma validate` accepts prisma/schema.prisma (including the new ConversationRecoveryMarker model) with no errors', () => {
    expect(() =>
      execSync('npx prisma validate', { cwd: process.cwd(), stdio: 'pipe' }),
    ).not.toThrow()
  })
})
