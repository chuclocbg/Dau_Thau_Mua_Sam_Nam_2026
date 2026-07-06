// ── Phase X.3.3 — Intent-driven orchestration types ────────────────────────────
// Per PHASE_X3_ARCHITECTURE_REVIEW.md's "Suggested Interfaces" and ADR-022 Decision 1. Pure
// types — no logic, no import from src/knowledge/.
//
// SCOPE NOTE: 'RESOLVE' maps to IKnowledgeRepository.resolveKnowledge() (rule-based,
// temporally filtered by the platform itself). 'SEARCH' maps to
// IKnowledgeRepository.searchKnowledge() (free-text ranked, NOT temporally filtered — per
// ADR-022 Decision 2, only ever appropriate for domains whose results are treated as
// illustrative, never load-bearing). This milestone's default resolution strategy
// (knowledgeResolutionPlanner.ts) only ever emits 'RESOLVE' steps for domains that have a
// real destination field on the frozen ResolvedKnowledge (legal/procurement/school) — see
// the implementation report for why 'SEARCH'-routed domains (cases, bestpractice) have no
// destination yet and are therefore not part of the default strategy table, even though the
// dispatch mechanism itself supports 'SEARCH' generically (proven directly in tests).

export type ResolutionMethod = 'RESOLVE' | 'SEARCH'

export interface ResolutionStep {
  readonly domain: string
  readonly method: ResolutionMethod
  /** Only meaningful when method = 'SEARCH' — IKnowledgeRepository.searchKnowledge()'s limit. */
  readonly limit?: number
}

export interface IntentResolutionPlan {
  readonly steps: readonly ResolutionStep[]
}
