import type { KnowledgeItemRef } from './reasoningTypes.ts'

// ── Phase X.3.4 — Knowledge Ranking domain types ───────────────────────────────
// Pure types — no logic, no import from src/knowledge/, no import from the retrieval
// (X.3.2) or orchestration (X.3.3) layers. Ranking consumes ONLY the output of X.3.3
// (a ResolvedKnowledge value) and Batch A's own frozen KnowledgeItemRef shape.
//
// Five criteria, per this milestone's explicit scope: repository/source priority (stood in
// for by domainPriority — KnowledgeItemRef has no separate "source"/"repository" identifier
// field, only domain, so domain is the closest real signal), legal hierarchy (derived from
// .type, mirroring legalReasoningEngine.ts's own authority-level concept — independently
// defined here, never imported from that frozen file), relevance (stood in for by
// .confidence — KnowledgeItemRef has no separate relevance/search-score field since X.3.2
// deliberately does not preserve KnowledgeResult.relevance), freshness (derived from
// .effectiveFrom relative to asOfDate), document authority (derived from .layer).
//
// This is scoring/ordering only — it never compares two items against each other for
// contradiction (that remains conflict resolution, legalReasoningEngine.ts's job, frozen,
// untouched) and never decides which item backs a passing rule (that remains evidence
// collection, evidenceCollector.ts's job, frozen, untouched).

export interface RankingWeights {
  readonly domainPriority: number
  readonly legalHierarchy: number
  readonly relevance: number
  readonly freshness: number
  readonly documentAuthority: number
}

export interface RankingPlan {
  readonly weights: RankingWeights
  readonly maxCandidates: number
}

export interface RankedItem {
  readonly item: KnowledgeItemRef
  readonly score: number
}
