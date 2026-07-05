# Module: Procurement Package

**Status:** FROZEN (v1.0, 2026-07-02)
**Location:** `src/procurement/package/`
**Tests:** ~273

---

## Purpose

Central entity of the procurement domain. A `ProcurementPackage` is the unit of procurement
work — it has a method, value, type, funding source, and a workflow lifecycle.
All higher-level modules (planning, approval, contract) reference a package.

---

## Files

- `packageTypes.ts` — entity types
- `packageRepository.ts` — repository interface
- `packageService.ts` — business logic
- `packageValidation.ts` — validation rules
- `packageIntegration.ts` — bridge: package ↔ workflow/masterdata/rules
- `packageFactory.ts` — factory functions
- `memoryPackageRepositories.ts` — in-memory implementations

---

## Public API

```typescript
// Types
ProcurementPackage {
  id, code, title, description,
  kind: ProcurementPackageKind,   // GOODS | SERVICE | CONSTRUCTION | CONSULTING | MIXED
  method?: ProcurementMethodCode, // OPEN_TENDER | COMPETITIVE_QUOTE | DIRECT_AWARD
  estimatedValue: Money,
  fundingSource: string,
  departmentId: string,
  planId?: string,
  workflowInstanceId?: string,
  status: PackageStatus,
  legalBasis: LegalBasis[],
  createdAt, updatedAt
}

// Service functions
createPackage(params, repos): Promise<ProcurementPackage>
updatePackage(id, params, repos): Promise<ProcurementPackage>
submitForApproval(id, repos): Promise<ProcurementPackage>
getPackageWithWorkflow(id, repos): Promise<PackageWithWorkflow>
listPackagesByDepartment(deptId, repos): Promise<ProcurementPackage[]>
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts`
- `src/shared/financial/financialTypes.ts` (Money, LegalBasis)
- `src/procurement/domain/procurementTypes.ts`
- `src/masterdata/` (via packageIntegration.ts)
- `src/procurement/workflow/` (via packageIntegration.ts)
- `src/procurement/rules/` (via packageIntegration.ts)

---

## Consumers

- `planningIntegration.ts` — packages are children of plans
- `approvalIntegration.ts` — approval requests reference packages
- `contractIntegration.ts` — contracts reference packages

---

## Business Rules Enforced

- Package `estimatedValue` must be > 0
- Package `kind` must match `PackageType` in master data
- Method is optional at creation (determined later via rule engine)
- `status` transitions enforced via workflow

---

## Known Limitations

- Prisma repo is stub until Phase M
- No pagination on `listPackagesByDepartment` (TD-08)
- No soft delete (TD-11)
