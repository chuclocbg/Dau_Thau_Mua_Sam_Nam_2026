# Project Baseline After Phase X.16 — Audit

**Date:** 2026-07-13
**Method:** Full re-inspection of the current repository state, performed after the Phase X.16
freeze. Every figure below was obtained by running a command or reading a file during this
session — `PROJECT_BASELINE_AFTER_X15.md`, `PRE_X16_ARCHITECTURE_REVIEW.md`, and
`PHASE_X16_CREDENTIAL_REPORT.md` were consulted only as pointers to *what to re-check*, not as a
source of numbers. Where this audit's figures match a prior report, that is independent
confirmation, not carried-forward assumption.

---

# 1. Current Repository Health

| Check | Result |
|---|---|
| `git status` | 34 entries, all pre-existing and unrelated to Phase X (Legal `.docx` reference files, a screenshot, a stray `commit_msg.txt`, `app/generated/` build output, four older never-committed audit drafts, and the untracked GLPI/memory/orchestrator subsystem) — re-confirmed this session, none require action |
| Branch synchronization | `develop` and `origin/develop` both at `0c5f1d4` — `0`/`0` ahead-behind, confirmed via fresh `git fetch` |
| **HEAD** | `0c5f1d4` — "Phase X.16.6: freeze governance docs -- Phase X.16 (Credential Verification) complete" |
| **Rollback point** | Two meaningful boundaries: `72d7449` (the last commit before any X.16 *code* — after the scoping/protocol-decision docs, before Step 1) for an X.16-only revert; `d1708ff` (tag `x14-frozen`) for a full revert of both X.15 and X.16. No `x15-frozen` or `x16-frozen` tag exists — tagging was never requested for either milestone. |
| Release state | `CURRENT_RELEASE.md` still reflects the `x14-frozen` snapshot (546 files / 14,803 passed / commit `d1708ff`) — confirmed unchanged again this session. It is now stale by **+7 test files / +67 tests** relative to this audit's actual numbers (two milestones behind: X.15 and X.16 both). No new release tag has been cut since `x14-frozen`. |

---

# 2. Architecture Status

## Layer boundaries and dependency graph

Re-verified directly this session (not assumed from prior reports):

- `src/identity/` → `src/auth/`: **zero imports**, confirmed by fresh grep.
- `src/api/credentialToken.ts` → anything above `node:crypto`: **zero imports**, confirmed by
  reading the file directly.
- `src/runtime/recovery/` → `src/mcp/`/`src/multiagent/`: **zero imports**, unchanged since X.13.
- `src/server/main.ts` / `src/bootstrap/buildApplication.ts` → any reference to `credential`:
  **zero matches**, confirmed by fresh grep — Path B's central promise (X.16 touches neither
  frozen file) holds.
- The one new edge since X.14 (`src/api/` → `src/identity/`, established at X.15) is unchanged in
  direction and remains the only new edge X.16 added anything to (`httpPrincipalResolver.ts`
  calling `verifyToken()` from its own sibling file `credentialToken.ts` is a same-directory
  reference, not a new layer edge).

**Layering violations found: none**, across the entire inspected surface.

## Architecture guard coverage

**35 guard files, 334 tests, all passing** (re-run fresh this session). Growth by milestone,
confirmed by direct file count at each freeze: X.9 era ~28 guards → X.14: 33 → X.15: 34 → **X.16:
35**. Each milestone since X.9.1 has added exactly one dedicated guard file, with zero exceptions.

## Remaining technical debt

`TECHNICAL_DEBT.md`/`KNOWN_RISKS.md` are still dated `as_of: 2026-07-05` — confirmed unchanged
again this session, now **three milestones** stale (X.14, X.15, X.16 all postdate it). Current,
reconciled state:

