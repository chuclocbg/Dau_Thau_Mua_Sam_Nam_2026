import type { ApplicabilityEvaluation, EffectivePeriodEvaluation } from '../domain/knowledgeEnrichmentTypes.ts'
import type { KnowledgeItemRef } from '../domain/reasoningTypes.ts'

// ── Knowledge Applicability Evaluator — Phase X.3.6 ────────────────────────────
// Combines an item's effectivePeriod status with whether its metadata (if any) failed to
// parse into one final, deterministic applicability verdict. Never compares two items against
// each other (that stays conflict resolution's job, out of scope) — a pure per-item function.

export function evaluateApplicability(
  item: KnowledgeItemRef, effectivePeriod: EffectivePeriodEvaluation, metadataParseFailed: boolean,
): ApplicabilityEvaluation {
  if (metadataParseFailed) return { itemId: item.itemId, status: 'MISSING_EVIDENCE' }
  if (effectivePeriod.status === 'NOT_YET_EFFECTIVE') return { itemId: item.itemId, status: 'NOT_YET_EFFECTIVE' }
  if (effectivePeriod.status === 'EXPIRED') return { itemId: item.itemId, status: 'EXPIRED' }
  return { itemId: item.itemId, status: 'APPLICABLE' }
}
