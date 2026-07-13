# Phase X.17 — Docker/Postgres Live Verification — Report

**Date:** 2026-07-13
**Scope:** run the already-built persistence layer against a real, live Docker/PostgreSQL stack
for the first time in this repository's entire history, per `X17_IMPLEMENTATION_PLAN.md`.
Verification-only milestone — zero new business logic, zero application source code modified,
zero test file modified.

---

## What Was Verified

**Environment prerequisite (previously blocking every phase since X.9.4):** Docker Desktop was
installed and started outside this session. Root cause of the initial `docker compose up`
failure (PostgreSQL container continuously restarting) was diagnosed before any implementation
step began: `app/.env` did not exist — only the two template files (`.env.example`,
`.env.template`) were present. `docker-compose.yml`'s own header comment already documented the
required step ("Copy .env.example... to .env before running: `docker compose up -d`"); it had
simply never been performed, since Docker had never been available before. Copying the template
to `.env` resolved the container health failure completely — confirmed no defect existed in
`docker-compose.yml`, `prisma.config.ts`, or `prisma/schema.prisma`, all three read in full during
the root-cause analysis and found correct.

**Step 2/3 (stack up, migrations applied):** Performed and verified — PostgreSQL, Redis, MinIO
healthy; pgAdmin running; all 4 existing Prisma migrations
(`20260705120000_init_production_schema`, `20260710120000_add_conversation_session`,
`20260710150000_add_conversation_recovery_marker`, `20260710180000_add_session_identity_binding`)
applied cleanly via `prisma migrate deploy` against the real database — the first-ever live
application of this repository's entire migration history.

**Step 4 (gated tests, live):** The 3 previously-skipped `TEST_DATABASE_URL`-gated tests in
`x10-prisma-integration.test.ts` (`verifyDatabaseConnection() reports connected: true`,
`waitForDatabaseReady() succeeds on the first attempt`, `withTransaction() commits a trivial
read-only transaction`) all passed for real against the live container, once both
`TEST_DATABASE_URL` and `DATABASE_URL` were set — the latter was needed because
`withTransaction()` uses the production Prisma singleton (`getPrismaClient()`), deliberately
separate from the test-scoped client, per `testDatabaseBootstrap.ts`'s own documented design; not
a defect, an artifact of the first live invocation's own env-var setup. Re-running the full suite
with both variables globally exported surfaced 37 failures, all in tests specifically designed to
assert *"throws when `DATABASE_URL` is unset"* (`LRM-13`, `LRA-13`, `LRD-12`, `MF-04`–`07`,
`x10-persistence-foundation.test.ts`, and equivalent Prisma-repository suites for X.11/X.13/X.14)
— confirmed as correct, by-design test behavior, not a regression, by re-running the full suite in
the default (unset) mode and reproducing the exact pre-existing baseline.

**Step 5 (live smoke test):** A real server process (`tsx src/server/main.ts`, not `inject()`, not
a throwaway instance) was started with `DATABASE_URL` pointed at the live container.
`scripts/waitForReady.ts` succeeded on the first attempt. `scripts/smokeTest.ts`'s full 6-check
suite (`/live`, `/ready`, `/health`, `reasoning/answer`, `reasoning/batch`,
`reasoning/answer/stream` SSE) passed in full against the live, database-backed server, confirmed
by both the tool's own output and the server's own structured request log (every request
completed with `statusCode: 200`). The process was stopped cleanly afterward.

**Step 6 (conditional defect fix):** Not applicable. Zero defects were found in Steps 2–5 — the
persistence layer, built across Phase M1 and extended by X.10/X.11/X.13/X.14, behaved exactly as
its unit and architecture-guard tests always claimed it would, the first time it was actually
connected to a real database.

---

## Verification Evidence (this freeze)

- `tsc --noEmit`: clean.
- Architecture guard suite: **35/35 files, 334/334 tests** — unchanged from the X.16 baseline.
  Zero new guard, zero modified guard — X.17 introduced no new code for any guard to protect.
- Full repository test suite: **553 files, 14,873 tests, 14,870 passed, 3 skipped, 0 failures**
  on the 3rd of 3 consecutive confirming runs (1st run: 2 failures — `x10-prisma-integration.test.ts`
  and `x13-prisma-recovery-repository.test.ts`, both `execSync('npx prisma validate')` timing
  tests; 2nd run: 1 failure, different file; 3rd run: 0 failures) — the identical, pre-existing,
  load-dependent timing flake first diagnosed and accepted at the X.14 freeze, re-confirmed here
  as unrelated to X.17 (both files byte-for-byte unmodified, confirmed by `git status`).
- `git diff --stat` against the pre-freeze commit shows **zero application source or test file
  changes** — the entire milestone's diff is limited to this report and the two governance
  documents listed below.

---

## Honest Outcome Statement

**Zero defects were found.** This closes the single largest, longest-standing "implemented but
never run for real" gap named in every architecture audit since `PRODUCTION_HARDENING_AUDIT.md`
(X.9 era) through `PROJECT_BASELINE_AFTER_X16_AUDIT.md` — the persistence layer is now verified
live, not merely unit-tested. This does **not** mean every aspect of production readiness is
closed: Docker was verified live in this one development environment, not in a CI/CD pipeline
(X.18) or under real production load; the credential-verification design's own named gaps (no
token revocation, no replay protection — `PROJECT_BASELINE_AFTER_X16_AUDIT.md` §3) are entirely
unaffected by and unrelated to this milestone. Nothing here is claimed beyond what was actually
run.

---

*End of report. `develop` is frozen at this milestone's freeze commit. Phase X.18 was not
started.*
