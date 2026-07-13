# Pre-X.16 Architecture Review

**Date:** 2026-07-13
**Scope:** the complete platform as of Phase X.15 freeze (`develop` @ `98681b1`, X.15 freeze commit
`512b761`, baseline tag `x14-frozen` @ `d1708ff`).
**Method:** direct inspection — current source read, dependency directions grepped live (not
recalled from prior reports), architecture guard suite executed, full test suite executed,
`tsc --noEmit` executed. Cross-checked against `POST_X14_ARCHITECTURE_AUDIT.md`,
`ADR_X15_ARCHITECTURE_DECISION.md`, `X15_GOVERNANCE_IMPACT_ASSESSMENT.md`,
`RECOVERY_CHECKPOINT_X15.md`, `CURRENT_MILESTONE.md`, `TECHNICAL_DEBT.md`, `KNOWN_RISKS.md`.
No source code, test, commit, milestone, or tag was modified to produce this report.

---

## 0. Verification Performed for This Report

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `98681b1` (docs(recovery): add X15 recovery checkpoint) |
| `git rev-parse origin/develop` | `98681b1` — in sync, `0`/`0` ahead-behind |
| `CURRENT_MILESTONE.md` | `current_milestone: "Phase X.15 - Authorization & Recovery Wiring - FROZEN"`, `documentation_track_status: "CLOSED"` |
| `RECOVERY_CHECKPOINT_X15.md` | present, consistent (its documented HEAD `512b761` is exactly one commit behind current HEAD — the difference is the checkpoint-doc-adding commit itself, not a discrepancy) |
| `tsc --noEmit` | clean |
| Architecture guard suite (34 files) | 34 passed, 321 tests passed |
| Full repository suite | 549 files, 14,832 tests — 14,829 passed, 3 skipped (`TEST_DATABASE_URL`-gated), 0 failed |
| `src/identity/` file count | 10 (unchanged since X.14) |
| `src/runtime/` direct file count | 5 (unchanged since X.11); `src/runtime/recovery/` — 6 (unchanged since X.13) |
| `src/identity/` → `src/auth/` import | none found |
| `src/runtime/recovery/` → `src/mcp/`/`src/multiagent/` import | none found |
| `src/server/main.ts` → identity/recovery reference | none found (still unwired, as documented) |
| `prisma/migrations/` | 4 migrations present, none applied to a live database in this environment |

---

## 1. Executive Summary

| Category | Score | One-line reason |
|---|---|---|
| Architecture maturity | **9/10** | 15 consecutive phases with zero frozen-file regressions and zero layering violations, verified again directly for this report |
| Production readiness | **7.5/10** | The one HIGH-severity, live-exploitable gap named at the X.14 audit (session hijack) is now closed; two honestly-named gaps remain (credential verification, recovery-producer wiring), no longer three |
| Maintainability | **9/10** | Every phase still self-documents; X.15 additionally introduced a formal, reusable Governance Exceptions process for the one new failure mode this project's history had not yet produced |
| Extensibility | **7.5/10** | Unchanged from the X.14 baseline — clean DI seams, but Recovery and Identity remain uncomposed siblings by deliberate, documented choice |
| Technical debt | **7/10** | Real, exhaustively documented, actively shrinking (X.15 resolved 2 of 4 HIGH items from the X.14 audit outright and partially resolved a third) |
| Governance discipline | **9.5/10** | This session's own interruption-and-recovery cycle is the strongest evidence available: full state was reconstructed from the repository alone, zero completed work was redone, and a genuinely new problem class (guard-literal brittleness) was resolved via a documented exception process rather than silently patched |

**One-paragraph summary:** Phase X.15 did exactly what it was scoped to do — wire already-built,
already-tested X.13/X.14 infrastructure into the live path — and did so without adding a single
line of new business logic. In the process it surfaced and resolved a real, previously-invisible
problem: three frozen architecture guards, across three separate milestones, encoded the same
class of brittle assertion against files this project's own convention has always intended to
extend. That problem is now closed with a documented, reusable process (GX-001/002/003) rather
than three one-off patches. The architecture itself required zero changes to resolve it — every
dependency-direction and layering guarantee in this codebase held throughout, verified again
directly for this report, not assumed from prior documents. What remains before X.16 is scoping
work (a credential-protocol decision) and environment work (Docker/Postgres availability), not
architecture work.

---

## 2. Dependency Graph

**Presentation order** (conceptual layering, matches `POST_X14_ARCHITECTURE_AUDIT.md` §3,
re-verified unchanged):

