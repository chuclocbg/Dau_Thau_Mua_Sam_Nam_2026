# Phase X.10 — Business Foundation: Prisma & Persistence — Report

**Date:** 2026-07-10
**Scope:** verify the existing Prisma persistence layer, document what already exists, and add
only genuinely-missing infrastructure — per explicit instruction, this is **not** a greenfield
implementation.

---

## Governing Instruction

The original Phase X.10 request asked for a full persistence foundation (Prisma schema,
database bootstrap, client provider, repository interfaces/implementations, transaction helper,
migration infrastructure, seed infrastructure, test database bootstrap) framed as new work.
Before writing any code, inspection found a substantially complete, pre-existing **"Phase M1
Production Prisma Layer"** already covering most of this list. The user's explicit corrective
instruction (verbatim, governing this entire milestone):

> "Choose Option 1. Treat the existing Prisma persistence layer as the canonical persistence
> foundation. Do NOT create: a new Prisma schema, a second PrismaClient, duplicate repositories,
> duplicate migrations, duplicate infrastructure. Phase X.10 is NOT a greenfield implementation.
> Its purpose is only to: verify the existing persistence layer, document what already exists,
> add only genuinely missing infrastructure that does not duplicate existing code, wire only if
> absolutely required, preserve all existing public APIs. If every requested capability already
> exists, report that fact instead of rebuilding it."

Everything below follows from that instruction.

---

## What Already Exists (Phase M1 — reused, unmodified)

| Deliverable | Status | Evidence |
|---|---|---|
| Prisma schema | **EXISTS** | `prisma/schema.prisma` — 2,044 lines, 82 models, 48 enums, covering Legal/MasterData/Package/Planning/Approval/Contract/Acceptance/Auth/Storage/Notification/Payment |
| Prisma client provider | **EXISTS** | `src/persistence/prismaClient.ts` — `getPrismaClient()` singleton, Prisma 7 driver-adapter pattern (`@prisma/adapter-pg`) |
| Repository interfaces | **EXISTS** | `src/shared/repository/IBaseRepository.ts` (canonical base contract) + 11 per-module interface files, untouched by Phase M1 |
| Repository implementations | **EXISTS** | 67 repository classes across 11 `prisma*Repositories.ts`/`prismaMasterData.ts` files, all implementing the pre-existing interfaces, all using `mapPrismaRow()` for Decimal→number / Date→ISO string conversion |
| Migration infrastructure | **EXISTS** | `prisma.config.ts` + `prisma/migrations/20260705120000_init_production_schema/migration.sql` (generated via `prisma migrate diff`, not yet applied to a live database) |

None of the above was duplicated, rebuilt, or modified (except the one additive line documented
below). This is the canonical persistence foundation for all future business-domain milestones.

---

## What Was Genuinely Missing (built this milestone)

Confirmed missing by exhaustive grep across `src/`, `prisma/`, and `docs/prisma-production.md`'s
own "What Still Needs Docker" section (which explicitly lists integration testing, transaction
verification, and connectivity verification as not yet done):

| # | Gap | Why it's genuinely missing, not a duplicate |
|---|---|---|
| 1 | Reusable transaction helper | `docs/prisma-production.md`'s own Transactions section states only one inline `$transaction` call exists (`PrismaArticleRepository.importFromParsed()` in `src/legal/prismaRepositories.ts`, untouched here) and explicitly says "not yet used elsewhere" — no reusable wrapper existed |
| 2 | Database connectivity / bootstrap check | Zero results anywhere in the repo for a standalone "is the database reachable" function, distinct from schema migration |
| 3 | Seed infrastructure | Zero seed files existed anywhere; `prisma.config.ts`'s `migrations` object had no `seed` entry (required by Prisma 7 for `prisma db seed` to resolve anything) |
| 4 | Test database bootstrap | Zero results for any test-DB setup/teardown mechanism; `docs/prisma-production.md` itself lists "any repository integration test that inserts/reads real rows" as not done |

### New files (all additive, zero duplication)

- **`src/persistence/prismaTransaction.ts`** — `withTransaction<T>(fn, options)`, a thin
  pass-through to `getPrismaClient().$transaction(fn, options)`, typed via Prisma's own
  already-generated `Prisma.TransactionClient`. Reuses the existing singleton client and
  Prisma's own transaction primitive; adds no new transactional semantics.
- **`src/persistence/databaseConnectivity.ts`** — `verifyDatabaseConnection()` (a
  `SELECT 1` probe returning a result object, never throwing) and `waitForDatabaseReady()`
  (retry-until-ready, genuinely reusing the existing `RetryPolicy` from
  `src/providers/RetryPolicy.ts` — the same class already proven for exactly this "wait for an
  external dependency" role in `src/startup/waitForReady.ts`, X.9.5 — rather than inventing a new
  backoff mechanism).
