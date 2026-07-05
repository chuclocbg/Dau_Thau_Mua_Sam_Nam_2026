# Financial Domain Manifest — Phase H.5

Version: 1.0
Status: FROZEN after Phase H.5 completion
Location: `src/shared/financial/`

---

## Purpose

Shared foundational financial domain for all modules that operate on money,
budgets, guarantees, retention, and structured legal citations.
No payment workflow. No UI. No document generation. No accounting engine. No AI.

---

## Entities

| Entity | File | Status |
|--------|------|--------|
| FiscalYear | budgetAllocation.ts | Value object |
| AnnualBudget | budgetAllocation.ts | Entity |
| BudgetAllocation | budgetAllocation.ts | Aggregate root |
| FundingSource | fundingSource.ts | Entity |
| FundingCommitment | fundingSource.ts | Entity |
| FundingReservation | fundingSource.ts | Entity |
| FinancialCommitmentAggregate | financialCommitment.ts | Aggregate |
| FinancialLimit | financialCommitment.ts | Value object |
| PaymentMilestone | paymentSchedule.ts | Entity |
| RetentionMoney | retentionMoney.ts | Entity |
| RetentionPercentage | retentionMoney.ts | Value object |
| AdvanceGuarantee | guarantee.ts | Entity |
| PerformanceGuarantee | guarantee.ts | Entity |
| WarrantyGuarantee | guarantee.ts | Entity |

---

## Value Objects

| Value Object | File | Key invariant |
|-------------|------|---------------|
| Money | money.ts | amount: bigint, currency: CurrencyCode — never negative |
| CurrencyCode | money.ts | One of VND/USD/EUR/JPY/AUD |
| LegalBasis | financialFactory.ts | document is required; all other fields optional |
| AdvanceRate | paymentSchedule.ts | rate 0–0.30; guaranteeRequired: boolean |
| ExchangeRate | currency.ts | Reserved — not used in calculations yet |

---

## Repositories

None. Financial domain is stateless value-object and pure-function layer.
Persistence is the responsibility of each consuming module (Payment, etc.).

---

## Services (pure functions)

| File | Key functions |
|------|---------------|
| money.ts | createMoney, addMoney, subtractMoney, multiplyMoney, compareMoney, sumMoney, formatMoney |
| currency.ts | validateCurrency, getCurrencyMeta, isVND |
| budgetAllocation.ts | createFiscalYear, calculateAvailableAmount, commitFromAllocation, reserveFromAllocation, releaseFromAllocation |
| fundingSource.ts | createFundingCommitment, releaseFundingCommitment, createFundingReservation, consumeFundingReservation, cancelFundingReservation |
| financialCommitment.ts | buildCommitmentAggregate, checkFinancialLimit |
| paymentSchedule.ts | createPaymentMilestone, markMilestoneDue, markMilestonePaid, markMilestoneOverdue, cancelMilestone, calculateScheduleTotal, calculatePaidTotal |
| retentionMoney.ts | validateRetentionRate, calculateRetentionAmount, createRetentionMoney, releaseRetention |
| guarantee.ts | validateGuaranteeRate, createGuarantee, releaseGuarantee, forfeitGuarantee, expireGuarantee, isGuaranteeExpired, daysUntilExpiry |
| financialValidation.ts | validateMoney, assertValidMoney, validateBudgetAllocation, validateFundingCommitment, validateGuaranteeRateResult, validateRetentionRateResult, validatePaymentMilestone, validateAdvanceRate, validateFiscalYear, validateLegalBasis, validateLegalBasisArray |
| financialFactory.ts | createLegalBasis, createFinancialEvent, buildBudgetAllocationCode, buildGuaranteeNumber, vnd, usdCents |
| financialIntegration.ts | fundSourceToFinancial, budgetYearToMoney, legalBasisToSchemaRef, schemaRefToLegalBasis, formatLegalBasis, getDefaultProcurementLegalBasis, mergeLegalBasis |

---

