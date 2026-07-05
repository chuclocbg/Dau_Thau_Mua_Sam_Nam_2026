import type { KnowledgeItemRef, ReasoningContext } from './reasoningTypes.ts'

// ── IKnowledgeRepository — Phase X.3.2 repository interface ────────────────────
// Per DEPENDENCY_RULES.md's layer order ("Interface -> Application -> Domain -> Repository
// Interfaces -> Memory|Prisma Repositories") and Constraint C-06. This interface is pure — it
// imports nothing from src/knowledge/, only this module's own frozen ReasoningContext/
// KnowledgeItemRef (Batch A). The one concrete implementation
// (infrastructure/knowledgePlatformRepository.ts) is the sole file permitted to import
// IKnowledgePlatform, satisfying C-06's "only KnowledgeResolver may call IKnowledgePlatform"
// structurally: a future orchestration layer (X.3.3+, the intent-driven resolution strategy)
// depends on this interface, never on src/knowledge/ directly.
//
// resolveKnowledge() wraps IKnowledgePlatform.resolveApplicableDocuments(domain, asOfDate,
// context) — the single generic primitive every one of the platform's 11 named domain-specific
// convenience methods (resolveLegalBasis, resolveSchoolPolicy, etc.) already delegates to
// internally, per direct inspection of knowledgePlatform.ts. One domain-parameterized method
// here covers all of them; no need to wrap each one individually.
//
// searchKnowledge() wraps IKnowledgePlatform.searchKnowledge(text, domains, context, limit),
// per ADR-022 Decision 1.
//
// Ranking is NOT this layer's concern: rule-based resolution returns items in the order the
// platform gives them (no ranking exists there); text-query results are already ranked and
// limited by the platform's own ResultRanker before this interface ever sees them. This layer
// never re-sorts, re-scores, or re-limits.

export interface KnowledgeRetrievalResult {
  readonly items: readonly KnowledgeItemRef[]
  /** itemIds whose effectiveFrom was assumed from createdAt (ADR-022 Decision 4) — carried
   *  forward so a later layer can build the corresponding ResolvedKnowledge.warnings entries
   *  without re-deriving which items triggered the fallback. */
  readonly effectivePeriodAssumedItemIds: readonly string[]
}

export interface IKnowledgeRepository {
  resolveKnowledge(
    domain: string, context: ReasoningContext, asOfDate: string,
  ): Promise<KnowledgeRetrievalResult>

  searchKnowledge(
    text: string, domains: readonly string[], context: ReasoningContext, limit: number,
  ): Promise<KnowledgeRetrievalResult>
}
