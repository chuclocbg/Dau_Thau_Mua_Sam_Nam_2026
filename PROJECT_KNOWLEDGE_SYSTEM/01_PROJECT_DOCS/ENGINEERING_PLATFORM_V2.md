# Engineering Platform v2 — Developer Operating System (DOS) Design

**Status:** DESIGN ONLY. No source, test, CI, workflow, plugin, hook, or agent was created or
modified to produce this document, and no governance file (`CURRENT_MILESTONE.md`,
`MILESTONE_HISTORY.md`, or any file under `02_AI_CONTEXT`/`04_PROJECT_MEMORY`) was touched.
This document extends [`ENGINEERING_PLATFORM_V1.md`](ENGINEERING_PLATFORM_V1.md) (approved) from
a tooling wish-list into a complete, repository-native Developer Operating System — every
recommendation below is grounded in X.17–X.20 history, this repository's own existing (but, as
Section 6 shows, partially unused) infrastructure, and nothing borrowed from another project's
playbook.

**One finding drives much of this document and is stated up front:** this repository already
built a knowledge-management system for exactly this purpose —
`PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/TECHNICAL_DEBT.md`, `KNOWN_RISKS.md`, and
`04_PROJECT_MEMORY/LESSONS_LEARNED.md`, `KNOWN_TECHNICAL_DEBT.md`, `DECISION_HISTORY.md`,
`REJECTED_DESIGNS.md` — each with a real, deliberate ownership split defined in `SCHEMA.md`'s
"Ownership map" (e.g. *"`TECHNICAL_DEBT.md` owns the current-state snapshot; the narrative of
how each item was found lives in `KNOWN_TECHNICAL_DEBT.md`"*). Every one of those files was last
touched **2026-07-05**, at the PROJECT_KNOWLEDGE_SYSTEM v1.0 release — **before Phase X.1 even
began.** `CURRENT_MILESTONE.md` has been updated at every one of the 20+ Phase X milestones
since; these sibling files have been updated at none of them, despite Phase X generating
exactly the content they exist to hold (X.19's CAS design flaw is a textbook
`LESSONS_LEARNED.md` entry; X.20's TypeScript debt is a textbook `TECHNICAL_DEBT.md` entry; the
erasableSyntaxOnly Option A/B fork is a textbook `DECISION_HISTORY.md` entry). This document's
Knowledge Pipeline section (§6) treats *wiring the freeze process back into this existing,
well-designed, currently-orphaned infrastructure* as the single highest-leverage recommendation
in the whole platform — not a new system to build, a stopped one to restart.

---

## 1. Platform Architecture

Nine layers, matching the request. Every layer already exists **informally**, executed
sequentially by one session at every phase from X.16 onward; this section names each one
explicitly and states its responsibility, inputs, and outputs, so tooling (§§2–4) can be built
against a stable interface instead of re-derived each time.

| Layer | Responsibility | Input | Output | Where this already happens today |
|---|---|---|---|---|
| **Request** | Capture human intent and its explicit constraints (scope, forbidden actions, stop conditions) as a well-formed task frame. | A directive message | A scoped task frame other layers consume | Every "Proceed with Phase X.N Step M" message this session |
| **Planning** | Translate intent into a concrete, reviewable plan before any code exists. Never writes code. | Task frame + Repository Analysis output | An `XN_IMPLEMENTATION_PLAN.md`-shaped document | `X19_IMPLEMENTATION_PLAN.md`, `X20_TYPESCRIPT_REMEDIATION_PLAN.md` |
| **Repository Analysis** | Ground the plan in actual repository state — run real commands, read real files, count real errors, rather than reason from memory or assumption. | The plan's stated assumptions | Verified facts, or corrections to the plan (e.g. X.20's audit found 841 diagnostics / 309 files, correcting X.19's own rough "~1271 / 182" estimate) | The `tsc -b` audits, `git log -S` archaeology, and do-not-list cross-referencing performed at X.20's planning stage |
| **Architecture Review** | Apply the ADR-trigger checklist, size against the Decision Budget, and identify frozen-zone impact — before implementation starts. | The plan + repository facts | A go/no-go plus an explicit list of any decision forks needing human input (e.g. the erasableSyntaxOnly Option A/B fork) | The ADR-checklist walkthroughs performed at every X.16–X.20 kickoff |
| **Implementation** | Execute exactly what Planning + Architecture approved — nothing more, nothing bundled in. | An approved plan + resolved decision forks | Edited files, within budget | Every "Step N" this session |
| **Verification** | Prove the implementation didn't break anything, using the canonical commands (Governance Engine, §5). | Edited files | Pass/fail on `tsc -b`, architecture guard suite, full test suite, git state | Every post-implementation check this session |
| **CI** | Prove it holds true outside the local environment. Correctly interpret `continue-on-error`-masked results rather than taking a green checkmark at face value. | A pushed commit | A genuine (not superficially-read) pass/fail verdict | The GitHub Actions polling performed after every push |
| **Freeze** | Close the milestone with a durable record: what shipped, what was decided, what's deferred. | Verified, CI-confirmed implementation | Updated `CURRENT_MILESTONE.md` / `MILESTONE_HISTORY.md`, one commit | Every X.N freeze this session |
| **Knowledge Update** | Feed what this milestone learned back into the repository's *reusable* knowledge — not just its historical record. | A completed freeze | Updates to `TECHNICAL_DEBT.md`, `KNOWN_RISKS.md`, `LESSONS_LEARNED.md`, `DECISION_HISTORY.md`, `REJECTED_DESIGNS.md` as appropriate | **Currently missing** — see the finding above and §6 |

**Architectural principle carried from V1, restated for the whole platform:** every layer above
either gathers evidence or executes an already-approved decision. None may make a judgment call
silently on a human's behalf — Architecture Review may *flag* a fork (like erasableSyntaxOnly
Option A vs B), never *resolve* one alone.

