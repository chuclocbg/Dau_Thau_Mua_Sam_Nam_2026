# Architecture Overview

Version: 1.0 (Frozen 2026-07-02)

---

## Layer Stack

```
┌─────────────────────────────────────────────┐
│  API / Interface Layer                       │
│  src/procurement/api/  src/interface/        │
│  Pure functions. No HTTP framework wiring.   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Application Layer                           │
│  src/procurement/application/               │
│  src/application/                           │
│  Orchestrates domain services.              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Domain Layer                                │
│  src/legal/domain/                          │
│  src/procurement/domain/                    │
│  src/procurement/*/...Types.ts              │
│  Stateless pure functions. No Prisma.       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Repository Interface Layer                  │
│  src/shared/repository/IBaseRepository.ts   │
│  src/*/...Repository.ts                     │
│  Services depend only on these interfaces.  │
└──────────────────┬──────────────────────────┘
                   │
     ┌─────────────┴────────────┐
     │                          │
┌────▼──────────┐   ┌───────────▼────────┐
│ Memory Repos  │   │  Prisma Repos      │
│ (tests, dev)  │   │  (production)      │
│ memory*.ts    │   │  prisma*.ts        │
└───────────────┘   └────────────────────┘
                              │
                   ┌──────────▼────────────┐
                   │  PostgreSQL (Prisma)   │
                   │  prisma/schema.prisma  │
                   └───────────────────────┘
```

---

## Module Map

```
src/
├── shared/
│   └── repository/
│       └── IBaseRepository.ts       ← canonical base for all repos
│
├── legal/
│   ├── domain/                      ← pure legal domain services
│   ├── legalSchema.ts               ← entity types
│   ├── legalRepositories.ts         ← repo interfaces
│   ├── memoryRepositories.ts        ← in-memory impl
│   └── prismaRepositories.ts        ← Prisma stubs (SPEC ONLY)
│
├── masterdata/
│   ├── masterdataTypes.ts
│   ├── masterdataRepository.ts
│   ├── masterdataIntegration.ts     ← bridge to workflow engine
│   ├── memoryMasterData.ts
│   └── prismaMasterData.ts
│
└── procurement/
    ├── domain/
    │   └── procurementTypes.ts      ← ProcurementPackageKind, ProcurementMethodCode,
    │                                   ApprovalAuthorityLevel (string unions)
    ├── rules/
    │   └── procurementRules.ts      ← rule definitions with legal citations
    ├── application/
    │   └── procurementEngine.ts     ← stateless 6-capability engine
    ├── api/
    │   └── procurementApi.ts        ← pure JSON wrappers
    ├── workflow/
    │   ├── workflowEngine.ts        ← SEALED — 8 public functions
    │   ├── workflowState.ts
    │   ├── workflowHistory.ts
    │   ├── workflowContext.ts
    │   ├── workflowTransition.ts
    │   └── workflowValidator.ts
    ├── package/
    │   ├── packageTypes.ts
    │   ├── packageRepository.ts
    │   ├── packageService.ts
    │   ├── packageValidation.ts
    │   ├── packageIntegration.ts    ← bridge: package ↔ workflow/masterdata/rules
    │   └── memoryPackageRepositories.ts
    └── planning/
        ├── planningTypes.ts
        ├── planningRepository.ts
        ├── planningService.ts
        ├── planningValidation.ts
        ├── planningIntegration.ts   ← bridge: planning ↔ workflow/masterdata/rules/package
        └── memoryPlanningRepositories.ts
```

---

## Allowed Dependency Directions

```
Planning
  → Package
  → Workflow (via masterdataIntegration bridge)
  → MasterData
  → RuleEngine (ProcurementEngine)

Package
  → Workflow (via masterdataIntegration bridge)
  → MasterData
  → RuleEngine

MasterData
  → (none — leaf module)

Workflow
  → (none — sealed, leaf module)

Legal
  → (none — isolated, no imports from procurement)

RuleEngine
  → procurement/domain/procurementTypes only

Document Generator (planned)
  → Planning (read-only)
  → Package (read-only)
  → MasterData (read-only)
  → Legal (read-only)
```

**Reverse arrows are prohibited.** Workflow never imports Planning. MasterData never imports Package.

---

## Integration Bridge Pattern

Each module boundary is crossed via an `*Integration.ts` file:
- `masterdataIntegration.ts` — MasterData → Workflow bridge
- `packageIntegration.ts` — Package ↔ Workflow/MasterData/RuleEngine
- `planningIntegration.ts` — Planning ↔ Workflow/MasterData/RuleEngine/Package

These files import from frozen modules. Frozen modules never import back.
This is the only permitted way to cross a module boundary for complex orchestration.

---

## Type Naming Convention

| Domain concept | Type location | Type name |
|---|---|---|
| Package kind (string enum) | `procurement/domain/procurementTypes.ts` | `ProcurementPackageKind` |
| Package type (entity) | `masterdata/masterdataTypes.ts` | `PackageType` (interface) |
| Method code (string enum) | `procurement/domain/procurementTypes.ts` | `ProcurementMethodCode` |
| Method entity | `masterdata/masterdataTypes.ts` | `ProcurementMethod` (interface) |
| Authority level (string enum) | `procurement/domain/procurementTypes.ts` | `ApprovalAuthorityLevel` |
| Authority entity | `masterdata/masterdataTypes.ts` | `ApprovalAuthority` (interface) |
