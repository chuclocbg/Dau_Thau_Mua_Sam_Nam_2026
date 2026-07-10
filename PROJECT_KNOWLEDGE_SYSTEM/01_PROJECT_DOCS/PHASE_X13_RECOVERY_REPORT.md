# Phase X.13 — Conversation Persistence Recovery & Crash Resilience — Report

**Date:** 2026-07-10
**Scope:** implement conversation recovery after server restart, process crash, graceful
shutdown, unfinished conversations, and interrupted streaming — reusing existing runtime/session
infrastructure, never duplicating it, never modifying any frozen milestone (X.3–X.12).

---

## What Was Inspected First

- **`src/runtime/conversationEntryOrchestrator.ts`** (X.11, frozen) — `runConversationTurn()`
  resolves/creates a session, runs the reasoning chain, then persists the session in **one**
  atomic `RuntimeSessionBuilder.persist()` call at the end. Consequence confirmed by inspection:
  a crash mid-turn leaves no partially-corrupted session — but also leaves no record that a turn
  was ever attempted, since nothing is written until the very end. This is the exact gap
  recovery metadata needed to exist for.
- **`src/runtime/runtimeContext.ts`** (X.11, frozen) — no session/recovery-adjacent field beyond
  `sessionRepository`/`attachmentRepository`. Confirmed: adding recovery must not add a field to
  this frozen interface.
- **`src/conversation/domain/conversationTypes.ts`** (`AdvisorySessionStatus`, X.1) —
  `CREATED | ACTIVE | IDLE | ARCHIVED`. Confirmed this is session-lifecycle bookkeeping, a
  different concern from "was a specific turn attempt interrupted" — recovery metadata was
  deliberately kept as its own concept rather than overloading this frozen enum.
- **`src/server/main.ts`** (X.9.1, frozen) — the only file calling `.listen()`, with a
  `registerGracefulShutdown({ onShutdown })` hook defined inline. Confirmed: this milestone's
  own instructions grant no carve-out (unlike X.9.2–X.9.5/X.10/X.11's narrow "wiring only"
  exceptions) — `main.ts` cannot be extended to call a startup recovery scan without modifying a
  frozen file.
- **`src/startup/gracefulShutdown.ts`** (X.9.1, frozen) — closes the HTTP listener (draining
  in-flight requests) before exiting, racing a hard timeout. Confirmed: an *orderly* shutdown
  already drains in-flight work by design; recovery metadata mainly protects against the
  *disorderly* case (SIGKILL, OOM, an uncaught exception, or the hard-timeout path firing).
- **`src/persistence/prismaTransaction.ts`** (X.10, frozen) — `withTransaction()` exists but
  cannot be used to make `runConversationTurn()`'s session-persist and a recovery-marker update
  atomic without modifying `runConversationTurn()` itself (frozen). This directly shaped the
  "at-least-once, not exactly-once" limitation documented below.
- **Repo-wide grep** for any existing "recovery"/"crash"/"pending marker" concept — none found.
  Confirmed genuinely missing, not a duplicate of anything.

---

## Determination

No recovery/crash-resilience infrastructure existed. Everything below is new, additive, and
built without modifying a single byte of any X.3–X.12 file.

---

## What Was Built

### Recovery metadata (`src/runtime/recovery/recoveryTypes.ts`)

`RecoveryMarker { id, createdAt, updatedAt, sessionId?, question, asOfDate?, status, startedAt,
completedAt?, error? }` — one row per conversational-turn *attempt*, independent of
`AdvisorySessionStatus`. `isUnfinished(marker)` is the "unfinished stream/turn detection"
predicate: true only while `status === 'PENDING'`. Since no session-aware streaming conversation
endpoint exists yet (X.12 built only a non-streaming `POST /api/v1/conversation/turn`), this
predicate is deliberately transport-agnostic — it would apply identically to a future streaming
endpoint without any change, which is the honest scope of "unfinished stream detection" this
milestone could build without inventing a new HTTP endpoint (not among the requested
capabilities).

### Recovery queue + repositories (`memoryRecoveryRepository.ts`, `prismaRecoveryRepository.ts`)

`IRecoveryRepository extends IBaseRepository<RecoveryMarker>`, plus `findPending()` (the
recovery queue itself — the durable set of PENDING rows, oldest first; no separate in-memory
queue structure was introduced) and `findBySessionId()`. Two implementations, mirroring every
other module's exact convention: `MemoryRecoveryRepository` and `PrismaRecoveryRepository`
(reuses `getPrismaClient()`/`mapPrismaRow()`, never a new client or new date-conversion logic).

### New, additive Prisma model

