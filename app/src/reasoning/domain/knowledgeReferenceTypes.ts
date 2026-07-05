// ── Phase X.3.1 — KnowledgeReference types (pure mapping input shape) ─────────
// Per PHASE_X3_ARCHITECTURE_REVIEW.md's "First Coding Task" and this milestone's explicit
// "no imports from Knowledge Platform" rule: `KnowledgeReference` is a structural mirror of the
// real, frozen `KnowledgeItem` (src/knowledge/platform/knowledgeTypes.ts) and
// `KnowledgeReferenceLegalBasis` mirrors the real, frozen `LegalBasis`
// (src/shared/financial/financialFactory.ts) — defined independently here, not imported, so
// this milestone's mapping logic has zero dependency on src/knowledge/ or
// src/shared/financial/. A later sub-milestone wires the real platform in; because TypeScript
// is structurally typed, a real `KnowledgeItem` already satisfies this shape and can be passed
// to toKnowledgeItemRef() directly once that wiring exists — no adapter needed at that point.
//
// SCOPE NOTE: this milestone is pure mapping only. No retrieval, no search, no ranking, no
// conflict resolution, no effectivePeriod *filtering* (date-range exclusion). The
// createdAt-fallback in toKnowledgeItemRef() is mapping/substitution logic (per ADR-022
// Decision 4), not filtering — it never excludes an item, it only decides what effectiveFrom
// value to report.

export interface KnowledgeReferenceLegalBasis {
  readonly document: string
  readonly documentNumber?: string
  readonly article?: string
  readonly clause?: string
  readonly point?: string
  readonly appendix?: string
  readonly effectiveDate?: string
  readonly issuingAuthority?: string
  readonly summary?: string
  readonly url?: string
}

export interface KnowledgeReferenceEffectivePeriod {
  readonly startDate: string
  readonly endDate?: string
}

export interface KnowledgeReference {
  readonly id: string
  readonly domain: string
  readonly type: string
  readonly title: string
  readonly summary: string
  readonly legalBasis: readonly KnowledgeReferenceLegalBasis[]
  readonly metadata: Readonly<Record<string, string>>
  readonly effectivePeriod?: KnowledgeReferenceEffectivePeriod
  readonly confidence: number
  readonly layer: 1 | 2 | 3 | 4
  readonly createdAt: string
  readonly updatedAt: string
}
