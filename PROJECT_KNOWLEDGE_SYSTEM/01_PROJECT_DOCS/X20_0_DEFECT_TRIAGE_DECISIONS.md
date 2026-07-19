# Phase X.20.0 — Defect Triage: Decisions

**Status:** Investigation and decision-recording only, per `RUNTIME_ITERATION_3_CONTRACT.md` §4–§5,
`IMPLEMENTATION_SLICE_20_SELECTION.md`, and `SLICE20_PRE_IMPLEMENTATION_DISCLOSURE.md`. No source
file, test file, or configuration file was modified to produce this document. Every finding below
was independently re-verified against the repository's current state (HEAD
`1d516d543fab2e4ae24fb32d69d0f430f546c8bd`, `npx tsc -b --force`: 599 diagnostics / 188 files,
matching the disclosed baseline with zero drift) — not assumed unchanged from
`X20_TYPESCRIPT_REMEDIATION_PLAN.md`'s own 2026-07-14 description. `CURRENT_MILESTONE.md`'s current
`do_not` list was re-read directly for every frozen-zone determination below.

---

## Cluster 1 — `src/reasoning/application/evidenceCollector.ts:56`

**Confirmed real defect.** Re-read directly: `backingArticleIds` is referenced at line 56
(`if (!backingArticleIds.has(crossRefId))`) but never declared anywhere in the file. The file
declares a same-purpose but incompatible function, `hasBackingArticle(rule, appliedArticles):
boolean` (line 14) — not a collection with a `.has()` method usable at the call site. This would
throw a `ReferenceError` at runtime the first time any `PRIMARY_BASIS` article's `crossReferences`
is non-empty.

**Masking confirmed:** `src/__tests__/evidence-collector.test.ts:8` supplies `crossReferences: []`
in its fixture — the buggy inner loop body never executes under current test coverage. Confirmed
masked by test-data shape, not by dead-code unreachability.

**Frozen-zone status:** Confirmed still frozen. `CURRENT_MILESTONE.md` (current, re-read this
session): "Do not modify `src/reasoning/{domain,application,infrastructure,testing}/`... frozen."

**Decision:** Fix-now recommended in substance (a HIGH-severity, live `ReferenceError` risk), but
cannot be fixed within X.20.0 (investigation-only) or any non-frozen stage. **Deferred to X.20.5**
(frozen-zone production typing fixes), with a **GX-style governance exception recommended** given
this is a confirmed functional defect, not a style/type-strictness nitpick — matching this
project's own precedent that genuine correctness fixes to frozen files warrant individual review
rather than indefinite deferral.

---

## Cluster 2 — `src/acceptance/acceptanceFactory.ts`, `src/approval/approvalFactory.ts`,
`src/contract/contractFactory.ts`

**Confirmed real defect, all three.** Re-read each file and its real target module directly:

- `acceptanceFactory.ts` re-exports `createPrismaAcceptanceRepositories` from
  `./prismaAcceptanceRepositories`; the module's real export is `buildPrismaAcceptanceRepositories`.
- `approvalFactory.ts` re-exports `createPrismaApprovalRepositories` from
  `./prismaApprovalRepositories`; the module's real export is `buildPrismaApprovalRepositories`.
- `contractFactory.ts` re-exports `createPrismaContractRepositories` from
  `./prismaContractRepositories`; the module's real export is `buildPrismaContractRepositories`
  (a function; the file also separately exports a class `PrismaContractRepository`, not a factory
  function under that name).

**Dead-code confirmed:** repository-wide grep for all three broken names, excluding the three
factory files themselves, returns zero results — no real importer exists today.

**Frozen-zone status:** Confirmed not frozen — none of `src/acceptance/`, `src/approval/`,
`src/contract/` appears in `CURRENT_MILESTONE.md`'s current `do_not` list.

**Decision:** **Confirmed defect, recommended for X.20.4** (non-frozen production typing fixes) —
a mechanical, one-line-per-file rename (the re-export name to match the real export), zero
behavior change since nothing currently imports the broken name. Not fixed here.

---

## Cluster 3 — `src/providers/index.ts`

**Confirmed real defect.** Re-read directly: `ToolCall` is exported at line 150 from
`./ToolRegistry` and again at line 206 from `./ToolCallingAgent` (`TS2300`, both still firing).

**New finding, resolving the plan's own stated open question:** the plan asked "whether these are
meant to be the same shape or are a genuine naming collision between two unrelated concepts."
Direct comparison of both interface declarations shows they are **structurally identical**
(`{ name: string; arguments: Record<string, unknown> }` in both `ToolRegistry.ts:64` and
`ToolCallingAgent.ts:57`, differing only in comments) — not a collision between two different
concepts, but an independently-duplicated declaration of the same shape. `CURRENT_MILESTONE.md`
separately confirms `ToolRegistry.ts`'s own `ToolCall` is the one later code (`toolCallingTypes.ts`,
Phase X.6) deliberately reuses "as-is," suggesting the `ToolRegistry` declaration is the intended
canonical one.

