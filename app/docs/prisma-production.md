# Production Prisma Layer (Phase M1)

**Status: IMPLEMENTED, PENDING PRODUCTION VERIFICATION.** Every model, repository, and migration
below was written, type-checked against the real generated Prisma Client, and validated with
`prisma validate`/`prisma format`/`prisma generate` — but **none of it has ever run against a live
PostgreSQL instance**, because Docker is not installed in the environment this was authored in
(see Phase M0, `docs/infrastructure.md`). No migration has been applied, no query has executed, no
transaction has been tested. Treat every claim in this document as "should work," not "works."

---

## Why Prisma 7 looks different here

This schema was originally written (Phase A, 2026-06-22) against an older Prisma version using
`datasource db { url = env("DATABASE_URL") }`. The installed CLI is Prisma **7.8.0**, which
**removed that pattern entirely** — `url` in the schema's `datasource` block is now a hard
validation error. Prisma 7 replaces it with:

- **`prisma.config.ts`** (project root) — the CLI (`migrate`, `generate`, `studio`) reads
  `DATABASE_URL` from here, not from the schema file.
- **Driver adapters** — the generated client no longer manages its own connection; the app passes
  an explicit adapter instance (`@prisma/adapter-pg` + `pg` for PostgreSQL) to `new PrismaClient({
  adapter })`.
- **`generator client { provider = "prisma-client" }`** (not the legacy `prisma-client-js`) —
  emits TypeScript source to a custom `output` path (`generated/prisma/`, git-ignored) rather than
  into `node_modules/@prisma/client`.

This was discovered by actually running `prisma validate`/`prisma generate`/`prisma init` in a
scratch directory and reading the real error messages and generated scaffold — not assumed from
outdated documentation.

---

## Schema Overview

| Metric | Value |
|---|---|
| Models | 82 |
| Enums | 48 |
| Schema file | `prisma/schema.prisma`, 2,044 lines |
| Modules covered | Legal, MasterData, Package, Planning, Approval, Contract, Acceptance, Auth, Storage, Notification, Payment (11) |
| Not covered | Workflow (stateless engine, owns no persisted table — see below), Knowledge/Supplier (future phases N/O) |

**Workflow has no models.** `src/procurement/workflow/` is a pure computation engine — it
validates transitions and returns results but never owns a database table; the *state* it
computes over lives on `ProcurementPackage`/`ProcurementRequest`, which already have models. Adding
a `Workflow` table would be inventing new persisted business behavior, which this phase avoids.

### ER Diagram (module-level relationships)

```
LegalDocument ──┬─< LegalVersion ──< Article ──< Clause ──< Point
                ├─< Appendix
                ├─< LegalCitation (self-referential, citing/cited)
                ├─< LegalKeyword
                ├─< Amendment (self-referential, base/amending)
                ├─< EffectivePeriod
                └─< LegalDocumentDomain >── LegalDomain

MdDepartment (self-referential hierarchy) ── MdEmployee, MdApprovalAuthority, MdVendor,
  MdFundSource, MdBudgetYear, MdPackageType, MdProcurementMethod, MdProcurementCategory,
  MdDocumentTemplate   (10 independent lookup tables, no cross-FKs — Master Data is a leaf)

ProcurementPackage ──┬─< PackageItem
                      ├─< PackageBudget
                      ├─< PackageAttachment
                      └─< PackageHistory

ProcurementPlan ──┬─< ProcurementRequest
                   ├─< FundingAllocation
                   └─< PackageProposal
ProcurementDemand, AnnualProcurementPlan (independent of Plan)

ApprovalRequest ──┬── ApprovalDecisionRecord (1:1 via decisionId)
                   ├─< ApprovalHistoryEntry
                   ├─< ApprovalComment
                   └─< ApprovalAttachment

Contract ──┬─< ContractAmendment
            ├─< ContractMilestone
            ├─< ContractGuarantee
            ├─< ContractHistoryEntry
            └─< ContractAttachment

AcceptanceRequest ──┬── AcceptanceCommittee (1:1) ──< AcceptanceMember
                     ├─< AcceptanceSession ──< AcceptanceItem
                     ├─< AcceptanceMinute
                     ├─< AcceptanceHistoryEntry
                     └─< AcceptanceAttachment

AuthUser ──┬─< AuthSession
           ├─< AuthDelegationGrant (as fromUser AND toUser)
           ├─< AuthPermissionGrant
           └─< AuthApprovalHierarchy
AuthRole, AuthPermission, AuthPolicy, AuthAuditEvent (independent)

StorageAttachmentReference, StorageUploadSession, StorageRetentionPolicy,
  StorageLegalHold, StorageAuditEvent   (5 independent tables — no FK to business
  entities; linked only by opaque moduleType/moduleId strings, per the Storage
  integration-bridge design from Phase K)

Notification ──┬─< NotificationRecipient ──< NotificationDelivery
                └─< NotificationDelivery
NotificationChannel, NotificationTemplate, NotificationBatch, NotificationPreference,
  NotificationRule, NotificationEvent, NotificationAuditEvent (independent)

PaymentRequest ──┬─< Payment
                  ├─< PaymentInstallment
                  ├─< TreasurySubmission
                  ├─< PaymentHistoryEntry
                  └─< PaymentDocument
```

