import type { ApplicabilityStatus, EffectivePeriodStatus } from './knowledgeEnrichmentTypes.ts'
import type { LegalRuleResult, LegalThresholdResult } from './reasoningTypes.ts'

// ── Rule Evaluation Types — Phase X.4.3 ────────────────────────────────────────
// Reuses EffectivePeriodStatus/ApplicabilityStatus (X.3.6, frozen) and LegalRuleResult/
// LegalThresholdResult (Batch A, frozen) as-is rather than inventing parallel types —
// PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md's Finding F-5 already flagged proliferating
// near-identical types as a cost to avoid.

export interface KnowledgeItemEvaluation {
  readonly itemId: string
  readonly temporalValidity: EffectivePeriodStatus
  readonly applicability: ApplicabilityStatus
  readonly hierarchyScore: number
}

export interface RuleEvaluationResult {
  readonly asOfDate: string
  readonly itemEvaluations: readonly KnowledgeItemEvaluation[]
  readonly ruleResults: readonly LegalRuleResult[]
  readonly thresholdResults: readonly LegalThresholdResult[]
  readonly evaluatedAt: string
}
