# Roadmap v2 — Infrastructure-First + Knowledge Engine

Updated: 2026-07-03 (Legal Knowledge Engine inserted as Phase N)
Supersedes: all prior roadmaps

---

## Why This Order

1. Infrastructure (J–M) before everything — auth, storage, notification, real DB must exist before new modules are built
2. Legal Knowledge Engine (N) before Supplier — every business module from Phase O onward makes legal decisions that must be resolved dynamically, not hardcoded
3. Business Expansion (O–U) — built once, ships to production with full infrastructure and knowledge backing
4. Platform Services (V–X) — aggregate across completed business modules
5. External Integration (Y) — last, requires all public-facing flows complete

---

## Full Phase Map

```
INFRASTRUCTURE FOUNDATION
  Phase J — Authentication & Authorization
  Phase K — Storage & Attachment Service
  Phase L — Notification Service
  Phase M0 — Production Infrastructure Foundation (Docker: Postgres, pgAdmin, Redis, MinIO)
  Phase M1 — Production Prisma Layer

KNOWLEDGE LAYER
  Phase N — Legal Knowledge Engine

BUSINESS EXPANSION
  Phase O — Supplier / Contractor Registry
  Phase P — Tender Announcement
  Phase Q — Bid Submission
  Phase R — Bid Opening & Evaluation
  Phase S — Contractor Selection & Award
  Phase T — Contract Performance Monitoring
  Phase U — Final Settlement (Quyết toán)

PLATFORM SERVICES
  Phase V — Document Generator
  Phase W — Dashboard & Reporting
  Phase X — AI Advisory Layer

EXTERNAL INTEGRATION
  Phase Y — Public Procurement Portal (ĐTMUA / eBid)
```

---

## Infrastructure Phases (J–M)

### Phase J — Authentication & Authorization

Depends on: nothing (pure leaf)

Delivers:
- `AuthContext` value object (userId, roles, permissions, department, delegation, sessionId)
- RBAC model — Role, Permission (resource/action/scope triple)
- `DelegationGrant` — time-bounded authority transfer with LegalBasis
- `ApprovalHierarchy` — authority levels → users + value thresholds
- JWT (15 min) + rotating refresh token (7 days) + SessionRecord audit trail
- `IAuthProvider` interface — pluggable: LocalAuth, OIDC/SSO hook, LDAP/AD hook
- Auth enforced at API/adapter layer; frozen module signatures unchanged
- New modules (Phase O+) accept AuthContext as first parameter natively

Source: `src/auth/` — ~10 files | Tests: ~390

---

### Phase K — Storage & Attachment Service

Depends on: Auth (J) — uploads attributed to userId

Delivers:
- `Attachment` entity — id, filename, mimeType, size(bigint), SHA-256 hash, storageKey, scanStatus, retention
- `AttachmentVersion` — immutable version history
- `IStorageAdapter` — pluggable: LocalFileAdapter, S3Adapter, AzureBlobAdapter
- `IVirusScanAdapter` — pluggable: PassthroughAdapter (dev), ClamAV, cloud scan
- `RetentionPolicy` — duration with LegalBasis, auto-delete flag
- Upload flow: receive → validate MIME → hash → store → scan → record

Supported types: PDF, DOCX, XLSX, ZIP, PNG, JPG, SVG
Source: `src/storage/` — ~9 files | Tests: ~351

---

### Phase L — Notification Service

Depends on: Auth (J) — internal notifications link to userId

Delivers:
- `Notification` entity with channel, template, retry queue, status tracking
- `INotificationChannel` — pluggable: SMTP Email, SMS (Twilio/Viettel stub), InternalDB, WebPush/Firebase stub
- `NotificationScheduler` — schedule at future date, cancel, list pending
- `RetryQueue` — exponential backoff, max attempts configurable
- `NotificationTemplate` registry — named templates with parameter slots
- Domain event → notification mapping (for frozen modules: triggered via integration layer)

Source: `src/notification/` — ~10 files | Tests: ~390