## Factories

| Function | Output |
|----------|--------|
| `vnd(amount)` | `Money` in VND |
| `usdCents(amount)` | `Money` in USD (cents) |
| `createLegalBasis(params)` | `LegalBasis` |
| `createFinancialEvent(params)` | `FinancialEvent` |
| `buildBudgetAllocationCode(...)` | `"BA/{src}/{year}/{seq:04d}"` |
| `buildGuaranteeNumber(...)` | `"BL-TU\|TH\|BH/{code}/{seq:03d}"` |

---

## Events

All domain events. No event bus. No side effects.

```
FUNDING_ALLOCATED    FUNDING_RESERVED    BUDGET_COMMITTED
BUDGET_RELEASED      GUARANTEE_ISSUED    GUARANTEE_EXPIRED
GUARANTEE_RELEASED   GUARANTEE_FORFEITED RETENTION_CREATED
RETENTION_RELEASED   MILESTONE_PAID      ADVANCE_PAID
```

---

## Dependencies

### Allowed inbound (modules that may import from shared/financial):
- Payment Module (Phase I)
- Dashboard / Reporting (future)
- AI Advisory Layer (future)
- Asset Module (future)

### Outbound (what shared/financial imports):
- `src/masterdata/masterdataTypes.ts` — via `financialIntegration.ts` only
- `src/legal/legalSchema.ts` — via `financialIntegration.ts` only
- `src/shared/repository/IBaseRepository.ts` — (not imported; no repos in this layer)

### FORBIDDEN (must never import from shared/financial):
- src/procurement/workflow/
- src/approval/
- src/contract/
- src/acceptance/

---

## Legal Basis

The five seed procurement instruments:
- Luật 22/2023/QH15 (Luật Đấu thầu)
- NĐ 214/2025/NĐ-CP
- NĐ 104/2026/NĐ-CP
- TT 13/2026/TT-BCT
- TT 79/2025/TT-BTC

Additional instruments can be added to `PROCUREMENT_LEGAL_BASIS` or passed as extra
`LegalBasis[]` to any service — no code changes required.

---

## Frozen APIs (do not break after Phase H.5)

These function signatures are the contract for consuming modules:

```typescript
createMoney(amount: number | bigint, currency: CurrencyCode): Money
addMoney(a: Money, b: Money): Money
subtractMoney(a: Money, b: Money): Money
multiplyMoney(m: Money, factor: number): Money
createLegalBasis(params: { document: string; ... }): LegalBasis
PROCUREMENT_LEGAL_BASIS: readonly LegalBasis[]
createGuarantee<T extends GuaranteeType>(params): BaseGuarantee & { type: T }
createRetentionMoney(params): RetentionMoney
releaseRetention(r: RetentionMoney, amount: Money): RetentionMoney
```

---

## Known Limitations

1. `ExchangeRate` type is reserved — no conversion functions implemented.
   Multi-currency arithmetic is not supported in Phase H.5.
   Add when first ODA contract with USD disbursement is modelled.

2. `AnnualBudget` has no repository — it is a value object used by the Payment module.
   The Payment module owns AnnualBudget persistence.

3. `multiplyMoney` uses `Math.round(Number(bigint) × factor)` — safe for VNĐ values
   below ~9 quadrillion. For exact fractional cents in USD/EUR, convert to full-precision
   decimal arithmetic when first needed.

---

## Future Consumers

| Module | What it needs |
|--------|---------------|
| Payment (Phase I) | Money, BudgetAllocation, FundingCommitment, PaymentMilestone, AdvanceRate, LegalBasis |
| Acceptance (existing) | Migration: replace legalBasis: string[] with LegalBasis[] in new integrations |
| Dashboard | Money for aggregation, FinancialEvent for timeline |
| AI Advisory | LegalBasis for structured citations in recommendations |
| Asset Module | RetentionMoney, WarrantyGuarantee |
| Reporting | Money, BudgetAllocation, FinancialEvent |
