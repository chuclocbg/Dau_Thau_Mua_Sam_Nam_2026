# Procurement Planning Module

Models the planning stage that precedes procurement execution. Determines
WHAT should be procured, WHY, WHEN, and WITH WHICH FUNDING before any
procurement workflow begins.

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                   AnnualProcurementPlan                      │
│──────────────────────────────────────────────────────────────│
│ id, annualPlanCode (UNIQUE), fiscalYear, organization        │
│ totalBudget, approvedBudget?, planIds[] (embedded)           │
│ status: DRAFT|SUBMITTED|APPROVED|ACTIVE|CLOSED               │
│ submittedAt?, approvedAt?                                    │
└───────────────────────────┬──────────────────────────────────┘
                            │ 1:N (planIds)
┌───────────────────────────▼──────────────────────────────────┐
│                      ProcurementPlan                         │
│──────────────────────────────────────────────────────────────│
│ id, planNumber (UNIQUE), fiscalYear, organization            │
│ responsibleDepartment → MasterData: Department.code         │
│ estimatedTotal, approvedTotal?                               │
│ status: DRAFT|SUBMITTED|APPROVED|ACTIVE|CLOSED|CANCELLED     │
│ approvalHistory[] (embedded)                                 │
│ requestIds[] (embedded), generatedPackageIds[] (embedded)    │
└──────┬────────────────────┬──────────────────────────────────┘
       │ 1:N                │ 1:N
       │                    │
┌──────▼──────┐    ┌────────▼─────────────────────────────────┐
│ FundingAlloc│    │               PackageProposal             │
│─────────────│    │──────────────────────────────────────────│
│ planId      │    │ proposalCode (UNIQUE), planId             │
│ fundSource  │    │ requestIds[] (embedded)                   │
│ allocated   │    │ proposedPackageType, proposedMethod       │
│ committed   │    │ estimatedValue, fundSource                │
│ remaining   │    │ justification                             │
│ budgetYear  │    │ status: DRAFT|APPROVED|REJECTED|CONVERTED │
└─────────────┘    │ convertedPackageId? → ProcurementPackage │
                   └──────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    ProcurementRequest                        │
│──────────────────────────────────────────────────────────────│
│ id, requestCode (UNIQUE)                                     │
│ department → MasterData: Department.code                    │
│ requester → MasterData: Employee.code                       │
│ reason, needDescription                                      │
│ needs[] (embedded ProcurementNeed[])                         │
│ estimatedCost, fundingSource → MasterData: FundSource.code  │
│ isUrgent, expectedTimeline, priority, legalBasis             │
│ status: PENDING|APPROVED|REJECTED|MERGED|CANCELLED           │
│ planId? → ProcurementPlan.id                                │
└──────────────────────────────────────────────────────────────┘

  Embedded in ProcurementRequest:
  ┌──────────────────────────────────────────┐
  │ ProcurementNeed[] (embedded)             │
  │ needCode, description, category          │
  │ quantity, unit, estimatedUnitCost        │
  │ estimatedTotal = quantity × unitCost     │
  └──────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    ProcurementDemand                         │
│──────────────────────────────────────────────────────────────│
│ id, demandCode (UNIQUE), fiscalYear, department              │
│ requestIds[] (embedded), consolidatedCost                    │
│ status: OPEN|CONSOLIDATED|SUBMITTED                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Planning Workflow

```
STEP 1: Department submits ProcurementRequest
  createRequest() → status=PENDING

STEP 2: Manager reviews requests
  approveRequest() → PENDING → APPROVED
  OR request may be:
    - mergeRequests()  → MERGED  (combined into new request)
    - splitRequest()   → CANCELLED (split into 2+ new requests)

STEP 3: Planner generates ProcurementPlan from approved requests
  generateProcurementPlan() → ProcurementPlan (DRAFT)
  Requests receive planId

STEP 4: Finance adds FundingAllocations to plan
  FundingAllocation.create() per funding source

STEP 5: Planner creates PackageProposals
  generatePackageProposalFromRequests() → ProposaI(s) (DRAFT)
  Grouped by fundingSource, rule engine selects procurement method

STEP 6: Proposal approved and converted to ProcurementPackage
  createPackageFromPlan() → ProcurementPackage
  Proposal status = CONVERTED, plan.generatedPackageIds updated

STEP 7: Plan proceeds through approval lifecycle
  DRAFT → SUBMITTED → APPROVED → ACTIVE → CLOSED
```

---

## State Diagram

### ProcurementRequest

```
PENDING → APPROVED   (approveRequest)
PENDING → REJECTED   (manual update)
PENDING → MERGED     (mergeRequests — original marked merged)
PENDING → CANCELLED  (splitRequest — original marked cancelled)
APPROVED → MERGED    (mergeRequests)
```

