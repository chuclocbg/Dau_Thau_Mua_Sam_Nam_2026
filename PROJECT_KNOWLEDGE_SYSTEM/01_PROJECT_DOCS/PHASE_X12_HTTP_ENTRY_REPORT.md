# Phase X.12 — Conversation HTTP Entry Verification — Report

**Date:** 2026-07-10
**Scope:** verify whether a complete HTTP conversation entry already exists, before writing any
code. If yes, verify and document only. If no, implement the smallest compatible HTTP
composition root — never duplicating orchestration, RuntimeContext, ConversationSession, or API
routing, never redesigning anything.

---

## What Was Inspected First

- **`src/output/`, `src/toolcalling/`** — confirmed these directories do not exist. Output
  formatting and tool-calling logic live inside `src/reasoning/application/` (`outputFormatter.ts`,
  `toolCallingStage.ts`), as established since Phase X.5/X.6.
- **`src/api/reasoningRoutes.ts`** (X.9.1, frozen) — read in full. Registers
  `POST /api/v1/reasoning/answer`, calling `detectIntent()` → `app.reasoningPipeline.answer()` →
  `formatConversationResponse()` → `runToolCallingStage()`. This reaches 4 of the 5 required
  steps but is **entirely stateless**: no `RuntimeSessionBuilder`, no session persistence, no
  `ConversationSession` — it operates directly on `Application`, never `RuntimeContext`.
- **`src/api/coordinatorRoutes.ts`** (X.9.1, frozen) — the unrelated multi-agent batch path
  (`POST /api/v1/reasoning/batch`). Also stateless, no session involvement.
- **`src/server/httpServer.ts`** (X.9.1, extended X.9.2/X.9.3) — registers `/live`, `/ready`,
  `/health`, the reasoning/coordinator/streaming routes. No reference to `src/runtime/`.
- **`src/bootstrap/buildApplication.ts`** (X.9.1, frozen) — `Application`'s fields
  (`repository, reasoningPipeline, toolRegistry, toolExecutor, coordinator, mcpClient?,
  startedAt, logger, metrics, tracer, nodeEnv, streamTimeoutMs`) confirm no session/runtime
  member exists here either.
- **`src/runtime/conversationEntryOrchestrator.ts`** (X.11, frozen) — `runConversationTurn()` is
  the only function in the repository that reaches the complete required chain: `detectIntent` →
  `RuntimeSessionBuilder` → `reasoningPipeline.answer()` → `formatConversationResponse()` →
  `runToolCallingStage()`.
- **Repo-wide grep** for `runConversationTurn`, `RuntimeSessionBuilder`, `RuntimeContext`,
  `buildRuntimeContext`, `ConversationSession` across `src/api/`, `src/server/`,
  `src/bootstrap/` — **zero matches**, before this milestone's changes. Confirmed: the X.11
  Conversation Runtime was built but never wired to any HTTP entry point, exactly as X.11's own
  report and `CURRENT_MILESTONE.md` stated explicitly ("HTTP wiring... intentionally not built").

## Determination

**NO** — no HTTP entry invoked the complete Conversation Runtime before this milestone. Per the
governing instruction's branch 4: implement only the smallest compatible HTTP composition root.

---

## What Was Built

### `src/api/conversationRoutes.ts` (new file)

`registerConversationRoutes(server, runtime: RuntimeContext)` — registers
`POST /api/v1/conversation/turn`. The entire file is a thin request/response mapper: parses
`{ sessionId?, question, asOfDate? }`, calls `runConversationTurn(runtime, parsed)` — the
existing, unmodified X.11 orchestrator — and returns `{ ok: true, data: result }`. Deliberately
imports **only** `runConversationTurn` and the `RuntimeContext` type; does **not** import
`detectIntent`, `formatConversationResponse`, `runToolCallingStage`, `RuntimeSessionBuilder`, or
`ConversationSession` — those are `runConversationTurn()`'s own internal, already-tested
composition, not this file's concern. Mirrors `reasoningRoutes.ts`'s exact "thin handler →
validate → call service → map response" structure and error-response shape.

### `src/server/httpServer.ts` (additive wiring only)

Two new imports, one new line constructing a `RuntimeContext` via
`buildRuntimeContext({ application: app })` (memory-backed by default, mirroring how
`buildApplication()` itself defaults to memory-backed knowledge repositories), and one new line
registering `registerConversationRoutes(server, runtime)`. This is the exact same "wiring only"
carve-out X.9.2 and X.9.3 already used on this same file (documented in its own header comments)
— zero existing lines changed, verified below.

