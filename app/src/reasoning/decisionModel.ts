/**
 * Phase 15 — Governance Reasoning Engine: Decision Model
 *
 * Types and pure factory functions for the GovernanceDecision output.
 * All factories return frozen objects / arrays — no mutation after creation.
 *
 * Exports:
 *   DecisionVerdict    — PROCEED | ESCALATE | BLOCK | INSUFFICIENT_DATA
 *   RiskLevel          — CRITICAL | HIGH | MEDIUM | LOW | NONE
 *   WarningSeverity    — CRITICAL | HIGH | MEDIUM | LOW
 *   DECISION_VERDICTS  — runtime constant (all four values)
 *   GovernanceDecision — primary output type
 *   DecisionSummary    — summary sub-type
 *   AuthorityLevel     — ordered authority sub-type
 *   ComplianceWarning  — compliance warning sub-type
 *   RiskFactor         — risk factor sub-type
 *   RiskAssessment     — risk assessment sub-type
 *   ReasoningStep      — single trace entry
 *   createComplianceWarning()
 *   createRiskAssessment()
 *   computeConfidence()
 *   deriveVerdict()
 *   createDecision()
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceConfig }  from '../legal/governanceConfig';
import type { LegalDocument }     from '../legal/legalRegistry';
import type { GovernanceContext } from '../application/governanceContext';
import type { RuleVerdict }       from '../legal/governanceRuleEngine';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type DecisionVerdict = 'PROCEED' | 'ESCALATE' | 'BLOCK' | 'INSUFFICIENT_DATA';
export type RiskLevel       = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type WarningSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const DECISION_VERDICTS: readonly DecisionVerdict[] =
  Object.freeze(['PROCEED', 'ESCALATE', 'BLOCK', 'INSUFFICIENT_DATA'] as const);

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface DecisionSummary {
  readonly verdict:                DecisionVerdict;
  readonly reason:                 string;
  readonly applicableLawCount:     number;
  readonly complianceWarningCount: number;
  readonly riskLevel:              RiskLevel;
  readonly requiredActionCount:    number;
}

export interface AuthorityLevel {
  readonly role:       string;
  readonly maxAmount?: number;
  readonly config:     GovernanceConfig;
}

export interface ComplianceWarning {
  readonly code:          string;
  readonly message:       string;
  readonly severity:      WarningSeverity;
  readonly sourceConfig?: GovernanceConfig;
}

export interface RiskFactor {
  readonly code:   string;
  readonly reason: string;
  /** Contribution weight 0.0–1.0 */
  readonly weight: number;
}

export interface RiskAssessment {
  readonly level:       RiskLevel;
  readonly score:       number;
  readonly factors:     readonly RiskFactor[];
  readonly mitigations: readonly string[];
}

export interface ReasoningStep {
  readonly step:      number;
  readonly operation: string;
  readonly input:     string;
  readonly output:    string;
}

// ─── Primary decision type ────────────────────────────────────────────────────

export interface GovernanceDecision {
  readonly context:              GovernanceContext;
  readonly summary:              DecisionSummary;
  readonly applicableLaws:       readonly LegalDocument[];
  readonly applicableThresholds: readonly GovernanceConfig[];
  readonly applicableWorkflows:  readonly GovernanceConfig[];
  readonly authorityChain:       readonly AuthorityLevel[];
  readonly requiredDocuments:    readonly string[];
  readonly complianceWarnings:   readonly ComplianceWarning[];
  readonly riskAssessment:       RiskAssessment;
  readonly confidence:           number;
  readonly reasoningTrace:       readonly ReasoningStep[];
  readonly decidedAt:            string;
}

// ─── Factories ────────────────────────────────────────────────────────────────

export function createComplianceWarning(
  code:          string,
  message:       string,
  severity:      WarningSeverity,
  sourceConfig?: GovernanceConfig,
): ComplianceWarning {
  return { code, message, severity, sourceConfig };
}

export function createRiskAssessment(
  factors:     readonly RiskFactor[],
  mitigations: readonly string[] = [],
): RiskAssessment {
  if (factors.length === 0) {
    return { level: 'NONE', score: 0, factors: Object.freeze([]), mitigations: Object.freeze([...mitigations]) };
  }
  const score = factors.reduce((s, f) => s + f.weight, 0) / factors.length;
  const level: RiskLevel =
    score >= 0.8 ? 'CRITICAL'
    : score >= 0.6 ? 'HIGH'
    : score >= 0.4 ? 'MEDIUM'
    : 'LOW';
  return { level, score, factors: Object.freeze([...factors]), mitigations: Object.freeze([...mitigations]) };
}

