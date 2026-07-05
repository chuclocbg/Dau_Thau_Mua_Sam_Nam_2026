# Next Task

## Phase I — COMPLETED (2026-07-03)

355 tests. See `src/payment/` and `docs/payment.md`.

---

## Core Platform Review — COMPLETED (2026-07-03)

Full 9-step review done. Key outputs:
- `.memory/architecture-review.md` — dependency graph, violation details
- `.memory/technical-debt.md` — 15 debt items across Critical/High/Medium/Low/Deferred
- `.memory/roadmap-v2.md` — 14 remaining modules with dependencies/complexity/risk/value
- `.memory/repository-health.md` — production readiness score 5.5/10

---

## Project Memory Layer — COMPLETED (2026-07-03)

66 files across 10 subdirectories. See `.memory/sessions/2026-07-03-memory-layer.md`.
Recovery guide: `.memory/start-here.md`.

---

## Phase N3 — AI Context Contract — FROZEN (2026-07-03)

Specification complete. Awaiting user approval to become FROZEN.

| File | Contents |
|------|----------|
| decisions/ai-context-contract.md | Master decision; 3-layer stack; 8 AI boundary rules |
| ai-advisory/context.md | AIContext schema (11 sub-types including systemInstructions) |
| ai-advisory/builder.md | AIContextBuilder 15-step build + token budget compression |
| ai-advisory/adapter.md | ILLMAdapter + 4 adapters + ModelCapabilities + ModelSelector |
| ai-advisory/prompts.md | 12-section PromptBuilder + TokenBudgetManager + PromptRenderer |
| ai-advisory/validation.md | 6 validation checks + hallucination redaction + ValidationLog |

~14 source files | ~546 tests when implemented

---

## Phase N2 — Legal Reasoning Architecture — FROZEN (2026-07-03)

Specification complete. Architecture awaits user approval to become FROZEN.

| File | Contents |
|------|----------|
| decisions/reasoning-architecture.md | Master decision; permanent separation rule; 8 immutable rules; source layout |
| reasoning/types.md | All type definitions (ReasoningResult, ReasoningIntent, AppliedArticle, etc.) |
| reasoning/pipeline.md | 8 stages; 15 responsibilities; PipelineState contract |
| reasoning/conflict.md | 4-tier conflict resolution; 4 worked examples |
| reasoning/rules.md | Rule/threshold KnowledgeItem schema; 12 founding rules; 10 exception patterns |

~15 source files | ~585 tests when implemented (after Phase M)

---

## Phase N1 — Knowledge Corpus Foundation — COMPLETED (2026-07-03)

Specification only. 7 files created in `knowledge/corpus/` and `knowledge/decisions/`.

| Item | File |
|------|------|
| KnowledgeObject + KnowledgeSource + Citation model | corpus/schema.md |
| Document hierarchy + Legal hierarchy (14 levels) | corpus/hierarchy.md |
| Lifecycle (6 states) + Versioning (immutable versions) | corpus/lifecycle.md |
| Metadata tiers + Tagging (16 facets) + Ontology (20 relations) | corpus/metadata.md |
| Quality score (6 dims) + Validation pipeline (8 stages) | corpus/quality.md |
| Import + Update + Indexing (4 indexes) + Bootstrap order | corpus/pipelines.md |
| Master decision | decisions/corpus-foundation.md |

Scale: ~520K objects at launch; ~1M at 5 years. No code. No tests. Implementation follows Phase N.

---

## Phase J — Authentication & Authorization [INFRASTRUCTURE] — FROZEN 2026-07-04

**Status:** COMPLETE. `src/auth/` — 19 source files, ~265 tests, all passing. See ADR-016
(`docs/adr/ADR-010-authentication-strategy.md`) and `.memory/session-summary.md`.

---

## Phase K — Storage & Attachment [INFRASTRUCTURE] — FROZEN 2026-07-05

**Status:** COMPLETE. `src/storage/` — 18 source files, 12 test files, 232 tests, all passing.

