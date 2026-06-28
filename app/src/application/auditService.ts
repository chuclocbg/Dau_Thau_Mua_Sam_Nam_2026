/**
 * Phase 13 — AuditService
 *
 * Application service for compliance review and configuration validation.
 * Coordinates GovernanceRuleEngine (compliance evaluation) and ConfigResolver
 * (audit rule retrieval).  Exposes validateConfiguration for ad-hoc validation
 * of config sets.  Contains zero business rules.
 *
 * Public APIs:
 *   reviewCompliance(ctx)                          → GovernanceResult<RuleResult>
 *   getAuditRules(ctx)                             → GovernanceResult<readonly GovernanceConfig[]>
 *   validateConfiguration(configs, ctx)             → GovernanceResult<ConfigValidationReport>
 *   buildAuditService(ruleEngine, resolver)         → AuditService
 */

import type { GovernanceRuleEngine, RuleResult } from '../legal/governanceRuleEngine';
import type { ConfigResolver }                   from '../legal/configResolver';
import type { GovernanceConfig }                 from '../legal/governanceConfig';
import { validateConfigs, type ConfigValidationReport } from '../legal/configValidator';
import type { GovernanceContext, GovernanceResult } from './governanceContext';
import { createResult, createAuditEntry, toRuleContext } from './governanceContext';

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuditService {
  constructor(
    private readonly ruleEngine: GovernanceRuleEngine,
    private readonly resolver:   ConfigResolver,
  ) {}

  /**
   * Evaluates combined compliance rules (AUDIT_RULE + RISK_RULE) for the
   * actor and context described in ctx.  REQUIRES_REVIEW if a risk rule
   * triggers manual review; FAILED if no applicable audit config exists;
   * SUCCESS otherwise.
   */
  reviewCompliance(ctx: GovernanceContext): GovernanceResult<RuleResult> {
    const audit    = [createAuditEntry('reviewCompliance', ctx.actor, ctx.currentDate)];
    const result   = this.ruleEngine.evaluateCompliance(toRuleContext(ctx));

    const status = result.verdict === 'REQUIRES_REVIEW' ? 'REQUIRES_REVIEW'
      : result.verdict === 'REJECTED'          ? 'FAILED'
      : result.verdict === 'INSUFFICIENT_DATA' ? 'FAILED'
      : 'SUCCESS';

    const warnings = result.verdict === 'REQUIRES_REVIEW'
      ? [`Compliance requires manual review: ${result.reason}`] : [];
    const errors = (result.verdict === 'REJECTED' || result.verdict === 'INSUFFICIENT_DATA')
      ? [result.reason] : [];

    return createResult(status, {
      data:            result,
      messages:        [result.reason],
      warnings,
      errors,
      auditTrail:      audit,
      legalReferences: result.appliedConfig ? [result.appliedConfig.source] : [],
      confidence:      result.appliedConfig?.confidence ?? 0,
      metadata:        { checkedConfigs: String(result.checkedConfigs) },
    });
  }

  /**
   * Returns all active AUDIT_RULE configs for the reference date in ctx.
   */
  getAuditRules(ctx: GovernanceContext): GovernanceResult<readonly GovernanceConfig[]> {
    const audit   = [createAuditEntry('getAuditRules', ctx.actor, ctx.currentDate)];
    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;
    const configs  = this.resolver.resolveAuditRule({ asOfDate });

    return createResult('SUCCESS', {
      data:            configs,
      messages:        [`${configs.length} active audit rule(s) on ${asOfDate}.`],
      auditTrail:      audit,
      legalReferences: configs.map(c => c.source),
      confidence:      configs.length > 0
        ? configs.reduce((s, c) => s + c.confidence, 0) / configs.length
        : 1.0,
      metadata:        { asOfDate, count: String(configs.length) },
    });
  }

  /**
   * Validates a set of GovernanceConfig objects.
   * Validation errors map to FAILED; warnings are forwarded but status remains
   * SUCCESS when there are no hard errors.
   */
  validateConfiguration(
    configs: readonly GovernanceConfig[],
    ctx:     GovernanceContext,
  ): GovernanceResult<ConfigValidationReport> {
    const audit  = [createAuditEntry('validateConfiguration', ctx.actor, `${configs.length} configs`)];
    const report = validateConfigs(configs);

    const status = report.ok ? 'SUCCESS' : 'FAILED';

    return createResult(status, {
      data:      report,
      messages:  [`Validated ${report.stats.total} config(s).`],
      warnings:  report.warnings.map(w => w.message),
      errors:    report.errors.map(e => e.message),
      auditTrail: audit,
      metadata:  {
        total:  String(report.stats.total),
        active: String(report.stats.active),
      },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildAuditService(
  ruleEngine: GovernanceRuleEngine,
  resolver:   ConfigResolver,
): AuditService {
  return new AuditService(ruleEngine, resolver);
}
