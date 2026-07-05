# Shared Financial Domain — Phase H.5

Location: `src/shared/financial/`

**Purpose:** Provide strongly-typed, reusable financial domain objects for all modules
that deal with money, budgets, guarantees, retention, or legal citations.
No payment workflow, no UI, no document generation, no AI.

---

## Why This Layer Exists

Payment, Dashboard, Reporting, AI Advisory, and Asset modules all operate on financial
concepts. Without a shared domain:

- Every module would duplicate `Money` as `number` or `bigint` — KI-004 (float precision) stays unsolved
- Legal citations would remain free-text `string[]` — RULE-09 violation persists
- Retention rate, advance rate, and guarantee rate logic would be re-implemented in each module
- Currency handling would diverge between modules

This layer solves all four problems once.

---

## Dependencies

```
src/shared/financial/
  ├── imports from: src/masterdata/ (financialIntegration.ts only)
  │                 src/legal/      (financialIntegration.ts only)
  └── does NOT import from: workflow, approval, contract, acceptance, payment
```

**Dependency diagram:**

```
Payment ──────────┐
Dashboard ────────┤
AI Advisory ──────┼──► src/shared/financial/  ◄── MasterData (bridge)
Reporting ────────┤                            ◄── Legal      (bridge)
Asset ────────────┘
```

---

## Domain Model

### Value Objects

| Name | File | Purpose |
|------|------|---------|
| `Money` | `money.ts` | Immutable value: `{ amount: bigint, currency: CurrencyCode }` |
| `CurrencyCode` | `money.ts` | `'VND' \| 'USD' \| 'EUR' \| 'JPY' \| 'AUD'` |
| `LegalBasis` | `financialFactory.ts` | Structured legal citation (replaces `string[]`) |
| `RetentionPercentage` | `retentionMoney.ts` | Rate + maxDuration + legalBasis |
| `AdvanceRate` | `paymentSchedule.ts` | Rate + maxAmount + guaranteeRequired |
| `FinancialLimit` | `financialCommitment.ts` | maxAmount + scope + legalBasis |

### Entities

| Name | File | Key fields |
|------|------|-----------|
| `FiscalYear` | `budgetAllocation.ts` | year, startDate, endDate |
| `AnnualBudget` | `budgetAllocation.ts` | fiscalYear, fundSourceCode, totalAmount, legalBasis[] |
| `BudgetAllocation` | `budgetAllocation.ts` | totalAmount, committedAmount, reservedAmount, availableAmount |
| `FundingSource` | `fundingSource.ts` | code, type, fiscalYear, totalBudget |
| `FundingCommitment` | `fundingSource.ts` | allocationId, packageId?, amount, status |
| `FundingReservation` | `fundingSource.ts` | allocationId, reservedAmount, purpose, status |
| `FinancialCommitmentAggregate` | `financialCommitment.ts` | totalCommitted, totalReserved, totalReleased |
| `PaymentMilestone` | `paymentSchedule.ts` | code, scheduledDate, dueAmount, actualAmount, status |
| `RetentionMoney` | `retentionMoney.ts` | contractValue, retentionRate, retentionAmount, heldAmount |
| `AdvanceGuarantee` | `guarantee.ts` | guaranteeRate ≤ 30%, ACTIVE\|RELEASED\|FORFEITED\|EXPIRED |
| `PerformanceGuarantee` | `guarantee.ts` | guaranteeRate 3–10% |
| `WarrantyGuarantee` | `guarantee.ts` | guaranteeRate 2–5% |
| `FinancialEvent` | `financialFactory.ts` | type, entityId, amount?, legalBasis? |

---

## ER Diagram

```
BudgetAllocation ──── FundingCommitment[] ──── (packageId → ProcurementPackage)
      │
      └──── FundingReservation[]

Contract ──────────── RetentionMoney
      │
      └──── AdvanceGuarantee
      └──── PerformanceGuarantee
      └──── WarrantyGuarantee
      └──── PaymentMilestone[]
                  (PaymentMilestone.actualAmount is Money)

All entities reference LegalBasis[] (not string[])
```

---

## LegalBasis — Structured Legal Citation

```typescript
interface LegalBasis {
  document:          string;  // "22/2023/QH15", "214/2025/NĐ-CP"
  documentNumber?:   string;
  article?:          string;  // "Điều 22"
  clause?:           string;  // "Khoản 1"
  point?:            string;  // "điểm a"
  appendix?:         string;  // "Phụ lục I"
  effectiveDate?:    string;  // YYYY-MM-DD
  issuingAuthority?: string;  // "Quốc hội", "Chính phủ"
  summary?:          string;
  url?:              string;
}
```

**All future modules (Payment, Dashboard, AI Advisory, Reporting) must use `LegalBasis`
instead of `string[]`.**

The five seed procurement instruments are pre-built as `PROCUREMENT_LEGAL_BASIS`.
Additional laws, decrees, circulars, ministerial guidance, and organizational
regulations can be added without code changes.

---

## Money Value Object

```typescript
// Correct — use Money:
const contractValue: Money = createMoney(2_000_000_000n, 'VND');
const retention = multiplyMoney(contractValue, 0.05); // 100,000,000 VND exactly

// Wrong — never use primitive numbers in business services:
const contractValue: number = 2_000_000_000; // IEEE 754 loses precision at scale
```

`bigint` storage means no rounding errors for any VNĐ amount up to 9 quadrillion.

---

## Guarantee Rate Bounds (per TT 79/2025/TT-BTC, NĐ 214/2025/NĐ-CP)

