# ADR-009 — Master Data Owns Every Reference Value

Status: ACCEPTED
Date: 2026-07-02

---

## Context

The platform uses many reference values across modules: department codes, fund source
codes, package type codes, procurement method codes, approval authority codes,
document template codes, vendor codes, budget year codes.

If these values are hardcoded in services or duplicated across modules,
a single change (new department, new fund source, annual budget year rollover)
requires updating multiple files.

---

## Decision

The Master Data module (`src/masterdata/`) is the single owner of all reference values.

Included in Master Data:
- `Department` — department/unit codes and names
- `Employee` — employee codes for approvers and requesters
- `ApprovalAuthority` — authority level entities with maxValue thresholds
- `FundSource` — funding source codes (STATE, ODA, PPP, ENTERPRISE + custom)
- `BudgetYear` — fiscal year activation and budget ceiling
- `PackageType` — package kind entities and descriptions (not to be confused with `ProcurementPackageKind` string union)
- `ProcurementMethod` — method entities (not to be confused with `ProcurementMethodCode` string union)
- `ProcurementCategory` — procurement category classifications
- `DocumentTemplate` — templates for generated documents
- `Vendor` — vendor/supplier entities

All services that need a reference value:
1. Receive a `MasterDataRepositories` bag (or a `Pick<>` of it) as a parameter.
2. Call `repo.findByCode(code)` at runtime to look up the value.
3. Check `entity.isActive && !entity.isArchived` before using the value.

No service may hardcode a department code, fund source code, or other reference value
in business logic (exception: test fixtures and `seedDefaultData()`).

---

## Consequences

**Positive:**
- Adding a new department, fund source, or authority level is a data operation,
  not a code change.
- Validation against active, non-archived records prevents use of stale codes.
- Master Data can be managed via admin UI without deploying code.

**Negative:**
- Every validation that references a code requires an async repository lookup.
  `Promise.all()` is the standard pattern for parallel validation.
- seedDefaultData() must be kept current as the legal landscape changes.

---

## Alternatives Rejected

**Enum types for all reference values**: TypeScript enums or const arrays define
the valid set. Rejected because enums require a code deploy to add a new value,
whereas Master Data supports runtime configuration.

**Hardcoded maps in services**: `AUTHORITY_VALUE_LIMITS` map in `workflowValidator.ts`
was an example of this pattern. It was superseded by `masterdataIntegration.ts` which
resolves limits from Master Data at runtime. Future patterns follow the integration
bridge approach, not the hardcoded map approach.