`ConversationRecoveryMarker` (+ `RecoveryMarkerStatus` enum) appended to `prisma/schema.prisma` —
zero existing model touched. Migration generated via schema-to-schema `prisma migrate diff` (no
shadow database needed, same technique as X.11), never applied to a live database (Docker
unavailable in this environment). `prisma.config.ts` required no change (no new seed entry).

### Recoverable conversation turn — the producer (`recoverableConversationTurn.ts`)

`runRecoverableConversationTurn(recoveryRepository, runtime, request)` — the genuinely-missing
piece that makes recovery possible at all: without it, no marker would ever be created, and the
queue would always be empty. Wraps `runConversationTurn()` (imported and called as-is, never
reimplemented): writes a PENDING marker before the call, COMPLETED after success, FAILED (error
captured, never swallowed) if it throws — then re-throws.

### Conversation recovery coordinator (`conversationRecoveryCoordinator.ts`)

`recoverMarker()` — recovers exactly one marker. **Pending-session restoration** is not a new
mechanism: it is `runConversationTurn()`'s own existing resume-or-create logic, invoked again
with the marker's recorded `sessionId`/`question`/`asOfDate` — deterministic replay of the
original request, not a second session-resolution mechanism. **Idempotent recovery execution**:
`restorePendingMarker()` re-reads the marker's current status immediately before acting and
returns `null` if it is no longer PENDING — a second `recoverMarker()` call on an
already-resolved marker is a safe, verified no-op (`ALREADY_RESOLVED`).

### Runtime recovery manager — the startup scan (`runtimeRecoveryManager.ts`)

`runStartupRecoveryScan(recoveryRepository, runtime)` — drains the queue sequentially, delegating
each marker to the coordinator (owns the scan loop only, zero per-marker replay logic of its own,
verified by architecture guard). Returns a summary (`scanned/recovered/failed/alreadyResolved`).

### CLI entrypoint (`scripts/recoveryScan.ts`)

Mirrors the established `scripts/waitForReady.ts`/`scripts/smokeTest.ts` (X.9.5) and
`prisma/seed.ts` (X.10) conventions exactly (same `main().then().catch()` shape, same clear
`console.log`/exit-code pattern). Builds a real `Application` + Prisma-backed session/recovery
repositories and runs the scan. **Deliberately not invoked from `src/server/main.ts`** — see
Dependency Graph below.

---

## Honest Limitations (stated plainly, not glossed over)

1. **At-least-once, not exactly-once, replay.** If the process dies in the narrow window after
   `runConversationTurn()` has already persisted the session but before the marker is marked
   COMPLETED, a later replay of that marker appends a duplicate turn. True exactly-once would
   require the session persist and the marker completion to share one atomic transaction — not
   achievable without modifying `runConversationTurn()` (frozen, X.11) or the session repository
   (frozen, X.10/X.11). Out of scope for this milestone by the letter of its own instruction, not
   silently ignored.
2. **No true concurrent-safe idempotency.** `IBaseRepository` has no optimistic-locking primitive
   (a pre-existing, previously-logged gap — see `docs/prisma-production.md`). Idempotency here is
   verified and correct for the realistic **sequential** startup-scan case (re-scanning after a
   scan already ran finds nothing to do); two recovery scans running *concurrently* against the
   same marker could both pass the PENDING check before either writes COMPLETED. Not solved here.
3. **Not wired into `main.ts`'s boot sequence.** `main.ts` is frozen (X.9.1) and this milestone's
   instructions permit no carve-out for it, unlike X.9.2–X.9.5/X.10/X.11's own narrow exceptions.
   `runStartupRecoveryScan()` is complete and tested; invoking it automatically on process start
   is a deliberate, explicitly out-of-scope gap for a future, separately-authorized milestone.

---

## Dependency Graph (verified by architecture guard and integration tests)

```
scripts/recoveryScan.ts (X.13, new — NOT invoked by main.ts)
  └─ runStartupRecoveryScan(recoveryRepository, runtime)          (X.13, new)
       └─ recoverMarker(recoveryRepository, runtime, markerId)    (X.13, new)
            ├─ restorePendingMarker()  — idempotency check        (X.13, new)
            └─ runConversationTurn(runtime, { sessionId?, question, asOfDate? })   (X.11, frozen, unmodified)
                 ├─ RuntimeSessionBuilder.resumeSession()/.createSession()          (X.11, frozen)
                 ├─ detectIntent() -> reasoningPipeline.answer() -> formatConversationResponse() -> runToolCallingStage()   (X.2–X.6, frozen)
                 └─ RuntimeSessionBuilder.persist()                                 (X.11, frozen)

runRecoverableConversationTurn(recoveryRepository, runtime, request)   (X.13, new — the producer;
  └─ runConversationTurn(runtime, request)   (X.11, frozen, unmodified)   not wired into
                                                                            conversationRoutes.ts/
                                                                            httpServer.ts, X.12,
                                                                            frozen)
```

