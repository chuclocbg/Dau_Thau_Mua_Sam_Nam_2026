# Master Data Module

Vietnamese public procurement master data — configurable entities that replace
hardcoded constants in the Workflow Engine.

---

## ER Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│   Department     │     │    Employee       │     │  ApprovalAuthority   │
│──────────────────│     │──────────────────│     │──────────────────────│
│ id               │◄────│ departmentId      │     │ id                   │
│ code (unique)    │     │ code (unique)     │     │ code (unique)        │
│ name             │     │ name              │     │ name                 │
│ level: int       │     │ email             │     │ level: int (unique)  │
│ parentId?        │─┐   │ roles: string[]   │     │ maxValue: number     │
│ isActive         │ └───│ isActive          │     │ isActive             │
│ isArchived       │     │ isArchived        │     │ isArchived           │
└──────────────────┘     └──────────────────┘     └──────────────────────┘
       │ self-ref
       └── parentId → id (nullable, hierarchy)

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│    Vendor        │     │   FundSource      │     │    BudgetYear        │
│──────────────────│     │──────────────────│     │──────────────────────│
│ id               │     │ id               │     │ id                   │
│ code (unique)    │     │ code (unique)    │     │ code (unique)        │
│ name             │     │ name             │     │ name                 │
│ taxCode          │     │ type: enum       │     │ year: int            │
│ address          │     │  STATE           │     │ startDate: string    │
│ contactEmail?    │     │  ODA             │     │ endDate: string      │
│ isBlacklisted    │     │  PPP             │     │ totalBudget: number  │
│ isActive         │     │  ENTERPRISE      │     │ isActive             │
│ isArchived       │     │ isActive         │     │ isArchived           │
└──────────────────┘     │ isArchived       │     └──────────────────────┘
                         └──────────────────┘

┌──────────────────┐     ┌──────────────────────────┐   ┌──────────────────────┐
│  PackageType     │     │    ProcurementMethod      │   │ ProcurementCategory  │
│──────────────────│     │──────────────────────────│   │──────────────────────│
│ id               │     │ id                       │   │ id                   │
│ code (unique)    │◄────│ applicablePackageType     │   │ code (unique)        │
│ name             │     │   Codes: string[]         │   │ name                 │
│ category         │     │ code (unique)             │   │ packageTypeCode       │──►PackageType
│ isActive         │     │ name                     │   │ parentCategoryId?     │─┐
│ isArchived       │     │ isActive                 │   │ isActive              │ └─►self
└──────────────────┘     │ isArchived               │   │ isArchived            │
                         └──────────────────────────┘   └──────────────────────┘

┌──────────────────────────────┐
│      DocumentTemplate        │
│──────────────────────────────│
│ id                           │
│ code (unique)                │
│ name                         │
│ templateType                 │
│ content: string              │
│ applicableStates: string[]   │──► WorkflowStateId[]
│ isActive                     │
│ isArchived                   │
└──────────────────────────────┘
```

---

## Repository Diagram

```
IMasterDataRepository<T>
        │
        ├── create(entity)   → Promise<T>
        ├── update(id, Δ)    → Promise<T>
        ├── delete(id)       → Promise<void>   (permanent)
        ├── archive(id)      → Promise<T>      (isArchived=true, isActive=false)
        ├── findById(id)     → Promise<T|null>
        ├── findByCode(code) → Promise<T|null>
        ├── findActive()     → Promise<readonly T[]>
        ├── search(query)    → Promise<PagedResult<T>>
        └── count()          → Promise<number>

Implementations:
  MemoryMasterDataRepository<T>  — in-memory, for tests and local dev
  PrismaMasterDataRepository<T>  — throws PrismaNotReadyError until DATABASE_URL set
```

---

## Relationship Diagram

```
WorkflowEngine (frozen)
       │
       │ no direct imports
       ▼