### ProcurementPlan

```
DRAFT → SUBMITTED → APPROVED → ACTIVE → CLOSED
              ↓
          CANCELLED  (from DRAFT or SUBMITTED only)
```

### PackageProposal

```
DRAFT → APPROVED → CONVERTED
              ↓
          REJECTED
```

### AnnualProcurementPlan

```
DRAFT → SUBMITTED → APPROVED → ACTIVE → CLOSED
```

---

## Repository Interfaces

```typescript
IProcurementRequestRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByCode(code)
  ├── findByStatus(status)
  ├── findByDepartment(dept)
  ├── findByPlanId(planId)
  └── search(query: PlanningSearchQuery)

IProcurementPlanRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByNumber(number)
  ├── findByFiscalYear(year)
  ├── findByOrganization(org)
  └── findByStatus(status)

IProcurementDemandRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByDepartment(dept)
  ├── findByFiscalYear(year)
  └── findByStatus(status)

IFundingAllocationRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByPlanId(planId)
  └── sumByPlanId(planId): number

IPackageProposalRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByCode(code)
  ├── findByPlanId(planId)
  └── findByStatus(status)

IAnnualProcurementPlanRepository
  ├── create / update / delete / findById / findAll / count
  ├── findByCode(code)
  ├── findByFiscalYear(year)
  └── findByOrganization(org)
```

---

## API Specification

### Service Functions (`planningService.ts`)

#### `generatePlanNumber(org?, year?, seq?)`
Returns e.g. `DTMS/KH-DTMS/2026/001`. Default org `DTMS`, current year, seq zero-padded 3 digits.

#### `createRequest(params, repos)`
- Validates unique `requestCode` (throws `PlanningError(DUPLICATE_CODE)`)
- Validates required fields (throws `PlanningError(INVALID_REQUEST)`)
- Validates `estimatedCost > 0` (throws `PlanningError(INVALID_COST)`)
- Creates request with `status=PENDING`, `needs=[]`, `isUrgent=false`, `priority=MEDIUM`

#### `approveRequest(id, repos, approvedBy, notes?)`
- Throws `PlanningError(NOT_FOUND)` if missing
- Throws `PlanningError(INVALID_STATUS)` if not `PENDING`
- Returns updated request with `status=APPROVED`

#### `mergeRequests(ids, newCode, repos, performedBy)`
- Requires 2+ ids (throws `PlanningError(INVALID_MERGE)`)
- Throws `PlanningError(DUPLICATE_CODE)` if `newCode` exists
- Throws `PlanningError(NOT_FOUND)` for any missing id
- Sums `estimatedCost`, combines `needs`, escalates priority (CRITICAL > HIGH > MEDIUM > LOW)
- Sets `isUrgent=true` if any original is urgent
- Marks originals as `MERGED`, returns new `PENDING` request

#### `splitRequest(id, parts, repos, performedBy)`
- Throws `PlanningError(NOT_FOUND)` if original missing
- Throws `PlanningError(INVALID_STATUS)` if original is `MERGED` or `CANCELLED`
- Creates `parts.length` new requests inheriting department, fundingSource, priority, legalBasis
- Marks original as `CANCELLED`, returns array of new requests

#### `generateProcurementPlan(fiscalYear, organization, requestIds, repos, responsibleDepartment?)`
- Throws `PlanningError(EMPTY_REQUESTS)` if requestIds is empty
- Throws `PlanningError(UNAPPROVED_REQUESTS)` if any request is not APPROVED
- Creates plan with `status=DRAFT`, links all requests via `planId`
- Auto-increments seq within `fiscalYear`

#### `createPackageFromPlan(planId, proposalId, packageRepos, planRepos, performedBy)`
- Throws `PlanningError(NOT_FOUND)` for missing proposal or plan
- Throws `PlanningError(INVALID_STATUS)` if proposal is not `APPROVED`
- Calls `createPackage()` from Phase D packageService
- Updates proposal to `CONVERTED`, updates plan's `generatedPackageIds`

#### `validatePlan(planId, repos)`
Returns `PlanningValidationResult`. Checks plan exists, has requests, all requests APPROVED.
Warns if no funding allocations.

#### `calculateFunding(allocations)`
Groups `FundingAllocation[]` by `fundSourceCode`, returns `FundingSummary[]` with summed amounts.

---

### Integration Functions (`planningIntegration.ts`)

#### `validatePlanAgainstMasterData(plan, requests, masterRepos)`
Checks `responsibleDepartment` and all request `fundingSource` codes against active master data.
Returns `{ valid, errors, warnings }`.

#### `evaluatePlanWithRuleEngine(requests, engine?)`
Maps each request to a `ProcurementCase` and evaluates with `ProcurementEngine`.
Returns `RequestDecision[]` — one per request, with `requestCode` and full `ProcurementDecision`.

