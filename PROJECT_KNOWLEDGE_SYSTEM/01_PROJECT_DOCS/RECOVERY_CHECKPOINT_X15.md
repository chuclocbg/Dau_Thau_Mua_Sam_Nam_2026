# Recovery Checkpoint — Phase X.15 Frozen

**Purpose:** A single, self-contained snapshot of repository state at the moment Phase X.15
(Authorization & Recovery Wiring) was frozen and pushed. Written so that a future session —
including one recovering from another interruption — can reconstruct exactly where the project
stands without re-reading the full X.15 governance trail.

**Date:** 2026-07-13
**Branch:** `develop`

---

## 1. Commit Reference Points

| Reference | Commit | Meaning |
|---|---|---|
| **HEAD** | `512b761` (`512b7613cc3ece5e1c13813bedf6782cffc901bc`) | "Phase X.15.6: freeze governance docs -- Phase X.15 (Authorization & Recovery Wiring) complete" |
| **Rollback commit** | `d1708ff` (tag `x14-frozen`) | The pre-X.15 baseline. A full X.15 rollback reverts here — this automatically reverts GX-001/GX-002/GX-003 along with the wiring that necessitated them (see `ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions → Rollback Implications). Do not roll back the guard-literal commits independently of the wiring commits. |
| **Freeze commit** | `512b761` | Same as HEAD — the freeze commit is the tip of `develop`. |

Full X.15 commit sequence (oldest to newest):

```
b61e664  Phase X.15.1: HTTP principal resolver (ADR Step 1, relocated)
57fc64b  Phase X.15.2: httpServer.ts wiring (ADR Step 2)
5a6a38c  Phase X.15.3: conversationRoutes.ts wiring (ADR Step 3) + GX-001
0f823b9  Phase X.15.4: deployment/deploy.sh recovery scan wiring (ADR Step 4)
553b94f  Phase X.15.5: governance exceptions GX-002, GX-003 -- ADR revised
512b761  Phase X.15.6: freeze governance docs -- Phase X.15 complete
```

**No git tag exists for this checkpoint.** Only `x14-frozen` (pointing at `d1708ff`) exists as an
annotated tag. Cutting an `x15-frozen` tag was never requested and has not been done.

---

## 2. Origin Status

| | Value |
|---|---|
| `origin/develop` HEAD | `512b761` — identical to local HEAD |
| Ahead/behind | `0 / 0` — fully synchronized |
| Last push | `f174fcc..512b761 develop -> develop` (confirmed via `git fetch` + `git rev-parse origin/develop` immediately after) |

---

## 3. Completed Milestones (as of this checkpoint)

| Phase | Title | Status |
|---|---|---|
| A–I | Business core | Frozen |
| J | Authentication & Authorization (procurement domain, `src/auth/`) | Frozen |
| K | Storage & Attachment Service | Frozen |
| L | Notification Service | Frozen |
| M0 | Docker Infrastructure Foundation | Designed, unverified live (no Docker in this environment) |
| M1 | Production Prisma Layer | Implemented, pending live-database verification |
| N | Knowledge Platform (16/16 providers) | Frozen |
| X.1 | Conversation Core | Frozen |
| X.2 (Batch A+B) | Reasoning Pipeline Core + AIContext/Prompt/LLM Adapter | Frozen |
| X.3 (X.3.1–X.3.7) | Knowledge Resolution | Frozen |
| X.4 (X.4.1–X.4.7 + Final Integration) | Reasoning Engine Wiring | Frozen |
| X.5 | Output Formatting | Frozen |
| X.6 | Tool Calling | Frozen |
| X.7 | MCP Integration | Frozen |
| X.8 | Multi-Agent Orchestration | Frozen |
| X.9 (X.9.1–X.9.5) | Production Hardening (HTTP/Bootstrap, Observability, Streaming, Docker/Config, Deployment/Ops) | Frozen |
| X.10 | Business Foundation: Prisma & Persistence | Frozen |
| X.11 | Application Runtime | Frozen |
| X.12 | Conversation HTTP Entry Verification | Frozen |
| X.13 | Conversation Persistence Recovery & Crash Resilience | Frozen |
| X.14 | Authentication, Authorization & Identity Infrastructure | Frozen (tagged `x14-frozen`) |
| **X.15** | **Authorization & Recovery Wiring** | **Frozen — this checkpoint** |

Full narrative detail for every phase: `MILESTONE_HISTORY.md`. Current-only summary:
`CURRENT_MILESTONE.md`.

---

## 4. Repository Statistics (at this checkpoint)

| Metric | Value |
|---|---|
| Test files | 549 |
| Total tests | 14,832 |
| Passed | 14,829 |
| Skipped | 3 (`TEST_DATABASE_URL`-gated — Docker/Postgres unavailable in this environment) |
| Failed | 0 |
| `tsc --noEmit` | Clean |
| Full-suite reruns | 3 consecutive (1st: 2 failures — investigated, traced to the pre-existing `execSync('npx prisma validate')` timing flake already documented at the X.14 freeze, not a regression; 2nd and 3rd: 0 failures) |
| Change vs. X.14 baseline | +3 test files (546 → 549), +26 tests (14,803 → 14,829 passed) — exactly the new X.15 test files |

**Known stale document:** `CURRENT_RELEASE.md` still shows the `x14-frozen` snapshot (546 files /
14,803 passed / tag `x14-frozen` / commit `d1708ff`) — it was deliberately **not** updated during
the X.15 freeze because no new release tag was cut and updating the release snapshot was outside
the requested scope at that time. Treat `CURRENT_RELEASE.md`'s numbers as one milestone behind
this checkpoint's actual numbers above until it is next updated.

---

## 5. Known Governance Exceptions

Formally recorded in `ADR_X15_ARCHITECTURE_DECISION.md`'s "Governance Exceptions" section. All
three are literal/stylistic test-assertion corrections — **zero dependency-boundary, layering, or
business-logic-isolation check was weakened or removed** in any of them.

| ID | File | What broke | Fix | Status |
|---|---|---|---|---|
| **GX-001** | `x12-http-entry-architecture.test.ts` (X.12) | Exact-substring import/call-site literals for `conversationRoutes.ts`/`httpServer.ts`, broken by the ADR-authorized switch to `runAuthorizedConversationTurn()` and the new 3-argument `registerConversationRoutes()` call | Literals updated to the new, correct shapes; `it()` titles renamed to match | Applied (commit `5a6a38c`) |
| **GX-002** | `x13-recovery-architecture-guard.test.ts` (X.13) | Same root cause as GX-001 — a different milestone's copy of the same call-site literal check | Replaced exact-substring match with a name+open-paren presence check (`.toContain('registerConversationRoutes(')`), matching the robust style X.9.2/X.9.3/X.9.4 already use | Applied (commit `553b94f`) |
| **GX-003** | `x14-identity-architecture-guard.test.ts` (X.14) | Assertion's title claimed a narrow fact (`routeAuthorization.ts` never imported) but its regex (`/identity/`) encoded a broader, now-obsolete fact | Regex narrowed to `/routeAuthorization/` — matches exactly what the title always claimed; still fails if `routeAuthorization.ts` is ever imported | Applied (commit `553b94f`) |

**Root cause (shared across all three, per `X15_GOVERNANCE_IMPACT_ASSESSMENT.md`):** an authoring-
style inconsistency between two architecture-guard lineages — X.9.2/X.9.3/X.9.4 used a
presence-check style already robust to `httpServer.ts`/`conversationRoutes.ts`'s established
"wired once, extended repeatedly" pattern; X.12/X.13/X.14's guards, verifying the same class of
fact, used a brittle exact-substring style instead. Not a code defect — every dependency-direction
and business-logic-isolation assertion in all three guards held throughout.

**Forward guidance (recorded in the ADR, binds no one but is the recommended default):** any
future guard verifying "this file was extended, not redesigned" for `httpServer.ts`,
`conversationRoutes.ts`, or any future file joining that pattern should use the presence-check
style, not exact-substring matching — specifically to avoid repeating this class of break at
X.16 and beyond.

---

## 6. Pending Roadmap

Per `POST_X14_ARCHITECTURE_AUDIT.md` §8 (Suggested Roadmap — recommendation only, nothing below
is authorized by that report or by this checkpoint):

| Item | Title | Status after X.15 |
|---|---|---|
| X.15 | Authorization & Recovery Wiring | **Done — this checkpoint.** Implemented as: `runAuthorizedConversationTurn()` wired into `conversationRoutes.ts`; `ISessionIdentityRepository` wired into `httpServer.ts`; recovery **scan** wired into `deployment/deploy.sh` (not `main.ts` — the ADR rejected touching `main.ts`, no "wiring only" precedent exists for it). `buildRouteAuthorizationHook()`/`routeAuthorization.ts` (Fastify-level route gating) remains **unwired** — a distinct capability from the runtime-level authorization this milestone wired in, deliberately deferred. |
| X.16 | Credential Verification | **Pending.** Design and implement a real authentication protocol (bearer token, session cookie, or OIDC — a product decision, not yet made) feeding `buildUserContext()`/`buildRouteAuthorizationHook()`'s `resolvePrincipal`. |
| X.17 | Docker/Postgres Live Verification | **Pending.** First milestone requiring an environment with Docker available — run `docker compose --profile app up`, apply all pending migrations, run every `TEST_DATABASE_URL`-gated integration test for real. |
| X.18 | CI/CD Pipeline | **Pending.** GitHub Actions running `tsc --noEmit` + architecture guards + full suite on every PR. |
| X.19 | Exactly-Once Recovery + Optimistic Locking | **Pending.** Requires touching currently-frozen X.11 persist-path code — needs its own scoped, explicitly-authorized milestone. |
| X.20 (or later, need-driven) | Knowledge Platform Persistence Migration | **Pending, not currently justified.** Only if distributed/10,000-user deployment becomes a real near-term requirement. |

**Two gaps X.15 explicitly did not close** (named, not silently carried):
- **Recovery-producer wiring.** `runRecoverableConversationTurn()` (X.13) is still not called by
  `conversationRoutes.ts`. Composing it with authorization around one turn would require either
  modifying a frozen X.13/X.14 file or duplicating security-sensitive logic outside a clean
  interface — both rejected in the ADR. Net effect: the recovery scan wired this milestone is
  genuinely invokable but will find an empty queue until a future milestone wires the producer.
- **Real credential verification.** `x-client-id` (the new `httpPrincipalResolver.ts` signal) is
  explicitly documented as non-cryptographic and unverified — it closes the false-sense-of-security
  gap (distinguishing callers so the ownership check can fire) without being a security boundary
  against a real adversary. This is X.16's job.

---

## 7. Exact Prerequisites Before Phase X.16

All of the following must hold before Phase X.16 (Credential Verification) may begin — per
`CURRENT_MILESTONE.md`'s `next_milestone_status`/`next_milestone_blocker` and the `do_not` list:

1. **Explicit human authorization and scoping.** No business-domain milestone begins
   automatically after a freeze — this has been the rule since X.9.5 and is repeated verbatim at
   every freeze since, including this one. X.16 does not start because X.15 finished.
2. **A chosen credential protocol.** `POST_X14_ARCHITECTURE_AUDIT.md` names this a genuine product
   decision (bearer token vs. session cookie vs. OIDC), not an engineering one — must be decided
   before implementation, not during it.
3. **`src/api/httpPrincipalResolver.ts` and the X.15 wiring must not be redesigned casually.**
   X.16 will need to replace or extend `resolvePrincipalFromRequest()`'s trust model (moving from
   an unverified header to a real verified credential) — this is expected and authorized *as part
   of* X.16's own scope, but should be planned as a deliberate change to a named file, not an
   incidental one.
4. **Any future guard touching `conversationRoutes.ts`/`httpServer.ts` again should follow the
   ADR's forward guard-writing guidance** (presence-check style, §5 above) to avoid recreating the
   GX-001/002/003 situation a third time.
5. **`routeAuthorization.ts` wiring and recovery-producer wiring remain explicitly out of scope**
   for X.16 unless a future scoping decision folds them in — do not assume X.16 silently also
   closes those two gaps.
6. **Full suite green and `tsc --noEmit` clean at the start of X.16**, matching every prior
   milestone's own entry condition — re-verify, don't assume the numbers in §4 above still hold if
   time has passed or other work has landed on `develop`.

---

## 8. Recovery Procedure After a Power Outage (or Any Unplanned Interruption)

The procedure actually used to recover this project after the outage that interrupted Phase X.15
mid-implementation. Reusable for any future interruption.

1. **Do not trust conversation memory.** Recover state entirely from the repository.
2. **Determine ground truth, in this order:**
   - `git rev-parse HEAD` and `git branch --show-current` — what commit and branch are we on.
   - `git status` — any uncommitted changes, staged or not; any untracked files.
   - `git log --oneline -20` — recent commit history, to identify the last completed milestone
     sub-step by its commit message.
3. **Read the governance documents, in this priority order** (skip any that don't exist):
   - `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/CURRENT_MILESTONE.md` — the single most
     time-sensitive file; states the current milestone, its evidence, and what must not be
     modified.
   - `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/MILESTONE_HISTORY.md` — full narrative history.
   - `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/CURRENT_RELEASE.md` — release tag / test-count
     snapshot (verify it isn't stale — cross-check against a live test run before trusting it).
   - Any in-flight plan/ADR/impact-assessment documents named in the current milestone's own
     evidence trail (in this recovery: `PHASE_X15_IMPLEMENTATION_PLAN.md`,
     `ADR_X15_ARCHITECTURE_DECISION.md`, `X15_GOVERNANCE_IMPACT_ASSESSMENT.md`) — read each in
     full; they state exactly what was decided and what remains undone.
   - This document (`RECOVERY_CHECKPOINT_X15.md`) if it exists and is current — it is a
     purpose-built shortcut for exactly this situation.
4. **Reconcile the working tree against the governance trail.** For every modified/untracked file,
   determine which documented step it corresponds to (diff it, don't guess) — distinguish files
   that are part of the interrupted task from unrelated pre-existing untracked content (this
   recovery found an unrelated GLPI/memory/orchestrator subsystem sitting untracked in the working
   tree — recognized and explicitly left alone, not folded into the recovery).
5. **Verify, don't assume, that "in-progress" work actually still compiles/passes.** Run the
   specific tests named by the governance trail as affected before running the full suite — a
   targeted run localizes problems faster than a 500+ file run.
6. **Print a recovery summary and stop for human confirmation** before resuming any work — do not
   modify code, create commits, or continue implementation during the recovery/reporting phase
   itself. Only resume once the human has reviewed the reconstructed state and explicitly approved
   a next action.
7. **Resume exactly at the documented interruption point** — never re-do already-completed steps,
   never re-create commits or tags that already exist, never overwrite a newer document with an
   older draft.
8. **Investigate anomalies, don't dismiss them.** If a verification run reports unexpected
   failures, check whether the affected files are frozen/unmodified (`git status`/`git diff`) and
   whether the failure signature matches a previously-documented, accepted flake (e.g., this
   project's own recurring `execSync('npx prisma validate')` timing sensitivity under full-suite
   parallel contention, first diagnosed at the X.9.5/X.14 freezes) before concluding it's benign —
   rerun enough times to distinguish a flake from a regression, and only then proceed.

---

*End of checkpoint. This document was written after Phase X.15's freeze and push; it modifies no
code, creates no commits, updates no milestone document, and creates no tag.*
