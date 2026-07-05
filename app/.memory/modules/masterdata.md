# Module: Master Data

**Status:** FROZEN (v1.0, 2026-07-02)
**Location:** `src/masterdata/`
**Tests:** ~234

---

## Purpose

Manages all reference/lookup data that other modules consume: departments, package types,
procurement methods, budget codes, funding sources, approval authorities, currencies.
Leaf module — no imports from any other business module.

---

## Files

- `masterdataTypes.ts` — all entity types
- `masterdataRepository.ts` — repository interfaces
- `masterdataIntegration.ts` — bridge FROM masterdata TO workflow engine
- `memoryMasterData.ts` — in-memory implementations
- `prismaMasterData.ts` — Prisma stubs

---

## Public API (key exports)

```typescript
// Entity types
Department          { id, code, name, parentId?, budgetCodePrefix }
PackageType         { id, code, name, procurementMethods: string[], maxDirectValue?: bigint }
ProcurementMethod   { id, code, name, applicableTypes: string[], legalBasis: LegalBasis[] }
ApprovalAuthority   { id, level: ApprovalAuthorityLevel, name, valueThreshold: bigint, ... }
FundingSource       { id, code, name, type: 'STATE' | 'ODA' | 'OTHER' }
BudgetCode          { id, code, name, departmentId, fiscalYear }
Currency            { code: CurrencyCode, name, symbol }

// Repository interfaces
IDepartmentRepository extends IBaseRepository<Department>
IPackageTypeRepository extends IBaseRepository<PackageType>
IProcurementMethodRepository extends IBaseRepository<ProcurementMethod>
IApprovalAuthorityRepository extends IBaseRepository<ApprovalAuthority>

// Seed function
seedDefaultData(repos): Promise<void>   ← seeds standard Vietnamese procurement data
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts`
- `src/shared/financial/financialTypes.ts` (for LegalBasis, CurrencyCode, Money)
- No other business module imports

---

## Consumers

All higher-level modules via their integration bridges.
`masterdataIntegration.ts` is the bridge to Workflow Engine.

---

## Business Rules Enforced

- `ApprovalAuthority.valueThreshold` is in bigint (VNĐ, no decimal)
- `PackageType.maxDirectValue` = null means no direct procurement limit for that type
- `FundingSource.type` determines which circulars apply (STATE → TT 79/2025/TT-BTC)
- `seedDefaultData()` is idempotent — safe to call multiple times

---

## Seed Data (via seedDefaultData)

- 5 package types: GOODS, SERVICE, CONSTRUCTION, CONSULTING, MIXED
- 3 procurement methods: OPEN_TENDER, COMPETITIVE_QUOTE, DIRECT_AWARD
- 4 approval authority levels: UNIT_HEAD, DEPARTMENT_DIRECTOR, MINISTER, PRIME_MINISTER
- Standard Vietnamese departments (customizable per institution)

---

## Known Limitations

- Prisma repos are stubs until Phase M
- No change history on reference data (static snapshots)

---

## Extension Policy

New reference types → new entity + repository interface + memory impl.
New seed data → extend `seedDefaultData()`.
No module-level changes required for new department codes or budget structures.
