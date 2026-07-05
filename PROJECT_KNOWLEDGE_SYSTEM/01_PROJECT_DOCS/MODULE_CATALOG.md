# Module Catalog

**Purpose:** Every module in the repository — what it does, its status, its test count, where
it lives.

**Audience:** Anyone needing to find or understand a specific module.

**Dependencies:** [Technical Architecture](TECHNICAL_ARCHITECTURE.md).

**Status:** Reflects the repository as of `v1.0-knowledge-platform`.

**Related:** [Domain Model](DOMAIN_MODEL.md) · [`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md) · [`../02_AI_CONTEXT/REPOSITORY_CONTEXT.md`](../02_AI_CONTEXT/REPOSITORY_CONTEXT.md)

## Table of Contents

1. [Business Modules (Phases A–L)](#business-modules-phases-al)
2. [Infrastructure (Phases M0–M1)](#infrastructure-phases-m0m1)
3. [Knowledge Platform (Phase N)](#knowledge-platform-phase-n)
4. [Pre-Existing, Unrelated Modules](#pre-existing-unrelated-modules)

---

## Business Modules (Phases A–L)

| Phase | Module | Location | Status |
|---|---|---|---|
| A1 | Legal Foundation | `src/legal/` | FROZEN |
| A1 | Legal Document Importer | `src/agents/` (3 files only) | FROZEN |
| B | Workflow Engine | `src/procurement/workflow/` | FROZEN |
| B | Procurement Rule Engine | `src/procurement/rules/`, `application/` | FROZEN |
| C | Master Data | `src/masterdata/` | FROZEN |
| D | Procurement Package | `src/procurement/package/` | FROZEN |
| E | Procurement Planning | `src/procurement/planning/` | FROZEN |
| F | Approval | `src/approval/` | FROZEN |
| G | Contract | `src/contract/` | FROZEN |
| H | Acceptance | `src/acceptance/` | FROZEN |
| H.5 | Shared Financial Domain | `src/shared/financial/` | FROZEN |
| I | Payment | `src/payment/` | FROZEN |
| J | Auth | `src/auth/` | FROZEN |
| K | Storage & Attachment | `src/storage/` | FROZEN |
| L | Notification | `src/notification/` | FROZEN |

Exact per-module test counts change too fast for a static document — see
[`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md) for the live
repository-wide total (395 files / 13,721 tests as of this writing).

## Infrastructure (Phases M0–M1)

| Phase | What | Status |
|---|---|---|
| M0 | Docker Compose (Postgres, pgAdmin, Redis, MinIO) | Designed, YAML-valid, never started |
| M1 | Prisma production layer (82 models, 48 enums, 67 repository classes) | IMPLEMENTED, PENDING PRODUCTION VERIFICATION |

## Knowledge Platform (Phase N)

Frozen core (`src/knowledge/{platform,graph,search,repositories,application}/`) plus 16 frozen
providers across 4 layers:

| Layer | Domain keys |
|---|---|
| 1 (Legal — nationally binding) | `legal` |
| 2 (Business — operationally binding) | `procurement`, `templates`, `checklists`, `ontology`, `glossary`, `vendor`, `asset`, `budget`, `notification` |
| 3 (Organizational — may exceed Layer 1) | `school` |
| 4 (Experience — advisory only) | `cases`, `risk`, `audit`, `bestpractice`, `ai_feedback` |

Full detail, including graph relation types and provider contracts: [Knowledge Platform](KNOWLEDGE_PLATFORM.md).

## Pre-Existing, Unrelated Modules

These exist in the repository but are **not part of Phases A–N** and were **not** part of the
`v1.0-knowledge-platform` audit or release:

| Location | What | Note |
|---|---|---|
| `src/agents/` (52 of 55 files) | Agent/pipeline orchestration framework | Pre-existing, unaudited by this project |
| `src/orchestrator/` | GLPI adapter, orchestrator runtime | Never committed to this release |
| `src/memory/` | Session/workspace layer | Not the same as `app/.memory/` — see [`../02_AI_CONTEXT/REPOSITORY_CONTEXT.md`](../02_AI_CONTEXT/REPOSITORY_CONTEXT.md) |
| `src/capabilities/` | Procurement/Legal Capability framework | Different phase-numbering scheme (numeric "Phase 17-20," not this project's lettered A-Y) |
| `src/legal/{legalRegistry,knowledgeGraph,graphQueryEngine}.ts` | A second, unrelated Legal model | Coexists with Phase A's `src/legal/` — see naming collision note |

Do not assume any of the above is stable, tested to this project's standard, or safe to build
on without independent verification.
