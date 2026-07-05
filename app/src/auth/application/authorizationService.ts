import type { AuthContext, PermissionScope, AccessDecision, PolicyContext } from '../types/authTypes.ts'
import type { AuthRepositories } from '../infrastructure/authRepositories.ts'
import { evaluatePermission } from '../domain/permission.ts'
import { resolveHighestPriorityDecision } from '../domain/policy.ts'

// ── Synchronous fast-path ─────────────────────────────────────────────────────

/**
 * Checks pre-resolved permissions on AuthContext without any DB call.
 * Use this in hot paths where policy evaluation is not needed.
 */
export function checkPermission(
  ctx: AuthContext,
  resource: string,
  action: string,
  scope: PermissionScope,
): boolean {
  return evaluatePermission(ctx.effectivePermissions, { resource, action, scope }) !== null
}

// ── Full authorization (async, with policy evaluation) ────────────────────────

/**
 * Full authorization: checks permissions then evaluates active policies.
 * Returns an explainable AccessDecision.
 */
export async function authorize(
  ctx: AuthContext,
  resource: string,
  action: string,
  scope: PermissionScope,
  repos: AuthRepositories,
  resourceValue?: bigint,
  attributes?: Readonly<Record<string, string>>,
): Promise<AccessDecision> {
  const permMatch = evaluatePermission(ctx.effectivePermissions, { resource, action, scope })

  const policies = await repos.policies.findApplicable(resource, action)
  const activePolicies = policies.filter(p => p.isActive)

  const policyCtx: PolicyContext = {
    userId: ctx.userId,
    departmentId: ctx.departmentId,
    resource,
    action,
    scope,
    resourceValue,
    attributes,
  }

  const decision = resolveHighestPriorityDecision(
    activePolicies,
    policyCtx,
    permMatch !== null,
    permMatch?.permission.id,
  )

  await repos.auditEvents.append({
    eventType: decision.allowed ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    resource,
    action,
    outcome: decision.allowed ? 'SUCCESS' : 'FAILURE',
    reason: decision.reason,
    metadata: { scope, ...(attributes ?? {}) },
    occurredAt: new Date().toISOString(),
  })

  return decision
}

// ── Bulk permission check ─────────────────────────────────────────────────────

export function checkPermissions(
  ctx: AuthContext,
  checks: readonly { resource: string; action: string; scope: PermissionScope }[],
): ReadonlyMap<string, boolean> {
  const result = new Map<string, boolean>()
  for (const check of checks) {
    const key = `${check.resource}:${check.action}:${check.scope}`
    result.set(key, checkPermission(ctx, check.resource, check.action, check.scope))
  }
  return result
}