| Item | Status after X.16 |
|---|---|
| No real credential verification (pre-X.16 HIGH finding) | **Resolved** for the one route it covers — see §3 |
| Recovery not wired into any operational sequence | **Partially resolved since X.15** (scan wired, producer not) — unaffected by X.16 |
| Docker/Postgres never run live in this environment | **Unchanged, still open** — the single largest unresolved gap on the platform, now spanning 8 phases (X.9.4 through X.16) |
| Recovery and Identity are uncomposed siblings | **Unchanged** — deliberately not addressed by X.16 (out of scope) |
| No concurrent-scan-safe idempotency | **Unchanged**, pre-existing |
| No HTTP-boundary input validation library (Zod or similar) | **Unchanged**, pre-existing |
| `routeAuthorization.ts` unwired | **Unchanged since X.14** — a distinct capability from the runtime-level gating X.15/X.16 strengthened |
| No CI/CD pipeline | **Unchanged**, pre-existing |
| **New this milestone: no token replay protection** | `TokenPayload` carries `subject`/`issuedAt`/`expiresAt` only — no nonce/`jti`. A captured, still-valid token can be replayed by any party who intercepts it, indistinguishably from the legitimate caller, until it expires. Not previously named in any prior audit because the mechanism didn't exist before X.16; confirmed by direct read of `credentialToken.ts` this session. See §3. |

## Known risks (reconciled against current state)

- Session hijack via unauthenticated `sessionId` — **closed at X.15**, strengthened at X.16 (real
  signature verification instead of an unverified string).
- Docker/Postgres never verified live — **unchanged, still the top risk**.
- Two disconnected authorization systems (`src/auth/`, `src/identity/`) — **unchanged, by
  design**, re-confirmed zero cross-import this session.
- `app/.memory/`'s governance staleness — **unchanged**, still ~2 milestones (now 3, counting
  X.16) behind `PROJECT_KNOWLEDGE_SYSTEM/`, confirmed via its own `project-status.md` still dated
  2026-07-05.

## Governance exceptions (GX-001 … GX-004)

| ID | Guard | Cause | Status, re-verified this session |
|---|---|---|---|
| GX-001 | `x12-http-entry-architecture.test.ts` | X.15 wiring | Applied, passing |
| GX-002 | `x13-recovery-architecture-guard.test.ts` | X.15 wiring | Applied, passing |
| GX-003 | `x14-identity-architecture-guard.test.ts` | X.15 wiring | Applied, passing |
| GX-004 | `x15-authorization-wiring-architecture.test.ts` | X.16's `credentialToken.ts` addition | Applied, passing |

All four re-confirmed passing in this session's fresh architecture-guard run. **Zero new
exceptions (no GX-005)** — X.16's Path B design was chosen specifically to avoid one, confirmed
by direct read of `httpPrincipalResolver.ts`/`conversationRoutes.ts`/`httpServer.ts`: every call
site GX-001 originally fixed is still byte-for-byte the same 3-argument form.

---

# 3. Security Status

## Credential verification

Real, implemented: `signToken()`/`verifyToken()` (`src/api/credentialToken.ts`) — HMAC-SHA256 via
`node:crypto`, constant-time signature comparison (`timingSafeEqual()`, confirmed by direct read),
mandatory enforced expiry. `x-client-id`'s value must verify against `CREDENTIAL_SIGNING_SECRET`
or the request falls back to anonymous — re-confirmed via a fresh, isolated read of
`httpPrincipalResolver.ts`, not assumed from the freeze report.

## Authorization flow

Unchanged in mechanism since X.14, now reachable with a real signal since X.16:
`resolvePrincipalFromRequest()` → `runAuthorizedConversationTurn()` → `evaluateAuthorization()` →
session-ownership check → `runConversationTurn()`. Re-confirmed by direct read of
`runtimeAuthorization.ts`: the ownership check is
`existingBinding.principalId !== auth.principal.id && !hasAllScope(auth, 'conversation', 'ask')`
— a mismatched, non-`ALL`-scoped principal is rejected. This is the exact mechanism X.15 built and
X.16 makes trustworthy.

## Recovery wiring

**Unchanged since X.15, re-confirmed this session:** the scan (`runStartupRecoveryScan()`) is
invoked by `deployment/deploy.sh`; the producer (`runRecoverableConversationTurn()`) is not
imported anywhere under `src/api/` or `src/server/` — confirmed by fresh grep returning zero
matches in either directory. The scan remains genuinely invokable but structurally has nothing to
consume, exactly as at the X.15 freeze. X.16 did not touch this in any way.

## Session ownership

