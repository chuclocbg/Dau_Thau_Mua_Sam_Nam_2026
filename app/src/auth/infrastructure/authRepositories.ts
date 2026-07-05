import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type {
  User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy,
} from '../types/authTypes.ts'
import type { AuthAuditEvent } from '../types/auditTypes.ts'

// ── Domain repository contracts ───────────────────────────────────────────────

export interface IUserRepository extends IBaseRepository<User> {
  findByUsername(username: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByExternalId(externalId: string, provider: string): Promise<User | null>
  findByDepartment(departmentId: string): Promise<readonly User[]>
  findActive(): Promise<readonly User[]>
}

export interface IRoleRepository extends IBaseRepository<Role> {
  findByCode(code: string): Promise<Role | null>
  findByIds(ids: readonly string[]): Promise<readonly Role[]>
  findActive(): Promise<readonly Role[]>
  findChildren(parentRoleId: string): Promise<readonly Role[]>
}

export interface IPermissionRepository extends IBaseRepository<Permission> {
  findByIds(ids: readonly string[]): Promise<readonly Permission[]>
  findByResource(resource: string): Promise<readonly Permission[]>
  findByResourceAndAction(resource: string, action: string): Promise<readonly Permission[]>
}

export interface ISessionRepository extends IBaseRepository<Session> {
  findByUserId(userId: string): Promise<readonly Session[]>
  findActive(sessionId: string): Promise<Session | null>
  revokeByUserId(userId: string, revokedBy: string): Promise<void>
  revokeBySessionId(sessionId: string, revokedBy: string): Promise<Session | null>
  cleanExpired(): Promise<number>
}

export interface IDelegationRepository extends IBaseRepository<DelegationGrant> {
  findByFromUser(fromUserId: string): Promise<readonly DelegationGrant[]>
  findByToUser(toUserId: string): Promise<readonly DelegationGrant[]>
  findActive(toUserId: string, asOf: string): Promise<readonly DelegationGrant[]>
}

export interface IApprovalHierarchyRepository extends IBaseRepository<ApprovalHierarchy> {
  findByUserId(userId: string): Promise<readonly ApprovalHierarchy[]>
  findByDepartment(departmentId: string): Promise<readonly ApprovalHierarchy[]>
  findActive(userId: string, asOf: string): Promise<readonly ApprovalHierarchy[]>
  findByAuthorityLevel(level: number): Promise<readonly ApprovalHierarchy[]>
}

export interface IPolicyRepository extends IBaseRepository<Policy> {
  findByResource(resource: string): Promise<readonly Policy[]>
  findActive(): Promise<readonly Policy[]>
  findApplicable(resource: string, action: string): Promise<readonly Policy[]>
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export interface AuthRepositories {
  readonly users: IUserRepository
  readonly roles: IRoleRepository
  readonly permissions: IPermissionRepository
  readonly sessions: ISessionRepository
  readonly delegations: IDelegationRepository
  readonly approvalHierarchies: IApprovalHierarchyRepository
  readonly policies: IPolicyRepository
  readonly auditEvents: import('../types/auditTypes.ts').IAuditEventRepository
}

// Re-export for convenience
export type { AuthAuditEvent }