---

## 2. Prompt Library

**Structure only, per instruction — no prompts are written here.**

### 2.1 Storage location

`PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/prompts/`, continuing the repository's
existing `01_`–`04_` numbering convention rather than inventing an unrelated location. One file
per prompt, one subdirectory per category.

### 2.2 Category structure

Mapped onto the Platform Architecture layers (§1), not an arbitrary list:

```
05_ENGINEERING_PLATFORM/prompts/
  planning/            # Request -> Planning layer
  architecture/         # Repository Analysis + Architecture Review layers
  review/                # post-implementation Reviewer role (V1 §3.4)
  ci/                    # CI layer
  freeze/                # Freeze layer
  adr/                   # ADR authoring, distinct from architecture review (review decides
                          # whether one is needed; this category is for writing it once decided)
  legal-review/           # domain-specific, blocked pending skills/dau-thau-mua-sam.md (V1 §3.3)
  procurement-review/     # same blocker
  knowledge-update/        # Knowledge Update layer (§6)
```

### 2.3 Per-prompt metadata schema

Every prompt file carries a small header (mirroring the `Machine Context` YAML block pattern
already used throughout `02_AI_CONTEXT/`, not a new convention):

```yaml
prompt_id: string              # stable identifier, e.g. "freeze-report-v1"
layer: string                  # which of the 9 Platform Architecture layers this serves
purpose: string                # one sentence
required_inputs: [string]      # what must be known/gathered before this prompt is usable
expected_output_shape: string  # what kind of artifact it produces (plan doc / commit message /
                                # freeze report skeleton / etc.), not the artifact itself
depends_on: [prompt_id]        # other prompts this one assumes ran first
blocked_by: string | null      # e.g. "skills/dau-thau-mua-sam.md does not exist" for the two
                                # domain-review prompts
last_validated: date           # last time this prompt was actually used and its output checked
```

### 2.4 Governing principle

