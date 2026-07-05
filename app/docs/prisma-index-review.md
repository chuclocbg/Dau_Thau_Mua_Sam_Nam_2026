# Prisma Index Recommendation Report

Status: RECOMMENDATION ONLY — no schema changes applied.
Apply indexes before production migration. All tables are currently SPEC ONLY.

---

## Summary

| Priority | Table | Columns | Action |
|----------|-------|---------|--------|
| HIGH | procurement_requests | status | ADD INDEX |
| HIGH | procurement_requests | department | ADD INDEX |
| HIGH | procurement_requests | plan_id | ADD INDEX |
| HIGH | procurement_plans | status | ADD INDEX |
| HIGH | procurement_plans | fiscal_year | ADD INDEX |
| HIGH | procurement_packages | status | ADD INDEX |
| HIGH | procurement_packages | department | ADD INDEX |
| HIGH | package_proposals | plan_id | ADD INDEX |
| HIGH | funding_allocations | plan_id | ADD INDEX |
| MEDIUM | procurement_packages | fiscal_year, budget_year | ADD INDEX |
| MEDIUM | procurement_plans | organization | ADD INDEX |
| MEDIUM | procurement_demands | fiscal_year, department | ADD INDEX |
| MEDIUM | annual_procurement_plans | fiscal_year, organization | ADD INDEX |
| LOW | package_proposals | status | ADD INDEX |
| LOW | package_items | package_id | ALREADY implied by FK |
| LOW | package_history | package_id | ALREADY implied by FK |

---

## Detailed Recommendations

### procurement_requests

**R-IDX-001**
- Table: `procurement_requests`
- Columns: `status`
- Query pattern: `findByStatus()` — list all requests with status PENDING, APPROVED, etc.
- Expected benefit: Status-filtered list avoids full table scan. At scale (10k+ requests/year), this is the primary dashboard query.
- Storage cost: ~50 KB per 100k rows
- Write cost: Negligible (status changes are infrequent)
- Recommendation: **ADD** `@@index([status])`

**R-IDX-002**
- Table: `procurement_requests`
- Columns: `department`
- Query pattern: `findByDepartment()` — all requests from a given department
- Expected benefit: Per-department views are core UX. Without index, every department view scans all requests.
- Storage cost: ~50 KB per 100k rows
- Write cost: Negligible (department never changes after creation)
- Recommendation: **ADD** `@@index([department])`

**R-IDX-003**
- Table: `procurement_requests`
- Columns: `plan_id`
- Query pattern: `findByPlanId()` — all requests in a plan; FK join from plans to requests
- Expected benefit: Critical for plan detail view. Without index, loading a plan with 50 requests requires a full scan.
- Storage cost: ~50 KB per 100k rows
- Write cost: Low (planId set once when request is linked to plan)
- Recommendation: **ADD** `@@index([plan_id])`

---

### procurement_plans

**R-IDX-004**
- Table: `procurement_plans`
- Columns: `status`
- Query pattern: `findByStatus()` — list DRAFT, SUBMITTED, APPROVED plans for dashboard
- Expected benefit: Plan dashboard is the main operational view; status filter without index is full scan.
- Storage cost: ~10 KB per 10k plans
- Write cost: Moderate (status changes 5-7 times per plan lifecycle)
- Recommendation: **ADD** `@@index([status])`

**R-IDX-005**
- Table: `procurement_plans`
- Columns: `fiscal_year`
- Query pattern: `findByFiscalYear()` — all plans for a given fiscal year; annual reporting
- Expected benefit: Annual budget reports query by year. Without index: full table scan every year-end report.
- Storage cost: ~10 KB per 10k plans
- Write cost: Negligible (fiscalYear is immutable after creation)
- Recommendation: **ADD** `@@index([fiscal_year])`

**R-IDX-006**
- Table: `procurement_plans`
- Columns: `organization`
- Query pattern: `findByOrganization()` — plans for a specific org unit
- Expected benefit: Multi-org deployments (central management + branch units) require per-org queries.
- Storage cost: ~10 KB per 10k plans
- Write cost: Negligible
- Recommendation: **ADD** `@@index([organization])`

---

### procurement_packages

**R-IDX-007**
- Table: `procurement_packages`
- Columns: `status`
- Query pattern: `findByStatus()` — list DRAFT, ACTIVE, CANCELLED packages; primary package dashboard
- Expected benefit: Most-queried column in the package lifecycle. Without index: full scan per status filter.
- Storage cost: ~50 KB per 100k packages
- Write cost: Moderate (status changes frequently through lifecycle)
- Recommendation: **ADD** `@@index([status])`

**R-IDX-008**
- Table: `procurement_packages`
- Columns: `department`
- Query pattern: `findByDepartment()` — all packages owned by a department
- Expected benefit: Department-level package view is a core use case. 
- Storage cost: ~50 KB per 100k packages
- Write cost: Negligible
- Recommendation: **ADD** `@@index([department])`

