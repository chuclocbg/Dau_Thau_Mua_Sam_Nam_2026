# Governance Vertical Slice — Canonical Implementation Template

**Status:** PLANNING ONLY. No source, test, CI, workflow, or governance file was created or
modified to produce this document. One read-only verification was performed against
already-completed work (confirming `verifyPushState.ts` type-checks cleanly under `tsc -b`,
0 errors attributable to it) — no file was changed by that check.

This document reverse-engineers `REVIEW-3` (`app/scripts/verifyPushState.ts` +
`.claude/commands/ci-review.md` + the `.gitignore` fix, commit `be88ecd`) into the mandatory
process every future Governance Engine rule must follow. Nothing below is invented in the
abstract — every requirement traces to something that actually happened during that slice.

---

## 1. Rule Selection Criteria

REVIEW-3 was not selected freshly here — it was already ranked #1 in
`GOVERNANCE_ENGINE_DESIGN.md`'s ROI ordering, and that ranking was honored rather than
re-litigated. The criteria that ranking actually used, made explicit:

1. **Lowest implementation complexity relative to its category** — no new dependency, a shape
   (git commands + one API) already proven safe elsewhere in this session.
2. **Highest realized frequency** — the manual process it replaces was performed by hand more
   times than any other candidate rule (every push, this entire session).
3. **Self-contained** — no dependency on another not-yet-built rule or platform layer (contrast
   `ARCH-1`, explicitly gated on the not-yet-built structured frozen-path list).
4. **Non-mutating** — a read-only check has the simplest possible rollback story, making it the
   safest first slice to prove the *pattern* on, before any rule that blocks or mutates
   something is attempted.

**Rule for future selection:** the next rule chosen must satisfy all four, in this order of
weight. A rule that's high-value but depends on unbuilt infrastructure (`ARCH-1`) or requires
real blocking/override behavior (anything hook-based) should not be attempted until at least one
more read-only-check slice has validated the pattern further, or until the specific
infrastructure it depends on already exists.

---

## 2. Required Implementation Sequence

The exact order REVIEW-3 was actually built in, now mandatory:

1. **Documentation (pre-implementation disclosure)** — rule selected, why it's highest ROI,
   exact files expected, rollback complexity, architecture impact, CI impact, Decision Budget.
   Written and shown *before* any file existed.
2. **Convention check** — before inventing a format, check whether one already exists. REVIEW-3
   read a real, installed plugin's command file before writing its own; this step is not
   optional and must produce a citation (a real file path), not an assumption.
3. **Executable script** — the logic-bearing artifact, written *before* its invocation
   mechanism. Must be independently runnable (`npx tsx <script>`) without any AI agent or
   command-dispatch layer involved.
4. **Command adapter** — a thin wrapper invoking the script and relaying its output. Must
   contain zero duplicated logic; if a reviewer can find any check inside the command file that
   isn't already in the script, that is a defect, not a variant.
5. **Verification** — see §4, run against real state, at least twice, at least once with a
   non-vacuous (real-failure-catching) case.
6. **Rollback (assessed, not necessarily built)** — determine whether the rule mutates or blocks
   anything. REVIEW-3 does not, so its rollback is "trivial revert" by design, not by omission —
   this assessment must be stated explicitly even when the answer is "nothing to build."
7. **CI verification** — confirm the new files don't regress anything already checked
   (`tsc -b`, architecture guard, full suite) *and*, separately, decide whether the rule itself
   belongs inside CI (REVIEW-3's answer was no, and that answer must be justified, not assumed).
8. **Lessons learned** — captured in the post-implementation report, not deferred to a separate
   document, so they're available to the very next slice immediately.

**Discovered mid-sequence, now a permanent addition to this list:** if implementation reveals a
gap the pre-implementation disclosure didn't anticipate (REVIEW-3's `.gitignore` discovery), the
sequence does not restart — the gap is fixed within the same slice, disclosed transparently
(file count revised from 2 to 3, explained, re-confirmed against the Decision Budget), and
folded into steps 5–8 rather than treated as a separate slice.

---

## 3. Required Files

Generalized from REVIEW-3's exact three:

