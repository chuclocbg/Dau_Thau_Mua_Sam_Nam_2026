# Knowledge Update Backfill

**Purpose:** Append-only record of lessons learned from completed Runtime Contract / Runtime
Iteration slices, per Product Spec §35's mandatory Knowledge Update step. Each entry below is
tied to one specific, already-committed slice. **Append only — never rewrite a historical entry.**
Future updates add a new `## Runtime Iteration N Slice M` section below the last one.

---

## Runtime Iteration 2 Slice 1 — Reportable-execution signal recorder

**Authoritative source:** commit `27a8a5f` (`Runtime Iteration 2 Slice 1: add observational
reportable-execution signal recorder`), pushed to `develop`, GitHub Actions run `29576394981`
(conclusion=success).

### What was implemented

Two additive changes and one new artifact, exactly matching `SLICE1_PRE_IMPLEMENTATION_
DISCLOSURE.md`'s scope:

- `app/scripts/lib/governanceRuntime.ts`: a new `SignalRecord` interface and a new
  `writeSignalRecord()` function — structurally modeled on the existing `writeReport()`'s
  append-only, never-overwrite behavior, but targeting a distinct file.
- `app/scripts/verifyPushState.ts`: a new read-only helper, `readPreviousReviewLogEntryContent()`;
  computation of three raw signals (the invocation's `triggeredBy` value; whether this
  execution's Check-verdict content differs from the immediately preceding `REVIEW-3` entry in
  `REVIEW_LOG.md`; whether a new, optional `--explicit-intent` CLI flag was passed); one new,
  additive call to `writeSignalRecord()` in `main()`.
- `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REPORTABLE_EXECUTION_SIGNALS.md`: a new, decoupled,
  append-only diagnostic file, created automatically on first write, accumulating one entry per
  real invocation.

None of the three raw signals gates, suppresses, or alters `writeReport()`, any of the three
existing Checks, or the exit code. No reportable-execution semantic (trigger-based, content-based,
or explicit-intent-based) was chosen, favored, or implemented.

### Why this implementation remained Runtime Contract compliant

- `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md` itself was never modified, extended, or
  reinterpreted; the slice operated entirely outside its five-phase Implementation Order table.
- `writeReport()`'s function body is byte-for-byte unchanged; `REVIEW_LOG.md`'s format, its
  append-only writer, the three existing Checks' logic, and the exit-code contract
  (`0` iff every Check's `ok` is `true`) are all untouched.
- `governance-rules/REGISTRY.md` and `REVIEW-3.md` were not touched — no new or modified
  `RuleDefinition`.
- Placing `writeSignalRecord()` inside `governanceRuntime.ts` (a file Contract Phase 1 created)
  was explicitly disclosed as this slice's own placement choice, not an exercise of Contract
  authority — a distinction a pre-commit self-review caught and corrected before implementation
  began (see Pitfalls, below).
- The entire change is additive: two files gained new, non-overlapping code; one file was newly
  created. A single `git revert 27a8a5f` removes all of it cleanly.

### Verification evidence

- `npx tsc -b`: zero errors attributable to either touched file (all reported errors were
  pre-existing, unrelated `src/` debt).
- Architecture guard suite: 35 files / 334 tests passing, both locally and in CI — matches the
  pre-slice baseline exactly.
- Full test suite: locally, 14,874 passed / 3 skipped / 2 failed (the known, pre-existing
  `prisma validate` timeout flake, `x10-prisma-integration.test.ts` and `x13-prisma-recovery-
  repository.test.ts`); in CI run `29576394981`, the full test suite reported success cleanly —
  the flake did not trigger that run, consistent with its already-established timing-dependent,
  non-deterministic nature, not a new regression.
- Non-vacuous append-only check: two real local invocations produced two distinct, correctly
  formed entries in `REPORTABLE_EXECUTION_SIGNALS.md`, not an overwrite.
- Parity check: `git diff` on `REVIEW_LOG.md` prior to commit showed insertions only, zero
  deletions — every pre-existing entry preserved byte-for-byte.
- Final commit `27a8a5f`: exactly three files changed, 110 insertions, 0 deletions.
- `git status` confirmed exactly the three declared files in the diff at every checkpoint.

### Implementation pitfalls encountered

- **Ordering matters when reading state a sibling writer is about to mutate.** The
  content-differed signal must capture `REVIEW_LOG.md`'s prior entry *before* `writeReport()`
  appends the current run's own entry — reading afterward would make each run's content appear
  to trivially differ from itself. Solved by computing `previousReviewLogContent` immediately
  before, not after, the `writeReport()` call.
- **A pre-implementation self-review caught real Contract-authority overreach language twice**,
  in two separate paragraphs of the disclosure draft, before any code was written: describing
  `governanceRuntime.ts` as Contract Phase 1's "designated home for exactly this kind of shared,
  cross-rule infrastructure" overstated Phase 1's actual, narrow scope (extracting `REVIEW-3`'s
  own existing pieces) and risked implying Contract sanction for a non-Contract-authorized
  addition. Both occurrences were rewritten to state plainly that the placement was this slice's
  own choice, not Contract authority, before implementation began.
