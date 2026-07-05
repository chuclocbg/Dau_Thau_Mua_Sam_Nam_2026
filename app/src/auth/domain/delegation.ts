import type { DelegationGrant, Permission } from '../types/authTypes.ts'
import { AuthError } from '../types/authTypes.ts'

// ── Active check ──────────────────────────────────────────────────────────────

export function isDelegationExpired(d: DelegationGrant, asOf: string): boolean {
  return d.validUntil <= asOf
}

export function isDelegationRevoked(d: DelegationGrant): boolean {
  return d.revokedAt !== undefined
}

export function isDelegationActive(d: DelegationGrant, asOf: string): boolean {
  return !isDelegationRevoked(d) && d.validFrom <= asOf && d.validUntil > asOf
}

// ── Period validation ─────────────────────────────────────────────────────────

export function validateDelegationPeriod(
  validFrom: string,
  validUntil: string,
  maxDurationDays = 365,
): void {
  if (validFrom >= validUntil) {
    throw new AuthError('DELEGATION_INVALID_PERIOD', 'validFrom', 'validFrom must be before validUntil')
  }
  const fromMs = new Date(validFrom).getTime()
  const untilMs = new Date(validUntil).getTime()
  const days = (untilMs - fromMs) / 86_400_000
  if (days > maxDurationDays) {
    throw new AuthError(
      'DELEGATION_INVALID_PERIOD',
      'validUntil',
      `Delegation period exceeds maximum of ${maxDurationDays} days`,
    )
  }
}

// ── Cycle detection ───────────────────────────────────────────────────────────
// A→B→A or longer circular delegation chains are illegal.

export function detectDelegationCycle(
  newFrom: string,
  newTo: string,
  allActive: readonly DelegationGrant[],
): boolean {
  // BFS: would newTo eventually delegate back to newFrom?
  const visited = new Set<string>()
  const queue = [newTo]
  while (queue.length) {
    const node = queue.shift()!
    if (node === newFrom) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const d of allActive) {
      if (d.fromUserId === node && !visited.has(d.toUserId)) {
        queue.push(d.toUserId)
      }
    }
  }
  return false
}

// ── Permission resolution ─────────────────────────────────────────────────────

/**
 * Returns all active delegations for toUserId at asOf,
 * filtered to those whose permissionIds are in availablePermissions.
 */
export function resolveDelegatedPermissions(
  delegations: readonly DelegationGrant[],
  toUserId: string,
  availablePermissions: readonly Permission[],
  asOf: string,
): readonly Permission[] {
  const permMap = new Map(availablePermissions.map(p => [p.id, p]))
  const result: Permission[] = []
  const seen = new Set<string>()

  for (const d of delegations) {
    if (d.toUserId !== toUserId || !isDelegationActive(d, asOf)) continue
    for (const pid of d.permissionIds) {
      const perm = permMap.get(pid)
      if (perm && !seen.has(pid)) {
        seen.add(pid)
        result.push(perm)
      }
    }
  }
  return result
}
