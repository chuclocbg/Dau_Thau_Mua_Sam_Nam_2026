import type { Role, Permission } from '../types/authTypes.ts'
import { AuthError } from '../types/authTypes.ts'

// ── Ancestor traversal ────────────────────────────────────────────────────────

/**
 * Returns all ancestor roles (parent, grandparent, …) for roleId.
 * Stops at cycles — throws AuthError if detected.
 */
export function buildRoleAncestors(
  roleId: string,
  roleMap: ReadonlyMap<string, Role>,
): readonly string[] {
  const ancestors: string[] = []
  const visited = new Set<string>()
  let current = roleId

  while (true) {
    const role = roleMap.get(current)
    if (!role || !role.parentRoleId) break
    if (visited.has(role.parentRoleId)) {
      throw new AuthError('DELEGATION_CYCLE_DETECTED', 'parentRoleId', `Role cycle detected at ${role.parentRoleId}`)
    }
    visited.add(current)
    ancestors.push(role.parentRoleId)
    current = role.parentRoleId
  }
  return ancestors
}

export function detectRoleCycle(
  roleId: string,
  newParentId: string,
  roleMap: ReadonlyMap<string, Role>,
): boolean {
  // Would newParentId eventually point back to roleId?
  const visited = new Set<string>()
  let current = newParentId
  while (current) {
    if (current === roleId) return true
    if (visited.has(current)) break
    visited.add(current)
    const parent = roleMap.get(current)
    if (!parent?.parentRoleId) break
    current = parent.parentRoleId
  }
  return false
}

export function getRoleDepth(roleId: string, roleMap: ReadonlyMap<string, Role>): number {
  let depth = 0
  const visited = new Set<string>()
  let current = roleId
  while (true) {
    const role = roleMap.get(current)
    if (!role?.parentRoleId || visited.has(current)) break
    visited.add(current)
    current = role.parentRoleId
    depth++
  }
  return depth
}

// ── Permission resolution ─────────────────────────────────────────────────────

/**
 * Returns all permissions for a role including those inherited from ancestor roles.
 * roleMap: all available roles; permMap: all available permissions.
 */
export function resolveInheritedPermissions(
  role: Role,
  roleMap: ReadonlyMap<string, Role>,
  permMap: ReadonlyMap<string, Permission>,
): readonly Permission[] {
  const collected = new Set<string>()
  const result: Permission[] = []

  const collectRole = (r: Role, depth: number) => {
    if (depth > 20) return // hard guard — cycles are blocked upstream
    for (const pid of r.permissionIds) {
      if (!collected.has(pid)) {
        collected.add(pid)
        const perm = permMap.get(pid)
        if (perm) result.push(perm)
      }
    }
    if (r.parentRoleId) {
      const parent = roleMap.get(r.parentRoleId)
      if (parent) collectRole(parent, depth + 1)
    }
  }

  collectRole(role, 0)
  return result
}