**Frozen-zone status:** Confirmed still frozen. `CURRENT_MILESTONE.md` (current): "...or any of the
pre-existing `src/providers/*.ts` files (the unrelated 'P6' track...)."

**Decision:** **Deferred to X.20.5**, GX-style exception to be considered — the underlying fix
(removing one duplicate re-export) is now known to be trivial and safe given the confirmed-identical
shape, but the file itself remains frozen and any touch, however small, requires its own
individually-justified exception per this project's established discipline. Not fixed here.

---

## Cluster 4 — `src/notification/integration/notificationIntegration.ts`,
`src/storage/integration/storageIntegration.ts`

**Confirmed real defect, both files.** Re-read `IMasterDataRepository<T>`'s current declaration
(`src/masterdata/masterdataRepository.ts`) directly: it declares `create`, `update`, `delete`,
`archive`, `findById`, `findByCode`, `findActive`, `search`, `count` — **no `findAll`.** Both call
sites (`resolveDepartmentForNotification`, `resolveDepartmentForAttachment`) call
`masterdata.departments.findAll()`.

**New finding, adding precision the plan did not have:** the closest existing method is
`findActive()`, which is semantically **narrower** than what both call sites appear to need — both
resolve a department by matching `code` against every record to find the notification's/
attachment's owning department, including potentially a since-deactivated one; switching to
`findActive()` would silently fail to resolve an archived department's still-valid historical
records.

**Frozen-zone status:** Confirmed not frozen — neither `src/notification/integration/` nor
`src/storage/integration/` appears in the current `do_not` list.

**Decision:** **Confirmed defect, decision deferred pending an interface-owner design choice** — add
a real `findAll()` to `IMasterDataRepository`, or deliberately switch both call sites to
`findActive()` and accept the narrower semantics. This choice is itself a small design decision, not
a mechanical fact, and is explicitly **not made by this triage** — consistent with X.20.0's own
scope (confirm/deny and classify, not resolve open design questions). Recommended as a named,
scoped item for X.20.4 once that one decision is made by whoever owns the interface.

---

## Cluster 5 — `src/legal/prismaRepositories.ts`

**Confirmed real defect(s), two distinct root causes among the five diagnostics.**

1. **`fullText` drift (diagnostics at lines 60, 64, 65).** Re-read both sides directly: the domain
   `LegalDocument` interface (`src/legal/legalRegistry.ts:69-85`) does **not** declare `fullText`.
   The Prisma schema's `LegalDocument` model (`app/prisma/schema.prisma:48-64`) **does** declare
   `fullText String? @db.Text`. Confirmed genuine one-directional drift: the persistence layer has a
   field the domain type does not expose, and `save()` (`prismaRepositories.ts:60`) reads
   `doc.fullText` off the domain-typed parameter regardless.
2. **Possibly-undefined spread (line 54).** `doc.replaces` is declared `readonly string[] |
   undefined` (optional) on the domain type; `[...doc.replaces]` spreads it without a guard —
   confirmed a genuine null-safety gap, a separate root cause from the `fullText` drift.

The remaining diagnostic (`TS2345`, line 334) was not separately re-derived beyond confirming it
still fires at its cited location — grouped with the same investigation, not a third distinct root
cause requiring separate mention here.

**Frozen-zone status:** Confirmed not frozen — `src/legal/` does not appear in the current
`do_not` list.

**Decision:** **Confirmed defect, recommended for X.20.4** — needs one focused investigation
(reconcile `LegalDocument`'s domain type with the Prisma schema's own `fullText` field, plus add the
missing undefined-guard for `replaces`), not five separate mechanical patches. Not fixed here.

---

## Cluster 6 — `src/notification/application/notificationFactory.ts`

**Confirmed real defect.** Re-read directly: `BuildNotificationParams` declares `readonly createdBy:
string` (line 35) as a required input field. `buildNotification()` (lines 38-53) never includes
`createdBy` in its returned `CreateNotificationParams` object literal — the value is accepted as an
input and then silently dropped, not merely omitted from a type signature.

**Frozen-zone status:** Confirmed not frozen.

**Decision:** **Confirmed defect, recommended for X.20.4** — a trivial, one-line addition
(`createdBy: params.createdBy,`) once fix work is authorized. Not fixed here.

---

## Cluster 7 — `src/ai/auditTrailEngine.ts`

**Confirmed real defect.** Re-read directly: `UpdateNotification`
(`src/ai/updateNotificationEngine.ts:40-48`) does not declare `oldDate` or `newDate`.
`buildUpdateNotification(oldDate, newDate)` (same file, line 52) receives both as parameters but
never includes them in its returned object. `auditTrailEngine.ts:112` then reads
`notification.oldDate`/`notification.newDate` off that same return value — fields that were never
set, an omission bug of the identical shape to Cluster 6, in a different module.

