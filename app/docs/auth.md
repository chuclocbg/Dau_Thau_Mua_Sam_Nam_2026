# Phase J — Authentication & Authorization Infrastructure

## Overview

`src/auth/` is the authentication and authorization infrastructure layer for the procurement platform. It provides enterprise-grade identity management, RBAC, ABAC-ready policy evaluation, Vietnamese delegation chains, and an immutable audit trail — with no dependency on any frozen business module.

## Key Design Decisions

- **`AuthContext` is the only auth object** passed to application services. Never pass JWT payloads, HTTP requests, or raw token strings into business logic.
- **Tokens are interfaces only** (`ITokenProvider`, `IAccessToken`, etc.). In Phase J the `sessionId` serves as a bearer token. Full JWT/RS256 implementation is Phase M+.
- **Provider abstraction from day one.** `IAuthenticationProvider` supports `local`, `ldap`, `oidc`, `saml2`, `oauth2`, `keycloak`, `azure_ad`, `google_workspace`, `vneid`, `government_sso`, `api_key`. No implementation assumes a specific provider.
- **Scope hierarchy:** `OWN ⊂ DEPARTMENT ⊂ ALL`. A permission with `scope: 'ALL'` satisfies any scope requirement.
- **Resource/action are open strings**, not enums. ABAC-ready.
- **Append-only audit log.** `IAuditEventRepository` has no `update`/`delete`.
- **Integration bridge.** `src/auth/integration/authIntegration.ts` is the only file that imports from `src/masterdata/`.

---

## Directory Structure

```
src/auth/
  types/
    authTypes.ts         — domain models: User, Role, Permission, Session, DelegationGrant,
                           ApprovalHierarchy, Policy, AuthContext, AccessDecision, AuthError
    tokenTypes.ts        — token interfaces: IAccessToken, IRefreshToken, TokenPair, etc. (interfaces only)
    providerTypes.ts     — provider interfaces: IAuthenticationProvider, IPasswordHasher, etc.
    auditTypes.ts        — AuthAuditEvent (append-only), IAuditEventRepository
  domain/
    permission.ts        — scopeIncludes, matchesResource, evaluatePermission, resolveEffectivePermissions
    delegation.ts        — isDelegationActive, validateDelegationPeriod, detectDelegationCycle
    roleHierarchy.ts     — buildRoleAncestors, detectRoleCycle, resolveInheritedPermissions
    policy.ts            — matchesPolicy, evaluatePolicies, resolveHighestPriorityDecision
  validation/
    authValidation.ts    — validateCredentials, validateUser, validateRole, validateDelegation, etc.
  infrastructure/
    authRepositories.ts  — IUserRepository, IRoleRepository, … , AuthRepositories aggregate
    memoryAuthRepositories.ts  — in-memory implementations + buildMemoryAuthRepositories()
    prismaAuthRepositories.ts  — Prisma stubs (all methods throw, Phase M+)
    providers/
      localAuthProvider.ts — LocalAuthProvider: username+password against IUserRepository+IPasswordHasher
  application/
    authFactory.ts       — buildAuthContext(), CreateXxxParams types
    authService.ts       — authenticate(), logout(), refreshSession(), buildFullAuthContext()
    authorizationService.ts — checkPermission() (sync), authorize() (async+audit), checkPermissions()
    delegationService.ts — createDelegation(), revokeDelegation(), getActiveDelegations()
  integration/
    authIntegration.ts   — bridge to src/masterdata/: getApprovalAuthorities(), resolveValueApprovalLevel()
  index.ts               — public API
```

---

## RBAC Model

```
User ���─(roleIds)──► Role ──(permissionIds)──► Permission
                     │                           │
                     └── parentRoleId ──► Role   ├── resource: string (open)
                          (inheritance)          ├── action: string (open)
                                                 └── scope: OWN | DEPARTMENT | ALL
```

**Role inheritance:** A role inherits all permissions from its parent (and grandparent, etc.). `resolveInheritedPermissions()` traverses the chain.

**Effective permissions** are pre-computed at login time and stored on `AuthContext.effectivePermissions`. This includes role permissions, inherited permissions, and delegation permissions.

---

## ABAC Extension Points

- **`PermissionConditions`** on a `Permission`: `maxValue`, `allowedDepartments`, `requiresDelegation`, `customAttributes`.
- **`PolicyConditions`** on a `Policy`: same fields.
- **`IAuthorizationProvider`**: plug in OPA, Casbin, or a custom PDP for complex attribute-based evaluation.
- **`PolicyContext.attributes`**: arbitrary key-value attributes passed to policy evaluation.

---

## Policy Evaluation (4-tier conflict resolution)

When `authorize()` is called, active policies are evaluated with this precedence:

