/**
 * Phase 15 — Governance Reasoning Engine
 *
 * Deterministic reasoning pipeline that synthesises a GovernanceDecision
 * from a GovernanceContext by querying multiple kernel modules.
 *
 * No document generation. No UI. No HTTP. Pure TypeScript.
 *
 * Public APIs:
 *   resolveApplicableLaw(ctx)    → active laws effective on ctx date
 *   resolveWorkflow(ctx)         → applicable WORKFLOW_DEFINITION configs
 *   resolveAuthority(ctx)        → ordered authority chain (AUTHORITY_MATRIX)
 *   resolveRequiredDocuments(ctx)→ required document template codes
 *   resolveCompliance(ctx)       → compliance warnings from AUDIT_RULE + RISK_RULE
 *   resolveRisk(ctx)             → risk assessment from RISK_RULE + threshold check
 *   resolveDecision(ctx)         → DecisionSummary (verdict + summary fields)
 *   generateDecision(ctx)        → full GovernanceDecision with trace
 *   buildGovernanceReasoningEngine(...) — factory
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { RegistryQueryEngine }   from '../legal/registryQueryEngine';
import type { GovernanceImpactEngine }from '../legal/governanceImpactEngine';
import type { ConfigResolver }        from '../legal/configResolver';
import type { GovernanceRuleEngine }  from '../legal/governanceRuleEngine';
import type { LegalDocument }         from '../legal/legalRegistry';
import type { GovernanceConfig }      from '../legal/governanceConfig';
import { toRuleContext }              from '../application/governanceContext';
import type { GovernanceContext }     from '../application/governanceContext';
import {
  createComplianceWarning,
  createRiskAssessment,
  createDecision,
  type AuthorityLevel,
  type ComplianceWarning,
  type RiskAssessment,
  type RiskFactor,
  type GovernanceDecision,
  type DecisionSummary,
  type ReasoningStep,
} from './decisionModel';

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GovernanceReasoningEngine {
  constructor(
    private readonly queryEngine:  RegistryQueryEngine,
    // ponytail: impactEngine reserved for graph-based risk scoring (Phase 16+)
    private readonly impactEngine: GovernanceImpactEngine,
    private readonly resolver:     ConfigResolver,
    private readonly ruleEngine:   GovernanceRuleEngine,
  ) {}

  resolveApplicableLaw(ctx: GovernanceContext): readonly LegalDocument[] {
    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;
    const activeIds = new Set(this.queryEngine.findActive().map(d => d.id));
    return Object.freeze(this.queryEngine.findEffectiveOn(asOfDate).filter(d => activeIds.has(d.id)));
  }

  resolveWorkflow(ctx: GovernanceContext): readonly GovernanceConfig[] {
    return this.resolver.resolveWorkflow({ asOfDate: ctx.effectiveDate ?? ctx.currentDate });
  }

  resolveAuthority(ctx: GovernanceContext): readonly AuthorityLevel[] {
    const configs = this.resolver.resolveAuthority({ asOfDate: ctx.effectiveDate ?? ctx.currentDate });
    const levels: AuthorityLevel[] = configs.map(c => ({
      role:      (c.metadata['role'] as string | undefined) ?? 'UNKNOWN',
      maxAmount: c.metadata['maxAmount'] !== undefined
                 ? parseFloat(c.metadata['maxAmount'] as string)
                 : undefined,
      config:    c,
    }));
    levels.sort((a, b) => (a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity));
    return Object.freeze(levels);
  }

  resolveRequiredDocuments(ctx: GovernanceContext): readonly string[] {
    const templates = this.resolver.resolveTemplate({ asOfDate: ctx.effectiveDate ?? ctx.currentDate });
    return Object.freeze(templates.map(t => (t.metadata['templateCode'] as string | undefined) ?? t.id));
  }

  resolveCompliance(ctx: GovernanceContext): readonly ComplianceWarning[] {
    const result   = this.ruleEngine.evaluateCompliance(toRuleContext(ctx));
    const warnings: ComplianceWarning[] = [];
    if (result.verdict === 'REQUIRES_REVIEW') {
      warnings.push(createComplianceWarning('COMPLIANCE_REVIEW_REQUIRED', result.reason, 'HIGH', result.appliedConfig));
    } else if (result.verdict === 'REJECTED') {
      warnings.push(createComplianceWarning('COMPLIANCE_REJECTED', result.reason, 'CRITICAL', result.appliedConfig));
    }
    return Object.freeze(warnings);
  }

  resolveRisk(ctx: GovernanceContext): RiskAssessment {
    const asOfDate   = ctx.effectiveDate ?? ctx.currentDate;
    const factors: RiskFactor[] = [];

    for (const rc of this.resolver.resolveConfiguration('RISK_RULE', { asOfDate })) {
      if (rc.metadata['requiresReview'] === 'true') {
        factors.push({ code: `RISK_${rc.id}`, reason: `Risk rule "${rc.id}" requires review.`, weight: 0.7 });
      }
    }

    const thresh = this.ruleEngine.evaluateThreshold(toRuleContext(ctx));
    if (thresh.verdict === 'REQUIRES_REVIEW') {
      factors.push({ code: 'THRESHOLD_EXCEEDED', reason: thresh.reason, weight: 0.5 });
    }

    return createRiskAssessment(factors);
  }

  resolveDecision(ctx: GovernanceContext): DecisionSummary {
    return this.generateDecision(ctx).summary;
  }

  generateDecision(ctx: GovernanceContext): GovernanceDecision {
    const trace: ReasoningStep[] = [];
    let   step  = 0;

    const track = <T>(op: string, input: string, fn: () => T): T => {
      const r   = fn();
      const out = Array.isArray(r)
        ? `${(r as unknown[]).length} item(s)`
        : typeof r === 'object' && r !== null && 'level' in r
          ? `level=${String((r as { level: string }).level)}`
          : String(r);
      trace.push({ step: ++step, operation: op, input, output: out });
      return r;
    };

    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;

    const laws      = track('resolveApplicableLaw',      `date=${asOfDate}`, () => this.resolveApplicableLaw(ctx));
    const threshs   = track('resolveThreshold',          `date=${asOfDate}`, () => this.resolver.resolveThreshold({ asOfDate }));
    const workflows = track('resolveWorkflow',           `date=${asOfDate}`, () => this.resolveWorkflow(ctx));
    const authority = track('resolveAuthority',          `date=${asOfDate},role=${ctx.actor.role}`, () => this.resolveAuthority(ctx));
    const docs      = track('resolveRequiredDocuments',  `date=${asOfDate}`, () => this.resolveRequiredDocuments(ctx));
    const warnings  = track('resolveCompliance',         `date=${asOfDate}`, () => this.resolveCompliance(ctx));
    const risk      = track('resolveRisk',               `date=${asOfDate}`, () => this.resolveRisk(ctx));

    const ruleResult = this.ruleEngine.evaluateCompliance(toRuleContext(ctx));

    return createDecision({
      context: ctx,
      applicableLaws:       laws,
      applicableThresholds: threshs,
      applicableWorkflows:  workflows,
      authorityChain:       authority,
      requiredDocuments:    docs,
      complianceWarnings:   warnings,
      riskAssessment:       risk,
      reasoningTrace:       trace,
      ruleVerdict:          ruleResult.verdict,
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildGovernanceReasoningEngine(
  queryEngine:  RegistryQueryEngine,
  impactEngine: GovernanceImpactEngine,
  resolver:     ConfigResolver,
  ruleEngine:   GovernanceRuleEngine,
): GovernanceReasoningEngine {
  return new GovernanceReasoningEngine(queryEngine, impactEngine, resolver, ruleEngine);
}
