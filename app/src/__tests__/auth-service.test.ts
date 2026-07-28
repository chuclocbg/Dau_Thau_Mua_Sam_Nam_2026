import { describe, it, expect } from 'vitest'
import type { IPasswordHasher } from '../auth/types/providerTypes.ts'
import { AuthError } from '../auth/types/authTypes.ts'
import { buildMemoryAuthRepositories } from '../auth/infrastructure/memoryAuthRepositories.ts'
import { LocalAuthProvider } from '../auth/infrastructure/providers/localAuthProvider.ts'
import { authenticate, logout, refreshSession } from '../auth/application/authService.ts'

// ── MockPasswordHasher ────────────────────────────────────────────────────────

class MockPasswordHasher implements IPasswordHasher {
  async hash(p: string): Promise<string> { return `hashed:${p}` }
  async verify(p: string, h: string): Promise<boolean> { return h === `hashed:${p}` }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const setupRepos = async () => {
  const repos = buildMemoryAuthRepositories()
  const hasher = new MockPasswordHasher()

  const user = await repos.users.create({
    username: 'alice', email: 'alice@example.com', displayName: 'Alice',
    departmentId: 'dept-1', roleIds: [], isActive: true, isLocked: false,
    failedLoginCount: 0, passwordHash: await hasher.hash('secret'),
    externalProvider: 'local',
  })

  const provider = new LocalAuthProvider(repos.users, hasher)
  return { repos, provider, user }
}

// ── authenticate ──────────────────────────────────────────────────────────────

describe('authenticate', () => {
  it('returns AuthResult with authContext and sessionId', async () => {
    const { repos, provider } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    expect(result.sessionId).toBeTruthy()
    expect(result.authContext.userId).toBeTruthy()
    expect(result.authContext.username).toBe('alice')
  })

  it('creates a session in the session repository', async () => {
    const { repos, provider } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    const session = await repos.sessions.findById(result.sessionId)
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(result.authContext.userId)
  })

  it('records LOGIN audit event', async () => {
    const { repos, provider, user } = await setupRepos()
    await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    const events = await repos.auditEvents.findByUserId(user.id)
    expect(events.some(e => e.eventType === 'LOGIN')).toBe(true)
  })

  it('updates lastLoginAt on successful login', async () => {
    const { repos, provider, user } = await setupRepos()
    await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    const updated = await repos.users.findById(user.id)
    expect(updated?.lastLoginAt).toBeTruthy()
  })

  it('throws when provider throws (wrong password)', async () => {
    const { repos, provider } = await setupRepos()
    await expect(authenticate({ credentialType: 'password', username: 'alice', password: 'wrong' }, provider, repos))
      .rejects.toThrow(AuthError)
  })

  it('authContext.effectivePermissions is pre-resolved', async () => {
    const { repos, provider } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    expect(Array.isArray(result.authContext.effectivePermissions)).toBe(true)
  })

  it('authContext.activeDelegations is an array', async () => {
    const { repos, provider } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    expect(Array.isArray(result.authContext.activeDelegations)).toBe(true)
  })
})

// ── logout ────────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('revokes session', async () => {
    const { repos, provider, user } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    await logout(result.sessionId, user.id, repos)
    expect(await repos.sessions.findActive(result.sessionId)).toBeNull()
  })

  it('records LOGOUT audit event', async () => {
    const { repos, provider, user } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    await logout(result.sessionId, user.id, repos)
    const events = await repos.auditEvents.findByUserId(user.id)
    expect(events.some(e => e.eventType === 'LOGOUT')).toBe(true)
  })
})

// ── refreshSession ────────────────────────────────────────────────────────────

describe('refreshSession', () => {
  it('returns a new AuthResult with extended session', async () => {
    const { repos, provider } = await setupRepos()
    const original = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    const refreshed = await refreshSession(original.sessionId, repos)
    expect(refreshed.authContext.userId).toBe(original.authContext.userId)
    expect(refreshed.sessionId).toBe(original.sessionId)
  })

  it('throws SESSION_NOT_FOUND for nonexistent session', async () => {
    const repos = buildMemoryAuthRepositories()
    await expect(refreshSession('nonexistent', repos)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' })
  })

  it('throws for revoked session', async () => {
    const { repos, provider, user } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    await logout(result.sessionId, user.id, repos)
    await expect(refreshSession(result.sessionId, repos)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' })
  })

  it('records TOKEN_REFRESH audit event', async () => {
    const { repos, provider, user } = await setupRepos()
    const result = await authenticate({ credentialType: 'password', username: 'alice', password: 'secret' }, provider, repos)
    await refreshSession(result.sessionId, repos)
    const events = await repos.auditEvents.findByUserId(user.id)
    expect(events.some(e => e.eventType === 'TOKEN_REFRESH')).toBe(true)
  })
})