masterdataIntegration.ts (bridge)
       │
       ├── resolveApprovalAuthorityLimit(code, repo)
       │       reads ApprovalAuthority.maxValue
       │       replaces AUTHORITY_VALUE_LIMITS constant
       │
       ├── validateApprovalAuthorityFromMasterData(ctx, repo)
       │       checks ctx.estimatedValue < authority.maxValue
       │
       ├── resolvePackageTypeFromMasterData(code, repo)
       ├── resolveProcurementMethodFromMasterData(code, repo)
       │
       ├── resolveDocumentTemplatesForState(stateId, repo)
       │       filters DocumentTemplate.applicableStates
       │
       └── buildWorkflowParamsFromMasterData(input, repos)
               validates all codes, returns WorkflowCreationParams

MasterDataRepositories (interface bag)
       ├── departments           MemoryMasterDataRepository<Department>
       ├── employees             MemoryMasterDataRepository<Employee>
       ├── approvalAuthorities   MemoryMasterDataRepository<ApprovalAuthority>
       ├── fundSources           MemoryMasterDataRepository<FundSource>
       ├── budgetYears           MemoryMasterDataRepository<BudgetYear>
       ├── vendors               MemoryMasterDataRepository<Vendor>
       ├── procurementCategories MemoryMasterDataRepository<ProcurementCategory>
       ├── packageTypes          MemoryMasterDataRepository<PackageType>
       ├── procurementMethods    MemoryMasterDataRepository<ProcurementMethod>
       └── documentTemplates     MemoryMasterDataRepository<DocumentTemplate>
```

---

## API Specification

### Types (`masterdataTypes.ts`)

| Type | Purpose |
|------|---------|
| `MasterDataEntity` | Base interface — id, code, name, isActive, isArchived, createdAt, updatedAt |
| `Department` | + level: number, parentId?: string |
| `Employee` | + departmentId, email, roles: string[] |
| `ApprovalAuthority` | + level: number, maxValue: number (VNĐ) |
| `Vendor` | + taxCode, address, contactEmail?, isBlacklisted: boolean |
| `FundSource` | + type: 'STATE'\|'ODA'\|'PPP'\|'ENTERPRISE' |
| `BudgetYear` | + year: number, startDate, endDate, totalBudget |
| `PackageType` | + category: string |
| `ProcurementMethod` | + applicablePackageTypeCodes: string[] |
| `ProcurementCategory` | + packageTypeCode, parentCategoryId? |
| `DocumentTemplate` | + templateType, content, applicableStates: string[] |
| `SearchQuery` | term?, isActive?, isArchived?, page?, pageSize? |
| `PagedResult<T>` | items, total, page, pageSize |
| `MasterDataValidationError` | extends Error — code, field, message |

### Repository Interface (`masterdataRepository.ts`)

```typescript
interface IMasterDataRepository<T extends MasterDataEntity> {
  create(entity: Omit<T, 'id'|'createdAt'|'updatedAt'>): Promise<T>
  update(id: string, updates: Partial<Omit<T, 'id'|'createdAt'>>): Promise<T>
  delete(id: string): Promise<void>
  archive(id: string): Promise<T>
  findById(id: string): Promise<T | null>
  findByCode(code: string): Promise<T | null>
  findActive(): Promise<readonly T[]>
  search(query: SearchQuery): Promise<PagedResult<T>>
  count(): Promise<number>
}
```

### Factory (`masterdataFactory.ts`)

```typescript
createMemoryMasterDataRepositories(): MasterDataRepositories
createPrismaMasterDataRepositories(): MasterDataRepositories
seedDefaultData(repos: MasterDataRepositories): Promise<void>
```

`seedDefaultData` seeds:
- 3 ApprovalAuthority (UNIT_HEAD 5B, MINISTER 50B, PRIME_MINISTER MAX_SAFE_INT)
- 5 PackageType (GOODS, SERVICE, CONSULTING, CONSTRUCTION, MIXED)
- 7 ProcurementMethod (all from Điều 21 Luật 22/2023)
- 4 FundSource (STATE, ODA, PPP, ENTERPRISE)
- 5 DocumentTemplate (matching the 5 required-document gates)

### Validation (`masterdataValidation.ts`)

```typescript
validateUniqueCode<T>(repo, code, excludeId?): Promise<boolean>
validateUniqueName<T>(repo, name, excludeId?): Promise<boolean>
validateActiveReference<T>(repo, id): Promise<boolean>
validateUniqueAuthorityLevel(repo, level, excludeId?): Promise<boolean>
validateVendorNotBlacklisted(repo, id): Promise<boolean>
validateBudgetYearDates(startDate, endDate): Promise<boolean>
assertUniqueCode<T>(repo, code, excludeId?): Promise<void>   // throws MasterDataValidationError
assertUniqueName<T>(repo, name, excludeId?): Promise<void>
assertActiveReference<T>(repo, id, field): Promise<void>
assertBudgetYearDates(year): Promise<void>
```

### Integration Bridge (`masterdataIntegration.ts`)

```typescript
resolveApprovalAuthorityLimit(authorityCode, repo): Promise<number>
validateApprovalAuthorityFromMasterData(ctx, repo): Promise<boolean>
resolvePackageTypeFromMasterData(code, repo): Promise<PackageType | null>
resolveProcurementMethodFromMasterData(code, repo): Promise<ProcurementMethod | null>
resolveDocumentTemplatesForState(stateId, repo): Promise<readonly DocumentTemplate[]>
buildWorkflowParamsFromMasterData(input, repos): Promise<WorkflowCreationParams>
```

---

## Approval Authority Thresholds (NĐ 214/2025 Điều 76)

| Code | Name | Max Value (VNĐ) | Legal Basis |
|------|------|----------------|-------------|
| UNIT_HEAD | Người đứng đầu đơn vị | 5,000,000,000 | NĐ 214/2025 Điều 76.1 |
| MINISTER | Bộ trưởng / Thủ trưởng cơ quan | 50,000,000,000 | NĐ 214/2025 Điều 76.2 |
| PRIME_MINISTER | Thủ tướng Chính phủ | Unlimited | NĐ 214/2025 Điều 76.3 |

---

## Migration Guide

### Step 1 — Replace hardcoded authority limits

Before (workflowValidator.ts hardcoded):
```typescript
const AUTHORITY_VALUE_LIMITS = {
  UNIT_HEAD: 5_000_000_000,
  MINISTER: 50_000_000_000,
  PRIME_MINISTER: Number.MAX_SAFE_INTEGER,
};
```

After (via integration bridge):
```typescript
import { validateApprovalAuthorityFromMasterData } from './masterdata/masterdataIntegration';

