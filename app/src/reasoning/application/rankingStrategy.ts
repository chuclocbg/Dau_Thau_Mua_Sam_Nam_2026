import type { KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { RankingWeights } from '../domain/knowledgeRankingTypes.ts'

// ── RankingStrategy — Phase X.3.4 ───────────────────────────────────────────────
// Pure, deterministic per-item scoring. Never compares two items to each other (that would
// be conflict detection) — every criterion is computed from one item's own fields only.

// Independently defined, per this project's established convention of never importing from
// a frozen file (legalReasoningEngine.ts, Reasoning Pipeline Core) even for a value it
// happens to compute the same way — mirrors that file's own AUTHORITY_LEVEL_BY_TYPE table.
const LEGAL_HIERARCHY_LEVEL_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  CONSTITUTION: 1, LAW: 3, DECREE: 6, CIRCULAR: 8, OFFICIAL_LETTER: 11, INTERNAL_REGULATION: 14,
})
const MAX_HIERARCHY_LEVEL = 14

// Domain is the only per-item field that could plausibly stand in for "which source/
// repository this came from" (KnowledgeItemRef carries no separate source identifier).
// Legal content is the default-highest-priority baseline; school policy close behind since
// it may override law when more restrictive (per the project's conflict-resolution design);
// unlisted domains fall back to a neutral default.
const DEFAULT_DOMAIN_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  legal: 1.0, school: 0.9, procurement: 0.7,
})
const DEFAULT_DOMAIN_PRIORITY_FALLBACK = 0.5

const FRESHNESS_HALF_LIFE_DAYS = 365
const MS_PER_DAY = 86_400_000

export function domainPriorityScore(item: KnowledgeItemRef): number {
  return DEFAULT_DOMAIN_PRIORITY[item.domain] ?? DEFAULT_DOMAIN_PRIORITY_FALLBACK
}

export function legalHierarchyScore(item: KnowledgeItemRef): number {
  const level = LEGAL_HIERARCHY_LEVEL_BY_TYPE[item.type] ?? MAX_HIERARCHY_LEVEL
  return Math.max(0, 1 - (level - 1) / (MAX_HIERARCHY_LEVEL - 1))
}

export function relevanceScore(item: KnowledgeItemRef): number {
  return item.confidence
}

export function freshnessScore(item: KnowledgeItemRef, asOfDate: string): number {
  const ageMs = new Date(asOfDate).getTime() - new Date(item.effectiveFrom).getTime()
  const ageDays = Math.max(0, ageMs / MS_PER_DAY)
  return 1 / (1 + ageDays / FRESHNESS_HALF_LIFE_DAYS)
}

export function documentAuthorityScore(item: KnowledgeItemRef): number {
  return (5 - item.layer) / 4
}

export function scoreItem(item: KnowledgeItemRef, weights: RankingWeights, asOfDate: string): number {
  return weights.domainPriority * domainPriorityScore(item)
    + weights.legalHierarchy * legalHierarchyScore(item)
    + weights.relevance * relevanceScore(item)
    + weights.freshness * freshnessScore(item, asOfDate)
    + weights.documentAuthority * documentAuthorityScore(item)
}
