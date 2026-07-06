import type { ConfidenceComponents } from './reasoningTypes.ts'

// ── Confidence Evaluation Types — Phase X.4.5 ──────────────────────────────────
// Reuses ConfidenceComponents (Batch A, frozen, already exported — baseScore, deductions,
// finalScore, label) as-is rather than inventing a parallel type; it is exactly
// answerComposer.ts's own computeConfidence() return shape, reused directly. Only
// EvidenceWeightSummary/ConfidenceEvaluationResult are new: transparency/traceability wrappers
// around the reused score, not a new scoring formula.

export interface EvidenceWeightSummary {
  readonly itemId: string
  readonly confidence: number
}

export interface ConfidenceEvaluationResult {
  readonly confidence: ConfidenceComponents
  readonly supportingEvidence: readonly EvidenceWeightSummary[]
  readonly rejectedEvidence: readonly EvidenceWeightSummary[]
  readonly supportingWeight: number
  readonly rejectedWeight: number
  readonly evaluatedAt: string
}
