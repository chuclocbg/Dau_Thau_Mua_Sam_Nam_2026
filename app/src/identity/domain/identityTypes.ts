// ── Identity Model — Phase X.14 Authentication, Authorization & Identity Infrastructure ────────
// A deliberately generic, business-free identity/authorization vocabulary for the AI Runtime.
//
// INSPECTION FINDING (before any code was written): src/auth/ (Phase M1) already implements a
// comprehensive RBAC/ABAC system, but it is procurement-domain business logic, not generic
// infrastructure -- confirmed by direct inspection: authTypes.ts's STANDARD_RESOURCES includes
// 'PACKAGE'/'CONTRACT'/'PAYMENT'/'SUPPLIER'; PermissionConditions.maxValue is commented "for
// procurement guards" (VNĐ value thresholds); ApprovalHierarchy ties to procurement approval
// levels; DelegationGrant requires a LegalBasis citation. Every algorithm in
// src/auth/domain/{permission,roleHierarchy,policy}.ts (scope hierarchy, wildcard resource
// matching, role-ancestor traversal) is typed directly against these business-coupled types, so
// importing any of it would pull procurement/legal concepts into the AI Runtime transitively --
// exactly what this milestone's "no procurement concepts, no legal concepts" requirement
// forbids. Reused the DESIGN (wildcard matching, scope hierarchy, priority-based evaluation are
// sound, general patterns) without importing the CODE (whose types are business-coupled) -- see
// authorizationEvaluator.ts's own header for the specific, deliberately small reimplementation
// this required. This module never imports anything from src/auth/.

export type PrincipalKind = 'ANONYMOUS' | 'USER' | 'SERVICE' | 'SYSTEM'

export interface Claims {
  readonly subject: string
  readonly issuedAt: string
  readonly attributes: Readonly<Record<string, string>>
}

export interface Principal {
  readonly id: string
  readonly kind: PrincipalKind
  readonly claims: Claims
  readonly roles: readonly string[]
}

export type PermissionScope = 'OWN' | 'ALL'

export interface Permission {
  readonly resource: string
  readonly action: string
  readonly scope: PermissionScope
}

export interface Role {
  readonly code: string
  readonly permissions: readonly Permission[]
}

export interface AuthorizationDecision {
  readonly allowed: boolean
  readonly principalId: string
  readonly resource: string
  readonly action: string
  readonly reason: string
  readonly decidedAt: string
}
