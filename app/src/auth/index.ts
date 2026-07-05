// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  User, Role, Permission, Session, DelegationGrant, PermissionGrant,
  ApprovalHierarchy, Policy, PolicyConditions, PolicyContext,
  AccessDecision, AuthContext, AuthResult, AuthCredentials,
  PasswordCredentials, TokenCredentials, PermissionScope,
  PolicyEffect, AuthErrorCode, PermissionConditions,
} from './types/authTypes.ts'
export { AuthError, PERMISSION_SCOPES, POLICY_EFFECTS, STANDARD_RESOURCES, STANDARD_ACTIONS } from './types/authTypes.ts'

export type {
  IAccessToken, IRefreshToken, IApiKey, IDelegationToken, IServiceToken,
  TokenPair, AccessTokenPayload, RefreshTokenPayload, TokenType,
} from './types/tokenTypes.ts'

export type {
  IAuthenticationProvider, ITokenProvider, IPasswordHasher,
  IPermissionProvider, IIdentityProvider, ISessionProvider, IAuthorizationProvider,
  AuthProviders, AuthUser, AuthProviderType,
} from './types/providerTypes.ts'
export { AUTH_PROVIDER_TYPES } from './types/providerTypes.ts'

export type {
  AuthAuditEvent, AuthAuditEventType, AuditOutcome, IAuditEventRepository,
} from './types/auditTypes.ts'
export { AUTH_AUDIT_EVENT_TYPES, AUDIT_OUTCOMES } from './types/auditTypes.ts'

// ── Domain ────────────────────────────────────────────────────────────────────
export {
  scopeIncludes, matchesResource, matchesAction,
  evaluatePermission, hasPermission, resolveEffectivePermissions,
  getDelegationPermissionIds,
} from './domain/permission.ts'
export type { PermissionMatch } from './domain/permission.ts'

export {
  isDelegationActive, isDelegationExpired, isDelegationRevoked,
  validateDelegationPeriod, detectDelegationCycle, resolveDelegatedPermissions,
} from './domain/delegation.ts'

export {
  buildRoleAncestors, detectRoleCycle, getRoleDepth, resolveInheritedPermissions,
} from './domain/roleHierarchy.ts'

export {
  matchesPolicy, evaluatePolicy, evaluatePolicies, resolveHighestPriorityDecision,
} from './domain/policy.ts'
export type { PolicyResult } from './domain/policy.ts'

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateCredentials, validateUser, validateRole, validatePermission,
  validateDelegation, validatePolicy, validateApprovalHierarchy,
} from './validation/authValidation.ts'

// ── Infrastructure ────────────────────────────────────────────────────────────
export type {
  IUserRepository, IRoleRepository, IPermissionRepository, ISessionRepository,
  IDelegationRepository, IApprovalHierarchyRepository, IPolicyRepository,
  AuthRepositories,
} from './infrastructure/authRepositories.ts'

export { buildMemoryAuthRepositories } from './infrastructure/memoryAuthRepositories.ts'
export { buildPrismaAuthRepositories } from './infrastructure/prismaAuthRepositories.ts'
export { LocalAuthProvider } from './infrastructure/providers/localAuthProvider.ts'

// ── Application ───────────────────────────────────────────────────────────────
export { buildAuthContext } from './application/authFactory.ts'
export type {
  CreateUserParams, CreateRoleParams, CreatePermissionParams,
  CreateSessionParams, CreateDelegationGrantParams,
  CreateApprovalHierarchyParams, CreatePolicyParams, CreateAuditEventParams,
  BuildAuthContextParams,
} from './application/authFactory.ts'

export { authenticate, logout, refreshSession, buildFullAuthContext } from './application/authService.ts'
export { checkPermission, authorize, checkPermissions } from './application/authorizationService.ts'
export { createDelegation, revokeDelegation, getActiveDelegations, validateDelegationChain } from './application/delegationService.ts'

// ── Integration ───────────────────────────────────────────────────────────────
export {
  getApprovalAuthorities, getApprovalAuthorityByLevel,
  getDepartment, resolveValueApprovalLevel,
} from './integration/authIntegration.ts'
