# Procurement Package Module

The central business entity of the procurement platform.
All other modules (Workflow, Budget, Documents, Audit, AI) attach to
`ProcurementPackage` by `packageId`.

---

## Entity Relationship Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    ProcurementPackage                      │
│────────────────────────────────────────────────────────────│
│ id              (PK)                                       │
│ packageCode     UNIQUE                                     │
│ packageName                                                │
│ description                                                │
│ packageType     → MasterData: PackageType.code            │
│ procurementMethod → MasterData: ProcurementMethod.code    │
│ procurementCategory? → MasterData: ProcurementCategory   │
│ estimatedValue  VNĐ                                        │
│ approvedValue?  VNĐ (set after approval)                  │
│ fundSource      → MasterData: FundSource.code             │
│ budgetYear      → MasterData: BudgetYear.code             │
│ department      → MasterData: Department.code             │
│ owner           → MasterData: Employee.code               │
│ workflowId?     → WorkflowEngine: WorkflowInstance.id     │
│ status          PackageStatus enum                         │
│ schedule        embedded PackageSchedule                   │
│ funding[]       embedded PackageFunding[]                  │
│ participants[]  embedded PackageParticipant[]              │
│ createdAt, updatedAt                                       │
└────────────────────────────────────────────────────────────┘
           │1                    │1                   │1
           │∞                    │∞                   │∞
  ┌─────────────┐     ┌──────────────────┐    ┌─────────────────────┐
  │ PackageItem │     │  PackageBudget   │    │  PackageAttachment  │
  │─────────────│     │──────────────────│    │─────────────────────│
  │ packageId   │     │ packageId        │    │ packageId           │
  │ itemCode    │     │ budgetSource     │    │ fileName            │
  │ name        │     │ approvedAmount   │    │ fileType            │
  │ unit        │     │ committedAmount  │    │ fileSize            │
  │ quantity    │     │ spentAmount      │    │ uploadedBy          │
  │ unitPrice   │     │ remainingAmount  │    │ documentType        │
  │ total       │     │  = approved      │    └─────────────────────┘
  │ category    │     │  - committed     │
  │ techSpec    │     │  - spent         │    ┌──────────────────────┐
  └─────────────┘     └──────────────────┘    │   PackageHistory     │
                                              │──────────────────────│
  Embedded in ProcurementPackage:             │ packageId            │
  ┌───────────────────────────────┐           │ action               │
  │ PackageSchedule (embedded)    │           │ fromStatus?          │
  │ planningDate?, approvalDate?  │           │ toStatus?            │
  │ tenderDate?, evaluationDate?  │           │ performedBy          │
  │ awardDate?, contractDate?     │           │ performedAt          │
  │ completionDate?               │           │ notes?               │
  └───────────────────────────────┘           └──────────────────────┘

  ┌──────────────────────────────────────┐
  │ PackageFunding[] (embedded)          │
  │ fundSourceCode, amount, percentage   │
  └──────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │ PackageParticipant[] (embedded)                       │
  │ employeeCode, role (OWNER/EVALUATOR/APPROVER/OBSERVER)│
  └───────────────────────────────────────────────────────┘
```

---

## Aggregate Diagram

```
ProcurementPackage (root)
├── embedded: PackageSchedule         (one, always present)
├── embedded: PackageFunding[]        (zero to many)
├── embedded: PackageParticipant[]    (at least one OWNER)
│
├── separate repo: PackageItem[]      (zero to many)
├── separate repo: PackageBudget      (zero or one)
├── separate repo: PackageAttachment[]
└── separate repo: PackageHistory[]   (append-only audit log)
```

---

## Lifecycle Diagram

```
                    ┌─────────┐
        createPackage()       │  DRAFT  │
         owner = OWNER        └────┬────┘
                                   │ updatePackage(status=SUBMITTED)
                              ┌────▼────┐
                              │SUBMITTED│
                              └────┬────┘
                                   │ updatePackage(status=APPROVED)
                              ┌────▼────┐
                              │APPROVED │
                              └────┬────┘
                                   │ updatePackage(status=ACTIVE)
                              ┌────▼────┐
                              │ ACTIVE  │  ← cannot be archived
                              └────┬────┘
                                   │ updatePackage(status=COMPLETED)
                              ┌────▼──────┐
                              │ COMPLETED │
                              └────┬──────┘
                                   │ archivePackage()
                              ┌────▼──────┐
                              │ ARCHIVED  │  ← immutable; no updates
                              └───────────┘

           CANCELLED  ← from DRAFT, SUBMITTED, APPROVED only
```

---

## Repository Interfaces

```typescript
IProcurementPackageRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByCode(code)
  ├── findByStatus(status)
  ├── findByDepartment(deptCode)
  └── search(query: PackageSearchQuery)

IPackageItemRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByPackageId(packageId)
  ├── deleteByPackageId(packageId)
  └── sumByPackageId(packageId): number

IBudgetRepository
  ├── create / update / delete / findById / findAll / count
  └── findByPackageId(packageId): PackageBudget | null

IAttachmentRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByPackageId(packageId)
  └── findByDocumentType(packageId, docType)

IHistoryRepository (append-only)
  ├── create / delete / findById / findAll / count
  ├── findByPackageId(packageId)
  └── findByAction(packageId, action)