**R-IDX-009**
- Table: `procurement_packages`
- Columns: `fiscal_year, budget_year`
- Query pattern: Year-range budget reports; filter by both fiscal and budget year in finance view
- Expected benefit: Annual financial reports join on both year columns. Composite index covers both single-column and compound queries.
- Storage cost: ~80 KB per 100k packages
- Write cost: Negligible (both fields immutable after creation)
- Recommendation: **ADD** `@@index([fiscal_year, budget_year])`

---

### package_proposals

**R-IDX-010**
- Table: `package_proposals`
- Columns: `plan_id`
- Query pattern: `findByPlanId()` — all proposals for a plan; plan detail view
- Expected benefit: Every plan detail view loads its proposals. Without index: O(n) scan of all proposals.
- Storage cost: ~10 KB per 10k proposals
- Write cost: Negligible
- Recommendation: **ADD** `@@index([plan_id])`

**R-IDX-011**
- Table: `package_proposals`
- Columns: `status`
- Query pattern: `findByStatus()` — list proposals awaiting approval
- Expected benefit: Approval queue view.
- Storage cost: ~10 KB per 10k proposals
- Write cost: Low
- Recommendation: **ADD** `@@index([status])`

---

### funding_allocations

**R-IDX-012**
- Table: `funding_allocations`
- Columns: `plan_id`
- Query pattern: `findByPlanId()`, `sumByPlanId()` — funding summary for a plan
- Expected benefit: Budget validation queries funding allocations by plan. Critical for validatePlanAgainstMasterData.
- Storage cost: ~10 KB per 10k allocations
- Write cost: Negligible
- Recommendation: **ADD** `@@index([plan_id])`

---

### procurement_demands

**R-IDX-013**
- Table: `procurement_demands`
- Columns: `fiscal_year, department`
- Query pattern: `findByFiscalYear()`, `findByDepartment()` — demand consolidation per dept per year
- Expected benefit: Demand consolidation is a periodic batch operation; composite index covers both query patterns.
- Storage cost: ~10 KB per 10k demands
- Write cost: Negligible
- Recommendation: **ADD** `@@index([fiscal_year, department])`

---

### annual_procurement_plans

**R-IDX-014**
- Table: `annual_procurement_plans`
- Columns: `fiscal_year, organization`
- Query pattern: `findByFiscalYear()`, `findByOrganization()` — annual plan lookup
- Expected benefit: One annual plan per org per year — query is frequent for budget dashboard.
- Storage cost: Minimal (expected <1k rows total)
- Write cost: Negligible
- Recommendation: **ADD** `@@index([fiscal_year, organization])`

---

### Tables with adequate indexing (no action required)

| Table | Reason |
|-------|--------|
| `legal_documents` | Already has indexes on `documentId` chains |
| `articles` | `@@index([documentId, number])` already present |
| `legal_citations` | `@@index([citingDocId])`, `@@index([citedDocId])` already present |
| `legal_keywords` | `@@unique([term, domain])`, `@@index([domain])` already present |
| `package_items` | FK `packageId` is sufficient; queried only by package scope |
| `package_budgets` | FK `packageId` is sufficient; one budget per package |
| `package_attachments` | FK `packageId`; no cross-package queries expected |
| `package_history` | FK `packageId`; audit log, not queried by status |
| `md_*` (master data) | Small tables; full scans are acceptable; `code` is @unique |

---

## N+1 Risk Assessment

| Pattern | Risk | Mitigation |
|---------|------|------------|
| Loading plan → then looping requests | HIGH | Use `findByPlanId()` in single query; never load all requests then filter |
| Loading packages → then looping items | MEDIUM | Use `findByPackageId()` batch query |
| Validating funding → looping per source | LOW | `sumByPlanId()` aggregates in one query |
| Master data validation per-field | LOW | `Promise.all()` already used in packageIntegration |

---

## Migration Risk Assessment

| Risk | Table | Notes |
|------|-------|-------|
| JSON column growth | `procurement_packages.schedule`, `funding`, `participants` | JSON columns will not be indexed. Extract to separate tables if queried individually. |
| String arrays | `requestIds[]`, `generatedPackageIds[]`, `planIds[]` on plan/annual tables | Arrays prevent individual element index. Recommend junction tables before scale. |
| Float for monetary values | `estimatedValue`, `estimatedCost`, `totalBudget` | Float has precision loss risk for VND amounts. Consider `Decimal` type before production migration. |

---

## Recommended Prisma Schema Additions

Apply to `prisma/schema.prisma` before first production migration:

```prisma
// procurement_requests
@@index([status])
@@index([department])
@@index([plan_id])

// procurement_plans
@@index([status])
@@index([fiscal_year])
@@index([organization])

// procurement_packages
@@index([status])
@@index([department])
@@index([fiscal_year, budget_year])

// package_proposals
@@index([plan_id])
@@index([status])

// funding_allocations
@@index([plan_id])

// procurement_demands
@@index([fiscal_year, department])

// annual_procurement_plans
@@index([fiscal_year, organization])
```
