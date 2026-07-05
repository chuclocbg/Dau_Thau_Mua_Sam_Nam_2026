# Module: Contract Module

**Status:** FROZEN (v1.1, 2026-07-03)
**Location:** `src/contract/`
**Tests:** 312

---

## Purpose

Manages procurement contracts from DRAFT through SIGNED, EFFECTIVE, COMPLETED, and TERMINATED.
A contract is created after a package is awarded and an approval decision confirms the award.

---

## Status Machine

```
DRAFT → UNDER_REVIEW → SIGNED → EFFECTIVE → COMPLETED
                     ↘ REJECTED (back to DRAFT)
EFFECTIVE → TERMINATED (at any point)
```

---

## Public API

```typescript
Contract {
  id, contractNumber, packageId, approvalRequestId,
  contractorId: string,          // supplier (Phase O will populate this properly)
  subject: string,
  value: Money,
  advancePaymentRate?: number,   // percentage
  retentionRate?: number,        // percentage
  startDate, endDate,
  status: ContractStatus,
  signatoryName: string,
  legalBasis: LegalBasis[],
  terms: ContractTerm[],
  history: ContractHistoryEntry[],
  createdAt, updatedAt
}

// Service functions
createContract(params, approvalId, repos): Promise<Contract>
signContract(contractId, signatoryInfo, repos): Promise<Contract>
activateContract(contractId, repos): Promise<Contract>
terminateContract(contractId, reason, repos): Promise<Contract>
completeContract(contractId, repos): Promise<Contract>
getContractWithHistory(contractId, repos): Promise<ContractWithHistory>
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts`
- `src/shared/financial/financialTypes.ts`
- `src/approval/` (via contractIntegration.ts)
- `src/procurement/workflow/` (via contractIntegration.ts)

---

## Consumers

- `acceptanceIntegration.ts` — acceptance sessions reference a contract

---

## Known Limitations

- `contractorId` is a free string until Phase O (Supplier Registry) ships — no FK validation
- Prisma repo is stub until Phase M