```
Application (buildApplication — composition root, X.9.1)
     │
     ▼
Conversation (session domain — X.1/X.11)
     │
     ▼
Runtime (RuntimeContext, runConversationTurn — X.11)
     │
     ▼
Reasoning (ReasoningEnginePipeline — X.2–X.5, frozen)
     │
     ▼
Tool Calling (ToolDecider / runToolCallingStage — X.6, frozen)
     │
     ▼
MCP (MCPClient — X.7, frozen)
     │
     ▼
Streaming (SSE, stateless reasoning endpoint only — X.9.3)
     │
     ▼
Persistence (getPrismaClient, IBaseRepository<T> — Phase M1 / X.10)
     │
     ▼
Identity (Principal/Claims/Permissions — X.14)
     │
     ▼
Recovery (RecoveryMarker, startup scan — X.13)
     │
     ▼
Infrastructure (logging/metrics/tracing/config/startup — X.9.2/X.9.4/X.9.5)
```

**Actual, verified call graph — updated for X.15** (the one change from the X.14-era audit):

```
HTTP (Server/API)
   │
   ├─ reasoningRoutes.ts / coordinatorRoutes.ts  → Reasoning → Tool Calling → MCP   (stateless, unchanged)
   ├─ reasoningStreamRoute.ts                    → Reasoning → Tool Calling         (stateless, unchanged)
   └─ conversationRoutes.ts                      → httpPrincipalResolver.ts (NEW, X.15)
                                                        → runAuthorizedConversationTurn() (X.14, NOW CALLED)
                                                             → evaluateAuthorization() (X.14)
                                                             → ISessionIdentityRepository ownership check (X.14)
                                                             → runConversationTurn() (X.11, frozen, unmodified)
                                                                  → Conversation (session persistence)
                                                                  → Reasoning → Tool Calling → MCP

Recovery (X.13) remains a SEPARATE, parallel entry point: runStartupRecoveryScan() is now called
by deployment/deploy.sh (X.15), but runRecoverableConversationTurn() (the producer) is still not
called by any HTTP route. The recovery scan is genuinely invokable but structurally has nothing
to consume — conversationRoutes.ts creates no recovery markers.
```

**Layering violations found: none**, re-verified directly for this report (not assumed from the
X.14-era audit): grepped `src/identity/` for any import of `src/auth/` (zero matches),
`src/runtime/recovery/` for any import of `src/mcp/`/`src/multiagent/` (zero matches),
`src/server/main.ts` for any reference to identity/recovery (zero matches, confirming both remain
deliberately unwired at the process-boot level). The one new edge X.15 introduced —
`src/api/` → `src/identity/` (via `httpPrincipalResolver.ts` and `conversationRoutes.ts`'s new
imports) — points strictly downward into an already-lower layer, matching every prior wiring
milestone (X.9.2, X.9.3, X.12).

**Structural observation, unchanged, not a violation:** Recovery and Identity remain siblings, not
a chain. `runAuthorizedConversationTurn()` and `runRecoverableConversationTurn()` each
independently wrap `runConversationTurn()`; neither wraps the other. `ADR_X15_ARCHITECTURE_DECISION.md`
considered and explicitly rejected composing them this milestone (would require modifying a frozen
file or duplicating security-sensitive logic) — named as recommended future work, not undertaken.

---

## 3. Architecture Boundaries

The "never modify frozen milestones outside a newly-approved one" discipline has now held across
**15 consecutive phases** (X.1 through X.15) with zero exceptions found. Re-verified for this
report:

- Every file `CURRENT_MILESTONE.md`'s `do_not` list names as frozen was checked via the
  architecture guard suite (34 files, 321 tests, all passing) — this includes the X.15-added
  entries protecting `src/api/httpPrincipalResolver.ts`, the new `conversationRoutes.ts`/
  `httpServer.ts` wiring, and `deployment/deploy.sh`'s recovery-scan step.
- `main.ts` remains untouched since its X.9.1 freeze — X.15 deliberately chose
  `deployment/deploy.sh` over `main.ts` for recovery-scan wiring specifically to avoid creating a
  first-ever "wiring only" precedent for a file that has never needed one, per the ADR's own
  Rejected Alternatives.
- The three governance-exception guard files (X.12/X.13/X.14) are the *only* previously-frozen
  test files modified across the entire X.15 milestone, and each modification is a documented,
  minimal literal correction — no dependency-boundary, layering, or business-logic-isolation
  assertion was touched in any of them (re-confirmed: all three guard files pass in the current
  suite, §0 above).

**Boundary health: unchanged from the X.14 baseline, 9/10.** The discipline is holding under
increasing accumulated surface area (549 test files now, up from 6 at Phase X.1) without dilution.

---

## 4. Module Ownership

