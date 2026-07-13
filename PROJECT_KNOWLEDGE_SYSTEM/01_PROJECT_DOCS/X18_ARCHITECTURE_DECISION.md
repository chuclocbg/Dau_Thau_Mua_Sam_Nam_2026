# Phase X.18 Architecture Decision — CI Strategy & ESLint Enforcement

**Date:** 2026-07-13
**Status:** DECIDED. Resolves the two open forks `X18_SCOPING_REPORT.md` §4/§10/§13 deliberately
left for explicit decision before Step 1 of that report's implementation order may begin. No
source code was written, no test was modified, no commit was created to produce this document.
**Inputs re-read for this decision:** `X18_SCOPING_REPORT.md` in full; fresh re-verification this
session of `vitest.config.ts` (no `pool` field), `package.json` (no `engines` field, existing
scripts), `eslint.config.js`'s presence, and a fresh `npx eslint .` run.

---

## 1. Decision — CI/PostgreSQL Strategy

## Gated tests remain optional (skipped) in CI. PostgreSQL is NOT added as a CI service container in this milestone.

The 3 `TEST_DATABASE_URL`-gated tests in `x10-prisma-integration.test.ts` continue to skip in CI
exactly as they do locally by default today. X.18's CI workflow verifies `tsc --noEmit`, the
architecture guard suite, and the full test suite (with the 3 tests honestly reported as
skipped) — nothing more.

**Rationale, evaluated against the actual evidence, not a default:**

- **What a Postgres service container would buy:** the 3 gated tests would run on every PR
  instead of once, manually, in one development environment (X.17). Real, but narrow, value —
  these 3 tests exercise `verifyDatabaseConnection()`/`waitForDatabaseReady()`/`withTransaction()`,
  primitives that a change to `src/persistence/` would *also* break in the existing, always-run
  unit tests and the architecture guards that already lock that directory's structure. The
  marginal regression-catching power of running these 3 specific tests per-PR, on top of what
  already runs per-PR, is real but small.
- **What it costs:** a service-container startup step, a `prisma migrate deploy` step, and a new
  class of CI failure mode this repository has never had to manage — infrastructure flakiness
  (container startup timing, network readiness inside the runner) — landing on **every single
  PR**, not just the ones touching `src/persistence/`. X.18's entire purpose is converting manual
  verification into a *more reliable* automated gate; introducing a new, occasional flakiness
  vector into that gate for the sake of 3 tests works against that purpose more than it serves it.
- **Precedent from this exact repository's own history:** `X16_PROTOCOL_DECISION.md` chose the
  stdlib-only HMAC option over three costlier alternatives specifically because the extra
  complexity bought no benefit this platform's actual, evidenced scale needed yet.
  `X17_IMPLEMENTATION_PLAN.md` itself was scoped as verification-only, explicitly warning against
  "scope creep into new persistence features once the database is finally real." The same
  discipline applies here: X.18's roadmap definition (`POST_X14_ARCHITECTURE_AUDIT.md` §8) never
  named live-database CI as part of this milestone — it is `X18_SCOPING_REPORT.md`'s own §10
  *optional extension*, not the objective.
- **Nothing is foreclosed.** This is a scope decision for *this* milestone, not a permanent
  rejection. A future, separately-scoped, small follow-up milestone (or an amendment to this one,
  if the operator later judges the value differently) can add the service container at any time —
  it requires zero prerequisite work this decision would otherwise block.

---

## 2. Decision — ESLint Strategy

## Informational only. ESLint runs in CI and its findings are visible, but the job never blocks a merge.

A CI step runs `npx eslint .` and surfaces its output in the workflow's log/summary, configured so
that a non-zero exit code does **not** fail the overall check (e.g., `continue-on-error: true`, or
piping through a step that always reports success while still publishing the findings). No
partial (changed-lines-only) gate, and no full blocking gate, in this milestone.

**Rationale, evaluated against the actual evidence:**

- **Full blocking is not feasible within this milestone's own boundary.** Fresh count this
  session: **477 errors, 1 warning, across 178 files** (out of ~587 source files — nearly a
  third of the codebase). Making lint blocking today would fail every single PR immediately,
  including ones touching none of the offending files. Fixing 477 pre-existing errors is, by its
  own nature, an application-source-code change spanning up to 178 files — explicitly outside
  this milestone's own rule ("do not modify application source code") and outside X.18's own
  scoping (`X18_SCOPING_REPORT.md` §4 names this exact number as the reason full gating is
  infeasible "without a separate grandfathering mechanism").
