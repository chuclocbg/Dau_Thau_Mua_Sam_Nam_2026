# Phase X.15 Implementation Plan — Authorization & Recovery Wiring

**Date:** 2026-07-13 · **Status:** Planning only — nothing in this document is authorized or implemented.
**Baseline:** `x14-frozen` (`d1708ff`), governance updated through `f174fcc`, `POST_X14_ARCHITECTURE_AUDIT.md` roadmap item 1.
**Repository state confirmed:** `HEAD` = `f174fcc` on `develop`, clean of all X.14 work, no source changes pending.

Scope, per the governance trail (`CURRENT_MILESTONE.md`'s `next_active_milestone`,
`RELEASE_NOTES_X14.md`'s Known Remaining Limitations, and `POST_X14_ARCHITECTURE_AUDIT.md`'s §8
roadmap item 1): **wire X.14's authorization infrastructure into the live HTTP write path, and
wire X.13's recovery scan into the boot/deployment sequence.** No new capability — everything
needed already exists, built and tested, in X.13/X.14.

---

## 0. Verification Method

Every claim below was checked by reading the current source file directly in this session (not
recalled from memory): `httpServer.ts`, `conversationRoutes.ts`, `main.ts`,
`runtimeAuthorization.ts`, `routeAuthorization.ts`, `runtimeRecoveryManager.ts`,
`runtimeContext.ts`. All match their own X.12/X.13/X.14 freeze reports exactly — zero drift
since freeze, as expected given no code has changed.

---

## 1. Capability Reuse Audit

For every capability X.15 needs, verified by reading the actual implementation:

| Capability | Status | Evidence |
|---|---|---|
| Authorization decision evaluation | **Existing, complete** | `evaluateAuthorization()` (`src/identity/application/authorizationEvaluator.ts`) — pure, deterministic, tested (16 tests) |
| Session-ownership enforcement | **Existing, complete** | `runAuthorizedConversationTurn()` (`runtimeAuthorization.ts`) — wraps `runConversationTurn()`, binds/checks session ownership, tested (7 integration tests against a real `Application`) |
| Fastify-level route gating | **Existing, complete** | `buildRouteAuthorizationHook()` (`routeAuthorization.ts`) — a `preHandlerHookHandler` factory, proven via a real Fastify instance (4 tests) |
| **Extracting a `Principal` from a real HTTP request** | **Missing** | `routeAuthorization.ts`'s `PrincipalResolver` type is the intended extension point, but the only concrete implementation anywhere in the codebase is the default `() => buildAnonymousContext()`. Nothing reads a header, cookie, or credential and produces a non-anonymous `Principal`. |
| Wiring the above into `conversationRoutes.ts`/`httpServer.ts` | **Missing (wiring only)** | Confirmed by direct read: `conversationRoutes.ts` imports only `runConversationTurn` (X.11); `httpServer.ts` has zero reference to `src/identity/` (verified again — `grep -c identity httpServer.ts` = 0) |
| Startup recovery scan logic | **Existing, complete** | `runStartupRecoveryScan()` (`runtimeRecoveryManager.ts`) — drains the queue, tested (9+7 tests) |
| Recoverable-turn producer (the thing that actually creates markers for the scan to find) | **Existing, complete, but ALSO unwired** | `runRecoverableConversationTurn()` (`recoverableConversationTurn.ts`) exists and is tested, but `conversationRoutes.ts` calls plain `runConversationTurn()` — **if only the scan is wired and not the producer, the recovery queue will always be empty; wiring "recovery" meaningfully requires both.** |
| Wiring the scan into process startup | **Missing (wiring only)** | Confirmed: `grep -i recovery src/server/main.ts` = 0 matches. `scripts/recoveryScan.ts` (CLI) exists as the designed, un-wired entrypoint. |
| Authorization audit trail | **Missing completely** | `evaluateAuthorization()` is deliberately pure with no sink (documented in its own header). `src/auth/`'s audit system (`repos.auditEvents.append`) exists but belongs to the unrelated procurement domain and is explicitly not reusable (X.14's own inspection finding). |
| Session identity persistence | **Existing, complete** | `SessionIdentityBinding` + memory/Prisma repos (X.14), already composed by `runtimeAuthorization.ts` |
| Recovery marker persistence | **Existing, complete** | `RecoveryMarker` + memory/Prisma repos (X.13) |
| Real credential verification (password/token/OIDC) | **Missing completely, explicitly out of scope for X.15** | No protocol has been chosen anywhere in the codebase; `buildUserContext(userId)` trusts its input. This is `POST_X14_ARCHITECTURE_AUDIT.md`'s own X.16, not X.15. |
| CI/CD gate | **Missing completely, out of scope for X.15** | No `.github/workflows`; a separate roadmap item (audit §8 item 4) |
| Anything "obsolete"/needing removal | **None found** | No dead code, no superseded mechanism identified anywhere in the audit trail for this scope |