**Freeze note:** the 2 tests that were failing at session start (`storage-retention-service.test.ts`)
were outdated fixtures (`retentionDays: 1825` for `INVOICE`) — the implementation was already
correct, enforcing the 3650-day legal minimum (10-year tax-law retention) in
`src/storage/domain/retention.ts:90`. Only the two test fixtures were changed; no business rule
was touched. Freeze checklist passed: one-way dependency (storage → masterdata/auth/shared only,
no frozen module imports storage back), all 10 PROJECT_CONSTITUTION.md principles compliant/N/A.

**Also open:** none of Phases A–K have been committed to git yet (last real commit is an
unrelated earlier track, `7765a02`, 2026-06-28). Committing in phase-sized chunks is now
recommended — see `.memory/project-status.md`.

---

## Phase L — Notification Service [INFRASTRUCTURE] — FROZEN 2026-07-05

**Status:** COMPLETE. `src/notification/` — 22 source files, 20 test files, 276 tests, all
passing. Full design in `docs/notification.md`.

**Scope delivered:** 10 domain entities (Notification, NotificationRecipient,
NotificationChannel, NotificationTemplate, NotificationDelivery, NotificationBatch,
NotificationPreference, NotificationRule, NotificationEvent, NotificationAuditEvent); 6 modes
(IMMEDIATE/SCHEDULED/DELAYED/RECURRING/BULK/EVENT_DRIVEN); 5 channels (EMAIL/SMS/PUSH/IN_APP/
WEBHOOK); provider-neutral routing via `NotificationProviderRegistry` (pure Map lookup, 8
provider types documented, `MockNotificationProvider` + `InAppNotificationProvider` implemented,
the other 6 deferred — adding one is a new class + `registry.register()`, no application changes);
exponential-backoff retry (`DEFAULT_RETRY_POLICY`: 5 attempts, 1s→60s); append-only audit trail;
integration bridge (`notificationIntegration.ts`) for Workflow/Approval/Contract/Acceptance/
Payment event ingestion.

**Freeze checklist passed:** one-way dependency (only `notificationIntegration.ts` imports
`masterdata`; all other cross-module imports are `src/shared/` common vocabulary; zero frozen
modules import `src/notification/`); all 10 PROJECT_CONSTITUTION.md principles compliant/N/A;
`tsc --noEmit` clean repo-wide; full suite 364 files / 13,385 tests, zero regressions.

**Bugs found and fixed during test-writing (before freeze):**
1. `DeliveryService.queueNotification` was not idempotent — calling it twice created duplicate
   deliveries for the same recipient. Fixed with an existing-QUEUED-delivery guard.
2. `SchedulingService`'s recurrence rescheduling never reset `NotificationRecipient.status` back
   to `QUEUED` for the next cycle, so only the first occurrence of a RECURRING notification ever
   sent. Fixed in `rescheduleRecurrence()`.

**Deliberate scope boundary (marked `ponytail:` in `preferenceService.ts`):** quiet hours
(`NotificationPreference.quietHoursStart/End`) are recorded and queryable via
`isQuietNow()`, but `DeliveryService` does not yet defer sends during quiet hours — that is a
scheduling refinement for a later phase.

---

## Phase M0 — Production Infrastructure Foundation [INFRASTRUCTURE] — COMPLETE 2026-07-05

**Status:** COMPLETE. Config + documentation only — no Prisma models, no migrations, no
application code touched, no frozen module touched.

**What was delivered:**
- `docker-compose.yml` — postgres:17-alpine, dpage/pgadmin4:8, redis:7-alpine, minio/minio +
  minio/mc init job; isolated `dtmsn_internal` network; 4 named persistent volumes; healthchecks
  on every long-running service; `service_healthy` startup ordering.
- `.env.template` (Docker-only, e.g. standalone VPS) and `.env.example` extended with the same
  vars plus app-facing `DATABASE_URL`/`REDIS_URL`/`MINIO_ENDPOINT` — all literal values (this
  project does not expand `${VAR}` references inside `.env` files; Compose's own substitution is
  a separate, unrelated mechanism that does work for `docker-compose.yml` itself).