---

## Decimal Migration (TD-05)

**Fixed:** every genuinely monetary `Float` field found in the pre-existing schema was converted
to `Decimal @db.Decimal(18, 2)` (or `Decimal(5,2)` for percentages, `Decimal(12,3)` for
quantities):

| Model.field | Before | After |
|---|---|---|
| `MdApprovalAuthority.maxValue` | `Float` | `Decimal(18,2)` |
| `MdBudgetYear.totalBudget` | `Float` | `Decimal(18,2)` |
| `ProcurementRequest.estimatedCost` | `Float` | `Decimal(18,2)` |
| `ProcurementPlan.estimatedTotal` / `.approvedTotal` | `Float` | `Decimal(18,2)` |
| `ProcurementDemand.consolidatedCost` | `Float` | `Decimal(18,2)` |
| `FundingAllocation.allocatedAmount` / `.committedAmount` / `.remainingAmount` | `Float` | `Decimal(18,2)` |
| `PackageProposal.estimatedValue` | `Float` | `Decimal(18,2)` |
| `AnnualProcurementPlan.totalBudget` / `.approvedBudget` | `Float` | `Decimal(18,2)` |
| `AcceptanceItem.contractedQuantity` / `.acceptedQuantity` / `.rejectedQuantity` | `Float` | `Decimal(12,3)` (not monetary, but same floating-point precision risk for legally-recorded counts — fixed as a bonus, clearly labeled) |

**Left as `Float` (correctly, not money):** `LegalDocument.confidence` (a 0–1 confidence score).