export function computeConfidence(
  laws:    readonly LegalDocument[],
  configs: readonly GovernanceConfig[],
): number {
  const all = [...laws.map(l => l.confidence), ...configs.map(c => c.confidence)];
  if (all.length === 0) return 1.0;
  return all.reduce((s, c) => s + c, 0) / all.length;
}

export function deriveVerdict(
  laws:         readonly LegalDocument[],
  configs:      readonly GovernanceConfig[],
  warnings:     readonly ComplianceWarning[],
  risk:         RiskAssessment,
  ruleVerdict?: RuleVerdict,
): DecisionVerdict {
  if (laws.length === 0 && configs.length === 0) return 'INSUFFICIENT_DATA';
  if (warnings.some(w => w.severity === 'CRITICAL') || risk.level === 'CRITICAL') return 'BLOCK';
  if (warnings.some(w => w.severity === 'HIGH')     || risk.level === 'HIGH')     return 'ESCALATE';
  if (ruleVerdict === 'REQUIRES_REVIEW') return 'ESCALATE';
  return 'PROCEED';
}

// ─── createDecision params type ───────────────────────────────────────────────

interface CreateDecisionParams {
  readonly context:              GovernanceContext;
  readonly applicableLaws:       readonly LegalDocument[];
  readonly applicableThresholds: readonly GovernanceConfig[];
  readonly applicableWorkflows:  readonly GovernanceConfig[];
  readonly authorityChain:       readonly AuthorityLevel[];
  readonly requiredDocuments:    readonly string[];
  readonly complianceWarnings:   readonly ComplianceWarning[];
  readonly riskAssessment:       RiskAssessment;
  readonly reasoningTrace:       readonly ReasoningStep[];
  readonly ruleVerdict?:         RuleVerdict;
}

function buildReason(
  verdict:  DecisionVerdict,
  warnings: readonly ComplianceWarning[],
  risk:     RiskAssessment,
): string {
  if (verdict === 'PROCEED')           return 'All governance checks passed.';
  if (verdict === 'INSUFFICIENT_DATA') return 'Insufficient governance configuration for this date.';
  const critical = warnings.find(w => w.severity === 'CRITICAL');
  if (critical) return critical.message;
  const high = warnings.find(w => w.severity === 'HIGH');
  if (high)    return high.message;
  return risk.factors[0]?.reason ?? 'Escalation required by governance rules.';
}

export function createDecision(params: CreateDecisionParams): GovernanceDecision {
  const allConfigs: GovernanceConfig[] = [
    ...params.applicableThresholds,
    ...params.applicableWorkflows,
    ...params.authorityChain.map(a => a.config),
  ];

  const confidence = computeConfidence(params.applicableLaws, allConfigs);
  const verdict    = deriveVerdict(
    params.applicableLaws, allConfigs,
    params.complianceWarnings, params.riskAssessment, params.ruleVerdict,
  );

  const summary: DecisionSummary = {
    verdict,
    reason:                buildReason(verdict, params.complianceWarnings, params.riskAssessment),
    applicableLawCount:    params.applicableLaws.length,
    complianceWarningCount: params.complianceWarnings.length,
    riskLevel:             params.riskAssessment.level,
    requiredActionCount:   params.complianceWarnings.filter(w => w.severity !== 'LOW').length,
  };

  return {
    context:              params.context,
    summary,
    applicableLaws:       Object.freeze([...params.applicableLaws]),
    applicableThresholds: Object.freeze([...params.applicableThresholds]),
    applicableWorkflows:  Object.freeze([...params.applicableWorkflows]),
    authorityChain:       Object.freeze([...params.authorityChain]),
    requiredDocuments:    Object.freeze([...params.requiredDocuments]),
    complianceWarnings:   Object.freeze([...params.complianceWarnings]),
    riskAssessment:       params.riskAssessment,
    confidence,
    reasoningTrace:       Object.freeze([...params.reasoningTrace]),
    decidedAt:            new Date().toISOString(),
  };
}
