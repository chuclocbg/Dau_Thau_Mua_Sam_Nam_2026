import { scoreItem } from './rankingStrategy.ts'
import type { KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { RankedItem, RankingWeights } from '../domain/knowledgeRankingTypes.ts'

// ── CandidateSelector — Phase X.3.4 ─────────────────────────────────────────────
// Scores every candidate (via RankingStrategy), sorts deterministically (score descending,
// itemId ascending as a stable tie-break — never an unstable/arbitrary order), and trims to
// maxCandidates. Never mutates which items exist beyond trimming — never merges, dedupes,
// or invents an item.

export function rankItems<T extends KnowledgeItemRef>(
  items: readonly T[], weights: RankingWeights, asOfDate: string,
): readonly RankedItem[] {
  return items
    .map((item): RankedItem => ({ item, score: scoreItem(item, weights, asOfDate) }))
    .sort((a, b) => b.score - a.score || a.item.itemId.localeCompare(b.item.itemId))
}

export function selectCandidates<T extends KnowledgeItemRef>(
  items: readonly T[], weights: RankingWeights, asOfDate: string, maxCandidates: number,
): readonly T[] {
  return rankItems(items, weights, asOfDate).slice(0, maxCandidates).map(ranked => ranked.item as T)
}
