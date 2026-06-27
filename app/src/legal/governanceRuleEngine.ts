/**
 * Phase 11.6 — Governance Rule Engine
 *
 * Execution layer of the Governance Configuration Platform.
 * Consumes ConfigResolver (Phase 11.5.3) to produce structured verdicts for
 * threshold, authority, workflow, funding, and compliance checks.
 *
 * No business logic is hardcoded — all limits, roles, and rules are read from
 * active GovernanceConfig objects via ConfigResolver.
 *
 * ─── Public APIs ──────────────────────────────────────────────────────────────
 *
 *   engine.evaluateRule(context)        → RuleResult  generic; uses context.configType
 *   engine.evaluateThreshold(context)   → RuleResult  PROCUREMENT_THRESHOLD check
 *   engine.evaluateAuthority(context)   → RuleResult  AUTHORITY_MATRIX check
 *   engine.evaluateWorkflow(context)    → RuleResult  WORKFLOW_DEFINITION check
 *   engine.evaluateFunding(context)     → RuleResult  FUNDING_SOURCE check
 *   engine.evaluateCompliance(context)  → RuleResult  AUDIT_RULE + RISK_RULE check
 *   buildGovernanceRuleEngine(resolver) → GovernanceRuleEngine
 *
 * ─── Verdict semantics ────────────────────────────────────────────────────────
 *
 *   APPROVED          — config found and all constraints satisfied
 *   REJECTED          — config found but actor/amount exceeds authority
 *   REQUIRES_REVIEW   — config found but escalated process required
 *                       (threshold exceeded, budget exceeded, risk triggered)
 *   INSUFFICIENT_DATA — no applicable config found for the given date/type/code
 *
 * ─── Config metadata conventions ─────────────────────────────────────────────
 *
 *   maxAmount      (PROCUREMENT_THRESHOLD, AUTHORITY_MATRIX) — numeric string, VND
 *   role           (AUTHORITY_MATRIX)                        — actor role string
 *   workflowId     (WORKFLOW_DEFINITION)                     — workflow identifier
 *   code           (FUNDING_SOURCE)                          — funding source code
 *   maxBudget      (FUNDING_SOURCE)                          — numeric string, VND
 *   requiresReview (APPROVAL_POLICY, RISK_RULE)              — "true" flag
 *
 * ─── Extension interfaces (Phase 11.7+) ──────────────────────────────────────
 *
 *   WorkflowEngineHook     — notified after each rule evaluation
 *   AuthorityEngineHook    — determines if escalation is needed
 *   DocumentGeneratorHook  — determines if a document must be generated
 *   ExecutiveCopilotHook   — board-level summary of rule result
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 * All evaluations use the asOfDate in context — never calls new Date().
 */

import type { ConfigType, GovernanceConfig } from './governanceConfig';
import type { ConfigResolver, ResolverOptions } from './configResolver';

// ─── Rule context ─────────────────────────────────────────────────────────────

/**
 * Evaluation context. Callers set only the fields relevant to their check.
 * asOfDate is always required — never defaulted to today, for determinism.
 */
export interface RuleContext {
  /** ISO YYYY-MM-DD reference date for config resolution. Required. */
  readonly asOfDate:        string;
  /** Numeric amount (VND) for threshold and authority checks. */
  readonly amount?:         number;
  /** Actor role string matched against AUTHORITY_MATRIX metadata.role. */
  readonly actorRole?:      string;
  /** Workflow id matched against WORKFLOW_DEFINITION metadata.workflowId. */
  readonly workflowId?:     string;
  /** Funding source code matched against FUNDING_SOURCE metadata.code. */
  readonly fundingCode?:    string;
  /** ConfigType for evaluateRule(). Required by evaluateRule; ignored by named evaluators. */
  readonly configType?:     ConfigType;
  /** Passed to resolver as minConfidence. Default: 0. */
  readonly minConfidence?:  number;
}

// ─── Rule result ──────────────────────────────────────────────────────────────

export type RuleVerdict =
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRES_REVIEW'
  | 'INSUFFICIENT_DATA';

export interface RuleResult {
  readonly verdict:         RuleVerdict;
  readonly reason:          string;
  /** The highest-priority config that determined the verdict. Absent on INSUFFICIENT_DATA. */
  readonly appliedConfig?:  GovernanceConfig;
  /** Total number of applicable configs evaluated (0 on INSUFFICIENT_DATA). */
  readonly checkedConfigs:  number;
}

