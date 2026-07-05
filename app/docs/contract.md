# Contract Module — Phase G

Legal basis: Luật 22/2023/QH15, NĐ 214/2025, NĐ 104/2026, TT 13/2026/TT-BCT, TT 79/2025/TT-BTC

---

## ER Diagram

```
ProcurementPackage ──── Contract ──────┬── ContractAmendment
                                        ├── ContractMilestone
                                        ├── ContractGuarantee
                                        ├── ContractHistoryEntry
                                        └── ContractAttachment
ApprovalRequest ────────┘ (optional link via approvalId)
WorkflowInstance ───────┘ (optional link via workflowId)
```

---

## Contract Status State Machine

```
DRAFT ──────────────────────────────────────────► TERMINATED
  │                                                    ▲
  ▼                                                    │
SIGNED ─────────────────────────────────────────► TERMINATED
  │                                                    ▲
  ▼                                                    │
EFFECTIVE ◄──────── SUSPENDED ──────────────────► TERMINATED
  │           │
  ▼           └──────────────────► (back to EFFECTIVE)
COMPLETED
```

Allowed transitions:
| From       | To            | Operation        |
|------------|---------------|-----------------|
| DRAFT      | SIGNED        | signContract     |
| SIGNED     | EFFECTIVE     | activateContract |
| EFFECTIVE  | SUSPENDED     | suspendContract  |
| SUSPENDED  | EFFECTIVE     | resumeContract   |
| EFFECTIVE  | COMPLETED     | completeContract |
| DRAFT/SIGNED/EFFECTIVE/SUSPENDED | TERMINATED | terminateContract |

---

## Amendment Status

```
DRAFT ──► APPROVED
  └──────► REJECTED
```

---

## Milestone Status

```
PENDING ──► REACHED
   └──────► DELAYED ──► REACHED
```

---

## Guarantee Status

```
ACTIVE ──► RETURNED
  └──────► FORFEITED
```

---

## Sequence Diagram — Contract Creation Flow

```
Client → contractService.createContract(params)
  → contractValidation.validateRequiredContractFields()
  → contractValidation.validateContractValue()
  → contractValidation.assertUniqueContractNumber() → IContractRepository.findByNumber()
  → IContractRepository.create()
  → contractHistory.recordContractEvent('CREATED')
  ← Contract (DRAFT)
```

---

## Sequence Diagram — Amendment Approval

```
Client → contractAmendment.approveAmendment(amendmentId)
  → IContractAmendmentRepository.findById()
  → IContractAmendmentRepository.update(status: APPROVED, approvedBy, approvedAt)
  → if (valueChange != 0):
      IContractRepository.findById()
      IContractRepository.update(contractValue += valueChange)
  → contractHistory.recordContractEvent('AMENDMENT_APPROVED')
  ← ContractAmendment (APPROVED)
```

---

## API Reference

### contractService

| Function              | Input                                  | Output             | Throws                        |
|-----------------------|----------------------------------------|--------------------|-------------------------------|
| `createContract`      | `CreateContractParams, repos`          | `Contract`         | VALIDATION_FAILED, DUPLICATE_NUMBER, INVALID_VALUE |
| `signContract`        | `contractId, signedBy, signedDate, repos` | `Contract`      | NOT_FOUND, INVALID_STATUS     |
| `activateContract`    | `contractId, activatedBy, effectiveDate, repos` | `Contract` | NOT_FOUND, INVALID_STATUS  |
| `suspendContract`     | `contractId, suspendedBy, reason, repos` | `Contract`       | NOT_FOUND, INVALID_STATUS     |
| `resumeContract`      | `contractId, resumedBy, reason, repos` | `Contract`         | NOT_FOUND, INVALID_STATUS     |
| `completeContract`    | `contractId, completedBy, repos`       | `Contract`         | NOT_FOUND, INVALID_STATUS     |
| `terminateContract`   | `contractId, terminatedBy, reason, repos` | `Contract`      | NOT_FOUND, INVALID_STATUS     |