- **Partial (diff/changed-file-scoped) enforcement was considered and rejected for this
  milestone**, for two concrete reasons: (a) it requires either a new dependency (a diff-aware
  ESLint runner/plugin, working against this project's zero-new-dependency streak unbroken since
  X.9.4) or a hand-rolled `git diff --name-only` file list passed to `eslint` — workable
  dependency-free, but file-level (not line-level) diffing means a PR making one unrelated,
  correct one-line change to any of the 178 already-flagged files would still be blocked by
  pre-existing errors it didn't introduce, an unfair and confusing gate for a contributor to hit
  on their very first PR under the new CI. (b) It adds meaningful workflow complexity (diff
  computation, base-branch resolution in CI, a second lint invocation shape distinct from the
  simple `npx eslint .` used locally) for a milestone whose own CI/Postgres decision above was
  just resolved in favor of minimum complexity — treating lint differently without a comparably
  strong reason would be inconsistent.
- **Why informational, not simply "omit lint from CI entirely":** `KNOWN_RISKS.md` already names
  "470 pre-existing ESLint problems, never a merge gate" as a known, tracked risk (re-confirmed
  fresh this session, now 477). An informational job costs nothing (never blocks, never adds a
  new failure mode) while finally giving this number *visibility* on every PR — today it is
  invisible unless someone manually runs `npm run lint`. This is a strict improvement over the
  current "never checked in CI at all" state, at zero risk of blocking legitimate work.
- **Explicit upgrade path, named so it isn't forgotten:** once a separately-scoped ESLint cleanup
  milestone reduces the error count to zero (or near it), this decision should be revisited and
  the job flipped to blocking — this document does not claim that work as done, only names where
  it goes when it happens.

---

## 3. Expected Implementation Impact

- One new file: `.github/workflows/ci.yml`, running four steps on every pull request: (1)
  checkout + pinned Node setup, (2) `npx tsc --noEmit`, (3) the architecture guard suite, (4) the
  full test suite via `--pool=forks`, plus a fifth, non-blocking step running `npx eslint .` for
  visibility only.
- One likely small change to `package.json`: updating `"test": "vitest run"` to include
  `--pool=forks` by default, so the CI step and any local contributor's bare `npm test` both use
  the safe pool without needing to remember the flag (`vitest.config.ts` itself has no `pool`
  field today, confirmed by direct read this session).
- No change to `docker-compose.yml`, `Dockerfile`, `prisma/schema.prisma`, or any migration — the
  CI-Postgres decision above means none of these are touched by this milestone.
- No change to `eslint.config.js` — the existing configuration is reused as-is; only how its
  output is *consumed* in CI (informational vs. blocking) changes, not the rules themselves.

---

## 4. Exact Files Expected to Change

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | New. The CI workflow: checkout, Node setup, `npm ci`, `tsc --noEmit`, architecture guards, full suite (`--pool=forks`), and a non-blocking `eslint` step. |
| `package.json` | One line: `"test": "vitest run"` → `"test": "vitest run --pool=forks"`. |
| **Unaffected, confirmed by this decision:** `eslint.config.js`, `docker-compose.yml`, `Dockerfile`, `prisma/schema.prisma`, `prisma/migrations/`, every file under `src/`, every existing test file | Zero change required by either decision in this document. |

---

## 5. Security Implications

**Minimal.** No new secret is introduced — the CI workflow needs no `DATABASE_URL`,
`TEST_DATABASE_URL`, or `CREDENTIAL_SIGNING_SECRET`, since the Postgres-in-CI extension was
declined (§1). If GitHub Actions requires any token at all, it is the default,
automatically-provisioned `GITHUB_TOKEN` (read-only checkout access), not a new repository secret
requiring configuration. The informational ESLint step introduces no security surface — it reads
source code already present in the checkout and writes only to the CI log. Neither decision
touches `src/identity/`, `src/api/httpPrincipalResolver.ts`, `src/api/credentialToken.ts`, or any
other X.16 authentication/authorization component — CI/CD tooling has no relationship to the
credential-verification system, confirmed by `X18_SCOPING_REPORT.md` §7 and unchanged by this
decision.

---

## 6. Performance Implications

