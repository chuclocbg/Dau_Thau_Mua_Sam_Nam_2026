import type { Permission, PermissionScope, AuthContext, DelegationGrant } from '../types/authTypes.ts'

// ── Scope hierarchy: OWN ⊂ DEPARTMENT ⊂ ALL ──────────────────────────────────

const SCOPE_RANK: Record<PermissionScope, number> = { OWN: 0, DEPARTMENT: 1, ALL: 2 }

/** Returns true when the granted scope covers the required scope. */
export function scopeIncludes(granted: PermissionScope, required: PermissionScope): boolean {
  return SCOPE_RANK[granted] >= SCOPE_RANK[required]
}

/** Returns true when the pattern matches the resource.
 *  Supports '*' wildcard at either end: 'PACKAGE:*', '*:read', '*'. */
export function matchesResource(pattern: string, resource: string): boolean {
  if (pattern === '*') return true
  if (pattern === resource) return true
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2)
    return resource === prefix || resource.startsWith(prefix + ':')
  }
  if (pattern.startsWith('*:')) {
    const suffix = pattern.slice(2)
    return resource === suffix || resource.endsWith(':' + suffix)
  }
  return false
}

/** Returns true when pattern matches action ('*' = any). */
export function matchesAction(pattern: string, action: string): boolean {
  return pattern === '*' || pattern === action
}

// ── Permission lookup ─────────────────────────────────────────────────────────

export interface PermissionMatch {
  readonly permission: Permission
  readonly viaDelegation?: DelegationGrant
}

/**
 * Finds the first permission in the list that satisfies (resource, action, scope).
 * Returns null if no match.
 */
export function evaluatePermission(
  permissions: readonly Permission[],
  required: { resource: string; action: string; scope: PermissionScope },
): PermissionMatch | null {
  for (const perm of permissions) {
    if (
      matchesResource(perm.resource, required.resource) &&
      matchesAction(perm.action, required.action) &&
      scopeIncludes(perm.scope, required.scope)
    ) {
      return { permission: perm }
    }
  }
  return null
}

/**
 * Checks if the AuthContext holds a permission for (resource, action, scope).
 * Checks effectivePermissions only — delegates are pre-resolved into them.
 */
export function hasPermission(
  ctx: AuthContext,
  resource: string,
  action: string,
  scope: PermissionScope,
): boolean {
  return evaluatePermission(ctx.effectivePermissions, { resource, action, scope }) !== null
}

/**
 * Merges role permissions, permission grants, and delegation permissions into
 * a deduplicated list. Delegates override nothing — they only add coverage.
 */
export function resolveEffectivePermissions(
  rolePermissions: readonly Permission[],
  delegationPermissions: readonly Permission[],
): readonly Permission[] {
  const seen = new Set<string>()
  const result: Permission[] = []

  const add = (p: Permission) => {
    const key = `${p.resource}:${p.action}:${p.scope}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(p)
    }
  }

  for (const p of rolePermissions) add(p)
  for (const p of delegationPermissions) add(p)
  return result
}

/**
 * Filters delegations to those active at the given point in time, then
 * collects their permission ids.
 */
export function getDelegationPermissionIds(
  delegations: readonly DelegationGrant[],
  asOf: string,
): readonly string[] {
  const ids: string[] = []
  for (const d of delegations) {
    if (!d.revokedAt && d.validFrom <= asOf && d.validUntil > asOf) {
      for (const pid of d.permissionIds) {
        if (!ids.includes(pid)) ids.push(pid)
      }
    }
  }
  return ids
}
