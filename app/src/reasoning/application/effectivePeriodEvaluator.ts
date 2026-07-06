import type { EffectivePeriodEvaluation } from '../domain/knowledgeEnrichmentTypes.ts'
import type { KnowledgeItemRef } from '../domain/reasoningTypes.ts'

// ── EffectivePeriod Evaluator — Phase X.3.6 ────────────────────────────────────
// An independent, auditable recomputation of temporal applicability from an item's own
// effectiveFrom/effectiveTo against asOfDate. The RESOLVE retrieval path (X.3.2) already filters
// via the platform's isEffectiveOn internally, and the SEARCH path deliberately does not (ADR-022
// Decision 2) — this evaluator gives the reasoning layer its own visible, traceable check
// regardless of which path an item arrived through, per this project's audit-first principle.
// Pure function: never excludes an item, only classifies it.

export function evaluateEffectivePeriod(item: KnowledgeItemRef, asOfDate: string): EffectivePeriodEvaluation {
  const asOf = new Date(asOfDate).getTime()
  const from = new Date(item.effectiveFrom).getTime()

  if (asOf < from) return { itemId: item.itemId, status: 'NOT_YET_EFFECTIVE' }

  if (item.effectiveTo !== undefined) {
    const to = new Date(item.effectiveTo).getTime()
    if (asOf > to) return { itemId: item.itemId, status: 'EXPIRED' }
  }

  return { itemId: item.itemId, status: 'CURRENT' }
}
