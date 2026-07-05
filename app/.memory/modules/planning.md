# Module: Procurement Planning

**Status:** FROZEN (v1.0, 2026-07-02)
**Location:** `src/procurement/planning/`
**Tests:** ~312

---

## Purpose

Manages procurement plans and procurement requests. A `ProcurementPlan` groups multiple
`ProcurementRequest` objects for a department/fiscal year. Requests are submitted for
approval and then become packages.

---

## Files

- `planningTypes.ts` — entity types
- `planningRepository.ts` — repository interfaces
- `planningService.ts` — business logic
- `planningValidation.ts` — validation rules
- `planningIntegration.ts` — bridge: planning ↔ workflow/masterdata/rules/package
- `planningFactory.ts` — factory functions
- `memoryPlanningRepositories.ts` — in-memory implementations

---

## Public API

```typescript
// Types
ProcurementPlan {
  id, code, title, departmentId, fiscalYear,
  totalBudget: Money,
  status: PlanStatus,
  requests: ProcurementRequest[],     // embedded, not separate repo
  workflowInstanceId?: string,
  legalBasis: LegalBasis[],
  createdAt, updatedAt
}

ProcurementRequest {
  id, planId, title, description,
  estimatedValue: Money,
  kind: ProcurementPackageKind,
  fundingSource: string,
  justification: string,
  needs: ProcurementNeed[],           // embedded per ADR-013
  status: RequestStatus,
  packageId?: string,                 // set when approved → package
  createdAt
}

// Service functions
createPlan(params, repos): Promise<ProcurementPlan>
addRequest(planId, request, repos): Promise<ProcurementPlan>
submitPlan(planId, repos): Promise<ProcurementPlan>
approvePlan(planId, decision, repos): Promise<ProcurementPlan>
convertRequestToPackage(requestId, repos): Promise<ProcurementPackage>
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts`
- `src/shared/financial/financialTypes.ts`
- `src/procurement/domain/procurementTypes.ts`
- `src/procurement/package/` (via planningIntegration.ts)
- `src/masterdata/` (via planningIntegration.ts)
- `src/procurement/workflow/` (via planningIntegration.ts)
- `src/procurement/rules/` (via planningIntegration.ts)

---

## Consumers

- `approvalIntegration.ts` — plans go through approval workflow

---

## Design Decisions

- **ADR-013:** `ProcurementNeed` is embedded in `ProcurementRequest` (no separate repo). Needs never exist independently of a request.
- **ADR-014:** `buildPlanWorkflow` hardcodes OPEN_TENDER (KI-001). Correct default for most plans.

---

## Known Limitations

- TD-07: `buildPlanWorkflow` hardcodes OPEN_TENDER for all plans
- Prisma repo is stub until Phase M
- No pagination (TD-08)