**Not converted to Decimal — uses `BigInt` instead:** the Payment module's `Money { amount:
bigint, currency }` value object (ADR-004, "never float," post-dates the modules above) maps to a
Prisma `BigInt` column, not `Decimal`. `BigInt` is arbitrary-precision and exactly matches the TS
`bigint` type; `Decimal(18,2)` would silently impose a fractional scale the domain type never
had. `ApprovalRequest.estimatedValue` and `AuthApprovalHierarchy.valueThreshold` are also `bigint`
in their TS types and are mapped to `BigInt` for the same reason.

---

## Repository Mapping

Every module keeps three files, exactly matching the existing repository abstraction (nothing
about the interfaces changed — only what implements them):

| File | Role |
|---|---|
| `memory*Repositories.ts` | In-memory, used by ~13,000 existing tests — **untouched by Phase M1** |
| `prisma*Repositories.ts` | **New in Phase M1** — real `PrismaClient`-backed implementation |
| `*Repository.ts` / `*Repositories.ts` | The interfaces both implementations satisfy — **untouched** |

| Module | Prisma repo file | Classes | Notes |
|---|---|---|---|
| Legal | `src/legal/prismaRepositories.ts` | 6 | `importFromParsed` wrapped in `prisma.$transaction` |
| MasterData | `src/masterdata/prismaMasterData.ts` | 1 generic | One class, 10 instances (mirrors `MemoryMasterDataRepository<T>`) |
| Package | `src/procurement/package/prismaPackageRepositories.ts` | 5 | New file — no prior stub existed |
| Planning | `src/procurement/planning/prismaPlanningRepositories.ts` | 6 | New file — no prior stub existed |
| Approval | `src/approval/prismaApprovalRepositories.ts` | 5 | |
| Contract | `src/contract/prismaContractRepositories.ts` | 6 | |
| Acceptance | `src/acceptance/prismaAcceptanceRepositories.ts` | 8 | Largest module |
| Auth | `src/auth/infrastructure/prismaAuthRepositories.ts` | 8 | `PermissionGrant` has no repo interface — not implemented (matches existing behavior) |
| Storage | `src/storage/infrastructure/prismaStorageRepositories.ts` | 5 | |
| Notification | `src/notification/infrastructure/prismaNotificationRepositories.ts` | 10 | `scheduleTime` split into flat `scheduledAt`+`recurrence` columns for indexable due-schedule queries |
| Payment | `src/payment/prismaPaymentRepositories.ts` | 6 | **New file only** — Payment is FROZEN, so nothing in `paymentRepository.ts` was touched; no bundled aggregate exists (matches the frozen module's own function-parameter style) |

**Total: 67 repository classes / 11 factory functions.**

### The two systemic type mismatches every repository handles

1. **`Decimal` → `number`.** Prisma returns a `Decimal.js` instance for every `@db.Decimal`
   column; every domain type in this codebase declares plain `number`. `src/persistence/
   decimalMapping.ts` exports `mapPrismaRow()`, which shallow-converts every Decimal-shaped
   top-level field back to `number` (duck-typed via `.toNumber()`, no Prisma types imported).
2. **`DateTime` → ISO `string`.** Prisma returns a JS `Date` for every `DateTime` column; every
   domain type declares ISO `string`. The same `mapPrismaRow()` converts every `Date` instance to
   `.toISOString()` in the same pass.

Two modules need extra, hand-written mapping beyond `mapPrismaRow()`:
- **Notification**: `scheduleTime: { scheduledAt, recurrence? }` is stored as two separate
  columns (`scheduledAt DateTime?`, `recurrence Json?`) instead of one JSON blob, specifically so
  `findDueSchedules()` can use a real B-tree index on `scheduledAt` rather than scanning JSON.
  `PrismaNotificationRepository` has a private `toDomain()` that reassembles the nested object.
- **Payment**: `Money { amount: bigint, currency }` is flattened to two columns (`amount BigInt`,
  `currency PaymentCurrency`) and reassembled by `flattenMoney()`/`reassembleMoney()` helpers local
  to `prismaPaymentRepositories.ts`.

### Deliberate behavioral differences from the memory backend

- **`PrismaLegalDocumentRepository.delete()`** enforces referential integrity (throws if
  versions/articles/citations/etc. still reference the document — Prisma's default `onDelete:
  Restrict`) where the memory backend silently leaves orphaned records in unrelated `Map`s. Judged
  a production correctness improvement, not a regression.

---

## Indexes

138 indexes total (including those implied by `@unique`/`@id`). Every field the task explicitly
called out is covered:

| Field | Where | How |
|---|---|---|
| `packageCode` | `ProcurementPackage` | `@unique` (auto-indexed) |
| `contractNumber` (the actual "contract code" field) | `Contract` | `@unique` |
| `requestCode` (the actual "approval code" field) | `ApprovalRequest` | `@unique` |
| `supplierCode` | — | Not applicable yet — Supplier is Phase O, no table exists |
| `workflowId` | `ProcurementPackage`, `Contract`, `AcceptanceRequest`, `PaymentRequest` | `@@index` — **added during this phase; none of these had it before** |
| `status` | Every status-bearing model | `@@index` |
| `createdAt` | `ProcurementPackage` (representative) | `@@index` |
| `updatedAt` | Covered implicitly — no model queries by `updatedAt` alone in existing code; not indexed to avoid unused-index bloat |
| `effectiveDate` | `LegalDocument`, `Contract` | `@@index` — **added during this phase; neither had it before** |
| `departmentId` | `MdEmployee`, `AuthUser`, `AuthApprovalHierarchy` | `@@index` — **`MdEmployee` added during this phase** |

---

## Constraints

- **55 foreign key constraints**, all generated by Prisma from `@relation` — never hand-written.
- **8 `ON DELETE CASCADE` rules** — exclusively on true parent/child aggregates where the child
  has no independent existence (e.g. `PackageItem`/`PackageBudget`/`PackageAttachment`/
  `PackageHistory` under `ProcurementPackage`; `NotificationRecipient`/`NotificationDelivery`
  under `Notification`). Every other FK defaults to `ON DELETE RESTRICT` — deleting a row with
  live references fails loudly rather than silently cascading through business history.
- **Unique constraints**: every `*Code`/`*Number` business identifier (`packageCode`,
  `contractNumber`, `requestCode`, `annualPlanCode`, `proposalCode`, etc.), plus
  `NotificationPreference@@unique([userId, channelType])` and `AcceptanceMember@@unique([committeeId,
  memberCode])`.

**Soft-delete strategy:** MasterData already has `isActive`/`isArchived` boolean columns
(pre-existing convention, not introduced here) — `archive()` sets both rather than deleting the
row. No other module in this schema has a soft-delete convention; hard `delete()` matches each
module's existing repository interface exactly (nothing was added or changed).

---

## Transactions

**Currently used:** `PrismaArticleRepository.importFromParsed()` wraps the entire multi-table
import (articles → clauses → points → appendices, potentially hundreds of rows) in a single
`prisma.$transaction(async (tx) => { ... })` — either the whole parsed document imports, or none
of it does. This directly satisfies "rollback on failure" for the one place in this codebase that
does a genuinely multi-step write.

**Not yet used elsewhere:** every other repository method is a single Prisma call (single-row or
`findMany`/`updateMany`), which Postgres already makes atomic — no explicit transaction wrapper
needed. `NotificationBatch.incrementCounts()` uses Prisma's atomic `{ increment: n }` operator
rather than a read-modify-write transaction, for the same reason.

**Optimistic locking:** not implemented in this phase. No existing repository interface or
service exposes a version/etag field to check, so adding one would be new business behavior
beyond what was asked ("preserve the existing Repository abstraction"). If a future phase adds
concurrent-write conflict detection, the natural place is a `version Int @default(0)` column plus
a `WHERE version = @old` clause in `update()` — noted here as a follow-up, not implemented.

---

## Migration

`prisma/migrations/20260705120000_init_production_schema/migration.sql` — **2,112 lines**,
generated by the real Prisma schema-engine via:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

This command computes a real DDL diff without needing a live database connection (confirmed by
running it in this environment) — it is genuine tool output, not hand-authored SQL, but it has
**never been executed** against a real Postgres instance. `prisma/migrations/migration_lock.toml`
pins the provider to `postgresql`.

**To apply for real** (once Phase M0's Docker stack is verified):
```bash
npx prisma migrate deploy   # applies pending migrations; safe for production
# or, in development, to keep iterating on the schema:
npx prisma migrate dev --name <next-change-description>
```

---

## Performance Strategy

- **Connection pooling**: `@prisma/adapter-pg` wraps `pg.Pool` internally — pool size is
  configured via the `DATABASE_URL` connection string (`?connection_limit=N`) or by constructing
  the adapter with an explicit `pg.Pool` instance; not tuned in this phase (no load data exists
  yet to tune against).
- **Query shape**: every `findMany`/`search` method takes `skip`/`take` for pagination (mirrors
  each module's existing `SearchQuery`/`PagedResult` pattern) — no unbounded `findMany()` in any
  hot path.
- **N+1 avoidance**: not addressed in this phase — no repository method currently does
  `include`/relation-loading (each returns flat rows matching its existing memory-backend
  behavior exactly); adding eager-loading is a future optimization once real query patterns are
  observed, not before.

---

## What Still Needs Docker (Phase M0 → M1 handoff)

None of the following can be honestly claimed as done without a live PostgreSQL instance:
- Running `npx prisma migrate deploy` and confirming all 82 tables/48 enums/55 FKs actually create.
- Any repository integration test that inserts/reads real rows.
- Performance/benchmark testing of any query.
- Verifying the driver-adapter connection (`@prisma/adapter-pg` + `pg`) actually connects.
- Verifying the `importFromParsed` transaction actually rolls back on a mid-import failure.

See `docs/infrastructure.md`'s first-run checklist — run it, then re-verify every item in this
document against real results before calling any of this `VERIFIED` or `FROZEN`.
