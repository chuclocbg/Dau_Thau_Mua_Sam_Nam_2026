# Project Blueprint

**Purpose:** Connect business goals to technical execution — the plan that ties
[Business Architecture](BUSINESS_ARCHITECTURE.md) to [Technical Architecture](TECHNICAL_ARCHITECTURE.md).

**Audience:** Anyone needing to understand *why* the build order was chosen.

**Dependencies:** [Business Architecture](BUSINESS_ARCHITECTURE.md), [Technical Architecture](TECHNICAL_ARCHITECTURE.md).

**Related:** [Roadmap](ROADMAP.md) · [`../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md`](../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md)

## Table of Contents

1. [The Build Strategy](#the-build-strategy)
2. [Why Infrastructure Before Business Expansion](#why-infrastructure-before-business-expansion)
3. [Why Knowledge Platform Before AI Advisory](#why-knowledge-platform-before-ai-advisory)
4. [The Test-First, Freeze-After Discipline](#the-test-first-freeze-after-discipline)

---

## The Build Strategy

Business core (A–I) → Infrastructure (J Auth, K Storage, L Notification, M Prisma) →
Knowledge Layer (N) → Business Expansion (O–U) → Platform Services (V–W, X) → External
Integration (Y). Each phase builds only on what's already frozen beneath it — never forward
references to unbuilt capability.

## Why Infrastructure Before Business Expansion

Building Supplier/Tender/Bid modules (O–S) before Auth, Storage, and a production Prisma layer
existed would have required rewriting them once that infrastructure arrived. This was an
explicit decision (`app/.memory/roadmap-v2.md`), not an accident of scheduling.

## Why Knowledge Platform Before AI Advisory

Phase X cannot reason about legal applicability without something to reason *over*. The
Knowledge Platform had to exist, be proven at scale (16 providers, 4 layers), and be frozen
before an AI layer could be designed against a stable contract. Building them in the reverse
order would have meant designing Phase X against a moving target.

## The Test-First, Freeze-After Discipline

Every module: write tests → implement → verify 100% pass → freeze. No module has ever been
frozen with a failing test. No frozen module has ever been un-frozen. This discipline is the
single reason 13,721 tests have survived 21 phases of continuous addition without a
regression — see [`../04_PROJECT_MEMORY/LESSONS_LEARNED.md`](../04_PROJECT_MEMORY/LESSONS_LEARNED.md)
for what happens on the rare occasions a pre-freeze test failure was found.
