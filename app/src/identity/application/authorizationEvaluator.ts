import type { Permission, PermissionScope, AuthorizationDecision } from '../domain/identityTypes.ts'

// ── Authorization Evaluator — Phase X.14 ───────────────────────────────────────
// matchesResource()/matchesAction()/scopeIncludes() deliberately re-express the same small,
// general wildcard/scope-hierarchy pattern already proven in src/auth/domain/permission.ts --
// not imported from there because that file's functions are typed directly against
// src/auth/'s business-coupled Permission/PermissionScope (OWN/DEPARTMENT/ALL, tied to
// procurement departments), which this milestone's identity Permission/PermissionScope
// (OWN/ALL only, no department concept) is not. This ~15-line matcher is a generic string
// pattern, not business logic; reimplementing it against this module's own types is the smaller,
// more honest violation of "never duplicate" than importing procurement-coupled types would be.

const SCOPE_RANK: Record<PermissionScope, number> = { OWN: 0, ALL: 1 }

export function scopeIncludes(granted: PermissionScope, required: PermissionScope): boolean {
  return SCOPE_RANK[granted] >= SCOPE_RANK[required]
}

export function matchesResource(pattern: string, resource: string): boolean {
  return pattern === '*' || pattern === resource
}

export function matchesAction(pattern: string, action: string): boolean {
  return pattern === '*' || pattern === action
}

export interface AuthorizationRequest {
  readonly resource: string
  readonly action: string
  readonly scope: PermissionScope
}

/** Finds the first permission satisfying (resource, action, scope). Pure, deterministic. */
export function findMatchingPermission(
  permissions: readonly Permission[],
  request: AuthorizationRequest,
): Permission | null {
  for (const permission of permissions) {
    if (
      matchesResource(permission.resource, request.resource) &&
      matchesAction(permission.action, request.action) &&
      scopeIncludes(permission.scope, request.scope)
    ) {
      return permission
    }
  }
  return null
}

/** Pure, deterministic authorization evaluation -- no I/O, no audit side effect (a caller that
 *  needs an audit trail composes one around this, exactly as src/auth/'s own authorize()
 *  composes evaluatePermission() with an audit-append call; this module has no audit sink of
 *  its own to duplicate that into). */
export function evaluateAuthorization(
  principalId: string,
  permissions: readonly Permission[],
  request: AuthorizationRequest,
): AuthorizationDecision {
  const match = findMatchingPermission(permissions, request)
  return {
    allowed: match !== null,
    principalId,
    resource: request.resource,
    action: request.action,
    reason: match !== null ? `Permission granted: ${match.resource}:${match.action}:${match.scope}` : 'No matching permission',
    decidedAt: new Date().toISOString(),
  }
}
