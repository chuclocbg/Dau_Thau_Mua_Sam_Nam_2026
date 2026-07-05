import type {
  AuthCredentials, Role, Permission, DelegationGrant, User, Policy, ApprovalHierarchy,
} from '../types/authTypes.ts'
import { AuthError } from '../types/authTypes.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireNonEmpty(value: string, field: string, code: Parameters<typeof AuthError>[0] = 'VALIDATION_FAILED'): void {
  if (!value || !value.trim()) throw new AuthError(code, field, `${field} is required`)
}

function requireIso8601(value: string, field: string): void {
  if (isNaN(Date.parse(value))) throw new AuthError('VALIDATION_FAILED', field, `${field} must be a valid ISO 8601 date`)
}

// ── Credentials ───────────────────────────────────────────────────────────────

export function validateCredentials(creds: AuthCredentials): void {
  requireNonEmpty(creds.credentialType, 'credentialType')
  if (creds.credentialType === 'password') {
    const p = creds as { username?: string; password?: string }
    requireNonEmpty(p.username ?? '', 'username')
    requireNonEmpty(p.password ?? '', 'password')
  }
  if (creds.credentialType === 'token') {
    const t = creds as { token?: string }
    requireNonEmpty(t.token ?? '', 'token')
  }
}

// ── User ──────────────────────────────────────────────────────────────────────

export function validateUser(user: Partial<User>): void {
  requireNonEmpty(user.username ?? '', 'username')
  requireNonEmpty(user.email ?? '', 'email')
  requireNonEmpty(user.displayName ?? '', 'displayName')
  requireNonEmpty(user.departmentId ?? '', 'departmentId')
  if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    throw new AuthError('VALIDATION_FAILED', 'email', 'email is not valid')
  }
}

// ── Role ──────────────────────────────────────────────────────────────────────

export function validateRole(role: Partial<Role>): void {
  requireNonEmpty(role.code ?? '', 'code')
  requireNonEmpty(role.name ?? '', 'name')
  if (role.code && !/^[A-Z_]+$/.test(role.code)) {
    throw new AuthError('VALIDATION_FAILED', 'code', 'role code must be uppercase letters and underscores only')
  }
}

// ── Permission ────────────────────────────────────────────────────────────────

export function validatePermission(p: Partial<Permission>): void {
  requireNonEmpty(p.resource ?? '', 'resource')
  requireNonEmpty(p.action ?? '', 'action')
  if (!p.scope) throw new AuthError('VALIDATION_FAILED', 'scope', 'scope is required')
  if (!['OWN', 'DEPARTMENT', 'ALL'].includes(p.scope ?? '')) {
    throw new AuthError('INVALID_SCOPE', 'scope', `Invalid scope: ${p.scope}`)
  }
}

// ── Delegation ────────────────────────────────────────────────────────────────

export function validateDelegation(d: Partial<DelegationGrant>): void {
  requireNonEmpty(d.fromUserId ?? '', 'fromUserId')
  requireNonEmpty(d.toUserId ?? '', 'toUserId')
  requireNonEmpty(d.reason ?? '', 'reason')
  if (d.validFrom) requireIso8601(d.validFrom, 'validFrom')
  if (d.validUntil) requireIso8601(d.validUntil, 'validUntil')
  if (d.fromUserId && d.toUserId && d.fromUserId === d.toUserId) {
    throw new AuthError('VALIDATION_FAILED', 'toUserId', 'Cannot delegate to yourself')
  }
  if (!d.legalBasis?.length) {
    throw new AuthError('VALIDATION_FAILED', 'legalBasis', 'legalBasis is required for delegation')
  }
  if (!d.permissionIds?.length) {
    throw new AuthError('VALIDATION_FAILED', 'permissionIds', 'at least one permission required')
  }
}

// ── Policy ────────────────────────────────────────────────────────────────────

export function validatePolicy(p: Partial<Policy>): void {
  requireNonEmpty(p.name ?? '', 'name')
  requireNonEmpty(p.resource ?? '', 'resource')
  requireNonEmpty(p.action ?? '', 'action')
  if (!p.effect || !['ALLOW', 'DENY'].includes(p.effect)) {
    throw new AuthError('VALIDATION_FAILED', 'effect', 'effect must be ALLOW or DENY')
  }
  if (p.priority !== undefined && (p.priority < 0 || !Number.isInteger(p.priority))) {
    throw new AuthError('VALIDATION_FAILED', 'priority', 'priority must be a non-negative integer')
  }
}

// ── ApprovalHierarchy ─────────────────────────────────────────────────────────

export function validateApprovalHierarchy(h: Partial<ApprovalHierarchy>): void {
  requireNonEmpty(h.userId ?? '', 'userId')
  requireNonEmpty(h.departmentId ?? '', 'departmentId')
  if (h.authorityLevel !== undefined && (h.authorityLevel < 1 || !Number.isInteger(h.authorityLevel))) {
    throw new AuthError('VALIDATION_FAILED', 'authorityLevel', 'authorityLevel must be a positive integer')
  }
  if (h.valueThreshold !== undefined && h.valueThreshold < 0n) {
    throw new AuthError('VALIDATION_FAILED', 'valueThreshold', 'valueThreshold must be >= 0')
  }
  if (h.effectiveFrom) requireIso8601(h.effectiveFrom, 'effectiveFrom')
  if (h.effectiveUntil) requireIso8601(h.effectiveUntil, 'effectiveUntil')
  if (!h.legalBasis?.length) {
    throw new AuthError('VALIDATION_FAILED', 'legalBasis', 'legalBasis is required for approval hierarchy')
  }
}