| Module | Purpose | Owning phase | Status |
|---|---|---|---|
| `src/knowledge/` | Knowledge Platform (16/16 providers) | Phase N | Frozen |
| `src/reasoning/` | Intent → resolution → rules → conflict → confidence → citation → answer | X.2–X.5 | Frozen |
| `src/ai/` | AIContext/prompt/LLM adapter, output validation (older, partially-superseded track) | X.2 Batch B, X.4 | Frozen |
| `src/mcp/` | Remote tool discovery/invocation | X.7 | Frozen |
| `src/multiagent/` | Deterministic parallel-wave task scheduling | X.8 | Frozen |
| `src/bootstrap/` | Composition root (`buildApplication()`) | X.9.1 | Frozen |
| `src/server/`, `src/api/` | Fastify server + HTTP routes | X.9.1, X.12, **extended X.15** | Frozen except the X.15-authorized wiring |
| `src/logging/`, `src/metrics/`, `src/tracing/`, `src/middleware/` | Observability | X.9.2 | Frozen |
| `src/streaming/`, `src/http/`, `src/cancellation/` | SSE streaming | X.9.3 | Frozen |
| `src/conversation/` | Session lifecycle + memory (domain layer) | X.1, extended X.11 | Frozen |
| `src/runtime/` | Connects reasoning core to persisted conversations | X.11 | Frozen |
| `src/runtime/recovery/` | Crash-recovery marker/queue/coordinator/scan | X.13 | Frozen (scan now invoked by `deploy.sh`, producer still uninvoked) |
| `src/identity/` | Principal/Claims/Roles/Permissions, authorization | X.14 | Frozen (now invoked by `conversationRoutes.ts`/`httpServer.ts`) |
| `src/persistence/` | Prisma client, transactions, connectivity | Phase M1, extended X.10 | Frozen, unverified live |
| `src/startup/` | Graceful shutdown, env validation | X.9.1, X.9.4, X.9.5 | Frozen |
| `src/api/httpPrincipalResolver.ts` | **New in X.15** — HTTP request → `AuthenticationContext` bridge | X.15 | Frozen at X.15 freeze |
| `src/procurement/`, `src/masterdata/`, `src/approval/`, `src/contract/`, `src/acceptance/`, `src/payment/`, `src/legal/`, `src/storage/`, `src/notification/` | Vietnamese public-procurement domain logic | Phase A–M1 | Frozen, dormant relative to the AI Runtime (only `src/storage/` reused, by X.11) |
| `src/auth/` | Procurement-domain RBAC/ABAC | Phase M1 (J) | Frozen, deliberately never merged with `src/identity/` |

**Unrelated / pre-existing, not part of this track:** `src/agents/`, `src/framework/`,
`src/orchestrator/`, `src/memory/`, `src/components/`, `src/workspace/`, `src/interface/`,
`src/capabilities/`, `src/cases/`, `src/assets/`, `src/application/` — several have untracked,
uncommitted files still sitting in the working tree (`app/src/memory/`, `app/src/orchestrator/`,
various `glpi-*`/`dry-run-adapter`/`model-adapter`/`knowledge-provider` test files) that predate
every session in this report's history and remain explicitly out of scope. Not touched by, and
irrelevant to, X.15 or any prospective X.16 scoping.

---

## 5. Layering (Hexagonal / DDD Discipline)

Every Phase-X module still follows the same `domain/` → `application/` → `infrastructure/`
split established at X.1, re-verified for `src/identity/` (the newest module) in §0:
`identityTypes.ts` sits under `domain/`; `authorizationEvaluator.ts`, `authenticationContext.ts`,
`runtimeAuthorization.ts`, `toolAuthorization.ts`, `mcpAuthorization.ts`, `routeAuthorization.ts`,
`permissionResolver.ts` sit under `application/`; `sessionIdentityRepository.ts`,
`prismaSessionIdentityRepository.ts` sit under `infrastructure/`. `src/runtime/recovery/` is a
flat structure by contrast (no domain/application/infrastructure split) — consistent with its own
smaller scope and matching how it was originally built at X.13; not a deviation introduced by
X.15, which added no new files to that directory.

`src/api/httpPrincipalResolver.ts` is the one new X.15 file, and it deliberately sits **outside**
any domain/application/infrastructure split, at the same flat level as `conversationRoutes.ts` —
documented in the ADR as a location clarification (the file was originally planned under
`src/identity/application/` but relocated to avoid breaking X.14's own recursive file-count
guard). This is a pragmatic exception, not a new convention: it is a thin bridge function with a
single responsibility (HTTP → `AuthenticationContext`), not a module in its own right.

**Layering health: 9/10, unchanged.** No violation found; one documented, justified exception to
the general domain/application/infrastructure pattern for a single-function bridge file.

---

## 6. Governance Exceptions

