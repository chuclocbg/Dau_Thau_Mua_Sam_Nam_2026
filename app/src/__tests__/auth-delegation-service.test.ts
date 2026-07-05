import { describe, it, expect, beforeEach } from 'vitest'
import { AuthError } from '../auth/types/authTypes.ts'
import { buildMemoryAuthRepositories } from '../auth/infrastructure/memoryAuthRepositories.ts'
import {
  createDelegation, revokeDelegation, getActiveDelegations, validateDelegationChain,
} from '../auth/application/delegationService.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const legalBasis = [{
  document: 'NĐ-63/2014', article: 'Điều 12', clause: '1', point: '', appendix: '',
  effectiveDate: '2014-07-01', issuingAuthority: 'Chính phủ', summary: 'Thẩm quyền', url: '',
}]

const makeParams = (fromUserId: string, toUserId: string) => ({
  fromUserId, toUserId, permissionIds: ['p1'],
  scope: 'DEPARTMENT' as const,
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2026-12-31T00:00:00.000Z',
  reason: 'Leave coverage', legalBasis,
})

const setupUsersAndRepos = async () => {
  const repos = buildMemoryAuthRepositories()
  const userA = await repos.users.create({
    username: 'alice', email: 'alice@example.com', displayName: 'Alice',
    departmentId: 'dept-1', roleIds: [], isActive: true, isLocked: false, failedLoginCount: 0,
  })
  const userB = await repos.users.create({
    username: 'bob', email: 'bob@example.com', displayName: 'Bob',
    departmentId: 'dept-1', roleIds: [], isActive: true, isLocked: false, failedLoginCount: 0,
  })
  return { repos, userA, userB }
}

// ── createDelegation ──────────────────────────────────────────────────────────

describe('createDelegation', () => {
  it('creates and returns a delegation', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    expect(d.id).toBeTruthy()
    expect(d.fromUserId).toBe(userA.id)
    expect(d.toUserId).toBe(userB.id)
  })

  it('stores legalBasis on delegation', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    expect(d.legalBasis.length).toBeGreaterThan(0)
    expect(d.legalBasis[0].document).toContain('NĐ-63')
  })

  it('throws USER_NOT_FOUND for unknown fromUserId', async () => {
    const repos = buildMemoryAuthRepositories()
    await expect(createDelegation(makeParams('nonexistent', 'also-nonexistent'), repos))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('throws DELEGATION_CYCLE_DETECTED when cycle would result', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    // Create B→A first
    await repos.delegations.create({
      fromUserId: userB.id, toUserId: userA.id, permissionIds: ['p1'],
      scope: 'OWN', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-12-31T00:00:00.000Z',
      reason: 'Existing', legalBasis,
    })
    // Now A→B should be rejected
    await expect(createDelegation(makeParams(userA.id, userB.id), repos))
      .rejects.toMatchObject({ code: 'DELEGATION_CYCLE_DETECTED' })
  })

  it('throws DELEGATION_INVALID_PERIOD when validFrom >= validUntil', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const params = { ...makeParams(userA.id, userB.id), validFrom: '2026-12-31T00:00:00.000Z', validUntil: '2026-01-01T00:00:00.000Z' }
    await expect(createDelegation(params, repos)).rejects.toMatchObject({ code: 'DELEGATION_INVALID_PERIOD' })
  })

  it('records DELEGATION_CREATED audit event', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    await createDelegation(makeParams(userA.id, userB.id), repos)
    const events = await repos.auditEvents.findByUserId(userA.id)
    expect(events.some(e => e.eventType === 'DELEGATION_CREATED')).toBe(true)
  })
})

// ── revokeDelegation ──────────────────────────────────────────────────────────

describe('revokeDelegation', () => {
  it('revokes an existing delegation', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    const revoked = await revokeDelegation(d.id, userA.id, repos)
    expect(revoked.revokedAt).toBeTruthy()
    expect(revoked.revokedBy).toBe(userA.id)
  })

  it('throws DELEGATION_NOT_FOUND for nonexistent id', async () => {
    const repos = buildMemoryAuthRepositories()
    await expect(revokeDelegation('nonexistent', 'user-1', repos)).rejects.toMatchObject({ code: 'DELEGATION_NOT_FOUND' })
  })

  it('throws DELEGATION_REVOKED when already revoked', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    await revokeDelegation(d.id, userA.id, repos)
    await expect(revokeDelegation(d.id, userA.id, repos)).rejects.toMatchObject({ code: 'DELEGATION_REVOKED' })
  })

  it('records DELEGATION_REVOKED audit event', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    await revokeDelegation(d.id, userA.id, repos)
    const events = await repos.auditEvents.findByUserId(userA.id)
    expect(events.some(e => e.eventType === 'DELEGATION_REVOKED')).toBe(true)
  })
})

// ── getActiveDelegations ──────────────────────────────────────────────────────

describe('getActiveDelegations', () => {
  it('returns active delegations for user', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    await createDelegation(makeParams(userA.id, userB.id), repos)
    const active = await getActiveDelegations(userB.id, repos)
    expect(active).toHaveLength(1)
  })

  it('excludes revoked delegations', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    await revokeDelegation(d.id, userA.id, repos)
    const active = await getActiveDelegations(userB.id, repos)
    expect(active).toHaveLength(0)
  })
})

// ── validateDelegationChain ───────────────────────────────────────────────────

describe('validateDelegationChain', () => {
  it('passes for a valid active chain', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    await expect(validateDelegationChain([d.id], repos)).resolves.toBeUndefined()
  })

  it('throws DELEGATION_NOT_FOUND for nonexistent id in chain', async () => {
    const repos = buildMemoryAuthRepositories()
    await expect(validateDelegationChain(['nonexistent'], repos)).rejects.toMatchObject({ code: 'DELEGATION_NOT_FOUND' })
  })

  it('throws DELEGATION_EXPIRED for revoked delegation in chain', async () => {
    const { repos, userA, userB } = await setupUsersAndRepos()
    const d = await createDelegation(makeParams(userA.id, userB.id), repos)
    await revokeDelegation(d.id, userA.id, repos)
    await expect(validateDelegationChain([d.id], repos)).rejects.toMatchObject({ code: 'DELEGATION_EXPIRED' })
  })
})
