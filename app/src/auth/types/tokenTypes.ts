import type { Permission } from './authTypes.ts'

// ── Token type discriminator ──────────────────────────────────────────────────

export const TOKEN_TYPES = [
  'ACCESS', 'REFRESH', 'API_KEY', 'DELEGATION', 'SERVICE',
] as const
export type TokenType = typeof TOKEN_TYPES[number]

// ── Access Token — short-lived (15 min target) ────────────────────────────────

export interface IAccessToken {
  readonly tokenId: string
  readonly tokenType: 'ACCESS'
  readonly userId: string
  readonly sessionId: string
  readonly permissions: readonly Permission[]
  readonly departmentId: string
  readonly roles: readonly string[]       // role codes
  readonly issuedAt: string              // ISO 8601
  readonly expiresAt: string             // ISO 8601
  readonly issuer: string                // e.g. 'procurement-platform'
  readonly audience: readonly string[]  // intended recipients
}

// ── Refresh Token — long-lived (7 days target) ────────────────────────────────

export interface IRefreshToken {
  readonly tokenId: string
  readonly tokenType: 'REFRESH'
  readonly userId: string
  readonly sessionId: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly issuer: string
}

// ── API Key — for service-to-service and integration use ─────────────────────

export interface IApiKey {
  readonly keyId: string
  readonly tokenType: 'API_KEY'
  readonly userId: string                // service account id
  readonly name: string                 // human label
  readonly permissions: readonly Permission[]
  readonly allowedIpRanges?: readonly string[]
  readonly createdAt: string
  readonly expiresAt?: string            // null = no expiry
}

// ── Delegation Token — scoped, time-bounded ───────────────────────────────────

export interface IDelegationToken {
  readonly tokenId: string
  readonly tokenType: 'DELEGATION'
  readonly delegationId: string
  readonly fromUserId: string
  readonly toUserId: string
  readonly issuedAt: string
  readonly expiresAt: string
}

// ── Service Token — for internal microservice trust ───────────────────────────

export interface IServiceToken {
  readonly tokenId: string
  readonly tokenType: 'SERVICE'
  readonly serviceId: string
  readonly permissions: readonly Permission[]
  readonly issuedAt: string
  readonly expiresAt: string
}

// ── Token Pair — returned after successful login / refresh ───────────────────

export interface TokenPair {
  readonly accessToken: string           // serialized (opaque until ITokenProvider impl)
  readonly refreshToken: string          // serialized (opaque until ITokenProvider impl)
  readonly expiresAt: string            // access token expiry
  readonly refreshExpiresAt: string     // refresh token expiry
}

// ── Payload shapes for ITokenProvider.create* methods ────────────────────────

export interface AccessTokenPayload {
  readonly userId: string
  readonly sessionId: string
  readonly departmentId: string
  readonly roleCodes: readonly string[]
  readonly permissions: readonly Permission[]
  readonly expiresIn: number            // seconds
}

export interface RefreshTokenPayload {
  readonly userId: string
  readonly sessionId: string
  readonly expiresIn: number            // seconds (7 * 24 * 3600 = 604800)
}
