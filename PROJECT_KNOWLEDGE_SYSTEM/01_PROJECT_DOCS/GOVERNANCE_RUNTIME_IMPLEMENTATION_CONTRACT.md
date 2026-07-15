# Governance Runtime — Implementation Contract

**Purpose:** translate `GOVERNANCE_ARCHITECTURE_FREEZE.md` (v1.0, frozen) into strict,
actionable implementation constraints. This document adds no design decisions of its own — every
phase, file, and rule below traces to something already specified and frozen. No architecture
document was modified to produce this contract. No TypeScript was written. No runtime component
was created.

**Scope discipline, stated once, binding for every phase below:** per the freeze's own "Runtime
Scope" section, this contract governs only the Governance Engine Runtime itself (Rule Registry,
`RuleDefinition`/`RuleExecution`/`RuleResult`/`Report`/`Validator`) — never Workflow Platform,
Review Platform, Automation Platform (hooks), AI Runtime, or Business Modules. Any implementation
step that starts to look like it belongs to one of those is out of contract and must stop (§9).

---

## 1. Implementation Order

Derived directly from `GOVERNANCE_OBJECT_MODEL.md`'s own Runtime Dependency Graph — not a new
ordering invented here:

| Phase | Name | Depends on |
|---|---|---|
| 0 | Rule Registry Scaffolding | Nothing — first phase |
| 1 | Shared Execution Infrastructure Extraction | Phase 0 (conceptually; no file dependency) |
| 2 | `RuleExecution` Formalization | Phase 1 |
| 3 | Durable `Report` (the platform's own identified critical path) | Phase 2 |
| 4 | `Validator` (Rule-Definition Validation) | Phase 0 only — could run in parallel with 1–3, sequenced last here because the Governance Engine Design's own ROI ranking places it lower than the execution/reporting path |

No phase may begin before its listed dependency's Definition of Done (§10) is met and explicit
approval for that phase has been given.

---

## 2. Allowed Files Per Phase / Files Allowed to Change

### Phase 0 — Rule Registry Scaffolding
- **Inputs:** `GOVERNANCE_ENGINE_RUNTIME.md` §1 (Rule Definition Format), §2 (Rule Registry);
  `GOVERNANCE_ENGINE_DESIGN.md`'s `REVIEW-3` table row (source data for the file's content).
- **Outputs:** the registry directory, populated with one real `RuleDefinition`.
- **Files allowed to change (new only):**
  `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/REVIEW-3.md`,
  `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/REGISTRY.md`.