- **A separate, earlier self-review on `RUNTIME_CAPABILITY_SURFACE_SELECTION.md`** caught a
  premature directory-fixing issue (pinning the new artifact to `PROJECT_KNOWLEDGE_SYSTEM/
  04_PROJECT_MEMORY/` before that decision belonged to this slice's own pre-implementation
  disclosure) — resolved by deferring the exact path to the disclosure stage, where it correctly
  belonged per `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` Part 4's own requirement that a
  pre-implementation disclosure, not an earlier planning document, name exact files.
- **`REVIEW_LOG.md` continued growing from activity outside this session's own explicit actions**
  during implementation (entry count moved from 8 to 10 from this slice's own two verification
  runs, and further afterward) — empirical, first-hand confirmation of the Evidence Pack's
  earlier finding that this file has no programmatic reader anywhere and is written to by
  whatever invokes `/ci-review`, not exclusively by any single actor.

### Future guidance for later slices

- The "capture prior state before a sibling writer mutates it" ordering pattern established here
  is reusable for any future slice that needs to compare pre/post state around `writeReport()` or
  any other existing append-only writer.
- Any future addition to `governanceRuntime.ts` that is not itself Contract-authorized should
  carry the same explicit "placement choice, not Contract authority" disclaimer established in
  this slice's disclosure — treat this as a standing convention, not a one-off correction.
- `REPORTABLE_EXECUTION_SIGNALS.md` will now accumulate one real entry per genuine `/ci-review`
  invocation. A future Decision Matrix re-scoring (not planned or begun here) could cite this
  accumulated data once enough entries exist — this slice's own Exit Condition, now satisfied.
- The new `--explicit-intent` flag is real and functional but has zero real callers today — the
  sole existing call site, `.claude/commands/ci-review.md`, does not pass it, and this slice's own
  forbidden-files boundary excluded modifying that file. Do not assume `explicitIntentFlagPresent`
  reads anything but `false` in real accumulated data until a future, separate slice updates that
  command — an assumption that data reflects real caller intent today would be incorrect.
- No reportable-execution semantic was chosen by this slice, and none should be inferred from its
  existence. The three-candidate decision (trigger-based / content-based / explicit-intent-based)
  remains exactly as open as `REPORTABLE_EXECUTION_DECISION_MATRIX.md` left it.

---

## Runtime Iteration 2 Slice 2 — Reportable-execution signal summary reporter

**Authoritative source:** commit `17c8dac` (`Runtime Iteration 2 Slice 2: add reportable-execution
signal summary reporter`), pushed to `develop`, GitHub Actions run `29580854929`
(conclusion=success).

### Slice objective

