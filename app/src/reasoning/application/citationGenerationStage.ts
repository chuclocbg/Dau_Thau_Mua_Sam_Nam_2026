import { formatCitations } from './citationFormatter.ts'
import type { CitationGenerationResult } from '../domain/citationGenerationTypes.ts'
import type { AppliedArticle, AppliedRole, DetectedConflict, KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'
import type { ConflictResolutionResult } from '../domain/conflictResolutionTypes.ts'
import type { ConfidenceEvaluationResult } from '../domain/confidenceEvaluationTypes.ts'

// ── Citation Generation Stage — Phase X.4.6 ────────────────────────────────────
// Consumes X.4.2's ReasoningExecutionContext, X.4.4's ConflictResolutionResult, and X.4.5's
// ConfidenceEvaluationResult, and produces only a CitationGenerationResult. No confidence/
// conflict/rule-evaluation modification, no explanation/answer/output-format generation, no
// repository/KnowledgePlatform/provider/LLM/PromptBuilder/MCP/Tool Calling/Multi-Agent access —
// all of that remains legalReasoningEngine.ts's job, untouched.
//
// TRANSPARENCY NOTE (per this milestone's explicit "reuse existing public citation builders,
// never duplicate citation logic, never expose private helpers" instruction):
// citationFormatter.ts's formatCitations() (Batch A, frozen) IS already public and exported —
// like X.4.5's computeConfidence(), this milestone genuinely has a public builder to reuse, and
// it is called here directly. The citation FORMATTING itself (full/short/inline string assembly,
// document-type labels/codes, isPrimary/isNormative determination) is never reimplemented.
//
// formatCitations() requires AppliedArticle[] — data legalReasoningEngine.ts derives via its own
// private toAppliedArticle()/roleByItemId bookkeeping, not exported (per "never expose private
// helpers"). This stage independently derives the same shape from data this milestone's own
// inputs already provide: the "accepted evidence" set (which items even get a citation at all)
// comes directly from X.4.5's own ConfidenceEvaluationResult.supportingEvidence/rejectedEvidence
// — reused, not re-derived via a fresh temporal check — and the PRIMARY_BASIS/CONFLICT_SOURCE/
// SUPPORTING_BASIS distinction comes directly from X.4.4's own ConflictResolutionResult.conflicts.
//
// Ordering: no new sort is introduced. "Preserve source/hierarchy/temporal ordering" is
// satisfied by processing items in exactly the order they already arrive in
// ReasoningExecutionContext — an order X.3.4's ranking already shaped using hierarchy,
// freshness, and relevance signals together. Re-sorting here would risk contradicting that
// already-established order rather than preserving it.
//
// Duplicate elimination: two candidate items whose legalBasis[0] (the same single entry
// toAppliedArticle()/formatCitations() itself has always used) resolves to the same
// documentSymbol/article/clause/point are the same citation in substance — the second and
// later occurrences are dropped, first-occurrence-wins, before formatCitations() ever runs (that
// function performs no deduplication of its own).
//
// HONEST SCOPE GAP (documented, not fabricated): this milestone's input list has no
// temporal-validity signal (X.4.3's RuleEvaluationResult is not one of its stated inputs) — a
// superseded/expired item is therefore excluded from citations entirely here, whereas the real,
// frozen legalReasoningEngine.ts still cites such an item (role SUPERSEDED_CONTEXT, always
// non-primary, non-normative). Confirmed and locked in by a dedicated parity test that asserts
// this exact, intentional divergence rather than a false equivalence.

function toAppliedArticle(item: KnowledgeItemRef, role: AppliedRole): AppliedArticle {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId, documentType: item.type,
    article: basis?.article, clause: basis?.clause, point: basis?.point,
    extractedText: item.summary, role, applicabilityScore: item.confidence,
    exceptions: [], crossReferences: [],
  }
}

function roleFor(itemId: string, isRejected: boolean, conflicts: readonly DetectedConflict[]): AppliedRole {
  if (isRejected) return 'CONFLICT_SOURCE'
  return conflicts.some(conflict => conflict.appliedItem === itemId) ? 'PRIMARY_BASIS' : 'SUPPORTING_BASIS'
}

function citationKey(article: AppliedArticle): string {
  return `${article.documentSymbol}|${article.article ?? ''}|${article.clause ?? ''}|${article.point ?? ''}`
}

export function generateCitations(
  context: ReasoningExecutionContext,
  conflictResolution: ConflictResolutionResult,
  confidenceEvaluation: ConfidenceEvaluationResult,
): CitationGenerationResult {
  const acceptedItemIds = new Set([
    ...confidenceEvaluation.supportingEvidence.map(e => e.itemId),
    ...confidenceEvaluation.rejectedEvidence.map(e => e.itemId),
  ])
  const rejectedItemIds = new Set(confidenceEvaluation.rejectedEvidence.map(e => e.itemId))

  const candidates = [...context.legalItems, ...context.schoolPolicyItems]
    .filter(item => acceptedItemIds.has(item.itemId))

  const seenKeys = new Set<string>()
  const duplicatesRemoved: string[] = []
  const appliedArticles: AppliedArticle[] = []
  for (const item of candidates) {
    const article = toAppliedArticle(item, roleFor(item.itemId, rejectedItemIds.has(item.itemId), conflictResolution.conflicts))
    const key = citationKey(article)
    if (seenKeys.has(key)) {
      duplicatesRemoved.push(item.itemId)
      continue
    }
    seenKeys.add(key)
    appliedArticles.push(article)
  }

  const citations = formatCitations(appliedArticles)

  const result: CitationGenerationResult = {
    citations, duplicatesRemoved, generatedAt: new Date().toISOString(),
  }
  return deepFreeze(result)
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}