| Tier | Rule | Source |
|------|------|--------|
| 1 | Lower `priority` number wins | LEX_POSTERIOR via explicit ordering |
| 2 | Higher specificity wins (specific resource > `'*'`) | LEX_SPECIALIS |
| 3 | `DENY` wins at equal priority | MORE_RESTRICTIVE |
| 4 | Permission fallback when no policy matches | HIERARCHY |

---

## Vietnamese Delegation Model

Every `DelegationGrant` requires:
- `legalBasis: readonly LegalBasis[]` — cite the decree/article authorizing the delegation (RULE-09)
- `validFrom` / `validUntil` — ISO 8601 exclusive end
- `reason` — human justification

Supported chains: Principal → Vice Principal → Department Head → Authorized Officer → Temporary Delegation.

`detectDelegationCycle()` prevents circular chains. `validateDelegationPeriod()` enforces a configurable max duration (default 365 days).

---

## Authentication Sequence

```
Client → authenticate(credentials, provider, repos)
           │
           ├─ provider.authenticate(credentials)  ← IAuthenticationProvider
           │   returns AuthUser
           ├─ users.findById(authUser.userId)
           ├─ sessions.create(...)
           ├─ buildFullAuthContext(user, sessionId, repos)
           │   ├─ getRolesWithInheritance(roleIds)
           │   ├─ resolveInheritedPermissions(role, roleMap, permMap)
           │   ├─ delegations.findActive(userId, now)
           │   ├─ resolveDelegatedPermissions(...)
           │   └─ approvalHierarchies.findActive(userId, now)
           ├─ auditEvents.append(LOGIN)
           └─ returns AuthResult { authContext, sessionId }
```

---

## Authorization Sequence

**Fast path (sync, no DB):**
```typescript
const allowed = checkPermission(ctx, 'PACKAGE', 'APPROVE', 'DEPARTMENT')
```

**Full path (async, with policy evaluation + audit):**
```typescript
const decision = await authorize(ctx, 'PACKAGE', 'APPROVE', 'DEPARTMENT', repos, valueVnd)
// decision.allowed, decision.reason, decision.appliedPolicies — fully explainable
```

---

## Audit Events

All 23 event types are append-only. `IAuditEventRepository` provides no `update` or `delete` methods.

Key events: `LOGIN`, `LOGOUT`, `TOKEN_REFRESH`, `ACCESS_GRANTED`, `ACCESS_DENIED`, `ROLE_ASSIGNED`, `PERMISSION_GRANTED`, `DELEGATION_CREATED`, `DELEGATION_USED`, `DELEGATION_REVOKED`, `POLICY_APPLIED`, `POLICY_OVERRIDDEN`.

---

## Integration with masterdata

`authIntegration.ts` bridges auth → masterdata:

| Function | Purpose |
|----------|---------|
| `getApprovalAuthorities(repos)` | Load all active approval authorities |
| `getApprovalAuthorityByLevel(level, repos)` | Find authority for a given level |
| `getDepartment(id, repos)` | Look up a department |
| `resolveValueApprovalLevel(valueVnd, repos)` | Minimum authority level for a VNĐ amount |

`bigint` (auth domain) ↔ `number` (masterdata) conversion is handled here. Safe up to Number.MAX_SAFE_INTEGER (≈ 9 quadrillion VNĐ).

---

## Extension Guide

### Adding a new authentication provider

1. Create `src/auth/infrastructure/providers/ldapAuthProvider.ts`
2. Implement `IAuthenticationProvider` from `src/auth/types/providerTypes.ts`
3. Register it in `AuthProviders.authentication` map at startup

### Adding a new permission scope (future)

Update `PERMISSION_SCOPES` in `authTypes.ts` and `SCOPE_RANK` in `permission.ts`. All consumers use `scopeIncludes()` — no other changes needed.

### Switching to JWT tokens (Phase M)

Implement `ITokenProvider` (see `src/auth/types/tokenTypes.ts`) and inject it at startup. No application or domain code changes required.

### Adding a Policy Decision Point

Implement `IAuthorizationProvider` and inject into `AuthProviders.authorization`. Wire it into `authorizationService.authorize()` as a post-policy check.

---

## Test Coverage

| File | Tests |
|------|-------|
| auth-types.test.ts | 25 |
| auth-domain-permission.test.ts | 36 |
| auth-domain-delegation.test.ts | 26 |
| auth-domain-role-hierarchy.test.ts | 21 |
| auth-domain-policy.test.ts | 25 |
| auth-validation.test.ts | 25 |
| auth-repositories.test.ts | 43 |
| auth-audit.test.ts | 9 |
| auth-provider.test.ts | 14 |
| auth-service.test.ts | 14 |
| auth-authorization.test.ts | 13 |
| auth-delegation-service.test.ts | 16 |
| auth-integration.test.ts | 14 |
| **Total** | **265** |
