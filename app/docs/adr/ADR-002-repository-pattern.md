# ADR-002 — Repository Pattern

Status: ACCEPTED
Date: 2026-07-02

---

## Context

Services need to persist and retrieve domain entities. The implementation of
persistence (in-memory Map, Prisma, IndexedDB, REST) changes across environments.
Services must not change when the storage backend changes.

---

## Decision

Every domain entity type has a corresponding repository interface that extends
`IBaseRepository<T>` from `src/shared/repository/IBaseRepository.ts`.

Interfaces live in `*Repository.ts` files alongside the types they serve.
Concrete implementations live in `memory*.ts` (tests/dev) and `prisma*.ts` (production).
Services accept repository bags (`XRepositories`) as function parameters — never singletons.

`IBaseRepository<T>` defines: `create`, `update`, `delete`, `findById`, `findAll`, `count`.
Module-specific methods (`findByCode`, `findByStatus`, `search`) extend from this base.

---

## Consequences

**Positive:**
- Swapping from memory to Prisma requires no service changes.
- Unit tests use fast in-memory repos; integration tests can use Prisma.
- Repository bags passed as parameters make dependencies explicit and injectable.

**Negative:**
- Every new entity requires a new interface + two concrete implementations.
- Interfaces must be extended carefully — adding a method to an interface
  requires updating all implementations.

---

## Alternatives Rejected

**Direct Prisma calls in services**: Fast to write, but ties services to the ORM.
Rejected because legal domain services must be testable without database infrastructure.

**Singleton repository pattern**: One shared instance per repo type.
Rejected because test isolation requires independent repo instances per test.