---

### Phase M0 — Production Infrastructure Foundation

Depends on: nothing (pure infrastructure, no application code)

**Status: COMPLETE (2026-07-05).** Config + documentation only — no Prisma models, no
migrations, no schema changes, no code changes to any module.

Delivers:
- `docker-compose.yml` — postgres:17-alpine, dpage/pgadmin4:8, redis:7-alpine, minio/minio,
  one-shot minio-init bucket creator; isolated `dtmsn_internal` bridge network; 4 named
  persistent volumes; healthchecks on all 4 long-running services; `depends_on
  condition: service_healthy` startup ordering (pgadmin→postgres, minio-init→minio)
- `.env.template` (infra-only, for a standalone Docker host) and `.env.example` extended
  (full local dev: app keys + infra connection strings) — no hardcoded credentials, both
  git-ignored via `.env` pattern in `.gitignore`
- `docs/infrastructure.md` — architecture diagram, service table, volumes, network isolation,
  health checks/startup order, backup strategy, restore strategy, migration workflow (handoff
  to M1), development workflow, production workflow, first-run checklist

**Verification performed:** YAML syntax parse only (`npx js-yaml docker-compose.yml`, well-formed).
**Not verified:** Docker is not installed in this environment — no container has ever started, no
healthcheck has ever passed, `docker compose config` was never run. The first-run checklist in
`docs/infrastructure.md` must be executed and its results recorded before this is trusted as
working, not just well-formed.

Why this exists as a separate phase: the user rejected two live-verification paths (Docker
unavailable in-session; native PostgreSQL install rejected as too invasive for a Docker-committed
production target) and asked for the infrastructure design to be produced and reviewed on its own
before Phase M1 writes any Prisma code against it.

---

### Phase M1 — Production Prisma Layer

Depends on: Auth (J), Storage (K), Infrastructure Foundation (M0)

**Status: IMPLEMENTED, PENDING PRODUCTION VERIFICATION (2026-07-05).** Per the user's
"Implementation First, Production Verification Later" policy, implemented in full without
waiting for M0's Docker stack to be verified — every claim below is backed by a real, inspectable
artifact (schema, migration file, typecheck, test run), but none of it has ever executed against
a live PostgreSQL instance.

Delivered:
- Complete `prisma/schema.prisma` (2,044 lines, 82 models, 48 enums) covering all 11 modules that
  persist data: Legal, MasterData, Package, Planning, Approval, Contract, Acceptance, Auth,
  Storage, Notification, Payment. (Workflow correctly excluded — stateless engine, no table.)
- Real Prisma implementations replacing all 8 pre-existing stub files, PLUS 3 brand-new
  `prisma*Repositories.ts` files for modules that never had one (Package, Planning, Payment). 67
  repository classes total. Full mapping in `docs/prisma-production.md`.
- TD-05 fixed: 9 genuinely monetary `Float` fields → `Decimal(18,2)`. Payment's bigint-based
  `Money` (ADR-004) deliberately maps to `BigInt`, not `Decimal` — see ADR-018.
- Index strategy: 138 indexes total, including `workflowId`/`effectiveDate`/`departmentId` gaps
  found and fixed on `ProcurementPackage`, `Contract`, `AcceptanceRequest`, `PaymentRequest`,
  `LegalDocument`, `MdEmployee` that didn't exist before this phase.
- Migration file: `prisma/migrations/20260705120000_init_production_schema/migration.sql`
  (2,112 lines, 82 tables, 55 FKs, 8 cascade rules) — real tool output via `prisma migrate diff
  --from-empty --to-schema`, never applied to a live database.
- Architecture pivot discovered mid-phase: `prisma@7.8.0` requires the driver-adapter pattern
  (`prisma.config.ts` + `@prisma/adapter-pg`), not the legacy `datasource.url` — see ADR-018.
- Connection pooling not yet tuned (no load data to tune against); backup strategy documented in
  `docs/infrastructure.md` (Phase M0), not duplicated here.
