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

*This document is append-only. Do not edit the entry above in any future update — add a new
`## Runtime Iteration N Slice M` section below it instead.*
