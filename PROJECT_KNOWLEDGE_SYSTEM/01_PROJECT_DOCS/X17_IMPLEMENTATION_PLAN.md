# Phase X.17 Implementation Plan — Docker/Postgres Live Verification

**Date:** 2026-07-13
**Status:** PLANNING ONLY — nothing in this document is implemented, executed, or authorized to
begin. No source file was modified to produce it.
**Method:** Read directly from the current repository (docker-compose.yml, Dockerfile, Prisma
migrations, the gated test files themselves) and cross-checked against the seven named reference
documents — none of their claims about X.17 were taken on faith; each was re-verified against the
actual current file content this session.
**Critical environment fact, checked first, before any other planning:** `docker` is **not
installed/reachable in this session's environment** (`which docker` → not found; `docker
--version` → command not found). This is unchanged from every prior phase since X.9.4. **This
plan can be produced in full, but Phase X.17's actual execution is environment-blocked, not
code-blocked** — this distinction shapes every section below.

---

## 1. Objective of Phase X.17

Per `POST_X14_ARCHITECTURE_AUDIT.md`'s original roadmap (re-confirmed as the still-current source
by both `PROJECT_BASELINE_AFTER_X15.md` and `PROJECT_BASELINE_AFTER_X16_AUDIT.md`, neither of
which found a superseding document): **run `docker compose --profile app up`, apply all 4 pending
Prisma migrations to a real PostgreSQL instance, and execute the 3 currently-skipped
`TEST_DATABASE_URL`-gated integration tests for real.** This closes the single largest,
longest-standing "implemented but never run for real" gap on the platform — the persistence layer
has been unit- and architecture-guard-verified since Phase M1 (2026-07-05) and extended by X.10,
X.11, X.13, X.14, but never once connected to an actual database in this environment, across 8
subsequent phases (X.9.4 through X.16).

**Precisely what "verification" means here, stated up front to avoid scope drift:** X.17 is a
**verification milestone, not a feature milestone.** Its objective is to prove existing code
behaves correctly against a real database — not to add new persistence features, not to redesign
the schema, not to add new repositories. If verification surfaces a genuine bug, fixing that bug
is in scope; redesigning around a preference is not.

---

## 2. Repository Components That Will Be Modified

**Expected: none, or a very small number, and only if live verification surfaces a genuine defect
non-live validation could not have caught.** Every component X.17 touches is already built:

| Component | Current state (re-verified this session) |
|---|---|
| `docker-compose.yml` | Exists, 2 Compose profiles (`app`, `dev`), YAML-valid (per X.9.4's own freeze verification, never re-validated live) |
| `Dockerfile` | Exists (X.9.4), never built into a real image in this environment |
| `prisma/migrations/` | 4 migrations present (`20260705120000_init_production_schema`, `20260710120000_add_conversation_session`, `20260710150000_add_conversation_recovery_marker`, `20260710180000_add_session_identity_binding`), `prisma validate` passes repeatedly in this session's own test runs, never applied via `prisma migrate deploy` against a live database |
| `src/persistence/` (Prisma client, transaction helper, connectivity checks) | Logic-complete, unit-tested, never exercised against a real connection |
| `src/__tests__/x10-prisma-integration.test.ts` | Contains the 3 `TEST_DATABASE_URL`-gated tests (`describe.skipIf(!hasTestDatabase())`) — re-confirmed by direct read this session: `verifyDatabaseConnection() reports connected: true`, `waitForDatabaseReady() succeeds on the first attempt`, `withTransaction() commits a trivial read-only transaction` |
| `scripts/validateEnvironment.ts` | Exists (X.9.4), already the CLI entrypoint for pre-flight config validation |

**No application code is expected to change.** X.17's own nature (per its objective in §1) is to
*run* what exists, not *build* something new.

---

## 3. Files Expected to Change

**If live verification succeeds cleanly (the expected outcome, given repeated non-live validation
has never found a defect across 4 migrations and 8 phases):**
- None. Zero files change. The milestone's evidence is entirely *operational* (a real run,
  captured in a report), not a diff.

**If live verification surfaces a genuine, previously-undetectable defect** (only discoverable by
an actual database connection — e.g., a migration ordering issue, a constraint PostgreSQL enforces
differently than `prisma validate`'s static check, or a connection-pooling edge case):
- The specific file the defect lives in (most plausibly one of the 4 migration files, or
  `src/persistence/databaseConnectivity.ts`), fixed with the smallest possible correction.
- **No frozen file outside `src/persistence/`/`prisma/` is anticipated to need any change** —
  X.17's objective does not touch `src/identity/`, `src/runtime/`, `src/api/`, `src/reasoning/`,
  or any other Phase-X module.

**Always expected, regardless of outcome:**
- A new report document (e.g., `PHASE_X17_DOCKER_VERIFICATION_REPORT.md`), matching this
  project's own established freeze-reporting convention — produced only at the milestone's own
  freeze step, not by this plan.

---

## 4. Architecture Impact

**None anticipated.** X.17 exercises existing architecture; it does not add, remove, or
restructure any layer. The dependency graph re-verified in `PROJECT_BASELINE_AFTER_X16_AUDIT.md`
§2 (zero layering violations found across the entire inspected surface) is unaffected by running
code that already exists against a real database instead of a mocked/skipped one. If a defect fix
is required (§3), it would be a bug fix within `src/persistence/`'s existing boundary, not an
architectural change — `src/persistence/` already sits at the bottom of the dependency graph
(depends on nothing above it), so a fix there cannot introduce a new layering violation by
construction.

---

## 5. Dependency Impact

**None anticipated on `package.json`.** `@prisma/client`, `@prisma/adapter-pg`, and every other
persistence-related dependency are already installed (confirmed present in `package.json` this
session and unchanged since before X.16). X.17 does not require Prisma CLI features, drivers, or
libraries beyond what is already declared. The only "dependency" this milestone genuinely needs is
environmental: a reachable Docker daemon and, through it, a running PostgreSQL container — neither
is a `package.json` concern.

---

## 6. Security Impact

**Low, and narrowly scoped.** X.17 does not touch authentication, authorization, or the credential
system X.16 just built — `src/identity/`, `src/api/httpPrincipalResolver.ts`, and
`src/api/credentialToken.ts` are entirely outside this milestone's objective, confirmed by
`git diff`-style reasoning: none of them import from or are imported by anything in
`src/persistence/`. The one security-adjacent consideration: a real `DATABASE_URL` will need to be
supplied to this environment (via `.env`, matching the existing `loadEnvironmentSecrets.ts`
convention, or Docker Compose's own `environment:`/`env_file:` injection, already documented in
that file's own header) — this is credential *handling*, not credential *verification*, and reuses
the exact secret-loading pattern already established at X.9.4. No new secret-handling code is
anticipated.

---

## 7. Test Strategy

1. **Before any live run:** re-confirm the 3 gated tests' exact current behavior (skipped, not
   silently passing or failing) — already re-verified this session: `x10-prisma-integration.test.ts`
   line 29, `describe.skipIf(!hasTestDatabase())`.
2. **Live run, once Docker is available:**
   - `docker compose --profile app up -d --build` (or the `dev` profile, per operator choice)
     — the exact command `deployment/deploy.sh` already issues, unmodified.
   - Set `TEST_DATABASE_URL` (and `DATABASE_URL` for the app itself) to point at the real
     container.
   - Run `npx prisma migrate deploy` (applies all 4 migrations in order) — the first-ever live
     application of this migration history.
   - Re-run the full test suite with `TEST_DATABASE_URL` set: the 3 previously-skipped tests in
     `x10-prisma-integration.test.ts` become live and must pass; all 553 other test files must
     continue passing exactly as they do today (no regression from the presence of a real
     database — the memory-backed defaults must remain unaffected, since nothing in this
     milestone changes any "memory-first, Prisma opt-in" default).
   - Run `scripts/waitForReady.ts`/`scripts/smokeTest.ts` against a real running server backed by
     the live database, exactly as `deployment/deploy.sh` already sequences.
3. **Regression guard:** the existing 550 non-gated test files (553 total − 3 gated) must show
   **zero change in outcome** — this milestone activates dormant tests, it does not alter any
   currently-passing one.
4. **New tests:** none anticipated, unless a defect fix (§3) requires one to prevent regression —
   in which case, exactly one new, narrowly-scoped test for that specific defect, matching this
   project's own minimal-diff convention.

---

## 8. Architecture Guard Impact

**None anticipated.** No architecture guard in the current 35-file suite asserts anything about
live database connectivity (they assert file structure, import boundaries, and static content —
all already true regardless of whether Docker is running). Re-confirmed by reasoning from
`PROJECT_BASELINE_AFTER_X16_AUDIT.md` §2's guard inventory: none of the 35 guards reference
`DATABASE_URL`, `TEST_DATABASE_URL`, or Docker in any assertion. **If** a defect fix is required in
`src/persistence/`, the existing guards covering that directory (part of X.10's own frozen-file
verification, re-checked at every subsequent freeze including X.16's) would need to continue
passing — this is a constraint on the fix, not a reason to expect a new or modified guard.

**A new, dedicated X.17 architecture guard is plausible but not required by this milestone's own
nature** — unlike X.14/X.15/X.16, which each added *new code* needing a new guard to protect it,
X.17 adds no new code in the expected case. If the milestone's own freeze step wants a guard
proving "the live-verification evidence exists and is documented" (e.g., asserting the freeze
report contains specific keywords), that would be a documentation-completeness check, not an
architecture guard in the sense every prior one has been — recommend deferring that decision to
the freeze step itself, once the actual outcome (clean run vs. defect-fix) is known.

---

## 9. Rollback Point

**`0c5f1d4`** — the X.16 freeze commit, current `HEAD`, confirmed synchronized with
`origin/develop` this session. Since X.17 is expected to produce zero or near-zero source diff
(§3), rollback is correspondingly simple: revert any defect-fix commit in isolation (it would be
self-contained to `src/persistence/`/`prisma/migrations/`, per §2's boundary), or discard the
milestone's own report commit if the live-verification evidence itself needs revision. **No data
migration rollback concern exists for the repository itself** — the live database the verification
runs against is disposable infrastructure (a local/CI Postgres container), not a production data
store; there is nothing in this repository's own state that a failed live-verification attempt
could corrupt.

---

## 10. Acceptance Criteria

1. Docker is confirmed reachable in the execution environment (`docker --version`,
   `docker compose version` both succeed) — the literal prerequisite this plan cannot satisfy on
   its own.
2. `docker compose --profile app up -d --build` succeeds, producing a running application
   container and a running PostgreSQL container.
3. `npx prisma migrate deploy` applies all 4 migrations against the live database with zero
   errors, in the existing, unmodified order.
4. All 3 previously-skipped tests in `x10-prisma-integration.test.ts` pass for real (not skipped)
   with `TEST_DATABASE_URL` pointed at the live container.
5. The full repository test suite (all 553 files, or 553 with the 3 gated tests now
   active/counted as passed rather than skipped) shows **0 failures** — no regression in any of
   the 550 previously-passing, non-gated files.
6. `scripts/waitForReady.ts` and `scripts/smokeTest.ts` both succeed against the real, live-backed
   running server.
7. `tsc --noEmit` remains clean (trivially true if §3's "zero files change" case holds; explicitly
   re-verified if a defect-fix changes anything).
8. The architecture guard suite (35 files, or 35+1 if a documentation-completeness guard is added
   per §8) passes in full.
9. The freeze report states plainly and specifically what was verified live for the first time
   (naming the exact migrations applied, the exact 3 tests activated, the exact commands run) —
   matching this project's own unbroken discipline of never claiming more verification happened
   than actually did.
10. If zero defects were found: the report says so explicitly, closing the gap named in every
    prior audit since X.9.4. If a defect was found and fixed: the report names it, its root cause,
    and the fix, with the same rigor `CURRENT_MILESTONE.md`'s own investigation-note convention
    already establishes (e.g., the X.14 prisma-validate-timing-flake precedent).

---

## 11. Estimated Implementation Order

**Step 0 — Environment prerequisite (blocking, not this repository's own action item).** Docker
must become reachable in the execution environment before any further step can proceed. This is
not a code step and has no commit boundary.

**Step 1 — Pre-flight, non-live re-validation (can be done now, without Docker).** Re-confirm
`docker-compose.yml`/`Dockerfile` are still syntactically valid and that the 4 migrations still
pass `npx prisma validate` (already true, re-confirmed throughout this session's own test runs) —
a cheap, useful sanity check immediately before attempting a live run, catching any drift since
the last non-live validation.

**Step 2 — Bring up the real stack.** `docker compose --profile app up -d --build`. Verify both
containers are running and healthy (the existing `HEALTHCHECK` in `Dockerfile`, X.9.4, unmodified).

**Step 3 — Apply migrations live.** `npx prisma migrate deploy` against the real `DATABASE_URL`.
This is the actual first-ever live application of this repository's entire migration history —
the single most consequential action in this milestone.

**Step 4 — Run the gated tests live.** Set `TEST_DATABASE_URL`, run the full suite, confirm the 3
previously-skipped tests now pass and nothing else regresses.

**Step 5 — Smoke-test the real, live-backed server.** `scripts/waitForReady.ts` +
`scripts/smokeTest.ts` against the actual running container stack — not `inject()`, not a
throwaway instance, the same "prove it for real" discipline every HTTP-facing milestone since
X.9.1 has used.

**Step 6 (conditional) — Fix any genuine defect found.** Only if Steps 2–5 surface one; smallest
possible correction, scoped to `src/persistence/`/`prisma/migrations/` per §2/§3's boundary; its
own dedicated commit, its own before/after test evidence.

**Step 7 — Freeze.** Report (`PHASE_X17_DOCKER_VERIFICATION_REPORT.md`), `CURRENT_MILESTONE.md`/
`MILESTONE_HISTORY.md` update, matching every prior milestone's own freeze discipline exactly —
none of this is performed by this plan.

**Commit boundaries:** Steps 1–5 produce no commit if the expected clean-run outcome holds (they
are operational verification, not code changes) — the milestone's evidence is the report itself,
plus whatever real command output is captured into it. Step 6, if needed, is its own isolated
commit. Step 7 is the freeze commit(s), following the `X.16.6`-style precedent.

---

## 12. Risks

| Risk | Category | Likelihood | Mitigation |
|---|---|---|---|
| Docker remains unavailable in this environment indefinitely | Environmental | High, given 8 consecutive phases of unavailability so far | Outside this repository's own control; the plan itself does not depend on resolving this, only on being ready the moment it resolves |
| A live-only defect exists in one of the 4 migrations (e.g., an ordering or constraint issue `prisma validate`'s static check cannot catch) | Technical | Low–Medium (4 migrations is a small surface, and each has already been individually validated) | Step 6's scoped, minimal-fix process; rollback is simple (§9) since the live database itself is disposable |
| Regression in the 550 currently-passing, non-gated tests once a real database is present | Technical | Low | The "memory-first, Prisma opt-in" convention means no existing test's default behavior should change; Step 4 explicitly checks this |
| Scope creep into new persistence features once "the database is finally real" | Governance | Medium (a natural temptation once live infrastructure exists) | §1's explicit framing: X.17 is verification-only; any new feature is a separately-scoped future milestone (X.19/X.20 already exist for the plausible candidates) |
| `app/.memory/`'s continued staleness causes confusion about what "verification" already covers | Documentation | Low, already named in `PROJECT_BASELINE_AFTER_X16_AUDIT.md` | Unaffected by X.17; a pre-existing, separately-tracked item |

---

## 13. Governance Exception Expectation

**No new governance exception (no GX-005) is expected.** X.17's own nature — verifying existing
code against a real environment, adding no new files to any guard-enumerated directory — gives no
foreseeable reason for any architecture guard's file-count or call-site assertion to break, unlike
X.16's `credentialToken.ts` addition (GX-004) or X.15's `conversationRoutes.ts`/`httpServer.ts`
signature changes (GX-001–003). **The one scenario that could produce one:** if Step 6's defect
fix requires adding a new file to `src/persistence/` (rather than editing an existing one) and
some guard enumerates that directory's file count exhaustively — this is not currently known to be
the case (no such guard was found in this session's re-inspection of the 35-file suite), but should
be checked explicitly if Step 6 is ever reached, following the exact same "stop and explain before
changing anything" discipline this project has now used four times (GX-001 through GX-004).

---

*End of plan. No source code was modified. No tests were modified. No commits were created. No
milestone document was updated. Phase X.17 execution was not started — Docker's absence in this
environment means Step 0 is not satisfied, and every step from Step 2 onward is blocked pending
it.*