const valid = await validateApprovalAuthorityFromMasterData(ctx, repos.approvalAuthorities);
```

### Step 2 — Seed repositories on startup

```typescript
import { createMemoryMasterDataRepositories, seedDefaultData } from './masterdata/masterdataFactory';

const repos = createMemoryMasterDataRepositories();  // or Prisma in prod
await seedDefaultData(repos);
```

### Step 3 — Build workflow params from master data

```typescript
import { buildWorkflowParamsFromMasterData } from './masterdata/masterdataIntegration';

const params = await buildWorkflowParamsFromMasterData({
  packageId: 'PKG-001',
  packageTypeCode: 'GOODS',
  estimatedValue: 100_000_000,
  procurementMethodCode: 'OPEN_TENDER',
  approvalAuthorityCode: 'UNIT_HEAD',
  performedBy: 'nguyen.van.a',
}, repos);

const workflow = createWorkflow(params);
```

### Step 4 — Resolve document templates for workflow states

```typescript
import { resolveDocumentTemplatesForState } from './masterdata/masterdataIntegration';

const templates = await resolveDocumentTemplatesForState(
  'DOCUMENT_PREPARATION',
  repos.documentTemplates,
);
// → returns DocumentTemplate[] matching that workflow state
```

### Step 5 — Switch to Prisma (production)

When `DATABASE_URL` is available:
```typescript
import { createPrismaMasterDataRepositories } from './masterdata/masterdataFactory';
// Configure Prisma schema (see prisma/schema.prisma additions)
const repos = createPrismaMasterDataRepositories();
await seedDefaultData(repos);  // one-time migration
```