Real and enforced (see Authorization flow above), now backed by a verifiable identity rather than
an unverified string. **One caveat, unchanged since X.15 and still accurate:** ownership binds to
whatever `subject` a verified token carries — if the same signing secret issues two tokens for the
same subject to two different physical people, they are, correctly by design, treated as the same
principal. This is a credential-management concern (who is allowed to request a token for which
subject), not a flaw in the ownership-check logic itself, and is outside `scripts/
issueCredentialToken.ts`'s own scope (it trusts whoever runs it with the secret already present).

## Replay protection

**Does not exist.** Confirmed by direct read of `credentialToken.ts`'s `TokenPayload` interface
(`subject`, `issuedAt`, `expiresAt` only — no nonce, no `jti`, no one-time-use marker). A valid
token, once issued, can be presented by any party who obtains it (network interception, log
exposure, a compromised client) as many times as desired until `expiresAt`, and the server has no
way to distinguish a replay from the legitimate original use. This is a real, previously-unnamed
gap surfaced by this audit — not identified in `X16_PROTOCOL_DECISION.md`'s own Security
Considerations, which focused on signature integrity, expiry enforcement, and secret protection,
but did not address replay. **Severity assessment:** Medium in the current deployment context
(this platform is not exposed to untrusted traffic today, per `docs/PRODUCTION_READINESS.md`'s own
standing statement, unchanged since X.9.5), but a real gap that any future exposure to a real
network must close — either via short token lifetimes (a partial mitigation already available
today via the existing `ttlSeconds` parameter) or a proper nonce/replay-cache mechanism (not yet
built).

## Attack surface summary

| Route | Auth today | Session state to protect | Residual risk |
|---|---|---|---|
| `GET /live`, `/ready`, `/health` | None | None | None — standard, unauthenticated probes |
| `POST /api/v1/reasoning/answer` | None | None (stateless) | Low — no session to hijack, matches design |
| `POST /api/v1/reasoning/batch` | None | None (stateless) | Low — same |
| `POST /api/v1/reasoning/answer/stream` | None | None (stateless) | Low — same |
| `POST /api/v1/conversation/turn` | **Real, verified credential (X.16)** | Yes — `SessionIdentityBinding` | **Improved.** Residual: no revocation, no replay protection, single-secret trust model — all named above, none hidden |

**Net security trajectory since X.14:** session hijack (HIGH, closed at X.15/X.16) →
false-sense-of-security via unverified signal (HIGH, closed at X.16) → replay protection (newly
surfaced MEDIUM gap, this audit) → revocation (named MEDIUM gap, unchanged since X.16 freeze).
Improving overall, with one real new finding this audit adds to the record.

---

# 4. Test Health

| Category | Files | Notes |
|---|---|---|
| **Unit** | The majority of the 553 — e.g. `x16-credential-token.test.ts` (13), `x16-http-principal-resolver-credential.test.ts` (9), `app-config.test.ts` (10) | Pure-function/isolated-module tests, no real server |
| **Integration** | `x16-credential-http-integration.test.ts` (6), `x15-conversation-authorization-integration.test.ts` (5), `http-server-integration.test.ts`, `observability-integration.test.ts`, `reasoning-stream-integration.test.ts` and others | Exercised against the **real** `buildHttpServer()` via Fastify `inject()`, never a throwaway instance — re-confirmed by direct read of the X.16 integration file this session |
| **Architecture** | 35 dedicated guard files, 334 tests | Re-run fresh this session, 35/35 passing |
| **CLI** | `scripts/recoveryScan.ts`, `waitForReady.ts`, `smokeTest.ts`, `validateEnvironment.ts`, `issueCredentialToken.ts` (new, X.16) | No dedicated unit test files (matching existing precedent for thin CLI wrappers); `issueCredentialToken.ts` was verified live across all four branches during Step 4 (not re-run this session, no code changed since) |
| **Deployment** | `x95-deployment-ops-architecture.test.ts` (checks `deployment/deploy.sh`/`rollback.sh` reuse `scripts/` correctly) | Re-run fresh as part of the full architecture guard suite this session, passing |
| **Total repository statistics** | **553 test files, 14,873 tests, 14,870 passed, 3 skipped, 0 failed** | Re-run fresh this session, clean on the first run (no flake encountered) |

Skipped tests remain exactly the 3 `TEST_DATABASE_URL`-gated integration tests (Docker/Postgres
unavailable in this environment) — unaffected by, and unrelated to, X.16.

---

# 5. Repository Metrics

