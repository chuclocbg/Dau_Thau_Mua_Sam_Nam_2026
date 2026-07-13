# Phase X.18 Scoping Report — CI/CD Pipeline

**Date:** 2026-07-13
**Status:** SCOPING ONLY — nothing in this document is implemented, executed, or authorized to
begin. No source file was modified to produce it.
**Method:** Read directly from the current repository this session — `CURRENT_MILESTONE.md`,
`package.json`, `vitest.config.ts`, `eslint.config.js`, the absence of any `.github/` directory —
and cross-checked against `POST_X14_ARCHITECTURE_AUDIT.md`'s original roadmap (the source every
subsequent baseline audit has re-confirmed, unchanged, as the still-current roadmap). Treated the
same as X.16/X.17's own scoping process: facts re-verified from source, not carried forward
unchecked from any prior report.

---

## 1. Objective of Phase X.18

Per `POST_X14_ARCHITECTURE_AUDIT.md`'s roadmap (item 4/§8), re-confirmed as still-current by
`PROJECT_BASELINE_AFTER_X15.md`, `PROJECT_BASELINE_AFTER_X16_AUDIT.md`, and
`CURRENT_MILESTONE.md`'s own `next_active_milestone` field (all three name X.18 identically):
**stand up a GitHub Actions CI pipeline that runs `tsc --noEmit`, the architecture guard suite,
and the full test suite on every pull request** — converting 18 phases of unbroken but entirely
manual verification discipline into a tooling-enforced gate. This is a **tooling milestone, not a
feature milestone**: it adds no application capability, changes no runtime behavior, and verifies
nothing new that a human/agent hasn't already been verifying by hand at every prior freeze. Its
value is enforcement and consistency, not new functionality.

---

## 2. Exact Repository Evidence Supporting the Work

- **No CI configuration exists today**, confirmed by direct search this session: no `.github/`
  directory, no `.gitlab-ci.yml`, no `azure-pipelines.yml`, no `.circleci/` anywhere in the
  repository.
- **The remote is GitHub** (`origin` → `github.com/chuclocbg/Dau_Thau_Mua_Sam_Nam_2026`),
  confirmed via `git remote -v` — GitHub Actions is the natural, zero-new-vendor choice, requiring
  no new external account or service relationship.
- **The verification commands to gate already exist and are already the exact commands used at
  every milestone freeze this session:** `npx tsc --noEmit`; `npx vitest run --pool=forks
  src/__tests__/*architecture*.test.ts` (35 files, 334 tests, confirmed passing as of the X.17
  freeze); `npx vitest run --pool=forks` (full suite, 553 files, 14,873 tests, 14,870 passed, 3
  skipped, 0 failed at the X.17 freeze baseline).
- **`--pool=forks` is not currently the default** — confirmed by reading `vitest.config.ts` in
  full: its `test` block sets `environment`/`include`/`coverage` but no `pool` field. Every test
  invocation this entire session has passed `--pool=forks` explicitly on the command line.
  `CURRENT_RELEASE.md`'s own `known_issue` field already documents why: *"jsdom crashes with 4+
  parallel test files without --pool=forks."* **A CI workflow that runs bare `npm test` (i.e.,
  `vitest run` with no flags) would not inherit this and could crash or behave unreliably** — the
  workflow file itself must specify `--pool=forks` explicitly, or `package.json`'s own `"test"`
  script must be updated to always include it (see §5).
- **No Node version is pinned anywhere in the repository** — `package.json` has no `engines`
  field, no `.nvmrc` exists. Local Node is `v24.14.1`. CI must pick an explicit version rather than
  relying on a runner's implicit default, which can silently drift.
- **ESLint has 477 errors, 1 warning, across 178 files**, re-counted fresh this session (`npx
  eslint .`) — consistent with `KNOWN_RISKS.md`'s already-documented "~470 pre-existing ESLint
  problems, never a merge gate" (dated 2026-07-05, now re-confirmed current). **This number rules
  out including `npm run lint` as a blocking CI gate in this milestone's initial scope** without a
  separate grandfathering mechanism — see §4.
