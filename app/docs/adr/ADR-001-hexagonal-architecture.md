# ADR-001 — Hexagonal Architecture

Status: ACCEPTED
Date: 2026-07-02

---

## Context

The platform must support multiple infrastructure options (memory, Prisma/PostgreSQL,
future REST adapters) without changing business logic. Tests must run without a
database. Business logic must be portable across deployment targets.

---

## Decision

Apply hexagonal architecture (Ports and Adapters).

Layer order (inner to outer):
1. Domain — pure types and stateless functions. No infrastructure dependency.
2. Application — orchestrates domain services. Depends on repository interfaces.
3. Repository Interface — `IBaseRepository<T>` and module-specific extensions.
4. Infrastructure — Memory implementations (tests/dev) and Prisma implementations (production).

Domain never imports from Infrastructure. Infrastructure always imports from Domain.

---

## Consequences

**Positive:**
- All business logic is testable without a running database.
- Storage backend is swappable without touching services.
- Domain types are portable to any future transport (REST, gRPC, CLI).

**Negative:**
- More files per module than a direct ORM approach.
- Repository interfaces must be kept in sync with concrete implementations.

---

## Alternatives Rejected

**Active Record pattern**: Domain entities contain their own persistence logic.
Rejected because domain types become coupled to the ORM, making testing harder
and violating the legal domain's need for pure, law-traceable functions.

**Anemic domain model with fat services**: All logic in services with thin entities.
Not rejected — this is partially what we do — but the key distinction is that
services still depend on interfaces, not concrete classes.