| Metric | Value | Verified via |
|---|---|---|
| Source files (`.ts`/`.tsx`, excluding tests) | **587** | `find src -name "*.ts" -o -name "*.tsx" \| grep -v __tests__ \| wc -l` |
| Test files | **553** (548 in `src/__tests__/` + 5 in `src/tests/`) | direct count, cross-confirmed by the Vitest run itself |
| E2E test files (Playwright, separate suite) | **1** | `find e2e -name "*.ts"` |
| Architecture guards | **35** | direct count + fresh run |
| `package.json` dependencies | **14** runtime, **22** dev — **zero new since X.14** (`dotenv` was the last new addition) | `node -e` inspection of `package.json` |
| Top-level `src/` modules/entries | **58** | `ls src \| wc -l` |
| `PROJECT_KNOWLEDGE_SYSTEM/` documentation | **104** files | `find ... -name "*.md" \| wc -l` (up from 100 at the post-X.15 baseline audit — +4: `X16_PROTOCOL_DECISION.md`, `X16_SCOPING_REPORT.md`, `PHASE_X16_CREDENTIAL_REPORT.md`, `PROJECT_BASELINE_AFTER_X16_AUDIT.md` itself will make it +5 once written) |
| `app/docs/` documentation | **33** files | direct count |
| `app/.memory/` (legacy governance system) | **26** top-level `.md` files | direct count, still dated 2026-07-05 |

---

# 6. Remaining Roadmap

Per `POST_X14_ARCHITECTURE_AUDIT.md`'s original suggested roadmap (re-confirmed still the most
current source — no later document supersedes it), with effort/risk re-assessed in light of
X.16's completion:

## Phase X.17 — Docker/Postgres Live Verification

- **Objective:** Run `docker compose --profile app up`, apply all 4 pending Prisma migrations
  against a real PostgreSQL instance, and execute every `TEST_DATABASE_URL`-gated integration test
  for real. Closes the single largest "implemented but never run for real" gap on the platform,
  now 8 phases deep (X.9.4 through X.16).
- **Estimated effort:** Small–Medium, *once Docker is actually available in the working
  environment* — the code/config side is already complete and has not needed a single change
  across 8 subsequent phases.
- **Expected files:** None, if the existing Docker/Compose/migration files are correct (the
  expected outcome, per repeated non-live validation); possibly minor fixes to
  `docker-compose.yml`/migration ordering if a real run surfaces something the non-live
  validation couldn't catch.
- **Risks:** Entirely environment-dependent — the technical risk is low, but the milestone is
  fully blocked until Docker is provisioned, a prerequisite outside this repository's own control.
- **Dependencies:** None code-side. Environment availability only.

## Phase X.18 — CI/CD Pipeline

- **Objective:** GitHub Actions running `tsc --noEmit`, the architecture guard suite, and the full
  test suite on every PR — converting 16 phases of manual discipline into a tooling-enforced gate.