### contractAmendment

| Function                  | Input                                      | Output              |
|---------------------------|--------------------------------------------|---------------------|
| `createAmendment`         | `contractId, params, createdBy, repos`    | `ContractAmendment` |
| `approveAmendment`        | `amendmentId, approvedBy, repos`          | `ContractAmendment` |
| `rejectAmendment`         | `amendmentId, rejectedBy, reason, repos`  | `ContractAmendment` |
| `getAmendments`           | `contractId, repos`                       | `readonly ContractAmendment[]` |
| `countApprovedAmendments` | `contractId, repos`                       | `number`            |

### contractMilestone

| Function                    | Input                                           | Output                   |
|-----------------------------|-------------------------------------------------|--------------------------|
| `addMilestone`              | `contractId, params, createdBy, repos`         | `ContractMilestone`      |
| `markMilestoneReached`      | `milestoneId, actualDate, actualValue, verifiedBy, repos` | `ContractMilestone` |
| `markMilestoneDelayed`      | `milestoneId, reportedBy, repos`               | `ContractMilestone`      |
| `getMilestones`             | `contractId, repos`                            | `readonly ContractMilestone[]` |
| `calculateCompletionPercent`| `contractId, repos`                            | `number` (0–100)         |

### contractGuarantee

| Function           | Input                                              | Output                  |
|--------------------|----------------------------------------------------|-------------------------|
| `addGuarantee`     | `contractId, params, addedBy, repos`              | `ContractGuarantee`     |
| `returnGuarantee`  | `guaranteeId, returnedBy, returnedDate, repos`    | `ContractGuarantee`     |
| `forfeitGuarantee` | `guaranteeId, forfeitedBy, reason, repos`         | `ContractGuarantee`     |
| `getActiveGuarantees` | `contractId, repos`                            | `readonly ContractGuarantee[]` |
| `getAllGuarantees`  | `contractId, repos`                               | `readonly ContractGuarantee[]` |

### contractIntegration

| Function                       | Input                                   | Output                     |
|--------------------------------|-----------------------------------------|----------------------------|
| `buildContractFromPackage`     | `pkg, winnerCode, winnerName, year, seq` | `CreateContractParams`    |
| `advanceWorkflowOnContractSigned` | `instance, performedBy, notes?`      | `WorkflowInstance`         |
| `advanceWorkflowToImplementation` | `instance, performedBy, notes?`      | `WorkflowInstance`         |
| `buildContractSummary`         | `contractId, repos`                    | `ContractSummary \| null`  |
| `validatePackageForContract`   | `packageId, packageRepo`               | `ProcurementPackage`       |

### contractFactory

| Function                          | Output                        |
|-----------------------------------|-------------------------------|
| `generateContractNumber(year, seq)` | `"HĐ/DTMS/{year}/{seq:04d}"` |
| `generateAmendmentCode(contractNumber, seq)` | `"PLHD/{base}/{seq:02d}"` |
| `buildCreateContractParams(opts)` | `CreateContractParams`        |
| `createMemoryContractRepositories()` | `ContractRepositories`     |
| `createPrismaContractRepositories()` | `ContractRepositories`     |

---

## Validation Rules

| Code | Rule                                              | Source            |
|------|---------------------------------------------------|-------------------|
| V-1  | contractNumber must not be blank                  | All contracts     |
| V-2  | contractValue must be > 0                         | NĐ 214/2025       |
| V-3  | contractNumber must be unique in repository       | Internal          |
| V-4  | winnerCode must not be blank                      | Luật 22/2023      |
| V-5  | packageId must not be blank                       | Internal          |
| V-6  | guarantee.amount > 0                              | NĐ 104/2026       |
| V-7  | guarantee.expiryDate must be after issuedDate     | NĐ 104/2026       |
| V-8  | guarantee.guaranteeNumber must not be blank       | NĐ 104/2026       |
| V-9  | milestone.plannedValue > 0                        | TT 79/2025        |
| V-10 | milestone.title and plannedDate must not be blank | Internal          |
| V-11 | amendment.reason must not be blank                | NĐ 214/2025       |
| V-12 | amendment.changedFields must not be empty         | Internal          |
| V-13 | amendment.timeExtensionDays must be ≥ 0           | Internal          |
| V-14 | attachment.fileSize ≤ 100MB                       | Internal          |
| V-15 | attachment.fileName and fileType must not be blank | Internal         |