**Reuse conclusion:** X.15 needs **zero new business logic**. Every decision-making, persistence,
and evaluation primitive already exists and is tested. What's missing is exclusively (a) the
wiring itself, and (b) a request-to-`Principal` bridge — a thin adapter, not new logic.

---

## 2. Dependency Graph (requested format, annotated with actual verified state)

```
Phase X.15
   ↓
existing modules used:
   src/identity/application/runtimeAuthorization.ts     (X.14, unmodified)
   src/identity/application/routeAuthorization.ts        (X.14, unmodified)
   src/identity/application/authenticationContext.ts     (X.14, unmodified — buildUserContext/buildAnonymousContext reused)
   src/identity/infrastructure/sessionIdentityRepository.ts (X.14, unmodified)
   src/runtime/recovery/runtimeRecoveryManager.ts         (X.13, unmodified)
   src/runtime/recovery/recoverableConversationTurn.ts    (X.13, unmodified)
   src/runtime/recovery/*Repository.ts                    (X.13, unmodified)
   src/runtime/runtimeContext.ts, conversationEntryOrchestrator.ts  (X.11, unmodified)
   ↓
new modules required:
   ONE thin adapter, IF a caller-distinguishing signal is added this milestone (see §6 risk —
   this is the one open design question this plan flags, not resolves): a request→Principal
   bridge function. See §4 for exact justification. Zero other new files anticipated.
   ↓
affected runtime:
   src/runtime/ itself — NOT modified. RuntimeContext's shape is unchanged (confirmed:
   runtimeAuthorization.ts already composes ISessionIdentityRepository as a separate parameter,
   never a RuntimeContext field). No runtime-layer file requires a code change.
   ↓
affected APIs:
   src/api/conversationRoutes.ts — MODIFIED (adds an auth dependency + principal resolution to
   the route registration; the request handler calls runAuthorizedConversationTurn() instead of
   runConversationTurn() directly, and optionally runRecoverableConversationTurn() for recovery
   marker creation)
   src/server/httpServer.ts — MODIFIED (constructs an ISessionIdentityRepository and an
   IRecoveryRepository alongside the existing RuntimeContext construction, passes them through —
   the exact same "wiring only" pattern already used 3 times: X.9.2, X.9.3, X.12)
   src/server/main.ts — POSSIBLY MODIFIED (see §6 — open design question: wire the recovery scan
   here directly, or via deployment/deploy.sh instead, never touching main.ts)
   ↓
affected persistence:
   NONE structurally. SessionIdentityBinding and RecoveryMarker Prisma models already exist
   (X.13/X.14 migrations). No new migration required. Existing memory-backed repositories remain
   the httpServer.ts default (matching every prior "memory-first, Prisma opt-in" convention);
   whether to switch the default to Prisma-backed for this wiring is a deployment-config
   decision, not a schema decision.
   ↓
affected authentication:
   Unchanged in substance — still no real credential verification (X.16's scope, not X.15's).
   What changes: SOME signal must now flow from the HTTP request to a Principal (even if that
   signal is "always anonymous," which is the safe, zero-new-code default, or a minimal
   non-cryptographic distinguishing header, which is one new small file — see §4/§6).
   ↓
affected MCP:
   NONE. Confirmed by design: authorizeMcpToolCall() (X.14) and withToolAuthorization() (X.14)
   already exist as standalone, composable pieces; wiring conversationRoutes.ts does not touch
   MCP or Tool Calling at all — those remain reachable only through the same frozen
   runConversationTurn() → runToolCallingStage() chain, unaffected by this milestone.
   ↓
affected multi-agent:
   NONE. coordinatorRoutes.ts (X.9.1, the multi-agent batch entry point) is a separate route,
   untouched by this milestone's scope. CoordinatorAgent has no session/identity concept and
   this plan does not propose giving it one.
```