- **`src/persistence/testDatabaseBootstrap.ts`** — `hasTestDatabase()` /
  `buildTestPrismaClient()` / `closeTestDatabase()`, reading `TEST_DATABASE_URL` (distinct from
  `DATABASE_URL`). Deliberately does **not** reuse `getPrismaClient()`'s singleton: a test
  database is a different logical connection, not a modification of the existing dev/prod
  provider. Mirrors `prismaClient.ts`'s driver-adapter construction (the same Prisma 7
  requirement) without touching or wrapping it.
- **`prisma/seed.ts`** — a real, runnable seed entrypoint that seeds **nothing**. Per
  CLAUDE.md's Demo Data Principles ("never invent real people/departments/organizations... use
  placeholders") and Phase X.10's own explicit scope ("no business logic yet, no procurement
  domain yet, no legal domain yet"), this only verifies database connectivity and logs that no
  seed data is defined yet. Future business-domain milestones extend it incrementally.

### One additive line to a pre-existing file

- **`prisma.config.ts`** — added `seed: 'tsx prisma/seed.ts'` inside the existing `migrations`
  object. This is the *only* modification to any pre-existing file this milestone made,
  required because Prisma 7's `prisma db seed` does not auto-discover a seed script by
  convention — it must be registered (confirmed via `@prisma/config`'s own type definitions,
  `MigrationsConfigShape.seed`). Every other line of the file is unchanged.

```diff
   migrations: {
     path: 'prisma/migrations',
+    seed: 'tsx prisma/seed.ts',
   },
```

---

## Tests

- **Unit tests** — `src/__tests__/x10-persistence-foundation.test.ts` (14 tests): `withTransaction`
  surfaces the real `DATABASE_URL`-missing error; `verifyDatabaseConnection`/
  `waitForDatabaseReady` return result objects (never throw) and make exactly the expected number
  of attempts; `hasTestDatabase`/`buildTestPrismaClient` behave correctly across unset/blank/set
  `TEST_DATABASE_URL`.
- **Migration test** — `src/__tests__/x10-prisma-integration.test.ts`: runs the real
  `npx prisma validate` CLI against `prisma/schema.prisma` (no live database required) rather
  than fabricating a pass.
- **Integration tests** — same file, gated behind `hasTestDatabase()` via `describe.skipIf`:
  exercise `verifyDatabaseConnection`/`waitForDatabaseReady`/`withTransaction` against a real
  Postgres instance when `TEST_DATABASE_URL` is set. Docker/Postgres is confirmed unavailable in
  this development environment, so these 3 tests **skip** with a clear signal rather than
  fabricating a pass — the same honesty precedent set throughout Phase X.9.
- **Architecture guard** — `src/__tests__/x10-persistence-foundation-architecture.test.ts`:
  confirms new files import nothing from frozen Phase X.1-X.9 directories or any business-domain
  module; confirms genuine reuse (`getPrismaClient()`, `RetryPolicy`, Prisma's own
  `$transaction`) rather than reimplementation; confirms `prisma.config.ts` retains its original
  content plus exactly the one planned seed line; confirms `prismaClient.ts` and
  `IBaseRepository.ts` are byte-for-byte unmodified; confirms every prior milestone's
  frozen-file marker is unchanged.

**Full suite result:** 522 test files, 14,610 tests passed, 3 skipped (the
`TEST_DATABASE_URL`-gated integration tests), 0 failures — up from 519 files / 14,587 tests at
the X.9.5 freeze baseline. `tsc --noEmit` clean.

---

## Verification

- `git status` confirms exactly 7 new files + 1 modified file (`prisma.config.ts`, the single
  planned line) — zero other files touched, including every frozen Phase X.1-X.9 directory and
  every pre-existing Phase M1 Prisma file (schema, client provider, all 11
  `prisma*Repositories.ts` files, all repository interfaces).
- Docker/Postgres remain unavailable in this environment (consistent with every prior milestone
  since X.9.4) — `TEST_DATABASE_URL` is unset, so the 3 real-database integration tests skip
  honestly rather than being faked.

---

## Explicit Statement

**No new Prisma schema, second PrismaClient, duplicate repository, or duplicate migration was
created.** The pre-existing Phase M1 layer remains the sole, canonical persistence foundation.
This milestone's only contribution is four small, additive files (transaction helper, database
connectivity/readiness check, test-database bootstrap, seed entrypoint) plus one registration
line, all of which reuse — never duplicate — the existing `getPrismaClient()` singleton,
`RetryPolicy`, and Prisma's own native transaction API.

*Per this milestone's explicit closing instruction, work stops here. Phase X.10 is frozen. No
business-domain milestone (X.10.1 or otherwise) begins automatically.*