- **Verification commands:** YAML-block validity check (same `js-yaml` extraction technique used
  for `ARCHITECTURE_CONSTRAINTS.md`'s A1 slice). No `tsc`/test/guard run needed — zero executable
  code touched.
- **Expected artifacts:** 2 new markdown files; zero existing files modified.

### Phase 1 — Shared Execution Infrastructure Extraction
- **Inputs:** `GOVERNANCE_ENGINE_RUNTIME.md`'s "REVIEW-3 Pieces That Become Runtime Components"
  table (the exact extraction list: `CheckResult`, `sh()`, `repoRoot()`/`currentBranch()`/
  `ownerRepoFromRemote()`, the poll-until-condition loop shape, `findMaskedStepNames()`, the
  `main()` scaffold); `app/scripts/verifyPushState.ts`'s existing code as the literal source to
  extract from — this is an extraction, never a rewrite.
- **Outputs:** a shared module holding the extracted, reusable pieces; `verifyPushState.ts`
  refactored to import from it with **byte-identical observable behavior**.
- **Files allowed to change:** `app/scripts/lib/governanceRuntime.ts` (new), `app/scripts/
  verifyPushState.ts` (modified — imports only; `checkHeadMatchesOrigin`, `checkWorkingTreeClean`,
  and the CI-check's rule-specific logic stay in this file, per the Object Model's own "`Check`
  stays rule-specific" rule).
- **Verification commands:** `npx tsc -b` (zero new errors attributable to either file); direct
  `npx tsx app/scripts/verifyPushState.ts` run, output diffed against a pre-refactor run against
  the identical repository state — must match exactly (same PASS/FAIL verdicts, same detail
  text); architecture guard suite; full test suite.
- **Expected artifacts:** 1 new file, 1 modified file, a recorded before/after behavioral diff
  showing zero change.

### Phase 2 — `RuleExecution` Formalization
- **Inputs:** `GOVERNANCE_OBJECT_MODEL.md`'s `RuleExecution`/`ExecutionContext` entries;
  `GOVERNANCE_ENGINE_RUNTIME.md` §4.
- **Outputs:** each run constructs an explicit, in-memory `RuleExecution`-shaped record (fields:
  `rule_id`, `version`, `triggered_by`, `timestamp`, `execution_context`) instead of treating
  "the script ran" as an implicit, untracked event. **Not yet persisted** — that is Phase 3.
- **Files allowed to change:** `app/scripts/lib/governanceRuntime.ts` (add the shape),
  `app/scripts/verifyPushState.ts` (construct and populate it).
- **Verification commands:** same as Phase 1, plus a field-by-field check that the constructed
  `ExecutionContext` matches the Object Model's required fields exactly (`repo_root`, `branch`,
  `owner`, `repo`, `head_sha`).
- **Expected artifacts:** 0 new files, 2 modified files (the same two as Phase 1).

### Phase 3 — Durable `Report`
- **Inputs:** `GOVERNANCE_ENGINE_RUNTIME.md` §6; `GOVERNANCE_OBJECT_MODEL.md`'s `Report` entry;
  `ENGINEERING_EVOLUTION_ROADMAP.md`'s Phase F2 (review-history log) as the designed destination.
- **Outputs:** each `RuleExecution`'s result is appended to a durable, queryable log — not only
  printed to console.
- **Files allowed to change:** `app/scripts/lib/governanceRuntime.ts` (a `writeReport()`
  function), `app/scripts/verifyPushState.ts` (calls it), ONE new log file:
  `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REVIEW_LOG.md` (per Roadmap F2's own naming).
- **Explicitly not in scope:** backfilling REVIEW-3's historical runs into the new log — the log
  starts empty and grows only from this phase's first real run onward; no historical data is
  fabricated to populate it.
- **Verification commands:** same triad as Phase 1, plus a concrete append-only check: run the
  script twice, confirm the log gains a second, distinct entry rather than overwriting the first.
- **Expected artifacts:** 1 new log file (starts empty), 2 modified files.

### Phase 4 — `Validator`
- **Inputs:** `GOVERNANCE_ENGINE_RUNTIME.md` §5; `GOVERNANCE_OBJECT_MODEL.md`'s `Validator`/
  `ValidationResult` entries, including the Revision 1 scope boundary (RuleDefinition
  well-formedness only, on-demand, never per-execution).
- **Outputs:** an on-demand check that a `RuleDefinition` file (Phase 0's output) is well-formed
  — declared script path exists and runs standalone, declared command adapter contains no logic
  beyond invoke-and-relay (heuristic).
- **Files allowed to change:** one new script, `app/scripts/validateGovernanceRule.ts`.
- **Explicitly not in scope:** registering this script itself as a new, formal Governance Rule
  (Runtime §5's own "honest recursion" note names this as a future possibility, not authorized
  here); wiring `Validator` into `verifyPushState.ts`'s own execution — forbidden by the scope
  boundary Revision 1 already established.
- **Verification commands:** run against `REVIEW-3.md` (Phase 0's output), confirm "well-formed";
  construct one deliberately-malformed `RuleDefinition` locally (never committed), confirm it is
  correctly flagged — the required non-vacuous verification case.
- **Expected artifacts:** 1 new file.

---

## 3. Forbidden Files (Global — Every Phase, No Exceptions)

- Everything under `app/src/` — this contract governs `app/scripts/` tooling only; `src/` is
  application code, out of scope for the entire Governance Engine per the freeze's Layer 9
  boundary.
- Every file under `app/src/__tests__/` or any other test directory.
- `.github/workflows/ci.yml` and every other workflow file.
- `app/package.json`, `app/package-lock.json` — zero new dependencies at any phase (every phase
  above uses only `node:child_process`, `node:fs`, `node:path`, and native `fetch`, matching
  `REVIEW-3`'s own zero-dependency precedent).
- `prisma/schema.prisma` and every file under `prisma/migrations/`.
- Every one of the 10 frozen architecture documents listed in `GOVERNANCE_ARCHITECTURE_FREEZE.md`
  — per that freeze's own Breaking-Change Policy, a frozen document is superseded by a new
  version, never silently edited during implementation.
- Any path named in `CURRENT_MILESTONE.md`'s `do_not` list.
- `.claude/commands/ci-review.md` — forbidden for Phases 0, 2, 3, 4 (its contract, "run
  `verifyPushState.ts` and relay output," does not change); Phase 1 may touch it **only** if the
  script's invocation path changes, which this contract does not authorize.

---

## 4. Public API Rules

- **The CLI contract established by `REVIEW-3` is binding**: exit code `0` = all checks passed,
  non-zero = at least one failed; human-readable console output is the default. No phase may
  change this without it being logged as a breaking change (§8).
- **`verifyPushState.ts`'s existing exported/internal function signatures become the shared
  module's public API once extracted (Phase 1)** — `sh()`, `repoRoot()`, `currentBranch()`,
  `ownerRepoFromRemote()`, `CheckResult`, `pollWorkflowRun()`, `findMaskedStepNames()` must retain
  identical names, parameters, and return shapes post-extraction. A signature change during
  extraction is not an extraction — it is a rewrite, and rewrites are out of contract for Phase 1.
- **No `--json` machine-readable output mode is authorized by this contract** — `GOVERNANCE_
  ENGINE_RUNTIME.md` §19 explicitly defers it until a real programmatic consumer exists; none
  does yet.
- **`.claude/commands/ci-review.md`'s own contract does not change** at any phase in this
  document (§3, above).

---

## 5. Runtime Invariants (Binding Across All Phases)

Reproduced from `GOVERNANCE_ARCHITECTURE_FREEZE.md`'s Architecture Invariants table. No phase may
cause a currently-**Upheld** invariant to become violated. Phases 2–4 are specifically the ones
expected to move an invariant from its current honest status toward genuinely upheld — each
phase's Definition of Done (§10) states which:

| Invariant | Status entering this contract | Phase expected to change it |
|---|---|---|
| Every `Check` belongs to exactly one `Rule` | Upheld | None — must stay upheld |
| Every `Evidence` has exactly one owner | Upheld | None — must stay upheld |
| Reports are immutable after publication | Vacuously true (no persisted `Report` exists) | Phase 3 — becomes a real, enforceable guarantee once the log is append-only |
| Neither `Validator` nor any evidence-check mutates `Evidence` | Upheld (trivially, neither runs) | Phase 4 — becomes meaningfully tested for the first time |
| The runtime never skips Validation | **Currently violated** | Phase 4 makes this checkable; this contract does not authorize *enforcing* it (no hook wiring — Automation Platform, out of scope) |
| A `RuleResult` is immutable once produced | Upheld | None |
| Exit code is `0` iff every `Check`'s `ok` is `true` | Upheld | None — Phase 1's Public API Rule protects this explicitly |
| Every `Failure`/`Warning` references exactly one `Check` | Upheld in shape; not yet built as distinct severity-tagged records | Not in scope for Phases 0–4; `REVIEW-3` only distinguishes ok/not-ok today, and this contract does not add severity-tagging |
| A rule's `rollback_behavior` is fixed at authoring time | Upheld | Phase 0 makes this a real, inspectable field for the first time (`REVIEW-3.md`'s `rollback_behavior: revert`) |
| `Validator`'s scope excludes per-execution `Evidence` checks | Upheld (stated, Revision 1) | Phase 4 must respect this by construction — see Phase 4's "explicitly not in scope" |

---

## 6. Commit Boundaries

- **One commit per phase.** Never bundled — matches every prior Vertical Slice's discipline.
- Each commit's message must state: which phase, which invariant (if any) it moves from
  vacuous/violated toward upheld (§5), and the exact verification performed (§7).
- No commit may span two phases, even if a later phase's files happen to be small enough to fit
  in the same Decision Budget batch as an earlier one.

---

## 7. Verification Required Before Every Commit

1. `npx tsc -b` — zero new errors attributable to files this phase touched (pre-existing,
   already-documented debt elsewhere in the repository is not this contract's concern).
2. Architecture guard suite (`npx vitest run --pool=forks src/__tests__/*architecture*.test.ts`)
   — must remain exactly as green as the pre-phase baseline (35 files / 334 tests as of this
   contract's writing).
3. Full test suite — must remain unaffected (these scripts sit outside `src/`, so zero test
   files are expected to reference them; a test suite regression would itself be a stop
   condition, §9).
4. A direct run of the phase's own script(s) against real repository state, per that phase's
   specific verification commands in §2.
5. `git status --porcelain`, confirming only the phase's declared allowed files changed —
   exactly the discipline `REVIEW-3`'s own implementation already demonstrated.

---

## 8. Rollback Procedure

- **Every phase's rollback is `git revert <phase's commit>`** — matches `GOVERNANCE_ARCHITECTURE_
  FREEZE.md`'s Breaking-Change Policy and `RollbackContext`'s `revert` category; no phase in this
  contract introduces `override` or `data-undo` behavior (none of Phases 0–4 block or mutate
  anything a human relies on — Phase 3's log is additive-only, Phase 4 is advisory-only).
- **Phase 1 requires a rollback drill, not just a revert**, because it refactors an
  already-shipped file (`verifyPushState.ts`): after reverting, re-run the script and confirm its
  output matches the pre-Phase-1 baseline exactly — proving the revert genuinely restores prior
  behavior, not just prior source text.
- **Phases 2–4 depend on Phase 1's file** (`governanceRuntime.ts`) — reverting Phase 1 after
  Phase 2, 3, or 4 has landed requires reverting those later phases first, in reverse order. This
  contract does not authorize skipping that sequence.

---

## 9. Stop Conditions

Implementation must halt immediately and wait for explicit human input if:

- Any verification command (§7) fails and is not fixable within that phase's own declared file
  scope.
- A phase's real file footprint would exceed the files listed as allowed for it in §2, or would
  exceed 8 files total (the standing Decision Budget threshold).
- Any forbidden file (§3) would need to change to complete a phase as specified.
- A genuine architecture inconsistency is discovered — not a bug in this contract's plan, but a
  real conflict with `GOVERNANCE_ARCHITECTURE_FREEZE.md` or any document it references. This
  requires a new Architecture Review, not a silent workaround.
- Any temptation arises to add a capability not named in this contract (a `--json` flag, a hook
  wiring, a second rule, an event emitter) — per §4/§5, these are out of contract, not merely
  deferred-but-available if convenient.
- A phase's dependency (§1) has not actually reached its Definition of Done (§10) yet.

---

## 10. Definition of Done for Every Runtime Phase

A phase is done, and the next may begin, only when **all** of the following hold — this is
`GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` §9's own Definition of Done, applied per-phase:

1. Only the phase's declared allowed files (§2) changed — verified via `git status --porcelain`,
   not assumed.
2. All verification in §7 passed, including the phase-specific commands in §2.
3. The phase's script(s) were run at least twice against real repository state, with at least one
   result demonstrating genuine behavior (not a vacuous pass) — e.g. Phase 1's before/after diff,
   Phase 3's two-distinct-entries check, Phase 4's deliberately-malformed test case.
4. Exactly one commit exists for the phase, pushed, with GitHub Actions polled to a genuine
   (not merely API-reported) completion.
5. A post-implementation report is given: summary, files changed, verification performed, commit
   hash, CI result, which invariant (if any) moved per §5, and rollback instructions.
6. Explicit human approval is given before the next phase's first file is touched.

---

## Verification: Every Referenced Document's Existence

Performed after writing, direct filesystem check, not assumed:

| Reference | Status |
|---|---|
| `GOVERNANCE_ARCHITECTURE_FREEZE.md` | EXISTS |
| `GOVERNANCE_ENGINE_RUNTIME.md` | EXISTS |
| `GOVERNANCE_OBJECT_MODEL.md` | EXISTS |
| `GOVERNANCE_ENGINE_DESIGN.md` | EXISTS |
| `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` | EXISTS |
| `ENGINEERING_EVOLUTION_ROADMAP.md` | EXISTS |
| `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md` | EXISTS |
| `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/CURRENT_MILESTONE.md` (cited for the `do_not` list, §3) | EXISTS |
| `app/scripts/verifyPushState.ts` | EXISTS |
| `.claude/commands/ci-review.md` | EXISTS |

**All 10 referenced paths confirmed present. Zero broken references in this contract.**

---

*End of implementation contract. No architecture document was modified, no TypeScript was
written, no runtime component was created. Waiting for approval before Phase 0 begins.*
