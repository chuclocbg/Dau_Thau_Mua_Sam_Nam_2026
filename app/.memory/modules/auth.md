# Module: Authentication & Authorization

**Status:** FROZEN — Phase J (COMPLETE 2026-07-04)
**Location:** `src/auth/`
**Tests:** 265 (passing)

---

## Purpose

Provides authentication (who are you?) and authorization (what can you do?) for all users.
Enforced at the API/Interface layer only. Frozen module service signatures are UNCHANGED.
New modules (Phase N+) accept `AuthContext` as first parameter natively.

---

## Planned Public API

```typescript
AuthContext {
  userId, username, email,
  roles: Role[],
  permissions: Permission[],
  department: string,           // DepartmentId
  delegation?: DelegationGrant[],
  sessionId, issuedAt, expiresAt
}

Role { id, name: RoleCode, permissions: Permission[], department?: string }

Permission { resource: string, action: string, scope: 'own' | 'department' | 'all' }

DelegationGrant {
  delegationId, fromUserId, permissions: Permission[],
  validFrom, validUntil, reason,
  legalBasis: LegalBasis,
  revokedAt?
}

ApprovalHierarchy {
  hierarchyId, level: ApprovalAuthorityLevel,
  userId, department,
  valueThreshold: bigint,
  packageTypes: string[],
  effectiveFrom, effectiveUntil?
}

// Token architecture
// Access Token: JWT RS256, 15 min TTL, payload = AuthContext
// Refresh Token: opaque UUID, 7 days TTL, stored as hash in DB

// IAuthProvider interface
authenticate(credentials): Promise<AuthUser>
refreshSession(refreshToken): Promise<TokenPair>
revokeSession(sessionId): Promise<void>
getUserById(userId): Promise<AuthUser | null>
// Implementations: LocalAuthProvider, OidcAuthProvider, LdapAuthProvider
```

---

## Auth Enforcement Model

```
Frozen modules (A–I): auth at API layer before service call
  guard(ctx, 'contract', 'approve') → contractService.approve(...)

New modules (Phase N+): AuthContext as first param
  supplierService.register(auth, params, repos)
```

---

## Planned Files (~10)

- `authTypes.ts`
- `authRepository.ts`
- `authService.ts`
- `authValidation.ts`
- `tokenService.ts`
- `permissionGuard.ts`
- `memoryAuthRepositories.ts`
- `prismaAuthRepositories.ts`
- `providers/localAuthProvider.ts`
- `authIntegration.ts`

---

## Dependencies

- `src/shared/financial/financialTypes.ts` (LegalBasis for DelegationGrant)
- `src/masterdata/` (ApprovalAuthorityLevel)
- Leaf module — no other business module imports

---

## Design Reference

Full type definitions: `.memory/infra-architecture.md`