`IRecoveryRepository` and `RuntimeContext` are composed separately at each call site — no field
was added to `RuntimeContext` itself.

---

## Tests

- **Unit tests**: `x13-recovery-repository.test.ts` (11 tests — `MemoryRecoveryRepository` CRUD,
  `findPending()` FIFO ordering, `isUnfinished()`), `x13-recoverable-conversation-turn.test.ts`
  (5 tests — success marks COMPLETED with the real `sessionId`; a simulated persistence failure,
  via a session repository whose `update()` rejects, marks FAILED with the real error and
  re-throws rather than swallowing it).
- **Recovery + idempotency tests**: `x13-recovery-coordinator-and-manager.test.ts` (9 tests —
  pending-session restoration for both a brand-new session and an existing one resumed by its
  real `sessionId`; idempotent recovery execution proven by recovering the same marker twice and
  asserting no duplicate turn was appended; the startup scan draining a mixed queue and being a
  clean no-op on an already-drained one).
- **Integration + recovery-scenario + replay tests**: `x13-recovery-integration-replay.test.ts`
  (7 tests) — against a real `Application`. A "crash" is simulated the only honest way possible
  in a test process: a PENDING marker is written directly, exactly what
  `runRecoverableConversationTurn()` would have left behind had the process actually died.
  Scenarios: a crash during a brand-new session's first turn (recovery creates the
  never-persisted session), a crash during an existing session's second turn (recovery resumes
  the *same* session, not a new one), and three independent crashed sessions recovered in one
  scan. Deterministic replay verification: recovering the same interrupted request twice (fresh
  runtimes) yields identical `confidenceLabel`/`markdown`/`turnNumber`; a recovered turn's output
  is proven identical to what an uninterrupted turn against the same question would have produced.
- **Prisma + migration tests**: `x13-prisma-recovery-repository.test.ts` (5 tests) — matches the
  established `DATABASE_URL`-missing convention (LRD-12, X.10/X.11's own precedent) plus a real
  `npx prisma validate` CLI run.
- **Architecture guard**: `x13-recovery-architecture-guard.test.ts` (10 tests) — confirms
  `src/runtime/recovery/` has exactly the 6 expected files; confirms the producer/coordinator
  import *only* `runConversationTurn` from the orchestrator (never `detectIntent`/
  `formatConversationResponse`/`runToolCallingStage`/`RuntimeSessionBuilder`/`ConversationSession`
  directly — checked by exact import-statement match, proving zero duplication of orchestration
  internals); confirms the manager contains no per-marker replay logic of its own; confirms every
  prior `schema.prisma` section marker plus exactly one new X.13 section; confirms **every**
  frozen X.3–X.12 file (including `main.ts`, `gracefulShutdown.ts`, both X.9.1 routes, all 5
  X.11 Runtime files, both X.12 files) is byte-for-byte unmodified — including an explicit check
  that `main.ts` contains no reference to "recovery" at all, architecturally proving the
  documented wiring gap.

**Full suite result:** 537 test files, 14,726 tests passed, 3 skipped (X.10's
`TEST_DATABASE_URL`-gated tests, unaffected), 0 failures — up from 531 files / 14,679 tests at
the X.12 freeze baseline (+6 files, +47 tests, exactly the new X.13 test files). `tsc --noEmit`
clean.

---

## Verification

- `git status` confirms exactly 6 new files under `src/runtime/recovery/`, 1 new CLI script, 1
  new migration folder, 6 new test files, and 1 modified file (`schema.prisma`) — zero other
  file touched.
- `git diff` on `schema.prisma` confirms 30 insertions, 0 deletions — purely additive.
- `npx tsx scripts/recoveryScan.ts` run live in this environment: fails cleanly with the real
  `DATABASE_URL is not set` error and exit code 1 (Docker/Postgres unavailable here) — the same
  honest, non-fabricated verification discipline used for every CLI script since X.9.4.

---

## Explicit Statement

**No frozen file (X.3–X.12) was modified.** No session-resolution logic, no reasoning/output/
tool-calling logic, and no new API route were duplicated or reimplemented — recovery is a thin,
additive layer that calls `runConversationTurn()` exactly as X.11 left it. The two honest
limitations above (at-least-once replay, no concurrent-scan locking) and the deliberate
`main.ts` wiring gap are named explicitly, not glossed over.

*Per this milestone's explicit closing instruction, work stops here. Phase X.13 is frozen. No
business-domain milestone begins automatically.*
