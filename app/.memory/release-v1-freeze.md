# Architecture Freeze — Release Baseline v1.1

**Date:** 2026-07-03
**Triggered by:** Phase H.5 Architecture Freeze Review
**Status:** SIGNED OFF — READY FOR PHASE I

---

## Architecture Version

| Property | Value |
|----------|-------|
| Version | 1.1 |
| Previous | 1.0 (Phase E.5, 2026-07-02) |
| Change | RULE-09 fix in paymentSchedule.ts |
| Score | 8.5 / 10 |
| TypeScript | strict mode |
| Test runner | Vitest 4.x |
| Module system | ESM (`"type": "module"`) |

---

## Completed and Frozen Modules

| # | Phase | Module | Directory | Tests | Frozen |
|---|-------|--------|-----------|-------|--------|
| 1 | A1 | Legal Foundation + Schema + Domain Services + Importer | `src/legal/`, `src/agents/` | ~351 | YES |
| 2 | B | Workflow Engine | `src/procurement/workflow/` | ~156 | YES |
| 3 | C | Master Data Module | `src/masterdata/` | ~234 | YES |
| 4 | D | Procurement Package | `src/procurement/package/` | ~273 | YES |
| 5 | E | Procurement Planning | `src/procurement/planning/` | ~312 | YES |
| 6 | E.5 | Architecture Freeze + Constitution + ADRs | `.memory/`, `docs/adr/`, `PROJECT_CONSTITUTION.md` | 0 | YES |
| 7 | F | Approval Module | `src/approval/` | 312 | YES |
| 8 | G | Contract Module | `src/contract/` | 312 | YES |
| 9 | H | Acceptance Module | `src/acceptance/` | 312 | YES |
| 10 | H.5 | Shared Financial Domain | `src/shared/financial/` | 312 | YES |

**Cumulative: ~11,899 tests**

---

## Frozen APIs (Public Exports)