Per `IMPLEMENTATION_SLICE_02_SELECTION.md` and `SLICE2_PRE_IMPLEMENTATION_DISCLOSURE.md`: make the
raw signal data already accumulating in `REPORTABLE_EXECUTION_SIGNALS.md` (Slice 1's own artifact)
observable at a glance for the first time, without deciding, scoring, ranking, or interpreting
what that data means for any candidate reportable-execution semantic.

### Final implementation summary

One new, fully self-contained, read-only script, `app/scripts/summarizeReportableExecutionSignals.ts`,
matching the disclosure's scope exactly: it locates the repository root via a direct `git
rev-parse --show-toplevel` call (duplicated rather than imported, to keep this slice independent
of `governanceRuntime.ts`), reads `REPORTABLE_EXECUTION_SIGNALS.md`, parses each entry with a
formatting-tolerant regex, and prints three symmetric aggregate counts — `triggeredBy`
distribution, `contentDifferedFromPrevious` (true/false/n-a), and `explicitIntentFlagPresent`
(true/false) — with an explicit on-screen disclaimer that no semantic is chosen or implied. The
script contains no write API of any kind and imports nothing from any other script in this
repository.

### Files changed

- `app/scripts/summarizeReportableExecutionSignals.ts` (new file only). No other file was touched
  — `governanceRuntime.ts` and `verifyPushState.ts` do not appear in the commit at all.

### Verification results

- `npx tsc -b`: zero errors attributable to the new file.
- Architecture guard suite: 35 files / 334 tests passing, both locally and in CI.
- Full test suite: locally, 554 files / 14,876 passed / 3 skipped / 0 failed — the known Prisma
  flake did not trigger during this slice's own verification runs.
- Non-vacuous check: the script was run twice against the 7 real entries accumulated in
  `REPORTABLE_EXECUTION_SIGNALS.md`; its printed counts matched an independent, `grep`-based
  manual count exactly (7 total; `triggeredBy: command` ×7; `contentDifferedFromPrevious: true`
  ×7, `false` ×0, `n/a` ×0; `explicitIntentFlagPresent: false` ×7, `true` ×0).
- No-writes guarantee: confirmed via `sha1sum` of `REPORTABLE_EXECUTION_SIGNALS.md` taken before
  and after two runs — identical both times.
- Parity check: re-ran `verifyPushState.ts` directly; exit code and PASS/FAIL pattern were
  identical to every prior run this session.
- `git status`: confirmed exactly one file in the diff at every checkpoint.
- Final commit `17c8dac`: exactly one file changed, 91 insertions, 0 deletions.

### CI result

GitHub Actions run `29580854929`: conclusion=success, all steps passed (Type-check and Lint report
success only via continue-on-error masking, as previously established/non-blocking). Full test
suite reported success cleanly in CI as well — the Prisma flake did not trigger this run.

### Rollback command

`git revert 17c8dac`.

### Lessons learned

- **A hash comparison is only meaningful if both sides use the same algorithm.** An early no-writes
  check appeared to show a mismatch because the "before" measurement used `md5sum` and the "after"
  measurement used `sha1sum` — a testing-process error, not a script defect. Re-run with a
  consistent algorithm on both sides, the hash was identical. Worth recording plainly: any future
  before/after file-integrity check must pin one algorithm for both measurements.
- **A read-only tool whose only input file is itself under a no-modify constraint cannot fully
  live-test its own "file does not exist" branch without violating that constraint.** The
  zero-entries edge case was verified by source inspection of the `!existsSync` early-return path
  instead of a live run, since deliberately removing the real, already-populated
  `REPORTABLE_EXECUTION_SIGNALS.md` to test it would itself have broken this slice's own forbidden-
  files boundary. This was disclosed explicitly rather than silently assumed proven.
- **A filename-alias discrepancy surfaced again during the independent post-implementation
  review** (`IMPLEMENTATION_PLAYBOOK.md` referenced but not present; the real file is
  `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md`) — caught and confirmed via the same
  stop-and-report discipline established earlier in this iteration, before the review proceeded.

### Reusable engineering patterns

- **Fully self-contained observability tooling.** A script that inspects another mechanism's
  output can be kept completely independent of that mechanism's own source files — importing only
  Node built-ins, never an in-repo module — which maximizes this kind of tool's own rollback
  independence. Demonstrated as a real, working pattern here, not merely a theoretical option.
- **Formatting-tolerant regex parsing of an append-only markdown log**, without a shared schema or
  parser module, is sufficient for a read-only summary tool and is reusable for any future
  observability script reading another append-only log in this repository (e.g. `REVIEW_LOG.md`
  itself), provided it stays strictly read-only.
- **Verifying a no-writes guarantee via a before/after file-hash comparison** (same algorithm both
  times) is a reusable, low-cost verification technique for any future read-only script.

### Constraints confirmed

- Contract §3's global forbidden-file list remains fully binding for Runtime Iteration 2 work,
  confirmed a second time.
- `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` Part 4's requirement that a pre-implementation
  disclosure (not an earlier selection document) commit to exact filenames was followed
  consistently again.
- The "no candidate ranking" requirement was satisfied by inheriting `RUNTIME_CAPABILITY_
  BOOTSTRAP_PLAN.md`'s own canonical signal-numbering order for presentation, rather than inventing
  a new evaluative order — checked specifically and confirmed, via independent review, not to
  constitute ranking.

### Open items intentionally left for later slices

- Per `IMPLEMENTATION_SLICE_02_SELECTION.md`'s own finding: Backward compatibility (for existing
  callers), Implementation complexity, Verification cost, and Future extensibility remain
  unresolved Decision Matrix gaps that no Slice-2-shaped candidate could close under the governing
  constraints — this remains true after Slice 2's completion.
- No Decision Matrix re-scoring has been performed using the signal and summary data now available
  from Slices 1 and 2 together — that remains a separate, human-judgment-gated activity, not begun
  here.
- The `--explicit-intent` flag still has zero real callers, unchanged since Slice 1 — `.claude/
  commands/ci-review.md` has not been updated to pass it.

---

## Runtime Iteration 2 Slice 3 — Reportable-execution signals structural validator

**Authoritative source:** commit `2c3e2af` (`Runtime Iteration 2 Slice 3: add reportable-execution
signals structural validator`), pushed to `develop`, GitHub Actions run `29583173031`
(conclusion=success).

### What was implemented

One new, fully self-contained, read-only script, `app/scripts/validateReportableExecutionSignals.ts`,
per `IMPLEMENTATION_SLICE_03_SELECTION.md`'s Candidate G and `SLICE3_PRE_IMPLEMENTATION_
DISCLOSURE.md`. It reads `REPORTABLE_EXECUTION_SIGNALS.md` and checks, per entry: all three
required fields (`triggeredBy`, `contentDifferedFromPrevious`, `explicitIntentFlagPresent`) are
present in recognized form rather than silently defaulted; entries are chronologically
non-decreasing; no `sourceId` is duplicated. `triggeredBy` is checked for presence only (its value
set is Contract-adjacent and may be extended by a future, properly-authorized phase);
`contentDifferedFromPrevious`/`explicitIntentFlagPresent` are checked against their own closed,
already-fully-known value sets, since both are owned entirely by this document chain. The script
imports nothing from `governanceRuntime.ts`, `verifyPushState.ts`, or `summarizeReportableExecutionSignals.ts`,
and contains no write API of any kind.

### What independent review found

Two independent reviews were performed — one against the pre-implementation disclosure, one
against the committed code — both concluding no correction was required. Two points were examined
closely and judged compliant rather than flagged: (1) the disclosure's verification plan specified
constructing "one" deliberately-malformed test case, while the actual verification constructed
four, covering all three named anomaly types individually — judged a non-vacuous-verification
necessity implied by the already-approved three-part capability definition, not a scope expansion;
(2) the asymmetric presence-only vs. closed-set-value checking across the three fields was judged
consistent with the disclosure's own stated risk mitigation ("does the field exist and take a
recognized value"), not a deviation from it.

### What verification proved

`npx tsc -b`: zero errors attributable to the new file. Architecture guard suite: 35 files / 334
tests passing. Full test suite (local run): 553 files passed / 1 failed — the known, pre-existing
`prisma validate` timeout flake (`x10-prisma-integration.test.ts`), unrelated to this slice.
Non-vacuous check: run against the 10 real accumulated entries in `REPORTABLE_EXECUTION_
SIGNALS.md`, reported zero anomalies; separately run, via an isolated scratch git repository
containing synthetic data (never touching the real file), against four deliberately-malformed
entries — a missing `triggeredBy` field, an unrecognized `contentDifferedFromPrevious` value, an
out-of-order timestamp, and a duplicate `sourceId` — all four were individually and correctly
flagged. Zero-write guarantee: `sha1sum` of the real `REPORTABLE_EXECUTION_SIGNALS.md` taken
before and after running the script against it — identical. `git status`: confirmed exactly one
file in the diff at every checkpoint.

### What GitHub Actions confirmed

Run `29583173031`: conclusion=success, all steps passed (Type-check and Lint report success only
via continue-on-error masking, as previously established/non-blocking). Full test suite reported
success cleanly in CI — the Prisma flake did not trigger this particular run.

### Rollback strategy

`git revert 2c3e2af` — trivial: one new, standalone file; nothing else touched; no downstream
consumer depends on it.

### Open items intentionally deferred to later slices

- `IMPLEMENTATION_SLICE_03_SELECTION.md`'s own Candidate H (a cross-log correlation checker
  between `REVIEW_LOG.md` and `REPORTABLE_EXECUTION_SIGNALS.md`) remains a documented, real
  finding — the two logs currently differ in entry count for a benign, already-explained reason
  (different start times), and a naive correlation check could produce false "drift" alarms — but
  was not selected for Slice 3 because its cutoff-determination question is an undisclosed design
  decision, not yet brought forward for its own review cycle.
- The same four Decision Matrix gaps identified after Slice 2 (Backward compatibility for existing
  callers, Implementation complexity, Verification cost, Future extensibility) remain unresolved;
  nothing in Slice 3 addresses any of them.
- No Decision Matrix re-scoring has been performed using the signal, summary, and validation data
  now available from Slices 1–3 together — that remains a separate, human-judgment-gated activity,
  not begun here.
- The `--explicit-intent` flag still has zero real callers, unchanged since Slice 1.

---

*This document is append-only. Do not edit any entry above in any future update — add a new
`## Runtime Iteration N Slice M` section below the last one instead.*
