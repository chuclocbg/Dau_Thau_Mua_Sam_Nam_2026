import type { ConfidenceComponents, DetectedConflict, FormattedCitation } from './reasoningTypes.ts'

// ── Reasoning Answer Types — Phase X.4.7 ───────────────────────────────────────
// Reuses ConfidenceComponents/DetectedConflict/FormattedCitation (Batch A, frozen, already
// exported) as-is — the answer's sections are combinations/groupings of already-produced data,
// never a new scoring, conflict, or citation shape. Only ReasoningAnswerResult is new: the
// structured bundle combining X.4.4/X.4.5/X.4.6's outputs into named answer sections.

export interface ReasoningAnswerResult {
  readonly decision: string | null
  readonly primaryCitations: readonly FormattedCitation[]
  readonly supportingCitations: readonly FormattedCitation[]
  readonly disputedCitations: readonly FormattedCitation[]
  readonly confidenceSummary: ConfidenceComponents
  readonly conflicts: readonly DetectedConflict[]
  readonly composedAt: string
}