### src/shared/financial/money.ts
- `CurrencyCode` type
- `Money` interface `{ amount: bigint, currency: CurrencyCode }`
- `FinancialError` class + `FinancialErrorCode` type
- `createMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, `compareMoney`, `sumMoney`, `formatMoney`
- `zeroMoney`, `isPositiveMoney`, `isZeroMoney`

### src/shared/financial/currency.ts
- `SUPPORTED_CURRENCIES`, `CurrencyMeta`, `ExchangeRate`
- `validateCurrency`, `getCurrencyMeta`

### src/shared/financial/budgetAllocation.ts
- `FiscalYear`, `BudgetAllocation`
- `createFiscalYear`, `calculateAvailableAmount`, `commitFromAllocation`, `reserveFromAllocation`, `releaseFromAllocation`

### src/shared/financial/fundingSource.ts
- `FundingSourceType`, `CommitmentStatus`, `ReservationStatus`
- `FundingCommitment`, `FundingReservation`
- `createFundingCommitment`, `releaseFundingCommitment`
- `createFundingReservation`, `consumeFundingReservation`, `cancelFundingReservation`

### src/shared/financial/financialCommitment.ts
- `FinancialCommitmentAggregate`, `FinancialLimit`
- `buildCommitmentAggregate`, `checkFinancialLimit`

### src/shared/financial/paymentSchedule.ts
- `PaymentMilestoneStatus`, `PAYMENT_MILESTONE_STATUSES`
- `PaymentMilestone`
- `AdvanceRate { rate, maxAmount?, guaranteeRequired, legalBasis: LegalBasis }` ← v1.1 fix
- `DEFAULT_ADVANCE_RATE` (30%, legalBasis = TT 79/2025 Điều 15)
- `createPaymentMilestone`, `markMilestoneDue`, `markMilestonePaid`, `markMilestoneOverdue`, `cancelMilestone`
- `calculateScheduleTotal`, `calculatePaidTotal`

### src/shared/financial/retentionMoney.ts
- `RetentionStatus`, `RetentionPercentage`, `RetentionMoney`
- `MAX_RETENTION_RATE` (0.10), `DEFAULT_RETENTION_RATE` (5%, legalBasis = NĐ 214/2025 Điều 18)
- `calculateRetentionAmount`, `createRetentionMoney`, `releaseRetention`

### src/shared/financial/guarantee.ts
- `GuaranteeType`, `GuaranteeStatus`, `BaseGuarantee`
- `GUARANTEE_RATE_BOUNDS` (ADVANCE 1–30%, PERFORMANCE 3–10%, WARRANTY 2–5%)
- `createGuarantee`, `releaseGuarantee`, `forfeitGuarantee`, `expireGuarantee`
- `isGuaranteeExpired`, `daysUntilExpiry`

### src/shared/financial/financialValidation.ts
- `ValidationResult`
- `validateMoney`, `assertValidMoney`, `validateBudgetAllocation`, `validateFundingCommitment`
- `validateGuaranteeRateResult`, `validateRetentionRateResult`, `validatePaymentMilestone`
- `MAX_ADVANCE_RATE` (0.30), `validateAdvanceRate`, `validateFiscalYear`
- `validateLegalBasis`, `validateLegalBasisArray`

### src/shared/financial/financialFactory.ts
- `LegalBasis` interface (10 fields, document required)
- `createLegalBasis`, `PROCUREMENT_LEGAL_BASIS` (5 seed instruments)
- `FinancialEventType`, `FinancialEvent`
- `createFinancialEvent`, `buildBudgetAllocationCode`, `buildGuaranteeNumber`
- `vnd`, `usdCents` (shorthand constructors)

### src/shared/financial/financialIntegration.ts
- `fundSourceToFinancial`, `budgetYearToMoney`
- `legalBasisToSchemaRef`, `schemaRefToLegalBasis`, `formatLegalBasis`
- `getDefaultProcurementLegalBasis`, `mergeLegalBasis`

---

## Dependency Graph (Shared Financial Domain)

```
                    money.ts (leaf)
                       ↑
          ┌────────────┼────────────────────┐
      currency.ts   paymentSchedule.ts    guarantee.ts
                       ↑                    ↑
               financialFactory.ts ←── retentionMoney.ts
                       ↑                    ↑
               budgetAllocation.ts    financialCommitment.ts
                       ↑
               fundingSource.ts
                       ↑
               financialValidation.ts (imports from all above)
                       ↑
               financialIntegration.ts (also imports: masterdata, legal)
