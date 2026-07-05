import type { AuthCredentials, AuthContext, Session, User, PermissionScope, Permission } from './authTypes.ts'
import type { IAccessToken, IRefreshToken, AccessTokenPayload, RefreshTokenPayload, TokenPair } from './tokenTypes.ts'

// ── Provider type discriminator ───────────────────────────────────────────────

export const AUTH_PROVIDER_TYPES = [
  'local', 'ldap', 'oidc', 'saml2', 'oauth2',
  'keycloak', 'azure_ad', 'google_workspace',
  'vneid', 'government_sso', 'api_key',
] as const
export type AuthProviderType = typeof AUTH_PROVIDER_TYPES[number]

// ── AuthUser — lightweight identity returned by every authentication provider ─

export interface AuthUser {
  readonly userId: string               // stable unique id in this system
  readonly username: string
  readonly email: string
  readonly displayName: string
  readonly departmentId?: string
  readonly externalId?: string          // provider-specific (LDAP DN, OIDC sub, etc.)
  readonly externalProvider: string
  readonly attributes: Readonly<Record<string, string>>
}

// ── IAuthenticationProvider ───────────────────────────────────────────────────
// Pluggable identity verification. Implementations: LocalAuthProvider, LdapAuthProvider,
// OidcAuthProvider, SamlAuthProvider, KeycloakAuthProvider, AzureAdAuthProvider, etc.

export interface IAuthenticationProvider {
  readonly providerId: string
  readonly providerType: AuthProviderType
  authenticate(credentials: AuthCredentials): Promise<AuthUser>
  supports(credentialType: string): boolean
}

// ── ITokenProvider ────────────────────────────────────────────────────────────
// Pluggable token generation. Not implemented in Phase J.
// Phase M+ will wire in JWT RS256, rotating refresh tokens, etc.

export interface ITokenProvider {
  readonly providerId: string
  createAccessToken(payload: AccessTokenPayload): Promise<string>
  verifyAccessToken(token: string): Promise<IAccessToken | null>
  createRefreshToken(payload: RefreshTokenPayload): Promise<string>
  verifyRefreshToken(token: string): Promise<IRefreshToken | null>
  hashToken(token: string): string
  createTokenPair(payload: AccessTokenPayload, refreshPayload: RefreshTokenPayload): Promise<TokenPair>
}

// ── IPasswordHasher ───────────────────────────────────────────────────────────
// Injectable for tests (MockPasswordHasher) vs production (Argon2, bcrypt, PBKDF2).

export interface IPasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}

// ── IPermissionProvider ───────────────────────────────────────────────────────
// External permission resolution (e.g. a policy service, external IAM system).

export interface IPermissionProvider {
  readonly providerId: string
  getPermissionsForRoles(roleIds: readonly string[]): Promise<readonly Permission[]>
  getPermissionsForUser(userId: string): Promise<readonly Permission[]>
  evaluatePermission(userId: string, resource: string, action: string, scope: PermissionScope): Promise<boolean>
}

// ── IIdentityProvider ─────────────────────────────────────────────────────────
// Directory lookup (LDAP, SCIM, HR system, etc.).

export interface IIdentityProvider {
  readonly providerId: string
  getUserById(externalId: string): Promise<AuthUser | null>
  getUserByUsername(username: string): Promise<AuthUser | null>
  searchUsers(query: string, limit?: number): Promise<readonly AuthUser[]>
  syncUser(externalId: string): Promise<User>
}

// ── ISessionProvider ──────────────────────────────────────────────────────────
// External session management (Redis, Memcached, distributed cache, etc.).

export interface ISessionProvider {
  readonly providerId: string
  storeSession(session: Session): Promise<void>
  getSession(sessionId: string): Promise<Session | null>
  revokeSession(sessionId: string): Promise<void>
  getActiveSessionsForUser(userId: string): Promise<readonly Session[]>
  extendSession(sessionId: string, newExpiresAt: string): Promise<Session>
}

// ── IAuthorizationProvider ────────────────────────────────────────────────────
// External policy decision point (OPA, Casbin, custom PDP, etc.) — ABAC extension.

export interface IAuthorizationProvider {
  readonly providerId: string
  evaluate(ctx: AuthContext, resource: string, action: string, attributes?: Record<string, string>): Promise<boolean>
}

// ── Provider registry ─────────────────────────────────────────────────────────

export interface AuthProviders {
  readonly authentication: ReadonlyMap<string, IAuthenticationProvider>
  readonly token?: ITokenProvider
  readonly identity?: ReadonlyMap<string, IIdentityProvider>
  readonly authorization?: IAuthorizationProvider
}
