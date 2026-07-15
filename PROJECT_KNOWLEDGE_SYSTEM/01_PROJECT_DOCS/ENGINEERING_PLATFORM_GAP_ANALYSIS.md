# Engineering Platform — Gap Analysis (V2 vs. Current Repository)

**Status:** AUDIT ONLY. No source, test, CI, workflow, or governance file was created or
modified. Every claim below was verified by direct inspection (`find`, `git log`, file reads)
during this audit, not assumed from `ENGINEERING_PLATFORM_V2.md`'s own descriptions.

**One correction to V2 itself, found during this audit and stated up front:** V2 §6's Knowledge
Pipeline analysis considered only `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/` and
`04_PROJECT_MEMORY/`. This audit found a **third, more detailed knowledge tier** —
`app/.memory/` (67 tracked files: `technical-debt.md`, `known-issues.md`, `decision-log.md`,
`repository-health.md`, `project-status.md`, `next-task.md`, and more) — created in one commit
(`docs(memory): add project constitution and full architecture memory system`, 2026-07-05) and,
like its `PROJECT_KNOWLEDGE_SYSTEM` siblings, **never updated since.**
`02_AI_CONTEXT/TECHNICAL_DEBT.md` itself already documents the intended relationship: it is a
*"curated summary"*; `app/.memory/technical-debt.md` is the *"full_register... authoritative."*
This is a real, three-tier system, not two — every recommendation below accounts for all three.

---

## Component-by-Component Status

### A. Platform Architecture (V2 §1) — the 9 layers

**Status: Already Exists (as informal practice), Missing (as named/tooled structure)**

- **Exact location:** nowhere as a named artifact — the sequence Request → Planning →
  Repository Analysis → Architecture Review → Implementation → Verification → CI → Freeze →
  Knowledge Update is followed correctly (evidenced by every X.16–X.20.1 step in this session)
  but exists only as unstated practice.
- **Owner:** none — no file claims ownership of "this is our engineering process."
- **Current responsibilities:** fully covered in practice; zero coverage in documentation.
- **Recommended refactor:** none needed for the layers themselves (they work). The only real
  gap is that **Knowledge Update (layer 9) is the one layer with no destination that's actually
  being written to** — see Component F.

### B. Prompt Library (V2 §2)

**Status: Missing**

- **Why actually needed:** every command in Component C needs a defined input/output contract
  to be buildable at all; without it, each command would be built ad hoc with no shared
  structure, reproducing the exact "re-derived from memory each time" problem this whole
  platform exists to fix (V1 Pain Points 1–3).
- **Implementation priority:** Low on its own — build only enough of it to support the specific
  commands actually being implemented (P3/P5 in the V2 roadmap), not the full taxonomy upfront.
- **Dependencies:** none blocking; can be scaffolded alongside the first command it serves.

### C. Command Library (V2 §3) — 10 proposed commands

