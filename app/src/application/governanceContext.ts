/**
 * Phase 13 — Governance Application Layer: Shared Context and Result Model
 *
 * GovernanceContext is the single runtime descriptor passed to every
 * application service method. It carries the actor, reference date, and all
 * domain values needed for rule evaluation, workflow execution, and audit.
 *
 * GovernanceResult<T> is the standard return envelope for every public
 * service API. Status, data, messages, warnings, errors, confidence,
 * audit trail, legal references, workflow state, and generated artifacts
 * are all present on every response, allowing callers (UI, CLI, REST, MCP)
 * to handle results uniformly without inspecting service-specific types.
 *
 * Bridge helpers (exported):
 *   toRuleContext(ctx)      — GovernanceContext → RuleContext (kernel call)
 *   toWorkflowContext(ctx)  — GovernanceContext → Record<string,string> (orchestrator call)
 *   createAuditEntry(...)   — AuditEntry factory
 *   createResult(...)       — GovernanceResult<T> factory
 *   generateGovernanceContext(params) — GovernanceContext factory
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { Actor } from '../legal/workflowOrchestrator';
import type { RuleContext } from '../legal/governanceRuleEngine';

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * Runtime descriptor for a single governance request.
 * All service methods receive a GovernanceContext as their first parameter.
 * Future fields can be added without breaking existing callers.
 */
export interface GovernanceContext {
  /** ISO YYYY-MM-DD — when this request is being evaluated. Required. */
  readonly currentDate:      string;
  /** The human actor initiating the request. Required. */
  readonly actor:            Actor;
  /** Unique identifier for this request (for idempotency and tracing). Required. */
  readonly requestId:        string;

  /** Overrides currentDate for config resolution (useful for simulations). */
  readonly effectiveDate?:   string;
  readonly organization?:    string;
  readonly department?:      string;
  /** Maps to FUNDING_SOURCE metadata.code in the Rule Engine. */
  readonly fundingSource?:   string;
  readonly procurementType?: string;
  /** Maps to RuleContext.amount (VND). */
  readonly packageValue?:    number;
  readonly assetCategory?:   string;
  /** Legal registry version pinned for this request. */
  readonly legalSnapshot?:   string;
  /** Locale for generated text; defaults to 'vi-VN'. */
  readonly locale?:          string;
  readonly traceId?:         string;
  /** Arbitrary domain-specific key-value pairs. Frozen on creation. */
  readonly metadata?:        Readonly<Record<string, string>>;
}

// ─── Result model ─────────────────────────────────────────────────────────────

export type ResultStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REQUIRES_REVIEW';

export const RESULT_STATUS_VALUES: readonly ResultStatus[] = [
  'SUCCESS', 'FAILED', 'PENDING', 'REQUIRES_REVIEW',
];

export interface AuditEntry {
  readonly timestamp: string;
  readonly action:    string;
  readonly actor?:    string;
  readonly detail?:   string;
}

/**
 * Standard return envelope for every application service method.
 * T is the domain payload (WorkflowInstance, LegalDocument[], etc.).
 */
