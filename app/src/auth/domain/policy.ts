import type { Policy, PolicyContext, PolicyEffect, AccessDecision } from '../types/authTypes.ts'
import { matchesResource, matchesAction } from './permission.ts'

// ── Policy match ──────────────────────────────────────────────────────────────

export function matchesPolicy(policy: Policy, ctx: PolicyContext): boolean {
  if (!policy.isActive) return false
  if (!matchesResource(policy.resource, ctx.resource)) return false
  if (!matchesAction(policy.action, ctx.action)) return false
  const c = policy.conditions
  if (c.requiredScope && ctx.scope !== c.requiredScope) return false
  if (c.requiredDepartments?.length && !c.requiredDepartments.includes(ctx.departmentId)) return false
  if (c.maxValue !== undefined && ctx.resourceValue !== undefined && ctx.resourceValue > c.maxValue) return false
  if (c.requiresDelegation && !ctx.attributes?.['hasDelegation']) return false
  return true
}

// ── Single policy evaluation ──────────────────────────────────────────────────

export interface PolicyResult {
  readonly matched: boolean
  readonly effect: PolicyEffect
  readonly policyId: string
  readonly policyName: string
  readonly priority: number
}

export function evaluatePolicy(policy: Policy, ctx: PolicyContext): PolicyResult {
  const matched = matchesPolicy(policy, ctx)
  return { matched, effect: policy.effect, policyId: policy.id, policyName: policy.name, priority: policy.priority }
}

// ── Multi-policy evaluation with 4-tier conflict resolution ──────────────────
// Tier 1: explicit DENY takes absolute precedence if no higher-priority ALLOW overrides
// Tier 2: DENY wins over ALLOW at same priority (MORE_RESTRICTIVE)
// Tier 3: higher-priority (lower number) beats lower-priority (LEX_POSTERIOR via priority field)
// Tier 4: specific resource/action wins over wildcard (LEX_SPECIALIS, measured by '*' count)

function specificity(p: Policy): number {
  return (p.resource === '*' ? 0 : 1) + (p.action === '*' ? 0 : 1)
}

export function evaluatePolicies(
  policies: readonly Policy[],
  ctx: PolicyContext,
): { effect: PolicyEffect; appliedPolicies: readonly string[] } | null {
  const matched = policies
    .map(p => ({ policy: p, result: evaluatePolicy(p, ctx) }))
    .filter(x => x.result.matched)

  if (!matched.length) return null

  // Sort: lower priority number first, then higher specificity, then DENY wins ties
  matched.sort((a, b) => {
    if (a.result.priority !== b.result.priority) return a.result.priority - b.result.priority
    const specDiff = specificity(b.policy) - specificity(a.policy)
    if (specDiff !== 0) return specDiff
    // DENY wins ties (MORE_RESTRICTIVE)
    if (a.policy.effect !== b.policy.effect) return a.policy.effect === 'DENY' ? -1 : 1
    return 0
  })

  const winner = matched[0]
  return {
    effect: winner.policy.effect,
    appliedPolicies: matched.map(m => m.policy.id),
  }
}

// ── Build AccessDecision from policy evaluation ───────────────────────────────

export function resolveHighestPriorityDecision(
  policies: readonly Policy[],
  ctx: PolicyContext,
  permissionMatched: boolean,
  matchedPermissionId?: string,
): AccessDecision {
  const policyResult = evaluatePolicies(policies, ctx)
  const now = new Date().toISOString()

  if (policyResult) {
    const allowed = policyResult.effect === 'ALLOW'
    return {
      allowed,
      userId: ctx.userId,
      resource: ctx.resource,
      action: ctx.action,
      scope: ctx.scope,
      reason: allowed ? 'Policy ALLOW' : 'Policy DENY',
      appliedPolicies: policyResult.appliedPolicies,
      matchedPermissionId,
      decidedAt: now,
    }
  }

  // No matching policy — fall back to permission check
  return {
    allowed: permissionMatched,
    userId: ctx.userId,
    resource: ctx.resource,
    action: ctx.action,
    scope: ctx.scope,
    reason: permissionMatched ? 'Permission granted' : 'No matching permission',
    appliedPolicies: [],
    matchedPermissionId: permissionMatched ? matchedPermissionId : undefined,
    decidedAt: now,
  }
}