```diff
+import { registerConversationRoutes } from '../api/conversationRoutes.ts'
+import { buildRuntimeContext } from '../runtime/runtimeContext.ts'
...
   registerReasoningStreamRoute(server, app, { streamTimeoutMs: app.streamTimeoutMs })

+  const runtime = buildRuntimeContext({ application: app })
+  registerConversationRoutes(server, runtime)
```

---

## Dependency Graph (as verified end-to-end over real HTTP)

```
POST /api/v1/conversation/turn                              (X.12, new — src/api/conversationRoutes.ts)
  └─ runConversationTurn(runtime, { sessionId?, question, asOfDate? })   (X.11, unmodified)
       ├─ RuntimeSessionBuilder.resumeSession() / .createSession()      (X.11, unmodified)
       │    └─ ISessionRepository (memory-backed, via RuntimeContext)   (X.1 / X.11, unmodified)
       ├─ detectIntent()                                                (X.2 Batch A, unmodified)
       ├─ Application.reasoningPipeline.answer()                        (X.4, unmodified)
       ├─ formatConversationResponse()                                  (X.5, unmodified)
       ├─ runToolCallingStage(neverInvokeTool)                          (X.6, unmodified)
       └─ RuntimeSessionBuilder.persist()                               (X.11, unmodified)

POST /api/v1/reasoning/answer                                (X.9.1, unmodified — unaffected by X.12)
  └─ detectIntent() -> reasoningPipeline.answer() -> formatConversationResponse() ->
     runToolCallingStage()   (stateless — no session; kept exactly as-is, side by side)
```

`RuntimeContext` is constructed exactly once, inside `buildHttpServer()`, and passed by
reference to `registerConversationRoutes()` — never duplicated, never reconstructed per-request.

---

## Tests

- **Integration test**: `x12-conversation-http-integration.test.ts` (6 tests) — a real
  `Application` wired into a real Fastify instance via `buildHttpServer()`, exercised via
  Fastify's own `inject()` (the same pattern `http-server-integration.test.ts`, X.9.1, already
  uses). Proves: validation (400 on blank question), a first call reaches the complete chain and
  returns a real `sessionId`/`turnNumber`/`ToolAugmentedResponse`, a **second** HTTP call with
  the same `sessionId` resumes the session (`turnNumber` advances to 2) — proving the dependency
  graph is wired correctly end-to-end over real HTTP, not just in-process — an unknown
  `sessionId` gracefully starts a new session, and the pre-existing stateless
  `POST /api/v1/reasoning/answer` route still works unchanged, side by side with the new route.
- **Architecture guard**: `x12-http-entry-architecture.test.ts` (10 tests) — confirms
  `conversationRoutes.ts` imports only `runConversationTurn`/`RuntimeContext` (never the
  orchestrator's own internal dependencies, checked by exact import-statement match) and defines
  no reasoning/session/formatting logic of its own; confirms `httpServer.ts` retains every
  pre-existing route registration and marker plus exactly the new X.12 wiring (one
  `buildRuntimeContext(` call, one `registerConversationRoutes(` call — counted, not just
  presence-checked); confirms `buildHttpServer`'s exported signature is unchanged; confirms
  every `src/runtime/` file (X.11) and `reasoningRoutes.ts`/`coordinatorRoutes.ts` (X.9.1) are
  byte-for-byte unmodified; confirms every prior milestone's frozen-file marker is unchanged.

**Full suite result:** 531 test files, 14,679 tests passed, 3 skipped (X.10's
`TEST_DATABASE_URL`-gated tests, unaffected), 0 failures — up from 529 files / 14,663 tests at
the X.11 freeze baseline (+2 files, +16 tests, exactly the new X.12 test files). `tsc --noEmit`
clean.

---

## Verification

- `git status` confirms exactly 3 new files (`conversationRoutes.ts` + 2 test files) and 1
  modified file (`httpServer.ts`) — zero other file touched.
- `git diff` on `httpServer.ts` confirms the change is purely additive: 2 new import lines, 1
  new comment block, 2 new lines inside `buildHttpServer()` — every pre-existing line unchanged.

---

## Explicit Statement

**No new orchestration layer, no new RuntimeContext type, no new ConversationSession, and no
duplicate API routing were created.** `conversationRoutes.ts` is a pure request/response mapper
around the single, pre-existing `runConversationTurn()` entry point; `httpServer.ts` gained
exactly the two lines needed to construct and pass through one `RuntimeContext`. The pre-existing
stateless `/api/v1/reasoning/answer` route is untouched and continues to work exactly as before.

*Per this milestone's explicit closing instruction, work stops here. Phase X.12 is frozen. No
business-domain milestone begins automatically.*
