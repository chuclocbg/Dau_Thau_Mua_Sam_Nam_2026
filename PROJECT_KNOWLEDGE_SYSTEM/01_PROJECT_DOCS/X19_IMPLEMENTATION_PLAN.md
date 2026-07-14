# Phase X.19 Implementation Plan — Concurrent-Scan-Safe Recovery (Optimistic Locking)

**Date:** 2026-07-14
**Governance:** First plan produced under Lean Governance v2. This is the sole planning
document for this phase — no Scoping Report, Architecture Decision, or Verification Report
accompanies it, per the new rules, unless implementation reveals a genuine architectural decision
that must be permanently recorded (assessed in §7 below).
**Status:** PLANNING ONLY. No source file was modified to produce this document. Implementation
does not begin until this plan is explicitly approved.
**Method:** Read directly from the current repository this session — `IBaseRepository.ts`,
`recoveryTypes.ts`, `memoryRecoveryRepository.ts`, `prismaRecoveryRepository.ts`,
`recoverableConversationTurn.ts`, `conversationRecoveryCoordinator.ts` — cross-checked against the
roadmap's own description of X.19 (`POST_X14_ARCHITECTURE_AUDIT.md` §8,
`PROJECT_BASELINE_AFTER_X16_AUDIT.md` §6, `CURRENT_MILESTONE.md`'s own carried-forward gap list).

---

## 1. Objectives

Close the **concurrent-scan-safety gap** in crash recovery, named as open technical debt since the
X.13 freeze: `conversationRecoveryCoordinator.ts`'s `restorePendingMarker()` re-reads a marker's
status immediately before acting, but this is a check-then-act race — two concurrent recovery
scans could both observe a marker as `PENDING` before either writes back a terminal status,
causing the same marker to be replayed twice. This plan closes that race with an optimistic-
locking (compare-and-swap) primitive, scoped narrowly to the recovery marker's own repository.

**A second, related gap — exactly-once semantics across a crash boundary — is explicitly OUT OF
SCOPE for this phase** (see §2). Both gaps are commonly discussed together in this project's own
roadmap language ("X.19 — Exactly-Once Recovery + Optimistic Locking"), but they are technically
independent, and bundling them would materially change this plan's risk profile for no added
benefit. This is a deliberate scope-narrowing decision, made explicitly here rather than silently.

---

## 2. Scope

### In scope
- Add an optimistic-locking primitive to **`IRecoveryRepository` only** (not the shared
  `IBaseRepository<T>` interface 24 other modules also implement) — a new method performing an
  atomic "update only if the marker is still `PENDING` and its `updatedAt` still matches what was
  last read" operation, returning `null` on a lost race instead of silently double-applying.
- Wire `conversationRecoveryCoordinator.ts`'s `recoverMarker()`/`restorePendingMarker()` to use
  this new primitive instead of the current read-then-update pattern.
- Both `MemoryRecoveryRepository` and `PrismaRecoveryRepository` implement the new method
  identically (matching every prior repository pair's own "same interface, both backends"
  convention).

### Explicitly out of scope, named up front
- **Exactly-once semantics across a crash boundary.** `recoverableConversationTurn.ts`'s own
  header already states this precisely: true exactly-once requires `runConversationTurn()`'s
  session-persist call and the recovery marker's completion update to share one atomic
  transaction — not achievable without modifying `conversationEntryOrchestrator.ts` (X.11, frozen)
  or the persistence layer's session repository (X.10/X.11, frozen). This is a materially larger,
  higher-risk change (touching currently-frozen code) than the concurrent-scan fix, and deserves
  its own dedicated, separately-scoped decision if ever pursued — not bundled here. Carried
  forward, unchanged, as a named, open gap.
- **Repo-wide `IBaseRepository<T>` optimistic locking.** No concrete, evidenced concurrent-write
  conflict exists today in any of the other 24 modules implementing this interface (acceptance,
  approval, auth, contract, knowledge, notification, payment, procurement, storage). Extending
  the shared base contract to all of them would be speculative engineering with no driving need —
  inconsistent with this project's own repeatedly-demonstrated discipline (e.g., X.20's own
  "need-driven only, not currently justified" framing). If a real concurrent-write conflict is
  ever found elsewhere, that module's own repository can adopt the same narrow pattern this phase
  establishes, independently, when actually needed.
