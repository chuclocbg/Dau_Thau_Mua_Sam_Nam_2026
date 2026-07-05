# Architecture Map

Module dependency directions as of Phase H.5.
Arrows = "imports from". Reverse arrows are PROHIBITED.

---

## Shared Infrastructure (bottom layer)

```
src/shared/repository/IBaseRepository.ts
  ↑ imported by: all repository interfaces
```

```
src/shared/financial/   (Phase H.5)
  ↑ imported by: Payment, Dashboard, AI Advisory, Reporting, Asset (future)
  ↓ imports from: masterdata (integration only), legal (integration only)
```

---

## Domain Modules (frozen)

```
Legal Foundation (src/legal/)
  └─ no imports from other business modules

Master Data (src/masterdata/)
  └─ no imports from other business modules

Workflow Engine (src/procurement/workflow/)
  └─ sealed — no imports from business modules

Procurement Rule Engine (src/procurement/rules/, application/)
  └─ imports: procurement/domain/procurementTypes only
```

---

## Business Modules (frozen — dependency order)

```
Procurement Planning
  └─ imports: Package, Workflow (via bridge), MasterData, RuleEngine

Approval Module (src/approval/)
  └─ imports: Package, Planning, Workflow (via bridge), MasterData

Contract Module (src/contract/)
  └─ imports: Package (types), Workflow (via bridge)

Acceptance Module (src/acceptance/)
  └─ imports: Contract (types), Workflow (via bridge)

Shared Financial Domain (src/shared/financial/)
  └─ imports: MasterData (via financialIntegration only), Legal (via financialIntegration only)
  └─ does NOT import: Workflow, Approval, Contract, Acceptance, Payment
```

---

## Planned Modules (not yet frozen)

```
Payment (Phase I)
  └─ will import: Acceptance (types), Contract (types), SharedFinancial, MasterData

Asset Module (future)
  └─ will import: Contract (types), SharedFinancial, MasterData

Dashboard / Reporting (future)
  └─ will import: all modules (read-only aggregation)

AI Advisory (future)
  └─ will import: all modules (read-only recommendations)
  └─ MUST NOT: make legally binding decisions (PRINCIPLE 7)
```

---

## Integration Bridge Pattern

Every cross-module boundary uses `*Integration.ts`:
- Bridge file imports from frozen module — one-way
- Frozen module NEVER imports back from bridge
- Bridge file is part of the NEW module, not the frozen one

Current bridges:
```
approval/approvalIntegration.ts    → package, planning, workflow, masterdata
contract/contractIntegration.ts    → package (types), workflow
acceptance/acceptanceIntegration.ts → contract (types), workflow
shared/financial/financialIntegration.ts → masterdata, legal
```

---

## Architecture Freeze Rules

1. No file in a FROZEN module may be modified.
2. New imports INTO a frozen module are prohibited.
3. New modules extend via Integration bridges only.
4. `PROJECT_CONSTITUTION.md` principles are immutable.
5. `IBaseRepository` in `src/shared/repository/` is canonical — never duplicate.