- **CI runtime, estimated:** `npx tsc --noEmit` (fast, seconds); the architecture guard suite
  (~6 seconds locally, confirmed this session's own repeated runs); the full test suite
  (~120 seconds locally, confirmed repeatedly this session) — a CI runner will likely be slower
  than this development machine, but the same order of magnitude; no Postgres service-container
  startup time is added, per §1's decision, keeping the workflow's total runtime close to the sum
  of these three local figures rather than adding a variable, occasionally-slow infrastructure
  bring-up step.
- **No performance impact on the application itself.** Neither decision touches runtime code —
  `tsc --noEmit` and test execution are development-time-only concerns.
- **Local developer performance unaffected or improved:** the `package.json` `"test"` script
  change (§3/§4) makes bare `npm test` behave identically to how every test invocation this
  session has already been run (`--pool=forks`) — no new slowdown, and it removes a class of
  local footgun (`npm test` without the flag risking the jsdom-parallelism crash
  `CURRENT_RELEASE.md` already documents).

---

## 7. Acceptance Criteria

In addition to every criterion already listed in `X18_SCOPING_REPORT.md` §12 (unweakened,
unsuperseded by this decision), specific to the two choices made here:

1. The CI workflow contains no Postgres/database service container, and no step sets
   `DATABASE_URL`/`TEST_DATABASE_URL` — confirmed by reading the committed workflow file.
2. The 3 `TEST_DATABASE_URL`-gated tests report as **skipped**, not failed and not silently
   omitted, in the CI test-suite step's own output — proving the "optional, not run" state is
   honest and visible, not accidental.
3. The ESLint step is present in the workflow, its own step-level outcome is visible in the CI
   run's summary (findings are not hidden), and a PR containing zero new lint violations still
   passes overall CI even though 477 pre-existing violations exist repository-wide — proving the
   "informational, not blocking" design actually holds in practice, not just in the YAML's intent.
4. `package.json`'s `"test"` script, once changed, is confirmed via a local run to reproduce the
   exact 553-file / 14,870-passed / 3-skipped / 0-failed result already established at the X.17
   freeze — proving the script change is behavior-neutral, not a silent change to what "passing"
   means.
5. The freeze report states plainly, per this document's own §1/§2, that (a) live-database
   verification in CI was deliberately deferred, not forgotten, and (b) ESLint's 477 pre-existing
   findings remain unaddressed and non-blocking by design — matching this project's unbroken
   discipline of naming every scope boundary rather than implying more coverage than exists.

---

## 8. Rollback Implications

**Trivial, for both decisions.** Since neither introduces a Postgres service container or an
ESLint-config change, there is no infrastructure or configuration state to unwind beyond the YAML
workflow file itself and one `package.json` script line — both pure, stateless text. Reverting
`.github/workflows/ci.yml` (or disabling it via GitHub's own repository settings) has zero effect
on the application, any deployed artifact, or any data. Reverting the `package.json` script change
(`--pool=forks` → back to bare `vitest run`) reintroduces the pre-existing jsdom-parallelism risk
`CURRENT_RELEASE.md` already documents but affects nothing else. **No data, schema, or
live-service rollback concern exists for either decision** — consistent with
`X18_SCOPING_REPORT.md` §11's own assessment that this milestone has the safest rollback profile
of any scoped this session, and this document's two decisions (declining the Postgres extension,
declining blocking lint) make that profile even simpler than the scoping report's own upper-bound
estimate, not more complex.

---

## 9. Governance Exception (GX) Assessment

**No new governance exception (no GX-005) is required or anticipated.** Neither decision adds a
file to any directory an existing architecture guard enumerates exhaustively — `.github/workflows/`
is referenced by zero of the 35 existing guards (re-confirmed by `X18_SCOPING_REPORT.md`'s own
review, not re-litigated here), and the `package.json` script-line change touches no file any
guard asserts exact content for. Declining the Postgres-in-CI extension specifically avoids the
one scenario `X18_SCOPING_REPORT.md` §13 flagged as a plausible (not certain) future GX trigger —
choosing not to add a new `src/persistence/`-adjacent file as part of that extension. This
decision's own scope is therefore strictly safer, GX-wise, than the more ambitious alternative it
declined.

---

*End of decision. No source code was modified. No tests were modified. No ADRs were modified. No
commits, branches, or tags were created. No milestone document was updated. Phase X.18
implementation has not begun — this document authorizes the two scope decisions only.*
