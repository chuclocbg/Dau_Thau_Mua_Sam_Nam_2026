import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Error ─────────────────────────────────────────────────────────────────────

export const AUTH_ERROR_CODES = [
  'INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'USER_INACTIVE', 'USER_LOCKED',
  'SESSION_NOT_FOUND', 'SESSION_EXPIRED', 'SESSION_REVOKED',
  'PERMISSION_DENIED', 'ROLE_NOT_FOUND', 'PERMISSION_NOT_FOUND',
  'DELEGATION_NOT_FOUND', 'DELEGATION_EXPIRED', 'DELEGATION_REVOKED',
  'DELEGATION_INVALID_PERIOD', 'DELEGATION_CYCLE_DETECTED',
  'POLICY_NOT_FOUND', 'INVALID_SCOPE', 'HIERARCHY_NOT_FOUND',
  'DUPLICATE_USERNAME', 'DUPLICATE_EMAIL', 'VALIDATION_FAILED',
  'NOT_FOUND', 'ALREADY_EXISTS', 'PROVIDER_ERROR',
] as const
export type AuthErrorCode = typeof AUTH_ERROR_CODES[number]

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

// ── Scope — hierarchy: OWN ⊂ DEPARTMENT ⊂ ALL ────────────────────────────────

export const PERMISSION_SCOPES = ['OWN', 'DEPARTMENT', 'ALL'] as const
export type PermissionScope = typeof PERMISSION_SCOPES[number]

export const POLICY_EFFECTS = ['ALLOW', 'DENY'] as const
export type PolicyEffect = typeof POLICY_EFFECTS[number]

// ── Standard resource / action constants (open strings — not enums) ───────────

export const STANDARD_RESOURCES = [
  'PACKAGE', 'PLAN', 'APPROVAL', 'CONTRACT', 'PAYMENT',
  'SUPPLIER', 'USER', 'ROLE', 'PERMISSION', 'DELEGATION',
  'AUDIT', 'HIERARCHY', 'POLICY',
] as const
export type StandardResource = typeof STANDARD_RESOURCES[number]

export const STANDARD_ACTIONS = [
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'SUBMIT',
  'APPROVE', 'REJECT', 'ASSIGN', 'DELEGATE', 'REVOKE',
  'EXPORT', 'IMPORT', 'LIST',
] as const
export type StandardAction = typeof STANDARD_ACTIONS[number]

// ── User ──────────────────────────────────────────────────────────────────────

