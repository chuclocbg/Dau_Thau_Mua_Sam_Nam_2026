# Governance Engine Design — From Documentation to Executable Architecture

**Status:** PLANNING ONLY. No source, test, CI, workflow, or governance file was created or
modified. This document takes every governance rule already written down (A1's ADR
policy/Decision Budget, `REPOSITORY_RULES.md`, `KNOWN_RISKS.md`'s flake, the guard-writing
standard, `SCHEMA.md`'s ownership map) plus every rule practiced but not yet written, and
designs how each becomes a checkable, automated verification — not just prose a human re-reads
each time.

**Consolidation principle applied throughout (per this session's own "never duplicate an
existing capability" / "prefer composition over duplication" rules):** several rules below map
to the *same* underlying mechanism. Rather than design N separate checks for N rules, this
document names the shared mechanism once and lists every rule it serves — e.g. one
staged-files-diff mechanism serves three separate Repository Rules.

---

## 1. Repository Rules

**Shared mechanism (REPO-1, REPO-2, REPO-5):** one pre-commit check comparing
`git diff --cached --name-only` against (a) the files the current implementation step actually
declared it would touch, and (b) a denylist of already-known foreign-file patterns (mirroring
the regex already hand-built once in `.claude/settings.local.json`:
`orchestrator|src/memory/|generated/|\.docx$|\.png$|commit_msg`). A single check, three rules
served.

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **REPO-1** — never `git add -A`/`.` | Human/AI discipline only; enumerate files by name | Detect the *result* (unexpectedly broad staging), since the invocation itself can't be observed after the fact | pre-commit | `git diff --cached --name-only`, the step's declared file list | pass/fail + diff of unexpected files | **Block** the commit; require explicit re-staging of only intended files | Unstage (`git restore --staged`), no commit exists yet |
| **REPO-2** — diff staged vs. intended before commit | Manual `git status --porcelain` read, manual comparison | Same mechanism as REPO-1 — this rule *is* REPO-1's verification step, named separately because it's the human-facing description of the same check | pre-commit | Same | Same | Same | Same |
| **REPO-5** — clean working tree, no foreign files staged | Manual eyeballing against known-foreign patterns | Denylist match against the foreign-file regex above | pre-commit | Staged file list, denylist pattern | Match list | **Warn**, not block (foreign files are pre-existing repo state, not something this commit created — blocking would be wrong) | N/A (advisory) |
| **REPO-3** — one commit per stage, never bundled | Human/AI discipline; each implementation step is its own commit by convention | Cannot be enforced *before* a commit (there's nothing to compare against); can be enforced *after*, by checking a commit's diff against the step's own stated scope | `/review` (post-implementation) | Commit diff, the step's declared scope | Match/mismatch report | **Flag** for human review, never auto-block (a legitimately-larger step is a valid outcome, just one that needs explaining) | N/A (advisory, post-hoc) |
| **REPO-4** — never amend a published commit | Human/AI discipline; git safety protocol already followed throughout this session | Detect `git commit --amend` invocation, or detect a force-push rewriting already-pushed history | pre-commit (for `--amend`) / pre-push (for rewritten history) | The git command being run, or a comparison of local vs. remote ref history | pass/fail | **Block** outright — this one has no legitimate exception in this project's practice | N/A — the check prevents the action, nothing to roll back |

**Classification note:** REPO-1/2/5 are effectively one mechanism; REPO-3/4 are genuinely
distinct (one is post-hoc/advisory, one is a hard pre-action block).

---

## 2. Architecture Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **ARCH-1** — frozen-zone protection | Manual re-reading of `CURRENT_MILESTONE.md`'s prose `do_not` block against staged files | Diff staged files against a structured, machine-readable frozen-path list (roadmap milestone A7 — a prerequisite for this rule's automation, not yet built) | pre-commit, `/architecture-review` | Staged files, structured frozen-path list | Match list + which milestone authorizes each match, if any | **Block**, with an explicit override requiring the human to name which newly-approved milestone or GX-exception justifies the touch | Unstage the frozen-path files; no commit exists yet |
| **ARCH-2** — dependency-direction enforcement (`Interface → Application → Domain → Repository Interfaces → Memory\|Prisma Repositories`) | Manual review during architecture guard writing; enforced today only by the existing architecture guard *test files* themselves | Extend the existing architecture guard suite (already does this per-module) into a repo-wide static import-graph check | CI (extends the already-existing "Architecture guard suite" step) | Import graph (derivable via a TS AST walk or an existing tool) | Violating-import list | **Block** (this is the one architecture rule this project already partially automates — the extension is repo-wide coverage, not a new mechanism) | Standard code revert |
| **ARCH-3** — guards assert presence, not exact literal/count | Manual review at guard-authoring time; stated once in `ADR_X15_ARCHITECTURE_DECISION.md`, not enforced anywhere | A heuristic lint pass over `*architecture*.test.ts` files flagging exact-count/exact-literal assertions (`toBe(N)`, `toEqual([...])` against something documented as additively-growing) | `/review`, AI review | New/changed architecture guard file content | Flagged assertion lines | **Warn**, never auto-block — this needs human judgment about which assertions are genuinely meant to be exhaustive vs. accidentally brittle | N/A (advisory) |
| **ARCH-4** — the 10 binding constraints (C-01–C-10 in `ARCHITECTURE_CONSTRAINTS.md`) | Manual review, case by case (e.g. "is this a bigint," "is this a `LegalBasis[]`") | Varies per constraint — some are mechanically checkable (C-02 money-is-bigint via a type-level or grep-based check for `number` in files touching money), others require real code understanding (C-05's "AI layer speaks only AIContext") | Mixed: mechanically-checkable ones at CI or pre-commit; judgment-requiring ones at `/architecture-review`/AI review only | Diff content | Per-constraint pass/fail or "needs human judgment" | Mechanical ones: **block**. Judgment ones: **flag for `/architecture-review`** | Standard code revert |

---

## 3. ADR Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **ADR-1** — the 7-question trigger checklist | AI reasons through the 7 questions from memory at every milestone kickoff | The 7 questions are now written down (A1); a `/architecture-review` command surfaces them and requires an explicit yes/no answer to each, logged | `/architecture-review` | The proposed change's description/diff | 7 recorded answers + a derived verdict | If any answer is "yes" and no ADR exists yet: **block implementation from proceeding**, not just warn — this is the one ADR rule with real teeth | N/A — a decision gate, nothing to roll back |
| **ADR-2** — exactly one ADR when triggered, before implementation continues | Human/AI judgment on ADR content quality | Cannot be fully automated (an ADR's *content* quality is a judgment call) — automatable part is presence-checking ("does a matching ADR file exist before the implementation commit") | `/review` (post-hoc presence check) | Commit list, ADR-1's recorded "yes" answers | Presence/absence | **Block** the freeze step if a triggered-but-missing ADR is detected | N/A |

---

## 4. Decision Budget Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **BUDGET-1** — ≤8 files / no API / no architecture / no migration / no dependency / no security → autonomous | AI self-assesses against the budget from memory before implementing | `/architecture-review` computes the *file-count* half mechanically (trivial); the other five criteria (API/architecture/migration/dependency/security) require the same judgment as ADR-1's checklist — **this rule and ADR-1 should share one evaluation step, not two**, since both ask overlapping questions about the same proposed change | `/architecture-review` (pre), `/review` (post, confirming actual diff matched the pre-assessment) | Proposed/actual diff | Budget verdict + criterion-by-criterion breakdown | **Block** autonomous implementation if any criterion fails; require explicit human approval | N/A |
| **BUDGET-2** — exceeding budget → stop and ask, per batch | Already the standing instruction this entire session | Same mechanism as BUDGET-1 — this is BUDGET-1's failure-behavior stated as its own rule, not a separate check | Same | Same | Same | Same as BUDGET-1's failure behavior | N/A |

---

## 5. Documentation Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **DOC-1** — a document exists only if it answers something git/CI/source can't | AI judgment call at the moment of deciding to write a document | Genuinely hard to automate well (requires understanding what a document *says*, not just its existence) — the only mechanically-useful partial signal is a heuristic: flag a new doc that is >X% direct quotation of `git log`/CI output with no original analysis | AI review only (weak automation candidate — flag, don't gate) | New document content, recent git/CI output | A "mostly-restated-output" warning | **Warn only** — false positives here would be actively harmful (blocking a genuinely valuable document because it happens to quote git output) | N/A |
| **DOC-2** — one owning file per fact, no duplicate trackers | Manual awareness of `SCHEMA.md`'s ownership map (which itself needs to exist and stay current — Gap Analysis found it does exist but its subject content went stale) | Grep-based duplicate-claim detection: does a new/edited doc assert a "current status" or "current debt count" that another file, per `SCHEMA.md`'s ownership map, already owns? | `/review` | New/edited doc content, `SCHEMA.md`'s ownership map | Duplicate-claim list | **Flag** — this is exactly the check that would have caught the `app/.memory/project-status.md` duplication before it went stale for 20 milestones | N/A |
| **DOC-3** — freeze reports are mechanical evidence + human narrative, never restated CI/git output | AI judgment at freeze-writing time | Same heuristic as DOC-1, scoped specifically to freeze commits | `/freeze` | Freeze document draft | Restated-output warning | **Warn only**, same reasoning as DOC-1 | N/A |

---

## 6. CI Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **CI-1** — `tsc -b`, never bare `tsc --noEmit` | **Already automated** — fixed in `.github/workflows/ci.yml` at X.19 | A regression-guard: a pre-commit/CI check on `.github/workflows/ci.yml` itself, asserting the Type-check step's `run:` line matches `tsc -b`, not `tsc --noEmit` | pre-commit (on workflow-file diffs), CI (self-check) | `ci.yml` content | pass/fail | **Block** a regression back to the broken invocation | Standard revert |
| **CI-2** — full suite uses `--pool=forks` | **Already automated** — fixed in `package.json` at X.18 | Same shape as CI-1: a regression-guard asserting `package.json`'s `test` script retains `--pool=forks` | pre-commit (on `package.json` diffs) | `package.json` content | pass/fail | **Block** a regression | Standard revert |
| **CI-3** — new CI steps default `continue-on-error: true` when pre-existing debt would redden the pipeline | Human/AI judgment, decided twice already (X.18 lint, X.19 type-check) | Cannot be fully mechanized (requires knowing whether debt currently exists for what the new step checks) — the automatable part is a workflow-diff reminder: any new step added to `ci.yml` without `continue-on-error` triggers a prompt asking "has this been verified against a zero-error baseline?" | `/architecture-review` (on workflow-touching changes), or a before-workflow-change hook | `ci.yml` diff | Reminder/checklist | **Warn**, require explicit human confirmation before merge | N/A |
| **CI-4** — flip to blocking only on a confirmed zero-error baseline | Human/AI judgment | The confirmation itself *is* mechanizable: run the relevant command, assert zero errors, only then is flipping `continue-on-error` to `false` permitted | `/architecture-review`, CI | The specific check's current output | pass/fail (zero errors or not) | **Block** the `continue-on-error: false` change if the baseline isn't actually zero | Standard revert (flip back to `continue-on-error: true`) |

---

## 7. Review Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **REVIEW-1** — Architect / Reviewer are procedurally distinct checkpoints | Currently performed by the same session sequentially, not enforced as procedurally separate | A workflow-level check: has `/architecture-review` (pre) run for this change before `/review` (post) is invoked? | `/review` (checks for `/architecture-review`'s prior output) | Review-history log (roadmap F2) | Presence/absence of the prior checkpoint | **Warn** if `/review` runs with no matching `/architecture-review` on record — not a hard block, since retrofitting review onto already-completed work is sometimes legitimate | N/A |
| **REVIEW-2** — flake-handling protocol (rerun ≤3x, compare which file(s) vary) | Manual: rerun `npm test`, read output, compare failing files by eye, done 5 times this session | Fully mechanizable: run the suite, on failure check if the failing test(s) match the known-flake signature (from `KNOWN_RISKS.md`, once A4 exists), rerun up to 3x automatically, report | `/test-review`, `/verify` | Test output, the flake-signature registry | "known flake, cleared on rerun N" or "possible regression" | **Block only if** the failure persists past 3 reruns *and* doesn't match a known signature | N/A — reruns are non-destructive |
| **REVIEW-3** — post-push verification (HEAD==origin, clean tree, CI polled to completion) | Manual, every push, this entire session (`git rev-parse HEAD`, `git rev-parse origin/develop`, `git status`, then a hand-written curl polling loop) | Fully mechanizable — this is the single most repetitive, most mechanical rule in the entire list | `/ci-review`, `/freeze` | Local git state, GitHub Actions API | Sync status + CI verdict (correctly distinguishing genuine success from `continue-on-error`-masked success) | **Block** the freeze/next-step from being declared complete until all three are confirmed | N/A — read-only checks |

---

## 8. Release Rules

| Rule | Current manual process | Desired automated verification | Execution point | Inputs | Outputs | Failure behavior | Rollback behavior |
|---|---|---|---|---|---|---|---|
| **RELEASE-1** — `CURRENT_RELEASE.md` must not go stale relative to `CURRENT_MILESTONE.md` | Not currently checked at all — `CURRENT_MILESTONE.md` has self-reported this exact staleness across X.15–X.19 without it ever being caught before landing | Compare a version/test-count field in each file; flag mismatch | before-release hook, `/freeze` | Both files' content | Staleness delta | **Warn** before tagging, **block** tagging outright if the delta exceeds a threshold (e.g. more than one milestone behind) | N/A |
| **RELEASE-2** — migration policy (DB reachability → `prisma validate` → exactly one additive migration → `migrate dev` before commit) | Manual, performed correctly at X.17/X.19 by running each command in sequence by hand | Fully mechanizable except the "additive-only" judgment (mechanical: diff the new migration SQL for `DROP`/destructive statements and flag them) | before-migration hook | `DATABASE_URL`, `prisma/schema.prisma`, the new migration file | pass/fail per step | **Block** on any step failing; **flag for human review** (not auto-block) if the migration contains a destructive statement, since some destructive migrations are legitimate | Migration files are reversible via Prisma's own down-migration tooling — this rule's rollback is a property of Prisma, not of the check |

---

## Complexity, Value, and Automation Priority

| Rule | Implementation complexity | Engineering value | Automation priority |
|---|---|---|---|
| REPO-1/2/5 (shared mechanism) | Low | High — prevents a class of mistake already observed as a real, recurring risk in this repo's working tree | **Highest** |
| REPO-3 | Low | Medium — advisory only, low failure cost | Medium |
| REPO-4 | Low | High — zero legitimate exceptions, cheap hard block | High |
| ARCH-1 (frozen-zone) | Medium (needs A7's structured list first) | High — the single most-invoked judgment call across X.15–X.20 | **Highest**, gated on A7 |
| ARCH-2 (dependency direction) | Medium-High (needs a real import-graph tool) | Medium — guards already catch most violations per-module | Medium |
| ARCH-3 (guard-writing standard) | Medium (heuristic, imperfect) | High — directly caused GX-001 through GX-004 and X.19's fix | High |
| ARCH-4 (C-01–C-10) | Varies per constraint, Low–High | Medium — violations are rare once established, but costly when they happen | Low–Medium, do the cheap ones (C-02) first |
| ADR-1 | Low (checklist already written, A1) | High — the most consequential governance decision at every milestone | **Highest** |
| ADR-2 | Low | Medium — a presence check, not a quality check | Medium |
| BUDGET-1/2 (shared) | Low (file-count half), Medium (criteria half, shares work with ADR-1) | High — governs every implementation step's autonomy | **Highest** |
| DOC-1/DOC-3 (shared heuristic) | Medium, weak signal | Low-Medium — false-positive risk on a judgment-heavy rule | Low |
| DOC-2 | Medium | High — would have prevented the confirmed `app/.memory` duplication | High |
| CI-1/CI-2 (already done) | N/A — done; only a regression-guard remains, Low | High — prevents recurrence of the single most expensive defect class on record | High (the regression-guard, not the original fix) |
| CI-3 | Medium (judgment-dependent) | Medium | Low-Medium |
| CI-4 | Low | Medium | Medium |
| REVIEW-1 | Low | Medium | Medium |
| REVIEW-2 (flake protocol) | Low-Medium | High — the single most-repeated manual judgment call (5 times) | **Highest** |
| REVIEW-3 (post-push verification) | Low | High — the single most-repeated manual mechanical process (every push, this entire session) | **Highest** |
| RELEASE-1 | Low | Medium — self-reported drift, never yet caught in time | Medium |
| RELEASE-2 | Medium | Medium-High — schema mistakes are costly, but this process is already followed correctly by hand | Medium |

---

## Implementation Order (Maximizing Engineering ROI)

Ordered by value-per-unit-complexity, consolidating shared mechanisms so they're built once:

1. **REVIEW-3 (post-push verification)** — lowest complexity, highest and most-frequently-realized
   value of anything in this design. Build first.
2. **REPO-1/2/5 (staged-files diff)** — low complexity, prevents a real, already-observed risk
   class.
3. **ADR-1 + BUDGET-1/2 (shared `/architecture-review` evaluation)** — build as one command
   answering both the 7-question checklist and the budget criteria together, since they overlap;
   low-to-medium complexity, the highest-consequence governance decision in the whole list.
4. **REVIEW-2 (flake protocol)** — low-medium complexity, directly eliminates the most-repeated
   manual judgment call (5 recurrences and counting).
5. **CI-1/CI-2 regression-guards** — low complexity, protects two already-completed fixes from
   silently regressing.
6. **REPO-4 (no-amend hard block)** — low complexity, zero legitimate exceptions, cheap to add.
7. **ARCH-1 (frozen-zone guard)** — highest standalone value in the Architecture category, but
   explicitly gated on building the structured frozen-path list first (roadmap A7) — sequence
   A7 immediately before this.
8. **DOC-2 (duplicate-claim detection)** — medium complexity, would have caught this session's
   own confirmed `app/.memory` duplication; do before any further Knowledge Platform work
   (roadmap Phase B) so backfilled content doesn't recreate the problem it's fixing.
9. **ARCH-3 (guard-writing heuristic)** — medium complexity, addresses a repeated root cause
   (GX-001–004) but is a "warn," not a "block," so lower urgency than items 1–8.
10. **RELEASE-1, CI-4, REVIEW-1, RELEASE-2, ARCH-4's cheap constraints (starting with C-02),
    CI-3** — medium value, medium complexity; batch as capacity allows, no strict internal
    ordering between them.
11. **DOC-1/DOC-3, ARCH-2, ARCH-4's judgment-heavy constraints** — lowest ROI in this design
    (weak automation signal, or high complexity relative to value); defer indefinitely unless a
    specific incident demonstrates a stronger case for them, matching this platform's own
    standing principle of not automating what should stay a human judgment call.

---

*End of design document. Per instruction, nothing was implemented: no source, test, CI,
workflow, or governance file was created or modified. Waiting for approval before implementing
any rule above.*