| Type | Min | Max | Typical |
|------|-----|-----|---------|
| ADVANCE | 1% | 30% | 10% |
| PERFORMANCE | 3% | 10% | 5% |
| WARRANTY | 2% | 5% | 3% |

---

## Financial Events

Domain events (no event bus — plain objects):

```
FUNDING_ALLOCATED   — budget allocated to a fund source
FUNDING_RESERVED    — amount reserved for future use
BUDGET_COMMITTED    — funds committed to a package
BUDGET_RELEASED     — previously committed funds released
GUARANTEE_ISSUED    — bank guarantee created
GUARANTEE_EXPIRED   — guarantee expired without action
GUARANTEE_RELEASED  — guarantee returned to contractor
GUARANTEE_FORFEITED — guarantee called by procuring entity
RETENTION_CREATED   — retention money withheld from payment
RETENTION_RELEASED  — retention money returned
MILESTONE_PAID      — payment milestone marked as paid
ADVANCE_PAID        — advance payment disbursed
```

---

## API Reference (key functions)

| Function | File | Description |
|----------|------|-------------|
| `createMoney(amount, currency)` | money.ts | Create Money value object |
| `addMoney(a, b)` | money.ts | Add two Money values (same currency) |
| `subtractMoney(a, b)` | money.ts | Subtract (throws if result negative) |
| `multiplyMoney(m, factor)` | money.ts | Multiply by scalar |
| `compareMoney(a, b)` | money.ts | Returns -1 \| 0 \| 1 |
| `sumMoney(items, currency)` | money.ts | Reduce array to total |
| `validateCurrency(code)` | currency.ts | Throws if unsupported |
| `createFiscalYear(year)` | budgetAllocation.ts | FiscalYear value object |
| `commitFromAllocation(a, amount)` | budgetAllocation.ts | Immutable — returns new allocation |
| `reserveFromAllocation(a, amount)` | budgetAllocation.ts | Immutable — returns new allocation |
| `releaseFromAllocation(a, amount)` | budgetAllocation.ts | Immutable — returns new allocation |
| `createGuarantee(params)` | guarantee.ts | Creates typed guarantee (validates rate) |
| `releaseGuarantee(g)` | guarantee.ts | ACTIVE → RELEASED |
| `forfeitGuarantee(g)` | guarantee.ts | ACTIVE → FORFEITED |
| `createRetentionMoney(params)` | retentionMoney.ts | Calculates retention from rate |
| `releaseRetention(r, amount)` | retentionMoney.ts | Partial or full release |
| `createLegalBasis(params)` | financialFactory.ts | Structured legal citation |
| `createFinancialEvent(params)` | financialFactory.ts | Domain event |
| `fundSourceToFinancial(...)` | financialIntegration.ts | MasterData → FundingSource bridge |
| `legalBasisToSchemaRef(basis)` | financialIntegration.ts | LegalBasis → LegalReference bridge |
| `mergeLegalBasis(defaults, extra)` | financialIntegration.ts | Dedup merge of legal bases |

---

## Migration Guide

Modules that currently use `string[]` for legal citations should migrate to `LegalBasis[]`:

```typescript
// Before (frozen modules — do not change):
readonly legalBasis: string[];

// After (new modules — Payment, Dashboard, etc.):
readonly legalBasis: readonly LegalBasis[];

// Bridge for reading frozen module data:
const bases = acceptanceRequest.legalBasis.map(doc => createLegalBasis({ document: doc }));
```

Modules using `number` for money should migrate to `Money`:

```typescript
// Before:
readonly contractValue: number;

// After:
readonly contractValue: Money;

// At the domain boundary (convert incoming number to Money):
const value = createMoney(contractValueVND, 'VND');
```

---

## Prisma Schema Additions

See Phase H.5 Prisma models (to be added with Payment Module):
- Shared financial domain is pure TypeScript — no Prisma models until Payment adds them.
- Prisma's `Float` → `Decimal` migration (KI-004) should happen alongside Payment module.

---

## Acceptance Criteria

1. `Money` uses `bigint` — no IEEE 754 rounding at any VNĐ scale.
2. `createMoney(-1, 'VND')` throws `FinancialError` with code `NEGATIVE_AMOUNT`.
3. `addMoney(vnd, usd)` throws `FinancialError` with code `CURRENCY_MISMATCH`.
4. `subtractMoney(a, b)` where `b > a` throws `NEGATIVE_AMOUNT`.
5. `multiplyMoney(m, 0.05)` on 200M VND = exactly 10,000,000n.
6. `createLegalBasis({ document: '' })` throws.
7. `PROCUREMENT_LEGAL_BASIS` has 5 seeds; additional laws can be appended without code changes.
8. `validateCurrency('GBP')` throws `INVALID_CURRENCY`.
9. `validateGuaranteeRate('PERFORMANCE', 0.02)` throws `INVALID_GUARANTEE`.
10. `validateGuaranteeRate('ADVANCE', 0.30)` does not throw.
11. `createRetentionMoney(…, rate=0.20)` throws `INVALID_RETENTION`.
12. `releaseRetention(r, amount > held)` throws `INSUFFICIENT_BUDGET`.
13. `commitFromAllocation(a, amount > available)` throws `INSUFFICIENT_BUDGET`.
14. `reserveFromAllocation(a, zeroMoney)` throws.
15. All value objects are immutable — operations return new instances.
16. `financialIntegration.ts` is the only file that imports from `masterdata/` or `legal/`.
17. 312 unit tests pass; no frozen module is modified.
