# Hexagonal Architecture Rules

These rules are absolute. Violations require an ADR to document exceptions.
Source file: `PROJECT_CONSTITUTION.md` (root of repository)

---

## PRINCIPLE-1: Domain Purity

Domain types and functions have zero imports from framework, ORM, or HTTP libraries.
`src/legal/domain/`, `src/procurement/domain/`, and all `*Types.ts` files are pure TypeScript.

## PRINCIPLE-2: Repository Abstraction

Services receive repository interfaces, never implementations.
`IBaseRepository<T>` lives in `src/shared/repository/IBaseRepository.ts`.
No service file ever imports from `*prisma*.ts` directly.

## PRINCIPLE-3: One-Way Integration Bridges

Cross-module coupling is only permitted via `*Integration.ts` bridge files.
The bridge is owned by the consuming (newer) module.
Frozen modules never import from bridge files.

## PRINCIPLE-4: No Circular Dependencies

Module A importing Module B while Module B imports Module A is a build error.
Dependency graph must be a DAG (directed acyclic graph).

## PRINCIPLE-5: Frozen Modules Are Immutable

After a module is frozen:
- Service signatures are never changed
- Type definitions are never modified
- New behavior is added only via a new bridge or a new module
- The only exception: critical bug fixes with ADR documentation

## PRINCIPLE-6: Legal Citations Are Structured

`LegalBasis` is the canonical citation type:
```typescript
interface LegalBasis {
  documentSymbol: string   // e.g. '22/2023/QH15'
  articleRef?:    string   // e.g. 'Điều 15'
  clauseRef?:     string   // e.g. 'Khoản 2'
  quotedText?:    string
  effectiveFrom:  string
}
```
`string[]` for legal citations is a RULE-09 violation.

## PRINCIPLE-7: Money Is Bigint

```typescript
interface Money {
  amount:   bigint        // VNĐ in integer form (no decimals in VNĐ)
  currency: CurrencyCode  // 'VND'
}
```
`number`, `float`, or `Decimal` for monetary values is a KI-004 violation.

## PRINCIPLE-8: No Business Logic In Bridge Files

Bridge files translate data shapes and call frozen module APIs.
They contain zero business rules, zero conditionals based on procurement logic.

---

## RULE-09: Structured Legal Citations

**All legal citations in domain types and business rules must use `LegalBasis[]`, not `string[]`.**

Violations:
- `acceptanceService.ts` — TD-01 (known violation, frozen, tracked)
- Any new code writing `string[]` for legal citations is a build-time concern

---

## Naming Conventions

| Pattern | Example |
|---------|---------|
| Domain type (entity) | `ProcurementPackage`, `ApprovalRequest` |
| Domain type (string union) | `ProcurementPackageKind`, `ProcurementMethodCode` |
| Repository interface | `IProcurementPackageRepository` |
| Memory implementation | `MemoryProcurementPackageRepository` |
| Prisma implementation | `PrismaProcurementPackageRepository` |
| Integration bridge | `packageIntegration.ts` |
| Service | `packageService.ts` |
| Validation | `packageValidation.ts` |
| Factory | `packageFactory.ts` |
| Test file | `package.test.ts` |

---

## Allowed Import Directions

```
New Module → (via Integration Bridge) → Frozen Module Public API
Service → Repository Interface
Domain Functions → (no imports)
Repository Interface → Domain Types only
Memory Repo → Repository Interface + Domain Types
Prisma Repo → Repository Interface + Domain Types + Prisma Client
Integration Bridge → Frozen Module Public API + own module types
```

**Prohibited:**
```
Frozen Module → New Module (any direction)
Service → Prisma Repo directly
Domain → Repository Interface
Test → Prisma Repo (tests use Memory Repos)
Any file → internal implementation details of another module
```
