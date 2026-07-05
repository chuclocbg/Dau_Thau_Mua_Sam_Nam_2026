# Module: Payment Module

**Status:** FROZEN (v1.1, 2026-07-03)
**Location:** `src/payment/`
**Tests:** 355

---

## Purpose

Manages payment requests from initial claim through treasury submission.
All payment validation rules (advance rates, retention rates, deadlines) are data-driven
from `PaymentLegalRule` objects — zero hardcoded percentage constants in business logic.

---

## Public API

```typescript
PaymentRequest {
  id, contractId, acceptanceId,
  type: PaymentType,            // ADVANCE | PROGRESS | FINAL | RETENTION_RELEASE
  amount: Money,
  requestedBy: string,
  status: PaymentStatus,        // DRAFT | SUBMITTED | APPROVED | REJECTED | PROCESSING | COMPLETED
  legalBasis: LegalBasis[],
  validationResults: PaymentValidationResult[],
  schedule?: PaymentSchedule,
  treasuryRef?: string,
  createdAt, updatedAt
}

// Service functions
createPaymentRequest(contractId, type, amount, repos): Promise<PaymentRequest>
validatePaymentRequest(request, rules, repos): Promise<ValidationResult>
submitPaymentRequest(requestId, repos): Promise<PaymentRequest>
approvePayment(requestId, approver, repos): Promise<PaymentRequest>
submitToTreasury(requestId, repos): Promise<PaymentRequest>
resolvePaymentRule(type, package, rules): PaymentLegalRule
```

---

## Dynamic Rule Engine

Rules are loaded from `paymentRuleRegistry.ts` (data, not logic):
```typescript
PaymentLegalRule {
  ruleCode: string,
  ruleType: PaymentRuleType,
  numericParams: Record<string, number>,  // e.g. { maxAdvanceRate: 30, retentionRate: 5 }
  applicableTo: { packageTypes?, fundSources? },
  legalBasis: LegalBasis[],
  effectiveFrom: string,
  effectiveTo?: string
}
```

New circular → add new rule with `effectiveFrom`; close old rule with `effectiveTo`. Zero code change.

---

## Dependencies

- `src/acceptance/` (via paymentIntegration.ts)
- `src/contract/` (via paymentIntegration.ts)
- `src/shared/financial/` (Money, LegalBasis, PaymentSchedule, Guarantee types)

---

## Consumers

- Phase X AI Advisory Layer (read-only payment status)
- Phase U Final Settlement (direct dependency)

---

## Known Technical Debt

- **TD-12 (MEDIUM):** `buildPaymentLegalBasisFromAcceptance` crashes with TypeError when `acceptance.legalBasis` is undefined. Add null guard in `paymentIntegration.ts`.
- Prisma repo is stub until Phase M