- **A new Prisma migration.** `RecoveryMarker` already carries `updatedAt: string` (confirmed by
  direct read of `recoveryTypes.ts` and the Prisma-backed row shape) — this is already the natural
  compare-and-swap token. No new schema column is needed.

---

## 3. Files Expected to Change

| File | Change |
|---|---|
| `src/runtime/recovery/recoveryTypes.ts` | Add one new method signature to `IRecoveryRepository`, e.g. `resolveIfPending(id, expectedUpdatedAt, updates): Promise<RecoveryMarker \| null>`. |
| `src/runtime/recovery/memoryRecoveryRepository.ts` | Implement the new method: compare the in-memory record's current `updatedAt` and `status === 'PENDING'` against expectations atomically (single-threaded JS, so this is a straightforward guarded check, not a real race in-memory — implemented for interface parity and to make the *caller's* logic identical regardless of backend). |
| `src/runtime/recovery/prismaRecoveryRepository.ts` | Implement the new method via `updateMany({ where: { id, status: 'PENDING', updatedAt: expectedUpdatedAt }, data })`, checking the returned `count` — `0` means the compare-and-swap lost the race (already resolved or concurrently modified), returning `null`. |
| `src/runtime/recovery/conversationRecoveryCoordinator.ts` | `recoverMarker()` calls the new compare-and-swap method instead of the current unconditional `update()`; a `null` result maps to the existing `ALREADY_RESOLVED` outcome (no new outcome variant needed — the existing type already has the right shape for this). |
| `src/runtime/recovery/recoverableConversationTurn.ts` | **Optional, lower priority.** The producer path's own COMPLETED/FAILED transition is not subject to the concurrent-scan race (one producer call owns one marker's lifecycle) — using the same primitive here is a consistency nicety, not a requirement to close the named gap. Decide during implementation whether to include for uniformity or leave as-is. |
| **New test file(s)** | Unit tests for the compare-and-swap method (both backends): succeeds when the marker is still `PENDING` and `updatedAt` matches; returns `null` when the marker was already resolved; returns `null` when `updatedAt` has changed since it was read (simulating a concurrent update). A concurrency-simulation test proving two simultaneous "recover this marker" attempts result in exactly one success and one `ALREADY_RESOLVED` (the actual gap this phase closes). |
| **Unaffected, confirmed by this plan:** `src/shared/repository/IBaseRepository.ts`, all 24 other modules' repository files, `prisma/schema.prisma` (no migration), `src/runtime/conversationEntryOrchestrator.ts` (X.11, frozen), `src/persistence/` | Zero change required. |

---

## 4. Implementation Order

**Step 1 — Compare-and-swap primitive.** Add the new method to `IRecoveryRepository` and both
implementations, with unit tests proving correctness in isolation (valid CAS succeeds; stale CAS
returns `null`; already-resolved marker returns `null`). No wiring into the coordinator yet.

**Step 2 — Wire the coordinator.** `conversationRecoveryCoordinator.ts`'s `recoverMarker()` uses
the new primitive; a concurrency-simulation test proves the actual gap is closed (two simultaneous
recovery attempts against the same marker yield exactly one `recovered: true` and one
`ALREADY_RESOLVED`, never two replays).

**Step 3 — (Decide during Step 1/2, not before) Producer-path consistency.** If judged worthwhile,
apply the same primitive to `recoverableConversationTurn.ts`'s own transitions for uniformity.

**Step 4 — Freeze.** `X19_FREEZE_REPORT.md`, one commit. Then Milestone Close (`CURRENT_MILESTONE.md`/
`MILESTONE_HISTORY.md`), a separate one commit — neither performed by this plan.

Each of Steps 1–3 is its own commit, verified independently (affected tests, `tsc --noEmit`,
architecture guard suite, CI green), matching this project's own established "one step, one
commit" discipline — unchanged by the governance simplification.

---

## 5. Risks