**Frozen-zone status:** Confirmed not frozen — `src/ai/auditTrailEngine.ts` is a flat file directly
under `src/ai/`, outside the specifically-named frozen subdirectories
(`src/ai/{domain,application,infrastructure}/`, `src/ai/validation/`).

**Decision:** **Confirmed defect, recommended for X.20.4** — the reconciliation needs a decision
(add `oldDate`/`newDate` to `UpdateNotification` and thread them through
`buildUpdateNotification`'s return, or have `auditTrailEngine.ts` source the dates from elsewhere) —
noted as needing that one small decision, not assumed to be a pure mechanical fix. Not fixed here.

---

## Cluster 8 — `src/__tests__/notification-integration.test.ts`

**Confirmed real defect.** Re-read directly: the test imports `'../../masterdata/
masterdataRepository.ts'` and `'../../masterdata/masterdataTypes.ts'`. From
`src/__tests__/`, `../../` resolves to `app/`'s own root; the real files are at
`src/masterdata/masterdataRepository.ts` and `src/masterdata/masterdataTypes.ts` — one `../` too
many. Confirmed both imports currently fail (`TS2307`, both).

**Frozen-zone status:** Not applicable (test file, not production code); not in the `do_not` list
regardless.

**Decision:** **Confirmed defect, recommended for X.20.3** (test-only typing fixes) — a trivial,
one-line, two-import path correction (`../../` → `../`), zero production-code risk. Not fixed here.

---

## Cluster 9 — `src/reasoning/testing/mockKnowledgeFixtures.ts`

**Confirmed real defect (7 `TS2322` diagnostics, all still firing at their cited lines) — with a
more precise root cause than the plan's own stated uncertainty.** The plan asked "whether the
fixtures or the ref types drifted first." Direct inspection of one representative case
(`THRESHOLD_OPEN_TENDER_GOODS`, line 56): the literal value `thresholdType: 'PROCUREMENT_METHOD_
FLOOR'` **is** a valid member of the real `ThresholdType` union
(`src/reasoning/domain/reasoningTypes.ts:143-145`) — the fixture's own data is not semantically
wrong. The type error instead appears to stem from `Object.freeze({...})`'s own generic-inference
behavior: TypeScript infers the argument object's shape independently of the variable's outer
declared type (`ThresholdKnowledgeItemRef`), widening nested string-literal properties like
`thresholdType` to plain `string` before checking `Readonly<T>` against the declared type — a
type-inference-mechanics issue, not necessarily a fixtures-vs-ref-types semantic drift. This
narrows, but does not by itself resolve, the plan's own open question — a full fix would need to
confirm this diagnosis holds for all seven sites, not only the one sampled here.

**Frozen-zone status:** Confirmed still frozen. `CURRENT_MILESTONE.md` (current):
`src/reasoning/{domain,application,infrastructure,testing}/`, frozen — this file sits under
`src/reasoning/testing/`.

**Decision:** **Deferred to X.20.5**, GX-style exception to be considered — if the type-inference
diagnosis above is confirmed for all seven sites, the eventual fix may be purely additive
(annotation-only, e.g. `as const` on nested literals), a favorable risk profile for a GX exception,
but that confirmation and the exception decision itself remain outside X.20.0's own scope. Not
fixed here.

---

## Summary

| # | Cluster | Confirmed defect? | Frozen zone? | Decision |
|---|---|---|---|---|
| 1 | `evidenceCollector.ts` | Yes | Yes | Defer to X.20.5; GX exception recommended |
| 2 | Three factory re-exports | Yes (all three) | No | Recommend X.20.4 |
| 3 | `providers/index.ts` | Yes | Yes | Defer to X.20.5; GX exception to be considered |
| 4 | `IMasterDataRepository.findAll` | Yes (both files) | No | Recommend X.20.4, pending interface-owner decision |
| 5 | `legal/prismaRepositories.ts` | Yes (two root causes) | No | Recommend X.20.4 |
| 6 | `notificationFactory.ts` | Yes | No | Recommend X.20.4 |
| 7 | `auditTrailEngine.ts` | Yes | No | Recommend X.20.4, pending a small decision |
| 8 | `notification-integration.test.ts` | Yes | N/A (test-only) | Recommend X.20.3 |
| 9 | `mockKnowledgeFixtures.ts` | Yes | Yes | Defer to X.20.5; GX exception to be considered |

All nine clusters confirmed as real defects — none ruled out. Zero clusters were fixed by this
document; zero source or test files were modified to produce it. Per
`X20_TYPESCRIPT_REMEDIATION_PLAN.md` §8 and `RUNTIME_ITERATION_3_CONTRACT.md` §5, no bulk-fix stage
(X.20.2 onward) may begin before this record exists — it now does, for all nine clusters, none
silently omitted.

---

*End of decision record. No source file, test file, or configuration file was modified to produce
this document. No code was written. No frozen file was touched. No GX exception was granted — only
recommended, for a future, separately-authorized review. No fix was performed for any of the nine
clusters. Exactly one new markdown file was written.*
