import type { DelegationGrant } from '../types/authTypes.ts'
import { AuthError } from '../types/authTypes.ts'
import type { AuthRepositories } from '../infrastructure/authRepositories.ts'
import { isDelegationActive, validateDelegationPeriod, detectDelegationCycle } from '../domain/delegation.ts'
import type { CreateDelegationGrantParams } from './authFactory.ts'

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDelegation(
  params: CreateDelegationGrantParams,
  repos: AuthRepositories,
): Promise<DelegationGrant> {
  validateDelegationPeriod(params.validFrom, params.validUntil)

  const from = await repos.users.findById(params.fromUserId)
  if (!from) throw new AuthError('USER_NOT_FOUND', 'fromUserId', 'Delegating user not found')
  const to = await repos.users.findById(params.toUserId)
  if (!to) throw new AuthError('USER_NOT_FOUND', 'toUserId', 'Receiving user not found')

  const now = new Date().toISOString()
  const allActive = await repos.delegations.findActive(params.fromUserId, now)

  if (detectDelegationCycle(params.fromUserId, params.toUserId, allActive)) {
    throw new AuthError('DELEGATION_CYCLE_DETECTED', 'toUserId', 'Delegation would create a cycle')
  }

  const delegation = await repos.delegations.create(params)

  await repos.auditEvents.append({
    eventType: 'DELEGATION_CREATED',
    userId: params.fromUserId,
    targetUserId: params.toUserId,
    outcome: 'SUCCESS',
    delegationId: delegation.id,
    metadata: { permissionCount: String(params.permissionIds.length) },
    occurredAt: now,
  })

  return delegation
}

// ── Revoke ────────────────────────────────────────────────────────────────────

export async function revokeDelegation(
  delegationId: string,
  revokedBy: string,
  repos: AuthRepositories,
): Promise<DelegationGrant> {
  const d = await repos.delegations.findById(delegationId)
  if (!d) throw new AuthError('DELEGATION_NOT_FOUND', 'delegationId', 'Delegation not found')
  if (d.revokedAt) throw new AuthError('DELEGATION_REVOKED', 'delegationId', 'Delegation already revoked')

  const now = new Date().toISOString()
  const revoked = await repos.delegations.update(delegationId, { revokedAt: now, revokedBy })

  await repos.auditEvents.append({
    eventType: 'DELEGATION_REVOKED',
    userId: revokedBy,
    targetUserId: d.toUserId,
    outcome: 'SUCCESS',
    delegationId,
    metadata: {},
    occurredAt: now,
  })

  return revoked
}

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getActiveDelegations(
  toUserId: string,
  repos: AuthRepositories,
): Promise<readonly DelegationGrant[]> {
  const now = new Date().toISOString()
  return repos.delegations.findActive(toUserId, now)
}

// ── Chain validation ──────────────────────────────────────────────────────────
// Validates that a delegation chain (A→B→C) has no expired/revoked links.

export async function validateDelegationChain(
  delegationIds: readonly string[],
  repos: AuthRepositories,
): Promise<void> {
  const now = new Date().toISOString()
  for (const id of delegationIds) {
    const d = await repos.delegations.findById(id)
    if (!d) throw new AuthError('DELEGATION_NOT_FOUND', 'delegationId', `Delegation ${id} not found`)
    if (!isDelegationActive(d, now)) {
      throw new AuthError('DELEGATION_EXPIRED', 'delegationId', `Delegation ${id} is not active`)
    }
  }
}