- `.gitignore` updated: `.env` (and `.env.*.local`) ignored; `.env.example`/`.env.template` and
  `docker-compose.yml` tracked normally; `backups/` ignored.
- `docs/infrastructure.md` — architecture diagram, service/volume/network tables, health
  checks & startup order, backup/restore strategy, migration workflow (M1 handoff), dev/prod
  workflow, first-run checklist.

**Verification performed:** YAML syntax parse only (`npx js-yaml docker-compose.yml` — well-formed).
**NOT verified — do not claim otherwise:** Docker is not installed in this environment. No
container has ever started. No healthcheck has ever passed. `docker compose config` (semantic
validation) was never run. The first-run checklist in `docs/infrastructure.md` must be executed,
with real results recorded, before Phase M1 relies on this stack.

**Why M0 exists separately from M1:** mid-Phase-M, no live database was available (no
DATABASE_URL, no docker-compose, prisma wasn't even a dependency). The user rejected installing
PostgreSQL natively (too invasive for a project committed to Docker + future Linux/VPS hosting)
and asked for the Docker infrastructure to be designed and reviewed as its own milestone before
any Prisma code gets written against it.

---

## Phase M1 — Production Prisma Layer [INFRASTRUCTURE] — IMPLEMENTED, PENDING PRODUCTION VERIFICATION (2026-07-05)

**Status:** Per the user's "Implementation First, Production Verification Later" policy, this
proceeded without a live database rather than staying blocked on M0. Everything below is
implemented and internally verified (typecheck, schema validation, full test suite) but **never
executed against a live PostgreSQL instance** — Docker remains unavailable in this environment.

**What was delivered:**
- `prisma/schema.prisma` expanded from 1,292 lines (Legal only) to 2,044 lines: 82 models, 48
  enums, covering all 11 persisting modules (Legal, MasterData, Package, Planning, Approval,
  Contract, Acceptance, Auth, Storage, Notification, Payment). Workflow correctly excluded — it's
  a stateless engine with no table of its own.
- Migrated the schema from the legacy `datasource.url` pattern to **Prisma 7's driver-adapter
  pattern** — `prisma.config.ts` (new, project root) + `@prisma/adapter-pg` + `pg`. This was a
  real, load-bearing discovery: `prisma@7.8.0` hard-rejects `url` inside `datasource {}` now.
  Confirmed by running `prisma init` in a scratch directory and reading the generated scaffold,
  not assumed from training data.
- TD-05 fixed: 9 genuinely monetary `Float` fields → `Decimal(18,2)` (see
  `docs/prisma-production.md` for the full list). `AcceptanceItem`'s 3 quantity fields also
  converted (not monetary, same precision risk, explicitly labeled as a bonus fix).
  `Payment.Money{amount:bigint}` (ADR-004) deliberately maps to `BigInt`, not `Decimal`.
- All 8 pre-existing Prisma stub files replaced with real implementations, PLUS 3 new
  `prisma*Repositories.ts` files for modules that never had a stub before (Package, Planning,
  Payment). 67 repository classes total across 11 modules — see `docs/prisma-production.md` for
  the per-module breakdown. Payment (`src/payment/prismaPaymentRepositories.ts`) is a brand-new
  file; the frozen `paymentRepository.ts` was never touched.
- `src/persistence/prismaClient.ts` (the one `PrismaClient` singleton, driver-adapter
  constructed) and `src/persistence/decimalMapping.ts` (`mapPrismaRow()` — converts Prisma's
  `Decimal`→`number` and `Date`→ISO-`string` on every read, since every domain type in this
  codebase predates those Prisma column types).
- Real migration SQL: `prisma migrate diff --from-empty --to-schema prisma/schema.prisma
  --script` → 2,112 lines, 82 tables, 55 FK constraints, 138 indexes, 8 cascade rules. Genuine
  tool output (schema-engine, no live DB needed for diffing), saved to
  `prisma/migrations/20260705120000_init_production_schema/migration.sql`.
- `docs/prisma-production.md`: full ER diagram, Decimal-migration table, repository mapping,
  index/constraint/transaction strategy, migration guide, and an explicit "what still needs
  Docker" section.

**Verification actually performed** (real, not fabricated):
- `prisma validate` / `prisma format` / `prisma generate` all pass.
- `tsc --noEmit` clean across the whole repository (re-run after every module, ~14 times).
- Full `vitest run`: 364 files / 13,385 tests, zero regressions. 4 test files needed updates —
  they asserted the old stub-era `PrismaNotReadyError`; now assert the real implementations throw
  a `DATABASE_URL is not set` error instead (`legal-repo-document.test.ts`,
  `legal-repo-article.test.ts`, `legal-repo-amendment.test.ts`, `masterdata-factory.test.ts`).

**NOT verified — explicitly not claimed:** no migration has run against Postgres, no query has
executed, no transaction has been tested, the driver-adapter connection has never been confirmed.

**Immediate next task (once Docker is available):** run `docs/infrastructure.md`'s first-run
checklist for real, then `npx prisma migrate deploy` against the M0 Postgres, then re-verify every
claim in `docs/prisma-production.md` before upgrading this phase's status past "IMPLEMENTED,
PENDING PRODUCTION VERIFICATION" to "VERIFIED" and eventually "FROZEN."

See `.memory/roadmap-v2.md` for full scope and `docs/prisma-production.md` for complete detail.

---

## Phase N — Knowledge Platform [KNOWLEDGE LAYER] — FROZEN, 16/16 providers built (2026-07-05)

**Design spec frozen:** 2026-07-03 (`.memory/knowledge-platform-frozen.md` + `knowledge/decisions/knowledge-platform-v2.md`)
**Core implementation FROZEN:** 2026-07-05, after Stage 1 (platform core) + Stage 2 (LegalProvider
+ ProcurementProvider proving every extension point). Full detail: `docs/knowledge-platform.md`.
**Batch 1 (4 more providers) added:** 2026-07-05, zero changes to the frozen core.
**Batch 2 (4 more providers) added:** 2026-07-05, zero changes to the frozen core.
**Batch 3 (4 more providers) added:** 2026-07-05, zero changes to the frozen core.
**Batch 4 (final 2 providers) added:** 2026-07-05, zero changes to the frozen core.
**PHASE N DECLARED COMPLETE AND FROZEN:** 2026-07-05 (ADR-020). All 16 providers from the frozen
spec are implemented, registered, and tested. No providers remain.

**Status:** 13 core files + 29 provider-related files (`baseProvider.ts` + 16 concrete providers ×
their own directory), 336 tests, all passing. All providers built: LegalProvider,
ProcurementProvider (Stage 2), TemplateProvider, ChecklistProvider, OntologyProvider,
GlossaryProvider (Batch 1), VendorKnowledgeProvider, AssetKnowledgeProvider,
BudgetKnowledgeProvider, NotificationKnowledgeProvider (Batch 2), SchoolPolicyProvider,
CaseProvider, RiskProvider, AuditProvider (Batch 3), BestPracticeProvider, AIFeedbackProvider
(Batch 4, final). Full repository suite: 395 test files, 13,721 tests, zero regressions.

**Frozen for good:** `KnowledgePlatform`, `ProviderRegistry`, `QueryRouter`, `SearchEngine`,
`KnowledgeGraphService`, `Resolver`, `Retriever`, `IKnowledgeProvider` contract, and all 16
concrete providers. Any future touch to `src/knowledge/` must be additive (a new file) or must
route through `IKnowledgePlatform` — never a modification to anything in this list.

**Remaining technical debt (known, deliberate, out of Phase N's scope):**
- Knowledge Platform is memory-backed only — no Prisma-backed repositories yet (every other module went memory-first, Prisma-later; Knowledge follows the same order, not yet scheduled)
- `integration/knowledgeIntegration.ts` (the only file allowed to import `src/legal/`) does not yet exist — needed once a provider ingests real `LegalDocument` rows instead of test fixtures
- TD-02 (procurementEngine.ts's applicability-resolution callers not yet migrated to `Retriever.resolveApplicableDocuments()`) is unaffected by Phase N and remains open

**Current Phase = Phase N (FROZEN). Next Phase = Phase X (AI Advisory Layer).**
**Phase X has NOT started.** Per explicit user instruction, no Phase X code may be written without
further explicit approval. `BestPracticeProvider` and `AIFeedbackProvider` were deliberately
designed as pure knowledge sources (no reasoning, no LLM calls) specifically so Phase X has a
ready-made, already-tested entry point into this layer whenever it is approved to begin.

---

## Release Candidate Audit — 2026-07-05 — Recommendation: GO WITH NOTES

A full post-implementation Architecture Audit and Release Candidate review was performed
(architecture boundaries, Knowledge Platform internals, Project Memory sync, complete test suite,
technical debt inventory, git readiness). No defects were found in frozen architecture; the notes
are all pre-existing and unchanged by Phase N (uncommitted-work risk, Phase M1 unverified against
a live DB, TD-01 through TD-15). Full scorecard: `.memory/repository-health.md`.

**Current Milestone = Knowledge Platform v1.0.**
**Next Planned Milestone = Phase X (AI Advisory Layer) Architecture Design** — design only, not
implementation; NOT started; requires explicit approval before any code is written.

**Immediate next task:** none assigned. Waiting for explicit approval to begin Phase X
Architecture Design (not code).

**16 providers / 4 layers / ~14-15 platform API methods / open-string graph relation types**
(10 documented constants + at least 3 new ones already in real use: `BROADER_THAN`,
`ABBREVIATES`, `TRANSLATES_TO` — proving Rule 7 with genuine production usage, not just tests)
**Source so far:** `src/knowledge/` — 13 core files + `providers/baseProvider.ts` + 6 concrete
provider files = 20 files (excludes the 2 unrelated pre-existing "Phase 16 Governance Knowledge
Base" files at the top of `src/knowledge/` — see naming-collision note in `docs/knowledge-platform.md`)
**Tests so far:** 195 (target ~1,092 once all 16 providers exist)

Key frozen decisions (all verified by tests, not just asserted — see `docs/knowledge-platform.md`):
- domain = open string (never enum)
- New domains = registerProvider() only — zero code changes
- Router = pure Map lookup — no switch/if
- AI = IKnowledgePlatform only — never imports providers directly
- suggest() + score() required on every provider
- KnowledgeItem is universal across all providers
- KnowledgeGraph edges are cross-domain, open-string typed
- Applicability rules are universal (not legal-specific) — `Retriever.resolveApplicableDocuments()`
  is the mechanism intended to eventually fix TD-02, but `procurementEngine.ts`'s callers have not
  yet been migrated to use it — TD-02 remains open until that migration happens

---

## Phase O — Supplier Registry [BUSINESS, after N]

Will be built AFTER Phases J/K/L/M/N. See roadmap-v2.md.

**Status:** NEXT (approved by roadmap-v2.md)

**Rationale:** Leaf module (depends only on MasterData). Unlocks 5 downstream modules (K–O). Fills the `contractorId` gap in the Contract module.

**Scope:**
- `Supplier` / `Contractor` entity
- Supplier registration lifecycle (PENDING_REVIEW → ACTIVE → SUSPENDED → BLACKLISTED)
- Capability profiles (financial capacity, experience, certifications)
- Blacklist management with legal basis
- Supplier search / lookup by category and capacity

**Source files:** ~7 in `src/supplier/`
- supplierTypes.ts
- supplierRepository.ts
- supplierService.ts
- supplierValidation.ts
- supplierFactory.ts
- memorySupplierRepositories.ts
- supplierIntegration.ts (bridge to MasterData only)

**Test files:** ~8, ~312 tests, pattern: 13 describe × 3 it()

**Legal references:**
- Luật 22/2023/QH15 — supplier eligibility (Điều 5-6)
- NĐ 104/2026/NĐ-CP — capacity requirements
- Dynamic: use LegalBasis[] — no hardcoded document identifiers in business logic

**Architecture constraint:**
- FROZEN: all modules above
- Supplier is a pure leaf — no imports from approval, contract, acceptance, payment
- Integration bridge: `supplierIntegration.ts` → masterdata only

**Docs:** `docs/supplier.md`