export interface User {
  readonly id: string
  readonly username: string
  readonly email: string
  readonly displayName: string
  readonly departmentId: string
  readonly roleIds: readonly string[]
  readonly passwordHash?: string          // only for local provider
  readonly externalId?: string           // LDAP DN, OIDC sub, etc.
  readonly externalProvider?: string     // 'local' | 'ldap' | 'oidc' | 'saml' | etc.
  readonly isActive: boolean
  readonly isLocked: boolean
  readonly failedLoginCount: number
  readonly lastLoginAt?: string          // ISO 8601
  readonly passwordChangedAt?: string    // ISO 8601
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Role & Permission ─────────────────────────────────────────────────────────

export interface Role {
  readonly id: string
  readonly code: string                  // unique machine code e.g. 'PROCUREMENT_OFFICER'
  readonly name: string
  readonly description?: string
  readonly permissionIds: readonly string[]
  readonly parentRoleId?: string         // child inherits parent permissions (hierarchy)
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PermissionConditions {
  readonly maxValue?: bigint             // max VNĐ value (for procurement guards)
  readonly allowedDepartments?: readonly string[]
  readonly requiresDelegation?: boolean
  readonly customAttributes?: Readonly<Record<string, string>>
}

export interface Permission {
  readonly id: string
  readonly resource: string              // open string — ABAC-ready
  readonly action: string               // open string — ABAC-ready
  readonly scope: PermissionScope
  readonly conditions?: PermissionConditions
  readonly description?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  readonly id: string                    // used as session identifier
  readonly userId: string
  readonly refreshTokenHash: string      // hash of refresh token (never store raw token)
  readonly issuedAt: string
  readonly expiresAt: string
  readonly refreshExpiresAt: string      // refresh token expiry (longer)
  readonly revokedAt?: string
  readonly revokedBy?: string
  readonly ipAddress?: string
  readonly userAgent?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Delegation ────────────────────────────────────────────────────────────────
// Vietnamese public-sector legal delegation chain (uỷ quyền).
// Every delegation must cite legal authority (Điều ... of the relevant decree).

export interface DelegationGrant {
  readonly id: string
  readonly fromUserId: string            // delegating principal
  readonly toUserId: string             // receiving agent
  readonly permissionIds: readonly string[]
  readonly scope: PermissionScope
  readonly validFrom: string            // ISO 8601 — inclusive
  readonly validUntil: string          // ISO 8601 — exclusive
  readonly reason: string
  readonly legalBasis: readonly LegalBasis[]   // required — RULE-09
  readonly revokedAt?: string
  readonly revokedBy?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Permission Grant (explicit per-user, outside roles) ───────────────────────

export interface PermissionGrant {
  readonly id: string
  readonly userId: string
  readonly permissionId: string
  readonly grantedBy: string
  readonly validFrom: string
  readonly validUntil?: string
  readonly legalBasis?: readonly LegalBasis[]
  readonly revokedAt?: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Approval Hierarchy ────────────────────────────────────────────────────────
// Maps auth users to procurement approval authorities.
// authorityLevel corresponds to masterdata.ApprovalAuthority.level.

export interface ApprovalHierarchy {
  readonly id: string
  readonly userId: string
  readonly departmentId: string
  readonly authorityLevel: number        // 1 = highest (UNIT_HEAD), 4 = PRIME_MINISTER equiv.
  readonly valueThreshold: bigint       // max VNĐ this authority may approve
  readonly packageTypes: readonly string[]
  readonly effectiveFrom: string
  readonly effectiveUntil?: string
  readonly legalBasis: readonly LegalBasis[]
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Policy ────────────────────────────────────────────────────────────────────

export interface PolicyConditions {
  readonly requiredScope?: PermissionScope
  readonly requiredDepartments?: readonly string[]
  readonly maxValue?: bigint
  readonly requiresDelegation?: boolean
  readonly customAttributes?: Readonly<Record<string, string>>
}

export interface PolicyContext {
  readonly userId: string
  readonly departmentId: string
  readonly resource: string
  readonly action: string
  readonly scope: PermissionScope
  readonly resourceValue?: bigint
  readonly attributes?: Readonly<Record<string, string>>
}

export interface Policy {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly resource: string             // can use '*' for wildcard
  readonly action: string              // can use '*' for wildcard
  readonly effect: PolicyEffect
  readonly conditions: PolicyConditions
  readonly priority: number            // lower = higher priority; 0 = highest
  readonly isActive: boolean
  readonly legalBasis?: readonly LegalBasis[]
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Access Decision ───────────────────────────────────────────────────────────

export interface AccessDecision {
  readonly allowed: boolean
  readonly userId: string
  readonly resource: string
  readonly action: string
  readonly scope: PermissionScope
  readonly reason: string
  readonly appliedPolicies: readonly string[]
  readonly matchedPermissionId?: string
  readonly matchedDelegationId?: string
  readonly decidedAt: string
}

// ── Auth Context — the ONLY object passed to application services ──────────────

export interface AuthContext {
  readonly userId: string
  readonly username: string
  readonly email: string
  readonly displayName: string
  readonly departmentId: string
  readonly roles: readonly Role[]
  readonly effectivePermissions: readonly Permission[]  // pre-resolved at login
  readonly activeDelegations: readonly DelegationGrant[]
  readonly approvalHierarchies: readonly ApprovalHierarchy[]
  readonly sessionId: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly metadata: Readonly<Record<string, string>>
}

// ── Auth Result ───────────────────────────────────────────────────────────────

export interface AuthResult {
  readonly authContext: AuthContext
  readonly sessionId: string            // bearer token until ITokenProvider implemented
}

// ── Credentials (abstract — every provider uses this base) ───────────────────

export interface AuthCredentials {
  readonly credentialType: string       // 'password' | 'token' | 'apikey' | 'saml_assertion' | etc.
  readonly metadata?: Readonly<Record<string, string>>
}

export interface PasswordCredentials extends AuthCredentials {
  readonly credentialType: 'password'
  readonly username: string
  readonly password: string
}

export interface TokenCredentials extends AuthCredentials {
  readonly credentialType: 'token'
  readonly token: string
}
