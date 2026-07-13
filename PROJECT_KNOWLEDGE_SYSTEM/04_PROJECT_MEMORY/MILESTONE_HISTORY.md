# Milestone History

**Purpose:** Every past milestone, archived here **before** [`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md)
is overwritten for the next one. See that file's archival rule.

**Related:** [Timeline](TIMELINE.md) · [Release Timeline](RELEASE_TIMELINE.md)

## Milestone Log (most recent first)

### Phase X.17 — Docker/Postgres Live Verification — declared 2026-07-13 (CURRENT — see `../02_AI_CONTEXT/CURRENT_MILESTONE.md`)

Not yet archived — this is the live milestone. When superseded, its full summary moves here,
above this note, before `CURRENT_MILESTONE.md` is overwritten.

---

### Phase X.16 — Credential Verification — declared 2026-07-13 (superseded by X.17)

**Evidence:** 553 test files, 14,873 tests (14,870 passed, 3 skipped — `TEST_DATABASE_URL`-gated,
unaffected), 0 failures, clean on the first run; architecture guard (35 files, 334 tests)
confirmed zero frozen-file modification beyond one documented, minimal governance exception
(GX-004).

**Summary:** Replaced `httpPrincipalResolver.ts`'s unverified `x-client-id` signal (X.15) with a
real, stdlib-only HMAC bearer-token mechanism — `X16_PROTOCOL_DECISION.md` evaluated bearer-token/
JWT/session-token/OIDC against ten dimensions each, chose stdlib-only HMAC (zero new runtime
dependency). Built `src/api/credentialToken.ts` (`signToken()`/`verifyToken()`, `node:crypto`
HMAC-SHA256, constant-time comparison, mandatory enforced expiry). Adding this file to `src/api/`
broke `x15-authorization-wiring-architecture.test.ts`'s own exhaustive file-count assertion —
resolved as GX-004, the same class of problem as GX-001/002/003 but a distinct trigger (X.16, not
X.15's own wiring). A second design fork (thread the signing secret through
`registerConversationRoutes()`'s parameters vs. have the resolver read it internally) was resolved
explicitly before implementation: Path B was chosen — `resolvePrincipalFromRequest()` keeps its
exact original one-parameter signature, reading `CREDENTIAL_SIGNING_SECRET` itself via
`loadAppConfigFromEnv()` — specifically to avoid a second, foreseeable break (GX-005) and touching
the frozen `buildApplication.ts`. Added `scripts/issueCredentialToken.ts` (a thin CLI, not a new
HTTP endpoint, avoiding a mint-any-identity hole) and a dedicated X.16 architecture guard (13
tests). Named, not glossed over: no server-side token revocation exists; single-secret/
single-issuer trust model; `routeAuthorization.ts` and recovery-producer wiring remain unwired,
unrelated to this milestone — FROZEN.

---

### Phase X.15 — Authorization & Recovery Wiring — declared 2026-07-13 (superseded by X.16)

**Evidence:** 549 test files, 14,832 tests (14,829 passed, 3 skipped — `TEST_DATABASE_URL`-gated,
unaffected), 0 failures across 2 consecutive confirming reruns after a first run's 2 failures were
traced to the pre-existing X.10/X.13 `execSync('npx prisma validate')` timing flake already
accepted at the X.14 freeze; architecture guard (34 files, 321 tests) confirmed zero frozen-file
modification beyond three documented, minimal governance exceptions.

**Summary:** Recovered from an interrupted prior session via full repository-state reconstruction
(no reliance on conversation memory) — the implementation plan and ADR already existed, Step 1
already committed, Steps 2–4 already written but uncommitted. Wired X.14's
`runAuthorizedConversationTurn()` into `conversationRoutes.ts`'s write path (`authorized: false` →
HTTP 403) via a new `x-client-id`-reading `httpPrincipalResolver.ts` (explicitly non-cryptographic,
not authentication); wired an `ISessionIdentityRepository` into `httpServer.ts`; wired X.13's
recovery **scan** (not producer) into `deployment/deploy.sh`. MID-IMPLEMENTATION GOVERNANCE
FINDING: the `conversationRoutes.ts`/`httpServer.ts` signature changes broke literal content
assertions in three already-frozen architecture guards spanning three prior milestones (X.12,
X.13, X.14) — one root cause (an authoring-style inconsistency between two guard lineages; zero
layering/dependency-boundary violation in any of them). Resolved via a formal, pre-approved
Governance Exceptions process: GX-001 (X.12 guard), GX-002 (X.13 guard), GX-003 (X.14 guard), each
a minimal literal correction or narrowing to the assertion's own already-stated intent, all three
formally recorded in `ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions section before any
guard file was touched. Deliberately NOT done: recovery-producer wiring (composing it with
authorization would require modifying a frozen file or duplicating security-sensitive logic, both
rejected) and real credential verification (`x-client-id` documented, explicitly, as unverified
and not a credential — carried forward as Phase X.16's own objective). New dedicated X.15
architecture guard + real-server (not throwaway) integration test suite — FROZEN.

---

### Phase X.14 — Authentication, Authorization & Identity Infrastructure — declared 2026-07-13 (superseded by X.15)

**Evidence:** 546 test files, 14,806 tests (14,803 passed, 3 skipped — X.10's
`TEST_DATABASE_URL`-gated tests, unaffected), 0 failures on the confirming rerun; architecture
guard confirmed zero `src/auth/` import and zero business-domain vocabulary in `src/identity/`.

**Summary:** Inspected `src/auth/` (Phase M1) in full before any code was written and found it to
be procurement business logic (`STANDARD_RESOURCES` includes PACKAGE/CONTRACT/PAYMENT/SUPPLIER,
`PermissionConditions.maxValue` is "for procurement guards", `ApprovalHierarchy`/`DelegationGrant`
tie to procurement approval and legal-basis requirements) rather than generic infrastructure --
reused the DESIGN (wildcard resource/action matching, OWN/ALL-equivalent scope hierarchy) without
importing the business-coupled CODE. Built `src/identity/` (10 files): `identityTypes.ts`
(Principal, Claims, Role, Permission, AuthorizationDecision), `permissionResolver.ts` (4
deterministic built-in roles -- ANONYMOUS/USER/SERVICE/SYSTEM, not a persisted admin-editable
system), `authorizationEvaluator.ts`, `authenticationContext.ts` (the 4 identity factory
functions), `runtimeAuthorization.ts` (wraps `runConversationTurn()`, X.11 frozen, with
authorization + session identity binding), `toolAuthorization.ts` (a `ToolDecider` higher-order
wrapper), `mcpAuthorization.ts` (a pure pre-check for `MCPClient.callTool()`), `routeAuthorization.ts`
(a standalone Fastify preHandler-hook builder, proven via a real Fastify instance, not the frozen
server), `sessionIdentityRepository.ts` + `prismaSessionIdentityRepository.ts` (`SessionIdentityBinding`
-- a parallel bookkeeping table alongside `ConversationSession`). One new, additive
`SessionIdentityBinding` Prisma model -- no Role/Permission table, since roles/permissions are
deterministic constants. DELIBERATE SCOPE BOUNDARIES named explicitly: not wired into production
traffic, no real credential verification, minimal default MCP permissions (SYSTEM only).
INVESTIGATION: 3 originally-reported failures (all `execSync('npx prisma validate')` migration
tests timing out under vitest's 5000ms default against real ~2.8s CLI spawns under 546-file
parallel contention) confirmed a load-timing flake via 3 consecutive reruns, matching the
identical X.9.5-freeze precedent -- fixed by extending only X.14's own migration test's timeout
to 15000ms.

---

### Phase X.13 — Conversation Persistence Recovery & Crash Resilience — declared 2026-07-10 (superseded by X.14)

**Evidence:** 537 test files, 14,726 tests passed, 3 skipped (X.10's TEST_DATABASE_URL-gated
tests, unaffected), 0 failures at freeze time; architecture guard confirmed zero frozen-file
modification, including main.ts and gracefulShutdown.ts.

**Summary:** No carve-out this milestone (the first since X.9.1 with none). Built conversation
crash-resilience infrastructure entirely under a new src/runtime/recovery/ subdirectory:
RecoveryMarker metadata + isUnfinished() detection, memory/Prisma IRecoveryRepository
(findPending() as the recovery queue itself), runRecoverableConversationTurn() (the producer,
wrapping runConversationTurn() with PENDING->COMPLETED/FAILED bookkeeping),
conversationRecoveryCoordinator.ts (recoverMarker() — pending-session restoration is
runConversationTurn()'s own existing resume-or-create logic invoked again; idempotent via a
re-check immediately before acting), runtimeRecoveryManager.ts (runStartupRecoveryScan()). One
new, additive ConversationRecoveryMarker Prisma model. scripts/recoveryScan.ts (CLI entrypoint).
TWO HONEST LIMITATIONS named explicitly: at-least-once (not exactly-once) replay across a crash
boundary, and idempotency verified only for the sequential-scan case, not concurrent scans.
DELIBERATE WIRING GAP: not invoked from main.ts's boot sequence or conversationRoutes.ts's write
path — left for a future, separately-authorized milestone.

---

### Phase X.12 — Conversation HTTP Entry Verification — declared 2026-07-10 (superseded by X.13)

**Evidence:** 531 test files, 14,679 tests passed, 3 skipped (X.10's TEST_DATABASE_URL-gated
tests, unaffected), 0 failures at freeze time; architecture guard confirmed zero frozen-file
modification and purely additive httpServer.ts wiring.

**Summary:** Verification-first milestone. Inspected src/api/**, src/server/**, src/bootstrap/**,
src/conversation/**, src/runtime/**, src/reasoning/** before assuming anything was missing.
Found reasoningRoutes.ts (X.9.1) reaches 4 of 5 required steps but is entirely stateless; a
repo-wide grep confirmed runConversationTurn()/RuntimeSessionBuilder/RuntimeContext were
referenced nowhere in the HTTP/bootstrap layers. Determination: NO complete HTTP entry existed.
Built the smallest compatible HTTP composition root: `src/api/conversationRoutes.ts` (new file,
`POST /api/v1/conversation/turn`, a pure request/response mapper importing ONLY
`runConversationTurn()`/`RuntimeContext`) plus two additive lines in `src/server/httpServer.ts`
(constructs one RuntimeContext, registers the new route — the same "wiring only" DI carve-out
X.9.2/X.9.3 already used). Zero duplication: no second orchestration layer, no redesign of
reasoningRoutes.ts/coordinatorRoutes.ts (both unmodified, still work side by side with the new
route). A real end-to-end HTTP integration test proved a second call with the same sessionId
resumes the session over real HTTP. `PHASE_X12_HTTP_ENTRY_REPORT.md` documents the full
dependency graph.

---

### Phase X.11 — Application Runtime — declared 2026-07-10 (superseded by X.12)

**Evidence:** 529 test files, 14,663 tests passed, 3 skipped (X.10's TEST_DATABASE_URL-gated
tests, unaffected), 0 failures at freeze time; architecture guard confirmed zero frozen-file
modification and additive-only X.1 extensions.

**Summary:** Built the runtime layer connecting the frozen AI Engine to real, persisted
application conversations. Reused rather than rebuilt: Phase X.1's SessionStateManager/
AdvisoryConversationMemory, the frozen X.9.1 Application composition, and the exact reasoning
chain reasoningRoutes.ts already calls. New: `prismaSessionRepository.ts` (Conversation
persistence), a new additive `ConversationSession` Prisma model, `src/runtime/`
(`ConversationSession` aggregate, `RuntimeSessionBuilder`, `RuntimeContext`/
`buildRuntimeContext`, session attachments, `runConversationTurn` conversation entry
orchestration). Two small additive extensions to Phase X.1
(`SessionStateManager.fromState()`/`.addAttachmentRef()`,
`AdvisoryConversationMemory.fromHistory()`) — authorized because X.1 was not in this milestone's
own frozen list (X.3–X.10 only). **HTTP wiring was deliberately left out of scope** — not among
the eight listed deliverables — which became X.12's own starting finding.

---

### Phase X.10 — Business Foundation: Prisma & Persistence — declared 2026-07-10 (superseded by X.11)

**Evidence:** 522 test files, 14,610 tests passed, 3 skipped (TEST_DATABASE_URL-gated, honestly
skipped — Docker/Postgres unavailable), 0 failures at freeze time; architecture guard confirmed
zero duplication of the pre-existing Phase M1 Prisma layer and zero frozen-file modification.

**Summary:** NOT a greenfield implementation, per an explicit mid-milestone user correction.
Inspection found a substantially complete, pre-existing "Phase M1 Production Prisma Layer"
(schema, client provider, repository interfaces/implementations, migration infrastructure)
already covering most of the milestone's original request — treated as canonical and reused
unmodified. Only four genuinely-missing pieces were built, each reusing existing infrastructure:
`src/persistence/prismaTransaction.ts` (`withTransaction()` — thin pass-through to
`getPrismaClient().$transaction()`), `src/persistence/databaseConnectivity.ts`
(`verifyDatabaseConnection()`/`waitForDatabaseReady()` — reuses the existing `RetryPolicy`),
`src/persistence/testDatabaseBootstrap.ts` (`TEST_DATABASE_URL`-based test client, deliberately
separate from the `getPrismaClient()` singleton), `prisma/seed.ts` (a real, empty seed
entrypoint, per CLAUDE.md's Demo Data Principles), plus one additive line in `prisma.config.ts`
registering the seed script — the only pre-existing file touched. Produced
`PHASE_X10_PRISMA_FOUNDATION_REPORT.md`, itemizing what already existed vs. what was genuinely
missing and why each new file was necessary.

---

### Phase X.9.5 — Production Hardening: Deployment/Operations/Production Readiness — declared 2026-07-07 (superseded by X.10)

**Evidence:** 519 test files, 14,587 tests, 0 failures at freeze time; architecture guard
confirmed ZERO frozen-file modification — the strictest freeze-compliance record of any X.9.x
milestone.

**Summary:** Implemented `waitForReady.ts` (polls a URL until ready, genuinely reuses
`RetryPolicy`), `smokeChecks.ts` (6 black-box HTTP checks against a real deployment — `/live`,
`/ready`, `/health`, the three reasoning/coordinator/streaming endpoints — imports nothing from
`src/` at all), `scripts/waitForReady.ts` + `scripts/smokeTest.ts` (CLI wrappers),
`deployment/deploy.sh` + `deployment/rollback.sh` (validate -> build/deploy -> wait-for-ready ->
smoke-test; stateless server means rollback is just "redeploy a previous ref"),
`docs/RUNBOOK.md`, `docs/DISASTER_RECOVERY.md` (makes the server's statelessness explicit —
RPO/RTO reduce to redeploy time), `docs/RELEASE_CHECKLIST.md`, and `docs/PRODUCTION_READINESS.md`
— the final Phase X.9 capstone, explicitly requested: Architecture readiness 8.5 -> 9/10,
Production readiness 3 -> 7/10, every one of `PRODUCTION_HARDENING_AUDIT.md`'s 20 original
findings re-assessed as resolved/clarified/still-open, with authentication/authorization named
explicitly as the single most consequential remaining gap, not softened. SELF-CAUGHT FIX: the
architecture guard's own first run caught that `rollback.sh` was missing the same fail-fast
environment validation `deploy.sh` already had — fixed for real consistency, not just to pass
the test. Docker still unavailable in this environment; what WAS verified for real: both new CLI
scripts run live against a real server (all 6 smoke checks PASS; the negative case correctly
reports failure with exit code 1). This closed out Phase X.9 (Production Hardening, Batches A-E)
in full.

---

### Phase X.9.4 — Production Hardening: Docker/Production Configuration/Secrets — declared 2026-07-07 (superseded by X.9.5)

**Evidence:** 515 test files, 14,560 tests, 0 failures at freeze time; architecture guard
confirmed ZERO frozen-file modification — not even under the DI carve-out X.9.2/X.9.3 used.

**Summary:** Implemented a multi-stage `Dockerfile` (deps -> runtime, runs the server via `tsx`,
non-root user, real `HEALTHCHECK`), extended `docker-compose.yml` additively with opt-in
`app`/`app-dev` Compose-profile services (Phase M0 default behavior unchanged), `configProfiles.ts`
(env-var overlay, not a second parser), `environmentValidator.ts` (genuinely delegates to the
real `loadAppConfigFromEnv()`), `loadEnvironmentSecrets.ts` (reuses the already-installed,
previously-unused `dotenv`), `configDiagnostics.ts`, and `scripts/validateEnvironment.ts`/
`start-prod.sh`/`start-dev.sh`. USER-DIRECTED MID-MILESTONE CORRECTION: repository inspection
found an existing `docker-compose.yml` and `scripts/` convention; reused and extended rather than
introducing a second compose-file set. Docker itself unavailable in this environment — what WAS
verified for real: YAML syntax, and `scripts/start-prod.sh` executed end-to-end (validated
environment, started the real server, answered a real HTTP request) — found and fixed a real bug
(`dotenv`'s own stdout banner, fixed via its documented `quiet:true` option).

---

### Phase X.9.3 — Production Hardening: Streaming/SSE/HTTP Cancellation — declared 2026-07-07 (superseded by X.9.4)

**Evidence:** 510 test files, 14,528 tests, 0 failures at freeze time; architecture guard
confirmed the pure streaming/cancellation files import nothing beyond Node builtins, and that
every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `sseTypes.ts`/`sseWriter.ts` (backpressure-safe SSE framing),
`streamRace.ts` (the HTTP-layer cancellation/timeout boundary), `requestAbortSignal.ts`
(client-disconnect detection), and `reasoningStreamRoute.ts`
(`POST /api/v1/reasoning/answer/stream` — streams a single reasoning answer's lifecycle over SSE
via the exact same real, frozen chain X.9.1's `reasoningRoutes.ts` already calls). DI-only
additions to `appConfig.ts`/`buildApplication.ts`/`httpServer.ts` (+`streamTimeoutMs`, +route
registration). TOOLING FINDING (verified by direct reproduction): Fastify's `inject()` does not
support `reply.hijack()` + raw-response streaming — every SSE test binds a real listening socket
instead. A real smoke test (actual process, actual socket, `curl -N`) confirmed genuine
incremental SSE delivery.

---

### Phase X.9.2 — Production Hardening: Logging/Metrics/Tracing/Error Middleware — declared 2026-07-07 (superseded by X.9.3)

**Evidence:** 505 test files, 14,492 tests, 0 failures at freeze time; architecture guard
confirmed no new logging/metrics/tracing/middleware file imports `src/reasoning/`/`src/knowledge/`/
`src/mcp/`/`src/multiagent/` at all, and that every prior milestone's frozen-file marker was
unchanged.

**Summary:** Implemented `structuredLogger.ts` (level-filtered JSON/pretty stdout lines,
`.child()` context — NOT built on the frozen, unused `src/providers/Logger.ts`, which has no
output sink at all), `requestContext.ts` (request/correlation ID resolution), `tracingTypes.ts` +
`tracer.ts` (an OpenTelemetry-shaped, vendor-free `Tracer`/`Span` abstraction plus W3C
`traceparent` propagation — zero `@opentelemetry` dependency), `requestMetrics.ts` (genuinely
reuses the existing `MetricsCollector`), `errorMapper.ts` (HTTP exception mapping, production
5xx redaction), and `requestLifecycleHooks.ts` (the one Fastify wiring point for
timing/correlation/trace/logging/metrics/error-handling). DI-only additions to
`appConfig.ts`/`buildApplication.ts`/`httpServer.ts`, verified to leave every X.9.1 core line
untouched. A real smoke test (actual process, actual socket, curl with a real
`x-correlation-id` header) confirmed structured logs/correlation echo/traceparent generation
all work outside the test harness.

---

### Phase X.9.1 — Production Hardening: HTTP Server & Bootstrap — declared 2026-07-07 (superseded by X.9.2)

**Evidence:** 498 test files, 14,444 tests, 0 failures at freeze time; architecture guard
confirmed config/health/server/startup never import `src/reasoning/`/`src/knowledge/`/`src/mcp/`/
`src/multiagent/` directly, that `buildApplication.ts` is the only composition point, and that
every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `appConfig.ts` (`loadAppConfigFromEnv()`), `buildApplication.ts` (the
composition root — constructs a real memory-backed `IKnowledgePlatform` + `LegalProvider`,
`ReasoningEnginePipeline`, `ToolRegistry`/`ToolExecutor`, `CoordinatorAgent`), `healthCheck.ts`
(`checkLiveness()`/`checkReadiness()`/`checkHealth()`), `reasoningRoutes.ts` + `coordinatorRoutes.ts`
(`POST /api/v1/reasoning/answer` and `/reasoning/batch` — thin adapters over the real X.4-X.8
chain, mirroring the pre-existing `src/interface/restAdapter.ts` Fastify pattern),
`httpServer.ts` (`buildHttpServer()` — `/live`/`/ready`/`/health` + API routes, no `.listen()`
inside it), `main.ts` (the one file calling `.listen()`), `gracefulShutdown.ts` (SIGTERM/SIGINT).
A real smoke test (`npm run server`, curl over an actual socket) caught and fixed a genuine bug:
the initial entrypoint guard silently failed under `tsx` on this platform, so the server never
started; replaced with `pathToFileURL(process.argv[1]).href` and re-verified live.

---

### Phase X.8 — Multi-Agent Orchestration — declared 2026-07-07 (superseded by X.9.1)

**Evidence:** 493 test files, 14,406 tests, 0 failures at freeze time; architecture guard
confirmed `multiAgentTypes.ts`/`taskScheduler.ts`/`coordinatorAgent.ts` never import
`src/reasoning/`/`src/knowledge/`/`src/mcp/`/`src/ai/`/`src/conversation/` at all, and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `multiAgentTypes.ts` (`WorkerTask`, `WorkerOutcome`, `CoordinationRun` —
reused `RetryOptions`), `taskScheduler.ts` (`validateTasks()`, `buildWaves()` — deterministic
Kahn's-BFS wave grouping), `coordinatorAgent.ts` (`CoordinatorAgent.run()` — parallel scheduling,
dependency tracking, fail-fast, timeout, `AbortSignal` cancellation; reused `RetryPolicy`
directly), and `reasoningWorkerAdapter.ts` (`buildReasoningWorkerTask()` — the single composition
point wrapping the real, frozen `ReasoningEnginePipeline.answer()` -> `formatConversationResponse()`
-> `runToolCallingStage()` chain into one `WorkerTask`). Found by direct inspection that the
pre-existing `src/providers/MultiAgentCoordinator.ts` requires an LLM call via
`AgentRuntime.run(prompt)` — literal independent reasoning per agent, exactly what this
milestone's own rule forbids — so new, deterministic, LLM-free scheduling code was written
instead, consistent with `REJECTED_DESIGNS.md`'s own prior "Rejected: Multi-LLM-Agent
Conversations" decision. A true end-to-end integration test dispatched real reasoning-engine
workers in parallel through the complete `ReasoningEnginePipeline`/`OutputFormatter`/Tool Calling
stack.

---

### Phase X.7 — MCP Integration — declared 2026-07-07 (superseded by X.8)

**Evidence:** 489 test files, 14,366 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/conversation/` import, that
`mcpTypes.ts`/`mcpClient.ts`/`httpMCPTransport.ts` never import `src/reasoning/` at all, and
that every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `mcpTypes.ts` (`MCPToolDescriptor`, `MCPRequest`, `MCPResponse<T>`,
`MCPClientError(Code)`, `MCPClientResult<T>`, `MCPTransport` — reused `ToolParameter` for
`inputSchema` as-is), `httpMCPTransport.ts` (`HttpMCPTransport` — reused `RestClient.post()` for
the network call), `mcpClient.ts` (`MCPClient` — connection lifecycle, capability discovery,
tool execution; reused `RetryPolicy`'s constructor + `.sleep()` with its own MCP-transport-
specific retryable-code set), and `mcpToolAdapter.ts` (`registerMCPTools()` — the single
composition point: discovers remote tools and registers each as an ordinary `ToolDefinition`
into the SAME, already-frozen `ToolRegistry` that local tools use, so `ToolExecutor`/
`ToolCallingStage` needed zero MCP-awareness and zero changes). Found by direct inspection that
`PHASE_X_EXECUTION_PLAN.md`'s own pre-planned `MCPToolRegistry`/`MCPGateway` design, drafted
before Phase X.6 existed, would have duplicated Tool Calling/`ToolRegistry` — not built; the
`src/mcp/` directory reservation was honored, the internal design was not. A true end-to-end
integration test proved discovery + invocation through a fake-but-protocol-faithful in-memory MCP
server, a real `ToolRegistry`/`ToolExecutor`, the complete `ReasoningEnginePipeline`, and the real
Output Formatter.

---

### Phase X.6 — Tool Calling — declared 2026-07-07 (superseded by X.7)

**Evidence:** 485 test files, 14,333 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/mcp/`/`src/conversation/`/`src/ai/` import, that the only
`src/providers/` imports were `ToolExecutor.ts`/`ToolRegistry.ts`/`RetryPolicy.ts`, and that
every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `toolCallingTypes.ts` (`ToolInvocationDecision`, `ToolDecider`,
`NormalizedToolResult`, `ToolAugmentedResponse` — reused `ToolCall` from the pre-existing
`src/providers/ToolRegistry.ts` as-is) and `toolCallingStage.ts` (`runToolCallingStage()`,
`neverInvokeTool` — reused `src/providers/ToolExecutor.ts`'s `ToolExecutor.execute()`
[constructor-injected] and `src/providers/RetryPolicy.ts`'s constructor + `.sleep()` timing
directly, with a new tool-execution-specific retryable-error-code set since `RetryPolicy`'s own
`isTransient()`/`isNonRetryable()` classify a different, LLM-provider vocabulary). Found by
direct inspection that `src/providers/ToolCallingAgent.ts`/`AgentRuntime.ts` are NOT reusable —
both require an actual LLM call via `ProviderManager.chat()`, out of scope. Parity tests proved
genuine delegation to `ToolExecutor.execute()`/`RetryPolicy.sleep()` rather than
reimplementation. A true end-to-end integration test proved a real `ToolRegistry`/`ToolExecutor`
with an actual registered tool, invoked through the complete chain — real intent detector, real
`IKnowledgePlatform`, complete `ReasoningEnginePipeline`, real Output Formatter.

---

### Phase X.5 — Output Formatting — declared 2026-07-07 (superseded by X.6)

**Evidence:** 481 test files, 14,303 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/mcp/`/`src/conversation/`/`src/ai/` import (critically
including `src/ai/validation/`, the existing but unrelated formatter) and that every prior
milestone's frozen-file marker was unchanged.

**Summary:** Implemented `conversationResponseTypes.ts` (`ConversationResponse`,
`ResponseSection`, `FormattingOptions` — reused `ConfidenceLabel`) and `outputFormatter.ts`
(`formatConversationResponse()` — a pure presentation function consuming X.4.7's
`ReasoningAnswerResult`; reused `answerComposer.ts`'s `buildExplanation()`/
`determineHumanReview()` directly, both never called by the native pipeline before now). Found
by direct inspection that "the existing Output Formatter"
(`src/ai/validation/responseFormatter.ts`'s `formatFinalAnswer()`) is unrelated — it operates on
the OLD `LLMOutput`/`AIValidationResult`/`AIContext` LLM-text-validation path, not reusable for
`ReasoningAnswerResult`. Parity tests proved the decision section body is byte-for-byte
`buildExplanation().summary` and warnings are exactly `determineHumanReview()`'s reason string
split for display. A true end-to-end integration test proved the complete chain — real intent
detector, real memory-backed `IKnowledgePlatform` + `LegalProvider`, complete
`ReasoningEnginePipeline`, `formatConversationResponse()` — for an uncontested question, a real
hierarchy conflict, and an empty platform; deterministic replay confirmed.

---

### Phase X.4 — Reasoning Engine Wiring: COMPLETE (Final Integration) — declared 2026-07-06 (superseded by X.5)

**Evidence:** 477 test files, 14,272 tests, 0 failures at freeze time; full X.4-track diff-scope
check from the pre-X.4 baseline (commit `4bcbf47`): 41 files added, 4,635 insertions, zero
existing lines modified.

**Summary:** Phase X.4 (X.4.1 through X.4.7 plus the Final Integration) built a complete,
native, deterministic Reasoning Engine — `ReasoningEnginePipeline` (the one public entry point)
wires X.3.7's `FinalKnowledgeResolutionPipeline` through X.4.2's `assembleReasoningContext()`,
X.4.3's `evaluateRules()`, X.4.4's `resolveConflicts()`, X.4.5's `evaluateConfidence()`, X.4.6's
`generateCitations()`, and X.4.7's `composeAnswer()` — proven end-to-end against a real
Knowledge Platform, with deterministic replay verified. `ReasoningOrchestrator` (X.4.1,
Batch-A-backed) and `ReasoningEnginePipeline` (native, X.4.2-X.4.7-backed) coexist as two
separate, valid entry points. Three carried-forward open questions remain: the
missingEvidence-reconciliation question, the superseded-item/decision gaps (both requiring
`RuleEvaluationResult` as a stated input to close), and the still-open `ResolvedKnowledge`
extension decision for checklists/cases/bestpractice/risk.

---

### Phase X.4.7 — Reasoning Engine Wiring: Reasoning Answer Composition — declared 2026-07-06 (superseded by the Final X.4 Integration)

**Evidence:** 475 test files, 14,257 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningAnswerTypes.ts` (`ReasoningAnswerResult` — reused
`ConfidenceComponents`/`DetectedConflict`/`FormattedCitation`) and `reasoningAnswerStage.ts`
(`composeAnswer()` — reused `answerComposer.ts`'s own exported `composeDecision()` directly;
grouped X.4.6's citations into `primaryCitations`/`supportingCitations`/`disputedCitations`
sections; passed X.4.5's confidence and X.4.4's conflicts through unchanged). Documented,
intentional gap: `decision` always `null` since `RuleEvaluationResult` was not one of this
milestone's stated inputs — confirmed by a dedicated parity test proving the real engine
produces a real decision once genuine rule results exist.

---

### Phase X.4.6 — Reasoning Engine Wiring: Reasoning Citation Generation — declared 2026-07-06 (superseded by X.4.7)

**Evidence:** 471 test files, 14,229 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `citationGenerationTypes.ts` (`CitationGenerationResult` — reused
`FormattedCitation`) and `citationGenerationStage.ts` (`generateCitations()` — reused
`citationFormatter.ts`'s own exported `formatCitations()` directly; independently derived its
required `AppliedArticle[]` input from X.4.5's `supportingEvidence`/`rejectedEvidence` and
X.4.4's `conflicts`). Documented, intentional divergence for superseded items since that
milestone's input list had no temporal-validity signal. Parity tests proved identical citation
sets to the real frozen engine across 4 scenarios.

---

### Phase X.4.5 — Reasoning Engine Wiring: Reasoning Confidence Scoring — declared 2026-07-06 (superseded by X.4.6)

**Evidence:** 467 test files, 14,201 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `confidenceEvaluationTypes.ts` (`EvidenceWeightSummary`,
`ConfidenceEvaluationResult` — reused `ConfidenceComponents`) and `confidenceEvaluationStage.ts`
(`evaluateConfidence()` — reused `answerComposer.ts`'s exported `computeConfidence()` directly;
independently derived its required `appliedDocuments`/`primaryItemConfidences` input via
role-assignment bookkeeping mirroring `legalReasoningEngine.ts`'s own private algorithm). Parity
tests proved identical confidence scores to the real frozen engine across 5 scenarios, all
passing on first run.

---

### Phase X.4.4 — Reasoning Engine Wiring: Reasoning Conflict Resolution — declared 2026-07-06 (superseded by X.4.5)

**Evidence:** 463 test files, 14,173 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `conflictResolutionTypes.ts` (`RejectedCandidateEntry`,
`ConflictResolutionResult` — reused `DetectedConflict`/`ConflictingItem`/`ConflictResolution`)
and `conflictResolutionStage.ts` (`resolveConflicts()` — a from-scratch, byte-for-byte-verified
re-expression of `legalReasoningEngine.ts`'s private, non-exported 4-tier cascade, since no
public component existed to reuse for it; reused X.4.3's applicability determination and X.3.4's
`legalHierarchyScore()` directly for the two pieces that were public). Parity tests proved
identical outcomes to the real frozen cascade across all four tiers.

---

### Phase X.4.3 — Reasoning Engine Wiring: Reasoning Rule Evaluation — declared 2026-07-06 (superseded by X.4.4)

**Evidence:** 459 test files, 14,144 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `ruleEvaluationTypes.ts` (`KnowledgeItemEvaluation`,
`RuleEvaluationResult` — reused `EffectivePeriodStatus`/`ApplicabilityStatus`/`LegalRuleResult`/
`LegalThresholdResult`) and `ruleEvaluationStage.ts` (`evaluateRules()` — reused `ruleEngine.ts`'s
`evaluateRule()`/`evaluateThreshold()`, `effectivePeriodEvaluator.ts`'s
`evaluateEffectivePeriod()`, `knowledgeApplicabilityEvaluator.ts`'s `evaluateApplicability()`,
and `rankingStrategy.ts`'s `legalHierarchyScore()`, all already-exported from earlier frozen
milestones — zero reimplemented business logic). Stands alone, not yet wired into
`ReasoningOrchestrator`/`LegalReasoningEngine`.

---

### Phase X.4.2 — Reasoning Engine Wiring: Reasoning Context Assembly — declared 2026-07-06 (superseded by X.4.3)

**Evidence:** 456 test files, 14,120 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningExecutionContextTypes.ts` (`ReasoningExecutionContext` —
renamed from the requested "ReasoningContext" to avoid shadowing the existing frozen type) and
`reasoningContextAssembler.ts` (`assembleReasoningContext()` — stable deduplication + deep
freeze, zero reasoning/conflict/confidence/citation/answer-generation logic). Stands alone, not
yet wired into `ReasoningOrchestrator`/`LegalReasoningEngine`. A real-platform end-to-end
integration test proved genuine freeze against real platform data.

---

### Phase X.4.1 — Reasoning Engine Wiring: Batch A (Reasoning Orchestrator) — declared 2026-07-06 (superseded by X.4.2)

**Evidence:** 453 test files, 14,096 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningOrchestrator.ts` (`ReasoningOrchestrator`,
`buildReasoningOrchestrator()`) — coordinates X.3.7's `FinalKnowledgeResolutionPipeline` and
Batch A's `LegalReasoningEngine` (post pre-X.4-cleanup) into `ReasoningIntent` → Knowledge
Resolution → `ReasoningResult`. Zero business logic of its own. A real-platform end-to-end
integration test proved the first full chain from a raw question to `ReasoningResult` against a
real `IKnowledgePlatform`, not fakes at any layer.

---

### Pre-X.3.8 API Cleanup — LegalReasoningEngine.reason() accepts ReasoningIntent — declared 2026-07-06 (superseded by Phase X.4.1)

**Evidence:** 450 test files, 14,079 tests, 0 failures at freeze time — identical count to the
X.3.7 baseline, since this was a pure signature/wiring refactor with no new tests.

**Summary:** `ILegalReasoningEngine.reason()`'s first parameter changed from `ReasoningQuestion`
to the existing `ReasoningIntent` type (reused, no new `ResolvedIntent`/DTO), removing the
internal `detectIntent(question)` call from `LegalReasoningEngine`. Grepped first: `reason()` had
exactly one caller anywhere in the repo (its own test file, 7 mechanically-updated call sites,
zero assertion changes) — confirmed the cheapest possible moment to make this change. One
incidental fix: `question.outputFormat` had no `ReasoningIntent` equivalent, so `reason()` now
always composes the default DECISION-format explanation (`explain(result, format)` remains the
supported way to get a different format).

---

### Phase X.3.7 — Knowledge Resolution: Final Wiring — declared 2026-07-06 (superseded by the Pre-X.3.8 API Cleanup)

**Evidence:** 450 test files, 14,079 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, that the final pipeline's only cross-milestone
dependencies are `knowledgeResolutionPipeline.ts`/`knowledgeEnrichmentPipeline.ts`, and that
every prior milestone's frozen-file markers (X.3.1 through X.3.6) were unchanged.

**Summary:** Implemented `finalKnowledgeResolutionPipeline.ts`
(`FinalKnowledgeResolutionPipeline`, `buildFinalKnowledgeResolutionPipeline()`) — composed X.3.5's
`KnowledgeResolutionPipeline` (already Intent Resolution → Retrieval → Ranking) piped into X.3.6's
`enrichKnowledge()`, with zero adapter code. Declared Phase X.3 (Knowledge Resolution) complete as
a standalone, deterministic pipeline. Followed by `PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md` (no
redesign recommended, 8.1/10 average across 18 categories, six findings F-1–F-6 logged for
awareness), `PHASE_X4_IMPLEMENTATION_PLAN_FINAL.md` (planned the still-unbuilt reasoning-engine
wiring, recommending it be tracked as Phase X.3.8, not X.4 — X.4 already means Output Validation),
and `PHASE_X4_API_REVIEW.md` (found `legalReasoningEngine.reason()`'s internal `detectIntent()`
call would force any future orchestrator to detect intent twice — cheap to fix now since
`reason()` had exactly one caller anywhere in the repo, its own test file; recommended the small,
compatible redesign this cleanup implements).

---

### Phase X.3.6 — Knowledge Resolution: Remaining Gaps (Deterministic Enrichment) — declared 2026-07-06 (superseded by X.3.7)

**Evidence:** 448 test files, 14,067 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, zero reference to any X.3.2–X.3.5 module, zero MCP/
provider/LLM/PromptBuilder/validation/citation/conflict-resolution reference, and that every
prior milestone's frozen-file markers (X.3.1 through X.3.5) were unchanged.

**Summary:** Implemented `knowledgeEnrichmentTypes.ts` (additive diagnostic shapes),
`resolutionMetadataNormalizer.ts` (`readMetadataString()`), `effectivePeriodEvaluator.ts`
(independent CURRENT/NOT_YET_EFFECTIVE/EXPIRED classification), `ruleMetadataParser.ts` +
`thresholdMetadataParser.ts` (ADR-022 Decision 5 — JSON metadata parsing into
`RuleKnowledgeItemRef`/`ThresholdKnowledgeItemRef`, critical `MissingEvidence` on failure, never
throws), `knowledgeApplicabilityEvaluator.ts` (final per-item verdict), `resolutionDiagnostics.ts`
(aggregation), and `knowledgeEnrichmentPipeline.ts` (`enrichKnowledge()` — the pure composition
function, standalone from X.3.5). Populated `ruleItems`/`thresholdItems`, always empty since
X.3.3. Zero modification to X.3.1–X.3.5.

---

### Phase X.3.5 — Knowledge Resolution: Orchestration Wiring — declared 2026-07-06 (superseded by X.3.6)

**Evidence:** 440 test files, 14,026 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, zero MCP/provider/LLM/PromptBuilder reference, and that
every prior milestone's frozen-file markers (X.3.1 through X.3.4) were unchanged.

**Summary:** Implemented `resolutionOrchestrationTypes.ts` (`RankedKnowledge` alias,
`ResolutionExecutor<TInput,TOutput>`), `resolutionExecutor.ts` (thin adapters wrapping
`IntentResolutionPipeline.resolve()`/`KnowledgeRankingPipeline.rank()`), `ResolutionCoordinator`
(sequences intent-retrieval then ranking, no branching), and `KnowledgeResolutionPipeline` (the
public composition root, composing X.3.3/X.3.4 via their existing `build*()` factories only).
Proved the full Intent Resolution → Retrieval → Ranking → `RankedKnowledge` chain against a fake
repository, including that ranking genuinely re-orders/trims results rather than passing
retrieval through unchanged. Zero modification to X.3.1–X.3.4.

---

### Phase X.3.4 — Knowledge Resolution: Knowledge Ranking & Selection — declared 2026-07-06 (superseded by X.3.5)

**Evidence:** 436 test files, 14,011 tests, 0 failures at freeze time; architecture guard (6
tests) confirmed zero import of the X.3.2/X.3.3 modules and zero citation/conflict/evidence-
formatting/answer/LLM/validation logic.

**Summary:** Implemented `rankingStrategy.ts` (5 independent per-item scoring criteria:
domain priority, legal hierarchy, relevance-as-confidence, freshness decay, document
authority-by-layer), `candidateSelector.ts` (`rankItems()`/`selectCandidates()` — deterministic
sort with itemId tie-break, generic over `KnowledgeItemRef` subtypes to avoid unsafe casts),
`rankingPlanner.ts` (data-driven per-intent weights, `AUTHORITY_CHECK` overridden), and
`KnowledgeRankingPipeline` (depends only on `rankingPlanner.ts`/`candidateSelector.ts`/
`reasoningTypes.ts` — never X.3.2/X.3.3/`src/knowledge/`). Proved ranking never resolves
conflicts (contradictory items are both kept, ordered by score, never merged/removed) and
genuine dependency injection of a custom planner.

---

### Phase X.3.3 — Knowledge Resolution: Intent-Driven Orchestration — declared 2026-07-06 (superseded by X.3.4)

**Evidence:** 431 test files, 13,971 tests, 0 failures at freeze time; architecture guard (6
tests) confirmed the interface-only dependency and zero ranking/scoring/confidence/citation/
conflict logic.

**Summary:** Implemented `knowledgeResolutionPlanner.ts` (`planKnowledgeResolution()` — data-
driven domain selection per intent), `resolveKnowledgeWarnings.ts` (`buildEffectivePeriodWarnings()`
— corrected mid-implementation to produce plain strings, matching `ResolvedKnowledge.warnings`'s
actual `readonly string[]` type, not the richer `ReasoningWarning` object initially assumed), and
`intentResolutionPipeline.ts` (`IntentResolutionPipeline`, depending only on
`IKnowledgeRepository`, never the concrete adapter). Found and documented that `checklists`/
`cases`/`bestpractice`/`risk` domains have no destination field on the frozen `ResolvedKnowledge`
— the planner intentionally only requests `legal`/`procurement`/`school`.

---

### Phase X.3.2 — Knowledge Resolution: Retrieval & Wiring — declared 2026-07-05 (superseded by X.3.3)

**Evidence:** 427 test files, 13,943 tests, 0 failures at freeze time; architecture guard (7
tests) confirmed the interface/adapter import boundary and zero MCP/provider/Anthropic/
PromptBuilder references.

**Summary:** Implemented `IKnowledgeRepository` (pure interface) and `KnowledgePlatformRepository`
(the sole file permitted to import `IKnowledgePlatform`, via constructor dependency injection).
Proven against a real memory-backed `IKnowledgePlatform` + `LegalProvider` (Phase N's own
integration-test pattern), not just fixtures — confirming real `KnowledgeItem`/`LegalBasis`
objects satisfy X.3.1's `KnowledgeReference` shapes with zero cast needed.

---

### Phase X.3.1 — Knowledge Resolution: Pure Mapping — declared 2026-07-05 (superseded by X.3.2)

**Evidence:** 425 test files, 13,928 tests, 0 failures at freeze time; architecture guard (4
tests) confirmed zero imports from Knowledge Platform/MCP/financial/conversation/providers.

**Summary:** Implemented `KnowledgeReference`/`KnowledgeReferenceLegalBasis`/
`KnowledgeReferenceEffectivePeriod` (a structural mirror of the real `KnowledgeItem`/
`LegalBasis`, defined independently) and `toLegalBasisRef()`/`toKnowledgeItemRef()` (ADR-022
Decisions 3-4) — pure mapping, zero repository queries. Confirmed in X.3.2 that the structural-
typing bet paid off: real `KnowledgeItem`/`LegalBasis` objects satisfy these shapes with zero
cast needed.

---

### Phase X.4 — Output Validation — declared 2026-07-05 (superseded by Phase X.3.1)

**Evidence:** 423 test files, 13,913 tests, 0 failures at freeze time; 100% adversarial-fixture
catch rate (hallucinated citation, numeric drift, decision contradiction, truncated response,
forbidden pattern, malformed output), zero exceptions.

**Summary:** Implemented `CitationValidator`, `ConfidenceValidator`, `LegalConsistencyValidator`,
`OutputValidator` (orchestrator + structural checks), `ResponseFormatter`, `ValidationPipeline`.
Requested as "Phase X.3" but numbered X.4 per `PHASE_X_EXECUTION_PLAN.md`'s consistent numbering
(X.3 is Knowledge Resolution, blocked at the time on ADR ratification) — reconciled
transparently in `CURRENT_MILESTONE.md`, not treated as a blocker. Two real bugs found and
fixed: JS's ASCII-only `\W` shredding Vietnamese diacritic words in keyword extraction, and
`NUMERIC_INCONSISTENCY` (HIGH severity) never triggering any human-review flag at all. Tagged
`phase-x.4-output-validation`. Followed by: `PHASE_X3_READINESS_REVIEW.md` (NO-GO, sole blocker
ADR-DRAFT-X01 unratified) → `ADR-X01_FINAL.md` (critical re-review, closed 3 new gaps, GO) →
ratified 2026-07-05 as ADR-022 → `PHASE_X3_ARCHITECTURE_REVIEW.md` (clarified that ADR-022's
"never PRIMARY_BASIS" guarantee for `searchKnowledge()`-sourced items holds by construction,
zero touches to frozen `legalReasoningEngine.ts` needed) → Phase X.3.1 authorized.

---

### Phase X.2 Batch B — AIContext/Prompt/LLM Adapter path — declared 2026-07-05 (superseded by Phase X.4)

**Evidence:** 416 test files, 13,855 tests, 0 failures at freeze time; architecture guard suite
(12 tests) confirmed dependency direction, no provider leakage, and isolation from the
pre-existing 32 flat `src/ai/*.ts` files.

**Summary:** Implemented `AIContext` (deep-frozen, per `AI_CONTEXT_SCHEMA.md`), `AIContextBuilder`,
`PromptBuilder` (presentation only), `PromptRenderer` (deterministic, provider-agnostic),
`ModelCapabilityRegistry`, `ModelSelector` (provider-independent), and `ClaudeLLMAdapter`
(wraps the existing `src/providers/ClaudeProvider.ts`). An architecture gate review performed
before implementation returned GO with 5 non-blocking recommendations; Finding A
(`AIContextBuilder` must not call a repository directly, per Constraint C-05) was applied
directly in the code. Tagged `phase-x.2-batch-b-ai-context-prompt`.

---

### Phase X.2 Batch A — Reasoning Pipeline Core — declared 2026-07-05 (superseded by Batch B)

**Evidence:** 409 test files, 13,809 tests, 0 failures at freeze time; architecture guard test
confirmed no import from `src/knowledge/`, `src/ai/`, `src/mcp/` and no modification of the
pre-existing, unrelated `src/reasoning/{reasoningEngine,decisionModel}.ts` (Phase 15 track).

**Summary:** Implemented the deterministic reasoning pipeline — intent detection, applicable
law/hierarchy/4-tier conflict resolution/supersession (Stage 3, folded into
`legalReasoningEngine.ts`), rule/threshold evaluation and exception detection (Stage 4), evidence
collection (Stage 5), citation formatting (Stage 6), confidence scoring/human-review
determination/decision composition (Stage 7) — all provable against `mockKnowledgeFixtures.ts`
with zero LLM calls, zero network calls. `Legal`-prefixed only where a real collision was found
(`LegalReasoningStep`, `LegalRuleResult`, `LegalThresholdResult`, `LegalPipelineStage`) per the
grep-first, not defensive, naming rule. An architecture gate review (before Batch B) returned GO
with five non-blocking recommendations, one of which (Finding A: AIContextBuilder must not call
`ISessionRepository` itself) was applied directly in Batch B's `aiContextBuilder.ts`. Tagged
`phase-x.2-batch-a-reasoning-core`.

---

### Phase X.1 — Conversation Core — declared 2026-07-05 (superseded by Phase X.2 Batch A)

**Evidence:** 401 test files, 13,760 tests, 0 failures at freeze time; architecture guard test
confirmed no import from `src/knowledge/`, `src/reasoning/`, `src/ai/`, `src/mcp/`.

**Summary:** Implemented session-scoped conversation state — `AdvisoryConversationContext`,
`AdvisorySessionState` (`CREATED`→`ACTIVE`→`IDLE`→`ARCHIVED`), `AdvisoryConversationHistory`,
`AdvisoryConversationMemory` (token-budget pruning, 2-most-recent-turn floor), and
`MemorySessionRepository` implementing the frozen `IBaseRepository<T>`. Zero LLM, zero reasoning,
zero Knowledge Platform dependency, per its own stated scope. `Advisory`-prefixed to avoid four
real naming collisions with pre-existing, unrelated tracks (`src/providers/`, `src/workspace/`,
`src/components/SessionPanel.tsx`). A post-implementation review (`PHASE_X1_POST_IMPLEMENTATION_REVIEW.md`)
found the design sufficiently stable to build on as-is (score 7.9/10) — no redesign needed before
Phase X.2, only additive follow-ups (composition/rehydration helpers, deferred to be built
X.2-side without touching any X.1 file). Tagged `phase-x.1-conversation-core`.

---

### PROJECT_KNOWLEDGE_SYSTEM v1.1 COMPLETE — declared 2026-07-05 (superseded by Phase X.1)

**Evidence:** Release Candidate audit PASSED (GO WITH NOTES); zero-knowledge validation
re-performed after the Documentation Completion Sprint, overall maturity 7 → 8.

**Summary:** Documentation Completion Sprint persisted ADR-DRAFT-X01, the AIContext schema, and
the Golden Question methodology into `PROJECT_KNOWLEDGE_SYSTEM`, completed the `SCHEMA.md`
ownership registry, and gave all 15 Knowledge Base folders an explicit Ownership/Update Policy —
released as v1.1, tagged `knowledge-system-v1.1`, pushed. A final governance decision then
classified ADR-X02–X07, Golden Question datasets, Knowledge Base population, domain legal
content, FAQ population, and ontology population as intentionally deferred, non-blocking future
deliverables — closing the Documentation Track and clearing Phase X.1 (Conversation Core) to
begin with no documentation blockers.

---

*No prior milestones are recorded here because Knowledge Platform v1.0 is the first formally
declared milestone in this project's history — prior phases (A through M1) were tracked as
phase completions (see [Timeline](TIMELINE.md)) rather than named milestones. Future entries
should follow the format: milestone name, declaration date, evidence (test counts, audit
result), and a one-paragraph summary of what changed and why it was declared complete.*
