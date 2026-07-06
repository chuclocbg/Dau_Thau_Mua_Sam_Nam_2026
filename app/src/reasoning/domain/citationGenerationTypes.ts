import type { FormattedCitation } from './reasoningTypes.ts'

// ── Citation Generation Types — Phase X.4.6 ────────────────────────────────────
// Reuses FormattedCitation (Batch A, frozen, already exported) as-is — it already carries
// itemId, so traceability to the originating knowledge item is built into the reused type,
// not a new field. Only CitationGenerationResult is new: a thin wrapper recording which
// candidate items were dropped as duplicates, for transparency.

export interface CitationGenerationResult {
  readonly citations: readonly FormattedCitation[]
  readonly duplicatesRemoved: readonly string[]
  readonly generatedAt: string
}