- **`package.json`'s existing scripts** (`build`, `lint`, `test`, `test:coverage`, `test:e2e`)
  already name every command a workflow would need; no new script is required, only a new
  invocation surface (the workflow YAML itself).

---

## 3. Current Baseline (After the X.17 Freeze)

- **HEAD:** `d5042de` (develop, synchronized with `origin/develop`, confirmed this session).
- **Milestone state:** `CURRENT_MILESTONE.md` — `current_milestone: "Phase X.17 -
  Docker/Postgres Live Verification - FROZEN"`; `next_milestone_status: "NOT AUTHORIZED"`.
- **Test/guard baseline:** 553 test files, 14,873 tests (14,870 passed, 3 skipped, 0 failed —
  confirmed clean on the 3rd of 3 consecutive runs at the X.17 freeze); 35 architecture guard
  files, 334 tests, all passing.
- **Governance exceptions:** GX-001 through GX-004, all applied and passing; zero outstanding.
- **Docker/Postgres:** now live-verified in this development environment (X.17) — a fact this
  milestone's own CI design should account for (see §4/§10) but must not assume is automatically
  true in a GitHub-hosted CI runner, which is a different environment entirely.

---

## 4. Scope Boundaries

**In scope:**
- A new GitHub Actions workflow (or workflows) running, at minimum, `tsc --noEmit`, the
  architecture guard suite, and the full test suite on every pull request targeting `develop`
  (and/or `main`, per operator preference — see §14 Step 1's open decision).
- Pinning an explicit Node version for the CI runner.
- Ensuring the workflow's test invocation uses `--pool=forks` (either via the workflow command
  directly, or by updating `package.json`'s `"test"` script — a genuine, small design fork worth
  deciding explicitly, not silently).

**Explicitly out of scope, named up front to prevent drift:**
- **ESLint as a blocking gate.** 477 pre-existing errors make this infeasible without first
  either fixing them all (a large, separate cleanup effort explicitly not requested) or
  grandfathering them (e.g., `eslint --max-warnings` tuning, a baseline/ignore mechanism, or
  simply not gating on lint yet). **Recommendation for this milestone: do not gate on lint at
  all in the initial workflow; add a separate, non-blocking lint job (reports but never fails
  the check) if visibility is desired, or defer lint entirely to a future, explicitly-scoped
  cleanup milestone.** This is presented as a recommendation, not a unilateral decision — an
  operator may prefer differently.
- **Running the `TEST_DATABASE_URL`-gated tests in CI.** X.17 proved these pass live against a
  real Postgres instance in *this* development environment; whether CI should provision its own
  ephemeral Postgres service container to also exercise them is a genuine, additional scope
  decision (see §10) — not assumed as part of this milestone's baseline scope unless explicitly
  chosen.
- **Deployment automation.** X.18's roadmap definition is verification-on-PR only; it does not
  include automatically deploying on merge, which would be a materially larger, separately-scoped
  milestone (not named anywhere in the existing roadmap).
- **Any application code change.** This is tooling-only; `src/`, `prisma/`, and every existing
  test file remain untouched by this milestone's own scope.
- **Any change to `docker-compose.yml`/`Dockerfile`.** X.17 already verified these live; nothing
  about CI requires touching them (CI does not need the full Compose stack unless the
  gated-tests-in-CI option above is chosen).

---

## 5. Components Expected to Change

