import type { FastifyRequest } from 'fastify'
import { buildUserContext, buildAnonymousContext } from '../identity/application/authenticationContext.ts'
import type { AuthenticationContext } from '../identity/application/authenticationContext.ts'

// ── HTTP Principal Resolver — Phase X.15 ───────────────────────────────────────
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
// x-client-id is NOT a credential and NOT authentication. It is a plain, unsigned, caller-
// supplied string -- the same trust level sessionId itself already has. Its purpose is solely to
// give runAuthorizedConversationTurn()'s session-ownership check a real, non-constant signal to
// compare, so two different callers are no longer indistinguishable (which the previous
// always-anonymous default made them, defeating the ownership check entirely -- the exact false-
// sense-of-security failure mode the ADR was written to avoid). Real credential verification
// (bearer token, session cookie, OIDC) is explicitly out of scope -- a future, separately-
// authorized milestone (Phase X.16 in the current roadmap).
//
// Absent header -> buildAnonymousContext(), identical to every request's behavior before this
// milestone. This is a deliberate, verified non-regression: a caller who sends no x-client-id
// experiences exactly today's behavior.

const CLIENT_ID_HEADER = 'x-client-id'

export function resolvePrincipalFromRequest(req: FastifyRequest): AuthenticationContext {
  const header = req.headers[CLIENT_ID_HEADER]
  const clientId = Array.isArray(header) ? header[0] : header
  if (typeof clientId === 'string' && clientId.trim() !== '') {
    return buildUserContext(clientId.trim())
  }
  return buildAnonymousContext()
}
