import { runConversationTurn } from '../../runtime/conversationEntryOrchestrator.ts'
import type { ConversationTurnRequest, ConversationTurnResult } from '../../runtime/conversationEntryOrchestrator.ts'
import type { RuntimeContext } from '../../runtime/runtimeContext.ts'
import type { AuthenticationContext } from './authenticationContext.ts'
import { evaluateAuthorization } from './authorizationEvaluator.ts'
import type { AuthorizationDecision, PermissionScope } from '../domain/identityTypes.ts'
import type { ISessionIdentityRepository } from '../infrastructure/sessionIdentityRepository.ts'

// ── Runtime Authorization — Phase X.14 ─────────────────────────────────────────
// Wraps runConversationTurn() (Phase X.11, frozen, unmodified -- imported and called as-is,
// never reimplemented) with an authorization check and session identity binding, exactly
// mirroring Phase X.13's own runRecoverableConversationTurn() wrapper pattern for
// recoverableConversationTurn.ts. Composed at the call site alongside RuntimeContext, never
// added as a field to it.
//
// SESSION IDENTITY BINDING: a session with no prior binding is bound to the calling principal
// on first use. A session already bound to a DIFFERENT principal is rejected UNLESS the caller
// holds ALL scope on conversation:ask (matching the same OWN/ALL scope semantics
// authorizationEvaluator.ts already defines) -- cross-session access requires broader
// permission, not just any authenticated identity.

export type AuthorizedTurnResult =
  | { readonly authorized: true; readonly result: ConversationTurnResult }
  | { readonly authorized: false; readonly decision: AuthorizationDecision }

function hasAllScope(auth: AuthenticationContext, resource: string, action: string): boolean {
  return evaluateAuthorization(auth.principal.id, auth.permissions, { resource, action, scope: 'ALL' }).allowed
}

export async function runAuthorizedConversationTurn(
  auth: AuthenticationContext,
  sessionIdentityRepository: ISessionIdentityRepository,
  runtime: RuntimeContext,
  request: ConversationTurnRequest,
): Promise<AuthorizedTurnResult> {
  const scope: PermissionScope = 'OWN'
  const askDecision = evaluateAuthorization(auth.principal.id, auth.permissions, {
    resource: 'conversation', action: 'ask', scope,
  })
  if (!askDecision.allowed) {
    return { authorized: false, decision: askDecision }
  }

  if (request.sessionId) {
    const existingBinding = await sessionIdentityRepository.findBySessionId(request.sessionId)
    if (existingBinding && existingBinding.principalId !== auth.principal.id && !hasAllScope(auth, 'conversation', 'ask')) {
      return {
        authorized: false,
        decision: {
          allowed: false,
          principalId: auth.principal.id,
          resource: 'conversation',
          action: 'ask',
          reason: `Session ${request.sessionId} belongs to a different principal`,
          decidedAt: new Date().toISOString(),
        },
      }
    }
  }

  const result = await runConversationTurn(runtime, request)

  const binding = await sessionIdentityRepository.findBySessionId(result.sessionId)
  if (!binding) {
    await sessionIdentityRepository.create({
      sessionId: result.sessionId, principalId: auth.principal.id, principalKind: auth.principal.kind,
    })
  }

  return { authorized: true, result }
}
