/**
 * Phase 20 — Legal Advisory Capability
 *
 * Central advisory capability used by every other business capability,
 * the REST API, the MCP server, the document generator, and the dashboard.
 *
 * Input type:  GovernanceCase         (Phase 19 pattern)
 * Output type: GovernanceExplanation  (Phase 20 new domain object)
 *
 * Public APIs:
 *   analyzeLegalQuestion(c)         → GovernanceDecision (full 7-step reasoning)
 *   resolveApplicableLaw(c)         → readonly LegalDocument[]
 *   resolveAuthority(c)             → readonly AuthorityLevel[]
 *   resolveCompliance(c)            → readonly ComplianceWarning[]
 *   resolveRisk(c)                  → RiskAssessment
 *   generateGovernanceExplanation(c)→ GovernanceExplanation (complete advisory output)
 *   buildLegalAdvisoryCapability(...)— factory
 *
 * Capability Framework adapter (caller-built):
 *   const adapter: Capability = {
 *     metadata: createCapabilityMetadata({ domain: 'LEGAL', ... }),
 *     execute:  (ctx) => legalCap.generateGovernanceExplanation(createCase({ context: ctx, ... })),
 *   };
 *   framework.registry.registerCapability(adapter);
 *
 * No business logic. Pure orchestration. No UI. No HTTP. No React.
 * Pure. No I/O. No side effects. No any. No browser globals.
 */

import type { GovernanceReasoningEngine } from '../reasoning/reasoningEngine';
import type { GovernanceKnowledgeBase }   from '../knowledge/knowledgeBase';
import type { GovernanceCase }            from '../cases/caseModel';
import type { LegalDocument }            from '../legal/legalRegistry';
import type { LegalCitation }            from '../knowledge/knowledgeTypes';
import type {
  GovernanceDecision,
  AuthorityLevel,
  ComplianceWarning,
  RiskAssessment,
} from '../reasoning/decisionModel';
import {
  createGovernanceExplanation,
  buildEvidence,
  buildExplanationDecision,
  buildExplanationRecommendation,
  buildNextActions,
  deriveExplanationAction,
  type GovernanceExplanation,
} from './legalTypes';

// ─── Capability class ─────────────────────────────────────────────────────────

export class LegalAdvisoryCapability {
  constructor(
    private readonly reasoningEngine: GovernanceReasoningEngine,
    private readonly knowledgeBase:   GovernanceKnowledgeBase,
  ) {}

  /** Runs the full 7-step reasoning pipeline for the legal case. */
  analyzeLegalQuestion(governanceCase: GovernanceCase): GovernanceDecision {
    return this.reasoningEngine.generateDecision(governanceCase.context);
  }

  /** Returns active laws effective on the case date. */
  resolveApplicableLaw(governanceCase: GovernanceCase): readonly LegalDocument[] {
    return this.reasoningEngine.resolveApplicableLaw(governanceCase.context);
  }

  /** Returns the ordered approval authority chain (ascending maxAmount). */
  resolveAuthority(governanceCase: GovernanceCase): readonly AuthorityLevel[] {
    return this.reasoningEngine.resolveAuthority(governanceCase.context);
  }

  /** Returns compliance warnings for the legal case. */
  resolveCompliance(governanceCase: GovernanceCase): readonly ComplianceWarning[] {
    return this.reasoningEngine.resolveCompliance(governanceCase.context);
  }

  /** Returns the risk assessment for the legal case. */
  resolveRisk(governanceCase: GovernanceCase): RiskAssessment {
    return this.reasoningEngine.resolveRisk(governanceCase.context);
  }

  /**
   * Orchestrates all five APIs into a complete GovernanceExplanation.
   * Legal citations are sourced from Knowledge Base templates linked to
   * required document codes resolved by the reasoning engine.
   */
  generateGovernanceExplanation(governanceCase: GovernanceCase): GovernanceExplanation {
    const decision   = this.analyzeLegalQuestion(governanceCase);
    const authority  = this.resolveAuthority(governanceCase);
    const compliance = this.resolveCompliance(governanceCase);
    const risk       = this.resolveRisk(governanceCase);

    // Collect citations from KB templates linked to required document codes
    const codes: readonly string[] = this.reasoningEngine.resolveRequiredDocuments(
      governanceCase.context,
    );
    const citations: LegalCitation[] = codes.flatMap(code => {
      const resolved = this.knowledgeBase.resolveTemplate(code);
      return resolved ? [...resolved.citations] : [];
    });

    const expDecision = buildExplanationDecision(decision, authority);
    const evidence    = buildEvidence(decision);
    const rec         = buildExplanationRecommendation(decision);
    const action      = deriveExplanationAction(decision);
    const nextActions = buildNextActions(action, compliance.length);

    return createGovernanceExplanation({
      governanceCase,
      governanceDecision: decision,
      decision:           expDecision,
      evidence,
      legalCitations:     citations,
      reasoningTrace:     decision.reasoningTrace,
      confidence:         decision.confidence,
      riskAssessment:     risk,
      recommendation:     rec,
      nextActions,
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildLegalAdvisoryCapability(
  reasoningEngine: GovernanceReasoningEngine,
  knowledgeBase:   GovernanceKnowledgeBase,
): LegalAdvisoryCapability {
  return new LegalAdvisoryCapability(reasoningEngine, knowledgeBase);
}
