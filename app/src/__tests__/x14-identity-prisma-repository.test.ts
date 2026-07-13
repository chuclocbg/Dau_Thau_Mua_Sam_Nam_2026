/**
 * Phase X.14 — PrismaSessionIdentityRepository. DATABASE_URL is not configured in this
 * environment (Docker unavailable — see docs/infrastructure.md), matching the established
 * repo-wide test convention (LRD-12, X.10/X.11/X.13's own precedent): real calls surface
 * getPrismaClient()'s own "DATABASE_URL is not set" guard error rather than being mocked away.
 *
 * Also the migration test for this milestone: runs the real `npx prisma validate` CLI against
 * prisma/schema.prisma (no live database required) rather than fabricating a pass.
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { PrismaSessionIdentityRepository } from '../identity/infrastructure/prismaSessionIdentityRepository.ts'
import type { ISessionIdentityRepository } from '../identity/infrastructure/sessionIdentityRepository.ts'

describe('PrismaSessionIdentityRepository throws without DATABASE_URL', () => {
  const repo: ISessionIdentityRepository = new PrismaSessionIdentityRepository()

  it('create throws a DATABASE_URL configuration error', async () => {
    await expect(repo.create({ sessionId: 's', principalId: 'p', principalKind: 'USER' }))
      .rejects.toThrow(/DATABASE_URL/)
  })

  it('findById throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findById('x')).rejects.toThrow(/DATABASE_URL/)
  })

  it('findBySessionId throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findBySessionId('x')).rejects.toThrow(/DATABASE_URL/)
  })
})

describe('Migration test — prisma schema validity', () => {
  // 15000ms, not vitest's 5000ms default: a real `npx prisma validate` child-process spawn
  // takes ~2.8s on an otherwise-idle system (measured directly) -- under full-suite parallel
  // load (500+ concurrent test files) that routinely exceeds 5s, causing a sporadic, load-timing
  // timeout unrelated to this test's own logic (confirmed by re-running the full suite twice:
  // the failing file varied between runs -- X.10's identical, frozen migration test failed
  // instead of this one on the second run -- proving the timeout is a shared, pre-existing
  // characteristic of real-CLI migration tests under load, not specific to this file).
  it('`prisma validate` accepts prisma/schema.prisma (including the new SessionIdentityBinding model) with no errors', () => {
    expect(() =>
      execSync('npx prisma validate', { cwd: process.cwd(), stdio: 'pipe' }),
    ).not.toThrow()
  }, 15000)
})
