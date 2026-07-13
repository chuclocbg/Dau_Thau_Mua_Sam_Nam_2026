import type { Permission, Role } from '../domain/identityTypes.ts'

// ── Permission Resolver — Phase X.14 ───────────────────────────────────────────
// Deterministic, built-in role registry -- deliberately NOT a persisted, admin-editable RBAC
// system (that would duplicate src/auth/'s own role-management purpose and drift toward
// business logic). Four fixed roles, one per PrincipalKind, matching CLAUDE.md's Demo Data
// Principles (never invent real people/departments/organizations -- these are infrastructure
// roles, not organizational ones). ANONYMOUS's default permission intentionally matches what
// every unauthenticated caller can already do today (ask a question) -- introducing identity
// infrastructure must not silently change existing behavior.

export const ANONYMOUS_ROLE: Role = {
  code: 'ANONYMOUS',
  permissions: [{ resource: 'conversation', action: 'ask', scope: 'OWN' }],
}

export const USER_ROLE: Role = {
  code: 'USER',
  permissions: [
    { resource: 'conversation', action: 'ask', scope: 'OWN' },
    { resource: 'conversation', action: 'read', scope: 'OWN' },
  ],
}

export const SERVICE_ROLE: Role = {
  code: 'SERVICE',
  permissions: [
    { resource: 'conversation', action: 'ask', scope: 'ALL' },
    { resource: 'conversation', action: 'read', scope: 'ALL' },
    { resource: 'tool', action: 'invoke', scope: 'ALL' },
  ],
}

export const SYSTEM_ROLE: Role = {
  code: 'SYSTEM',
  permissions: [{ resource: '*', action: '*', scope: 'ALL' }],
}

export const BUILTIN_ROLES: ReadonlyMap<string, Role> = new Map(
  [ANONYMOUS_ROLE, USER_ROLE, SERVICE_ROLE, SYSTEM_ROLE].map(role => [role.code, role]),
)

/** Merges permissions from every role code the principal holds, deduplicated. */
export function resolveEffectivePermissions(
  roleCodes: readonly string[],
  roleRegistry: ReadonlyMap<string, Role> = BUILTIN_ROLES,
): readonly Permission[] {
  const seen = new Set<string>()
  const result: Permission[] = []
  for (const code of roleCodes) {
    const role = roleRegistry.get(code)
    if (!role) continue
    for (const permission of role.permissions) {
      const key = `${permission.resource}:${permission.action}:${permission.scope}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(permission)
      }
    }
  }
  return result
}