export interface GovernanceResult<T = unknown> {
  readonly status:             ResultStatus;
  readonly data?:              T;
  readonly messages:           readonly string[];
  readonly warnings:           readonly string[];
  readonly errors:             readonly string[];
  readonly confidence:         number;
  readonly auditTrail:         readonly AuditEntry[];
  /** LegalDocument ids or GovernanceConfig source ids relevant to this result. */
  readonly legalReferences:    readonly string[];
  /** Current workflow state id when the result relates to a workflow instance. */
  readonly workflowState?:     string;
  /** Ids of documents, configs, or records created by this operation. */
  readonly generatedArtifacts: readonly string[];
  readonly metadata:           Readonly<Record<string, string>>;
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Creates an AuditEntry timestamped to now. */
export function createAuditEntry(
  action:  string,
  actor?:  Actor,
  detail?: string,
): AuditEntry {
  // ponytail: non-deterministic timestamp — tests that care use vi.setSystemTime
  return { timestamp: new Date().toISOString(), action, actor: actor?.id, detail };
}

interface ResultOptions<T> {
  readonly data?:              T;
  readonly messages?:          readonly string[];
  readonly warnings?:          readonly string[];
  readonly errors?:            readonly string[];
  readonly confidence?:        number;
  readonly auditTrail?:        readonly AuditEntry[];
  readonly legalReferences?:   readonly string[];
  readonly workflowState?:     string;
  readonly generatedArtifacts?: readonly string[];
  readonly metadata?:          Record<string, string>;
}

/** Creates a frozen GovernanceResult<T>. */
export function createResult<T>(
  status:  ResultStatus,
  options: ResultOptions<T> = {},
): GovernanceResult<T> {
  return {
    status,
    data:               options.data,
    messages:           Object.freeze([...(options.messages           ?? [])]),
    warnings:           Object.freeze([...(options.warnings           ?? [])]),
    errors:             Object.freeze([...(options.errors             ?? [])]),
    confidence:         options.confidence         ?? 1.0,
    auditTrail:         Object.freeze([...(options.auditTrail         ?? [])]),
    legalReferences:    Object.freeze([...(options.legalReferences    ?? [])]),
    workflowState:      options.workflowState,
    generatedArtifacts: Object.freeze([...(options.generatedArtifacts ?? [])]),
    metadata:           Object.freeze({ ...(options.metadata          ?? {}) }),
  };
}

/** Creates a GovernanceContext from raw parameters. locale defaults to 'vi-VN'. */
export function generateGovernanceContext(params: {
  readonly currentDate:      string;
  readonly actor:            Actor;
  readonly requestId:        string;
  readonly effectiveDate?:   string;
  readonly organization?:    string;
  readonly department?:      string;
  readonly fundingSource?:   string;
  readonly procurementType?: string;
  readonly packageValue?:    number;
  readonly assetCategory?:   string;
  readonly legalSnapshot?:   string;
  readonly locale?:          string;
  readonly traceId?:         string;
  readonly metadata?:        Record<string, string>;
}): GovernanceContext {
  return {
    currentDate:      params.currentDate,
    actor:            params.actor,
    requestId:        params.requestId,
    effectiveDate:    params.effectiveDate,
    organization:     params.organization,
    department:       params.department,
    fundingSource:    params.fundingSource,
    procurementType:  params.procurementType,
    packageValue:     params.packageValue,
    assetCategory:    params.assetCategory,
    legalSnapshot:    params.legalSnapshot,
    locale:           params.locale ?? 'vi-VN',
    traceId:          params.traceId,
    metadata:         Object.freeze({ ...(params.metadata ?? {}) }),
  };
}

// ─── Bridge helpers ───────────────────────────────────────────────────────────

/**
 * Converts GovernanceContext to a RuleContext for kernel Rule Engine calls.
 * Uses effectiveDate when present, falls back to currentDate.
 */
export function toRuleContext(ctx: GovernanceContext): RuleContext {
  return {
    asOfDate:    ctx.effectiveDate ?? ctx.currentDate,
    amount:      ctx.packageValue,
    actorRole:   ctx.actor.role,
    fundingCode: ctx.fundingSource,
  };
}

/**
 * Converts GovernanceContext to the string-valued map expected by
 * WorkflowOrchestrator.startWorkflow / transition context parameter.
 * Only populated fields are included (no undefined entries).
 */
export function toWorkflowContext(ctx: GovernanceContext): Record<string, string> {
  const out: Record<string, string> = {
    asOfDate:  ctx.effectiveDate ?? ctx.currentDate,
    actorRole: ctx.actor.role,
  };
  if (ctx.packageValue !== undefined) out['amount']      = String(ctx.packageValue);
  if (ctx.fundingSource)              out['fundingCode'] = ctx.fundingSource;
  if (ctx.department)                 out['department']  = ctx.department;
  if (ctx.traceId)                    out['traceId']     = ctx.traceId;
  return out;
}