---

## Prisma Migration SQL (excerpt)

```sql
-- Phase G: Contract Module
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT','SIGNED','EFFECTIVE','SUSPENDED','COMPLETED','TERMINATED');
CREATE TYPE "ContractType" AS ENUM ('LUMP_SUM','UNIT_PRICE','TIME_BASED','MIXED');
CREATE TYPE "ContractAmendmentStatus" AS ENUM ('DRAFT','APPROVED','REJECTED');
CREATE TYPE "ContractMilestoneStatus" AS ENUM ('PENDING','REACHED','DELAYED','CANCELLED');
CREATE TYPE "GuaranteeType" AS ENUM ('PERFORMANCE','ADVANCE_PAYMENT','WARRANTY');
CREATE TYPE "GuaranteeStatus" AS ENUM ('ACTIVE','EXPIRED','RETURNED','FORFEITED');

CREATE TABLE "contracts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "contractNumber" TEXT UNIQUE NOT NULL,
  "contractType" "ContractType" NOT NULL,
  "packageId" TEXT NOT NULL,
  "approvalId" TEXT,
  "workflowId" TEXT,
  "winnerCode" TEXT NOT NULL,
  "winnerName" TEXT NOT NULL,
  "contractValue" NUMERIC(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "signedDate" TEXT,
  "effectiveDate" TEXT,
  "expiryDate" TEXT,
  "performanceSecurityAmount" NUMERIC(18,2),
  "performanceSecurityPercent" NUMERIC(5,2),
  "advancePaymentAmount" NUMERIC(18,2),
  "advancePaymentPercent" NUMERIC(5,2),
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "contract_amendments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "contractId" UUID NOT NULL REFERENCES "contracts"("id"),
  "amendmentNumber" INT NOT NULL,
  "amendmentCode" TEXT UNIQUE NOT NULL,
  "reason" TEXT NOT NULL,
  "changedFields" TEXT[] NOT NULL,
  "valueChange" NUMERIC(18,2),
  "timeExtensionDays" INT,
  "status" "ContractAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("contractId","amendmentNumber")
);
-- ... (contract_milestones, contract_guarantees, contract_history, contract_attachments similar)
```

---

## Acceptance Criteria

1. Contract can be created with all required fields; assigned status DRAFT.
2. contractNumber is unique; duplicate throws `ContractError(DUPLICATE_NUMBER)`.
3. Contract transitions DRAFT → SIGNED → EFFECTIVE → COMPLETED without error.
4. TERMINATED is reachable from DRAFT, SIGNED, EFFECTIVE, SUSPENDED.
5. COMPLETED and TERMINATED contracts cannot be transitioned further.
6. EFFECTIVE contract can be suspended and resumed; resumes to EFFECTIVE.
7. Amendments can only be created for SIGNED or EFFECTIVE contracts.
8. Approved amendment applies `valueChange` delta to parent `contractValue`.
9. Rejected amendment does not change contract value.
10. Amendment auto-numbering is sequential per contract starting at 1.
11. `calculateCompletionPercent` sums `actualValue` of REACHED milestones / totalPlanned × 100, capped at 100.
12. DELAYED milestones do not count toward completion percentage.
13. Guarantee transitions: ACTIVE → RETURNED or ACTIVE → FORFEITED only.
14. `buildContractSummary` returns null for unknown contractId; aggregates all counts in a single call.
15. `buildContractFromPackage` generates a correctly formatted contractNumber.
16. All history events are immutable; transition actions record `fromStatus` and `toStatus`.
17. All 312 unit tests pass; no frozen module is modified.