- **Estimated effort:** Medium.
- **Expected files:** `.github/workflows/*.yml` (new), no application code changes anticipated.
- **Risks:** Low — this is additive tooling with no code-behavior implications. The main risk is
  configuration drift (e.g., matching the exact `pool=forks` requirement already documented for
  this test suite's own jsdom-parallelism constraint).
- **Dependencies:** None.

## Phase X.19 — Exactly-Once Recovery + Optimistic Locking

- **Objective:** Add a version/`updatedAt`-based compare-and-swap to `IBaseRepository.update()`
  (repo-wide) and close the at-least-once → exactly-once gap in crash recovery.
- **Estimated effort:** Medium–Large — the one roadmap item plausibly requiring a change to
  currently-frozen X.11 persist-path code.
- **Expected files:** `src/shared/repository/IBaseRepository.ts` and every implementing
  repository (potentially dozens, given 85 Prisma models); `src/runtime/recovery/*.ts` for the
  exactly-once completion logic.
- **Risks:** Medium — touches a broad, currently-frozen surface; needs its own explicit,
  carefully-scoped authorization rather than being bundled into another milestone, per the
  existing roadmap's own caution.
- **Dependencies:** Recovery-producer wiring (logically related — exactly-once semantics matter
  more once the producer is actually creating markers — but not formally blocking; X.19 could
  proceed independently).

## Phase X.20 — Knowledge Platform Persistence Migration (need-driven only)

- **Objective:** Migrate the Knowledge Platform from in-memory to Prisma-backed storage, with a
  real indexing strategy, if and when distributed/10,000+-item/high-concurrency deployment
  becomes an actual near-term requirement.
- **Estimated effort:** Large — the biggest single item on the entire roadmap.
- **Expected files:** New Prisma models for every Knowledge Platform entity type, new
  repository implementations, a migration/indexing strategy design (currently nonexistent, a
  named pre-existing gap).
- **Risks:** High if undertaken prematurely — this is explicitly a "not needed for anything
  smaller" item; starting it without a real scale requirement would be speculative engineering
  this project's own 16-phase discipline has consistently avoided elsewhere.
- **Dependencies:** X.17 (a live Postgres instance must exist before this can be built against
  one for real).

---

# 7. Overall Project Completion

**Overall: approximately 84%** toward a fully production-hardened, live-verified,
CI/CD-gated AI Runtime platform.

Basis for this figure: architecture and core AI Runtime functionality (reasoning, tool calling,
MCP, multi-agent, conversation persistence, authorization, now credential verification) are
essentially complete and stable — every phase from X.1 through X.16 froze clean, with zero
regressions found across three independent audits this week. What remains is concentrated in a
small number of large, well-understood, already-scoped gaps rather than diffuse unknowns: live
database verification (X.17, blocked on environment only), CI/CD (X.18, purely additive), and two
lower-priority items (X.19, X.20) that are correctly deferred pending real need. The +2 percentage
points versus the post-X.15 estimate (~82%) reflects X.16 closing the credential-verification gap
without introducing any new architectural debt, offset slightly by this audit's own new finding
(replay protection) adding one small, previously-uncounted item to the ledger.

---

# 8. Final Recommendation

## A. Repository is production-ready. Proceed to Phase X.17.

**"Production-ready" here means, precisely, what this repository's own 16-phase discipline has
always meant by it — not "safe to expose to untrusted internet traffic today" (that claim remains
explicitly false and is not made here or anywhere else in this project's history), but "the
architecture, code, and test/governance discipline are sound, complete for their current scope,
and stable enough to proceed to the next planned phase without further code-level review."** The
evidence for this, gathered directly in this session, not assumed:

- Zero layering violations found anywhere in the inspected surface, for the third consecutive
  independent audit this week (`PROJECT_BASELINE_AFTER_X15.md`, `PRE_X16_ARCHITECTURE_REVIEW.md`,
  this one) — the architecture is not merely claimed stable, it has been repeatedly, independently
  re-verified stable.
- 553 test files, 14,870 passing, 0 failures, clean on the first run this session — no flake, no
  regression.
- 35/35 architecture guards passing, including four governance exceptions (GX-001–004), each
  fully documented with rationale, and each re-verified passing fresh this session.
- The one real new finding this audit surfaced (no replay protection) is a **named, bounded,
  already-partially-mitigatable gap** (short TTLs today; a proper nonce mechanism is a well-
  understood, addable primitive) — not evidence of structural instability, and not something that
  benefits from another round of pure code review. It is recorded here for whoever scopes the
  next credential-related milestone.

**Not B**, because there is no evidence that a further baseline checkpoint — as opposed to an
actual environment change — would surface anything new. This is the third baseline-style audit in
one week, and each has independently confirmed the same stable architecture; a fourth would be
process overhead, not risk reduction. X.17's entire purpose is an *environment* verification step
(Docker/Postgres), not a *code* one — the correct next action is to pursue that environment
availability directly, not to gate it behind more paperwork the code has already earned.

**Not C**, because nothing in this or any prior audit found a structural defect. The governance-
exception process (GX-001–004) is itself evidence the architecture handles its own edge cases
correctly: every time a genuinely new problem class appeared (guard brittleness at X.15, a second
instance at X.16), it was diagnosed to a root cause, resolved with a minimal, documented exception,
and never required touching a frozen file's actual behavior. A codebase that repeatedly resolves
friction this cleanly is not a candidate for redesign.

---

*End of audit. No source code, tests, documentation, ADRs, or milestone documents were modified.
No commits, branches, or tags were created. `CURRENT_RELEASE.md`/`CURRENT_MILESTONE.md`/
`MILESTONE_HISTORY.md` were not touched. Phase X.17 was not started.*
