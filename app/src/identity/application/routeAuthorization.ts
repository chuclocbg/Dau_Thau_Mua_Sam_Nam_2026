import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import type { AuthenticationContext } from './authenticationContext.ts'
import { evaluateAuthorization } from './authorizationEvaluator.ts'
import type { PermissionScope } from '../domain/identityTypes.ts'
import { buildAnonymousContext } from './authenticationContext.ts'

// ── Route Authorization — Phase X.14 ───────────────────────────────────────────
// A standalone Fastify preHandler-hook BUILDER, deliberately NOT registered on
// src/api/conversationRoutes.ts or wired into src/server/httpServer.ts (both frozen, X.9.1/
// X.12; this milestone permits no carve-out for either, matching X.13's own precedent). A
// complete, tested capability a future, separately-authorized milestone can register via
// server.addHook('preHandler', buildRouteAuthorizationHook(...)) or per-route
// { preHandler: [...] } without any change to this file.
//
// resolvePrincipal defaults to always-anonymous (matching today's actual, real behavior: every
// caller of these routes is currently unauthenticated) -- a real credential-resolution strategy
// (bearer token, API key, etc.) is out of scope for this milestone (no business logic, no
// credential-verification protocol was specified) and is left as an injectable dependency.

export interface RouteAuthorizationRequirement {
  readonly resource: string
  readonly action: string
  readonly scope: PermissionScope
}

export type PrincipalResolver = (req: FastifyRequest) => AuthenticationContext | Promise<AuthenticationContext>

export function buildRouteAuthorizationHook(
  requirement: RouteAuthorizationRequirement,
  resolvePrincipal: PrincipalResolver = () => buildAnonymousContext(),
): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await resolvePrincipal(req)
    const decision = evaluateAuthorization(auth.principal.id, auth.permissions, requirement)
    if (!decision.allowed) {
      await reply.status(403).send({ ok: false, error: { code: 'FORBIDDEN', message: decision.reason } })
    }
  }
}
