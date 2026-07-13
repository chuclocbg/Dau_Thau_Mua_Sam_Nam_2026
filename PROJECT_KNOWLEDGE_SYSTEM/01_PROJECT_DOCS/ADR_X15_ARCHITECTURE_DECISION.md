# ADR: Phase X.15 Architecture Decision — Authorization Wiring + Recovery Scan Wiring

**Status:** REVISED (twice) — Governance Exceptions section (below) formally adopted per
`X15_GOVERNANCE_IMPACT_ASSESSMENT.md`'s Recommendation B, approved 2026-07-13 (GX-001/002/003).
**Amended again 2026-07-13** to add GX-004, a governance exception discovered during Phase X.16
Step 1 implementation (adding `src/api/credentialToken.ts` broke the X.15 architecture guard's own
`src/api/` file-count assertion) — user-directed, same-day, documented in this same Governance
Exceptions section for a single canonical ledger of every GX-numbered exception rather than
fragmenting them across documents. Still not yet ratified into `.memory/decision-index.md`
(ratification is a separate governance action, out of scope for this document per its own
instructions).
**Date:** 2026-07-13 (original decision); revised 2026-07-13 (GX-001/002/003 added); amended
2026-07-13 (GX-004 added).
**Inputs re-read in full for this decision:** `POST_X14_ARCHITECTURE_AUDIT.md`,
`PHASE_X15_IMPLEMENTATION_PLAN.md`. For the GX-001/002/003 revision: `X15_GOVERNANCE_IMPACT_ASSESSMENT.md`
in full. For the GX-004 amendment: `X16_PROTOCOL_DECISION.md`, `X16_SCOPING_REPORT.md`, and the
actual current content of `src/api/credentialToken.ts` and
`x15-authorization-wiring-architecture.test.ts`, re-read directly this session. No new
repository-wide analysis was performed beyond what these documents already establish.
**Affects:** `src/api/conversationRoutes.ts`, `src/server/httpServer.ts`, `deployment/deploy.sh`,
plus four literal assertions across three frozen architecture-guard test files:
`x12-http-entry-architecture.test.ts` (X.12), `x13-recovery-architecture-guard.test.ts` (X.13),
`x14-identity-architecture-guard.test.ts` (X.14), and `x15-authorization-wiring-architecture.test.ts`
(X.15, GX-004). Additionally, GX-004's own trigger: the new file `src/api/credentialToken.ts`
(Phase X.16 Step 1).
**Does not affect:** any file in `src/reasoning/`, `src/mcp/`, `src/multiagent/`,
`src/runtime/conversationEntryOrchestrator.ts`, `src/runtime/recovery/*.ts`,
`src/identity/application/*.ts` (all reused, none modified), `src/server/main.ts`,
`prisma/schema.prisma`. The revision changes no implementation file — only test-assertion
literals in the three guard files named above.

---

## Context

`PHASE_X15_IMPLEMENTATION_PLAN.md` identified one open architectural question (§6/§9) that
implementation could not proceed without resolving: wiring `runAuthorizedConversationTurn()`
with its default `resolvePrincipal` (always `buildAnonymousContext()`) would make every caller
the *same* principal, so the session-ownership check would never fire — converting a documented,
honest gap into an undocumented, false sense of security.

Re-reading the plan for this decision surfaced a **second issue the plan named but did not fully
resolve** (§3: "Recovery and Identity are uncomposed siblings"; §6: "no existing code
demonstrates the correct composition order"): `runAuthorizedConversationTurn()` (X.14) and
`runRecoverableConversationTurn()` (X.13) each independently wrap `runConversationTurn()`
directly. Neither accepts an injectable inner call. **They cannot both wrap the same single turn
attempt without either (a) modifying a frozen X.13 or X.14 file to expose a composable
primitive, or (b) duplicating one wrapper's internal logic (session-ownership comparison, or
marker bookkeeping) outside a clean interface.** This decision resolves both issues together,
since the second one changes what "wire recovery" can honestly mean this milestone.

---

## Decision

### Chosen architecture

1. **Authorization is wired into the live write path, using `runAuthorizedConversationTurn()`
   exactly as X.14 built it — reused verbatim, zero duplication, zero modification.**