#### `buildPlanWorkflow(plan, masterRepos)`
Creates a `WorkflowInstance` for the plan via `buildWorkflowParamsFromMasterData + createWorkflow`.
Returns `{ plan, workflow }`.

#### `generatePackageProposalFromRequests(requests, planId, repos, engine?)`
Groups requests by `fundingSource`, evaluates each group with the rule engine,
creates one `PackageProposal (DRAFT)` per group. Returns proposals.

#### `buildPlanSummary(plan, requests)`
Returns `{ planNumber, fiscalYear, estimatedTotal, requestCount, status, generatedPackageCount }`.

---

## Validation Rules

| Rule | Function | Error |
|------|----------|-------|
| Request code unique | `validateUniqueRequestCode` | `PlanningError(DUPLICATE_CODE)` |
| Required fields present | `validateRequiredRequestFields` | error strings |
| estimatedCost > 0 | `validateEstimatedCost` | error string |
| Budget year consistency | `validateBudgetYearConsistency` | boolean |
| Funding sufficient | `validateFundingAvailability` | error string |
| All requests APPROVED | `validateRequestsApproved` | error strings |
| Plan has requests | `validatePlanHasRequests` | error string |
| Allocations cover total | `validateFundingBalance` | error string |
| Department active | inline in integration | error string |
| Fund source active | inline in integration | error string |

---

## Acceptance Criteria

1. `ProcurementRequest` can be created with PENDING status and validated fields.
2. Duplicate `requestCode` is rejected at creation time.
3. Only PENDING requests can be approved.
4. `mergeRequests()` requires ≥2 requests, sums costs, marks originals MERGED.
5. `splitRequest()` creates ≥2 new PENDING requests, marks original CANCELLED.
6. MERGED and CANCELLED requests cannot be split.
7. `generateProcurementPlan()` requires all requests to be APPROVED.
8. Plan estimatedTotal = sum of linked request costs.
9. `createPackageFromPlan()` only converts APPROVED proposals.
10. Proposal becomes CONVERTED with `convertedPackageId` after package creation.
11. `validatePlanAgainstMasterData()` rejects inactive/unknown department and fund sources.
12. `evaluatePlanWithRuleEngine()` returns one decision per request.
13. `calculateFunding()` groups allocations by `fundSourceCode`.

---

## Migration Guide

### Quickstart

```typescript
import { createMemoryPlanningRepositories } from './src/procurement/planning/memoryPlanningRepositories';
import { createRequest, approveRequest, generateProcurementPlan } from './src/procurement/planning/planningService';

const repos = createMemoryPlanningRepositories();

// Create and approve a request
const req = await createRequest({
  requestCode: 'REQ-2026-001',
  department: 'PHONG-TC',
  requester: 'NV001',
  reason: 'Mua sắm thiết bị CNTT',
  needDescription: 'Laptop Core i7, 16GB RAM',
  estimatedCost: 200_000_000,
  fundingSource: 'STATE',
  expectedTimeline: '2026-09-01',
  priority: 'HIGH',
}, repos);

const approved = await approveRequest(req.id, repos, 'GIAM-DOC');

// Generate a plan
const plan = await generateProcurementPlan('2026', 'DTMS', [approved.id], repos, 'PHONG-TC');
```

### With master data validation + workflow

```typescript
import { validatePlanAgainstMasterData, buildPlanWorkflow, generatePackageProposalFromRequests } from './src/procurement/planning/planningIntegration';
import { createMemoryMasterDataRepositories, seedDefaultData } from './src/masterdata/masterdataFactory';

const masterRepos = createMemoryMasterDataRepositories();
await seedDefaultData(masterRepos);

// Validate plan
const validation = await validatePlanAgainstMasterData(plan, [approved], masterRepos);
if (!validation.valid) throw new Error(validation.errors.join('; '));

// Generate package proposals
const proposals = await generatePackageProposalFromRequests([approved], plan.id, repos);

// Build workflow
const { workflow } = await buildPlanWorkflow(plan, masterRepos);
```

### Convert proposal to package

```typescript
import { createPackageFromPlan } from './src/procurement/planning/planningService';
import { createMemoryPackageRepositories } from './src/procurement/package/memoryPackageRepositories';

// First, approve the proposal
await repos.proposals.update(proposal.id, { status: 'APPROVED' });

// Convert to package
const packageRepos = createMemoryPackageRepositories();
const pkg = await createPackageFromPlan(plan.id, proposal.id, packageRepos, repos, 'NV001');
// pkg.status === 'DRAFT'
// proposal.status === 'CONVERTED'
// plan.generatedPackageIds.includes(pkg.id)
```
