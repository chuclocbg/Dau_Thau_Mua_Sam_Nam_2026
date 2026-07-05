# Technical Architecture

**Purpose:** Explain the architectural style, layering, and extension discipline that every
module in this repository follows, and why.

**Audience:** Any developer or AI about to write code in this repository.

**Dependencies:** [Constitution](CONSTITUTION.md).

**Status:** Describes the architecture as built through Phase N. Phase X's architecture is
documented separately in [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md) since it
introduces new layers on top of this one, not a replacement of it.

**Related:** [Module Catalog](MODULE_CATALOG.md) · [Domain Model](DOMAIN_MODEL.md) ·
[`../02_AI_CONTEXT/DEPENDENCY_RULES.md`](../02_AI_CONTEXT/DEPENDENCY_RULES.md) ·
[`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md)

## Table of Contents

1. [Style: Hexagonal + Integration Bridge](#style-hexagonal--integration-bridge)
2. [The Layer Stack](#the-layer-stack)
3. [The Freeze Discipline](#the-freeze-discipline)
4. [The Knowledge Platform's Different Extension Model](#the-knowledge-platforms-different-extension-model)
5. [Persistence Strategy](#persistence-strategy)
6. [Why This Architecture, Not Another](#why-this-architecture-not-another)

---

## Style: Hexagonal + Integration Bridge

Every business module follows ports-and-adapters (hexagonal) architecture: a domain core with
no framework dependencies, wrapped by an application layer, exposed through repository
interfaces, and implemented twice — once in memory (for tests and early development) and once
against Prisma (for production). Cross-module communication never happens through direct
imports between two business modules; it happens through a one-way `*Integration.ts` bridge
file that imports the frozen module and adds behavior around it, never inside it.

## The Layer Stack

```
Interface / API Layer       (src/procurement/api/, src/interface/)
        │
Application Layer            (src/procurement/application/, orchestrates, thin)
        │
Domain Layer                 (src/legal/domain/, src/procurement/domain/ — pure functions)
        │
Repository Interfaces        (src/shared/repository/IBaseRepository.ts — no Prisma here)
        │
        ├─→ Memory Repositories   (memory<Module>Repositories.ts — tests, dev)
        └─→ Prisma Repositories   (prisma<Module>Repositories.ts — production)
```

## The Freeze Discipline

Every one of the 13 business modules and 3 infrastructure modules was built, tested, reviewed,
and then declared **frozen** — no file inside it may be edited again, for any reason, including
bug fixes. This is not a suggestion; it has held for 21 phases without exception. When a bug is
found in frozen code (e.g., TD-01, TD-02 — see [`../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../02_AI_CONTEXT/TECHNICAL_DEBT.md)),
it is tracked as debt and fixed via a bridge layer, never by unfreezing the source. The
trade-off is explicit: this guarantees regression safety (13,721 tests have never broken across
21 phases) at the cost of some debt accumulating in code that can't be touched directly.

## The Knowledge Platform's Different Extension Model

The Knowledge Platform (Phase N) uses a stronger, more general extension mechanism than the
Integration Bridge: **registration**. A new knowledge domain is added by implementing
`IKnowledgeProvider` (4 methods: `search/resolve/suggest/score`) and calling
`platform.registerProvider(new SomeProvider(...))` — zero changes anywhere in the platform
core. This was proven 16 times, across 4 layers, in 4 controlled batches, with zero core file
ever touched. Full detail: [Knowledge Platform](KNOWLEDGE_PLATFORM.md).

## Persistence Strategy

Every module is built memory-first, Prisma-later — this is deliberate sequencing, not
incompleteness. A module's business logic and tests are proven against an in-memory repository
before a Prisma-backed implementation is ever written, so persistence bugs never get confused
with logic bugs. As of this writing, 11 of the 13 business/infra modules have a Prisma
implementation (Phase M1); the Knowledge Platform does not yet (deferred, not forgotten — see
[Roadmap](ROADMAP.md)'s N.5).

## Why This Architecture, Not Another

**Rejected: a shared ORM-first design** (define Prisma models first, derive types from them).
Rejected because it would couple domain logic to a specific database technology from day one,
and this project's own history shows Prisma's connection pattern changed between major versions
(the `datasource.url` → driver-adapter migration) — logic that depended on Prisma's shape
directly would have needed rework twice already.

**Rejected: a single monolithic service layer** (one `ProcurementService` class handling
planning, package, approval, contract, etc.). Rejected because it would violate bounded-context
separation and make the "frozen module, extend via bridge" discipline impossible — you can't
freeze one class that owns five domains' worth of logic.

**Accepted:** the current hexagonal + bridge + registration model, because it has already
survived 21 phases and one entire new subsystem (Knowledge Platform, 16 providers) without a
single regression or a single core-file modification.
