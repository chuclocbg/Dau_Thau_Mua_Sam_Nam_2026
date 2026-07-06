import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'
import type { KnowledgeItemRef, LegalBasisRef, ReasoningIntent, ResolvedKnowledge } from '../domain/reasoningTypes.ts'

// ── ReasoningContextAssembler — Phase X.4.2 ────────────────────────────────────
// Pure, deterministic assembly of a ReasoningExecutionContext from an already-resolved
// ReasoningIntent + ResolvedKnowledge (X.3.7's FinalKnowledgeResolutionPipeline output,
// EnrichmentResult.knowledge). Performs no reasoning, no conflict resolution, no confidence
// scoring, no citation/explanation/answer generation — those remain legalReasoningEngine.ts's
// job, untouched.
//
// "Normalization" here means exactly two structural operations, neither changing any item's
// actual content: (1) stable, first-occurrence-wins deduplication by itemId (items) and by
// documentSymbol/article/clause/point (legal references) — defensive against an upstream
// duplicate, never re-ordering otherwise, so ranking's own order is always preserved; (2) deep
// freezing for genuine runtime immutability (KnowledgeItemRef's `readonly` fields are
// compile-time only until this point). Never re-applies or second-guesses temporal filtering —
// an item's presence or absence here is exactly what ResolvedKnowledge already decided upstream.
// Never mutates its inputs: every normalized item is a new object built via spread, so the
// original KnowledgeItemRef/ResolvedKnowledge values passed in are untouched.
//
// deepFreeze() is duplicated here (not imported from src/ai/application/aiContextBuilder.ts,
// which has its own private copy for the same purpose) because DEPENDENCY_RULES.md permits
// src/ai/ -> src/reasoning/, never the reverse — importing from src/ai/ here would be the wrong
// dependency direction. Eight lines of duplication is cheaper than a layering violation.

function legalBasisKey(basis: LegalBasisRef): string {
  return `${basis.documentSymbol}|${basis.article ?? ''}|${basis.clause ?? ''}|${basis.point ?? ''}`
}

function dedupeLegalBasis(legalBasis: readonly LegalBasisRef[]): readonly LegalBasisRef[] {
  const seen = new Set<string>()
  const result: LegalBasisRef[] = []
  for (const basis of legalBasis) {
    const key = legalBasisKey(basis)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(basis)
  }
  return result
}

function normalizeItem<T extends KnowledgeItemRef>(item: T): T {
  return { ...item, legalBasis: dedupeLegalBasis(item.legalBasis) }
}

function dedupeItems<T extends KnowledgeItemRef>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.itemId)) continue
    seen.add(item.itemId)
    result.push(normalizeItem(item))
  }
  return result
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

export function assembleReasoningContext(
  intent: ReasoningIntent, resolvedKnowledge: ResolvedKnowledge,
): ReasoningExecutionContext {
  const context: ReasoningExecutionContext = {
    intent,
    asOfDate: resolvedKnowledge.asOfDate,
    legalItems: dedupeItems(resolvedKnowledge.legalItems),
    procurementItems: dedupeItems(resolvedKnowledge.procurementItems),
    schoolPolicyItems: dedupeItems(resolvedKnowledge.schoolPolicyItems),
    ruleItems: dedupeItems(resolvedKnowledge.ruleItems),
    thresholdItems: dedupeItems(resolvedKnowledge.thresholdItems),
    resolvedAt: resolvedKnowledge.resolvedAt,
    platformCallCount: resolvedKnowledge.platformCallCount,
    warnings: resolvedKnowledge.warnings,
    assembledAt: new Date().toISOString(),
  }
  return deepFreeze(context)
}
