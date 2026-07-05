import type {
  User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy, AuthContext,
} from '../types/authTypes.ts'
import type { AuthAuditEvent } from '../types/auditTypes.ts'

// ── Create param types ────────────────────────────────────────────────────────

export type CreateUserParams = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
export type CreateRoleParams = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>
export type CreatePermissionParams = Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>
export type CreateSessionParams = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
export type CreateDelegationGrantParams = Omit<DelegationGrant, 'id' | 'createdAt' | 'updatedAt'>
export type CreateApprovalHierarchyParams = Omit<ApprovalHierarchy, 'id' | 'createdAt' | 'updatedAt'>
export type CreatePolicyParams = Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>
export type CreateAuditEventParams = Omit<AuthAuditEvent, 'id' | 'createdAt'>

// ── AuthContext builder ───────────────────────────────────────────────────────

export interface BuildAuthContextParams {
  readonly user: User
  readonly roles: readonly Role[]
  readonly effectivePermissions: readonly Permission[]
  readonly activeDelegations: readonly DelegationGrant[]
  readonly approvalHierarchies: readonly ApprovalHierarchy[]
  readonly sessionId: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly metadata?: Readonly<Record<string, string>>
}

export function buildAuthContext(params: BuildAuthContextParams): AuthContext {
  return Object.freeze({
    userId: params.user.id,
    username: params.user.username,
    email: params.user.email,
    displayName: params.user.displayName,
    departmentId: params.user.departmentId,
    roles: params.roles,
    effectivePermissions: params.effectivePermissions,
    activeDelegations: params.activeDelegations,
    approvalHierarchies: params.approvalHierarchies,
    sessionId: params.sessionId,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    metadata: params.metadata ?? {},
  })
}