2. **A new, minimal, explicitly-non-cryptographic principal resolver is added** so that
   authorization actually distinguishes callers instead of collapsing everyone into the same
   `anonymous` principal (this was the plan's original open question — resolved as **"X.15b"**
   from the plan's three named options).
3. **The recovery *scan* (`runStartupRecoveryScan()`) is wired into the deployment sequence**
   (`deployment/deploy.sh`), proving the capability is genuinely invokable — **not** into
   `main.ts`.
4. **The recovery *producer* (`runRecoverableConversationTurn()`) is explicitly NOT wired into
   `conversationRoutes.ts` this milestone.** Composing it with authorization around one turn
   requires duplicating security-sensitive logic or modifying frozen code — both rejected (see
   Alternatives). X.15 therefore closes the HIGH-severity security gap in full, and makes the
   recovery scan provably reachable, while being honest that **end-to-end crash recovery for
   real HTTP traffic remains a named, deferred follow-up**, not a silent omission.

### Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **Ship authorization wiring with the default always-anonymous resolver (plan's "X.15a")** | Every caller would be the same principal; the ownership check would never fire; the exact vulnerability this milestone exists to close would remain open while the code *looked* fixed. This is the one outcome worse than not shipping at all. |
| **Defer all authorization wiring to X.16 (plan's "X.15c")** | Leaves the HIGH-severity, already-shipped session-hijack gap open for an entire additional milestone for no technical reason — the ownership-check and a real distinguishing signal (even non-cryptographic) are both available *now*. Unjustifiable delay. |
| **Compose `runAuthorizedConversationTurn()` and `runRecoverableConversationTurn()` by inlining the ownership-check logic (~10 lines) into `conversationRoutes.ts` and calling the recovery producer as the outer wrapper instead** | Duplicates *security-sensitive* comparison logic (`existingBinding.principalId !== auth.principal.id && !hasAllScope(...)`) outside the one place it's currently correct and tested. This project's own precedent for accepted duplication (X.11's token estimate, X.14's wildcard matcher) is limited to *trivial, non-security-bearing* utilities — a session-ownership check is not that. Rejected. |
| **Compose them by inlining recovery-marker bookkeeping (~10–15 lines) around a call to `runAuthorizedConversationTurn()` instead** | Smaller-severity duplication than the alternative above, but still a second, parallel implementation of `runRecoverableConversationTurn()`'s own create/complete/fail pattern, maintained in two places. Rejected in favor of not duplicating either wrapper at all. |
| **Modify `runAuthorizedConversationTurn()` or `runRecoverableConversationTurn()` to accept an injectable inner call, enabling clean composition** | The correct *long-term* fix, but it modifies a frozen X.13 or X.14 file — explicitly forbidden by this milestone's own boundary (§ below) and not something this ADR can authorize unilaterally. Named as the recommended follow-up, not adopted now. |
| **Wire the recovery scan into `main.ts` directly** | `main.ts` has never been modified since its X.9.1 freeze — no "wiring only" precedent exists for it specifically (unlike `httpServer.ts`, extended three times). `deployment/deploy.sh` already sequences validate→build→wait→smoke and is designed to be extended. Lower risk, same outcome, zero precedent needed. |

### Rationale

The security gap (session hijack via an unauthorized, unauthenticated `sessionId`) is the single
HIGH-severity, already-exploitable finding across both input documents. Closing it in full,
correctly, with zero duplication, is more valuable than closing it *and* partially wiring
recovery *badly* (via duplicated logic) in the same milestone. Recovery-scan wiring is still
real, independent value (the scan capability becomes provably invokable, and — importantly — if
a *future* milestone adds markers through any other path, e.g. `scripts/recoveryScan.ts` run
against manually-inserted markers, or a later producer-wiring milestone, the scan is already in
place to consume them). Nothing here reopens a closed decision from X.13 or X.14; both remain
frozen and untouched.

---

## Expected Dependency Graph

```
Phase X.15 (revised scope)
   ↓
existing modules reused, unmodified:
   src/identity/application/runtimeAuthorization.ts       (X.14 — called as-is)
   src/identity/application/authenticationContext.ts      (X.14 — buildUserContext/buildAnonymousContext reused)
   src/identity/application/authorizationEvaluator.ts     (X.14 — not directly called by the route; used internally by runAuthorizedConversationTurn)
   src/identity/infrastructure/sessionIdentityRepository.ts (X.14 — memory-backed instance constructed in httpServer.ts)
   src/runtime/recovery/runtimeRecoveryManager.ts          (X.13 — called only from scripts/recoveryScan.ts, unchanged)
   src/runtime/conversationEntryOrchestrator.ts, runtimeContext.ts  (X.11 — called only via runAuthorizedConversationTurn, never directly)
   ↓
new modules required:
   src/api/httpPrincipalResolver.ts   (ONE new file — see Implementation Note: Resolver Location)
   ↓
affected runtime:
   NONE. src/runtime/ is not modified. RuntimeContext's shape is unchanged.
   ↓
affected APIs:
   src/api/conversationRoutes.ts   — MODIFIED (calls runAuthorizedConversationTurn() instead of
                                      runConversationTurn(); adds principal resolution)
   src/server/httpServer.ts        — MODIFIED (constructs ISessionIdentityRepository, passes it
                                      and a principal resolver into registerConversationRoutes())
   ↓
affected persistence:
   NONE. No schema change. No new migration. SessionIdentityBinding already exists (X.14).
   ↓
affected authentication:
   A caller-supplied, UNVERIFIED `x-client-id` header now distinguishes callers if present;
   absent header = today's exact anonymous behavior, unchanged. Explicitly NOT authentication —
   see Acceptance Criteria for the required documentation of this boundary.
   ↓
affected MCP:
   NONE.
   ↓
affected multi-agent:
   NONE. coordinatorRoutes.ts untouched.
   ↓
affected recovery:
   Scan wiring only (deployment/deploy.sh). Producer wiring explicitly deferred (see Decision).
   src/runtime/recovery/*.ts remains entirely unmodified; recoveryRepository is constructed only
   inside scripts/recoveryScan.ts (already true today, X.13) — httpServer.ts does NOT construct
   an IRecoveryRepository, since nothing in the HTTP path needs one under this decision.
```

**No layering violation.** `api → identity` is the only new edge, and it points downward into an
already-lower layer (confirmed in both input documents). No file in `identity/` or `runtime/`
gains a new import in either direction.

---

## Affected Runtime Flow

Unchanged. `runConversationTurn()` (X.11) is reached exactly as before — through
`runAuthorizedConversationTurn()`'s own internal call, itself unmodified. No new code sits
between HTTP and the reasoning core except the authorization check itself.

## Affected Authorization Flow

**Before this ADR:** every request is anonymous; `runAuthorizedConversationTurn()` exists but is
never called; `conversationRoutes.ts` calls `runConversationTurn()` directly.

**After this ADR:**
1. Request arrives at `POST /api/v1/conversation/turn`.
2. Body is parsed (unchanged `parseConversationTurnBody`).
3. `httpPrincipalResolver.ts`'s resolver reads the `x-client-id` header. Present + non-empty →
   `buildUserContext(clientId)`. Absent → `buildAnonymousContext()` (X.14, both reused verbatim).
4. `runAuthorizedConversationTurn(auth, sessionIdentityRepository, runtime, parsedBody)` (X.14,
   reused verbatim) is called. Internally: checks `conversation:ask:OWN`; if a `sessionId` was
   supplied, checks/enforces ownership; calls `runConversationTurn()`; binds a new session's
   identity on first use.
5. `authorized: false` → HTTP 403 with the decision's `reason`. `authorized: true` → HTTP 200
   with the result, exactly as today.

## Affected Recovery Flow

**Before this ADR:** `runStartupRecoveryScan()` exists, tested, never invoked by anything except
its own tests and `scripts/recoveryScan.ts` (itself never invoked in a real deployment).

**After this ADR:** `deployment/deploy.sh` invokes `scripts/recoveryScan.ts` as an additional
step (exact placement: after `wait-for-ready`, before the deployment is considered complete —
implementation detail for the future milestone, not fixed by this ADR). No marker will exist to
recover yet (producer wiring is deferred), so the scan will report `scanned: 0` in practice until
a future milestone wires the producer — this is expected and must be stated plainly in that
milestone's own report, not presented as if recovery were fully operational.

---

## Implementation Note: Resolver Location (clarification, not a redesign)

During implementation, placing the new resolver at the ADR's originally-stated path
(`src/identity/application/httpPrincipalResolver.ts`) was found to break an already-frozen X.14
test: `x14-identity-architecture-guard.test.ts`'s own "`src/identity/` has exactly the 10
expected files" assertion recurses the whole `src/identity/` tree (unlike X.11's non-recursive
equivalent, which X.13's subdirectory placement was able to sidestep), so no subdirectory of
`src/identity/` avoids it either.

**Approved resolution:** the file lives at **`src/api/httpPrincipalResolver.ts`** instead —
beside `conversationRoutes.ts`, a file this ADR already authorizes changing. This is an
implementation-location clarification only:

- Same responsibility (HTTP request → `AuthenticationContext` bridge).
- Same reuse (`buildUserContext`/`buildAnonymousContext` from `identity/application/
  authenticationContext.ts`, X.14, unmodified).
- Same dependency graph (`src/api/` → `src/identity/` was already the one new edge this ADR
  introduces; this only fixes which file embodies it).
- Zero frozen file touched, zero frozen test modified.

"Files allowed to change"/"new modules required" below should be read with this corrected path;
the rest of this ADR's Decision, Dependency Graph, and Flows sections are otherwise unchanged.

---

## Governance Exceptions

**GX-001/002/003 added by the original revision, per `X15_GOVERNANCE_IMPACT_ASSESSMENT.md`'s
Recommendation B.** During implementation, extending `conversationRoutes.ts`/`httpServer.ts` as
this ADR authorizes broke literal content assertions in three already-frozen architecture-guard
test files across three prior milestones (X.12, X.13, X.14). Each is formally adopted here as a
named governance exception (GX-NNN) rather than fixed ad hoc, per the impact assessment's own
finding that these three breaks share one root cause (see "Why These Are Governance Exceptions,
Not Implementation Bugs" below), not three unrelated coincidences.

**GX-004 added by a later, same-day amendment.** During Phase X.16 Step 1 (building the
stdlib-only HMAC credential-verification primitive per `X16_PROTOCOL_DECISION.md`), adding the new
file `src/api/credentialToken.ts` broke a fourth assertion — this time in the **X.15 guard itself**
(`x15-authorization-wiring-architecture.test.ts`'s own `src/api/` exhaustive file-count check), a
sibling problem to GX-001/002/003 (an exhaustive-snapshot assertion over something this project's
own convention treats as additively extensible) but with a distinct trigger (a new milestone,
X.16, not X.15's own wiring) and a distinct assertion shape (file enumeration, not a call-site
literal). Documented here rather than in a separate X.16 document specifically so every GX
exception remains discoverable from one canonical ledger.

### GX-001 — `x12-http-entry-architecture.test.ts` (X.12)

- **Affected assertions:** (a) `expect(content).toMatch(/import \{ runConversationTurn \} from/)`
  — the guard's own required import literal for `conversationRoutes.ts`; (b)
  `expect(content).toContain('registerConversationRoutes(server, runtime)')` — the guard's
  required call-site literal for `httpServer.ts`.
- **Rationale:** `conversationRoutes.ts` now calls `runAuthorizedConversationTurn()` (X.14)
  instead of calling `runConversationTurn()` (X.11) directly, and `httpServer.ts` now passes a
  third argument (`sessionIdentityRepository`) to `registerConversationRoutes()`. Both changes
  are exactly what this ADR's Decision section authorizes; the guard's literal was written
  against the pre-X.15 call shape and had no way to anticipate it.
- **Fix applied:** the import-literal assertion now matches `runAuthorizedConversationTurn`
  (still asserting exactly one permitted orchestration entry point, still forbidding every direct
  reasoning/session import the original guard forbade); the call-site literal now matches
  `registerConversationRoutes(server, runtime, sessionIdentityRepository)`. Both `it()` titles
  updated to name the new, correct expectation instead of the old one.
- **Status:** approved and applied (this exception was identified and fixed during initial X.15
  implementation, before the governance-impact review that found GX-002/GX-003).

### GX-002 — `x13-recovery-architecture-guard.test.ts` (X.13)

- **Affected assertion:** `expect(readRaw('src/server/httpServer.ts')).toMatch(/registerConversationRoutes\(server, runtime\)/)`,
  inside `it('every Phase X.12 HTTP entry file is byte-for-byte unmodified', ...)`.
- **Rationale:** identical root cause to GX-001 — an exact-substring call-site literal, written
  by a *different* milestone (X.13) re-verifying the *same* fact about the *same* file
  (`httpServer.ts` still calls `registerConversationRoutes()`), broken by the same,
  ADR-authorized third argument.
- **Fix applied:** the exact-substring match is replaced with a name+open-paren presence check
  (`.toContain('registerConversationRoutes(')`), matching the robust style
  `x9.2-observability-architecture.test.ts` / `x93-streaming-architecture.test.ts` /
  `x94-docker-config-architecture.test.ts` already established for verifying the same class of
  fact about the same file (see "Future Guard-Writing Guidance" below) — robust to this and any
  future additive-argument extension, while still failing if `registerConversationRoutes(` were
  ever removed or renamed outright. The `it()` title is updated from "is byte-for-byte
  unmodified" (already inaccurate — X.15 is a newly-approved milestone explicitly permitted to
  extend this file, per `CURRENT_MILESTONE.md`'s own X.12 update note) to "still carries its
  expected marker, extended (not redesigned) by later milestones."
- **Status:** approved by this revision; applied together with this ADR update.

### GX-003 — `x14-identity-architecture-guard.test.ts` (X.14)

- **Affected assertion:**
  ```
  it('routeAuthorization.ts is never imported by src/server/httpServer.ts or
     src/api/conversationRoutes.ts -- a complete but NOT-yet-wired capability', () => {
    expect(readRaw('src/server/httpServer.ts')).not.toMatch(/identity/)
    expect(readRaw('src/api/conversationRoutes.ts')).not.toMatch(/identity/)
  })
  ```
- **Rationale:** the `it()` title states a narrow, still-true claim — `routeAuthorization.ts`
  (the Fastify preHandler-hook builder) is not imported by either file, and this ADR does not
  wire it in; route-level gating remains a distinct, separately-deferrable capability from the
  runtime-level authorization this ADR does wire in. But the *implementation* of that assertion
  encoded a broader, now-obsolete fact — "nothing under `src/identity/` is referenced by either
  file at all" — which this ADR's whole purpose is to make false. The assertion was over-broad
  relative to its own stated intent from the moment it was written; X.15 is simply the first
  milestone to exercise the gap between the title and the code.
- **Fix applied:** narrow the regex from `/identity/` (matches any reference to the `identity`
  module) to `/routeAuthorization/` (matches only what the title actually claims). This is a
  **narrower**, not weaker, assertion: it continues to fail if `routeAuthorization.ts` is ever
  imported by either file, which remains the one true fact this test exists to protect — nothing
  about route-level Fastify gating changes in this milestone. The `it()` title is unchanged
  (it already correctly described the narrowed check).
- **Status:** approved by this revision; applied together with this ADR update.

### GX-004 — `x15-authorization-wiring-architecture.test.ts` (X.15, broken by Phase X.16)

- **Affected assertion:**
  ```
  it('src/api/ gained exactly one new file (httpPrincipalResolver.ts), no other scope creep', () => {
    const apiFiles = listTsFiles('src/api').map(f => f.split(/[\\/]/).pop())
    expect(apiFiles.sort()).toEqual([
      'conversationRoutes.ts', 'coordinatorRoutes.ts', 'httpPrincipalResolver.ts', 'reasoningRoutes.ts',
    ])
  })
  ```
- **Trigger:** Phase X.16 Step 1 (per `X16_PROTOCOL_DECISION.md`, Option A — stdlib-only HMAC
  bearer token) added `src/api/credentialToken.ts`, a new, standalone, zero-dependency module
  exporting `signToken()`/`verifyToken()` — pure functions, no imports from `src/identity/`,
  `src/auth/`, or any other Phase-X module, and (by design, per `X16_SCOPING_REPORT.md` §5 Step 2)
  **not yet imported by anything** — the primitive is built and unit-tested in isolation before
  any wiring step. Adding this fifth file to `src/api/` makes the exact 4-file array above fail.
- **Rationale — why this is a governance exception, distinct in kind from GX-001/002/003 but the
  same underlying class of problem:** GX-001/002/003 were brittle *call-site/import literal*
  assertions over two files `httpServer.ts`'s own header comment had already documented as
  "wired once, extended repeatedly." This is a brittle *exhaustive file-count* assertion over a
  *directory* — `src/api/` — that this project's own history already shows is not closed either:
  X.12 added `conversationRoutes.ts` to a directory that previously held only
  `reasoningRoutes.ts`/`coordinatorRoutes.ts`; X.15 itself added `httpPrincipalResolver.ts`
  alongside it. The guard's own `it()` title ("gained exactly one new file... no other scope
  creep") was written to prove *X.15's own* addition was singular and complete — a true,
  correctly-scoped claim **at X.15's own freeze time**. It was never a claim that `src/api/`
  would never receive another file from any future milestone; X.16 is simply the first milestone
  since to add one.
- **Fix applied:** append `'credentialToken.ts'` to the expected, sorted array — the assertion
  remains an **exact array-equality check**, not loosened to a "contains" or "at-least" check.
  Any unexpected sixth file (or any renamed/removed expected file) still fails this test exactly
  as before. This is the identical minimal-literal-update discipline GX-001/GX-002 already used
  for their own call-site literals, applied here to a file-count literal instead.
- **Status:** approved by this decision (user-directed, 2026-07-13); applied together with this
  ADR update and Phase X.16 Step 1's commit.

#### Why `credentialToken.ts` Is a Legitimate Architectural Addition

- It implements exactly the one capability `X16_PROTOCOL_DECISION.md` §1 decided on (stdlib-only
  HMAC bearer token verification) and exactly the one new module `X16_PROTOCOL_DECISION.md` §3/§4
  named as required — this is not scope creep, it is the planned, decided deliverable.
- It is co-located in `src/api/` (beside `httpPrincipalResolver.ts`) for the same reason
  `httpPrincipalResolver.ts` itself was relocated out of `src/identity/` at X.15: placing it under
  `src/identity/` would trip that module's own recursive "exactly 10 files" guard
  (`x14-identity-architecture-guard.test.ts`), which is frozen and must not be modified for this
  purpose. `src/api/` is therefore the correct, precedent-following location, not an arbitrary
  choice.
- It is a pure, dependency-free module (`node:crypto` only, part of the Node.js standard library,
  not a new `package.json` dependency) — re-confirmed by this session's own unit test run (13/13
  passing) and `tsc --noEmit` (clean) before this guard conflict was even discovered.

#### Why the Existing Frozen Guard Is Now Too Restrictive

The guard's exhaustive 4-file array was correct and complete *as a snapshot of X.15's own diff*,
but an exhaustive enumeration is, by construction, unable to distinguish "an unexpected,
unauthorized file appeared" from "an authorized future milestone added its own planned file" —
both look identical to an `toEqual()` array check. The assertion's *title* ("no other scope
creep") already implies its true scope was point-in-time, not permanent; nothing in
`ADR_X15_ARCHITECTURE_DECISION.md`'s original text claimed `src/api/`'s file count was frozen for
all future milestones, only that X.15 itself added exactly one file. GX-004 corrects the literal
to match a second, subsequently-authorized addition — the same category of correction GX-001/
GX-002 already made for call-site literals.

#### Why This Is Not a Layering Violation

`credentialToken.ts` imports only `node:crypto` (Node's standard library) — zero imports from
`src/identity/`, `src/auth/`, `src/runtime/`, `src/reasoning/`, or any other Phase-X module in
either direction, confirmed by direct read of the file. No dependency-direction assertion in
`x15-authorization-wiring-architecture.test.ts` (or any other guard) references this file's
imports, and none needed to change — only the plain file-count enumeration did. The one edge this
file will eventually participate in (`httpPrincipalResolver.ts` importing `verifyToken()` from it,
at a later Step 3 wiring step) is a same-directory, same-layer reference, not a new edge between
layers.

#### Why This Does Not Weaken the Security Model

This exception touches a **test literal**, not any security-relevant code or check.
`evaluateAuthorization()`, `runAuthorizedConversationTurn()`, and every other X.14 authorization
primitive are byte-for-byte unmodified (re-confirmed: none of GX-004's diff touches anything
outside the single test file). `credentialToken.ts` itself is not yet reachable from any HTTP
path — it has no security surface to weaken *yet*; its security properties (constant-time
signature comparison, mandatory expiry) are enforced by its own unit tests (§6 of
`X16_PROTOCOL_DECISION.md`'s Acceptance Criteria) and were verified passing before this guard
conflict was discovered. Widening a file-count array is definitionally not capable of weakening a
security *check* — no `expect(...).not.toMatch(...)`-style negative assertion was touched by this
exception, only a positive enumeration.

#### Rollback Implications, GX-004 specifically

- **Fully independent of GX-001/002/003's own rollback boundary.** GX-004 is layered on top of
  the already-frozen X.15 milestone (commit `512b761` and everything since), not on top of X.15's
  own original wiring — reverting GX-004 and `credentialToken.ts` together (a single, self-
  contained commit per this session's own "keep commits small and self-contained" instruction)
  cleanly restores the guard to its pre-X.16 exact-4-file assertion, with zero entanglement in
  X.15's own already-frozen authorization wiring.
- **No data/schema implication.** `credentialToken.ts` is pure source code; no migration, no
  config, no environment variable is introduced at this step (the signing secret's config wiring
  is a later, separate step per `X16_SCOPING_REPORT.md` §5 Step 3).
- **If Phase X.16 is rolled back entirely** in the future, this guard's array reverts to its
  pre-GX-004, 4-file form automatically as part of reverting the commit that added both
  `credentialToken.ts` and this exception together — matching the same "one commit, one clean
  revert boundary" property GX-001/002/003 already established.

### Why These Are Governance Exceptions, Not Implementation Bugs (GX-001/002/003)

*The equivalent explanation for GX-004 — a distinct assertion shape (file-count enumeration, not
a call-site literal) with a distinct trigger (Phase X.16, not X.15's own wiring) — is given in
full under GX-004's own entry above, not repeated here.*

None of the three affected assertions is a *dependency-boundary* or *layering* rule — every guard
asserting "api must not import identity/reasoning/mcp/multiagent internals directly" in all three
files still passes unmodified after this ADR's implementation. What broke is exclusively
**point-in-time content-literal snapshots** of two files (`conversationRoutes.ts`,
`httpServer.ts`) that this project's own established convention — visible in
`httpServer.ts`'s own header comment, which has carried a running "ADDITION" log since X.9.1 and
now names four consecutive rounds (X.9.2, X.9.3, X.12, X.15) — has *always* intended to be
extended repeatedly. `x9.2`/`x93`/`x94`'s own guards, verifying this exact same "extended, not
redesigned" fact for the same file, chose a presence-check style *already robust* to that
intended future extension. `x12`/`x13`/`x14`'s guards, verifying the same class of fact for the
first time on `conversationRoutes.ts` (and copying forward for `httpServer.ts`), independently
chose the brittle exact-substring style — an authoring-style inconsistency between two lineages
of guards, not a defect in the code the guards check. A bug would mean the implementation did
something the architecture forbids; nothing here does that — every dependency-direction and
business-logic-isolation assertion in all three guards still holds.

### Why the Underlying Architecture Remains Valid (GX-001/002/003)

- **Zero layering violations.** `src/api/` → `src/identity/` is a new edge, but it points
  downward into an already-lower layer, exactly like every prior "wiring" milestone
  (X.9.2, X.9.3, X.12). No file under `src/identity/` or `src/runtime/recovery/` gained a new
  import in either direction (their own frozen architecture guards, unmodified and unrun-against
  by this exception set, already prove this).
- **Zero behavioral regression.** `x12-conversation-http-integration.test.ts` — an unmodified,
  frozen X.12 *behavioral* test exercising the real server end-to-end — still passes fully against
  the new wiring, proving the change is additive in practice, not just in the diagram.
- **The three broken assertions are exclusively literal/stylistic**, never structural: each is
  fixed by either (a) updating a literal to match an ADR-authorized, additive code change (GX-001,
  GX-002), or (b) narrowing an over-broad regex to what its own `it()` title always claimed
  (GX-003). No guard's *forbidden-import* list, *dependency-direction* check, or *file-count*
  check needed any change.

### Rollback Implications (GX-001/002/003)

- **If X.15 is rolled back entirely** (revert to `x14-frozen` / commit `d1708ff`): all three guard
  files revert to their original, currently-frozen content automatically — no separate rollback
  step is needed for GX-001/GX-002/GX-003 specifically, since they are commits layered on top of
  the same revert boundary. `x12-http-entry-architecture.test.ts`, `x13-recovery-architecture-
  guard.test.ts`, and `x14-identity-architecture-guard.test.ts` all return to asserting the
  pre-X.15 shape, which will once again be true (since `conversationRoutes.ts`/`httpServer.ts`
  also revert).
- **If only the guard-literal commits are rolled back but the X.15 implementation is kept:** this
  is an unsupported, inconsistent intermediate state — the three guards would fail again exactly
  as `X15_GOVERNANCE_IMPACT_ASSESSMENT.md` found them. Rollback of GX-001/GX-002/GX-003 must
  always be paired with rollback of the `conversationRoutes.ts`/`httpServer.ts` changes that
  necessitated them, never done independently.
- **No data/schema rollback implication.** None of GX-001/GX-002/GX-003 touches `prisma/schema.prisma`
  or any migration; rollback is pure source-and-test-file reversion.
- **GX-004's own rollback profile is independent of the three above** (it sits on top of the
  already-frozen X.15 milestone, not inside it) — see "Rollback Implications, GX-004 specifically"
  under GX-004's own entry above.

### Future Guard-Writing Guidance (recommendation, not a mandate)

For any file matching this project's established "wired once, extended repeatedly" pattern
(`httpServer.ts` and `conversationRoutes.ts` today; any future file that joins that pattern, e.g.
at Phase X.16) — an architecture guard verifying "this file was extended additively, not
redesigned" should assert **function-name-plus-open-paren presence**
(`.toContain('registerX(')`), the style `x9.2-observability-architecture.test.ts`/
`x93-streaming-architecture.test.ts`/`x94-docker-config-architecture.test.ts` already use for the
same class of fact — **not** an exact-substring match of the full call site including its
argument list. This is a recommendation for whoever authors the next such guard (X.16's is
already known to touch these files again); it is **not** a retroactive rewrite of X.9.2/X.9.3/
X.9.4 (already correct, no change needed) and **not** an additional change to X.12/X.13/X.14
beyond the three literal corrections GX-001/GX-002/GX-003 already make.

**GX-004 is the first realized instance of this predicted X.16 collision** — though against an
exhaustive file-count enumeration rather than a call-site literal. GX-004 deliberately did **not**
loosen the assertion's style (it remains an exact, sorted array-equality check, per this
amendment's own explicit instruction to never weaken or broaden a guard) — it only appended the
one newly-authorized filename. The observation for future guard authors is narrower: an
exhaustive file-count assertion over a directory this project's own convention treats as
additively extensible (`src/api/` has now received a new file at X.12, X.15, and X.16) will need
this same kind of minimal, literal update at every future milestone that adds a file there, the
same way GX-001/GX-002's call-site literals will. That recurring maintenance cost is accepted, not
solved, by keeping the check exact — the alternative (a subset/"at-least-contains" check) would
stop requiring updates but would also stop catching an unexpected *extra* file, which is exactly
the detection property this amendment was instructed to preserve. No change to the guard's
strictness is recommended; only awareness that this particular assertion will recur.

## Implementation Boundaries

### Files allowed to change

- `src/api/conversationRoutes.ts`
- `src/server/httpServer.ts`
- `deployment/deploy.sh`
- New file: `src/api/httpPrincipalResolver.ts` (relocated from the ADR's original text — see
  "Implementation Note: Resolver Location" above)
- New test files under `src/__tests__/` for the above (unit + integration + one architecture
  guard, per the plan's §7 estimate)
- **Per this revision's Governance Exceptions:** `x12-http-entry-architecture.test.ts` (GX-001),
  `x13-recovery-architecture-guard.test.ts` (GX-002), `x14-identity-architecture-guard.test.ts`
  (GX-003) — literal assertion updates only, each scoped exactly as documented above: minimum
  literal changed, architectural intent re-verified and preserved, zero weakening of any
  dependency-boundary or business-logic-isolation check.
- **Per the GX-004 amendment (Phase X.16, not part of X.15's own original scope):**
  `x15-authorization-wiring-architecture.test.ts` — one appended filename in its `src/api/`
  file-count assertion, and the new file `src/api/credentialToken.ts` itself (X.16 Step 1's own
  deliverable, not an X.15 file). Listed here only so this ADR's boundary list stays complete and
  current; the file itself belongs to Phase X.16, tracked in full in `X16_SCOPING_REPORT.md`/
  `X16_PROTOCOL_DECISION.md`.

### Files that MUST remain untouched

- `src/runtime/conversationEntryOrchestrator.ts`, `runtimeContext.ts`, `conversationSession.ts`,
  `runtimeSessionBuilder.ts`, `sessionAttachments.ts` (X.11)
- `src/runtime/recovery/*.ts` — all six files (X.13)
- `src/identity/domain/identityTypes.ts`, `application/authorizationEvaluator.ts`,
  `application/authenticationContext.ts`, `application/runtimeAuthorization.ts`,
  `application/toolAuthorization.ts`, `application/mcpAuthorization.ts`,
  `application/routeAuthorization.ts`, `infrastructure/*.ts` (X.14)
- `src/api/reasoningRoutes.ts`, `src/api/coordinatorRoutes.ts` (X.9.1)
- `src/server/main.ts`, `src/startup/gracefulShutdown.ts` (X.9.1)
- `src/reasoning/`, `src/mcp/`, `src/multiagent/` in full (X.2–X.8)
- `src/persistence/`, `prisma/schema.prisma`, `prisma.config.ts` (Phase M1/X.10)
- `src/auth/` (Phase M1 — not part of this milestone's concern, per X.14's own finding)
- `scripts/recoveryScan.ts` (X.13 — invoked, not modified)

### Frozen milestones that MUST NOT be modified

X.1 through X.14 in full, with **zero carve-out** for this decision beyond the three files
explicitly listed above as allowed to change. This mirrors X.13's own "no carve-out" precedent
rather than the earlier X.9.2/X.9.3/X.12 pattern, deliberately: the allowed-file list here is
already narrow and explicit, so no ambiguous "wiring only" language is needed.

---

## Implementation Order

**Step 1 — `httpPrincipalResolver.ts`**
- **Purpose:** bridge an HTTP request to an `AuthenticationContext`, reusing X.14's factories.
- **Dependencies:** none.
- **Verification:** `tsc --noEmit`; new unit tests (header present/absent/empty cases); a new
  architecture-guard assertion confirming it imports only `buildUserContext`/
  `buildAnonymousContext` from `authenticationContext.ts` and nothing else new.
- **Rollback point:** the commit before this step (zero other file depends on it yet).

**Step 2 — `httpServer.ts` wiring**
- **Purpose:** construct `ISessionIdentityRepository`, pass it and the Step 1 resolver through to
  `registerConversationRoutes()`.
- **Dependencies:** Step 1.
- **Verification:** `tsc --noEmit`; every prior `httpServer.ts`-touching architecture guard
  (X.9.4, X.11, X.12) re-run to confirm their own assertions still hold; a new assertion
  confirming exactly one `buildMemorySessionIdentityRepository()` (or equivalent) call was added.
- **Rollback point:** commit before this step.

**Step 3 — `conversationRoutes.ts` wiring**
- **Purpose:** call `runAuthorizedConversationTurn()` instead of `runConversationTurn()`; map
  `authorized: false` to HTTP 403.
- **Dependencies:** Steps 1–2.
- **Verification:** `tsc --noEmit`; new integration tests against the *real* `buildHttpServer()`
  (not a throwaway instance) proving: 403 with no `x-client-id` attempting another principal's
  session, 200 for a matching/new session, 200 for an anonymous new session (regression check —
  today's behavior for a header-less caller must be unchanged); full repository suite; a new,
  dedicated X.15 architecture guard confirming every file in "Files that MUST remain untouched"
  is byte-for-byte unchanged (the same discipline every X.9–X.14 freeze used).
- **Rollback point:** commit before this step — isolated to one route file plus new tests.

**Step 4 — `deployment/deploy.sh` wiring**
- **Purpose:** make the recovery scan genuinely invokable as part of a real deployment sequence.
- **Dependencies:** none technically, but sequenced last so the higher-risk security work (Steps
  1–3) is validated first.
- **Verification:** `tsc --noEmit`; the existing X.9.5 deployment architecture guard re-run;
  `scripts/recoveryScan.ts` still runs standalone exactly as before (X.13 regression check).
- **Rollback point:** commit before this step — a one-file, additive diff.

**Step 5 — Freeze**
- **Purpose:** report + governance doc update + tag, matching every prior milestone's own
  freeze discipline.
- **Dependencies:** Steps 1–4 all green.
- **Verification:** full suite; `tsc --noEmit`; architecture guard; `git diff --stat` against
  every frozen directory, confirming the diff matches exactly the "Files allowed to change" list
  above and nothing else.
- **Rollback point:** the last commit of Step 4, before the freeze commit(s).

---

## Acceptance Criteria (required before X.15 can be frozen)

1. `tsc --noEmit` clean.
2. Full repository test suite: 0 failures (the same `TEST_DATABASE_URL`-skip exceptions as every
   prior freeze are acceptable; no new failures).
3. A dedicated X.15 architecture guard exists and passes, proving:
   - Every file in "Files that MUST remain untouched" (above) is byte-for-byte unchanged
     (marker-based check, matching the convention of every X.9–X.14 guard).
   - `src/api/conversationRoutes.ts` calls `runAuthorizedConversationTurn`, not
     `runConversationTurn`, directly.
   - `httpPrincipalResolver.ts` imports only `buildUserContext`/`buildAnonymousContext` from
     `identity/application/authenticationContext.ts` and nothing else from `src/identity/`.
   - `runRecoverableConversationTurn` is **not** imported anywhere under `src/api/` or
     `src/server/` (proving the deferred-producer decision was actually honored, not silently
     reversed during implementation).
4. Real-server integration tests (against `buildHttpServer()`, not a throwaway instance) proving:
   a header-less request behaves identically to pre-X.15 (regression guard), a mismatched
   `x-client-id` on an existing session is rejected with 403, a matching or new session succeeds
   with 200.
5. `deployment/deploy.sh`'s own existing architecture guard (X.9.5) still passes unmodified in
   its own assertions.
6. `git diff --stat` against the pre-X.15 commit shows changes in exactly the files listed under
   "Files allowed to change" — no more, no fewer.
7. The freeze report explicitly states, in writing, that recovery-*producer* wiring was
   deliberately deferred and why (mirroring this ADR's own Decision section) — it must not claim
   or imply that crash recovery is fully operational for HTTP traffic after this milestone.
8. `x-client-id` is documented, in the resolver's own file header and in the freeze report, as a
   non-cryptographic, caller-supplied, unverified signal — explicitly not authentication, exactly
   as this ADR frames it.
9. **(Added by this revision)** GX-001, GX-002, and GX-003 are the *only* modifications to any
   already-frozen test file for Phase X.15 itself; each is scoped exactly as documented in the
   Governance Exceptions section above (minimum literal changed, dependency-boundary/business-
   logic-isolation checks in all three guards fully re-verified as still passing, no check
   weakened or removed).
10. **(Added by the GX-004 amendment)** GX-004 is the *only* modification required to any
    already-frozen guard by Phase X.16 Step 1; the fix is a single appended array element (exact
    array-equality preserved, not loosened), and every other assertion in
    `x15-authorization-wiring-architecture.test.ts` (including every dependency-boundary,
    forbidden-import, and the `src/identity/` 10-file count check) is re-verified as still
    passing, unchanged, and unweakened.

---

## Final Recommendation Carried Forward

This ADR does not revisit `POST_X14_ARCHITECTURE_AUDIT.md`'s own final recommendation (**A —
continue current architecture**). Nothing in resolving this narrower question required a
structural change: the two "uncomposed siblings" (Recovery, Identity) remain siblings by this
decision, deliberately, rather than being forced together at the cost of duplicated
security-sensitive logic. That composition — done properly, via an explicit, separately-
authorized extension to one of the frozen wrapper functions — is named here as recommended
future work, not undertaken now.

*End of ADR (original decision). No source code was modified. No tests were modified. No commits
were created. No milestones were updated. No branches or tags were created. Phase X.15 was not
started.*

---

*End of revision. This revision itself modified no source code. It formally adopts GX-001
(already applied during initial implementation), and authorizes GX-002/GX-003 (test-literal
updates to two frozen guard files) to be applied as the next implementation step. No milestone
document was updated by this revision — that remains a Step 5 (Freeze) action, contingent on all
Acceptance Criteria passing.*

---

*End of GX-004 amendment. This amendment itself modified no source code (the amendment document
you are reading). It formally adopts GX-004 (a single appended filename in
`x15-authorization-wiring-architecture.test.ts`'s `src/api/` file-count assertion), to be applied
together with Phase X.16 Step 1's own commit (`src/api/credentialToken.ts` plus its unit tests).
No milestone document was updated by this amendment — `CURRENT_MILESTONE.md` still correctly
shows Phase X.15 FROZEN; Phase X.16's own freeze remains a future, separate action.*