| Command | Status | Detail |
|---|---|---|
| `/verify` | **Missing** | Needed: extracts the `tsc -b` + architecture guard + full-suite triad manually run ~15+ times this session. Priority: **High**. Dependencies: none. |
| `/audit` | **Missing** | Needed: this exact gap-analysis process (and X.20's TypeScript audit) was done entirely by hand with `grep`/`find`/`git log`; a reusable command is directly evidenced by two separate uses already. Priority: **High**. Dependencies: none. |
| `/architecture-review` | **Missing** | Needed: the ADR-checklist + Decision Budget + frozen-zone walkthrough performed at every X.16–X.20 kickoff, always re-derived from reading `CURRENT_MILESTONE.md`'s prose `do_not` list by eye. Priority: **Medium-High**. Dependencies: a structured (not prose) frozen-path list (see Component D, pre-commit hook). |
| `/review` | **Missing** | Needed: post-hoc diff-vs-budget check, distinct from the pre-implementation `/architecture-review`. Priority: **Medium**. Dependencies: same structured frozen-path list. |
| `/test-review` | **Missing** | Needed: the Prisma-validate-flake-vs-regression judgment call was made by hand 5+ times (X.14, X.15, X.17, X.19, X.20.1). Priority: **Medium**. Dependencies: the flake signature needs to be written down first (Component E, flake-handling policy) — currently exists only as prose in freeze reports, not a checkable fact. |
| `/ci-review` | **Missing** | Needed: interpreting `continue-on-error`-masked GitHub Actions results (X.19's Type-check step) required manual, careful reasoning each time. Priority: **Medium**. Dependencies: none technical, but `gh` CLI is confirmed absent from PATH in this environment (re-verified this session) — the command must be built on the `curl`-against-public-API pattern, not assume `gh` exists. |
| `/freeze` | **Missing** | Needed: composes `/verify` + git checks + `/ci-review` + a freeze-report skeleton. Priority: **Medium** (depends on the above three existing first). Dependencies: `/verify`, `/ci-review`. |
| `/plan` | **Should Not Exist as a distinct command** | V1 originally rejected this ("planning discipline is already this project's best-functioning process") and V2's Command Library table softened that into a qualified inclusion — this audit resolves the inconsistency in **V1's favor**: every `XN_IMPLEMENTATION_PLAN.md` and both `ENGINEERING_PLATFORM_V1.md`/`V2.md` were produced without any tooling gap being felt. Formalizing an already-working, judgment-heavy process into a command risks encouraging a templated plan where a genuinely-reasoned one is needed. See "Components That Should Never Be Implemented" below. |
| `/legal-review` | **Missing, blocked** | `skills/dau-thau-mua-sam.md` (referenced by CLAUDE.md) confirmed still absent from the repository (re-checked this audit). Priority: blocked, not scored, until that gap is a separate, explicit decision. |
| `/procurement-review` | **Missing, blocked** | Same blocker as `/legal-review`. |

### D. Hook Library (V2 §4) — 7 proposed points

**Status: Missing — and more fundamentally than "not written."**

- **Missing capability, confirmed by direct inspection:** this repository has **no hook
  execution mechanism at all.** `.git/hooks/` contains only Git's default `.sample` files (none
  active); `app/package.json` has no `husky`, `lint-staged`, or `simple-git-hooks` dependency.
  Every hook in V2 §4 would need not just its own logic but the runner infrastructure underneath
  it — this is a materially bigger gap than V2's phrasing ("implement H1...") implied.
- **Minimal implementation:** for a single-developer, Windows/Git-Bash repository with no
  existing hook framework, the lowest-risk starting point is a plain `.git/hooks/pre-commit`
  shell script (zero new dependency) rather than adopting Husky — Husky would be this
  project's first-ever devDependency added purely for tooling, and the Decision Budget's own
  "no dependency changes → autonomous" criterion means adding one requires explicit approval
  regardless of how small.
- **Estimated effort:** Low for the pre-commit sanity check (H1: `tsc -b --listFilesOnly`,
  already a single command) once the runner exists; Medium for the frozen-path guard (H2),
  since it first needs the structured extraction described in Component E.
- **Before-workflow-change / before-release:** same "no runner exists yet" gap; both are
  otherwise Low-effort content once a runner is chosen.
- **After-CI, after-merge:** confirmed correctly excluded by V2 already — no re-analysis needed;
  restated in "Should Never Be Implemented" below for completeness.
- **After-freeze (Knowledge Update trigger):** Missing, same runner dependency; this is the one
  hook this audit weights highest, since Component F shows exactly what happens without it
  (three orphaned knowledge tiers, all stopped on the same day).

### E. Governance Engine (V2 §5) — 9 rule domains

**Status: Partially Exists.** Every proposed *owning file* already exists, well-structured, and
actively maintained in spirit (`as_of` metadata, explicit `Purpose` headers) — but every file's
actual content predates Phase X and does not contain the specific Phase X.15–X.20 rules V2
proposes routing into it. Verified by direct content inspection, not assumption:

| Rule domain | Proposed owner | Owner file status | Rule content present? |
|---|---|---|---|
| Commit discipline | `REPOSITORY_RULES.md` | Exists, `as_of: 2026-07-05`, covers branching/tagging conventions | **No** — "never `git add -A`," "one commit per stage," and the exact-file-enumeration discipline are Phase X practices, absent from this file |
| Freeze discipline | `REPOSITORY_RULES.md` | Same file | **No** |
| ADR policy (7-question checklist) | `ARCHITECTURE_CONSTRAINTS.md` | Exists, `as_of: 2026-07-05`, covers Phase A–N structural rulings | **No** — the checklist is an X.19 invention |
| Decision Budget | Same file | Same | **No** — established X.19, budget widened by the user mid-session; not written anywhere outside chat/freeze-report history |
| Documentation policy (Lean Governance v2) | `REPOSITORY_RULES.md` | Same | **No** — established X.19 |
| CI policy (`continue-on-error` default) | `REPOSITORY_RULES.md` (no dedicated CI file exists — confirmed, matches V2 §7's own finding) | Partial — the *decision* exists in `X18_ARCHITECTURE_DECISION.md`, not in a rule file | **No** |
| Migration policy | `DDD_RULES.md` (candidate) | Exists, `as_of: 2026-07-05`, covers bounded contexts/aggregates, not migration procedure | **No** |
| Flake-handling protocol | `KNOWN_RISKS.md` | Exists, `as_of: 2026-07-05`, lists Phase A–N risks (e.g. hallucinated-citation risk); the Prisma-validate flake, confirmed recurring 5 times this session, is **absent** | **No** |
| Guard-writing standard (presence, not exact literal) | `CODING_RULES.md` (candidate) | Exists, `as_of: 2026-07-05` | **No** — stated once, in `ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions section, never promoted |

**Minimal implementation:** additive edits to 3–4 existing files (`REPOSITORY_RULES.md`,
`ARCHITECTURE_CONSTRAINTS.md`, `KNOWN_RISKS.md`, `CODING_RULES.md`) — no new files needed for
this component. **Estimated effort:** Low (documentation only, matches V2's own P1 estimate).

### F. Knowledge Pipeline (V2 §6) — corrected for the three-tier finding above

**Status: Already Exists (all three tiers) — all three simultaneously stale.**

| Tier | Files | Owner (per `SCHEMA.md`) | Last updated | Current responsibility |
|---|---|---|---|---|
| Curated summary | `02_AI_CONTEXT/TECHNICAL_DEBT.md`, `KNOWN_RISKS.md` | `SCHEMA.md`'s Ownership map | 2026-07-05 | Current-state snapshot, meant to be short |
| Narrative | `04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md`, `LESSONS_LEARNED.md`, `DECISION_HISTORY.md`, `REJECTED_DESIGNS.md` | Same | 2026-07-05 | How/why, not just what |
| Detailed register | `app/.memory/technical-debt.md`, `known-issues.md`, `decision-log.md` | Positioned by `02_AI_CONTEXT/TECHNICAL_DEBT.md` itself as *"the full_register... authoritative"* | 2026-07-05 | Line-number-precise, per-item detail |

**Recommended refactor only** (no new files, no new structure — this is a reactivation, not a
build): resume writing to all three tiers as part of the Freeze layer (V2 §1, §4's after-freeze
hook), using the existing division of labor exactly as `SCHEMA.md` already defines it. This is
the single highest-leverage item in the entire gap analysis, because the container, the
ownership rules, and the tiering logic are already correctly designed — only the writing habit
stopped.

**Additional finding, not in V2:** `app/.memory/technical-debt.md`'s own content has partially
**aged past correct** — e.g. `TD-03` ("No authentication/authorization layer... every service
function is open to any caller") predates Phase X.14–X.16, which built real (if not fully
wired-in) authorization and credential-verification infrastructure. Reactivating this tier
requires a **reconciliation pass**, not just new appends — an explicit, separate task, not
assumed away here.

### F.2 `app/.memory/project-status.md` and `next-task.md`

**Status: Should Not Exist (as separately-maintained "current status" files going forward).**

- **Why:** both are confirmed, by direct read, to state stale status — `project-status.md`
  reads *"Current Milestone = Knowledge Platform v1.0... Next Planned Milestone = Phase X
  Architecture Design — NOT started"* (20+ milestones out of date); `next-task.md` similarly
  stops at a pre-Phase-X checkpoint. Both serve the exact same purpose
  `02_AI_CONTEXT/CURRENT_MILESTONE.md` already serves, and only the latter has been kept
  current throughout Phase X.
- **What existing infrastructure already solves it:** `CURRENT_MILESTONE.md`, updated at every
  freeze, is the correct single source of truth for "what's current / what's next." Maintaining
  two independently-updated "current status" files is exactly how this drift happened in the
  first place — the fix is retiring or redirecting these two files to point at
  `CURRENT_MILESTONE.md`, not updating them in parallel going forward.

### G. Repository Profile (V2 §7)

**Status: Partially Exists** — confirms V2's own finding, verified directly. `02_AI_CONTEXT/`
holds 12 files covering architecture (`ARCHITECTURE_CONSTRAINTS.md`, `SYSTEM_CONTEXT.md`),
coding/DDD/dependency rules, and milestone/release state. Confirmed genuinely missing by direct
`find`: no CI-policy file, no `05_ENGINEERING_PLATFORM/` directory, no `.claude/commands/` or
`.claude/agents/` directory (`.claude/` contains only `scheduled_tasks.lock` and
`settings.local.json`). **Minimal implementation:** one new CI-policy file; the
prompt/command/hook directories are created incrementally as Components B/C/D are actually
built, not upfront. **Estimated effort:** Low.

### H. Engineering Metrics (V2 §8)

**Status: Missing** — confirmed no metrics collection, dashboard, or computed-report exists
anywhere in the repository. **Why actually needed:** every metric V2 defines is answerable from
data that already exists (`git log`, the GitHub Actions API) — the gap is entirely "nobody has
asked the question yet," not "the data doesn't exist." **Implementation priority: Low**,
correctly deferred in V2's own roadmap to P9, after `/audit` (Component C) exists to compute
them on demand. **Dependencies:** `/audit`.

---

## Components That Should Never Be Implemented

1. **`/plan` as a distinct slash command** (Component C) — the underlying practice already
   works without it; formalizing it risks templating a process whose value is the reasoning,
   not the artifact shape.
2. **An after-merge hook** — already correctly rejected in V2; reconfirmed here: this
   repository pushes directly to `develop` with no observed PR/merge-distinct-from-push
   workflow across the entire X.16–X.20.1 history.
3. **A genuine after-CI webhook** — no receiver exists or is warranted for a local-dev,
   single-developer repository; the polling-based `/ci-review` command is the correct and
   sufficient substitute, not a stepping-stone to something more automated.
4. **A new, parallel "Repository Profile" file or a fourth knowledge tier** — three tiers
   already exist (Component F); a fourth would only add another orphan-risk surface, not close
   one.
5. **Husky/lint-staged or any new hook-runner dependency**, at least initially — a plain
   `.git/hooks/pre-commit` script covers the two highest-value hooks (H1, H2) with zero new
   dependency; only reconsider a framework if hook complexity genuinely outgrows what a shell
   script can express.
6. **A metrics dashboard or collection service** (Component H) — V2 itself already rejected
   this as disproportionate to a single-developer repository; this audit found no evidence to
   revisit that call.
7. **`app/.memory/project-status.md` / `next-task.md` as independently-updated files going
   forward** (Component F.2) — one source of truth (`CURRENT_MILESTONE.md`) already exists and
   already works; a second, separately-maintained "current status" file is a duplicate-risk
   generator, evidenced by the fact that it already happened once.

---

## Scores

### 1. Platform Readiness Score: **35 / 100**

Weighted across all 24 scored components in this analysis (9 Platform Architecture layers as
one group, 8 scored commands, 7 hook points, 9 governance rule domains, 3 knowledge tiers, 1
repository profile, 1 metrics system): the *conceptual design* is complete and repository-
grounded (V2 itself scores near-100% design coverage), but *executable* readiness is low —
every command, every hook mechanism, and every specific governance rule remains to be written.
The 35 reflects substantial credit for what genuinely already exists and is reusable (three
knowledge tiers, ~12 well-structured `02_AI_CONTEXT` files, a working informal process) against
the fact that zero lines of the platform itself (commands, hooks, prompts) exist yet.

### 2. Duplicate Risk Score: **Medium (confirmed, not hypothetical)**

Not hypothetical: `app/.memory/project-status.md`/`next-task.md` vs. `CURRENT_MILESTONE.md` is
a **confirmed**, already-materialized duplicate-tracking failure (both went stale the moment
only one was kept current). The three-tier knowledge system (Component F) is *not* itself a
duplication risk — it's a deliberately designed hierarchy — but only as long as the reactivation
in P2 (V2 roadmap) writes to all three tiers via one process, not three independent ones. Risk
is Medium rather than High because the ownership map (`SCHEMA.md`) already exists to prevent
drift, if actually followed.

### 3. Technical Debt Score: **High, and now two distinct kinds**

(1) **Code-level debt**, already quantified: 841 TypeScript diagnostics / 309 files (X.20 audit)
plus 477 pre-existing ESLint findings (X.18). (2) **Governance-content debt**, newly identified
by this audit: every rule file in `02_AI_CONTEXT`/`04_PROJECT_MEMORY`/`app/.memory` is
20+ milestones stale, and at least one entry (`TD-03`, authentication/authorization) is now
factually **outdated**, not just incomplete — a governance file being wrong is a different, and
in an audit-first project arguably more serious, category of debt than a file being merely
absent.

### 4. Automation Readiness Score: **Low (15 / 100)**

No hook-execution mechanism exists at all (no active git hooks, no husky/lint-staged
dependency). No command-dispatch mechanism exists in this repository (`.claude/` has no
`commands/` directory). The score is not zero only because the *content* every command/hook
would need (verification commands, the frozen-path list's raw material, the flake signature) is
already fully known and evidenced from this session — assembling it into executable form is
Low-Medium effort, not a research problem.

---

## 5. Recommended Implementation Order

Unchanged in spirit from V2 §9's roadmap, with one reordering: **Knowledge Pipeline
reactivation (P2) is promoted above even the Governance Engine write-down (P1)** wherever the
two compete for attention, because Component F.2's duplicate-tracking failure is already
live and compounding with every new milestone that doesn't feed any of the three tiers.

1. **P1/P2 combined** — write down the Governance Engine rules (Component E) *and* reactivate
   the Knowledge Pipeline (Component F), including the `app/.memory` reconciliation pass and
   retiring `project-status.md`/`next-task.md` as independent files — as one coordinated
   documentation effort, since both are pure-documentation, zero-code, zero-risk, and mutually
   reinforcing (the flake-handling rule and the flake's own risk-register entry are the same
   piece of knowledge viewed from two owning files).
2. **P3** — `/verify` and `/audit`, the two highest-evidenced, zero-dependency commands.
3. **P4** — the pre-commit hook mechanism (a plain shell script, not a new dependency) carrying
   H1 (`tsc -b` sanity) and the structured frozen-path extraction that H2 and
   `/architecture-review` both need.
4. **P5** — remaining commands (`/architecture-review`, `/review`, `/test-review`,
   `/ci-review`, `/freeze`), each its own commit, in that dependency order.
5. **P6/P7** — prompt-library scaffolding and Repository Profile completion (the CI-policy
   file), built incrementally alongside whichever commands need them, not upfront.
6. **P8** — remaining hooks (before-workflow-change, before-release, after-freeze).
7. **P9** — Engineering Metrics via `/audit`.
8. **P10, explicitly last and conditional** — domain-review unblock, gated on the separate,
   still-open decision of whether/how to create `skills/dau-thau-mua-sam.md`.

## 6. Components That Should Never Be Implemented (summary)

`/plan` as a distinct command; an after-merge hook; a genuine after-CI webhook; a fourth
knowledge tier or parallel repository-profile file; a new hook-runner dependency (at least
initially); a metrics dashboard/service; and `app/.memory/project-status.md`/`next-task.md` as
independently-maintained files going forward. Full reasoning for each under "Components That
Should Never Be Implemented" above.

---

*End of gap analysis. No implementation, no ADR, no commits. Waiting for approval before
building any component listed above.*