A prompt in this library is a **reusable framing of a recurring question this repository has
already asked more than once** (e.g. "does this change trigger an ADR," "is this test failure
the known Prisma flake or a regression"), never a shortcut that answers the question *for* the
human. The metadata schema's `blocked_by` field exists specifically so a prompt pointing at
nonexistent infrastructure (like the two domain-review prompts) is visibly incomplete rather
than silently producing low-quality output.

---

## 3. Command Library

Expands V1 §3.3 with purpose/inputs/outputs/when-used for every command, plus the two newly
requested (`/plan`, `/audit`). Commands are the *executable* form of Prompt Library entries —
each command invokes one or more prompts plus real tool calls (grep, tsc, git, curl).

| Command | Purpose | Inputs | Outputs | When used |
|---|---|---|---|---|
| `/plan` | Produce a Planning-layer document for a proposed change | A task frame (from Request layer) + repository analysis | An `XN_IMPLEMENTATION_PLAN.md`-shaped draft | Start of any milestone or sub-step large enough to warrant one (matches existing practice; formalizes it, doesn't replace it) |
| `/verify` | Run the canonical verification triad | Working tree state | Pass/fail on `tsc -b` / architecture guard / full suite, with the known-flake protocol (Governance Engine §5) applied automatically | Before every commit; on demand mid-implementation |
| `/audit` | Run a full repository-analysis sweep (error inventory, frozen-zone cross-reference, dependency/architecture-constraint check) without proposing a fix | Nothing beyond the current working tree | An evidence table (counts, file lists, root causes) — matches exactly what X.20's planning audit did by hand | Before planning any remediation-shaped milestone (TypeScript debt, ESLint debt, dependency upgrades) |
| `/architecture-review` | Apply the ADR-trigger checklist + Decision Budget sizing + frozen-zone impact to a proposed or in-progress change | A diff or a plan | Go/no-go, ADR-required verdict, budget-fit verdict, list of any unresolved decision forks | Before implementation starts, and again if the diff grows mid-implementation |
| `/review` | Post-hoc diff review against the frozen-path list and Decision Budget (the Reviewer role, V1 §3.4) | A diff (staged or committed) | Pass/fail plus any drift from what Architecture Review approved | After implementation, before commit |
| `/test-review` | Triage a failing test against the known-flake registry (§5, §6) | A test failure | "known flake, rerun" or "possible regression, needs review" | Any time a test fails unexpectedly |
| `/ci-review` | Poll and correctly interpret a GitHub Actions run, including `continue-on-error` masking | A commit SHA | A genuine pass/fail verdict, distinct from the raw API's `conclusion` field where masking applies | After every push |
| `/freeze` | Run `/verify` + git checks (HEAD/origin/branch-sync/working-tree) + `/ci-review`, then print a filled-in freeze-report skeleton | A milestone believed complete | Mechanical evidence for the human-authored freeze narrative — never the narrative itself | End of every milestone |
| `/legal-review` | Check a generated procurement dossier against CLAUDE.md's Legal Priority ordering, Demo Data Principles, and risk-severity tagging | A draft dossier | Findings tagged `[CRITICAL]`/`[HIGH]`/`[MEDIUM]`/`[LOW]` | **Blocked** — needs `skills/dau-thau-mua-sam.md` to exist first (V1 Pain Point 8) |
| `/procurement-review` | Check a KHLCNT/HSMT/HSYC draft against procurement-domain rules (packaging-split, brand-locking, threshold/method selection) | A draft procurement document | Findings tagged by severity | **Blocked**, same reason |

---

## 4. Hook Library

Expands V1 §3.2 with the three newly-requested points (before workflow change, before release,
after merge), each evaluated the same way V1 evaluated the original five — evidence or explicit
rejection, never included by default.

| Point | Recommendation | Evidence / reasoning |
|---|---|---|
| **Before commit** | `tsc -b --listFilesOnly` sanity check (0 files = hard fail) + frozen-path diff against a structured list | V1 H1/H2 — unchanged, still the highest-value pair in the whole platform |
| **Before migration / schema change** | Checklist reminder: DB reachability, `prisma validate`, exactly-one-additive-migration | V1 H3 — unchanged |
| **Before workflow change** (`.github/workflows/*`) | **Recommended, narrow.** Require the change to state explicitly whether it affects blocking behavior (`continue-on-error` present/absent) — X.18 and X.19 both had to reason carefully about exactly this distinction; a one-line self-declaration in the commit message costs nothing and forces the author to have actually checked. | Grounded in the CI-policy decision (G8) already made twice |
| **Before release** (tagging) | **Recommended, narrow.** Confirm `CURRENT_RELEASE.md` is not stale relative to `CURRENT_MILESTONE.md` before tagging — `CURRENT_MILESTONE.md` itself has repeatedly noted `CURRENT_RELEASE.md` "still not updated... stale by N tests" across X.15 through X.19. This hook would have caught that drift the first time it happened instead of letting it compound across five milestones. | Directly observed, recurring, self-reported drift in this repository's own governance file |
| **After CI** | Not a true hook (no webhook receiver) — `/ci-review` is the practical substitute, run manually | V1 H4 — unchanged |
| **After merge** | **Not recommended for this repository's current workflow.** This project pushes directly to `develop` (no long-lived feature branches observed across X.16–X.20.1); "after merge" has no distinct trigger separate from "after push," which `/ci-review` already covers. Revisit only if a PR-based workflow is adopted. | No evidence of a merge event distinct from a push event in this repository's actual history |
| **After freeze** | **Recommended — this is the Knowledge Update layer's trigger (§1, §6).** Every freeze should prompt (not auto-generate) an update to `TECHNICAL_DEBT.md`/`KNOWN_RISKS.md`/`LESSONS_LEARNED.md`/`DECISION_HISTORY.md` where the milestone produced content for them. | Directly closes the orphaned-knowledge-pipeline gap identified in this document's opening finding |

---

## 5. Governance Engine

A **Governance Engine** is the checkable, canonical form of V1's G1–G8 — not a new rule set, a
promotion of existing practice from "prose in freeze reports" to "a single source of truth
every command/hook in §§3–4 reads from," consistent with `SCHEMA.md`'s existing "Ownership map"
pattern (§ opening finding).

| Domain | Rule | Canonical source (proposed) |
|---|---|---|
| **Commit discipline** | Never `git add -A`/`.`; enumerate exact files; diff `git status --porcelain` against intent before every commit. One commit per stage, never bundled. | `REPOSITORY_RULES.md` (already exists; extend, don't duplicate — it already has a `safety_rules_observed` section, per §-check above) |
| **Freeze discipline** | Freeze = `/verify` + git checks + `/ci-review` + human-authored narrative, exactly one freeze commit, updates `CURRENT_MILESTONE.md`/`MILESTONE_HISTORY.md` only. | `REPOSITORY_RULES.md` |
| **ADR policy** | The 7-question trigger checklist (persistence/API/architecture/Docker/auth/messaging/DB-engine change) established at X.19; "no" on all seven means no ADR, ever, regardless of diff size. | `02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md` (existing file — natural home, not yet used this way) |
| **Decision Budget** | ≤8 files, no public API/architecture/migration/dependency/security change → autonomous; else → explicit approval per batch. | Same file as ADR policy — the two are evaluated together at Architecture Review (§1) |
| **Documentation policy** | A document exists only if it answers something git history/CI logs/source code cannot already answer (Lean Governance v2, established X.19). Freeze reports are mechanical-evidence + human-narrative, never restated CI/git output. | `02_AI_CONTEXT/REPOSITORY_RULES.md` |
| **CI policy** | New CI steps default `continue-on-error: true` whenever pre-existing debt would otherwise immediately redden the pipeline; flip to blocking only on a confirmed zero-error baseline. | `02_AI_CONTEXT/REPOSITORY_RULES.md` |
| **Migration policy** | DB reachability check → `prisma validate` → exactly one additive migration per approved change → `migrate dev` against the real dev DB before commit. | `02_AI_CONTEXT/DDD_RULES.md` or a new `PRISMA_RULES.md` sibling — to be decided at implementation time, not here |
| **Flake-handling policy** | Any `execSync('npx prisma validate')`-shaped timeout: rerun up to 3x, compare which file(s) vary, before treating as a regression. | `02_AI_CONTEXT/KNOWN_RISKS.md` (existing file, currently stale since 2026-07-05 — this is exactly the kind of entry it should hold) |
| **Guard-writing standard** | Architecture guards assert *presence*, not exact literal content or exact counts, wherever the asserted set is expected to grow additively (already stated once, in `ADR_X15_ARCHITECTURE_DECISION.md`, never promoted). | `02_AI_CONTEXT/CODING_RULES.md` or `DDD_RULES.md` — promote from the single ADR into the standing rule file |

**Why "Engine" and not just "rules":** every row above has a proposed *canonical file location*
already existing in this repository's structure — the Governance Engine's job is routing
(deciding which existing file a rule belongs in) and enforcement (the hooks in §4 reading from
these files instead of from memory), not inventing a parallel rules system.

---

## 6. Knowledge Pipeline

### 6.1 The gap, restated precisely

`SCHEMA.md`'s Ownership map already assigns:

- `TECHNICAL_DEBT.md` → current-state debt snapshot
- `04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md` → narrative of how each debt item was found
- `KNOWN_RISKS.md` → current risk register
- `04_PROJECT_MEMORY/LESSONS_LEARNED.md` → reusable lessons
- `04_PROJECT_MEMORY/DECISION_HISTORY.md` → why past decisions were made
- `04_PROJECT_MEMORY/REJECTED_DESIGNS.md` → what was considered and explicitly not chosen

All six were last written 2026-07-05. Twenty-plus Phase X milestones' worth of exactly this
content — GX-001 through GX-004 (lessons about guard-writing), the X.16 HMAC-vs-JWT decision,
the X.19 updatedAt-vs-version decision, the X.19 `tsc --noEmit` discovery (a risk if ever
reintroduced), the X.20 TypeScript/ESLint debt (a debt snapshot) — exists today only as prose
buried inside individual freeze reports and `CURRENT_MILESTONE.md`'s `historical_sequence_to_
reach_here` list, not in the files whose entire purpose is to make this kind of knowledge
queryable independent of reading the full milestone history top to bottom.

### 6.2 What each completed milestone should produce (mapped to existing owners)

| Milestone output type | Feeds | Example from this session |
|---|---|---|
| A new open debt item | `TECHNICAL_DEBT.md` (snapshot) + `KNOWN_TECHNICAL_DEBT.md` (narrative) | X.20's 841-diagnostic TypeScript inventory; the 477-finding ESLint backlog (X.18) |
| A newly identified risk (latent bug, flaky infrastructure, environment gap) | `KNOWN_RISKS.md` | The Prisma-validate timing flake; `gh` CLI unavailability; the nine §3.4 suspected-defect clusters from `X20_TYPESCRIPT_REMEDIATION_PLAN.md` |
| A real engineering lesson (not milestone-specific) | `LESSONS_LEARNED.md` | "A verification step can silently check zero files and still exit 0" (X.19); "architecture guards should assert presence, not exact literals" (X.15) |
| A decision with real alternatives considered | `DECISION_HISTORY.md` | HMAC vs. JWT/session/OIDC (X.16); `updatedAt` vs. `version` CAS token (X.19); erasableSyntaxOnly disable vs. codemod (X.20.1) |
| An alternative explicitly rejected | `REJECTED_DESIGNS.md` | The three rejected CAS-token alternatives in `X19_ARCHITECTURE_DECISION.md` (random token in `error`, new enum value, in-process counter) |

### 6.3 Mechanism, not content

This document does not draft entries for any of these files — that would itself be an
implementation action. The recommendation is procedural: add "Knowledge Update" as a named,
non-skippable step of the Freeze layer (§1), triggered by the after-freeze hook (§4), producing
a short prompt (from the `knowledge-update/` category, §2) that asks, for the milestone just
frozen: *does this milestone contain a debt item, a risk, a lesson, a decision, or a rejected
alternative that isn't already captured anywhere outside this freeze's own prose?* — and if so,
write it to the owning file, in one line if that's all it needs.

---

## 7. Repository Profile

### 7.1 What already exists

`02_AI_CONTEXT/` is, functionally, already ~70% of a Repository Profile:
`ARCHITECTURE_CONSTRAINTS.md`, `CODING_RULES.md`, `DDD_RULES.md`, `DEPENDENCY_RULES.md`,
`REPOSITORY_CONTEXT.md`, `REPOSITORY_RULES.md`, `SCHEMA.md`, `SYSTEM_CONTEXT.md` already cover
architecture, coding standards, and system context. The gaps, evaluated against the metadata
categories requested:

| Category | Exists today? | Gap |
|---|---|---|
| Architecture | Yes — `ARCHITECTURE_CONSTRAINTS.md`, `SYSTEM_CONTEXT.md` | None |
| Workflows | Partial — `REPOSITORY_RULES.md` covers git/commit conventions | No file describes the Platform Architecture layers (§1) as a named sequence |
| CI | **No dedicated file** | CI policy lives only in `.github/workflows/ci.yml`'s own comments and this session's freeze reports — not in `02_AI_CONTEXT` |
| Governance | Yes, distributed — `REPOSITORY_RULES.md` + `ARCHITECTURE_CONSTRAINTS.md` | Not consolidated into the single Governance Engine view (§5) |
| Prompts | **Does not exist** | New — §2 |
| Commands | **Does not exist** | New — §3 |
| Hooks | **Does not exist** | New — §4 |

### 7.2 Recommendation

Do not create a competing "Repository Profile" file. Extend the existing `02_AI_CONTEXT/`
structure with exactly the three missing pieces (a CI-policy file, and pointers to the new
`05_ENGINEERING_PLATFORM/` prompt/command/hook directories once built) rather than duplicating
what `SYSTEM_CONTEXT.md`/`ARCHITECTURE_CONSTRAINTS.md` already state correctly.

---

## 8. Engineering Metrics

Every metric below is defined against data this repository can already produce (git history,
CI API responses, this session's own transcripts) — none require new instrumentation to start
collecting once someone decides to.

| Metric | Definition | Source | What it would have shown this session |
|---|---|---|---|
| Implementation time | Wall-clock between a step's first tool call and its commit timestamp | Git commit timestamps + session logs | Not currently tracked; would show verification (tsc/tests) dominating over actual edit time for small, config-only steps like X.20.1 |
| Review iterations | Number of "stop and present findings, wait for approval" round-trips per milestone | Conversation turn count between plan-approval and freeze | Highest at X.19 (the CAS bug discovery forced an extra round-trip) and the CI investigation (its own explicit sub-task) |
| CI failures | Count of non-`success` GitHub Actions runs per milestone, distinguishing genuine failures from `continue-on-error`-masked ones | Public Actions API, already queried manually at every push this session | X.18 had 1 genuine failure (missing `prisma generate`) out of 3 runs; every run since has been `conclusion: success`, some masking real internal failures (X.19's Type-check step) |
| Rollback count | `git revert` commits referencing an X-phase commit | `git log --grep` | Zero across the entire session — every milestone shipped without a rollback, a real, measurable signal of the verification discipline's effectiveness |
| Files touched | Files changed per commit, per stage | `git show --stat` | Ranged from 1 (X.20.1, X.19's CI fix) to 8 (X.19's implementation commit) — never exceeded the Decision Budget's ≤8 informally, even before the budget's exact number was set |
| Prompt reuse | Times a Prompt Library entry (§2) is invoked unmodified vs. edited | N/A — no prompt library exists yet | Forward-looking only; cannot be measured until §2 is implemented |
| Verification cost | Tool calls / wall-clock spent on `tsc -b` + architecture guard + full suite, as a fraction of the step's total | Session transcript | High relative to implementation size for small config-only changes (X.20.1's 2-line diff required a multi-minute full-suite run) — the strongest, most concrete case for `/verify` (§3) existing |

**Recommendation:** these metrics should not be collected via a new dashboard or service —
that would be new infrastructure disproportionate to a single-developer repository. They should
be computable, on demand, from `git log` and the GitHub Actions API by the same `/audit` command
(§3) that already exists for repository-analysis purposes.

---

## 9. Implementation Roadmap

Every phase below is scoped small enough to fit inside the existing Decision Budget as one or
two commits; none requires an ADR (none changes persistence model, public API, architecture,
Docker topology, auth model, deployment strategy, messaging/event architecture, DB engine, or
cross-module contracts — every item here is developer-tooling/process, external to the
application's own runtime architecture, matching V1's own ADR analysis).

| Phase | Objective | Expected files | Est. commits | ADR required? | Decision Budget? | Risk | Rollback complexity |
|---|---|---|---|---|---|---|---|
| **P1 — Governance Engine consolidation** | Write down G1–G8/§5's rules into their proposed existing owning files (`REPOSITORY_RULES.md`, `ARCHITECTURE_CONSTRAINTS.md`, `KNOWN_RISKS.md`) | 3-4 existing files, edited additively | 1 | No | Yes — fits easily | Very low (pure documentation) | Trivial (`git revert`) |
| **P2 — Knowledge Pipeline reactivation** | Add the after-freeze Knowledge Update step (§6) to the freeze process; backfill the most significant already-known items (the Prisma flake, the `tsc --noEmit` no-op lesson, the X.19/X.20 decisions) into their owning files as a one-time catch-up | `KNOWN_RISKS.md`, `LESSONS_LEARNED.md`, `DECISION_HISTORY.md`, `TECHNICAL_DEBT.md`, `REJECTED_DESIGNS.md` | 1-2 (one for process change, one for backfill) | No | Yes | Low — additive only, no file's existing content is altered, only appended | Trivial |
| **P3 — Core command library** | Build `/verify`, `/audit` (highest-leverage, zero dependencies) | New files under `05_ENGINEERING_PLATFORM/` (exact mechanism — slash-command definition vs. script — decided at implementation time) | 1 per command, 2 total | No | Yes | Low | Trivial — additive tooling, doesn't touch app code |
| **P4 — Hook: pre-commit sanity checks** | Implement H1 (`tsc -b --listFilesOnly` check) and the frozen-path structured list (feeds H2 and `/architecture-review`) | 1-2 new files | 2 | No | Yes | Low-Medium — the frozen-path list must be kept in sync with `CURRENT_MILESTONE.md`'s prose `do_not` block; needs an explicit owner/process, not just a one-time extraction | Trivial to revert the hook; the frozen-path list itself needs a "last synced" marker to avoid silent drift |
| **P5 — Remaining command library** | `/plan`, `/architecture-review`, `/review`, `/test-review`, `/ci-review`, `/freeze` | New files, one per command | 1 per command (6 total, never bundled) | No | Yes, per command | Low, individually | Trivial |
| **P6 — Prompt library scaffolding** | Create `05_ENGINEERING_PLATFORM/prompts/` structure and metadata schema (§2); populate only the prompts P3–P5's commands actually need | New directory + files | 1-2 | No | Yes | Low | Trivial |
| **P7 — Repository Profile completion** | Add the missing CI-policy file to `02_AI_CONTEXT/`; cross-link the new `05_ENGINEERING_PLATFORM/` structure from `SCHEMA.md`'s ownership map | 2 existing files edited, additively | 1 | No | Yes | Very low | Trivial |
| **P8 — Remaining hooks** | Before-workflow-change, before-release checks (§4) | 1-2 new files | 2 | No | Yes | Low | Trivial |
| **P9 — Engineering Metrics via `/audit`** | Extend `/audit` (already built in P3) to compute the §8 metrics on demand | Extends an existing file | 1 | No | Yes | Very low | Trivial |
| **P10 — Domain-review unblock (conditional)** | Create `skills/dau-thau-mua-sam.md` (referenced by CLAUDE.md, does not exist), *then* build `/legal-review`/`/procurement-review` and their prompts | New skill file + 2 command files | 2-3 | **Possibly** — depends entirely on what the skill file specifies; re-evaluate against the ADR checklist once its content is known, not assumed here | Yes, likely, once scoped | Medium — this is the only phase touching genuinely new domain content, not developer tooling | Depends on skill-file scope — assess at that phase's own planning step |

**Ordering rationale:** P1–P2 come first because they cost almost nothing and every later phase
benefits from having the rules and the historical knowledge already consolidated. P3–P4 come
next because they're the highest-frequency, already-proven-in-practice needs (V1's own
priority ranking). P10 is deliberately last and explicitly conditional — it depends on resolving
a gap (the missing skill file) that is itself a real, separate decision the user hasn't yet
made, and should not be assumed away by building tooling around it first.

---

*End of design document. Per instruction, nothing was implemented: no source, test, CI,
workflow, plugin, hook, agent, or governance/milestone file was created or modified. Waiting for
explicit approval before implementing any phase above.*
