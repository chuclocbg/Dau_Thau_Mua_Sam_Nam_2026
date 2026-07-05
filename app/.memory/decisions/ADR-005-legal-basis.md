# ADR-005: LegalBasis[] Structured Citations, Never string[]

**Status:** ACTIVE
**Date:** 2026-07-03 (RULE-09 formalized)
**Affects:** All modules with legal citations

---

## Problem

Multiple modules need to cite which legal instruments justify a business decision
(e.g., "advance payment approved under Article 15 of TT 79/2025/TT-BTC").

Early implementations used `string[]` like `['TT 79/2025/TT-BTC', 'Điều 15']`.
This creates:
- Unstructured, unparseable data
- No machine-readable traceability
- No effective date tracking
- No authority hierarchy information
- Blocks the Knowledge Platform from resolving citations automatically

## Decision

All legal citations in domain types and business rules use `LegalBasis[]`:

```typescript
interface LegalBasis {
  documentSymbol: string      // '79/2025/TT-BTC'
  articleRef?: string         // 'Điều 15'
  clauseRef?: string          // 'Khoản 2'
  quotedText?: string         // relevant provision text
  effectiveFrom: string       // ISO date
  effectiveTo?: string
  issuingBody?: string
  documentType?: string       // 'TT' | 'ND' | 'LCT' | etc.
  legalHierarchyLevel?: number // 1-14
}
```

`PROCUREMENT_LEGAL_BASIS` in `src/shared/financial/financialFactory.ts` is the standard
5-instrument citation set used as the default for most procurement operations.

## Note on Naming

`LegalBasis` (10 fields, `src/shared/financial/`) is DISTINCT from `LegalReference`
(5 fields, `src/legal/legalSchema.ts`). Both exist with different purposes.
`LegalBasis` is the structured citation for business rules.
`LegalReference` is the lightweight domain pointer.

## Violations

- **TD-01** (CRITICAL): `acceptanceService.ts` uses `string[]` (frozen, tracked)

## Consequences

All new code must use `LegalBasis[]`. The `createLegalBasis()` factory must be used
to construct citations, not raw object literals.