```

---

## API Specification

### Service Functions (`packageService.ts`)

#### `generatePackageNumber(prefix?, year?, seq?)`
Returns e.g. `DTMS/2026/001`. Default prefix `DTMS`, current year, seq zero-padded to 3 digits.

#### `createPackage(params, repos)`
- Validates unique `packageCode` (throws `PackageError(DUPLICATE_CODE)`)
- Validates required fields + `estimatedValue > 0`
- Creates package with `status=DRAFT`
- Seeds one `OWNER` participant, one `CREATED` history entry
- Returns `ProcurementPackage`

#### `updatePackage(id, params, repos, performedBy)`
- Throws `PackageError(NOT_FOUND)` if package not found
- Throws `PackageError(IMMUTABLE)` if status is `ARCHIVED`
- Merges `schedule` updates with existing schedule (partial merge)
- Records `UPDATED` history entry

#### `clonePackage(id, newCode, repos, performedBy)`
- Throws `PackageError(NOT_FOUND)` if source not found
- Throws `PackageError(DUPLICATE_CODE)` if `newCode` is taken
- Creates deep copy with `status=DRAFT`, clears `workflowId` and `approvedValue`
- Resets `participants` to `[{role:OWNER, employeeCode:performedBy}]`
- Records `CLONED` history entry

#### `archivePackage(id, repos, performedBy)`
- Throws `PackageError(NOT_FOUND)` if not found
- Throws `PackageError(ALREADY_ARCHIVED)` if already `ARCHIVED`
- Throws `PackageError(CANNOT_ARCHIVE)` if status is `ACTIVE`
- Sets `status=ARCHIVED`, records `ARCHIVED` history entry

#### `calculateTotals(packageId, repos)`
Returns sum of `PackageItem.estimatedTotal` for the package (0 if no items).

#### `validatePackage(pkg)`
Sync structural validation: required fields + `estimatedValue > 0`.
Returns `PackageValidationResult { valid, errors, warnings }`.

---

### Integration Functions (`packageIntegration.ts`)

#### `validatePackageAgainstMasterData(pkg, masterRepos)`
Checks department, fundSource, packageType, procurementMethod are active in master data.
Returns `{ valid, errors, warnings }`.

#### `evaluatePackageWithRuleEngine(pkg, engine?)`
Builds a `ProcurementCase` from package fields and calls `ProcurementEngine.evaluate()`.
Returns `ProcurementDecision` with classification, threshold, method, approval, legal docs.

#### `createPackageWithWorkflow(pkg, masterRepos, performedBy)`
Validates all master data codes via `buildWorkflowParamsFromMasterData()`,
then calls `createWorkflow()`. Returns `{ pkg, workflow: WorkflowInstance }`.

#### `linkWorkflowToPackage(packageId, workflowId, repos)`
Sets `workflowId` on the package. Throws if package not found.

#### `buildPackageSummary(pkg)`
Returns `{ packageCode, packageName, estimatedValue, status, ruleEngineDecision }`.

---

## Validation Rules

| Rule | Function | Error |
|------|----------|-------|
| Package code unique | `validateUniquePackageCode` | `PackageError(DUPLICATE_CODE)` |
| Budget amounts ≥ 0 | `validateBudgetAmounts` | error string |
| Budget totals balance | `validateBudgetBalance` | error string |
| Department active | `validateDepartmentExists` | validation result |
| Fund source active | `validateFundSourceExists` | validation result |
| Authority resolvable | `validateApprovalAuthorityResolvable` | boolean |
| Required fields present | `validateRequiredFields` | error strings |
| `estimatedValue > 0` | `validateEstimatedValue` | error string |

---

## Budget Balance Formula

```
remainingAmount = approvedAmount − committedAmount − spentAmount
```

The repository does not auto-enforce this — it is the caller's responsibility
(enforced in `validateBudgetBalance()` before any budget commit/spend update).

---

## Acceptance Criteria

1. `ProcurementPackage` can be created with a unique code, DRAFT status, OWNER participant, and CREATED history.
2. Duplicate `packageCode` is rejected at creation and clone time.
3. ARCHIVED packages are immutable — no updates allowed.
4. ACTIVE packages cannot be archived.
5. `calculateTotals()` correctly sums item totals (returns 0 for empty).
6. `validatePackageAgainstMasterData()` rejects inactive/unknown department, fundSource, packageType, method.
7. `evaluatePackageWithRuleEngine()` returns a ProcurementDecision for any valid package.
8. `createPackageWithWorkflow()` creates a workflow instance in DRAFT state.
9. `linkWorkflowToPackage()` sets `workflowId` and fails gracefully on missing package.
10. Budget balance validation catches remainingAmount mismatches and warns when < 10%.

---

## Migration Guide

### Quickstart

```typescript
import { createMemoryPackageRepositories } from './src/procurement/package/memoryPackageRepositories';
import { createPackage, generatePackageNumber } from './src/procurement/package/packageService';

const repos = createMemoryPackageRepositories();
const pkg = await createPackage({
  packageCode: generatePackageNumber('DTMS', 2026, 1),
  packageName: 'Mua sắm thiết bị CNTT',
  packageType: 'GOODS',
  procurementMethod: 'OPEN_TENDER',
  estimatedValue: 500_000_000,
  fundSource: 'STATE',
  budgetYear: 'BY-2026',
  department: 'PHONG-TC',
  owner: 'NV001',
}, repos);
```

### With master data validation

```typescript
import { validatePackageAgainstMasterData } from './src/procurement/package/packageIntegration';
import { createMemoryMasterDataRepositories, seedDefaultData } from './src/masterdata/masterdataFactory';

const masterRepos = createMemoryMasterDataRepositories();
await seedDefaultData(masterRepos);
// Add your department and other master data...

const result = await validatePackageAgainstMasterData(pkg, masterRepos);
if (!result.valid) throw new Error(result.errors.join('; '));
```

### With workflow

```typescript
import { createPackageWithWorkflow } from './src/procurement/package/packageIntegration';

const { pkg, workflow } = await createPackageWithWorkflow(pkg, masterRepos, 'NV001');
// workflow.context.currentState === 'DRAFT'
// workflow.context.status === 'ACTIVE'
```
