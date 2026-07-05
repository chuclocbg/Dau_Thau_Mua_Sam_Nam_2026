import type {
  KnowledgeReference, KnowledgeReferenceLegalBasis,
} from '../domain/knowledgeReferenceTypes.ts'
import type { KnowledgeItemRef, LegalBasisRef } from '../domain/reasoningTypes.ts'

// ── Repository mapping layer — Phase X.3.1 ─────────────────────────────────────
// Per ADR-022 Decisions 3-4 (app/.memory/decisions/ADR-022-knowledge-resolution-strategy.md).
// Pure mapping only — no repository queries, no platform calls, no retrieval, no ranking,
// no conflict resolution, no effectivePeriod filtering. Maps the real Knowledge Platform's
// field shapes (mirrored locally as KnowledgeReference, per knowledgeReferenceTypes.ts) onto
// the reasoning pipeline's own, already-frozen KnowledgeItemRef/LegalBasisRef (Batch A).

// ── ADR-022 Decision 3: LegalBasis.document -> LegalBasisRef.documentSymbol ────
// LegalBasis's other optional fields (documentNumber, appendix, effectiveDate,
// issuingAuthority, summary, url) have no destination in LegalBasisRef and are dropped —
// additive to add later if a real consumer need appears.

export function toLegalBasisRef(basis: KnowledgeReferenceLegalBasis): LegalBasisRef {
  return {
    documentSymbol: basis.document,
    article: basis.article,
    clause: basis.clause,
    point: basis.point,
  }
}

// ── ADR-022 Decision 4: effectivePeriod fallback ───────────────────────────────
// When effectivePeriod is undefined, effectiveFrom falls back to the item's own createdAt
// date — a real, already-recorded fact, never a fabricated date. This function reports
// whether that fallback was used (effectivePeriodAssumedFromCreation) rather than emitting a
// ReasoningWarning itself: constructing a well-formed warning is the resolver's job (a later
// sub-milestone), once it has the full context a warning needs.

export interface KnowledgeItemMappingResult {
  readonly item: KnowledgeItemRef
  readonly effectivePeriodAssumedFromCreation: boolean
}

export function toKnowledgeItemRef(reference: KnowledgeReference): KnowledgeItemMappingResult {
  const legalBasis = reference.legalBasis.map(toLegalBasisRef)

  const effectivePeriodAssumedFromCreation = reference.effectivePeriod === undefined
  const effectiveFrom = reference.effectivePeriod?.startDate ?? reference.createdAt.slice(0, 10)
  const effectiveTo = reference.effectivePeriod?.endDate

  const item: KnowledgeItemRef = {
    itemId: reference.id,
    domain: reference.domain,
    type: reference.type,
    title: reference.title,
    summary: reference.summary,
    confidence: reference.confidence,
    layer: reference.layer,
    legalBasis,
    metadata: reference.metadata,
    effectiveFrom,
    effectiveTo,
  }

  return { item, effectivePeriodAssumedFromCreation }
}
