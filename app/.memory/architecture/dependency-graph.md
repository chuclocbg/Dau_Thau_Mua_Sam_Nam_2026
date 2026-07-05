# Module Dependency Graph

Directed Acyclic Graph. Arrows point from consumer to dependency.
"A → B" means: A imports from B (A depends on B).

---

## Frozen Business Modules

```
Legal Foundation (leaf — no business deps)

MasterData (leaf — no business deps)
  ↑ consumed by: Package, Planning, Workflow, Approval, Contract

Workflow Engine (leaf — no business deps)
  ↑ consumed by: Package, Planning, Approval, Contract, Acceptance

Procurement Rule Engine
  └→ procurementTypes (own domain)
  ↑ consumed by: Package, Planning

Shared Financial Domain
  └→ masterdataTypes (for CurrencyCode)
  └→ legalSchema (for LegalReference)
  ↑ consumed by: Payment

Package
  └→ Workflow (via masterdataIntegration bridge)
  └→ MasterData
  └→ RuleEngine
  ↑ consumed by: Planning, Approval

Planning
  └→ Package
  └→ MasterData
  └→ Workflow (via planningIntegration bridge)
  └→ RuleEngine
  ↑ consumed by: Approval

Approval
  └→ Package
  └→ Planning
  └→ Workflow
  └→ MasterData
  ↑ consumed by: Contract

Contract
  └→ Approval (via contractIntegration bridge)
  └→ Workflow
  ↑ consumed by: Acceptance

Acceptance
  └→ Contract (via acceptanceIntegration bridge)
  └→ Workflow
  ↑ consumed by: Payment

Payment
  └→ Acceptance
  └→ Contract
  └→ SharedFinancial
  ↑ consumed by: (API layer, Phase X AI Advisory)
```

---

## Topological Order (safe build/test order)

```
Level 0 (leaves): Legal, MasterData, Workflow, RuleEngine, SharedFinancial
Level 1:          Package (← MasterData, Workflow, RuleEngine)
Level 2:          Planning (← Package, MasterData, Workflow, RuleEngine)
Level 3:          Approval (← Planning, Package, Workflow, MasterData)
Level 4:          Contract (← Approval, Workflow)
Level 5:          Acceptance (← Contract, Workflow)
Level 6:          Payment (← Acceptance, Contract, SharedFinancial)
```

---

## Future Dependency Graph (Phases J–X)

```
Auth (leaf)
  ↑ consumed by: Storage, Notification, Knowledge, all Phase O+

Storage (← Auth)
  ↑ consumed by: Knowledge, Supplier, Tender, Bid, Contract(M), ...

Notification (← Auth)
  ↑ consumed by: Approval, Contract, Tender, Bid, ...

Prisma Layer (← Auth, Storage, Notification, all 12 business modules)
  ↑ consumed by: Knowledge, all Phase O+

Knowledge Platform (← Prisma, Storage, Auth)
  └→ Legal (via knowledgeIntegration bridge)
  ↑ consumed by: Reasoning Layer, all Phase O+ (indirectly via Reasoning)

Reasoning Layer (← Knowledge Platform)
  ↑ consumed by: AI Context Layer

AI Context Layer (← Reasoning Layer)
  ↑ consumed by: AI Advisory Layer (Phase X)

AI Advisory Layer (← AI Context Layer, all business modules)
  ↑ consumed by: HTTP API / UI
```

---

## Dependency Violation Check

Run this check before writing any new import:

```
Is the module I'm importing from FROZEN?
  YES → Am I in an *Integration.ts file?
    YES → proceed (this is the only valid crossing)
    NO  → VIOLATION: create/use an integration bridge instead
  NO → proceed (new-to-new imports are fine as long as no cycle)

Does this import create a cycle?
  YES → VIOLATION: restructure to break the cycle (new module owns the bridge)
  NO → proceed
```