| File role | REVIEW-3's instance | Naming pattern for future rules |
|---|---|---|
| Executable script | `app/scripts/verifyPushState.ts` | `app/scripts/<ruleId-shaped-name>.ts` — one script per rule, matching this repository's existing `scripts/` convention (`waitForReady.ts`, `smokeTest.ts`, etc.), not a new location |
| Command adapter | `.claude/commands/ci-review.md` | `.claude/commands/<command-name>.md` — command name need not match the script filename exactly (REVIEW-3's script is `verifyPushState`, its command is `ci-review`, chosen to match the already-planned Command Library name); it must match an already-designed name from `ENGINEERING_EVOLUTION_ROADMAP.md`/`ENGINEERING_PLATFORM_V2.md` where one exists |
| Conditional: infrastructure-gap fix | `.gitignore` (narrowed) | Only if verification uncovers a genuine, blocking gap — never speculative, never bundled preemptively |

**Rule:** exactly two files are assumed at disclosure time (script + adapter); a third is
permitted only if verification discovers a real, named blocker, and must be disclosed as a
deviation, not silently folded in.

---

## 4. Required Verification Steps

In the order REVIEW-3 actually performed them:

1. **Run the script directly** against current, real repository state (not a mock, not a
   simulated fixture) — `npx tsx app/scripts/<script>.ts`.
2. **Confirm it catches a real problem**, not just that it passes. REVIEW-3 got this for free
   (the pre-existing Legal-doc deletion) — future rules without an accidental real case must
   *deliberately* identify or construct one (e.g. temporarily point the check at a known-bad
   state, locally, never committed) rather than skip this step because nothing happened to fail.
3. **Type-check the new script** — `tsc -b`, filtered for the new filename, confirming zero
   attributable errors. (This step was *missed* during REVIEW-3's own implementation turn and
   only performed retroactively while writing this template — now mandatory as step 3, not
   optional, not deferred to template-writing time again.)
4. **Commit, push.**
5. **Dogfood if the tool is self-applicable** — run the new tool against the commit that just
   shipped it. REVIEW-3's dogfood run caught a still-in-progress CI job and correctly waited 17
   polling attempts (~4.5 minutes) to a real completion, which is the strongest evidence this
   template can point to that the tool works under real, not simulated, timing conditions.
6. **Confirm the existing verification triad is unaffected** — architecture guard suite and full
   test suite still pass (implicitly covered by step 3/4's CI run for changes this small; a
   rule touching more surface should run the triad explicitly, not rely on CI alone).

---

## 5. Required Commit Structure

One commit per slice (not per file) — REVIEW-3 shipped all three files in a single commit,
correctly, because they are one indivisible unit of value (the script alone is unusable without
the adapter; the adapter alone is empty without the script; the `.gitignore` fix is what made
the adapter shippable at all). The commit message must state, in order:

1. What the slice implements, naming the governance rule ID.
2. What manual process it replaces, naming its actual prior frequency if known.
3. Each file's role, in one line each.
4. Any honest, known limitation (REVIEW-3: the `continue-on-error` masking ambiguity cannot be
   fully resolved from the API — stated plainly, not hidden).
5. What was verified, and how (not just "verified" — REVIEW-3's message named the specific real
   finding the tool caught).

---

## 6. Required Review Checklist

Before a slice is presented as complete:

- [ ] Does the script run standalone, with zero AI-agent or command-dispatch dependency?
- [ ] Does the command adapter contain zero duplicated logic (grep the adapter for any
      conditional/check that isn't just "run the script and relay output")?
- [ ] Were owner/repo/branch/paths derived from the real environment rather than hardcoded,
      wherever doing so doesn't cost meaningful complexity?
- [ ] Was a new dependency avoided if the standard library/runtime already covers the need?
- [ ] Does `git status --porcelain` after implementation show *only* the files disclosed (plus
      any explicitly-disclosed deviation)?
- [ ] Does `tsc -b`, architecture guard, and full suite remain clean (or unchanged from
      baseline) after the new files are added?
- [ ] Was the tool run at least twice against real state, with at least one non-vacuous result?
- [ ] Does the commit message state the rule ID, the replaced manual process, each file's role,
      any known limitation, and what was actually verified?

---

## 7. Failure Modes

Named from what actually could have gone wrong in REVIEW-3, plus what nearly did:

- **Silent invisibility** (materialized): a new file created inside a blanket-ignored directory
  never reaches git, and nothing about a normal `Write` operation signals this — the only
  defense is checking `git status`/`git check-ignore` immediately after creating any file
  outside the already-familiar `src`/`PROJECT_KNOWLEDGE_SYSTEM` trees.
- **Overclaimed certainty** (avoided by design, not by luck): a check that can't fully resolve
  an ambiguity (the `continue-on-error` masking case) must say so, not silently report the
  ambiguous case as a clean pass.
- **API rate-limiting** (not hit, but a real risk for any GitHub-API-polling rule): unbounded or
  too-frequent polling against the unauthenticated public API (60 requests/hour/IP) could exceed
  the limit on a busy day. REVIEW-3's 15-second interval / 40-attempt bound (~10 minutes max) is
  the reference bound future polling-based rules should match or justify deviating from.
- **Vacuous verification**: running a check only against already-clean state proves the check
  doesn't crash, not that it catches anything. REVIEW-3 avoided this only because a real problem
  happened to exist; future slices must not rely on that luck (§4, step 2).
- **Scope creep into a framework**: this template exists specifically because the user's
  instruction was "do not build a generic framework yet" — a future slice attempting to
  generalize the command-dispatch mechanism, the polling logic, or the disclosure format into a
  shared library *before* at least 2–3 more rules have been implemented this same way would be
  premature abstraction, not progress.

---

## 8. Rollback Procedure

For a read-only, non-mutating rule (REVIEW-3's category): `git revert <slice-commit>`, single
commit, no downstream dependents to consider for the first slice of a given rule.

**General procedure for any future rule, stated once here since REVIEW-3 didn't need it but the
template must cover rules that will:**
1. Determine at disclosure time whether the rule *blocks* or *mutates* anything (§2, step 6).
2. If read-only: rollback is `git revert`, full stop.
3. If blocking (e.g. a future pre-commit hook): rollback must additionally specify how an
   in-progress, legitimately-blocked action is unblocked *without* reverting the rule entirely —
   e.g. an explicit override flag or acknowledgment path, not "revert the hook to bypass it,"
   which would remove the check for everyone, not just the one legitimate exception.
4. If mutating (e.g. a future auto-backfill of a knowledge-base file): rollback must specify
   whether the mutation itself needs a separate undo from the rule's own removal — reverting the
   rule's code does not undo data it already wrote.

---

## 9. Definition of Done

A governance rule vertical slice is complete when, and only when:

1. The rule's script runs standalone and passes the review checklist (§6) in full.
2. The rule has been verified at least twice against real repository/CI state, with at least
   one run demonstrating the check actually catching something (not just passing).
3. `tsc -b`, architecture guard suite, and full test suite are confirmed unaffected.
4. The commit exists, is pushed, and CI for that exact commit has been polled to a genuine
   (not just API-reported) completion — using the rule's own tooling to verify itself, where
   the rule is a verification tool (REVIEW-3's dogfood pattern).
5. The post-implementation report names: summary, verification, files changed (including any
   disclosed deviation from the pre-implementation estimate), commit hash, CI result, lessons
   learned, and which parts are reusable.
6. Explicit human approval has been given before the next rule begins.

A slice that satisfies 1–5 but skips 6 is not done — it is unreviewed.

---

## 10. Anti-Patterns Discovered During REVIEW-3

1. **Conflating "local machine state" with "the directory local machine state happens to live
   in."** `.claude/` was ignored wholesale because *some* of its contents are machine-specific —
   but that reasoning silently swept up content (`commands/`) that was never machine-specific at
   all. The fix is always to ignore the *specific files* that are actually local, never the
   directory as a proxy for them.
2. **Trusting a tool's own transpiler run (`tsx`) as equivalent to a real type-check
   (`tsc -b`).** They are not the same — `tsx` will happily run code with type errors that
   `tsc -b` would catch. A script "running successfully" during manual testing is not evidence
   it type-checks; both must be verified, separately, and this template's own §4 step 3 exists
   because this exact gap occurred.
3. **Treating the pre-implementation file-count disclosure as immutable.** The opposite
   anti-pattern is just as real: silently expanding scope without disclosing it. The correct
   middle path — disclosed, explained, re-confirmed against budget — is what actually happened
   and is now the mandatory pattern (§2's final paragraph).
4. **Writing check logic inside the command/prompt file instead of a separate script.** Not
   committed during REVIEW-3, but identified as the failure mode the script/adapter split (§2,
   steps 3–4) exists specifically to prevent — a prompt file's logic can't be run standalone,
   can't be unit-verified the way a script can, and would have to be duplicated the moment any
   other execution point (a future pre-commit hook, a future CI step) needed the same check.

---

## Classification: Reusable / Repository-Specific / Claude-Specific / Platform-Wide

| Component | Classification | Why |
|---|---|---|
| Core check algorithm (git sync/clean-tree comparison, polling loop shape, masking cross-reference logic) | **Reusable** | Portable to any repository with git + a CI provider exposing a queryable run API; nothing procurement- or Claude-specific in the logic itself |
| Owner/repo/branch auto-derivation from `git remote`/`git rev-parse` | **Reusable** | Directly enables reuse; deliberately built this way rather than hardcoded |
| Zero-new-dependency preference (native `fetch` over a library) | **Reusable** | A general engineering discipline, applies anywhere Node 18+ is available |
| `.github/workflows/ci.yml`'s exact path and the specific step-name strings it cross-references | **Repository-specific** | This repository's own workflow file and step names; a ported version needs its own workflow's path/names |
| The `.gitignore` narrowing (exact lines) | **Repository-specific** in its diff | The underlying *lesson* ("don't blanket-ignore a directory that must also hold shared tooling") is Platform-wide — any repository adopting this platform will hit the identical issue the first time it commits a command file |
| `.claude/commands/*.md` frontmatter convention (`description`, `argument-hint`) and the whole "a command is a markdown prompt file" mechanism | **Claude-specific** | Tied to this specific AI coding environment's command-dispatch convention; a non-Claude tooling context would need an entirely different adapter mechanism (a CLI subcommand, a Makefile target) even though the underlying script would be unchanged |
| The script/adapter separation itself (logic vs. thin invocation) | **Platform-wide** | The specific *mechanism* of "a markdown prompt file" is Claude-specific, but the *principle* of separating logic from invocation is the Governance Engine's own standing design rule, independent of which tool ultimately invokes the script |
| The pre-/post-implementation disclosure structure (§2, §5) | **Reusable** | A documentation discipline; portable to any engineering process, AI-assisted or not |
| The "stop and wait for explicit approval between slices" cadence | **Claude-specific / session-specific** | An interactive AI pair-programming pattern; a fully-automated or human-only team would express the same "review gate" principle differently (a PR review, a CI gate) even though the underlying principle (independent review before proceeding) is Platform-wide |
| The dogfood-against-own-commit verification pattern | **Platform-wide**, secondarily **Reusable** | Most directly applicable to this Governance Engine's own self-verifying tools; the general principle ("test a tool against its own output where possible") is reusable well beyond this platform too |

---

## The Mandatory Process

Every future Governance Engine rule implementation must, without exception:

1. Select the rule from `GOVERNANCE_ENGINE_DESIGN.md`'s existing ROI ranking, honoring the
   established order unless a dependency (like `ARCH-1`'s frozen-path-list prerequisite)
   requires deferring it — never re-rank informally mid-implementation.
2. Present the pre-implementation disclosure (§2, step 1) and wait for it to stand unchallenged
   before writing any file.
3. Check for an existing convention before inventing a new one (§2, step 2), citing a real file.
4. Build the executable script before the command adapter; the adapter must contain zero
   duplicated logic (§2, steps 3–4; §6).
5. Verify at least twice against real state, with at least one non-vacuous result, and — where
   the tool is self-applicable — dogfood it against its own shipping commit (§4).
6. Explicitly assess (not assume) whether the rule mutates or blocks anything, and size its
   rollback story accordingly (§2, step 6; §8).
7. Disclose any mid-implementation deviation from the original file/scope estimate transparently,
   re-confirming Decision Budget compliance after the deviation, never silently.
8. Ship exactly one commit per slice, structured per §5.
9. Report per the Definition of Done (§9) and stop — the next rule does not begin without
   explicit, separate approval.
10. Resist generalizing any part of this into a shared framework until at least 2–3 more rules
    have been implemented this same way — this template itself is not to be treated as final
    until it has been tested against a second and third real slice.

---

*End of template. Per instruction, nothing was implemented beyond the one read-only `tsc -b`
verification of already-completed work: no source, test, CI, workflow, or governance file was
created or modified, and no commit was made. Waiting for approval before implementing Governance
Rule #2.*
