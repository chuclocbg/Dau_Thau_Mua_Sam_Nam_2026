# Phase X.11 — Application Runtime — Report

**Date:** 2026-07-10
**Scope:** the runtime layer that connects the frozen AI Engine (X.3–X.8) to real, persisted
application conversations. Business modules remain out of scope.

---

## Governing Instruction

Confirmed before any code was written: X.3–X.10 are frozen (verified against
`CURRENT_MILESTONE.md`'s `do_not` list and every frozen-file marker, re-checked by this
milestone's own architecture guard). Phase X.1 (Conversation Core) is **not** in that frozen
list — this milestone makes small, additive, non-breaking extensions to it where the runtime
genuinely needed a capability X.1 didn't yet expose (session rehydration), never a redesign.
Implement-only scope, per the request: ConversationSession, Session lifecycle, Conversation
persistence, Attachment persistence, RuntimeContext, RuntimeSessionBuilder, Conversation entry
orchestration, Runtime dependency composition. No AI/reasoning/MCP/Tool-Calling/Output/Prisma
redesign; no business logic.

---

## What Was Inspected First

- **`src/conversation/`** (Phase X.1, frozen shape, not frozen from modification): pure,
  in-process state managers — `SessionStateManager` (4-stage lifecycle CREATED→ACTIVE→IDLE→
  ARCHIVED), `ConversationContextManager` (per-turn question/advisor bookkeeping, deliberately
  **not** part of the persisted shape), `AdvisoryConversationMemory` (token-budget pruning) —
  plus the persisted DTO `AdvisoryConversationSession` and its only existing repository,
  `MemorySessionRepository` (in-memory, explicitly commented "a Prisma-backed implementation
  follows later, never before this module is proven").
- **`src/bootstrap/buildApplication.ts`** (X.9.1, frozen): the existing composition root. Its
  `Application.repository` field is the **knowledge** repository, not a session repository —
  confirming Application Runtime is a genuinely new, additive composition layer, not a
  modification of this one.
- **`src/api/reasoningRoutes.ts`** (X.9.1, frozen): confirmed the current HTTP layer is entirely
  stateless — `detectIntent()` → `reasoningPipeline.answer()` → `formatConversationResponse()`
  → `runToolCallingStage()` per request, no session concept at all. This is the exact chain the
  new orchestration reuses, unmodified.
- **`src/storage/`** (Phase M1, pre-existing, predates Phase X): a generic, module-agnostic
  `AttachmentReference`/`IAttachmentReferenceRepository` abstraction already used by
  package/contract/acceptance/approval, each with its own `moduleType` string. Confirmed the
  correct reuse target for "Attachment persistence" — no new attachment concept needed.
  `buildMemoryStorageRepositories()`/`buildPrismaStorageRepositories()` already exist.
- **`prisma/schema.prisma`**: no existing model for conversation/session persistence (grepped
  all 82 models — `AcceptanceSession`, `AuthSession`, `StorageUploadSession` exist; none for
  conversations). Confirmed genuinely missing.
- **`src/reasoning/`, `src/mcp/`, `src/multiagent/`, `src/providers/`**: inspected only to
  confirm their public entry points and that a single conversational turn needs none of
  MCP/Multi-Agent (no batch/remote-tool concern in scope here) — zero imports from either in the
  new Runtime code, verified by architecture guard.

---

## What Was Built

### Conversation persistence (Prisma-backed `ISessionRepository`)

- **`src/conversation/infrastructure/prismaSessionRepository.ts`** — `PrismaSessionRepository`
  implements the exact same `ISessionRepository` interface `MemorySessionRepository` already
  satisfies. Reuses `getPrismaClient()` and `mapPrismaRow()`, matching every other module's
  `prisma*Repositories.ts` convention exactly.
- **New Prisma model** (additive, `prisma/schema.prisma`): `ConversationSession { id,
  sessionState Json, history Json, createdAt, updatedAt }`. `sessionState`/`history` are stored
  as opaque JSON since they are already plain, self-contained value objects with no independent
  query need of their own fields — identical in shape to what `MemorySessionRepository` already
  stores, just durable. Zero existing model touched. Migration generated via
  `prisma migrate diff` (schema-to-schema, no shadow database needed) at
  `prisma/migrations/20260710120000_add_conversation_session/migration.sql` — a single
  `CREATE TABLE`, never applied to a live database (Docker unavailable in this environment,
  consistent with every prior milestone since X.9.4).

### Session lifecycle + ConversationSession (Runtime aggregate)

- **`src/runtime/conversationSession.ts`** — `ConversationSession`, the Runtime-layer aggregate
  wrapping the frozen X.1 managers rather than reimplementing their logic. Tracks two
  identifiers deliberately kept distinct, matching X.1's own pre-existing design (confirmed via
  its own test fixtures): `repoId` (repository-assigned primary key) and `sessionId` (the
  business-facing id embedded in `AdvisorySessionState`, looked up via the already-existing
  `findBySessionId()`). `IBaseRepository.create()`'s signature never lets a caller supply its
  own id, so these two identifiers are independent by the pre-existing contract's own design —
  not a defect this milestone works around, a fact it respects.
- **Two small, additive extensions** to Phase X.1 (zero existing lines changed, verified by
  architecture guard marker checks):
  - `SessionStateManager.fromState(state)` — rehydrates a manager from a persisted state (the
    constructor only ever builds a fresh `CREATED` session).
  - `SessionStateManager.addAttachmentRef(attachmentId)` — appends to the existing-but-previously
    unused `attachmentRefs` field.
  - `AdvisoryConversationMemory.fromHistory(history)` — rehydrates memory from persisted history.
- `ConversationSession.applyLifecycleCheck()` reuses `SessionStateManager`'s existing
  `isDueForIdle()`/`isDueForArchive()`/`transitionTo()` as-is — no new lifecycle rule invented.
  Idle/archive thresholds remain caller-supplied (per `SessionStateManager`'s own documented "no
  hardcoded institutional policy" design).

### Attachment persistence

- **`src/runtime/sessionAttachments.ts`** — `attachFileToSession()`/`listSessionAttachments()`,
  thin functions supplying the `moduleType: 'CONVERSATION_SESSION'` convention over the
  pre-existing `IAttachmentReferenceRepository`. Reuses `buildAttachmentReference()` from
  `src/storage/application/storageFactory.ts` rather than constructing reference objects
  directly. Never touches file bytes, upload mechanics, or any Storage module file — a
  conversation session is simply one more `moduleType` value, exactly like `PACKAGE`/`CONTRACT`.

### RuntimeContext (Runtime dependency composition)

- **`src/runtime/runtimeContext.ts`** — `buildRuntimeContext()`, mirroring
  `buildApplication()`'s own composition-root pattern exactly (plain options-in,
  wired-object-out function, never a class or DI container). Composes the existing `Application`
  wholesale as one member (never modifies `buildApplication.ts`), adding only the two genuinely
  new dependencies: `sessionRepository` and `attachmentRepository`. Defaults to memory-backed
  implementations — matching `buildApplication()`'s own current use of memory-backed knowledge
  repositories and this project's established "memory-first, Prisma-backed follows as an
  explicit opt-in" convention.

### Conversation entry orchestration

- **`src/runtime/conversationEntryOrchestrator.ts`** — `runConversationTurn()`, the one new
  entry point. Given a question (and optionally an existing `sessionId`), resolves/creates the
  session via `RuntimeSessionBuilder`, then calls the **exact same** chain
  `reasoningRoutes.ts` already calls — `detectIntent()` → `reasoningPipeline.answer()` →
  `formatConversationResponse()` → `runToolCallingStage()` with the default `neverInvokeTool`
  decider — before recording the turn and persisting it. No reasoning/output/tool-calling logic
  of its own; verified by architecture guard that these are genuine imports of already-public,
  already-frozen functions, not reimplementations.
  - Token counting mirrors `src/ai/application/aiContextBuilder.ts`'s own private
    `estimateTokens()` (4 chars/token) rather than importing it, since that function is not
    exported and Phase X.2's `aiContextBuilder.ts` may not be modified just to export one
    two-line helper. Duplicating this specific, trivial arithmetic estimate is the smaller,
    explicitly-acknowledged exception to "never duplicate."
  - An unknown/expired `sessionId` gracefully starts a new session rather than throwing —
    documented, not hidden.

### RuntimeSessionBuilder

- **`src/runtime/runtimeSessionBuilder.ts`** — `createSession()` / `resumeSession()` /
  `persist()`. `resumeSession()` uses `findBySessionId()` (the lookup method X.1's own author
  already built for this exact purpose) and applies the existing idle/archive lifecycle check on
  resume, with caller-configurable thresholds (defaults: 30 min idle / 24h archive).

---

## Tests

- **Unit tests**: `x11-conversation-session.test.ts` (14 tests — `ConversationSession` plus the
  three additive X.1 methods, including a parity check proving rehydrated managers still apply
  the *existing* transition/pruning rules, not reimplemented ones), `x11-runtime-session-builder
  .test.ts` (8 tests, against a real `MemorySessionRepository`), `x11-runtime-context.test.ts` (2
  tests), `x11-session-attachments.test.ts` (5 tests, against a real
  `MemoryAttachmentReferenceRepository`), `x11-prisma-session-repository.test.ts` (4 tests,
  matching the established `DATABASE_URL`-missing convention from `legal-repo-document.test.ts`'s
  LRD-12 and Phase X.10's own precedent).
- **Integration + replay test**: `x11-conversation-entry-orchestrator-integration.test.ts` (7
  tests) — a true end-to-end run against a **real** `Application` (real memory-backed
  `IKnowledgePlatform` + `LegalProvider`, the complete frozen `ReasoningEnginePipeline`, a real
  `ToolExecutor` — the same "real Application" every X.9.1+ integration test already uses).
  Proves a first turn produces a real `ToolAugmentedResponse` and persists exactly one USER +
  one ASSISTANT message; the replay tests prove a **second** `runConversationTurn()` call
  resumes the same session (`turnNumber` advances to 2, history accumulates to 4 messages) and
  that replaying the same two-question sequence twice is deterministic (same turn counts, same
  confidence label) — proving continuity is genuinely persisted and rehydrated across separate
  calls, not just held in in-process memory within one call.
- **Architecture guard**: `x11-application-runtime-architecture.test.ts` (13 tests) — confirms
  `src/runtime/` has exactly the 5 expected files with no scope creep; imports nothing from
  `src/mcp/`, `src/multiagent/`, or any business-domain module (storage is the sole, deliberate
  exception); only the orchestrator imports from `src/reasoning/`, and only the specific
  already-public entry functions (checked by exact import-statement match); no reasoning/
  citation/scoring logic is reimplemented; `sessionAttachments.ts` and `prismaSessionRepository
  .ts` both reuse existing builders/clients rather than reconstructing objects or connections
  directly; every prior milestone's frozen-file marker (X.4–X.9.3, X.10) is unchanged; the two
  X.1 extensions are additive-only (every pre-existing method/marker still present, byte-checked);
  `prisma.config.ts` and every prior `schema.prisma` section marker are unchanged, plus exactly
  one new X.11 section; `prismaClient.ts` and `IBaseRepository.ts` remain byte-for-byte
  unmodified; `buildApplication.ts`'s `Application` interface is unchanged.

**Full suite result:** 529 test files, 14,663 tests passed, 3 skipped (X.10's
`TEST_DATABASE_URL`-gated integration tests, unaffected by this milestone), 0 failures — up from
522 files / 14,610 tests at the X.10 freeze baseline (+7 files, +53 tests, exactly the new X.11
test files). `tsc --noEmit` clean. X.1's own pre-existing architecture guard
(`conversation-architecture.test.ts`) re-verified passing after the additive extensions.

---

## Verification

- `git status` confirms the only pre-existing files touched are the two additive X.1 extensions
  (`sessionState.ts`, `conversationMemory.ts`) and `prisma/schema.prisma` (one new model
  appended) — zero other file in any frozen X.3–X.10 directory, and zero other Phase M1 Prisma
  file, was touched.
- Docker/Postgres remain unavailable in this environment — the new migration was generated via
  schema-to-schema diffing (no shadow database required) and never applied to a live database;
  `PrismaSessionRepository`'s tests honestly exercise the real `DATABASE_URL`-missing guard
  rather than mocking a connection.

---

## Explicit Statement

**No AI/reasoning logic, no MCP change, no Tool Calling change, no Output change, and no
redesign of any existing Prisma model was introduced.** The Application Runtime is a thin
orchestration layer: it composes the already-frozen `Application` with two genuinely new
dependencies (session + attachment repositories), calls the exact same public reasoning/
formatting/tool-calling functions `reasoningRoutes.ts` already calls, and persists conversation
state through one new, additive Prisma model plus a Prisma-backed implementation of an interface
Phase X.1 had already defined and left for later. HTTP wiring (registering this orchestration as
a new server route) was intentionally **not** built — it is not among this milestone's eight
listed deliverables, and `src/api/**` was inspect-only, not implement-only, for this milestone.

*Per this milestone's explicit closing instruction, work stops here. Phase X.11 is frozen. No
business-domain milestone (X.12 or otherwise) begins automatically.*
