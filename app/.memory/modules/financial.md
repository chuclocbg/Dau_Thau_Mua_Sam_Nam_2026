# Module: Shared Financial Domain

**Status:** FROZEN (v1.1, 2026-07-03)
**Location:** `src/shared/financial/`
**Tests:** 312

---

## Purpose

Pure value-object and pure-function layer for financial concepts shared across all modules.
No repositories — this module owns no persistence. No Prisma imports.
Provides: Money, LegalBasis, Guarantee, Retention, PaymentSchedule.

---

## Files

- `financialTypes.ts` — all financial type definitions
- `financialFactory.ts` — factory functions for creating financial objects
- `financialValidation.ts` — validation rules
- `financialIntegration.ts` — bridge: financial ↔ masterdata, legal

---

## Public API (key types)

```typescript
// Money — canonical monetary value (NEVER float)
Money { amount: bigint, currency: CurrencyCode }  // bigint = VNĐ integer

// LegalBasis — canonical structured citation (RULE-09, not string[])
LegalBasis {
  documentSymbol: string      // '22/2023/QH15'
  articleRef?: string         // 'Điều 15'
  clauseRef?: string          // 'Khoản 2'
  quotedText?: string         // provision text
  effectiveFrom: string       // ISO date
  effectiveTo?: string
  issuingBody?: string
  documentType?: string
  legalHierarchyLevel?: number // 1-14, lower = higher authority
}

// Guarantee types
BidSecurityGuarantee   { amount: Money, validUntil, formType, issuer, legalBasis: LegalBasis[] }
PerformanceGuarantee   { amount: Money, validUntil, formType, issuer, legalBasis: LegalBasis[] }
AdvancePaymentGuarantee { amount: Money, validUntil, legalBasis: LegalBasis[] }

// Retention
RetentionSchedule { rate: number, amount: Money, releaseConditions, legalBasis: LegalBasis[] }

// Payment schedule
PaymentSchedule { milestones: PaymentMilestone[], totalValue: Money, legalBasis: LegalBasis[] }
PaymentMilestone { id, description, triggerEvent, value: Money, dueDate?, conditions }

// Factory functions
createMoney(amount: bigint, currency?): Money
createLegalBasis(params): LegalBasis
PROCUREMENT_LEGAL_BASIS: LegalBasis[]   // standard 5-instrument basis
```

---

## Dependencies

- `src/masterdata/masterdataTypes.ts` (CurrencyCode)
- `src/legal/legalSchema.ts` (LegalReference — distinct from LegalBasis)
- No other business module imports

---

## Consumers

All modules that deal with money or legal citations import from here.
`paymentIntegration.ts` is the primary consumer for financial bridge operations.

---

## Critical Design Decisions

- **ADR-004:** `Money.amount` is `bigint`. No floats, no Decimal.
- **ADR-005:** `LegalBasis` is the structured citation type for all financial + business rules.
- **ADR-006:** No repositories in this module — it is a pure value-object library.
- `LegalBasis` (10 fields) is distinct from `LegalReference` in `src/legal/legalSchema.ts` (5 fields). Both exist with different purposes.

---

## PROCUREMENT_LEGAL_BASIS (standard citations)

The 5-instrument standard basis used by all procurement operations:
1. Luật 22/2023/QH15
2. NĐ 214/2025/NĐ-CP
3. NĐ 104/2026/NĐ-CP
4. TT 79/2025/TT-BTC (state/ODA funds only)
5. TT 13/2026/TT-BCT (goods/services only)
