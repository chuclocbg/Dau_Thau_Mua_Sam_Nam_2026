/**
 * Phase 17 — Procurement Capability: Decision Types
 *
 * Output model for the Procurement Capability.
 * ProcurementDecision assembles every governance signal for a single
 * procurement request into one structured object.
 *
 * Exports:
 *   RecommendationAction     — PROCEED | ESCALATE | BLOCK | INSUFFICIENT_DATA
 *   FinalRecommendation      — action + rationale + next steps + required approvals
 *   ProcurementDecision      — complete procurement governance output
 *   createFinalRecommendation()
 *   deriveFinalRecommendation()  — derive recommendation from GovernanceDecision
 *   createProcurementDecision()
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceContext }  from '../application/governanceContext';
import type { LegalDocument }      from '../legal/legalRegistry';
import type { GovernanceConfig }   from '../legal/governanceConfig';
import type {
  AuthorityLevel,
  ComplianceWarning,
  RiskAssessment,
  GovernanceDecision,
} from '../reasoning/decisionModel';
import type { ResolvedTemplate }   from '../knowledge/knowledgeBase';
import type { GovernanceChecklist }from '../knowledge/knowledgeTypes';

// ─── FinalRecommendation ──────────────────────────────────────────────────────

export type RecommendationAction = 'PROCEED' | 'ESCALATE' | 'BLOCK' | 'INSUFFICIENT_DATA';

export interface FinalRecommendation {
  readonly action:             RecommendationAction;
  readonly rationale:          string;
  readonly nextSteps:          readonly string[];
  readonly requiredApprovals:  readonly string[];   // authority roles that must sign off
}

export function createFinalRecommendation(params: {
  readonly action:            RecommendationAction;
  readonly rationale:         string;
  readonly nextSteps?:        readonly string[];
  readonly requiredApprovals?: readonly string[];
}): FinalRecommendation {
  return {
    action:            params.action,
    rationale:         params.rationale,
    nextSteps:         Object.freeze([...(params.nextSteps        ?? [])]),
    requiredApprovals: Object.freeze([...(params.requiredApprovals ?? [])]),
  };
}

function buildNextSteps(action: RecommendationAction, docCount: number): readonly string[] {
  switch (action) {
    case 'PROCEED':
      return Object.freeze([
        'Initiate procurement workflow.',
        `Submit ${docCount} required document(s).`,
        'Complete pre-procurement checklist.',
      ]);
    case 'ESCALATE':
      return Object.freeze([
        'Escalate to higher authority for approval.',
        'Address compliance warnings before proceeding.',
        'Document escalation rationale.',
      ]);
    case 'BLOCK':
      return Object.freeze([
        'Resolve critical compliance issues before proceeding.',
        'Consult legal department.',
        'Do not initiate procurement workflow.',
      ]);
    case 'INSUFFICIENT_DATA':
      return Object.freeze([
        'Provide complete procurement context (packageValue, fundingSource, etc.).',
        'Ensure governance configuration is active for the effective date.',
      ]);
  }
}

/**
 * Derives the FinalRecommendation from a completed GovernanceDecision.
 * Selects the minimum authority whose maxAmount covers the package value.
 */
export function deriveFinalRecommendation(
  decision:       GovernanceDecision,
  authorityChain: readonly AuthorityLevel[],
): FinalRecommendation {
  const action   = decision.summary.verdict as RecommendationAction;
  const amount   = decision.context.packageValue;
  const approver = amount !== undefined
    ? authorityChain.find(a => a.maxAmount === undefined || a.maxAmount >= amount)
    : authorityChain[0];

  return createFinalRecommendation({
    action,
    rationale:         decision.summary.reason,
    nextSteps:         buildNextSteps(action, decision.requiredDocuments.length),
    requiredApprovals: approver ? [approver.role] : [],
  });
}

// ─── ProcurementDecision ──────────────────────────────────────────────────────

export interface ProcurementDecision {
  readonly context:              GovernanceContext;
  readonly applicableLaw:        readonly LegalDocument[];
  readonly applicableThreshold:  readonly GovernanceConfig[];
  readonly requiredWorkflow:     readonly GovernanceConfig[];
  readonly approvalAuthority:    readonly AuthorityLevel[];
  readonly requiredDocuments:    readonly string[];            // template codes
  readonly requiredTemplates:    readonly ResolvedTemplate[];  // hydrated templates
  readonly requiredChecklists:   readonly GovernanceChecklist[];
  readonly complianceWarnings:   readonly ComplianceWarning[];
  readonly riskAssessment:       RiskAssessment;
  readonly finalRecommendation:  FinalRecommendation;
  readonly governanceDecision:   GovernanceDecision;
  readonly decidedAt:            string;
}

interface CreateProcurementDecisionParams {
  readonly context:             GovernanceContext;
  readonly applicableLaw:       readonly LegalDocument[];
  readonly applicableThreshold: readonly GovernanceConfig[];
  readonly requiredWorkflow:    readonly GovernanceConfig[];
  readonly approvalAuthority:   readonly AuthorityLevel[];
  readonly requiredDocuments:   readonly string[];
  readonly requiredTemplates:   readonly ResolvedTemplate[];
  readonly requiredChecklists:  readonly GovernanceChecklist[];
  readonly complianceWarnings:  readonly ComplianceWarning[];
  readonly riskAssessment:      RiskAssessment;
  readonly finalRecommendation: FinalRecommendation;
  readonly governanceDecision:  GovernanceDecision;
}

export function createProcurementDecision(
  params: CreateProcurementDecisionParams,
): ProcurementDecision {
  return {
    context:             params.context,
    applicableLaw:       Object.freeze([...params.applicableLaw]),
    applicableThreshold: Object.freeze([...params.applicableThreshold]),
    requiredWorkflow:    Object.freeze([...params.requiredWorkflow]),
    approvalAuthority:   Object.freeze([...params.approvalAuthority]),
    requiredDocuments:   Object.freeze([...params.requiredDocuments]),
    requiredTemplates:   Object.freeze([...params.requiredTemplates]),
    requiredChecklists:  Object.freeze([...params.requiredChecklists]),
    complianceWarnings:  Object.freeze([...params.complianceWarnings]),
    riskAssessment:      params.riskAssessment,
    finalRecommendation: params.finalRecommendation,
    governanceDecision:  params.governanceDecision,
    decidedAt:           new Date().toISOString(),
  };
}