- `docs/prisma-production.md` written in full.

**Not yet done (requires Docker):** `prisma migrate deploy` against a live Postgres, any real
query execution, transaction rollback verification, driver-adapter connection confirmation. See
`docs/prisma-production.md`'s "What Still Needs Docker" section.
- Every migration, integration test, and performance smoke test claimed as passing must actually
  have been run against the M0 Docker Postgres — no fabricated results

Source: 67 Prisma repository classes across 11 modules | Tests: 0 new (existing 364 files / 13,385
tests all still pass unmodified in business logic; 4 files updated for stub→real transition)

---

## Knowledge Layer (Phase N)

### Phase N — Knowledge Platform (Legal Intelligence + Procurement Knowledge)

Depends on: Prisma (M), Storage (K), Auth (J)

Why here: every business module from Phase O onward needs applicable knowledge across all domains simultaneously. The platform is the central intelligence layer for the entire procurement system.

Architecture: FROZEN (2026-07-03) — see `.memory/knowledge-platform-frozen.md`

Delivers:
- `IKnowledgePlatform` (14 API methods) — central interface; only entry point for AI Advisory Layer
- `IKnowledgeProvider` (4 required methods: search/resolve/suggest/score) — domain = open string
- `KnowledgeProviderRegistry` — pure Map<string, IKnowledgeProvider>; no routing logic in registry
- `KnowledgeItem` — universal; fields: id, domain, provider, type, title, summary, keywords, legalBasis[], relatedItems[], metadata, effectivePeriod, confidence, attachments, layer
- `KnowledgeGraph` — 10 open-string relation types; cross-domain edges permitted
- `KnowledgeApplicabilityRule` — universal scope rules (legal docs, templates, risk patterns, all items)
- `IEmbeddingAdapter` + `IVectorStoreAdapter` — pluggable (NoOp + Memory defaults)
- 16 providers across 4 layers (see `.memory/knowledge-platform-frozen.md`)

Fixes: TD-02 (via LegalProvider + KnowledgeApplicabilityRule rows); provides path to TD-01 fix
Source: `src/knowledge/` — ~28 files | Tests: ~1092 (~28 × 39)

---

## Business Expansion (O–U)

All phases O–U are built with full infrastructure (auth, storage, notification, real DB) and full legal knowledge (applicable law resolution). Each module ships once, directly to production.

| Phase | Module | Depends On |
|-------|--------|-----------|
| O | Supplier Registry | J, K, L, M, N, MasterData(C) |
| P | Tender Announcement | O, Package(D), Approval(F), K, L, N |
| Q | Bid Submission | P, O, K, J, N |
| R | Bid Opening & Evaluation | Q, MasterData(C), J, L, N |
| S | Contractor Selection & Award | R, Approval(F), L, J |
| T | Contract Performance Monitoring | Contract(G), Acceptance(H), L |
| U | Final Settlement (Quyết toán) | Payment(I), Acceptance(H), K, J, N |

---

## Platform Services (V–X)

| Phase | Module | Depends On |
|-------|--------|-----------|
| V | Document Generator | K, Planning(E), Contract(G), Acceptance(H), Payment(I) |
| W | Dashboard & Reporting | M (aggregate queries, all modules) |
| X | AI Advisory Layer | All business modules, N (knowledge engine), K, J |

---

## External Integration (Y)

| Phase | Module | Depends On |
|-------|--------|-----------|
| Y | Public Portal (ĐTMUA/eBid) | P (Tender), Q (Bid), O (Supplier), L, J |

---

## Dependency Graph Summary

```
J (Auth) ─────────────┐
K (Storage) ─────────┬┤
L (Notification) ────┤├──→ M (Prisma) ──→ N (Knowledge Engine) ──→ O (Supplier) ──→ P ──→ Q ──→ R ──→ S
                      └┤                                                                  ↓
                        └──────────────────────────────────────────────────────→ T → U → V → W → X → Y
```

Critical path: J → (K + L in parallel) → M → N → O → P → Q → R → S
