import type { MissingEvidence } from './reasoningTypes.ts'

// ── Knowledge Enrichment Types — Phase X.3.6 ───────────────────────────────────
// Additive diagnostic types for the deterministic enrichment layer that completes ADR-022
// Decision 5 (rule/threshold metadata parsing) and adds an independent, auditable
// effectivePeriod/applicability check on top of X.3.1-X.3.5's already-frozen output. None of
// these types modify ResolvedKnowledge/KnowledgeItemRef (Batch A, frozen) — they are new,
// standalone shapes returned alongside it.

export type EffectivePeriodStatus = 'CURRENT' | 'NOT_YET_EFFECTIVE' | 'EXPIRED'

export interface EffectivePeriodEvaluation {
  readonly itemId: string
  readonly status: EffectivePeriodStatus
}

export type ApplicabilityStatus = 'APPLICABLE' | 'NOT_YET_EFFECTIVE' | 'EXPIRED' | 'MISSING_EVIDENCE'

export interface ApplicabilityEvaluation {
  readonly itemId: string
  readonly status: ApplicabilityStatus
}

export interface ResolutionDiagnosticsSummary {
  readonly totalItemsEvaluated: number
  readonly notYetEffectiveCount: number
  readonly expiredCount: number
  readonly missingEvidenceCount: number
}

export interface ResolutionDiagnostics {
  readonly effectivePeriodEvaluations: readonly EffectivePeriodEvaluation[]
  readonly applicabilityEvaluations: readonly ApplicabilityEvaluation[]
  readonly missingEvidence: readonly MissingEvidence[]
  readonly summary: ResolutionDiagnosticsSummary
}
