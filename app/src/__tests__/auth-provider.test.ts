import { describe, it, expect, beforeEach } from 'vitest'
import type { IPasswordHasher } from '../auth/types/providerTypes.ts'
import { AuthError } from '../auth/types/authTypes.ts'
import { LocalAuthProvider } from '../auth/infrastructure/providers/localAuthProvider.ts'
import { MemoryUserRepository } from '../auth/infrastructure/memoryAuthRepositories.ts'

// ── MockPasswordHasher ────────────────────────────────────────────────────────

class MockPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> { return `hashed:${password}` }
  async verify(password: string, hash: string): Promise<boolean> { return hash === `hashed:${password}` }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeUserBase = () => ({
  username: 'alice', email: 'alice@example.com', displayName: 'Alice',
  departmentId: 'dept-1', roleIds: [], isActive: true, isLocked: false, failedLoginCount: 0,
  passwordHash: 'hashed:correct-password', externalProvider: 'local',
})

// ── LocalAuthProvider ─────────────────────────────────────────────────────────

describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider
  let users: MemoryUserRepository
  let hasher: MockPasswordHasher

  beforeEach(async () => {
    users = new MemoryUserRepository()
    hasher = new MockPasswordHasher()
    provider = new LocalAuthProvider(users, hasher)
    await users.create(makeUserBase())
  })

  it('providerId is "local"', () => {
    expect(provider.providerId).toBe('local')
  })

  it('providerType is "local"', () => {
    expect(provider.providerType).toBe('local')
  })

  it('supports("password") returns true', () => {
    expect(provider.supports('password')).toBe(true)
  })

  it('supports("token") returns false', () => {
    expect(provider.supports('token')).toBe(false)
  })

  it('authenticates with valid credentials', async () => {
    const authUser = await provider.authenticate({
      credentialType: 'password', username: 'alice', password: 'correct-password',
    })
    expect(authUser.username).toBe('alice')
    expect(authUser.externalProvider).toBe('local')
  })

  it('throws USER_NOT_FOUND for unknown username', async () => {
    await expect(provider.authenticate({
      credentialType: 'password', username: 'bob', password: 'any',
    })).rejects.toThrow(AuthError)

    await expect(provider.authenticate({
      credentialType: 'password', username: 'bob', password: 'any',
    })).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    await expect(provider.authenticate({
      credentialType: 'password', username: 'alice', password: 'wrong',
    })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('throws USER_INACTIVE for inactive user', async () => {
    const user = (await users.findByUsername('alice'))!
    await users.update(user.id, { isActive: false })
    await expect(provider.authenticate({
      credentialType: 'password', username: 'alice', password: 'correct-password',
    })).rejects.toMatchObject({ code: 'USER_INACTIVE' })
  })

  it('throws USER_LOCKED for locked user', async () => {
    const user = (await users.findByUsername('alice'))!
    await users.update(user.id, { isLocked: true })
    await expect(provider.authenticate({
      credentialType: 'password', username: 'alice', password: 'correct-password',
    })).rejects.toMatchObject({ code: 'USER_LOCKED' })
  })

  it('throws INVALID_CREDENTIALS when no passwordHash set', async () => {
    await users.create({
      ...makeUserBase(), username: 'charlie', email: 'charlie@x.com',
      passwordHash: undefined,
    })
    await expect(provider.authenticate({
      credentialType: 'password', username: 'charlie', password: 'any',
    })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('throws when credentialType is not password', async () => {
    await expect(provider.authenticate({ credentialType: 'token', token: 'abc' })).rejects.toThrow(AuthError)
  })

  it('returned AuthUser has correct shape', async () => {
    const authUser = await provider.authenticate({
      credentialType: 'password', username: 'alice', password: 'correct-password',
    })
    expect(authUser).toMatchObject({
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      departmentId: 'dept-1',
      externalProvider: 'local',
    })
  })
})

// ── MockPasswordHasher ────────────────────────────────────────────────────────

describe('MockPasswordHasher', () => {
  const h = new MockPasswordHasher()

  it('hash returns deterministic result', async () => {
    expect(await h.hash('pw')).toBe('hashed:pw')
  })

  it('verify passes for correct password', async () => {
    expect(await h.verify('pw', 'hashed:pw')).toBe(true)
  })

  it('verify fails for wrong password', async () => {
    expect(await h.verify('wrong', 'hashed:pw')).toBe(false)
  })
})
