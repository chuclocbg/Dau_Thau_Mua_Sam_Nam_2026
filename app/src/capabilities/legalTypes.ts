/**
 * Phase 20 — Legal Advisory Capability: Types and Pure Functions
 *
 * GovernanceExplanation is the central advisory output used by every
 * other capability, the REST API, the MCP server, the document generator,
 * and the executive copilot.  It contains all information needed to
 * explain a governance decision in human-readable terms.
 *
 * Exports:
 *   ExplanationAction           — PROCEED | ESCALATE | BLOCK | SEEK_ADVICE | INSUFFICIENT_DATA
 *   ExplanationUrgency          — IMMEDIATE | STANDARD | LOW
 *   ExplanationDecision         — verdict + summary + authority + legal basis
 *   ExplanationEvidence         — single supporting evidence item
 *   ExplanationRecommendation   — action + rationale + urgency
 *   GovernanceExplanation       — the full advisory output
 *   createExplanationDecision()
 *   createExplanationEvidence()
 *   createExplanationRecommendation()
 *   createGovernanceExplanation()
 *   deriveExplanationAction()   — pure: verdict × warnings → ExplanationAction
 *   deriveExplanationUrgency()  — pure: action → urgency
 *   buildNextActions()          — pure: action × warningCount → string[]
 *   buildEvidence()             — pure: GovernanceDecision → ExplanationEvidence[]
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceCase }    from '../cases/caseModel';
import type { LegalCitation }     from '../knowledge/knowledgeTypes';
import type {
  GovernanceDecision,
  DecisionVerdict,
  ComplianceWarning,
  RiskAssessment,
  ReasoningStep,
  AuthorityLevel,
  WarningSeverity,
} from '../reasoning/decisionModel';

// ─── Enumerations ─────────────────────────────────────────────────────────────

/** The recommendation action of a GovernanceExplanation. */
export type ExplanationAction =
  | 'PROCEED'
  | 'ESCALATE'
  | 'BLOCK'
  | 'SEEK_ADVICE'        // PROCEED verdict but compliance warnings present
  | 'INSUFFICIENT_DATA';

/** Advisory urgency level. */
export type ExplanationUrgency = 'IMMEDIATE' | 'STANDARD' | 'LOW';

/** Category of evidence item. */
export type EvidenceType = 'LEGAL' | 'CONFIG' | 'RISK' | 'COMPLIANCE';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface ExplanationDecision {
  readonly verdict:   DecisionVerdict;
  readonly summary:   string;
  readonly authority: string;    // first approver role, or 'NOT_DETERMINED'
  readonly basis:     string;    // human-readable legal basis
}

export function createExplanationDecision(params: {
  readonly verdict:   DecisionVerdict;
  readonly summary:   string;
  readonly authority: string;
  readonly basis:     string;
}): ExplanationDecision {
  return { ...params };
}

export interface ExplanationEvidence {
  readonly type:      EvidenceType;
  readonly reference: string;    // law symbol, config id, risk code, warning code
  readonly excerpt:   string;    // human-readable snippet
  readonly weight:    number;    // 0.0–1.0 evidential weight
}

export function createExplanationEvidence(params: {
  readonly type:      EvidenceType;
  readonly reference: string;
  readonly excerpt:   string;
  readonly weight:    number;
}): ExplanationEvidence {
  return { ...params };
}

export interface ExplanationRecommendation {
  readonly action:    ExplanationAction;
  readonly rationale: string;
  readonly urgency:   ExplanationUrgency;
}

export function createExplanationRecommendation(params: {
  readonly action:    ExplanationAction;
  readonly rationale: string;
  readonly urgency:   ExplanationUrgency;
}): ExplanationRecommendation {
  return { ...params };
}

// ─── GovernanceExplanation ────────────────────────────────────────────────────

/**
 * Central advisory output.
 * Reusable by: Procurement, Asset, HR, Audit, Executive Copilot,
 * REST API, MCP Server, Document Generator, Dashboard.
 */
export interface GovernanceExplanation {
  readonly governanceCase:     GovernanceCase;
  readonly governanceDecision: GovernanceDecision;
  readonly decision:           ExplanationDecision;
  readonly evidence:           readonly ExplanationEvidence[];
  readonly legalCitations:     readonly LegalCitation[];
  readonly reasoningTrace:     readonly ReasoningStep[];
  readonly confidence:         number;
  readonly riskAssessment:     RiskAssessment;
  readonly recommendation:     ExplanationRecommendation;
  readonly nextActions:        readonly string[];
  readonly generatedAt:        string;    // ISO-8601
}