Three exceptions exist, all formally recorded in `ADR_X15_ARCHITECTURE_DECISION.md`'s Governance
Exceptions section, all applied and currently passing:

| ID | Guard file (milestone) | Nature | Verified status |
|---|---|---|---|
| GX-001 | `x12-http-entry-architecture.test.ts` (X.12) | Exact-substring literal updated to the new, ADR-authorized call shape | Passing |
| GX-002 | `x13-recovery-architecture-guard.test.ts` (X.13) | Exact-substring literal replaced with a name+open-paren presence check | Passing |
| GX-003 | `x14-identity-architecture-guard.test.ts` (X.14) | Over-broad regex narrowed to match the assertion's own already-stated title | Passing |

**Root cause (unchanged from the impact assessment, re-confirmed still accurate):** an
authoring-style inconsistency between two architecture-guard lineages — X.9.2/X.9.3/X.9.4 used a
presence-check style already robust to `httpServer.ts`/`conversationRoutes.ts`'s established
"wired once, extended repeatedly" pattern; X.12/X.13/X.14's guards, verifying the same class of
fact, used a brittle exact-substring style. Not a code defect in any of the three exceptions —
every dependency-boundary and business-logic-isolation assertion in all three guards held
throughout and still holds today (§0).

**Forward risk for X.16:** `POST_X14_ARCHITECTURE_AUDIT.md` already named X.16 as a milestone that
touches `conversationRoutes.ts`/`httpServer.ts` again (to replace `httpPrincipalResolver.ts`'s
unverified signal with a real credential). The ADR's forward guard-writing guidance (presence-check
style for any future guard verifying additive extension of these two files) should be followed by
whoever writes X.16's own architecture guard, to avoid a fourth occurrence of this same class of
break. This is a recommendation, not a currently-enforced rule — no lint or guard exists that would
catch a future guard author choosing the brittle style again.

---

## 7. Technical Debt

**Note on source staleness:** `TECHNICAL_DEBT.md` and `KNOWN_RISKS.md` are both dated
`as_of: 2026-07-05` — before the entire Phase X.3–X.15 track (2026-07-10 through 2026-07-13). Their
TD-01 through TD-08 items (procurement-domain debt, pre-existing) remain accurate and untouched by
Phase X, but their framing of "no auth enforcement wired to any endpoint" (TD-03) is now
**partially resolved** by X.15 for the one route it covers. `POST_X14_ARCHITECTURE_AUDIT.md`
(2026-07-13) is the more current source for Phase-X-specific debt; this section reconciles both
against verified current state.

**Resolved by X.15** (previously HIGH in `POST_X14_ARCHITECTURE_AUDIT.md` §4):

| Item | Prior status | Current status |
|---|---|---|
| No route requires authorization — session hijack via unauthenticated `sessionId` | HIGH, live-exploitable | **Resolved.** `runAuthorizedConversationTurn()` now gates `POST /api/v1/conversation/turn`; ownership check now has a real (if non-cryptographic) distinguishing signal via `x-client-id` |
| Recovery not wired into any operational sequence | HIGH | **Partially resolved.** The scan (`runStartupRecoveryScan()`) is now invoked by `deployment/deploy.sh`. The producer (`runRecoverableConversationTurn()`) remains unwired — see below. |

**Still open, unaffected or only partially affected by X.15:**

| Item | Severity | Notes |
|---|---|---|
| No real credential verification | HIGH | `x-client-id` is explicitly documented (resolver header, ADR, `CURRENT_MILESTONE.md`) as non-cryptographic and unverified — closes the *false-sense-of-security* gap (distinct callers can now be distinguished) without closing the *actual* authentication gap. Named as X.16's job. |
| Recovery-producer wiring | HIGH (downgraded from the pre-X.15 framing since the scan half is now real) | `conversationRoutes.ts` still calls plain `runConversationTurn()` internally (via the authorization wrapper) — no HTTP path ever creates a `RecoveryMarker`. The now-invokable scan will find an empty queue in practice until a future milestone wires the producer. |
| Docker/Postgres never run in this environment | HIGH, unchanged | Now 4 migrations deep (`prisma/migrations/`, confirmed by directory listing, §0) — none ever applied to a live Postgres instance. Every Prisma-backed repository across Phase M1/X.10/X.11/X.13/X.14 remains unit/architecture-guard-verified only. |
| Recovery and Identity are uncomposed siblings | MEDIUM | Unchanged — deliberately not resolved by X.15 (would require modifying a frozen file or duplicating security-sensitive logic; ADR names this as recommended future work) |
| No concurrent-scan-safe idempotency (`IBaseRepository` has no optimistic-locking primitive) | MEDIUM | Unchanged, pre-existing (`TD-08`) |
| MCP default permissions are minimal (`SYSTEM` only) | MEDIUM | Unchanged |
| No HTTP-boundary input validation library (Zod or similar) | MEDIUM | Unchanged, pre-existing (`TD-06`) |
| No CI/CD pipeline | LOW–MEDIUM | Unchanged — every verification in this project's history, including this report's, remains manual |
| ~470 pre-existing ESLint problems, never a merge gate | LOW | Unchanged, pre-existing, not re-verified in this report given volume |
| `ADR` dual-numbering (`docs/adr/ADR-004` vs. `.memory/decisions/ADR-004`) | LOW | Unchanged, pre-existing |
| No caching layer anywhere | LOW (at current scale) | Unchanged, pre-existing |

