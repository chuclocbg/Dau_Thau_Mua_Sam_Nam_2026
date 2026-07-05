# Decision Index

Architectural Decision Records for the Procurement Platform.
Every non-obvious decision that affects future development.

Last verified against repository state: 2026-07-05 (ADR-022 added — Knowledge Retrieval Strategy for Phase X.3 ratified).

Full ADR files: `.memory/decisions/`
Legacy decision log (pre-ADR): `.memory/decision-log.md`

---

## ADR Status Key

| Status | Meaning |
|--------|---------|
| ACTIVE | Decision stands; governs all new code |
| SUPERSEDED | Replaced by a later ADR |
| DEPRECATED | No longer applies; kept for history |

---

## Index

| ID | Title | Status | Date | File |
|----|-------|--------|------|------|
| ADR-001 | Hexagonal architecture + Integration Bridge pattern | ACTIVE | 2026-06-22 | `decisions/ADR-001-hexagonal.md` |
| ADR-002 | Canonical `IBaseRepository<T>` in `src/shared/` | ACTIVE | 2026-07-02 | `decisions/ADR-002-base-repository.md` |
| ADR-003 | Domain type name collision resolution | ACTIVE | 2026-07-02 | `decisions/ADR-003-type-names.md` |
| ADR-004 | `Money.amount` is `bigint`, never float | ACTIVE | 2026-07-03 | `decisions/ADR-004-money-bigint.md` |
| ADR-005 | `LegalBasis[]` structured citations, never `string[]` | ACTIVE | 2026-07-03 | `decisions/ADR-005-legal-basis.md` |
| ADR-006 | No repositories in `src/shared/financial/` | ACTIVE | 2026-07-03 | `decisions/ADR-006-financial-no-repos.md` |
| ADR-007 | Knowledge Platform domain = open string, never enum | ACTIVE | 2026-07-03 | `decisions/ADR-007-open-domain.md` |
| ADR-008 | Knowledge Platform NEVER reasons; Reasoning Layer NEVER stores | ACTIVE | 2026-07-03 | `decisions/ADR-008-knowledge-reasoning-split.md` |
| ADR-009 | AI layer consumes ONLY `AIContext`; never calls repos or providers | ACTIVE | 2026-07-03 | `decisions/ADR-009-ai-context-boundary.md` |
| ADR-010 | All rules/thresholds are `KnowledgeItem` objects, never hardcoded | ACTIVE | 2026-07-03 | `decisions/ADR-010-rules-as-data.md` |
| ADR-011 | Payment validation uses `numericParams`; no law constants in business logic | ACTIVE | 2026-07-03 | `decisions/ADR-011-payment-dynamic-rules.md` |
| ADR-012 | Auth enforced at API layer only; frozen module signatures unchanged | ACTIVE | 2026-07-03 | `decisions/ADR-012-auth-boundary.md` |
| ADR-013 | `ProcurementNeed` embedded in `ProcurementRequest` (no separate repo) | ACTIVE | 2026-06-22 | `decisions/ADR-013-need-embedded.md` |
| ADR-014 | `buildPlanWorkflow` hardcodes `OPEN_TENDER` (KI-001, accepted) | ACTIVE | 2026-06-22 | `decisions/ADR-014-opentender-default.md` |
| ADR-015 | 4-tier conflict resolution: HIERARCHY → MORE_RESTRICTIVE → LEX_POSTERIOR → LEX_SPECIALIS | ACTIVE | 2026-07-03 | `decisions/ADR-015-conflict-resolution.md` |
| ADR-016 | Authentication: opaque sessions + Keycloak hub; JWT optional API-only; VNeID/GovSSO via IAuthenticationProvider | ACTIVE | 2026-07-04 | `docs/adr/ADR-010-authentication-strategy.md` (full file) |
| ADR-017 | Production infra = Docker Compose (Postgres/pgAdmin/Redis/MinIO), never a natively-installed DB | ACTIVE | 2026-07-05 | `docs/infrastructure.md` (full rationale) |
| ADR-018 | Prisma 7 driver-adapter pattern (`prisma.config.ts` + `@prisma/adapter-pg`), never legacy `datasource.url`; Payment `Money.amount` maps to `BigInt`, not `Decimal` | ACTIVE | 2026-07-05 | `docs/prisma-production.md` (full rationale) |
| ADR-019 | Knowledge Platform core architecture FROZEN after 2 representative providers (Legal, Procurement) proved every extension point; remaining 14 providers built one session at a time, never all at once | ACTIVE | 2026-07-05 | `docs/knowledge-platform.md` (full rationale) |
| ADR-020 | Knowledge Platform Phase N declared COMPLETE and FROZEN at 16/16 providers (Batches 1-4); platform core/registry/router/search/graph/resolver/retriever/provider contract never modified across the entire phase; `BestPracticeProvider`/`AIFeedbackProvider` are pure knowledge sources with zero AI reasoning or LLM calls, reserved as Phase X's only intended entry points into this layer | ACTIVE | 2026-07-05 | `docs/knowledge-platform.md` (full rationale) |
| ADR-021 | Post-Phase-N Release Candidate audit (architecture boundaries, Knowledge Platform internals, Project Memory sync, full test suite, technical debt, git readiness) recorded recommendation **GO WITH NOTES**; declared Current Milestone = Knowledge Platform v1.0, Next Planned Milestone = Phase X Architecture Design (not started); notes are pre-existing (uncommitted-work risk, Phase M1 unverified, TD-01–TD-15) and unchanged by Phase N | ACTIVE | 2026-07-05 | `.memory/repository-health.md` (full scorecard) |
| ADR-022 | Knowledge Retrieval Strategy for Phase X.3: `KnowledgeResolver` uses `searchKnowledge()` for free-text ranked retrieval (`cases`/`bestpractice`), `resolveX(context, asOfDate)` for rule-based applicability; `searchKnowledge()`-sourced items are never eligible for `AppliedRole = 'PRIMARY_BASIS'` (no temporal filtering in `search()`); `LegalBasis.document`→`documentSymbol` mapping, `createdAt` fallback for missing `effectivePeriod`, single-JSON-blob encoding for rule/threshold metadata. Ratifies and supersedes the `ADR-DRAFT-X01` draft. Zero changes to frozen `IKnowledgePlatform` | ACTIVE | 2026-07-05 | `decisions/ADR-022-knowledge-resolution-strategy.md` |

---

## Key Principles Encoded in ADRs

**Never hardcode legal values in business logic.** ADR-005, ADR-010, ADR-011.

**New module = new bridge file, not a frozen file modification.** ADR-001.

**Shared vocabulary lives in `src/shared/`.** ADR-002, ADR-004, ADR-005.

**AI only speaks `AIContext`.** ADR-009. No exceptions.

**Production infrastructure is Docker, never a native install.** ADR-017. Do not install
PostgreSQL/Redis/MinIO as native Windows services even for convenience — the project targets
Linux/VPS hosting and Docker Compose is the single source of truth for the runtime topology.

**Prisma connects via driver adapter, never `datasource.url`.** ADR-018. `prisma@7.8.0` rejects
the legacy pattern outright — connection config lives in `prisma.config.ts`, and
`src/persistence/prismaClient.ts` is the only place `new PrismaClient({ adapter })` is called.
Money stored as `bigint` (Payment module, ADR-004) stays `BigInt` in Postgres, never `Decimal` —
only genuinely fractional monetary fields from older modules use `Decimal(18,2)`.
