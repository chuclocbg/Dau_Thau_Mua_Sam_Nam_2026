# Module: Legal Foundation

**Status:** FROZEN (v1.0, 2026-07-02)
**Location:** `src/legal/`
**Tests:** ~234 (Legal Foundation ~156 + Legal Domain Services ~78)

---

## Purpose

Provides the core legal document model, repository interfaces, and domain service functions
for Vietnamese legal documents (laws, decrees, circulars, official letters).
This is the lowest-level module — it has zero imports from any other business module.

---

## Sub-modules

### Legal Foundation (`src/legal/`)
- `legalSchema.ts` — entity types (LegalDocument, LegalVersion, LegalReference, LegalClause)
- `legalRepositories.ts` — ILegalDocumentRepository, ILegalVersionRepository, ILegalClauseRepository
- `memoryRepositories.ts` — in-memory implementations (tests)
- `prismaRepositories.ts` — Prisma stubs (Phase M)

### Legal Domain Services (`src/legal/domain/`)
- 10 pure stateless domain service functions
- Input validation, effective date resolution, amendment chain traversal
- Zero Prisma imports, zero side effects

### Legal Document Importer (`src/agents/`)
- `VietnamLegalStructureParser` — parses Vietnamese legal document structure
- `LegalTextExtractor` — extracts clauses/articles from raw text
- `LegalDocumentImporter` — orchestrates import pipeline
- Tests: ~117

---

## Public API (key exports)

```typescript
// Types (legalSchema.ts)
LegalDocument { id, symbol, title, type, issuingBody, effectiveFrom, effectiveTo?, ... }
LegalVersion  { versionId, documentId, versionNumber, content, ... }
LegalReference { documentId, articleRef?, clauseRef?, quotedText? }  ← 5-field form
LegalClause   { clauseId, documentId, articleNumber, clauseNumber, text, ... }

// Repositories
ILegalDocumentRepository extends IBaseRepository<LegalDocument>
ILegalVersionRepository extends IBaseRepository<LegalVersion>

// Domain services (src/legal/domain/)
resolveEffectiveLaw(symbol, asOfDate): LegalDocument | null
buildAmendmentChain(documentId, repos): LegalDocument[]
validateLegalReference(ref, repos): ValidationResult
extractArticleText(clauseId, repos): string | null
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts` — canonical base repository
- No other business module imports

---

## Consumers

- `src/knowledge/integration/knowledgeIntegration.ts` (Phase N) — only permitted new consumer

---

## Business Rules Enforced

- Legal documents have `effectiveFrom`; `effectiveTo` may be null (still active)
- Amendment chain: document B amends document A; resolving law requires checking full chain
- `LegalReference` (5 fields) is the legal/domain citation type — distinct from `LegalBasis` (10 fields) in `src/shared/financial/`
- No document is ever deleted; `effectiveTo` closes it

---

## Known Limitations

- TD-15: `workflowState.ts` hardcodes 5 law shorthand constants (L, D, D2, F, T) — low risk until corpus grows
- Prisma repos are stubs until Phase M
- No full-text search until Phase M + PostgreSQL tsvector

---

## Extension Policy

New document types → add `LegalDocumentType` value (string union, not enum — open set).
New domain functions → add to `src/legal/domain/` (does not require unfreezing).
New repositories → new interface in `legalRepositories.ts` → REQUIRES ADR (frozen).
