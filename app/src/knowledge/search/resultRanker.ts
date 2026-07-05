import type { KnowledgeResult } from '../platform/knowledgeTypes.ts'

// ── ResultRanker — merges + sorts results from multiple providers ────────────
// Cross-provider ranking (Rule 5's reason score() is required): relevance first,
// item confidence as tiebreak. Pure function — no provider-specific logic.

export class ResultRanker {
  rank(results: readonly KnowledgeResult[], limit?: number): readonly KnowledgeResult[] {
    const sorted = [...results].sort((a, b) =>
      b.relevance - a.relevance || b.item.confidence - a.item.confidence,
    )
    return limit !== undefined ? sorted.slice(0, limit) : sorted
  }
}
