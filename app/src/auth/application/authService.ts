import type { AuthContext, AuthResult, User, Role, Permission, DelegationGrant, ApprovalHierarchy, PasswordCredentials, TokenCredentials } from '../types/authTypes.ts'
import { AuthError } from '../types/authTypes.ts'
import type { IAuthenticationProvider } from '../types/providerTypes.ts'
import type { AuthRepositories } from '../infrastructure/authRepositories.ts'
import { resolveInheritedPermissions } from '../domain/roleHierarchy.ts'
import { resolveDelegatedPermissions } from '../domain/delegation.ts'
import { resolveEffectivePermissions } from '../domain/permission.ts'
import { buildAuthContext } from './authFactory.ts'

// ── Session duration defaults ─────────────────────────────────────────────────
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000       // 8 hours
const REFRESH_DURATION_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

// ── Authenticate ──────────────────────────────────────────────────────────────

export async function authenticate(
  credentials: PasswordCredentials | TokenCredentials,
  provider: IAuthenticationProvider,
  repos: AuthRepositories,
): Promise<AuthResult> {
  const authUser = await provider.authenticate(credentials)

  const user = await repos.users.findById(authUser.userId)
  if (!user) throw new AuthError('USER_NOT_FOUND', 'userId', 'User not found after authentication')

  // Record failed login recovery
  if (user.failedLoginCount > 0) {
    await repos.users.update(user.id, { failedLoginCount: 0, lastLoginAt: new Date().toISOString() })
  } else {
    await repos.users.update(user.id, { lastLoginAt: new Date().toISOString() })
  }

  const now = new Date()
  const session = await repos.sessions.create({
    userId: user.id,
    refreshTokenHash: crypto.randomUUID(), // placeholder — real hash set by ITokenProvider in Phase M
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_DURATION_MS).toISOString(),
    ipAddress: credentials.metadata?.['ipAddress'],
    userAgent: credentials.metadata?.['userAgent'],
  })

  const authContext = await buildFullAuthContext(user, session.id, session.issuedAt, session.expiresAt, repos)

  await repos.auditEvents.append({
    eventType: 'LOGIN',
    userId: user.id,
    sessionId: session.id,
    outcome: 'SUCCESS',
    ipAddress: credentials.metadata?.['ipAddress'],
    userAgent: credentials.metadata?.['userAgent'],
    metadata: { provider: provider.providerId },
    occurredAt: now.toISOString(),
  })

  return { authContext, sessionId: session.id }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(
  sessionId: string,
  actorUserId: string,
  repos: AuthRepositories,
): Promise<void> {
  const revoked = await repos.sessions.revokeBySessionId(sessionId, actorUserId)
  await repos.auditEvents.append({
    eventType: 'LOGOUT',
    userId: actorUserId,
    sessionId,
    outcome: revoked ? 'SUCCESS' : 'FAILURE',
    metadata: {},
    occurredAt: new Date().toISOString(),
  })
}

// ── Refresh session ───────────────────────────────────────────────────────────

export async function refreshSession(
  sessionId: string,
  repos: AuthRepositories,
): Promise<AuthResult> {
  const session = await repos.sessions.findActive(sessionId)
  if (!session) throw new AuthError('SESSION_NOT_FOUND', 'sessionId', 'Session not found or expired')

  const user = await repos.users.findById(session.userId)
  if (!user) throw new AuthError('USER_NOT_FOUND', 'userId', 'User not found')
  if (!user.isActive) throw new AuthError('USER_INACTIVE', 'userId', 'User account is inactive')

  const now = new Date()
  const updated = await repos.sessions.update(session.id, {
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
  })

  const authContext = await buildFullAuthContext(user, updated.id, updated.issuedAt, updated.expiresAt, repos)

  await repos.auditEvents.append({
    eventType: 'TOKEN_REFRESH',
    userId: user.id,
    sessionId,
    outcome: 'SUCCESS',
    metadata: {},
    occurredAt: now.toISOString(),
  })

  return { authContext, sessionId }
}

// ── Build AuthContext from DB ─────────────────────────────────────────────────

export async function buildFullAuthContext(
  user: User,
  sessionId: string,
  issuedAt: string,
  expiresAt: string,
  repos: AuthRepositories,
): Promise<AuthContext> {
  const now = issuedAt

  // Roles + inherited permissions
  const roles: Role[] = await getRolesWithInheritance(user.roleIds, repos)
  const roleMap = new Map(roles.map(r => [r.id, r]))
  const permMap = new Map<string, Permission>()
  for (const r of roles) {
    const inherited = resolveInheritedPermissions(r, roleMap, permMap)
    for (const p of inherited) permMap.set(p.id, p)
    const direct = await repos.permissions.findByIds(r.permissionIds)
    for (const p of direct) permMap.set(p.id, p)
  }

  // Active delegations
  const activeDelegations: DelegationGrant[] = Array.from(
    await repos.delegations.findActive(user.id, now),
  )

  // Delegation permissions
  const allPermissions = Array.from(permMap.values())
  const delegationPerms = resolveDelegatedPermissions(activeDelegations, user.id, allPermissions, now)
  for (const p of delegationPerms) permMap.set(p.id, p)

  const effectivePermissions = resolveEffectivePermissions(
    Array.from(permMap.values()),
    delegationPerms,
  )

  // Approval hierarchies
  const approvalHierarchies: ApprovalHierarchy[] = Array.from(
    await repos.approvalHierarchies.findActive(user.id, now),
  )

  return buildAuthContext({
    user,
    roles,
    effectivePermissions,
    activeDelegations,
    approvalHierarchies,
    sessionId,
    issuedAt,
    expiresAt,
  })
}

async function getRolesWithInheritance(roleIds: readonly string[], repos: AuthRepositories): Promise<Role[]> {
  const collected = new Map<string, Role>()
  const queue = Array.from(roleIds)

  while (queue.length) {
    const id = queue.shift()!
    if (collected.has(id)) continue
    const role = await repos.roles.findById(id)
    if (!role || !role.isActive) continue
    collected.set(id, role)
    if (role.parentRoleId && !collected.has(role.parentRoleId)) {
      queue.push(role.parentRoleId)
    }
  }
  return Array.from(collected.values())
}