| Component | Expected change |
|---|---|
| `.github/workflows/ci.yml` (new) | The workflow itself: checkout, Node setup (pinned version), `npm ci`, `npx tsc --noEmit`, architecture guard run, full test suite run — each as a distinct, individually-reportable step (so a PR shows *which* check failed, not just "CI failed"). |
| `package.json` | **Possibly** one line changed: `"test": "vitest run"` → `"test": "vitest run --pool=forks"`, so local and CI invocations both default to the safe pool without needing to remember the flag. This is the recommended fix (see §2) but is a genuine choice — the alternative is baking `--pool=forks` into the workflow YAML only, leaving `package.json` untouched. **Recommend changing `package.json`** since it also protects any future local contributor who runs bare `npm test`, not just CI. |
| `README.md` (if one exists at repo root, or `app/README.md`) | Possibly one new badge/line noting CI status — cosmetic, optional, not required for the gate to function. |
| **Nothing else.** | No `src/`, `prisma/`, or test file is expected to change. |

---

## 6. Components That Must Remain Frozen

Every application source file and every existing test file, without exception — this milestone's
entire premise is that verification tooling wraps around already-correct code, it does not modify
any of it. Specifically, matching every prior milestone's own "MUST remain untouched" framing:

- `src/identity/`, `src/api/`, `src/runtime/`, `src/reasoning/`, `src/mcp/`, `src/multiagent/`,
  `src/persistence/`, `prisma/schema.prisma`, `prisma/migrations/`, `src/auth/` — all of it.
- All 553 existing test files, including all 35 architecture guards and the 3 governance-exception
  literal corrections (GX-001–004) already applied.
- `docker-compose.yml`, `Dockerfile`, `deployment/deploy.sh`, `deployment/rollback.sh` — X.17
  already verified these live; no reason for X.18 to touch them unless the gated-tests-in-CI
  option (§4/§10) is explicitly chosen and requires a CI-specific Compose invocation (which would
  still not modify the existing file, only add a new CI-side invocation of it).
- `ADR_X15_ARCHITECTURE_DECISION.md` and every other existing ADR/governance document — no
  architecture decision is being revisited by this milestone.

---

## 7. Security Impact

**Low, with one concrete new consideration: CI secrets handling.** If the gated-tests-in-CI option
is chosen (§10), a `TEST_DATABASE_URL`/`DATABASE_URL` would need to exist in the CI environment —
for an ephemeral, CI-provisioned Postgres service container (the standard GitHub Actions pattern),
this is a throwaway, workflow-scoped credential with no production exposure, not a secret requiring
`repo secrets` configuration. If any *real* secret were ever needed (not anticipated for this
milestone's baseline scope), GitHub's own encrypted repository secrets mechanism is the standard,
zero-new-dependency answer — consistent with this project's own minimal-dependency discipline. No
change to `src/api/credentialToken.ts`, `httpPrincipalResolver.ts`, or any X.16 authentication
component is anticipated or appropriate — CI/CD has no relationship to the credential-verification
system.

---

## 8. Architecture Impact

**None.** CI is a wrapper around existing verification commands; it does not touch the dependency
graph, layering, or any module boundary re-confirmed clean at the X.17 freeze. No architecture
guard's assertion is affected by a workflow file existing — none of the 35 guards reference
`.github/` or CI in any way.

---

## 9. Dependency Impact

**None on `package.json`.** GitHub Actions requires no new npm dependency — `actions/checkout`,
`actions/setup-node`, and (if chosen) `postgres` as a GitHub-provided *service container* image are
all external to `package.json`'s own dependency tree, configured in YAML, not installed via npm.
This preserves the zero-new-dependency streak unbroken since X.9.4's `dotenv`.

---

## 10. Testing Strategy

1. **Baseline gate (always in scope):** `tsc --noEmit`, architecture guard suite (35 files), full
   test suite (`--pool=forks`, matching the working local invocation) — three distinct steps, so
   a PR's checks list shows exactly which one failed, mirroring this session's own "run these
   three separately" discipline used at every milestone freeze.
2. **Expected outcome, unchanged tests:** the 3 `TEST_DATABASE_URL`-gated tests remain skipped in
   CI **unless** the optional Postgres-service-container extension (below) is explicitly chosen —
   this is the honest default, matching CI's own lack of the local Docker stack X.17 verified
   against.
3. **Optional extension, a genuine scope decision for the operator, not assumed:** add a
   `postgres:17-alpine` GitHub Actions *service container* (mirroring the exact image
   `docker-compose.yml` already uses) to the workflow, set `TEST_DATABASE_URL`/`DATABASE_URL` to
   point at it, run `prisma migrate deploy` against it, and let the 3 previously-skipped tests
   run for real on every PR too — extending X.17's live verification from "once, manually, in one
   development environment" to "every PR, automatically." This is attractive (closes the gap more
   completely) but adds real workflow complexity (service container startup, migration step,
   `withTransaction()`'s own `DATABASE_URL`-vs-`TEST_DATABASE_URL` distinction already surfaced at
   the X.17 freeze) — **recommend deciding this explicitly before Step 1 of implementation**,
   the same way X.16's protocol fork and X.17's Docker-availability fork were each decided
   explicitly before code was written, not defaulted silently.
