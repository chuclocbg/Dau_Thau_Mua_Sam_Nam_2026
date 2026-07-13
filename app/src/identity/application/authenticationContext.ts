import type { Principal, Permission } from '../domain/identityTypes.ts'
import type { Role } from '../domain/identityTypes.ts'
import { BUILTIN_ROLES, resolveEffectivePermissions } from './permissionResolver.ts'

// ── Authentication Context — Phase X.14 ────────────────────────────────────────
// AuthenticationContext is the "who is calling, what can they do" envelope every authorization
// check consumes -- analogous in role to src/auth/'s AuthContext ("the ONLY object passed to
// application services"), but deliberately its own, business-free type: no departmentId, no
// approvalHierarchies, no activeDelegations. Effective permissions are resolved once at
// construction (mirroring src/auth/'s own "effectivePermissions: pre-resolved at login" design
// choice), never re-resolved per check.

export interface AuthenticationContext {
  readonly principal: Principal
  readonly permissions: readonly Permission[]
}

export function buildAuthenticationContext(
  principal: Principal,
  roleRegistry: ReadonlyMap<string, Role> = BUILTIN_ROLES,
): AuthenticationContext {
  return { principal, permissions: resolveEffectivePermissions(principal.roles, roleRegistry) }
}

// ── Anonymous identity ──────────────────────────────────────────────────────────

export function buildAnonymousContext(): AuthenticationContext {
  const principal: Principal = {
    id: 'anonymous',
    kind: 'ANONYMOUS',
    claims: { subject: 'anonymous', issuedAt: new Date().toISOString(), attributes: {} },
    roles: ['ANONYMOUS'],
  }
  return buildAuthenticationContext(principal)
}

// ── Authenticated user identity (subject supplied by a future, separately-authorized auth
// milestone -- this factory only shapes the Principal, it never verifies a credential) ────────

export function buildUserContext(userId: string, attributes: Readonly<Record<string, string>> = {}): AuthenticationContext {
  const principal: Principal = {
    id: userId,
    kind: 'USER',
    claims: { subject: userId, issuedAt: new Date().toISOString(), attributes },
    roles: ['USER'],
  }
  return buildAuthenticationContext(principal)
}

// ── Service identity (machine-to-machine caller) ───────────────────────────────

export function buildServiceContext(serviceName: string): AuthenticationContext {
  const principal: Principal = {
    id: `service:${serviceName}`,
    kind: 'SERVICE',
    claims: { subject: serviceName, issuedAt: new Date().toISOString(), attributes: {} },
    roles: ['SERVICE'],
  }
  return buildAuthenticationContext(principal)
}

// ── Internal system identity (the Runtime acting on its own behalf -- e.g. Phase X.13's
// recovery scan replaying an interrupted turn, not any particular end user) ───────────────────

export function buildSystemContext(): AuthenticationContext {
  const principal: Principal = {
    id: 'system',
    kind: 'SYSTEM',
    claims: { subject: 'system', issuedAt: new Date().toISOString(), attributes: {} },
    roles: ['SYSTEM'],
  }
  return buildAuthenticationContext(principal)
}