**Net debt trend: improving.** Two of four HIGH items from the X.14-era audit are now fully or
partially resolved; zero new debt items were introduced by X.15 (the new `httpPrincipalResolver.ts`
is explicitly self-documented as a stopgap, not presented as a permanent solution).

---

## 8. Runtime Composition

Composition root chain, verified against current source (§0):

```
buildApplication()                         (X.9.1 — composition root: Knowledge Platform,
                                             Reasoning Pipeline, ToolRegistry/ToolExecutor,
                                             CoordinatorAgent, logger/metrics/tracer)
        │
        ▼
buildHttpServer(app)                        (X.9.1, extended X.9.2/X.9.3/X.12/X.15)
        │
        ├─ registerRequestLifecycleHooks()  (X.9.2)
        ├─ /live /ready /health             (X.9.1)
        ├─ registerReasoningRoutes()        (X.9.1)
        ├─ registerCoordinatorRoutes()      (X.9.1)
        ├─ registerReasoningStreamRoute()   (X.9.3)
        └─ buildRuntimeContext({application: app})   (X.11)
              + buildMemorySessionIdentityRepository()  (X.14, constructed here since X.15)
              → registerConversationRoutes(server, runtime, sessionIdentityRepository)  (X.12, extended X.15)
```

Every constructor call in `buildHttpServer()` remains a single, additive line per milestone —
X.15 added exactly one (`buildMemorySessionIdentityRepository()`) and extended one existing call's
argument list (`registerConversationRoutes`), matching the identical shape of every prior
extension (X.9.2, X.9.3, X.12). No orchestration or business logic exists inside `buildHttpServer()`
itself — verified by direct read (§0), consistent with its own header comment's stated discipline
across all five milestones that have touched it.

**Composition health: 9/10, unchanged.** The DI seam remains clean; `RuntimeContext`'s exported
shape is unchanged since X.11 (re-verified: `application`, `sessionRepository`,
`attachmentRepository` only — identity and recovery repositories are composed as separate
constructor arguments, never added as fields).

---

## 9. Authorization Flow (current, end-to-end)

```
1. POST /api/v1/conversation/turn
2. parseConversationTurnBody()                          — unchanged since X.12
3. resolvePrincipalFromRequest(req)                      — NEW, X.15 (src/api/httpPrincipalResolver.ts)
      reads `x-client-id` header
      present, non-empty → buildUserContext(clientId)    (X.14, reused verbatim)
      absent              → buildAnonymousContext()       (X.14, reused verbatim)
4. runAuthorizedConversationTurn(auth, sessionIdentityRepository, runtime, parsed)   — NOW CALLED, X.15
      → evaluateAuthorization()                           (X.14) — checks conversation:ask:OWN
      → ISessionIdentityRepository ownership check        (X.14) — if sessionId supplied, verifies
        the resolved principal owns it (or holds ALL scope for cross-session access)
      → runConversationTurn()                             (X.11, frozen, unmodified)
      → binds a new session's identity on first use       (X.14)
5. authorized: false → HTTP 403, body { error: { code: 'FORBIDDEN', message: decision.reason } }
   authorized: true  → HTTP 200, body { data: result }
```

**What this closes:** the session-hijack gap named at the X.14/`POST_X14_ARCHITECTURE_AUDIT.md`
review — two different callers (distinguished by `x-client-id`) can no longer silently collide into
the same `anonymous` principal, so the ownership check (which existed since X.14 but was
structurally unreachable) now actually fires.