4. **No new test file is anticipated** for the baseline scope — CI is infrastructure around
   existing tests, not a new test subject in itself. If a dedicated "does the workflow file exist
   and reference the right commands" check is wanted, that would be a documentation-completeness
   assertion (an architecture-guard-*shaped* test reading `.github/workflows/ci.yml`'s own
   content), not a new application test — a plausible, small addition, not a requirement.

---

## 11. Rollback Strategy

**Trivial.** A CI workflow file is pure YAML with no runtime behavior of its own — reverting it
(or disabling it via GitHub's own UI) has zero effect on the application, the database, or any
deployed artifact. If `package.json`'s `"test"` script is changed (§5), that revert is equally
simple (`vitest run --pool=forks` → `vitest run`) and affects only how tests are invoked, never
what they assert. **No data, schema, or deployed-service rollback concern exists for this
milestone at all** — the safest rollback profile of any milestone this session has scoped,
including X.17's own (which at least touched a live database, even if only for verification).

---

## 12. Acceptance Criteria

1. `.github/workflows/ci.yml` (or equivalently named) exists and triggers on pull requests
   targeting the repository's default development branch.
2. The workflow runs, as distinct, individually-reportable steps: `npx tsc --noEmit`; the
   architecture guard suite; the full test suite — all three currently passing locally, and all
   three must also pass in the CI runner's own environment (proving the commands are portable,
   not just correct on this one machine).
3. The workflow pins an explicit Node version, matching (or a documented, deliberate choice
   relative to) the locally-used `v24.14.1`.
4. The full test suite step explicitly uses `--pool=forks` (whether via the workflow command or
   via an updated `package.json` `"test"` script — either satisfies this criterion, per §5's
   named choice).
