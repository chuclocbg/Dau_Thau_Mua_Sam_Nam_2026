# Phase X.18 — CI/CD Pipeline — Report

**Date:** 2026-07-14
**Scope:** stand up a GitHub Actions CI pipeline enforcing the exact verification commands used at
every milestone freeze this project has ever had (`tsc --noEmit`, the architecture guard suite,
the full test suite), per `X18_SCOPING_REPORT.md` and the two forks resolved in
`X18_ARCHITECTURE_DECISION.md`. Tooling-only milestone — zero application capability added, zero
runtime behavior changed.
**Note on this document's own scope:** per explicit instruction, this freeze artifact is the report
only. `CURRENT_MILESTONE.md` and `MILESTONE_HISTORY.md` are deliberately **not** updated by this
commit — milestone declaration is a separate, subsequent action, not bundled here as it was at the
X.15/X.16/X.17 freezes.

---

## What Was Decided First

`X18_ARCHITECTURE_DECISION.md` resolved two forks `X18_SCOPING_REPORT.md` left open, both against
direct repository evidence, not by default:

1. **No PostgreSQL service container in CI.** The 3 `TEST_DATABASE_URL`-gated tests remain
   optional/skipped in CI, exactly as locally. Rationale: the marginal per-PR regression-catching
   value of 3 already-live-verified (X.17) tests did not justify introducing a new
   infrastructure-flakiness vector into every PR's gate.
2. **ESLint is informational only, never blocking.** 477 pre-existing errors across 178 files
   (re-counted fresh at decision time) made full blocking infeasible without an out-of-scope
   cleanup; partial/diff-scoped gating was considered and rejected (file-level, not line-level,
   diffing would unfairly block unrelated one-line changes to already-flagged files). An
   informational step gives this number visibility in CI for the first time, at zero risk of
   blocking legitimate work.

---

## What Was Built

**Step 1 — Baseline workflow** (`.github/workflows/ci.yml`, commit `e0003d1`): checkout, Node 24
setup, `npm ci`, `tsc --noEmit`, the architecture guard suite, the full test suite
(`--pool=forks`), and an informational (`continue-on-error: true`) lint step. Triggers on pull
requests into `develop`/`main` and on direct pushes to `develop`.

**Live verification surfaced a real, first-order defect in this very file:** the initial run
(`e0003d1`, run `29263895937`) **failed** — 30 test files could not resolve
`../../generated/prisma/client.ts` from `src/persistence/prismaClient.ts`/
`testDatabaseBootstrap.ts`. Root cause: `app/generated/` is Prisma's codegen output, correctly
untracked and never committed; a fresh GitHub Actions checkout has no such directory, and the
workflow never ran `prisma generate`. Not an implementation bug, not a Linux/Windows difference,
not a flake — a missing step in the workflow itself, and squarely Step 1's own responsibility to
fix, not a later step's concern.

**Fix** (commit `289c3a5`): added one step, `npx prisma generate`, between "Install dependencies"
and "Type-check" — no `DATABASE_URL` needed (schema-based codegen only), so this did not reopen
the no-Postgres-in-CI decision. Re-run (`29265807366`) **passed** in full, all steps green.

**Step 2 — `package.json` default** (commit `f90d30d`): `"test": "vitest run"` →
`"test": "vitest run --pool=forks"`, per the architecture decision's own resolution — protects any
local contributor's bare `npm test`, not just CI, from the jsdom-parallelism crash
`CURRENT_RELEASE.md` already documents. Verified locally across 5 consecutive `npm test` runs
(reproducing the same passing baseline each time, with only the already-documented,
load-dependent `execSync('npx prisma validate')` timing tests intermittently flaking under this
session's own repeated back-to-back full-suite load — unrelated to this change, and not seen at
all on the live, unloaded GitHub Actions runner). Live run (`29294256329`) **passed** in full.

**Step 3 — Proof the gate blocks:** no artificial break was introduced. The real history above is
itself the proof, and a stronger one than a manufactured break would have been: the identical
workflow definition genuinely failed against a real, first-order defect (`e0003d1`) and genuinely
passed once that defect was corrected (`289c3a5`), then passed again on a second, independent
legitimate change (`f90d30d`) — demonstrating the gate discriminates correctly in both directions,
using this project's own actual first bug rather than a synthetic one.

---

## Verification Evidence (fresh, this freeze)

- **`git` state:** `HEAD` = `f90d30d`, `origin/develop` = `f90d30d`, `0`/`0` ahead-behind — fetched
  and re-confirmed directly this session, not assumed.
- **Live GitHub Actions history**, re-queried fresh via the public Actions API this session:

  | Commit | Run | Conclusion |
  |---|---|---|
  | `e0003d1` (Step 1, baseline) | `29263895937` | failure (real defect, since fixed) |
  | `289c3a5` (Step 1, fix) | `29265807366` | success |
  | `f90d30d` (Step 2) | `29294256329` | success — **current `HEAD`, latest run on `develop`** |

- **Architecture guard suite:** 35/35 files, 334/334 tests passing (last confirmed live at the
  Step 2 CI run; unchanged by this report, which adds no code).
- **Working tree:** clean of anything from this milestone before this commit — only the same
  pre-existing, unrelated untracked content present throughout this session.

---

## Deliberately Not Done This Milestone

Named explicitly, not glossed over:

- **No PostgreSQL in CI** — the 3 gated tests remain skipped there, per the architecture
  decision. Not foreclosed; addable later as its own small, separately-scoped extension.
- **No blocking lint gate** — 477 pre-existing findings remain unaddressed and non-blocking by
  design, now merely visible in CI for the first time.
- **No deployment automation** — this milestone verifies on PR/push only; it does not deploy on
  merge.
- **No branch-protection configuration** — enforcing that this gate actually blocks a merge (as
  opposed to merely reporting failure) requires a GitHub repository *setting*, not a file in this
  repository, and was not configured as part of this milestone.
- **Milestone declaration itself** — per this document's own explicit scope, `CURRENT_MILESTONE.md`
  and `MILESTONE_HISTORY.md` are not updated by this commit.

---

*End of report. No application source code, test file, `package.json`, workflow file, Docker
configuration, Prisma schema, or ADR was modified to produce it. Phase X.19 was not started.*
