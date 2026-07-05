# Payment Module (Phase I)

Legal-driven payment management for government procurement contracts.

---

## ER Diagram

```
PaymentRequest (central entity)
  ├─ id, requestCode, paymentType, contractId, acceptanceId
  ├─ amount: Money { amount: bigint, currency: CurrencyCode }
  ├─ legalBasis: LegalBasis[]   ← resolved from rule engine
  ├─ resolvedRuleId: string     ← PRINCIPLE 8: traceability
  ├─ status: PaymentStatus
  └─ department, requestedBy, requestedAt, notes

PaymentHistoryEntry (append-only audit)
  ├─ requestId → PaymentRequest
  ├─ action: PaymentAction
  ├─ performedBy, performedAt
  └─ fromStatus, toStatus, notes

TreasurySubmission (KBNN control)
  ├─ requestId → PaymentRequest
  ├─ submissionCode, submittedBy, submittedAt
  ├─ treasuryBranch, status: TreasuryStatus
  ├─ approvedAt, rejectedAt, rejectReason

Payment (actual disbursement)
  ├─ requestId → PaymentRequest
  ├─ paymentNumber, amount, paidAt
  └─ treasuryRef

PaymentLegalRule (rule engine data)
  ├─ ruleId, ruleType: PaymentRuleType
  ├─ legalReferences: LegalBasis[]
  ├─ effectiveFrom, effectiveTo, supersededBy
  ├─ applicablePackageTypes[], applicableFundingSources[], applicableAuthorities[]
  ├─ numericParams: Record<string, number>   ← ALL dynamic values
  └─ conditions: PaymentRuleCondition[], priority
```

---

## State Machine (PaymentRequest)

```
        ┌─────────────────────────────────────────┐
        │                                         │
  DRAFT ──► PENDING_APPROVAL ──► APPROVED ──► SUBMITTED_TREASURY
   │              │                   │               │
   │              │                   │     ┌─────────┤
   │              ▼                   ▼     ▼         ▼
   └────────► REJECTED           SUSPENDED  TREASURY_APPROVED ──► PAID
                                   │               │
                                   ▼               ▼
                              CANCELLED     TREASURY_REJECTED
```

Terminal states: `PAID`, `CANCELLED`, `REJECTED`, `TREASURY_REJECTED`

---

## Sequence Diagram — Standard ADVANCE payment (STATE fund)

```
User          PaymentService    RuleEngine         TreasuryService    KBNN
 │                │                 │                    │              │
 ├─createAdvance─►│                 │                    │              │
 │                ├─resolveRule────►│                    │              │
 │                │◄─ maxRate=0.30 ─┤                    │              │
 │                ├─validate rate   │                    │              │
 │                ├─createPaymentRequest (DRAFT)         │              │
 │◄─AdvanceResult─┤                 │                    │              │
 │                │                 │                    │              │
 ├─submit────────►│                 │                    │              │
 │                ├─DRAFT→PENDING_APPROVAL                │              │
 ├─approve───────►│                 │                    │              │
 │                ├─PENDING→APPROVED                     │              │
 ├─submitTreasury─────────────────────────────────────►  │              │
 │                                                       ├─SUBMITTED───►│
 │                                                       │◄─ approve ───┤
 │                                                       ├─TREASURY_APPROVED
 ├─markPaid──────►│                 │                    │              │
 │                ├─TREASURY_APPROVED→PAID               │              │
```

---

## Repository Interfaces

| Interface | Key methods |
|---|---|
| `IPaymentRequestRepository` | findByContractId, findByAcceptanceId, findByStatus, findByDepartment, findByType |
| `IPaymentRepository` | findByRequestId |
| `IPaymentInstallmentRepository` | findByRequestId |
| `ITreasurySubmissionRepository` | findByRequestId |
| `IPaymentHistoryRepository` | findByRequestId (sorted by performedAt) |
| `IPaymentDocumentRepository` | findByRequestId |

All extend `IBaseRepository<T>`: create, update, delete, findById, findAll, count.

Memory implementations: `MemoryPaymentRequestRepository`, `MemoryPaymentRepository`, etc.

---

## Service API Reference