5. A deliberately-broken PR (e.g., a trivial `tsc` type error, tested once during this milestone's
   own implementation, then reverted) is used to prove the gate actually blocks — not merely that
   it runs, but that a genuine failure is surfaced and would block a merge if branch protection is
   also configured (branch-protection configuration itself is a GitHub repository *setting*, not
   a file in this repository — noting this as a related but administratively separate action the
   milestone's own freeze report should name explicitly, matching this project's "never claim more
   than was actually done" discipline).
6. `git diff --stat` against the pre-X.18 baseline shows changes in exactly the files named in §5
   — no application source, no test file, no ADR.
7. The freeze report states plainly which of the two optional decisions (ESLint gating, §4;
   Postgres-service-container gated-tests-in-CI, §10) was chosen and why, matching every prior
   milestone's own discipline of naming scope decisions explicitly rather than defaulting
   silently.

---

## 13. Expected Governance Exceptions (GX)

**None expected.** X.18 adds no new file to any directory a guard enumerates exhaustively (the
one class of problem that has produced every GX exception so far — GX-001/002/003 from call-site
literal changes, GX-004 from a `src/api/` file-count assertion). `.github/workflows/` is a
directory no existing guard references at all, confirmed by this session's own review of all 35
guards' assertions. If `package.json`'s `"test"` script is changed (§5), no guard was found that
asserts its exact content either. **The one scenario that could surface a GX-005:** if a future
decision (not part of this milestone's baseline scope) added a new file to `src/persistence/` as
part of the optional gated-tests-in-CI extension (§10) — not anticipated, since that extension is
pure CI/workflow configuration, not application code, but named here for completeness, matching
the same "check explicitly if reached" discipline `X17_IMPLEMENTATION_PLAN.md` §13 already
established for its own analogous case.

---

## 14. Exact Implementation Order

**Step 1 — Scope decisions (governance action, not code).** Decide, explicitly and in writing
(mirroring X.16's protocol decision and X.17's Docker-availability handling): (a) target branch(es)
for the workflow trigger; (b) ESLint gating — none, non-blocking, or deferred entirely (§4); (c)
whether to add a Postgres service container to exercise the 3 gated tests in CI (§10). None of
these is decided by this scoping report on its own authority.

**Step 2 — Baseline workflow file.** Add `.github/workflows/ci.yml`: checkout, pinned Node setup,
`npm ci`, then three distinct steps (`tsc --noEmit`, architecture guards, full suite with
`--pool=forks`). Files: `.github/workflows/ci.yml` (new). Verification: push to a throwaway branch
or open a real PR and observe the Actions tab; all three steps must pass. Rollback point: delete
the file / disable the workflow — zero other effect.

**Step 3 (conditional on Step 1's decision) — `package.json` test-script update.** Change
`"test": "vitest run"` to `"test": "vitest run --pool=forks"` if chosen over a workflow-only flag.
Files: `package.json`. Verification: `npm test` locally reproduces the exact same 553/14,870/3/0
result as every `--pool=forks`-flagged invocation this session has used.

**Step 4 (conditional on Step 1's decision) — Postgres service container extension.** Add a
`postgres:17-alpine` service block to the workflow, wire `TEST_DATABASE_URL`/`DATABASE_URL`, add a
`prisma migrate deploy` step before the test-run step. Files: `.github/workflows/ci.yml` (extended,
not a new file). Verification: the 3 previously-CI-skipped tests now show as passed (not skipped)
in the Actions log.

**Step 5 — Prove the gate blocks.** Open a deliberately-broken throwaway PR (e.g., an intentional
`tsc` error), confirm the workflow fails and is visibly reported; revert/close it. Not a permanent
repository change — a one-time proof, matching Acceptance Criterion 5.

**Step 6 — Freeze.** Report (`PHASE_X18_CICD_REPORT.md`), `CURRENT_MILESTONE.md`/
`MILESTONE_HISTORY.md` update — a separate, explicitly-authorized action, not performed by this
scoping report.

---

## 15. Estimated Commits Required

| Step | Files | Estimated commits |
|---|---|---|
| Step 1 (scope decisions) | None (a decision, not code) | 0 |
| Step 2 (baseline workflow) | `.github/workflows/ci.yml` | 1 |
| Step 3 (conditional: `package.json`) | `package.json` | 0 or 1, depending on Step 1's decision |
| Step 4 (conditional: Postgres service container) | `.github/workflows/ci.yml` (extended) | 0 or 1, depending on Step 1's decision |
| Step 5 (prove the gate blocks) | A throwaway branch/PR, reverted — no lasting repository commit | 0 |
| Step 6 (freeze) | Report + `CURRENT_MILESTONE.md` + `MILESTONE_HISTORY.md` | 1 |

**Estimated total: 2 commits (minimal scope: baseline workflow + freeze) to 4 commits (full scope:
baseline workflow + test-script update + Postgres-container extension + freeze)** — the smallest,
most self-contained implementation footprint of any milestone scoped this session, consistent
with X.18's own nature as a pure-tooling, zero-application-code milestone.

---

*End of scoping report. No source code was modified. No tests were modified. No ADRs were
modified. No commits, branches, or tags were created. No milestone document was updated. Phase
X.18 implementation was not started.*