export function createGovernanceExplanation(params: {
  readonly governanceCase:     GovernanceCase;
  readonly governanceDecision: GovernanceDecision;
  readonly decision:           ExplanationDecision;
  readonly evidence:           readonly ExplanationEvidence[];
  readonly legalCitations:     readonly LegalCitation[];
  readonly reasoningTrace:     readonly ReasoningStep[];
  readonly confidence:         number;
  readonly riskAssessment:     RiskAssessment;
  readonly recommendation:     ExplanationRecommendation;
  readonly nextActions:        readonly string[];
}): GovernanceExplanation {
  return {
    governanceCase:     params.governanceCase,
    governanceDecision: params.governanceDecision,
    decision:           params.decision,
    evidence:           Object.freeze([...params.evidence]),
    legalCitations:     Object.freeze([...params.legalCitations]),
    reasoningTrace:     Object.freeze([...params.reasoningTrace]),
    confidence:         params.confidence,
    riskAssessment:     params.riskAssessment,
    recommendation:     params.recommendation,
    nextActions:        Object.freeze([...params.nextActions]),
    generatedAt:        new Date().toISOString(),
  };
}

// ─── Pure derivation functions ────────────────────────────────────────────────

/**
 * Maps a GovernanceDecision to an ExplanationAction.
 * PROCEED with warnings → SEEK_ADVICE (consult legal before proceeding).
 * All other verdicts map directly.
 */
export function deriveExplanationAction(decision: GovernanceDecision): ExplanationAction {
  const { verdict } = decision.summary;
  if (verdict === 'PROCEED' && decision.complianceWarnings.length > 0) {
    return 'SEEK_ADVICE';
  }
  return verdict as ExplanationAction;
}

/** Maps an ExplanationAction to an urgency level. */
export function deriveExplanationUrgency(action: ExplanationAction): ExplanationUrgency {
  if (action === 'BLOCK')    return 'IMMEDIATE';
  if (action === 'ESCALATE') return 'STANDARD';
  if (action === 'PROCEED')  return 'STANDARD';
  if (action === 'SEEK_ADVICE') return 'STANDARD';
  return 'LOW'; // INSUFFICIENT_DATA
}

/** Builds context-appropriate next-action strings. */
export function buildNextActions(
  action:       ExplanationAction,
  warningCount: number,
): readonly string[] {
  switch (action) {
    case 'PROCEED':
      return Object.freeze([
        'Proceed with governance workflow.',
        'Archive legal explanation for audit.',
      ]);
    case 'SEEK_ADVICE':
      return Object.freeze([
        'Consult legal advisory before proceeding.',
        `Address ${warningCount} compliance warning(s).`,
        'Proceed after legal clearance.',
      ]);
    case 'ESCALATE':
      return Object.freeze([
        'Escalate to higher authority.',
        'Attach legal explanation to escalation package.',
      ]);
    case 'BLOCK':
      return Object.freeze([
        'Do not proceed.',
        'Resolve legal violations before resubmitting.',
      ]);
    default:
      return Object.freeze(['Provide complete legal context and resubmit.']);
  }
}

// ─── Evidence builder ─────────────────────────────────────────────────────────

function severityWeight(s: WarningSeverity): number {
  return s === 'CRITICAL' ? 1.0 : s === 'HIGH' ? 0.75 : s === 'MEDIUM' ? 0.5 : 0.25;
}

/**
 * Builds an evidence array from a GovernanceDecision.
 * Sources: applicable laws, compliance warnings, risk factors, threshold configs.
 */
export function buildEvidence(decision: GovernanceDecision): readonly ExplanationEvidence[] {
  const items: ExplanationEvidence[] = [];

  for (const law of decision.applicableLaws) {
    items.push({ type: 'LEGAL', reference: law.symbol, excerpt: law.summary, weight: law.confidence });
  }
  for (const w of decision.complianceWarnings) {
    items.push({ type: 'COMPLIANCE', reference: w.code, excerpt: w.message, weight: severityWeight(w.severity) });
  }
  for (const f of decision.riskAssessment.factors) {
    items.push({ type: 'RISK', reference: f.code, excerpt: f.reason, weight: f.weight });
  }
  for (const t of decision.applicableThresholds) {
    items.push({ type: 'CONFIG', reference: t.id, excerpt: t.type, weight: t.confidence });
  }

  return Object.freeze(items);
}

// ─── Explanation assembly helpers ─────────────────────────────────────────────

/** Builds the ExplanationDecision from the GovernanceDecision and authority chain. */
export function buildExplanationDecision(
  decision:  GovernanceDecision,
  authority: readonly AuthorityLevel[],
): ExplanationDecision {
  const approver = authority[0];
  const lawCount = decision.applicableLaws.length;
  return {
    verdict:   decision.summary.verdict,
    summary:   decision.summary.reason,
    authority: approver?.role ?? 'NOT_DETERMINED',
    basis:     lawCount > 0
      ? `${lawCount} applicable law(s) identified.`
      : 'No applicable laws found.',
  };
}

/** Builds the ExplanationRecommendation from the GovernanceDecision. */
export function buildExplanationRecommendation(
  decision: GovernanceDecision,
): ExplanationRecommendation {
  const action  = deriveExplanationAction(decision);
  const urgency = deriveExplanationUrgency(action);
  return { action, rationale: decision.summary.reason, urgency };
}