### `paymentService.ts`

```typescript
createPaymentRequest(repo, historyRepo, params, resolvedRuleId?)
submitPaymentRequest(repo, historyRepo, id, performedBy)
approvePaymentRequest(repo, historyRepo, id, performedBy, notes?)
rejectPaymentRequest(repo, historyRepo, id, performedBy, reason)
suspendPaymentRequest(repo, historyRepo, id, performedBy, reason)
resumePaymentRequest(repo, historyRepo, id, performedBy)
cancelPaymentRequest(repo, historyRepo, id, performedBy, reason)
markPaymentPaid(requestRepo, paymentRepo, historyRepo, requestId, performedBy, params)
addPaymentNote(repo, historyRepo, id, performedBy, note)
getPaymentsByStatus(repo, status)
getPaymentsByType(repo, type)
```

### `paymentAdvanceService.ts`

```typescript
createAdvancePaymentRequest(repo, historyRepo, params: AdvancePaymentParams)
calculateMaxAdvanceAmount(contractValue, packageType, fundSource, asOfDate, rules?)
isAdvanceGuaranteeRequired(packageType, fundSource, asOfDate, rules?)
```

`AdvancePaymentParams` requires `advanceRate` (decimal). Throws `ADVANCE_RATE_EXCEEDED` if rate > rule maxRate.

### `paymentRetentionService.ts`

```typescript
createRetentionPaymentRequest(repo, historyRepo, params: RetentionPaymentParams)
createWarrantyReleaseRequest(repo, historyRepo, params)
calculateRetainedAmount(contractValue, packageType, fundSource, asOfDate, rules?)
  // returns { amount: Money, rate: number, ruleId: string | null }
getMaxRetentionDuration(packageType, fundSource, asOfDate, rules?)
```

`retentionRate` optional — defaults to `defaultRate` from rule.

### `paymentTreasuryService.ts`

```typescript
submitToTreasury(requestRepo, treasuryRepo, historyRepo, params, options?)
  // returns { submission: TreasurySubmission, updatedRequest: PaymentRequest }
approveTreasurySubmission(requestRepo, treasuryRepo, historyRepo, submissionId, approvedBy)
  // returns { submission, updatedRequest }
rejectTreasurySubmission(requestRepo, treasuryRepo, historyRepo, submissionId, rejectedBy, reason)
  // returns { submission, updatedRequest }
checkTreasuryRequired(fundSource, packageType, asOfDate, rules?)
  // returns { required: boolean, ruleId: string | null, legalBasis: LegalBasis[] }
```

### `paymentHistoryService.ts`

```typescript
recordPaymentAction(repo, requestId, action, performedBy, options?)
getPaymentHistory(repo, requestId)
hasActionOccurred(entries, action)
getLastStatus(entries)
```

### `paymentIntegration.ts` (bridge — only file importing from frozen modules)

```typescript
contractToContractMoney(contract: Contract): Money
  // Contract.contractValue is number → converts to bigint

buildPaymentRuleContextFromContract(packageType, fundSource, asOfDate?)

acceptanceToPaymentBaseParams(acceptance, amount, requestedBy, department)
  // AcceptanceRequest.legalBasis: string[] → structured LegalBasis[]

buildPaymentLegalBasisFromAcceptance(acceptance)
  // merges acceptance.legalBasis strings with PROCUREMENT_LEGAL_BASIS

resolveAdvanceRuleForContext(packageType, fundSource, asOfDate?)
buildExtendedPaymentLegalBasis(additional)
```

---

## Rule Engine

### PaymentRuleType

`ADVANCE_RATE | RETENTION_RATE | GUARANTEE_REQUIREMENT | PAYMENT_DEADLINE | TREASURY_THRESHOLD | BUDGET_COMMITMENT_LIMIT`

### resolvePaymentRule

```typescript
resolvePaymentRule(ruleType, ctx: PaymentRuleContext, rules)
// returns PaymentRuleResolution { resolved, rule, params, legalBasis }
```