| Risk | Category | Likelihood | Mitigation |
|---|---|---|---|
| Scope creep back toward the full "exactly-once + repo-wide locking" framing the roadmap's shorthand name suggests | Governance | Medium (the two-gap bundling is easy to default back into) | This plan's own explicit §2 scope boundary; re-state in the freeze report that the exactly-once gap remains open by deliberate choice |
| The new `IRecoveryRepository` method signature needs to evolve once real usage is wired in Step 2 (e.g., additional fields needed in the atomic update) | Technical | Low-Medium | Steps 1 and 2 are separate commits specifically so the interface can be adjusted between them before it's relied upon, without needing to revisit already-shipped, in-use code |
| Prisma's `updateMany` + count-check pattern has a subtly different failure mode than a real transaction (e.g., no row-level lock held between read and write) | Technical | Low | This is the standard, correct Prisma idiom for optimistic concurrency control (the `where` clause's own equality check against `updatedAt` is what makes the write atomic at the database level) — not a novel or risky pattern, well-documented Prisma usage |
| No live Postgres available in CI (per X.18's own decision) to exercise `PrismaRecoveryRepository`'s new method for real | Testing | Medium (pre-existing, unrelated to this phase) | Unit tests exercise the Prisma implementation's logic via the same testing conventions already used for every other Prisma-backed repository (mocked/memory-equivalent behavior verification); real live verification remains available via the same manual process X.17 already established, if desired |

---

## 6. Rollback Strategy

**Low risk.** The new method is purely additive to `IRecoveryRepository` — no existing method
signature changes, no existing caller's behavior changes until Step 2 explicitly wires it in.
Reverting Step 2's commit alone restores the exact pre-existing read-then-update pattern in
`conversationRecoveryCoordinator.ts` with zero effect on Step 1's now-unused-but-harmless new
method. Reverting Step 1 as well removes the new method entirely. No schema change means no
migration to roll back. No data migration risk — `RecoveryMarker` rows are unaffected in shape;
only the *logic* governing concurrent updates to them changes.

---

## 7. Architecture Decision Assessment

**No Architecture Decision document is anticipated for this phase, as scoped.** Per the new
governance rule, one is required only if a step changes "system architecture, persistence model,
Docker topology, Prisma architecture, authentication model, deployment strategy,
messaging/event architecture, database engine, or caching strategy." This plan's scope is a
narrow, additive extension to **one already-existing module's own repository interface**
(`IRecoveryRepository`, not the shared `IBaseRepository<T>` contract) — no new persistence
technology, no schema change, no change to how any other module persists data, and no
precedent-breaking pattern (X.13 itself added `findPending()`/`findBySessionId()` as module-
specific extensions to this same interface without a standalone decision document). This
determination should be revisited only if implementation reveals a genuine need to touch the
shared `IBaseRepository<T>` contract or any frozen file outside `src/runtime/recovery/` — neither
is anticipated by this plan.

---

## 8. Acceptance Criteria

1. `IRecoveryRepository` gains exactly one new method; `IBaseRepository<T>` is unchanged.
2. Both `MemoryRecoveryRepository` and `PrismaRecoveryRepository` implement the new method with
   equivalent semantics, proven by tests exercising both.
3. A concurrency-simulation test proves the actual named gap is closed: two simultaneous
   `recoverMarker()` calls against the same `PENDING` marker result in exactly one success and one
   `ALREADY_RESOLVED` — never a duplicate replay.
4. `tsc --noEmit` clean; the full architecture guard suite passes unchanged (35/35, or with
   exactly one new guard if a dedicated X.19 guard is judged worthwhile — decided during
   implementation, not mandated here); the full test suite passes with zero regression in any of
   the 553 existing files.
5. CI (GitHub Actions, per X.18) is green on every step's commit — the tooling-enforced gate X.18
   just built is itself exercised for the first time by a real feature milestone, not just CI's
   own configuration commits.
6. `git diff --stat` against the pre-X.19 baseline shows changes only within
   `src/runtime/recovery/` and its own test files — no frozen file outside that directory touched.
7. The freeze report states plainly that exactly-once semantics remain an open, deliberately
   deferred gap — not implied as solved by this phase's own "Optimistic Locking" half of the
   roadmap's paired name.

---

*End of plan. No source code was modified. No tests were modified. No commits were created. Phase
X.19 implementation has not begun — awaiting explicit approval of this plan before Step 1.*
