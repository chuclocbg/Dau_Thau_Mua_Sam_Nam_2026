import type { FastifyRequest } from 'fastify'
import { buildUserContext, buildAnonymousContext } from '../identity/application/authenticationContext.ts'
import type { AuthenticationContext } from '../identity/application/authenticationContext.ts'
import { verifyToken } from './credentialToken.ts'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'

// ── HTTP Principal Resolver — Phase X.15, extended X.16 Step 2 ─────────────────
// Per ADR_X15_ARCHITECTURE_DECISION.md: bridges a FastifyRequest to an AuthenticationContext by
// reading the caller-supplied `x-client-id` header, reusing buildUserContext()/
// buildAnonymousContext() (Phase X.14, unmodified) -- this file shapes no identity of its own,
// it only decides which existing factory to call.
//
// LOCATION NOTE (implementation clarification, not a redesign -- see
// ADR_X15_ARCHITECTURE_DECISION.md's own "Implementation Note: Resolver Location" addendum):
// the ADR's original text placed this file under src/identity/application/. Doing so literally
// broke an already-frozen X.14 test (x14-identity-architecture-guard.test.ts's own "src/identity/
// has exactly the 10 expected files" assertion, which recurses the whole tree, unlike X.11's own
// non-recursive equivalent that X.13's subdirectory placement was able to sidestep). Since that
// guard is frozen and must not be modified, this file lives here instead, beside
// conversationRoutes.ts (a file the ADR already authorizes changing) -- same responsibility
// (HTTP -> Principal bridge, X.15), same reuse of X.14's factories, zero frozen file touched.
// The dependency graph is unchanged: src/api/ already depends on src/identity/ under this ADR;
// this file is simply the concrete location of that one edge.
//
// X.16 STEP 2 ADDITION, per X16_PROTOCOL_DECISION.md (Option A -- stdlib-only HMAC bearer
// token), implemented via Path B of that decision's own fork: this function's exported signature
// is UNCHANGED (still `(req) => AuthenticationContext`, no new parameter) -- it calls
// loadAppConfigFromEnv() itself to read CREDENTIAL_SIGNING_SECRET, rather than having the secret
// threaded through registerConversationRoutes()/httpServer.ts. This was a deliberate trade-off,
// chosen specifically to avoid (a) a second exact-argument-count break in
// x12-http-entry-architecture.test.ts's GX-001-fixed call-site literal, which would have required
// a new GX-005, and (b) modifying src/bootstrap/buildApplication.ts (frozen, X.9.1) to thread the
// secret through Application the way streamTimeoutMs was. Every existing call site
// (conversationRoutes.ts's `resolvePrincipalFromRequest(req)`, httpServer.ts's
// `registerConversationRoutes(server, runtime, sessionIdentityRepository)`) is byte-for-byte
// unchanged.
//
// Trust model, by CREDENTIAL_SIGNING_SECRET configuration:
//   - NOT configured (undefined): credential verification is not enabled. x-client-id is trusted
//     directly, exactly as at the X.15 freeze -- a deliberate, verified non-regression so every
//     existing caller/test that does not set this variable keeps its exact pre-X.16 behavior.
//   - Configured: x-client-id's value must be a token verifyToken() accepts (correctly HMAC-
//     signed by this same secret, not expired); the verified payload's subject becomes the
//     principal's id. An absent header, an invalid signature, a tampered payload, or an expired
//     token all fall back to buildAnonymousContext() -- never a 500, never a silently-escalated
//     trusted principal (X16_PROTOCOL_DECISION.md's Acceptance Criteria #2/#3).
//
// x-client-id is still NOT itself a credential when no secret is configured -- OIDC/session-
// cookie alternatives remain out of scope, per X16_PROTOCOL_DECISION.md's own Decision.

const CLIENT_ID_HEADER = 'x-client-id'

export function resolvePrincipalFromRequest(req: FastifyRequest): AuthenticationContext {
  const header = req.headers[CLIENT_ID_HEADER]
  const value = Array.isArray(header) ? header[0] : header
  if (typeof value !== 'string' || value.trim() === '') {
    return buildAnonymousContext()
  }
  const trimmed = value.trim()

  const config = loadAppConfigFromEnv()
  const secret = config.ok ? config.value.credentialSigningSecret : undefined
  if (secret === undefined) {
    return buildUserContext(trimmed)
  }

  const result = verifyToken(secret, trimmed)
  if (result.valid) {
    return buildUserContext(result.payload.subject)
  }
  return buildAnonymousContext()
}