// ─── Extension interfaces (Phase 11.7+) ──────────────────────────────────────

/** Future — Workflow Engine: called after each rule evaluation to trigger flows. */
export interface WorkflowEngineHook {
  onRuleEvaluated(result: RuleResult, context: RuleContext): void;
}

/** Future — Authority Engine: determines whether escalation is needed. */
export interface AuthorityEngineHook {
  requiresEscalation(result: RuleResult): boolean;
}

/** Future — Document Generator: determines whether a document must be produced. */
export interface DocumentGeneratorHook {
  requiresDocument(result: RuleResult): boolean;
}

/** Future — Executive Copilot: board-level summary of rule evaluation. */
export interface ExecutiveCopilotHook {
  summarize(result: RuleResult): string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toResolverOpts(ctx: RuleContext): ResolverOptions {
  return { asOfDate: ctx.asOfDate, minConfidence: ctx.minConfidence };
}

function parseMax(config: GovernanceConfig, key: string): number {
  const v = config.metadata[key];
  return v !== undefined ? parseFloat(v) : Infinity;
}

function approved(
  reason: string,
  config: GovernanceConfig,
  checked: number,
): RuleResult {
  return { verdict: 'APPROVED', reason, appliedConfig: config, checkedConfigs: checked };
}

function rejected(
  reason: string,
  config: GovernanceConfig | undefined,
  checked: number,
): RuleResult {
  return { verdict: 'REJECTED', reason, appliedConfig: config, checkedConfigs: checked };
}

function requiresReview(
  reason: string,
  config: GovernanceConfig | undefined,
  checked: number,
): RuleResult {
  return { verdict: 'REQUIRES_REVIEW', reason, appliedConfig: config, checkedConfigs: checked };
}

function insufficientData(reason: string): RuleResult {
  return { verdict: 'INSUFFICIENT_DATA', reason, checkedConfigs: 0 };
}

function noConfig(type: ConfigType, date: string): RuleResult {
  return insufficientData(`No active ${type} config on ${date}.`);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GovernanceRuleEngine {
  constructor(private readonly resolver: ConfigResolver) {}

  /**
   * Generic rule evaluation by ConfigType.
   * context.configType must be provided; returns INSUFFICIENT_DATA otherwise.
   *
   * Verdict logic (applied to the highest-priority config):
   *   metadata.requiresReview === 'true'                → REQUIRES_REVIEW
   *   context.amount > config.metadata.maxAmount        → REJECTED
   *   otherwise                                          → APPROVED
   */
  evaluateRule(context: RuleContext): RuleResult {
    const type = context.configType;
    if (!type) return insufficientData('No configType specified in context.');

    const configs = this.resolver.resolveConfiguration(type, toResolverOpts(context));
    if (configs.length === 0) return noConfig(type, context.asOfDate);

    const top = configs[0]!;

    if (top.metadata['requiresReview'] === 'true') {
      return requiresReview(
        `Config "${top.id}" requires review.`,
        top, configs.length,
      );
    }

    if (context.amount !== undefined) {
      const max = parseMax(top, 'maxAmount');
      if (context.amount > max) {
        return rejected(
          `Amount ${context.amount} exceeds limit ${max} in "${top.id}".`,
          top, configs.length,
        );
      }
    }

    return approved(`Rule satisfied by "${top.id}".`, top, configs.length);
  }

  /**
   * Checks AUTHORITY_MATRIX configs.
   *
   * Filters by context.actorRole (metadata.role) when provided.
   * REJECTED when:
   *   - actorRole specified but no matching config exists
   *   - amount > config.metadata.maxAmount
   */
  evaluateAuthority(context: RuleContext): RuleResult {
    const configs = this.resolver.resolveAuthority(toResolverOpts(context));
    if (configs.length === 0) return noConfig('AUTHORITY_MATRIX', context.asOfDate);

    const candidates = context.actorRole
      ? configs.filter(c => !c.metadata['role'] || c.metadata['role'] === context.actorRole)
      : configs;

    if (candidates.length === 0) {
      return rejected(
        `No authority config for role "${context.actorRole}".`,
        undefined, configs.length,
      );
    }

    const top = candidates[0]!;

    if (context.amount !== undefined) {
      const max = parseMax(top, 'maxAmount');
      if (context.amount > max) {
        return rejected(
          `Amount ${context.amount} exceeds authority limit ${max} for role "${context.actorRole ?? 'any'}" in "${top.id}".`,
          top, configs.length,
        );
      }
    }

    return approved(`Authority granted by "${top.id}".`, top, configs.length);
  }

  /**
   * Checks PROCUREMENT_THRESHOLD configs.
   *
   * REQUIRES_REVIEW (not REJECTED) when amount exceeds the threshold —
   * the procurement process must escalate, not stop.
   */
  evaluateThreshold(context: RuleContext): RuleResult {
    const configs = this.resolver.resolveThreshold(toResolverOpts(context));
    if (configs.length === 0) return noConfig('PROCUREMENT_THRESHOLD', context.asOfDate);

    const top = configs[0]!;

    if (context.amount !== undefined) {
      const max = parseMax(top, 'maxAmount');
      if (context.amount > max) {
        return requiresReview(
          `Amount ${context.amount} exceeds threshold ${max} in "${top.id}" — escalated process required.`,
          top, configs.length,
        );
      }
    }

    return approved(`Amount within threshold per "${top.id}".`, top, configs.length);
  }

  /**
   * Checks WORKFLOW_DEFINITION configs.
   *
   * When context.workflowId is provided, only that workflow is checked.
   * Returns INSUFFICIENT_DATA when the workflow is not in any active config.
   */
  evaluateWorkflow(context: RuleContext): RuleResult {
    const configs = this.resolver.resolveWorkflow(toResolverOpts(context));
    if (configs.length === 0) return noConfig('WORKFLOW_DEFINITION', context.asOfDate);

    if (context.workflowId) {
      const match = configs.find(c => c.metadata['workflowId'] === context.workflowId);
      if (!match) {
        return insufficientData(
          `Workflow "${context.workflowId}" not found in active configs.`,
        );
      }
      return approved(
        `Workflow "${context.workflowId}" active per "${match.id}".`,
        match, configs.length,
      );
    }

    return approved(
      `Workflow config "${configs[0]!.id}" is active.`,
      configs[0]!, configs.length,
    );
  }

  /**
   * Checks FUNDING_SOURCE configs.
   *
   * When context.fundingCode is provided, only that funding source is checked.
   * REQUIRES_REVIEW when context.amount > config.metadata.maxBudget.
   */
  evaluateFunding(context: RuleContext): RuleResult {
    const configs = this.resolver.resolveConfiguration('FUNDING_SOURCE', toResolverOpts(context));
    if (configs.length === 0) return noConfig('FUNDING_SOURCE', context.asOfDate);

    if (context.fundingCode) {
      const matching = configs.filter(c => c.metadata['code'] === context.fundingCode);
      if (matching.length === 0) {
        return insufficientData(
          `Funding source "${context.fundingCode}" not active on ${context.asOfDate}.`,
        );
      }
      const top = matching[0]!;
      if (context.amount !== undefined) {
        const max = parseMax(top, 'maxBudget');
        if (context.amount > max) {
          return requiresReview(
            `Amount ${context.amount} exceeds funding limit ${max} in "${top.id}".`,
            top, configs.length,
          );
        }
      }
      return approved(
        `Funding source "${context.fundingCode}" available per "${top.id}".`,
        top, configs.length,
      );
    }

    return approved(
      `Funding config "${configs[0]!.id}" is active.`,
      configs[0]!, configs.length,
    );
  }

  /**
   * Checks AUDIT_RULE and RISK_RULE configs.
   *
   * REQUIRES_REVIEW when any RISK_RULE config has metadata.requiresReview === 'true'.
   * INSUFFICIENT_DATA when neither AUDIT_RULE nor RISK_RULE configs are found.
   */
  evaluateCompliance(context: RuleContext): RuleResult {
    const opts         = toResolverOpts(context);
    const auditConfigs = this.resolver.resolveAuditRule(opts);
    const riskConfigs  = this.resolver.resolveConfiguration('RISK_RULE', opts);
    const totalChecked = auditConfigs.length + riskConfigs.length;

    if (totalChecked === 0) {
      return insufficientData(`No active compliance configs on ${context.asOfDate}.`);
    }

    const triggered = riskConfigs.find(c => c.metadata['requiresReview'] === 'true');
    if (triggered) {
      return requiresReview(
        `Risk rule "${triggered.id}" triggered.`,
        triggered, totalChecked,
      );
    }

    const top = auditConfigs[0] ?? riskConfigs[0]!;
    return approved(`Compliance check passed per "${top.id}".`, top, totalChecked);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildGovernanceRuleEngine(resolver: ConfigResolver): GovernanceRuleEngine {
  return new GovernanceRuleEngine(resolver);
}
