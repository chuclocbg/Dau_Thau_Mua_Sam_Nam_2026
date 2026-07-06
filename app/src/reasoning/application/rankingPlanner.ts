import type { IntentType, ReasoningIntent } from '../domain/reasoningTypes.ts'
import type { RankingPlan, RankingWeights } from '../domain/knowledgeRankingTypes.ts'

// ── RankingPlanner — Phase X.3.4 ────────────────────────────────────────────────
// Decides ranking weights (and the candidate cap) per intent type — never scores an item
// itself (that's rankingStrategy.ts) and never selects/trims (that's candidateSelector.ts).
// Data-driven (Map/table lookup, no switch/if), mirroring knowledgeResolutionPlanner.ts's
// own established pattern from X.3.3.

const DEFAULT_MAX_CANDIDATES = 20

const DEFAULT_WEIGHTS: RankingWeights = Object.freeze({
  domainPriority: 0.2, legalHierarchy: 0.3, relevance: 0.2, freshness: 0.1, documentAuthority: 0.2,
})

// AUTHORITY_CHECK is about who has the authority to approve/decide — document authority and
// legal hierarchy matter more than freshness or generic relevance for this specific question
// shape. Every other intent type uses DEFAULT_WEIGHTS; no other override is asserted without
// a similarly concrete justification.
const WEIGHTS_BY_INTENT: Readonly<Partial<Record<IntentType, RankingWeights>>> = Object.freeze({
  AUTHORITY_CHECK: Object.freeze({
    domainPriority: 0.15, legalHierarchy: 0.35, relevance: 0.1, freshness: 0.05, documentAuthority: 0.35,
  }),
})

export function planRanking(intent: ReasoningIntent): RankingPlan {
  return {
    weights: WEIGHTS_BY_INTENT[intent.intentType] ?? DEFAULT_WEIGHTS,
    maxCandidates: DEFAULT_MAX_CANDIDATES,
  }
}