```

**No circular imports. No layer violations.**

---

## Integration Bridges

| Bridge | Imports from |
|--------|-------------|
| `src/approval/approvalIntegration.ts` | package, planning, workflow, masterdata |
| `src/contract/contractIntegration.ts` | package/packageTypes, workflow/workflowEngine |
| `src/acceptance/acceptanceIntegration.ts` | contract/contractTypes, workflow/workflowEngine |
| `src/shared/financial/financialIntegration.ts` | masterdata/masterdataTypes, legal/legalSchema |

**Rule: Frozen modules NEVER import from bridge files.**

---

## Constitution Compliance (Phase H.5)

| Principle | Status | Notes |
|-----------|--------|-------|
| 1 — Legal Engine only | COMPLIANT | No procurement law logic in shared/financial |
| 2 — Workflow owns state | COMPLIANT | No workflow state in shared/financial |
| 3 — History immutable | COMPLIANT | No history entities; FinancialEvent is value object |
| 4 — Planning precedes Package | N/A | Shared domain has no planning logic |
| 5 — Documents generated | COMPLIANT | No document generation in shared/financial |
| 6 — Master Data owns refs | COMPLIANT | Currency codes are ISO 4217, not business refs; MasterData accessed via bridge |
| 7 — AI no business logic | COMPLIANT | No AI components |
| 8 — Every decision traceable | COMPLIANT | All domain types use LegalBasis; RULE-09 violation fixed |
| 9 — Law versions time-aware | COMPLIANT | LegalBasis has effectiveDate; PROCUREMENT_LEGAL_BASIS includes all 5 effective dates |
| 10 — Correctness over elegance | COMPLIANT | bigint for Money, explicit INSUFFICIENT_BUDGET guard |

---

## Legal Extensibility (PROCUREMENT_LEGAL_BASIS)

5 seed instruments (extensible without code changes):

| Document | Authority | Effective |
|----------|-----------|-----------|
| 22/2023/QH15 | Quốc hội | 2024-01-01 |
| 214/2025/NĐ-CP | Chính phủ | 2025-07-01 |
| 104/2026/NĐ-CP | Chính phủ | 2026-06-01 |
| TT 13/2026/TT-BCT | Bộ Công Thương | 2026-05-01 |
| TT 79/2025/TT-BTC | Bộ Tài chính | 2025-08-01 |

Extension mechanism: `mergeLegalBasis(PROCUREMENT_LEGAL_BASIS, additionalBases)` or spread `[...PROCUREMENT_LEGAL_BASIS, newBasis]`. No code change needed for new laws.

---

## Known Issues (Open)

| ID | Module | Impact | Target |
|----|--------|--------|--------|
| KI-001 | Planning | OPEN_TENDER hardcoded in buildPlanWorkflow | Phase G |
| KI-002 | Planning | ProcurementRequest.legalBasis is string (frozen) | Infrastructure |
| KI-003 | Planning | ProcurementPlan has no workflowId field | Infrastructure |
| KI-004 | Prisma | Float for monetary values (Float → Decimal) | Infrastructure |
| KI-005 | Prisma | String arrays for FK lists (no referential integrity) | Infrastructure |
| KI-006 | Prisma | No indexes on procurement tables | Infrastructure |

---

## Tech Debt

1. **Prisma Float → Decimal** (KI-004): All monetary Prisma fields use `Float`. Must change to `Decimal` before production migration. New financial domain uses `bigint` internally (correct), but persistence layer not yet wired.

2. **ProcurementRequest.legalBasis: string** (KI-002): Frozen module uses free-text string. Must be changed to `LegalBasis[]` before Document Generator reads requests. Breaking change, requires migration.

3. **No Prisma indexes** (KI-006): All procurement status, department, and fiscal year fields are unindexed. Acceptable in spec phase; blocking for production.

4. **ExchangeRate reserved** in currency.ts: `ExchangeRate` interface exists but no conversion functions. Intentional (multi-currency conversion is out of scope until Payment/Reporting); reserved for completeness.

---

## Deferred Items

- Multi-currency conversion (ExchangeRate → full conversion engine)
- LegalBasis `effectiveTo` field (for law version closing per PRINCIPLE 9)
- Prisma Decimal migration
- Prisma junction tables for ID arrays
- AI Advisory module
- Asset module
- Dashboard / Reporting module

---

## Phase I — Payment Module Readiness

**Status: READY FOR PHASE I**

Blockers: NONE

Required inputs available:
- `Money`, `LegalBasis` from `src/shared/financial/` ✅
- `AcceptanceRequest` from `src/acceptance/acceptanceTypes.ts` ✅
- `ContractRecord` from `src/contract/contractTypes.ts` ✅
- `BudgetAllocation`, `FundingCommitment` from `src/shared/financial/` ✅
- `PROCUREMENT_LEGAL_BASIS` from `src/shared/financial/financialFactory.ts` ✅
- `PaymentMilestone`, `DEFAULT_ADVANCE_RATE` from `src/shared/financial/paymentSchedule.ts` ✅

Constraints for Phase I:
1. DO NOT modify any frozen module
2. Use `Money` (bigint) for all monetary amounts — never `number`
3. Use `LegalBasis[]` for legal citations — never `string[]`
4. Use `PaymentMilestone` for milestone-based payment tracking
5. Bridge via `src/payment/paymentIntegration.ts` → acceptance/contract/shared/financial
6. Payment history entries are APPEND-ONLY (PRINCIPLE 3)
7. Pattern: 13 source files, 312 tests (39 per file × 8 files)
