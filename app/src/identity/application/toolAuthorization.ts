import type { ToolDecider } from '../../reasoning/domain/toolCallingTypes.ts'
import type { AuthenticationContext } from './authenticationContext.ts'
import { evaluateAuthorization } from './authorizationEvaluator.ts'

// ── Tool Authorization — Phase X.14 ────────────────────────────────────────────
// ToolDecider (Phase X.6, frozen) is already a pluggable, injectable decision function --
// runToolCallingStage(response, answer, executor, { decider }) accepts any ToolDecider, so
// authorization can gate tool invocation as a pure higher-order wrapper, with zero modification
// to toolCallingStage.ts or ToolExecutor.ts. If the wrapped decider would invoke a tool but the
// principal lacks tool:invoke permission, the call is declined before it ever reaches
// ToolExecutor -- the tool is never even attempted, not merely audited after the fact.

export function withToolAuthorization(auth: AuthenticationContext, decider: ToolDecider): ToolDecider {
  return (response, answer) => {
    const inner = decider(response, answer)
    if (!inner.shouldInvoke) return inner

    const decision = evaluateAuthorization(auth.principal.id, auth.permissions, {
      resource: 'tool', action: 'invoke', scope: 'OWN',
    })
    if (!decision.allowed) {
      return { shouldInvoke: false, reason: `Tool invocation denied: ${decision.reason}` }
    }
    return inner
  }
}
