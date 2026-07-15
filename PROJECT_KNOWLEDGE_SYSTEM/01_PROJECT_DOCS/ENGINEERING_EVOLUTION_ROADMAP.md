# Engineering Evolution Roadmap — Repository → Engineering Platform

**Status:** DESIGN ONLY. No source, test, CI, workflow, or governance file was created or
modified. This roadmap sequences `ENGINEERING_PLATFORM_GAP_ANALYSIS.md`'s findings (approved)
into the smallest independently-mergeable milestones that get from the current repository
(Platform Readiness 35/100, Automation Readiness 15/100) to the platform
`ENGINEERING_PLATFORM_V2.md` describes.

**Design constraint applied to every milestone below:** produces value independently of later
milestones in its phase; is a plain `git revert` away from undone; has a stated, checkable
completion state; touches few enough files to need minimal review; writes to exactly one owning
file/location per fact (no two milestones create a second place the same information could
drift, per the Gap Analysis's confirmed `app/.memory/project-status.md` duplicate-risk finding);
and — since almost every milestone here is additive documentation or a new, isolated file —
merge-conflict surface is inherently small.

---

## Phase A — Repository Governance

*Writes existing, evidenced Phase X practice into the already-existing owning files the Gap
Analysis identified (Component E) as structurally ready but content-empty. Zero code.*

**A1 — ADR policy + Decision Budget into `ARCHITECTURE_CONSTRAINTS.md`**
Objective: add the 7-question ADR-trigger checklist and the ≤8-files/no-API/no-architecture/
no-migration/no-dependency/no-security autonomous-implementation budget, established at X.19,
to their natural owning file. Why: currently exists only in chat/freeze-report history — every
future milestone re-derives it from precedent instead of reading it. Dependencies: none.
Est. commits: 1. Expected files: `ARCHITECTURE_CONSTRAINTS.md`. Rollback: trivial. Architecture
impact: none (documents an existing decision). CI impact: none. ADR required: No. Decision
Budget: fits (1 file). Acceptance criteria: the checklist and budget are readable in this file
without needing to consult any freeze report.

**A2 — Commit/freeze discipline + documentation policy into `REPOSITORY_RULES.md`**
Objective: add "never `git add -A`," "one commit per stage," "enumerate exact files," and Lean
Governance v2's documentation policy (a document exists only if it answers something git/CI
history can't). Why: followed rigorously this session, never written down. Dependencies: none.
Est. commits: 1. Expected files: `REPOSITORY_RULES.md`. Rollback: trivial. Architecture impact:
none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: a new
contributor can read this file alone and reproduce the commit discipline observed in every
X.16–X.20.1 commit.

**A3 — CI policy: new `CI_POLICY.md`**
Objective: document "new CI steps default `continue-on-error: true` when pre-existing debt
would otherwise redden the pipeline; flip to blocking only on a confirmed zero-error baseline"
(established X.18, reaffirmed X.19). Why: Gap Analysis confirmed no dedicated CI-policy file
exists anywhere in `02_AI_CONTEXT`. Dependencies: none. Est. commits: 1. Expected files: one new
`02_AI_CONTEXT/CI_POLICY.md`. Rollback: trivial. Architecture impact: none. CI impact: none (the
file describes policy, doesn't change `.github/workflows/`). ADR required: No. Decision Budget:
fits. Acceptance criteria: the exact decision made twice (X.18 lint, X.19 type-check) is stated
once, generally, here.

**A4 — Flake-handling protocol into `KNOWN_RISKS.md`**
Objective: document the `execSync('npx prisma validate')` timeout signature and the "rerun up
to 3x, compare which file(s) vary" protocol. Why: this exact judgment call was made from memory
5 times (X.14, X.15, X.17, X.19, X.20.1); `KNOWN_RISKS.md` exists, `as_of: 2026-07-05`, and does
not mention it. Dependencies: none. Est. commits: 1. Expected files: `KNOWN_RISKS.md`. Rollback:
trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits.
Acceptance criteria: the flake's exact error text and file-pattern are written down, matching
what every freeze report has independently re-described.

**A5 — Guard-writing standard into `CODING_RULES.md`**
Objective: promote "architecture guards assert presence, not exact literal content or exact
counts, wherever the asserted set is expected to grow additively" from
`ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions section into a standing rule every
future guard-writer sees by default. Why: stated once, in one ADR, never generalized — directly
caused GX-001 through GX-004 and X.19's own one-line frozen-file fix. Dependencies: none. Est.
commits: 1. Expected files: `CODING_RULES.md`. Rollback: trivial. Architecture impact: none. CI
impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: the rule is stated
as a default, with the GX-series as its worked examples, not buried in a single milestone's ADR.

**A6 — Retire duplicate status trackers**
Objective: edit `app/.memory/project-status.md` and `next-task.md` to state plainly that
`CURRENT_MILESTONE.md` is now the sole source of truth for current/next milestone status, and
stop updating these two independently going forward. Why: Gap Analysis confirmed this
duplication already materialized (both files stopped at "Knowledge Platform v1.0," 20+
milestones stale, while `CURRENT_MILESTONE.md` stayed current). Dependencies: none. Est.
commits: 1. Expected files: `app/.memory/project-status.md`, `next-task.md`. Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits (2 files).
Acceptance criteria: neither file claims to be current-status source of truth after this
milestone; both point to `CURRENT_MILESTONE.md`.

**A7 — Structured, machine-readable frozen-path list**
Objective: extract `CURRENT_MILESTONE.md`'s prose `do_not` block into a structured list (e.g.
a small YAML/JSON file) a script can diff staged files against. Why: both `/architecture-review`
(Phase D) and the pre-commit frozen-path guard (Phase E) need this in machine-readable form;
today it's manually re-read, in full, every time. Dependencies: none, but creates a real
maintenance dependency for every future milestone touching `do_not` (see Highest-Risk
Milestones, below). Est. commits: 1. Expected files: one new structured file, e.g.
`02_AI_CONTEXT/frozen-paths.yaml`, cross-linked from `CURRENT_MILESTONE.md`. Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance
criteria: the structured list's entries are verified, by hand, to match `CURRENT_MILESTONE.md`'s
prose `do_not` block at creation time — this milestone's own completion state includes that
one-time reconciliation.

---

## Phase B — Knowledge Platform

*Reactivates the three-tier knowledge system (Gap Analysis Component F) — writing, not building;
every owning file and the ownership map (`SCHEMA.md`) already exist.*

**B1 — Reconcile `app/.memory/technical-debt.md` against current repository state**
Objective: review each existing TD item (TD-01 through TD-05+) against 20+ milestones of actual
progress; correct any now-factually-wrong entries (confirmed example: TD-03's "no
authentication/authorization layer" claim, superseded in part by X.14–X.16). Why: a stale
governance file is itself a form of technical debt, and one that actively misleads if left as
is. Dependencies: none. Est. commits: 1 (documentation-only correction, not a fix to the
underlying code). Expected files: `app/.memory/technical-debt.md`. Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits (1 file).
Acceptance criteria: every open TD item is re-verified true as of today, or marked
resolved/superseded with the milestone that changed it, or left open with an updated note — no
silent removal.

**B2 — Backfill `KNOWN_RISKS.md` / `known-issues.md` with Phase X findings**
Objective: add entries for the Prisma-validate flake (cross-reference A4), `gh` CLI
unavailability, and the X.20 audit's nine suspected-defect clusters
(`evidenceCollector.ts`'s `backingArticleIds`, the three broken factory re-exports, the
`ToolCall` duplicate export, etc.). Why: these are real, already-discovered risks sitting only
in `X20_TYPESCRIPT_REMEDIATION_PLAN.md`'s prose, not in the risk register whose job is to make
them discoverable independent of reading that whole plan. Dependencies: A4 (for the flake
entry's canonical wording). Est. commits: 1. Expected files: `KNOWN_RISKS.md`,
`app/.memory/known-issues.md`. Rollback: trivial. Architecture impact: none. CI impact: none.
ADR required: No. Decision Budget: fits (2 files). Acceptance criteria: every §3.4 cluster from
`X20_TYPESCRIPT_REMEDIATION_PLAN.md` has a corresponding risk-register entry.

**B3 — Backfill `DECISION_HISTORY.md` / `decision-log.md` with Phase X decisions**
Objective: add entries for the X.16 HMAC-vs-JWT choice, the X.19 `version`-vs-`updatedAt` CAS
token choice, and the X.20.1 erasableSyntaxOnly Option A vs. B choice — each already fully
reasoned in its own ADR, just never indexed in the decision log. Dependencies: none. Est.
commits: 1. Expected files: `04_PROJECT_MEMORY/DECISION_HISTORY.md`,
`app/.memory/decision-log.md`. Rollback: trivial. Architecture impact: none. CI impact: none.
ADR required: No. Decision Budget: fits. Acceptance criteria: each entry links to its full ADR
rather than duplicating it — the decision log is an index, not a copy.

**B4 — Backfill `REJECTED_DESIGNS.md`**
Objective: add the three explicitly-rejected CAS-token alternatives from
`X19_ARCHITECTURE_DECISION.md` (random token in `error`, new status enum value, in-process
counter). Dependencies: none. Est. commits: 1. Expected files: `REJECTED_DESIGNS.md`. Rollback:
trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits.
Acceptance criteria: a future contributor proposing one of these three again finds it already
addressed here before re-proposing it.

**B5 — Formalize Knowledge Update as a named Freeze-layer step**
Objective: add one sentence to A2's freeze-discipline section: every freeze must check whether
it produced a debt/risk/lesson/decision/rejected-alternative worth recording, and record it in
one line if so. Why: this is the actual fix to the root cause (Gap Analysis: "the writing habit
stopped," not "the destination is missing"). Dependencies: A2. Est. commits: 1. Expected files:
`REPOSITORY_RULES.md` (the same file A2 edited, one additional paragraph). Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance
criteria: the next real freeze (whenever it happens) can point to this paragraph as the reason
it updated a `04_PROJECT_MEMORY`/`app/.memory` file, not just `CURRENT_MILESTONE.md`.

---

## Phase C — Prompt Platform

*Scaffolding only — the Prompt Library (Gap Analysis Component B) is built incrementally,
exactly as much as the commands in Phase D actually need.*

**C1 — Scaffold `05_ENGINEERING_PLATFORM/prompts/` + metadata schema**
Objective: create the directory structure (`planning/`, `architecture/`, `review/`, `ci/`,
`freeze/`, `adr/`, `legal-review/`, `procurement-review/`, `knowledge-update/`) and one README
documenting the per-prompt metadata schema (`prompt_id`, `layer`, `purpose`, `required_inputs`,
`expected_output_shape`, `depends_on`, `blocked_by`, `last_validated`) from
`ENGINEERING_PLATFORM_V2.md` §2.3. No prompt content yet. Dependencies: none. Est. commits: 1.
Expected files: ~10 new (mostly empty directories + 1 README). Rollback: trivial (delete an
unused directory tree). Architecture impact: none. CI impact: none. ADR required: No. Decision
Budget: fits. Acceptance criteria: the schema is documented and one example (a stub, clearly
marked non-functional) demonstrates the shape.

**C2 — Author the `verify` and `audit` prompts**
Objective: write the two prompts Phase D's first two commands (D2, D3) need. Dependencies: C1.
Est. commits: 1. Expected files: 2 new prompt files. Rollback: trivial. Architecture impact:
none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: each
prompt's `required_inputs`/`expected_output_shape` matches exactly what D2/D3 will consume —
verified by actually building D2/D3 against it, not just by inspection.

**C3 — Author the `architecture-review`, `review`, `test-review`, `ci-review`, `freeze` prompts**
Objective: the remaining five prompts Phase D's later commands need. Dependencies: C1, and
(for content accuracy) A1/A4/A7. Est. commits: 1 (or split per prompt if review finds any one
of them needs its own iteration). Expected files: 5 new prompt files. Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits if bundled
(5 files); split into 2 commits if any single prompt proves non-trivial. Acceptance criteria:
same as C2, verified against Phase D's actual command implementations.

---

## Phase D — Command Platform

*Gap Analysis found no command-dispatch mechanism exists at all — D1 builds that once; every
other milestone in this phase is one command.*

**D1 — Command-dispatch mechanism**
Objective: establish how a command is invoked in this repository (e.g. `.claude/commands/*.md`
files, the convention already observable elsewhere in this environment for commands like
`/code-review`). Why: without this, every command below is unbuildable. Dependencies: none.
Est. commits: 1. Expected files: `.claude/commands/` directory + whatever minimal scaffolding
the convention requires. Rollback: trivial (delete the directory; nothing else depends on it
existing yet). Architecture impact: none — purely a local developer-tooling convention, not
part of the shipped application. CI impact: none. ADR required: No. Decision Budget: fits.
Acceptance criteria: one trivial test command round-trips successfully before any real command
is built on top of it.

**D2 — `/verify`**
Objective: run `tsc -b` + architecture guard suite + full test suite, with the A4 flake protocol
built in, one summary line out. Dependencies: D1, C2. Est. commits: 1. Expected files: 1.
Rollback: trivial. Architecture impact: none. CI impact: none (a local command, doesn't touch
`.github/workflows/`). ADR required: No. Decision Budget: fits. Acceptance criteria: running it
against the current, known-clean `develop` HEAD produces a correct pass; deliberately breaking
one test locally (never committed) produces a correct, specific fail.

**D3 — `/audit`**
Objective: reusable repository-analysis sweep (error inventory, frozen-zone cross-reference via
A7, dependency-constraint check) without proposing a fix — the exact process used to produce
`X20_TYPESCRIPT_REMEDIATION_PLAN.md` and this session's own gap analyses, made reusable.
Dependencies: D1, C2, A7. Est. commits: 1. Expected files: 1. Rollback: trivial. Architecture
impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: run
against the current repo, its TypeScript-error count matches X.20's already-verified 841/309
baseline exactly (a regression in the command itself would show as a mismatch here).

**D4 — `/architecture-review`**
Objective: ADR-checklist + Decision Budget + frozen-zone (via A7) walkthrough, on demand, before
implementation starts. Dependencies: D1, C3, A1, A7. Est. commits: 1. Expected files: 1.
Rollback: trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision
Budget: fits. Acceptance criteria: run against a known case from this session (e.g. X.19's
version-column migration) and confirm it correctly flags "ADR required: yes."

**D5 — `/review`**
Objective: post-hoc diff-vs-budget check, distinct from D4 (pre-implementation). Dependencies:
D1, C3, A1, A7. Est. commits: 1. Expected files: 1. Rollback: trivial. Architecture impact:
none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: run
against a past commit's diff (e.g. X.19's 8-file implementation commit) and confirm it correctly
reports "within budget."

**D6 — `/test-review`**
Objective: triage a failing test against A4's flake signature. Dependencies: D1, C3, A4. Est.
commits: 1. Expected files: 1. Rollback: trivial. Architecture impact: none. CI impact: none.
ADR required: No. Decision Budget: fits. Acceptance criteria: fed one of this session's own
real `x10-prisma-integration.test.ts` timeout failures, correctly classifies it as the known
flake, not a regression.

**D7 — `/ci-review` and `/freeze`**
Objective: `/ci-review` polls and correctly interprets a GitHub Actions run (including
`continue-on-error` masking), via the `curl`-against-public-API pattern (`gh` confirmed absent
from PATH); `/freeze` composes D2 + `/ci-review` + git checks + a freeze-report skeleton.
Dependencies: D1, C3, D2. Est. commits: 2 (kept separate — `/ci-review` is independently useful
before `/freeze` needs it). Expected files: 2. Rollback: trivial, independently for each.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits per command.
Acceptance criteria: `/ci-review` run against X.19's own Type-check step run correctly reports
"masked failure, `tsc -b` genuinely exited non-zero" rather than taking the API's raw `success`
conclusion at face value; `/freeze` run against a real, already-completed milestone reproduces
that milestone's actual, already-published verification results.

---

## Phase E — Developer Automation

*Gap Analysis: no hook-execution mechanism exists at all. E1 builds the minimal one (a plain
`.git/hooks/pre-commit` script, explicitly not Husky — no new dependency, per the Gap
Analysis's own "should never be implemented" list).*

**E1 — Hook-runner mechanism**
Objective: a plain, committed `.git/hooks/pre-commit` shell script (or a checked-in script that
a one-time local setup step symlinks into place — Git does not track `.git/hooks/` itself).
Dependencies: none. Est. commits: 1. Expected files: 1 new script + a short setup note.
Rollback: trivial (delete the script; nothing breaks). Architecture impact: none. CI impact:
none. ADR required: No. Decision Budget: fits. Acceptance criteria: the script runs on a test
commit and exits 0 with no checks wired in yet (this milestone is the empty runner, not any
specific check).

**E2 — Wire H1 into the runner: `tsc -b --listFilesOnly` sanity check**
Objective: hard-fail a commit if `tsc -b --listFilesOnly` reports 0 files. Why: prevents a
second instance of the exact defect class X.19 spent a milestone investigating. Dependencies:
E1. Est. commits: 1. Expected files: 1 (extends E1's script). Rollback: trivial. Architecture
impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria:
deliberately (locally, never committed) pointing the check at the old solution-style
`tsconfig.json` reproduces a hard fail; pointing it at the correct `tsc -b` invocation passes.

**E3 — Wire H2 into the runner: frozen-path guard**
Objective: diff staged files against A7's structured list; require explicit acknowledgment to
proceed if any match. Dependencies: E1, A7. Est. commits: 1. Expected files: 1 (extends E1's
script). Rollback: trivial. Architecture impact: none. CI impact: none. ADR required: No.
Decision Budget: fits. Acceptance criteria: staging a change to a known-frozen file (e.g.
`src/runtime/recovery/recoveryTypes.ts`) triggers the guard; staging an unrelated file does not.

**E4 — Before-migration / before-schema-change checklist**
Objective: a lightweight, advisory (non-blocking) reminder: DB reachability, `prisma validate`,
exactly-one-additive-migration. Dependencies: E1. Est. commits: 1. Expected files: 1. Rollback:
trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits.
Acceptance criteria: triggers only on a diff touching `prisma/schema.prisma` or
`prisma/migrations/`.

**E5 — Before-workflow-change self-declaration**
Objective: a diff touching `.github/workflows/*` must state explicitly, in the commit message,
whether it changes any step's blocking behavior (`continue-on-error` added/removed).
Dependencies: E1. Est. commits: 1. Expected files: 1. Rollback: trivial. Architecture impact:
none. CI impact: none (advisory, doesn't touch the workflow file itself). ADR required: No.
Decision Budget: fits. Acceptance criteria: triggers only on `.github/workflows/` diffs.

**E6 — Before-release staleness check**
Objective: warn if `CURRENT_RELEASE.md` is stale relative to `CURRENT_MILESTONE.md` before a
tag is created. Why: `CURRENT_MILESTONE.md` itself has repeatedly self-reported exactly this
drift across X.15–X.19. Dependencies: E1. Est. commits: 1. Expected files: 1. Rollback: trivial.
Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance
criteria: run against the current repository state, correctly reports the already-known,
self-documented staleness.

**E7 — After-freeze hook: triggers Knowledge Update**
Objective: after a commit matching the freeze-commit pattern (e.g. message starting `Phase X.N`
+ touches only `CURRENT_MILESTONE.md`/`MILESTONE_HISTORY.md`), print a reminder pointing at B5's
Knowledge Update step. Dependencies: E1, B5. Est. commits: 1. Expected files: 1. Rollback:
trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision Budget: fits.
Acceptance criteria: fires on a simulated freeze-shaped commit, stays silent on an ordinary
implementation commit.

---

## Phase F — Review System

*Builds the sophisticated review workflow on top of Phase D's individual commands — not a new
mechanism, a new discipline layered on an existing one.*

**F1 — Formalize the Architect/Reviewer procedural split**
Objective: state, in `REPOSITORY_RULES.md`, that pre-implementation review (`/architecture-
review`, D4) and post-implementation review (`/review`, D5) are procedurally distinct
checkpoints, mirroring CLAUDE.md's own "preserve legal independence between Expert Team and
Appraisal Team" principle applied to engineering review. Dependencies: D4, D5. Est. commits: 1.
Expected files: 1 (extends A2's file). Rollback: trivial. Architecture impact: none. CI impact:
none. ADR required: No. Decision Budget: fits. Acceptance criteria: the rule names both
checkpoints and states neither may substitute for the other.

**F2 — Review-history log**
Objective: a small, append-only log of `/architecture-review` and `/review` verdicts, so past
review outcomes are queryable rather than ephemeral. Dependencies: D4, D5. Est. commits: 1.
Expected files: 1 new file (e.g. `04_PROJECT_MEMORY/REVIEW_LOG.md` or an extension of
`DECISION_HISTORY.md` — decide at implementation time based on which reads more naturally).
Rollback: trivial. Architecture impact: none. CI impact: none. ADR required: No. Decision
Budget: fits. Acceptance criteria: one real `/review` run appends one real entry.

**F3 — Wire review-iteration count into `/audit`'s metrics output**
Objective: close the "review iterations" metric gap from `ENGINEERING_PLATFORM_V2.md` §8, using
F2's log as the data source. Dependencies: D3, F2. Est. commits: 1. Expected files: 1 (extends
D3's command). Rollback: trivial. Architecture impact: none. CI impact: none. ADR required: No.
Decision Budget: fits. Acceptance criteria: `/audit`'s output includes a real count, sourced
from F2, not a placeholder.

---

## Phase G — Workflow System

*The orchestration layer — chaining the 9 Platform Architecture layers (V2 §1) and Phase D's
individual commands into a trackable pipeline, without reimplementing any command's logic.*

**G1 — Lightweight milestone-state field**
Objective: a small, optional field (e.g. in a milestone's own planning doc's front matter)
recording which of the 9 Platform Architecture layers it currently sits in. Not a new
heavyweight tracker — a single field. Dependencies: none. Est. commits: 1. Expected files: 1
(schema/convention doc). Rollback: trivial. Architecture impact: none. CI impact: none. ADR
required: No. Decision Budget: fits. Acceptance criteria: retroactively applying the field to
this session's own X.19/X.20 history produces a sensible, correct sequence.

**G2 — `/workflow status`**
Objective: read G1's field across in-progress planning docs and report where each stands.
Dependencies: D1, G1. Est. commits: 1. Expected files: 1. Rollback: trivial. Architecture
impact: none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria:
run against the current repository (post this roadmap's own approval), correctly reports this
roadmap itself as "approved, Planning layer complete, Implementation layer not started."

**G3 — Workflow chaining**
Objective: generalize the pattern D7's `/freeze` already demonstrates (composing multiple
commands) so future multi-step sequences (e.g. Planning → Architecture Review) can be chained
the same way, reusing D's commands as building blocks. Dependencies: D2–D7. Est. commits: 1-2.
Expected files: 1-2. Rollback: trivial. Architecture impact: none. CI impact: none. ADR
required: No. Decision Budget: fits. Acceptance criteria: a chained sequence produces the exact
same result as running its constituent commands manually, in order — no new logic, only
composition.

**G4 — Document the full pipeline in `SYSTEM_CONTEXT.md`**
Objective: close `ENGINEERING_PLATFORM_V2.md` §7's stated gap ("no file describes the Platform
Architecture layers as a named sequence") with one reference table/diagram. Dependencies: none
technically, but most meaningful once D–G exist to point at. Est. commits: 1. Expected files: 1
(extends `SYSTEM_CONTEXT.md`). Rollback: trivial. Architecture impact: none. CI impact: none.
ADR required: No. Decision Budget: fits. Acceptance criteria: a new contributor can read this
one addition and understand the whole pipeline without reading V1/V2/the Gap Analysis in full.

---

## Phase H — AI Agent Runtime

*V1 and V2 both concluded, on evidence, that separate agents should not be built now — this
phase does not reverse that finding. Its milestones are deliberately conservative: documentation
and an explicit decision gate, not implementation.*

**H1 — Formalize role definitions as documentation (not runtime agents)**
Objective: write down the Planner/Explorer/Architect/Implementer/Reviewer/Test Reviewer/CI
Reviewer/Legal Reviewer/Knowledge Reviewer responsibilities (`ENGINEERING_PLATFORM_V2.md` §3.4)
as a reference document — zero behavior change, useful even without parallel execution, e.g. as
onboarding material or as the shared vocabulary Phase F's checkpoint-naming already leans on.
Dependencies: none. Est. commits: 1. Expected files: 1. Rollback: trivial. Architecture impact:
none. CI impact: none. ADR required: No. Decision Budget: fits. Acceptance criteria: every role
named in F1 traces back to a definition here.

**H2 — Evaluate (not build) genuine multi-agent parallel execution**
Objective: a decision point, not an implementation — explicitly revisit V1/V2's "no" only if a
real parallelization need has actually arisen (a second contributor, a background task queue).
Dependencies: H1. Est. commits: 0 (a decision record if the answer is still "no"; only becomes
an implementation milestone if the answer changes, at which point it needs its own new roadmap
entry, not this one). Expected files: 0-1. Rollback: N/A. Architecture impact: none at the
decision stage. CI impact: none. ADR required: No at the decision stage. Decision Budget: N/A.
Acceptance criteria: a recorded "still no, because..." or "yes, because [specific new
condition]" — never a silent default either way.

**H3 — Legal Reviewer / Knowledge Reviewer agents (blocked)**
Objective: N/A until unblocked. Dependencies: `skills/dau-thau-mua-sam.md` must exist first (a
separate, still-open decision — see Phase I). Est. commits: N/A. Expected files: N/A. Rollback:
N/A. Architecture impact: unknown until scoped. CI impact: unknown. ADR required: re-evaluate
once scoped. Decision Budget: N/A. Acceptance criteria: this milestone does not begin until its
blocker is resolved as its own, separate, explicitly-approved decision.

---

## Phase I — Business Modules (bridge only, not scoped here)

This roadmap governs the *Engineering Platform*, not the repository's business/domain track.
Phase I is intentionally thin:

**I1 — Acknowledge the existing, separately-governed business track**
The immediate next domain-track work (`X.20.2` onward, per `X20_TYPESCRIPT_REMEDIATION_PLAN.md`
§7's own sub-milestones) is not re-scoped or re-scheduled by this document. The relationship is
one-directional: Phases A–E of this roadmap, once substantially complete, make that future work
faster and safer — the reverse is not true, and this roadmap does not depend on any Phase I work
happening first.

**I2 — Explicit gate, restated**
No Phase X.21 (or later) business/domain milestone begins as a consequence of this roadmap's
approval. That remains gated on its own, separate, explicit human authorization, exactly as
already standing.

---

## Closing Analysis

### 1. Critical Path

The minimum sequence required to reach a *meaningfully functional* platform (not full
completion of every phase): **A1 → A2 → A4 → A7 → C1 → C2 → D1 → D2 → D3 → E1 → E2 → E3.**
This delivers a working `/verify`, `/audit`, and a real pre-commit safety net (the two
highest-evidenced needs in every prior document) in 12 small milestones. Everything past E3 —
Phases F, G, H, and the remaining Phase D/E commands — adds refinement, not the platform's core
value.

### 2. Parallelizable Milestones

- **A3, A5, A6** — independent of each other and of the critical path; any order.
- **B1–B4** — independent of each other (different files, different content); B5 alone depends
  on A2.
- **D4, D5, D6** — independent of each other once their shared dependencies (D1, C3) exist.
- **E4, E5, E6** — independent hook points, no interdependency, and independent of D entirely.
- **F1–F3 and G1–G4** — largely independent of each other as two parallel tracks, both
  depending only on Phase D being substantially done.

### 3. Highest-Risk Milestones

- **A7 (frozen-path list extraction)** — the single highest structural risk in the roadmap: a
  structured list that silently drifts from `CURRENT_MILESTONE.md`'s prose `do_not` block is
  worse than no list at all, since it would give false confidence. Every milestone that later
  edits `do_not` (any future frozen-zone-touching phase) must re-sync A7 as part of that edit —
  this should be called out explicitly wherever `do_not` is next modified, not assumed to stay
  in sync automatically.
- **B1 (technical-debt reconciliation)** — the only milestone in Phases A–B that requires real
  investigative judgment (is TD-03 actually resolved, partially resolved, or still open?)
  rather than transcription; a careless pass here could mark something resolved that isn't.
- **E3 (frozen-path pre-commit guard)** — the only hook with real power to block legitimate
  work if A7's list is wrong; must ship with an explicit override path, not just a hard block.
- **H2** — not risky to execute (it's a decision, not code) but is the one item in the entire
  roadmap where the "right answer" genuinely depends on future conditions this document cannot
  see.

### 4. Milestones That Should Never Be Merged

Carried forward from the Gap Analysis, plus one new item found while designing this roadmap:

- A `/plan` command (Gap Analysis, reaffirmed).
- An after-merge hook (Gap Analysis, reaffirmed — no merge-distinct-from-push event exists in
  this repository's workflow).
- A genuine after-CI webhook receiver (Gap Analysis, reaffirmed).
- Husky/lint-staged or any new hook-runner dependency for Phase E (E1 is deliberately a
  zero-dependency plain script).
- A metrics dashboard or collection service for Phase G/§8 (`/audit`-computed, on-demand only).
- `app/.memory/project-status.md`/`next-task.md` as independently-updated files (A6 retires
  this pattern, not reintroduces it).
- **New: any milestone that has B1's reconciliation pass *auto-resolve* a debt item based on
  inference rather than explicit verification** — e.g., automatically marking TD-03 "resolved"
  because X.14–X.16 exist, without confirming the specific claim TD-03 makes is actually now
  false. This would repeat the exact "automation encoding a judgment call as mechanical" failure
  mode `ENGINEERING_PLATFORM_V2.md`'s risk section warned against.

### 5. Milestones That Can Always Be Cherry-Picked

Every milestone in Phase A (A1–A7) — pure documentation, zero dependency on any other phase,
individually reversible, individually valuable even if no other phase is ever built. Also: C1
(scaffolding, no functional dependency on it existing), H1 (a reference document with value
independent of whether H2 ever says yes), and G4 (a documentation addition with value regardless
of how much of G1–G3 exists). None of these require any other phase to be in progress.

### 6. Estimated Engineering Maturity After Each Phase

Extending the Gap Analysis's baseline (Platform Readiness 35/100, Duplicate Risk Medium,
Technical Debt High, Automation Readiness 15/100):

| After Phase | Platform Readiness | Automation Readiness | Duplicate Risk | Technical Debt (governance-content kind) |
|---|---|---|---|---|
| Baseline (today) | 35/100 | 15/100 | Medium (confirmed) | High |
| A | ~45/100 — governance content debt resolved | 15/100 (unchanged — no tooling yet) | Low (A6 closes the confirmed duplicate) | Medium — content now current, code-level debt (841/477) untouched |
| B | ~52/100 — all 3 knowledge tiers reactivated and reconciled | 15/100 (unchanged) | Low | Medium — same as after A; B doesn't touch code-level debt |
| C | ~55/100 — prompt contracts exist for the highest-value commands | 15/100 (unchanged — prompts aren't executable alone) | Low | Medium |
| D | ~72/100 — the platform has real, usable commands for its two highest-evidenced needs plus five more | 55/100 — commands exist; hooks still don't | Low | Medium |
| E | ~80/100 — the safety net (H1/H2 sanity checks) is live | 75/100 — both mechanism and the two highest-value checks exist | Low | Medium |
| F | ~85/100 — review is a formalized, auditable discipline, not just a habit | 75/100 (unchanged — F is process, not new automation surface) | Low | Medium |
| G | ~90/100 — the full 9-layer pipeline is documented, trackable, and chainable | 78/100 | Low | Medium |
| H (H1 only; H2/H3 remain gated) | ~92/100 | 78/100 | Low | Medium |

Code-level technical debt (841 TypeScript diagnostics, 477 ESLint findings) is **not** reduced
by any phase in this roadmap — it is Phase I's (business-track) concern, tracked separately in
`X20_TYPESCRIPT_REMEDIATION_PLAN.md`. This roadmap's job is the tooling that makes reducing it
— and everything after it — faster and safer, not reducing it directly.

---

*End of roadmap. No implementation, no source-code changes, no commits. Waiting for approval
before beginning any milestone above.*
