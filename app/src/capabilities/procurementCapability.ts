/**
 * Phase 17 — Procurement Capability
 *
 * First end-to-end governance capability.  Orchestrates the Reasoning Engine,
 * Knowledge Base, and Configuration Resolver to produce a ProcurementDecision.
 *
 * Consumed modules (via constructor injection):
 *   GovernanceReasoningEngine — Legal Registry, Knowledge Graph, Config Platform,
 *                               Rule Engine (all accessed internally by the engine)
 *   GovernanceKnowledgeBase   — Template Registry, Clause Library, Checklist Library
 *   ConfigResolver            — PROCUREMENT_THRESHOLD, AUTHORITY_MATRIX,
 *                               WORKFLOW_DEFINITION, DOCUMENT_TEMPLATE configs
 *
 * Public APIs:
 *   analyzeProcurement(ctx)          → GovernanceDecision  (full reasoning output)
 *   resolveProcurementWorkflow(ctx)  → readonly GovernanceConfig[]
 *   resolveProcurementAuthority(ctx) → readonly AuthorityLevel[]
 *   resolveRequiredDocuments(ctx)    → readonly ResolvedTemplate[]
 *   resolveApplicableThreshold(ctx)  → readonly GovernanceConfig[]
 *   generateProcurementDecision(ctx) → ProcurementDecision  (complete output)
 *   buildProcurementCapability(...)  — factory
 *
 * No business logic.  Pure orchestration.  No UI.  No HTTP.  No React.
 * Pure. No I/O. No side effects. No any. No browser globals.
 */

import type { GovernanceReasoningEngine } from '../reasoning/reasoningEngine';
import type { GovernanceKnowledgeBase, ResolvedTemplate } from '../knowledge/knowledgeBase';
import type { ConfigResolver }            from '../legal/configResolver';
import type { GovernanceContext }         from '../application/governanceContext';
import type { GovernanceConfig }          from '../legal/governanceConfig';
import type { AuthorityLevel, GovernanceDecision } from '../reasoning/decisionModel';
import {
  createProcurementDecision,
  deriveFinalRecommendation,
  type ProcurementDecision,
} from './procurementTypes';

// ─── Capability class ─────────────────────────────────────────────────────────

export class ProcurementCapability {
  constructor(
    private readonly reasoningEngine: GovernanceReasoningEngine,
    private readonly knowledgeBase:   GovernanceKnowledgeBase,
    private readonly resolver:        ConfigResolver,
  ) {}

  /** Runs the full Reasoning Engine pipeline and returns the GovernanceDecision. */
  analyzeProcurement(ctx: GovernanceContext): GovernanceDecision {
    return this.reasoningEngine.generateDecision(ctx);
  }

  /** Returns applicable WORKFLOW_DEFINITION configs for this context. */
  resolveProcurementWorkflow(ctx: GovernanceContext): readonly GovernanceConfig[] {
    return this.reasoningEngine.resolveWorkflow(ctx);
  }

  /** Returns the ordered authority chain for this context (ascending maxAmount). */
  resolveProcurementAuthority(ctx: GovernanceContext): readonly AuthorityLevel[] {
    return this.reasoningEngine.resolveAuthority(ctx);
  }

  /**
   * Resolves each required document template code from the Reasoning Engine,
   * then hydrates each code via the Knowledge Base.
   * Template codes not found in the Knowledge Base are silently skipped.
   */
  resolveRequiredDocuments(ctx: GovernanceContext): readonly ResolvedTemplate[] {
    const codes     = this.reasoningEngine.resolveRequiredDocuments(ctx);
    const resolved  = codes
      .map(code => this.knowledgeBase.resolveTemplate(code))
      .filter((t): t is ResolvedTemplate => t !== undefined);
    return Object.freeze(resolved);
  }

  /** Returns applicable PROCUREMENT_THRESHOLD configs for this context. */
  resolveApplicableThreshold(ctx: GovernanceContext): readonly GovernanceConfig[] {
    return this.resolver.resolveThreshold({ asOfDate: ctx.effectiveDate ?? ctx.currentDate });
  }

  /** Generates the complete ProcurementDecision by orchestrating all capability APIs. */
  generateProcurementDecision(ctx: GovernanceContext): ProcurementDecision {
    const decision   = this.analyzeProcurement(ctx);
    const thresholds = this.resolveApplicableThreshold(ctx);
    const templates  = this.resolveRequiredDocuments(ctx);
    const checklists = this.knowledgeBase.resolveChecklist('PRE_PROCUREMENT');
    const recommendation = deriveFinalRecommendation(decision, decision.authorityChain);

    return createProcurementDecision({
      context:             ctx,
      applicableLaw:       decision.applicableLaws,
      applicableThreshold: thresholds,
      requiredWorkflow:    decision.applicableWorkflows,
      approvalAuthority:   decision.authorityChain,
      requiredDocuments:   decision.requiredDocuments,
      requiredTemplates:   templates,
      requiredChecklists:  checklists,
      complianceWarnings:  decision.complianceWarnings,
      riskAssessment:      decision.riskAssessment,
      finalRecommendation: recommendation,
      governanceDecision:  decision,
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildProcurementCapability(
  reasoningEngine: GovernanceReasoningEngine,
  knowledgeBase:   GovernanceKnowledgeBase,
  resolver:        ConfigResolver,
): ProcurementCapability {
  return new ProcurementCapability(reasoningEngine, knowledgeBase, resolver);
}