Selects the highest-priority rule (`lowest priority number`) that:
- `asOfDate >= effectiveFrom` and `asOfDate < effectiveTo` (if set)
- `!supersededBy`
- `applicablePackageTypes` empty OR contains `ctx.packageType`
- `applicableFundingSources` empty OR contains `ctx.fundSource`
- All `conditions` pass

### Bootstrap Rules (data, not code)

| Rule ID | Type | Fund | maxRate/maxDays |
|---|---|---|---|
| PR-PAY-ADV-001 | ADVANCE_RATE | STATE, ODA | 30% |
| PR-PAY-ADV-002 | ADVANCE_RATE | ENTERPRISE, PPP | 15% |
| PR-PAY-RET-001 | RETENTION_RATE | All | 10%, default 5%, 24mo |
| PR-PAY-GUAR-001 | GUARANTEE_REQUIREMENT | All | 3–10% performance |
| PR-PAY-GUAR-002 | GUARANTEE_REQUIREMENT | All | ≤5% warranty |
| PR-PAY-DL-001 | PAYMENT_DEADLINE | STATE, ODA | 30 days |
| PR-PAY-DL-002 | PAYMENT_DEADLINE | ENTERPRISE, PPP | 45 days |
| PR-PAY-TREAS-001 | TREASURY_THRESHOLD | STATE, ODA | required=1 |

### Extending with new laws (ZERO code changes)

```typescript
const newDecree = {
  ruleId: 'PR-PAY-ADV-003',
  ruleType: 'ADVANCE_RATE',
  legalReferences: [createLegalBasis({ document: 'NĐ-99/2027/NĐ-CP', ... })],
  effectiveFrom: '2027-01-01',
  applicableFundingSources: ['STATE'],
  numericParams: { maxRate: 0.25, ... },
  conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE'] }],
  priority: 5,
};
const extendedRules = buildPaymentRuleRegistry([newDecree]);
```

---

## Validation Rules

All validation goes through `resolvePaymentRule`. No hardcoded values in business logic.

| Function | Resolves |
|---|---|
| `validateAdvanceAmount` | ADVANCE_RATE → `maxRate` |
| `validateRetentionRate` | RETENTION_RATE → `maxRate` |
| `validateGuaranteeRate` | GUARANTEE_REQUIREMENT → `minRate`, `maxRate` |
| `validatePaymentDeadline` | PAYMENT_DEADLINE → `maxDaysAfterAcceptance` |
| `requiresTreasurySubmission` | TREASURY_THRESHOLD → `required` |
| `validateStatusTransition` | static state machine (no rule needed) |

---

## Legal Integration (PRINCIPLE 8 — Full Traceability)

- Every `PaymentRequest` stores `resolvedRuleId` — which rule governed its creation
- Every `createAdvancePaymentRequest` and `createRetentionPaymentRequest` returns `resolvedRuleId`
- `PaymentHistoryEntry` records `fromStatus → toStatus` with `performedBy` and `performedAt`
- `PaymentValidationResult` returns `resolvedRule` and `legalBasis[]`

---

## Acceptance Criteria

- [x] All payment rules resolved dynamically — no hardcoded percentages
- [x] New laws require only data changes (`buildPaymentRuleRegistry`)
- [x] `Money` uses `bigint` throughout — no float arithmetic
- [x] History entries append-only (PRINCIPLE 3)
- [x] Every decision traceable via `resolvedRuleId` (PRINCIPLE 8)
- [x] Integration bridge pattern — paymentIntegration.ts is only file importing frozen modules
- [x] 355 unit tests pass
- [x] Bootstrap rules cover 5 legal instruments (extensible to unlimited)

---

## Migration Guide

This module introduces no schema migrations (in-memory only). For Prisma integration:

1. Add tables: `PaymentRequest`, `Payment`, `PaymentInstallment`, `TreasurySubmission`, `PaymentHistoryEntry`, `PaymentDocument`
2. Implement Prisma versions of each `IPaymentXxxRepository` interface
3. `PaymentRequest.amount` stores as BIGINT + VARCHAR(3) currency, never FLOAT
4. `PaymentLegalRule` stored in a `legal_rule` table or seeded JSON (separate from business tables)
5. Swap Memory repositories for Prisma repositories — zero service code changes needed
