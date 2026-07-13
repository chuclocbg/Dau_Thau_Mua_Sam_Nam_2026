# Phase X.16 Scoping Report — Credential Verification

**Date:** 2026-07-13
**Status:** SCOPING ONLY. Nothing in this document is implemented. No source code was written, no
test was modified, no commit was created. This report determines *what* X.16 should be and
*whether* it may begin — it does not begin it.
**Method:** Repository state re-verified directly this session (git, `tsc`, architecture guards,
full test suite, direct reads of the exact files X.16 would touch) — not carried forward
unchecked from `PROJECT_BASELINE_AFTER_X15.md` or `PRE_X16_ARCHITECTURE_REVIEW.md`, though both
are used as cross-referenced sources for the *objective* (§2), since that has not changed.

---

## 1. Repository State Confirmation

| Check | Result |
|---|---|
| **HEAD** | `1044059` — "docs(review): add Project Baseline after Phase X.15" |
| **`origin/develop`** | `1044059` — identical; `0`/`0` ahead-behind (re-confirmed via `git fetch` this session) |
| **Latest freeze** | Phase X.15 (Authorization & Recovery Wiring), freeze commit `512b761`, per `CURRENT_MILESTONE.md`'s `current_milestone: "Phase X.15 - Authorization & Recovery Wiring - FROZEN"` |
| **Rollback point (X.16's own baseline)** | `1044059` — the current tip of `develop`. A full rollback of anything X.16 does returns here. (The deeper, tagged milestone boundary remains `d1708ff` / `x14-frozen`, unaffected by any of the three doc-only commits since.) |
| **Repository health** | `git status --short` shows 34 entries, all pre-existing and unrelated to any Phase X milestone (Legal `.docx` reference files, a screenshot, a stray `commit_msg.txt`, `app/generated/` build output, and the untracked GLPI/memory/orchestrator subsystem) — re-confirmed this session, none require action before X.16 |
| **Architecture guard status** | 34 guard files, 321 tests — **all passing**, re-run fresh this session |
| **Test suite status** | 549 test files, 14,832 total tests — **14,829 passed, 3 skipped** (`TEST_DATABASE_URL`-gated, Docker/Postgres unavailable), **0 failed** — re-run fresh this session |
| **`tsc --noEmit`** | Clean — re-run fresh this session |

**Conclusion: the repository is in the exact state its own governance documents claim.** No
drift found between what `CURRENT_MILESTONE.md`/`PROJECT_BASELINE_AFTER_X15.md` assert and what
this session's direct re-verification observed.

---

## 2. Phase X.16 Objective

Synthesized from the four named sources, cross-checked against each other (no contradiction
found between them):

- **`CURRENT_MILESTONE.md`** names the gap explicitly, twice: in `next_active_milestone` ("no
  real credential-verification protocol exists — `buildUserContext()` shapes a Principal, never
  authenticates one") and in the X.15 `do_not` update bullet ("x-client-id... is NOT real
  credential verification (that gap remains fully open, named explicitly, carried to a future
  X.16)"). It does **not** authorize X.16 to begin — `next_milestone_status: "NOT AUTHORIZED"`.
- **`ADR_X15_ARCHITECTURE_DECISION.md`** frames X.16 precisely as the milestone that replaces
  `httpPrincipalResolver.ts`'s trust model: "x-client-id is... explicitly out of scope — a future,
  separately-authorized milestone (Phase X.16 in the current roadmap)." It also pre-declares a
  forward-looking guard-writing convention (presence-check style over exact-substring) explicitly
  because "X.16 is already known to touch these files again."
- **`PRE_X16_ARCHITECTURE_REVIEW.md`** and **`PROJECT_BASELINE_AFTER_X15.md`** both independently
  arrive at the same framing (via `POST_X14_ARCHITECTURE_AUDIT.md` §8, which originated it): *"X.16
  — Credential Verification. Design and implement a real authentication protocol (bearer token,
  session cookie, or OIDC — a genuine product decision, not an engineering one) feeding
  `buildUserContext()`/`buildRouteAuthorizationHook()`'s `resolvePrincipal`."*

**Precise objective, as scoped by all four sources in agreement:**

> Replace the currently-unverified `x-client-id` signal (`src/api/httpPrincipalResolver.ts`, X.15)
> with a real credential-verification mechanism, so that `AuthenticationContext.principal.id`
> reflects a caller who has actually proven their identity, not merely claimed it. This closes the
> one gap `PRE_X16_ARCHITECTURE_REVIEW.md` ranks as the platform's remaining single largest
> authorization weakness (rated 6/10 "improving from 3/10", explicitly because credential
> verification, not authorization logic, is what's missing).

**Explicitly NOT X.16's objective, per the same four sources' consistent scoping:**
- Wiring `routeAuthorization.ts` (Fastify-level gating) into any route — a distinct, still-optional
  capability, not automatically implied by adding real credentials.
- Recovery-producer wiring (`runRecoverableConversationTurn()`) — an unrelated, separately-named
  gap.
- Authorizing the other 3 HTTP routes (`reasoning/answer`, `reasoning/batch`,
  `reasoning/answer/stream`) — none has session state to protect; extending credential
  verification to them, if ever desired, is a follow-on decision, not part of this objective.
- Any change to `src/auth/` (procurement RBAC) — confirmed by every source as a permanently
  separate system from `src/identity/`.

---

## 3. Implementation Boundaries

### Files expected to change

| File | Expected change |
|---|---|
| `src/api/httpPrincipalResolver.ts` (X.15) | Its internal trust logic replaced/extended: instead of trusting a raw `x-client-id` header, verify a real credential (signature check, session lookup, or token-introspection call, depending on the protocol decision in §7) before calling `buildUserContext()`. Explicitly pre-authorized to change by `CURRENT_MILESTONE.md`'s own X.15 `do_not` bullet ("...outside of a newly-approved milestone" — X.16 is that milestone, once scoped and approved). |
| `src/identity/application/authenticationContext.ts` (X.14) | Possibly extended — `buildUserContext()`'s signature may need to accept verified claims (e.g. token expiry, issuer) rather than a bare string, depending on the chosen protocol. **Additive only** — existing callers (`buildAnonymousContext`, `buildServiceContext`, `buildSystemContext`) must not be broken. |
| A new credential-verification module (exact location depends on §7's decision — see "New interfaces" below) | New file(s) implementing the actual verification logic (signature check / session store lookup / OIDC introspection). |
| `app/package.json` | Likely one new dependency (see §7 — no credential-related package is currently installed; confirmed by direct `grep` this session against `jsonwebtoken`/`jose`/`passport`/`@fastify/jwt`/`@fastify/cookie`/`@fastify/session`/`bcrypt`/`argon2` — zero matches). **May be zero** if the stdlib-only HMAC option in §7 is chosen. |
| Test files under `src/__tests__/` | New unit tests for the verification logic; a new or extended X.16 architecture guard; likely an update to `x15-authorization-wiring-architecture.test.ts`'s own assertion that `httpPrincipalResolver.ts` "imports only `buildUserContext`/`buildAnonymousContext`... and nothing else from `src/identity/`" (X.16 will need to import whatever verification primitive it adds) — this is expected, not a violation, and should be handled as a named governance exception from the outset (see §4), not discovered reactively as X.12/X.13/X.14's guards were during X.15. |

### Files that MUST NOT change

Carried forward unmodified from `ADR_X15_ARCHITECTURE_DECISION.md`'s own boundary list, re-verified
current and still accurate this session:

- `src/identity/domain/identityTypes.ts`, `application/authorizationEvaluator.ts`,
  `application/permissionResolver.ts`, `application/runtimeAuthorization.ts`,
  `application/toolAuthorization.ts`, `application/mcpAuthorization.ts`,
  `application/routeAuthorization.ts`, `infrastructure/*.ts` — the entire X.14 authorization
  *evaluation* engine is unaffected by *who* a Principal is; only *how a Principal is produced*
  changes. Re-verified this session: `evaluateAuthorization()`, `authorizeMcpToolCall()` etc.
  operate purely on `AuthenticationContext`/`Permission[]`, never on how the credential was
  obtained.
- `src/runtime/conversationEntryOrchestrator.ts`, `runtimeContext.ts`, `conversationSession.ts`,
  `runtimeSessionBuilder.ts`, `sessionAttachments.ts` (X.11).
- `src/runtime/recovery/*.ts` — all six files (X.13).
- `src/reasoning/`, `src/mcp/`, `src/multiagent/` in full (X.2–X.8).
- `src/persistence/`, `prisma/schema.prisma`, `prisma.config.ts` (Phase M1/X.10) — **unless** a
  session-cookie protocol is chosen and a server-side session store is judged necessary, in which
  case a new, additive Prisma model would be justified (see §7) — this is the one boundary that is
  conditional on the protocol decision, flagged explicitly rather than silently assumed either way.
- `src/auth/` (Phase M1 procurement RBAC) — no more reason to touch it than X.14/X.15 had.
- `src/server/main.ts`, `src/startup/gracefulShutdown.ts` (X.9.1).
- `src/api/reasoningRoutes.ts`, `src/api/coordinatorRoutes.ts` (X.9.1) — unless a future, separate
  decision extends credential verification to them (explicitly not this milestone's objective,
  §2).

### Frozen milestones affected

Only **X.15** (`src/api/httpPrincipalResolver.ts`) and possibly **X.14**
(`authenticationContext.ts`, additively only) are touched. Every other milestone (X.1–X.13)
remains fully frozen with zero carve-out, matching the discipline every prior wiring milestone
(X.9.2, X.9.3, X.12, X.15) has followed.

### Expected dependency directions

No new layering edge is required. `src/api/httpPrincipalResolver.ts` already depends on
`src/identity/application/authenticationContext.ts` (established at X.15); X.16 either extends
that existing edge or adds one new edge from `httpPrincipalResolver.ts` to a new verification
module — which itself should depend on nothing above `src/identity/`/`src/api/`, mirroring every
prior addition's downward-only direction. **No violation is anticipated** if this shape is
followed; this scoping report flags it as an expectation to verify, not a guarantee, since the
concrete module doesn't exist yet.

### New interfaces (contingent on the §7 protocol decision — sketched, not designed)

- A verification function, e.g. `verifyCredential(rawToken: string): VerifiedIdentity | null`
  (naming illustrative) — the one new primitive `httpPrincipalResolver.ts` would call before
  deciding between `buildUserContext()` and `buildAnonymousContext()`.
- Possibly a credential-issuance endpoint or CLI (how does a caller *obtain* a credential in the
  first place?) — **this is a real, currently-unscoped question this report surfaces**: none of
  the four source documents specify an issuance mechanism, only verification. A protocol decision
  that specifies verification without issuance is incomplete for a real deployment.

### Existing interfaces to reuse (do not reinvent)

- `AuthenticationContext`, `Principal`, `Claims` (X.14, `identityTypes.ts`) — the target shape any
  verified credential must map into. Already generic enough (`attributes: Record<string, string>`)
  to carry protocol-specific claims without modification.
- `buildUserContext(userId, attributes)` (X.14) — already accepts an attributes bag; a verified
  claims-to-`Principal` mapping can likely reuse this as-is rather than adding a parallel factory.
- `evaluateAuthorization()`, `runAuthorizedConversationTurn()`, `buildRouteAuthorizationHook()`
  (all X.14) — **zero changes needed**; all operate downstream of "a Principal exists," not "how
  it was obtained."
- `dotenv`-based secret loading (`src/startup/loadEnvironmentSecrets.ts`, X.9.4) — if a protocol
  needs a signing secret/key, this existing loader is the established pattern to extend, not a
  new secrets mechanism.

---

## 4. Risks

### Technical risks

- **A fourth guard-brittleness incident.** `x15-authorization-wiring-architecture.test.ts`'s own
  assertion that `httpPrincipalResolver.ts` imports only the two X.14 factory functions **will**
  break the moment X.16 adds a verification import — this is not a possibility, it is a certainty
  given the objective in §2. Unlike X.12/X.13/X.14's guards (broken as an unanticipated side
  effect), this one is now foreseeable in advance; X.16 should update it as part of its own
  planned work, not rediscover it reactively.
- **Protocol/library risk.** Zero credential-related dependencies exist in `package.json` today
  (confirmed by direct grep this session). Whichever protocol is chosen, either a new dependency
  must be vetted and added (first new runtime dependency since X.9.4's `dotenv`), or a
  stdlib-only approach (`node:crypto` HMAC) must be judged sufficient — a real design trade-off,
  not a formality.
- **Session-store risk, conditional.** If a session-cookie protocol is chosen over stateless
  bearer tokens, a new persistence concern (session storage, expiry, invalidation) is introduced —
  this is the one path that could require touching `prisma/schema.prisma` (currently a "must not
  change" file per §3, conditionally).

### Governance risks

- **Scope creep into route-level gating.** Because X.16 touches `httpPrincipalResolver.ts` and
  necessarily interacts with the identity module, there is a natural temptation to also wire
  `routeAuthorization.ts` "while we're in there." §2 explicitly excludes this — any such addition
  must be its own explicit scoping decision, not an incidental bundle.
- **`app/.memory/`'s 15-phase staleness** (named in `PROJECT_BASELINE_AFTER_X15.md` §3.13,
  re-confirmed unresolved this session — `project-status.md` still dated 2026-07-05) could cause a
  future contributor consulting that system instead of `PROJECT_KNOWLEDGE_SYSTEM/` to
  under-appreciate how much has shipped since Phase N. Not blocking, but a live risk for X.16
  specifically since it is exactly the kind of milestone a stale doc would mis-describe as
  "not yet started" when in fact its prerequisites are fully ready.

### Testing risks

- **Real-server integration coverage.** X.15's own integration suite exercises `buildHttpServer()`
  for real (not a throwaway instance) — X.16 must extend that same suite with genuine
  credential-verification scenarios (valid credential, expired/invalid credential, missing
  credential falling back to anonymous) rather than only unit-testing the verification function
  in isolation, to preserve the project's established "prove it against a real server" discipline.
- **Docker/Postgres unavailability** (unchanged, pre-existing) means any session-store-backed
  design cannot be live-verified in this environment — the same limitation that already applies
  to every Prisma-backed module. If the chosen protocol requires a session store, its live
  behavior joins the existing X.17 verification backlog rather than being verifiable at X.16's own
  freeze.

### Rollback risks

- **Low, if scoped as described.** Every file in "files expected to change" (§3) is already used
  to non-frozen, additively-extended files (`httpPrincipalResolver.ts` is itself only one
  milestone old). A revert to `1044059` cleanly undoes everything X.16 would add, with no
  entanglement with X.15's own wiring (which stays intact and functional even if X.16's credential
  layer is later rolled back — `buildAnonymousContext()` remains the safe fallback throughout).
- **Higher, conditionally.** If a session-store Prisma model is added and later rolled back after
  real data has been written against it (post-X.17 live deployment), that rollback is materially
  harder than a pure source-code revert — a reason to prefer a stateless protocol if the product
  decision is otherwise close.

---

## 5. Implementation Order

**Presented as a sequence a future, separately-authorized implementation would follow — nothing
below is started by this scoping report.**

**Step 1 — Protocol decision (governance action, not code)**
- **Purpose:** Resolve the one open product question this report cannot resolve on its own
  authority (§7): bearer token / session cookie / OIDC / stdlib-only HMAC.
- **Files:** None (a decision record — an ADR addendum or a short scoping note, per this project's
  own established convention for exactly this kind of fork, e.g. the X.15 ADR's own "X.15a/b/c"
  enumeration).
- **Dependencies:** None.
- **Verification:** N/A — a decision, not code.
- **Rollback point:** N/A.
- **Expected commit boundary:** A governance-only commit (decision record), or none, if the
  decision is communicated without a persisted document.

**Step 2 — Credential verification primitive**
- **Purpose:** Implement the chosen protocol's core verify function in isolation, fully unit
  tested, not yet wired to any HTTP path.
- **Files:** One new module (location/name depends on Step 1's outcome — e.g.
  `src/identity/application/credentialVerifier.ts`, subject to the same X.14 recursive
  file-count-guard collision risk `httpPrincipalResolver.ts` itself hit at X.15, so likely
  relocated beside it in `src/api/` for the same reason).
- **Dependencies:** Step 1. Possibly one new `package.json` dependency.
- **Verification:** Unit tests (valid/invalid/expired/malformed credential cases); `tsc --noEmit`.
- **Rollback point:** Commit before this step (clean — nothing else depends on this file yet).
- **Expected commit boundary:** One commit, e.g. "Phase X.16.1: credential verification primitive."

**Step 3 — `httpPrincipalResolver.ts` wiring**
- **Purpose:** Replace the `x-client-id`-trusts-anything logic with a call to Step 2's verifier;
  invalid/missing credentials fall back to `buildAnonymousContext()` (preserving the exact
  regression-safety guarantee X.15 itself established for header-less callers).
- **Files:** `src/api/httpPrincipalResolver.ts` (modified).
- **Dependencies:** Step 2.
- **Verification:** Unit tests for the resolver's own branching; `tsc --noEmit`; the existing
  `x15-conversation-authorization-integration.test.ts` re-run to confirm the anonymous-fallback
  regression case still holds unchanged.
- **Rollback point:** Commit before this step.
- **Expected commit boundary:** One commit, e.g. "Phase X.16.2: httpPrincipalResolver wiring."

**Step 4 — Governance exception for the X.15 architecture guard**
- **Purpose:** Update `x15-authorization-wiring-architecture.test.ts`'s "imports only
  `buildUserContext`/`buildAnonymousContext`" assertion to also permit Step 2's new import —
  planned in advance (§4), not discovered reactively.
- **Files:** `src/__tests__/x15-authorization-wiring-architecture.test.ts` (one literal/assertion
  updated, documented as a named exception the same way GX-001/002/003 were).
- **Dependencies:** Step 3.
- **Verification:** The updated guard passes; every other assertion in it re-confirmed unchanged
  (dependency-boundary, forbidden-import, and "runRecoverableConversationTurn not imported"
  checks all still enforced).
- **Rollback point:** Commit before this step.
- **Expected commit boundary:** One commit, e.g. "Phase X.16.3: governance exception GX-004."

**Step 5 — Real-server integration tests**
- **Purpose:** Prove the whole chain against a real `buildHttpServer()`: valid credential → 200
  with the correct principal bound; invalid/expired credential → 403 or anonymous fallback per
  Step 1's decision; missing credential → unchanged anonymous behavior (regression check).
- **Files:** New test file(s) under `src/__tests__/`.
- **Dependencies:** Steps 2–4.
- **Verification:** New integration suite passing; full repository suite; architecture guard
  suite (all, not just the new one).
- **Rollback point:** Commit before this step.
- **Expected commit boundary:** One commit, e.g. "Phase X.16.4: real-server integration tests."

**Step 6 — Freeze**
- **Purpose:** Report + governance doc update (`CURRENT_MILESTONE.md`, `MILESTONE_HISTORY.md`) +
  optional tag, matching every prior milestone's own freeze discipline exactly.
- **Files:** `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/CURRENT_MILESTONE.md`,
  `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/MILESTONE_HISTORY.md`, a new
  `PHASE_X16_CREDENTIAL_REPORT.md` (or equivalent, matching the naming convention of
  `PHASE_X14_IDENTITY_REPORT.md`/`PHASE_X13_RECOVERY_REPORT.md`).
- **Dependencies:** Steps 1–5 all green.
- **Verification:** Full suite; `tsc --noEmit`; architecture guard suite; `git diff --stat`
  against every frozen directory, confirming the diff matches exactly the "files expected to
  change" list in §3 and nothing else.
- **Rollback point:** The last commit of Step 5, before the freeze commit(s).
- **Expected commit boundary:** One or more freeze commits, following the exact `X.15.6`-style
  precedent.

---

## 6. Acceptance Criteria (required before X.16 may be frozen)

1. `tsc --noEmit` clean.
2. Full repository test suite: 0 failures beyond the same accepted `TEST_DATABASE_URL`-skip
   exceptions every prior freeze has accepted.
3. A dedicated X.16 architecture guard (or an extension of the existing X.15 one) proving:
   - Every file in "files that MUST NOT change" (§3) is byte-for-byte unchanged.
   - `httpPrincipalResolver.ts` calls the new verification primitive before constructing a
     non-anonymous `AuthenticationContext` — an invalid/missing credential must never silently
     produce a `USER` principal.
   - No new import edge exists from `src/identity/`'s evaluation modules
     (`authorizationEvaluator.ts`, `permissionResolver.ts`, etc.) back toward the new
     verification code — the evaluation engine must remain ignorant of *how* a Principal was
     produced.
4. Real-server integration tests (against `buildHttpServer()`, not a throwaway instance) proving:
   a valid credential resolves to the correct, non-anonymous principal; an invalid/expired
   credential is rejected (403) or safely falls back to anonymous (per Step 1's decision — either
   is acceptable, silent escalation to a trusted principal is not); a header-less/credential-less
   request behaves identically to pre-X.16 behavior (regression guard, mirroring the exact
   discipline `x15-conversation-authorization-integration.test.ts` already established for
   `x-client-id`).
5. The freeze report explicitly states which protocol was chosen and why, and names any residual
   gap plainly (e.g., if issuance tooling was out of scope, that must be stated, not implied as
   solved).
6. `git diff --stat` against the pre-X.16 commit (`1044059`) shows changes in exactly the files
   named in §3's "files expected to change" list — no more, no fewer.
7. If a session-store Prisma model was added: its migration is present and `prisma validate`
   passes, but it must **not** be claimed as live-verified (Docker/Postgres remains unavailable in
   this environment, unchanged) — the same honesty discipline every Prisma-touching milestone
   since X.10 has maintained.
8. Any new dependency added to `package.json` is named explicitly in the freeze report along with
   the reason it was chosen over the stdlib-only alternative (or why the stdlib-only alternative
   was chosen instead) — a first-since-X.9.4 new-dependency decision deserves the same visibility
   X.9.4's own `dotenv` addition received at the time.

---

## 7. Final Recommendation

**X.16 may begin scoping-complete implementation planning now, but full implementation should
not start until one prerequisite is explicitly resolved: the protocol decision.**

This is not a new finding — `POST_X14_ARCHITECTURE_AUDIT.md`, `ADR_X15_ARCHITECTURE_DECISION.md`,
`PRE_X16_ARCHITECTURE_REVIEW.md`, and `PROJECT_BASELINE_AFTER_X15.md` have each, independently,
already named this exact gate ("a genuine product decision, not an engineering one"). This
report's contribution is confirming, by direct inspection this session, that **nothing else
blocks X.16**: the repository is architecturally ready (every dependency X.16 needs —
`AuthenticationContext`, `buildUserContext()`, `evaluateAuthorization()` — exists, tested, and
requires zero modification), the test suite is green, the architecture guards pass, and the one
file X.16 must change (`httpPrincipalResolver.ts`) is explicitly pre-authorized for exactly this
purpose by `CURRENT_MILESTONE.md`'s own do_not list.

**Concretely, before Step 2 of §5 may begin, an explicit decision is needed among:**

- **Stateless bearer token, stdlib-only (HMAC via `node:crypto`).** Zero new dependency — matches
  this project's demonstrated pattern of preferring a small, self-built primitive over a new
  package when one suffices (e.g., X.9.2 built its own W3C-`traceparent`-parsing tracer rather
  than adding `@opentelemetry`). Fastest to implement and freeze; weakest in the sense that key
  rotation/revocation and cross-service issuance are entirely hand-built.
- **Stateless bearer token via a library (`jose` or similar).** Slightly more implementation
  surface (one new dependency) for standard, audited JWT/JWK handling — appropriate if
  interoperability with an external issuer is anticipated.
- **Session cookie.** Requires a server-side session store — the one path that plausibly touches
  `prisma/schema.prisma` (see §3/§4) and inherits the existing Docker/Postgres live-verification
  gap. Higher implementation cost, but a natural fit if this platform's future callers are
  primarily browser-based rather than machine clients.
- **OIDC.** Highest implementation and operational cost (an external identity provider becomes a
  runtime dependency); appropriate only if there is already an organizational OIDC provider this
  platform is expected to integrate with. No evidence of such a requirement was found anywhere in
  the repository during this session's inspection.

This report does not choose among these on its own authority — consistent with this project's own
established discipline (the X.15 ADR itself declined to unilaterally resolve an analogous fork,
presenting X.15a/b/c instead and waiting for explicit approval). **Recommendation for the decision-
maker:** the stdlib-only HMAC bearer-token option is the smallest, most reversible starting point
and is most consistent with this codebase's demonstrated minimal-dependency discipline across 15
phases — but the actual choice depends on product context (is there an external identity
provider already, or planned?) that this repository audit cannot answer from source code alone.

**Summary:** repository state — ready. Architecture — ready, zero rework needed. Test/guard
baseline — green. The sole remaining prerequisite is the protocol decision in this section, which
is a scoping/product action, not an engineering blocker — once made, Step 2 of §5 can begin
immediately.

---

*End of report. No source code was modified. No tests were modified. No commits were created. No
milestone document was updated. No branches or tags were created. Phase X.16 implementation was
not started — this document is scoping only.*