**No layering violation is introduced by this plan.** `src/api/` → `src/identity/` and
`src/api/` → `src/runtime/recovery/` are both new edges, but both point *downward* in the
existing, verified dependency order (§3 of `POST_X14_ARCHITECTURE_AUDIT.md`) — `api` already
depends on `runtime` (X.12) and `identity`/`recovery` already sit below `api` in that graph.
Neither `identity` nor `recovery` imports anything from `api`/`server` (re-confirmed by their
own X.13/X.14 architecture guards, which this plan did not need to re-run since no source has
changed).

---

## 3. Layering Violations Identified

**None.** The graph above is the same shape as every prior wiring milestone (X.9.2, X.9.3,
X.12) — a higher layer (`api`/`server`) reaching down to compose lower layers it doesn't yet
use. No circular edge, no lower-layer file importing anything from `api`/`server`.

---

## 4. New Files — Justification for Why Existing Components Cannot Be Reused

**At most one new file is justified**, and only if this milestone's implementers decide the
default `buildAnonymousContext()` resolver is insufficient (see §6's central open question):

| Proposed file | Why it cannot reuse an existing component |
|---|---|
| A request→`Principal` resolver (e.g. `src/identity/application/httpPrincipalResolver.ts`) | `routeAuthorization.ts`'s `PrincipalResolver` type is the extension point, but no concrete implementation exists that reads anything from a `FastifyRequest` besides the trivial always-anonymous default. `buildUserContext()`/`buildServiceContext()` (X.14) already shape a `Principal` correctly — this new file would *only* extract an id from the request and call one of them; it would not duplicate identity-shaping logic, only bridge HTTP → the existing factory functions. |

**Every other piece of this milestone is a modification to an existing, frozen file (wiring),
not a new file** — because the thing being added in each case (a function call, a constructed
repository passed through) has no independent existence worth a new file; inventing one would
be exactly the kind of premature abstraction this project's own discipline has consistently
avoided (e.g., X.13's recovery producer and X.14's runtime authorization were each *one* new
file with real, independent logic — this milestone's wiring work has no equivalent unit of new
logic to house).

---

## 5. Existing Components — Why They Should NOT Be Modified

| Component | Why not |
|---|---|
| `src/runtime/conversationEntryOrchestrator.ts` (X.11) | `runAuthorizedConversationTurn()` and `runRecoverableConversationTurn()` both already compose it correctly as a black box. Modifying it would require re-verifying two downstream wrappers' correctness for no benefit — the wiring problem this milestone solves is entirely upstream of it (which caller reaches it, not what it does). |
| `src/identity/application/*.ts` (X.14) | Complete, tested, and — critically — *designed for exactly this wiring* (`routeAuthorization.ts`'s own header: "a future, separately-authorized milestone can register [this] without any change to this file"). Modifying it now would mean the X.14 design was wrong; nothing found in this audit suggests that. |
| `src/runtime/recovery/*.ts` (X.13) | Same reasoning — `runtimeRecoveryManager.ts`'s own header names this exact milestone ("wiring it into the live process boot sequence is a deliberate... gap for a future, separately-authorized milestone") and asks for nothing more than a caller. |
| `src/reasoning/`, `src/mcp/`, `src/multiagent/` (X.2–X.8) | Entirely unaffected by this milestone's scope (§2) — no reason to touch, and touching them would violate "Do NOT modify any frozen milestone" for zero benefit. |
| `src/persistence/`, `prisma/schema.prisma` | No new fact needs storing — `SessionIdentityBinding`/`RecoveryMarker` already model everything this wiring needs. A schema change here would be scope creep. |
| `src/auth/` (Phase M1) | Reconfirming X.14's own finding: still procurement-business-coupled, still not the right tool for AI Runtime identity. This milestone has no more reason to import it than X.14 did. |

---

## 6. Risk Register

| Risk | Category | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **Wiring authorization with the default always-anonymous resolver provides a false sense of security.** If every unauthenticated caller resolves to the *same* `anonymous` principal, `runAuthorizedConversationTurn()`'s session-ownership check compares `anonymous` against `anonymous` for every request and **never rejects anything** — the session-hijack gap named in `POST_X14_ARCHITECTURE_AUDIT.md` §7 would remain fully open even after this milestone ships, while the codebase would *look* protected. | Security / Architectural | **High** — this is the exact vulnerability X.15 exists to close | **Medium** — an easy mistake to make when "just wiring existing code" | Explicitly decide, before coding: either (a) add the one small request-resolver file (§4) with a caller-distinguishing signal (even a non-cryptographic one, honestly labeled as accidental-collision protection only, not adversarial-attacker protection), or (b) explicitly re-scope this milestone's authorization half to ship *together* with X.16's credential verification, and land recovery-wiring alone in the interim. **This is the central open question this plan surfaces rather than resolves — see §9.** |
| `main.ts` has never been modified since its X.9.1 freeze — no "wiring only" precedent exists for it specifically (unlike `httpServer.ts`, used 3 times) | Architectural | Low (mechanically trivial) | Certain, if this path is chosen | Prefer wiring the recovery scan via `deployment/deploy.sh` (already an operational script, already sequences validate→build→wait→smoke) or the existing `scripts/recoveryScan.ts` CLI run as a pre-boot step, avoiding `main.ts` entirely. If `main.ts` must be touched, treat it as a new, explicit carve-out decision, not an assumed extension of the `httpServer.ts` precedent. |
| Dependency direction | Architectural | None found | N/A | `api → identity`, `api → runtime/recovery` are new edges but both downward; verified against the existing graph (§2/§3) |
| Circular import | Dependency | None found | N/A | `identity`/`recovery` confirmed (by their own frozen architecture guards) to import nothing from `api`/`server` |
| Extra DB round-trip per conversation turn (session-identity lookup + optional recovery-marker write) | Performance | Low-Medium | Low at current scale | Memory-backed repos (the current `httpServer.ts` default) add no real latency; a Prisma-backed deployment adds one indexed lookup — acceptable at the 100–1,000-user scale this platform is actually ready for (per the architecture audit's §6) |
| No integration test yet exercises the *real* `buildHttpServer()` with authorization attached — X.14's own route-authorization tests used a throwaway Fastify instance, not the production server | Testing | Medium | Certain unless addressed | New integration test required as part of this milestone (§7) — a real gap, not hypothetical |
| Recovery producer (`runRecoverableConversationTurn`) and authorization wrapper (`runAuthorizedConversationTurn`) are siblings, not composed — wiring both into the same route requires either nesting one inside the other or calling both, and no existing code demonstrates the correct composition order | Architectural | Medium | Certain | Resolve explicitly during implementation: recommended order is authorize first (fail fast, never create a recovery marker for a request that was never going to be allowed), then the recoverable turn. This composition itself is a small, new piece of glue logic that lives in `conversationRoutes.ts`'s handler, not a new file. |
| Deployment: if `deploy.sh` gains a recovery-scan step, its own smoke tests must still pass unchanged | Deployment | Low | Low | Additive step only; existing `deployment/deploy.sh` architecture guard (X.9.5) already verifies script structure and would catch an accidental removal |
| Migration | Migration | None | N/A | No new Prisma model needed; both required tables already exist from X.13/X.14 |

---

## 7. Effort Estimate

**Easiest wins (low complexity, low risk, high ROI):**
- Wire `runStartupRecoveryScan()` via `deployment/deploy.sh` (not `main.ts`) — a few lines in an
  operational script, zero application-code risk.
- Construct `ISessionIdentityRepository`/`IRecoveryRepository` in `httpServer.ts` — mechanical,
  identical shape to the existing `RuntimeContext` construction already there.

**Medium:**
- Modify `conversationRoutes.ts` to call `runAuthorizedConversationTurn()` (and optionally
  `runRecoverableConversationTurn()`) instead of `runConversationTurn()` directly, including the
  authorize-then-recover composition decision (§6).
- Write the new integration test suite against the *real* `buildHttpServer()` (not a throwaway
  instance) proving 403-on-denial / 200-on-grant end-to-end.
- Decide and implement (or explicitly defer) the request→`Principal` resolver (§4/§6).

**Difficult:**
- None identified for this milestone's actual scope. (Exactly-once recovery semantics and
  optimistic locking — audit §4 MEDIUM items — are explicitly NOT part of this wiring milestone
  and would be their own, harder, future work.)

**Estimated footprint** (a range, since §6's open question changes the exact count):

| | Low estimate (resolver deferred to X.16) | High estimate (resolver included) |
|---|---|---|
| Files added | 0 | 1 (`httpPrincipalResolver.ts`) |
| Files modified | 3 (`conversationRoutes.ts`, `httpServer.ts`, `deployment/deploy.sh`) | 4 (+ same 3, resolver is new not modified) |
| Unit tests added | 0–2 | 4–6 (resolver behavior) |
| Integration tests added | 4–6 (real-server 403/200/session-ownership/recovery-on-restart) | 6–8 (+ resolver-specific request parsing) |
| Architecture guard tests added | 1 (new X.15 guard, mirroring every prior milestone's own dedicated guard file) | 1 |

---

## 8. Recommended Implementation Order

Presented as a sequence a *future, separately-authorized* milestone would follow — nothing here
is started by this plan.

**Step 1 — Recovery scan wiring (deployment, not application code)**
- **Purpose:** make crash recovery actually run without touching frozen application code.
- **Dependencies:** none beyond what X.13 already built.
- **Expected git footprint:** 1 file modified (`deployment/deploy.sh`), possibly 1 new test
  (`deployment/deploy.sh`'s own architecture guard extended, or a new smoke-test assertion).
- **Verification:** `tsc --noEmit`; the existing X.9.5 deployment architecture guard still
  passes; a live invocation of `scripts/recoveryScan.ts` against a real DB (once available,
  audit §4/§8 item X.17) confirms real behavior.
- **Rollback point:** the commit immediately before this step — a one-file, additive diff, safe
  to revert in isolation.

**Step 2 — `httpServer.ts` construction wiring**
- **Purpose:** make `ISessionIdentityRepository`/`IRecoveryRepository` available to routes,
  mirroring the existing `RuntimeContext` construction pattern exactly.
- **Dependencies:** Step 1 not required first, but logically related.
- **Expected git footprint:** 1 file modified (`httpServer.ts`), a handful of new lines,
  following the *exact* X.9.2/X.9.3/X.12 "wiring only" precedent.
- **Verification:** `tsc --noEmit`; existing `httpServer.ts`-touching architecture guards
  (X.9.4's, X.11's, X.12's) re-run to confirm no regression in their own assertions.
- **Rollback point:** commit before this step.

**Step 3 — Resolve the open design question (§6)**
- **Purpose:** decide, explicitly and in writing (an ADR or milestone-scoping note), whether
  X.15 ships a minimal caller-distinguishing resolver or explicitly defers real protection to
  X.16.
- **Dependencies:** must happen before Step 4 — this is a scope decision, not code.
- **Expected git footprint:** 0 files (a decision), or 1 new file if the resolver is chosen
  (§4).
- **Verification:** N/A (decision step) or standard unit tests if code results.
- **Rollback point:** N/A.

**Step 4 — `conversationRoutes.ts` wiring**
- **Purpose:** the actual authorization + recovery-producer enforcement on the write path.
- **Dependencies:** Steps 2 and 3.
- **Expected git footprint:** 1 file modified (`conversationRoutes.ts`), 1 new integration test
  file, 1 new/extended architecture guard.
- **Verification:** `tsc --noEmit`; new integration tests (real `buildHttpServer()`, 403/200/
  ownership); full repository suite; architecture guard confirming every other frozen file
  remains byte-for-byte unchanged (the same discipline every prior milestone's freeze used).
- **Rollback point:** commit before this step — isolated to one route file plus new tests.

**Step 5 — Freeze**
- **Purpose:** report, governance doc update, tag, matching this project's own established
  freeze discipline exactly.
- **Dependencies:** Steps 1–4 all green.
- **Expected git footprint:** report + `CURRENT_MILESTONE.md`/`MILESTONE_HISTORY.md`, committed
  per component, following the identical pattern of every X.9–X.14 freeze.
- **Verification:** full suite, `tsc --noEmit`, architecture guard, `git diff --stat` against
  every frozen directory.
- **Rollback point:** the last commit of Step 4, before the freeze commit(s).

---

## 9. Final Recommendation

## B. Minor architectural adjustment before coding.

**Not A**, because proceeding directly to implementation with the *implicit* assumption that
"wiring X.14's authorization in" automatically closes the session-hijack gap named in the
architecture audit would be a real mistake, not a hypothetical one (§6's top risk): with the
current default `PrincipalResolver`, every caller is the same `anonymous` principal, and the
ownership check this milestone exists to enforce would silently never fire. Shipping that would
be worse than not shipping — it would convert a documented, honest gap into an undocumented,
false sense of security, which is precisely the failure mode this entire project has avoided for
fourteen consecutive phases.

**Not C**, because nothing in this plan's inspection found a structural problem. Every piece
needed already exists, correctly designed, exactly where the X.13/X.14 freeze reports said a
future milestone would find it. The dependency graph has zero violations. The "adjustment"
needed is a **scope decision** (§6/§8 Step 3: does X.15 include a minimal identity-distinguishing
resolver, or does it explicitly defer real session protection to X.16?), not a design change to
any existing module.

**The adjustment, concretely:** before writing any code, decide and record (as a short scoping
note, or a formal ADR if the project's own governance discipline calls for one at this weight)
which of the following X.15 actually is:

- **X.15a** — recovery-wiring only, plus authorization-wiring with the anonymous-only default,
  *explicitly documented as providing no additional session protection yet* (honest, safe, but
  the audit's HIGH-severity finding remains open until X.16); or
- **X.15b** — recovery-wiring plus authorization-wiring plus the one small resolver file (§4),
  providing *accidental*-collision protection now and full protection once X.16 lands; or
- **X.15c** — recovery-wiring now, defer all authorization-wiring until it can ship together
  with X.16's real credential verification, closing the gap in one milestone instead of two.

Each is a legitimate, additive, non-redesigning choice within the current architecture — this is
why the recommendation is **B**, not **C**. But choosing among them is a product/security
decision this plan deliberately does not make on its own authority.

---

*End of plan. No source code was modified. No tests were modified. No commits were created. No
branches or tags were created. No milestone document was updated. Phase X.15 was not started.*