**What this does not close, stated plainly (matches the ADR/checkpoint, re-verified):**
`x-client-id` is an unsigned, caller-supplied string — any caller can still claim any identity by
sending a different header value. This is *accidental-collision* protection (two honest,
non-adversarial callers won't collide), not *adversarial-attacker* protection. Real authentication
(verifying the caller actually controls the claimed identity) is entirely absent and is X.16's
explicitly named scope.

`routeAuthorization.ts` (the Fastify preHandler-hook builder, X.14) remains completely unwired —
confirmed by GX-003's own narrowed assertion and by direct grep (§0): neither `httpServer.ts` nor
`conversationRoutes.ts` references it. Route-level gating (as opposed to the runtime-level gating
this flow describes) is a distinct, still fully open capability.

---

## 10. Recovery Flow (current, end-to-end)

```
Deployment sequence (deployment/deploy.sh, extended X.15):
  validate environment (X.9.4)
    → docker compose --profile app up -d --build (X.9.4)
    → wait for readiness (X.9.5)
    → npx tsx scripts/recoveryScan.ts             — NEW invocation, X.15 (script itself is X.13, unmodified)
         → runStartupRecoveryScan()                (X.13)
              → IRecoveryRepository.findPending()  (X.13)
              → conversationRecoveryCoordinator.recoverMarker() per pending marker  (X.13)
    → run smoke tests (X.9.5)
```

**Structural gap, stated plainly:** no HTTP path creates a `RecoveryMarker`.
`runRecoverableConversationTurn()` (X.13's producer) is not called by `conversationRoutes.ts` —
confirmed by direct read (§0) and by the X.15 architecture guard's own dedicated assertion (§6 of
`ADR_X15_ARCHITECTURE_DECISION.md`'s Acceptance Criteria: "`runRecoverableConversationTurn` is not
imported anywhere under `src/api/` or `src/server/`"). **In practice, this scan currently always
finds an empty queue.** The capability is genuinely exercised end-to-end (proving the scan
mechanism itself works against a real deployment sequence) but provides no actual crash-resilience
for live HTTP traffic yet — this is the honest state the ADR and freeze commit both require to be
stated, not softened, in any summary.

**Two known, pre-existing limitations, unaffected by X.15:** at-least-once (not exactly-once)
replay semantics (true exactly-once would need `runConversationTurn()`'s session persist and
marker completion to share one transaction, requiring modification of a frozen file); no
concurrent-scan-safe idempotency (no optimistic-locking primitive exists on `IBaseRepository`).

---

## 11. Persistence

- **Schema:** 85 models total in `prisma/schema.prisma` (verified by direct count, §0) — 82
  pre-Phase-X models (Phases A–M1) plus three additive Phase X models:
  `ConversationSession` (X.11), `ConversationRecoveryMarker` (X.13), `SessionIdentityBinding`
  (X.14). **X.15 added zero new models** — confirmed by the ADR's own scope and by direct schema
  inspection; no new migration was required.
- **Migrations:** 4 present (`20260705120000_init_production_schema`,
  `20260710120000_add_conversation_session`, `20260710150000_add_conversation_recovery_marker`,
  `20260710180000_add_session_identity_binding`) — none ever applied to a live PostgreSQL instance
  in this environment (Docker unavailable across every phase since X.9.4). This remains the single
  largest "implemented but never run for real" gap in the entire platform, unaffected by X.15 and
  explicitly out of X.15's scope.
- **Default wiring:** `httpServer.ts` constructs a **memory-backed** `ISessionIdentityRepository`
  (`buildMemorySessionIdentityRepository()`) — matching the project's consistent "memory-first,
  Prisma opt-in" convention already used for `RuntimeContext`'s own `sessionRepository`. No
  `IRecoveryRepository` is constructed in the HTTP path at all (nothing there needs one, since the
  producer remains unwired).
- **Repository interface discipline:** re-confirmed unchanged — `IBaseRepository<T>` and its 82
  pre-X.11 implementations were not touched; every Phase X repository pair (memory + Prisma) still
  implements exactly one shared interface, never a second one, per each phase's own architecture
  guard.

---

## 12. HTTP Entry

Full route inventory, `buildHttpServer()`, verified current (§0/§8):

| Route | Method | Registered by | Milestone | Auth? |
|---|---|---|---|---|
| `/live` | GET | inline in `httpServer.ts` | X.9.1 | None (liveness probe) |
| `/ready` | GET | inline in `httpServer.ts` | X.9.1 | None (readiness probe) |
| `/health` | GET | inline in `httpServer.ts` | X.9.1 | None (aggregated health) |
| `/api/v1/reasoning/answer` | POST | `registerReasoningRoutes()` | X.9.1 | **None** — stateless, unauthenticated |
| `/api/v1/reasoning/batch` | POST | `registerCoordinatorRoutes()` | X.9.1 | **None** |
| `/api/v1/reasoning/answer/stream` | POST (SSE) | `registerReasoningStreamRoute()` | X.9.3 | **None** |
| `/api/v1/conversation/turn` | POST | `registerConversationRoutes()` | X.12, **authorization added X.15** | **Yes** — `runAuthorizedConversationTurn()`, 403 on denial |

**Observation, not a regression:** the reasoning/coordinator/streaming routes remain entirely
unauthenticated and unauthorized — X.15's scope was explicitly limited to the conversation-turn
write path (the one route with a session/identity concept to protect). These three stateless
routes have no session state to hijack, so this is a pre-existing, documented, lower-priority gap
(consistent with `POST_X14_ARCHITECTURE_AUDIT.md`'s own risk ranking), not something X.15 was ever
scoped to close.

---

## 13. AI Engine Integration

Unchanged by X.15 in every respect — re-confirmed by direct inspection that no Phase X.15 file
imports from or modifies any of the following:

- **Reasoning core** (`src/reasoning/`, X.2–X.5, frozen): `ReasoningEnginePipeline.answer()` — the
  7-stage deterministic chain (intent → knowledge resolution → rule evaluation → conflict
  resolution → confidence scoring → citation generation → answer composition).
- **Tool Calling** (`src/reasoning/application/toolCallingStage.ts`, X.6, frozen):
  `runToolCallingStage()`, composed with a `ToolDecider` — `withToolAuthorization()` (X.14) can
  wrap this as a higher-order decider, but is not currently composed into the live
  `runConversationTurn()` chain (a separate, still-open wiring question, not part of X.15's scope).
- **MCP** (`src/mcp/`, X.7, frozen): `MCPClient`, registered into the same `ToolRegistry` local
  tools use. `mcpAuthorization.ts` (X.14) exists as a pure pre-check function but is not invoked by
  any caller of `MCPClient.callTool()` today.
- **Multi-Agent** (`src/multiagent/`, X.8, frozen): `CoordinatorAgent.run()`, reachable only via
  `coordinatorRoutes.ts` (unauthenticated, §12) — has no session or identity concept and X.15 does
  not give it one.

`runConversationTurn()` (X.11, frozen) remains the single point where all of the above compose for
the conversation-turn path — X.15 added exactly one caller in front of it
(`runAuthorizedConversationTurn()`) and changed nothing inside it, re-verified by the X.15
architecture guard's own forbidden-import list (never `detectIntent`, `formatConversationResponse`,
`runToolCallingStage`, `RuntimeSessionBuilder`, or `ConversationSession` directly from
`conversationRoutes.ts` or `runtimeAuthorization.ts`).

---

## 14. Overall Health Scorecard

| Dimension | Score | Trend since X.14 |
|---|---|---|
| Dependency graph correctness | 9.5/10 | Unchanged — zero violations, one new (correctly-directed) edge |
| Architecture boundaries | 9/10 | Unchanged — 15 phases, zero exceptions found beyond the 3 documented GX items |
| Module ownership clarity | 9/10 | Unchanged — one new file (`httpPrincipalResolver.ts`), ownership immediately clear |
| Layering discipline | 9/10 | Unchanged — one documented, justified flat-file exception |
| Governance-exception handling | 9.5/10 | **New this milestone** — first-ever formal exception process, well-executed |
| Technical debt trajectory | 7/10 → improving | 2 of 4 prior HIGH items resolved or partially resolved, 0 new debt introduced |
| Runtime composition cleanliness | 9/10 | Unchanged — one additive constructor call |
| Authorization flow completeness | 6/10 → improving from 3/10 | Session-hijack closed; credential verification and route-level gating still open |
| Recovery flow completeness | 5/10 → improving from 3/10 | Scan genuinely invokable; producer still unwired, queue structurally empty |
| Persistence verification | 3/10 | Unchanged — still never run against a live database, now 4 migrations deep |
| HTTP entry security posture | 6/10 → improving from 4/10 | 1 of 4 routes now authorized (the one with session state); 3 stateless routes remain open by design |
| AI engine integration stability | 10/10 | Unchanged — zero modification, zero new coupling |

---

## 15. Findings (ranked)

**[HIGH]**
- **Description:** No real credential verification exists anywhere in the platform.
  `x-client-id` is an unsigned, caller-supplied string trusted at face value.
- **Impact:** Any caller can claim any identity by sending a different header value; the
  authorization ownership check now fires correctly but authorizes based on an unverified claim.
- **Recommendation:** Scope and authorize Phase X.16 to decide a credential protocol (bearer
  token / session cookie / OIDC — a product decision, not an engineering one per the existing
  roadmap) and wire it into `httpPrincipalResolver.ts`'s resolution logic.

**[HIGH]**
- **Description:** Recovery-producer wiring remains absent — `runRecoverableConversationTurn()`
  is not called by any HTTP route.
- **Impact:** The recovery scan wired this milestone is real but structurally has nothing to
  process; crash-resilience for live conversation-turn traffic does not yet exist in practice.
- **Recommendation:** A future, explicitly-scoped milestone should either extend a frozen X.13/
  X.14 wrapper to accept an injectable inner call (the ADR's own recommended long-term fix) or
  make an explicit, reviewed decision to compose the two wrappers directly at the route level.

**[HIGH]**
- **Description:** Docker/Postgres has never been run in this development environment across
  6 phases (X.9.4 onward) and 4 accumulated migrations.
- **Impact:** Every Prisma-backed repository in the platform is verified only at the unit/
  architecture-guard level; unknown whether the accumulated schema applies cleanly to a real
  Postgres instance.
- **Recommendation:** This is an environment prerequisite, not a milestone — resolve
  independently of any specific Phase X work, ideally before or alongside X.16.

**[MEDIUM]**
- **Description:** Recovery and Identity remain uncomposed siblings; no single entry point
  provides both crash-resilience and authorization for one conversation turn.
- **Impact:** A future caller needing both must hand-compose the two wrappers, or a future
  milestone must extend one of them.
- **Recommendation:** Named as recommended future work in `ADR_X15_ARCHITECTURE_DECISION.md` —
  revisit only as its own explicitly-scoped milestone, not folded into X.16 implicitly.

**[MEDIUM]**
- **Description:** `routeAuthorization.ts` (Fastify-level route gating, X.14) remains completely
  unwired into any route.
- **Impact:** Route-level gating is a distinct capability from the runtime-level gating X.15
  wired in; currently no route uses it.
- **Recommendation:** Low priority relative to X.16's credential-verification gap — route-level
  gating adds limited value while the underlying identity is still unverified.

**[MEDIUM]**
- **Description:** No concurrent-scan-safe idempotency exists (`IBaseRepository` has no
  optimistic-locking primitive) — pre-existing, unaffected by X.15.
- **Impact:** Two simultaneous recovery scans could theoretically double-process the same
  marker (currently moot in practice since the queue is always empty, per the finding above).
- **Recommendation:** Track as `X.19` per the existing roadmap; not urgent while the producer
  remains unwired.

**[LOW]**
- **Description:** `TECHNICAL_DEBT.md`/`KNOWN_RISKS.md` are stale (`as_of: 2026-07-05`), predating
  the entire Phase X.3–X.15 track; `POST_X14_ARCHITECTURE_AUDIT.md` (2026-07-13) is the more
  current source but is itself now two milestones old.
- **Impact:** A reader consulting only `TECHNICAL_DEBT.md` would miss that TD-03 ("no auth
  enforcement wired") is now partially resolved.
- **Recommendation:** A documentation-only pass to refresh `TECHNICAL_DEBT.md`/`KNOWN_RISKS.md`
  against current state would be low-effort and is a reasonable candidate for whoever next
  touches governance docs — not urgent enough to block X.16.

**[LOW]**
- **Description:** No CI/CD pipeline exists; every verification in this project's 15-phase
  history, including this report's, has been run manually.
- **Impact:** No merge-time safety net; relies entirely on discipline, which has held but is not
  tooling-enforced.
- **Recommendation:** Tracked as `X.18` per the existing roadmap.

---

## 16. Recommendation

**Continue current architecture — no redesign indicated.** This is the fourth consecutive
architecture review (following the Phase-N Release Candidate audit, the Phase X Architecture
Review, and `POST_X14_ARCHITECTURE_AUDIT.md`) to reach this conclusion, and the evidence base for
it has only grown stronger: 15 phases, zero layering violations, one genuinely novel problem class
(guard-literal brittleness) encountered and resolved via process rather than architecture change.

**Before Phase X.16 may begin** (repeating `RECOVERY_CHECKPOINT_X15.md` §7, re-confirmed still
accurate by this review):
1. Explicit human authorization and scoping — no business-domain milestone begins automatically.
2. A chosen credential protocol (bearer token / session cookie / OIDC) — a product decision.
3. Awareness that `httpPrincipalResolver.ts` and the X.15 wiring are expected to change as part of
   X.16's own scope — this is authorized in advance, not a violation of "don't modify frozen code."
4. Whoever authors X.16's own architecture guard should follow the presence-check convention
   (§6) to avoid a fourth guard-brittleness incident.
5. `routeAuthorization.ts` wiring and recovery-producer wiring remain explicitly out of scope for
   X.16 unless a future scoping decision folds them in.
6. Full suite green and `tsc --noEmit` clean at the start of X.16 — this review confirms both hold
   as of this report (§0); re-verify again at the actual start of that milestone, since time may
   pass or other work may land on `develop` first.

---

*End of report. No source code was modified. No tests were modified. No commits were created. No
milestones were updated. No branches or tags were created. Phase X.16 was not started.*
