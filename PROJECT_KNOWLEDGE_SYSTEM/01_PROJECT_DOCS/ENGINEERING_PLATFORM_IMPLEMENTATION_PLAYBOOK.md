# Engineering Platform — Implementation Playbook

**Status:** PLANNING ONLY. No code, no TypeScript, no runtime, no commit, no CI, no repository
modification besides this one document. The research phase is closed. `ENGINEERING_PLATFORM_
PRODUCT_SPEC.md` is treated as **frozen** — this playbook does not redesign it, does not
question its layer boundaries, and does not reopen any decision it already made. Its only job is
to turn that frozen design into an executable sequence: what to build, in what order, verified
how, rolled back how — and to give a future session everything it needs to start building without
re-deriving any of this from scratch.

---

# Part 1 — Executive Summary

## What was learned

- A platform's entire value can be proven by shipping **one** real rule end-to-end
  (`REVIEW-3`) before designing the other twenty-four — the working example, not the catalog,
  is what validated every downstream design decision.
- The most expensive defect in the whole case study was a verification step that silently
  checked **zero files** and still reported success — not a logic bug, an *absence-of-signal*
  bug. This shaped the platform's central discipline: every verification claim must be checkable,
  never merely asserted (including a CI provider's own "success" field).
- A duplicate "current state" file drifted stale for twenty-plus milestones before an audit
  caught it — not because anyone was careless, but because no single file's ownership was ever
  declared. One owning file per fact, enforced by a real map, prevents this class of failure
  entirely rather than relying on vigilance.
- Architecture guards that assert exact literal content or exact counts break on every
  legitimate, additive extension of the thing they protect — four separate governance exceptions
  in the case study trace to this one root cause.
- Every mid-implementation deviation from a stated plan, disclosed and re-checked against
  budget, cost nothing. Every silent deviation would have cost trust in the process itself. The
  two are not symmetric risks.
- A generalized runtime, a plugin system, an event bus, and a metrics dashboard were all
  designed at some point in this research — and every one of them was correctly *not* built
  until a second real consumer existed to justify it. Restraint was as load-bearing as any single
  mechanism that was actually built.

## What should be reused

- The 8-layer Core Platform boundary (`ENGINEERING_PLATFORM_PRODUCT_SPEC.md` §3) — the single
  rule that makes any of this portable.
- The Rule Definition Format, the 8 governance-rule categories, and the Vertical Slice
  methodology (Part 4, below) — proven against one real rule, designed to generalize to any
  number more.
- The three-tier Knowledge System and its Ownership Map discipline (§5) — the one piece of this
  platform with direct, confirmed evidence of preventing a real, already-materialized failure.
- The Runtime's Core/Reusable/Repository-specific/Future component split (§4, §26) — a concrete,
  working extraction, not a hypothetical one.
- The presence-check-not-exact-literal guard standard (§11) — hard-won from four repeated
  incidents, not a style preference.

## What should NOT be copied

- **Any repository-specific binding**: exact file paths, exact frozen-zone lists, exact flake
  signatures, exact Decision Budget thresholds (`≤8 files` is this case study's own tuned value,
  not a universal constant), and — most importantly — **any procurement, legal, or other domain
  content**. None of it belongs in the Core Platform (L1–L8) of a new installation.
- **The specific content of the 24 designed-but-never-implemented governance rules.** Their
  *categories* and *format* are canonical; their content was designed against one repository's
  own history and needs re-deriving, not copy-pasting, for a new one.
- **Any claim of "validated" beyond n=1.** Every generalization in this research explicitly
  traces to a single real instance (`REVIEW-3`). Treating any of it as proven-at-scale rather
  than proven-once-and-reasoned-about-carefully would be the platform's own first violation of
  its own Documentation Rule ("never overclaim certainty").
- **The exact 40-section structure of the Product Spec itself** as something every future
  document must replicate — it was the right shape for a one-time, comprehensive design capture,
  not a template for every future artifact this platform produces.

## Biggest engineering lessons

1. **Absence of failure is not evidence of correctness.** A check that can silently do nothing
   is worse than no check — it actively misleads. Every verification mechanism in this platform
   must be provably non-vacuous, not just present.
2. **Duplication is a governance failure, not a discipline failure.** The fix for "two files
   both claim to be current" is never "try harder to remember to update both" — it is "make it
   structurally impossible for two files to both claim ownership."
3. **A guard that can't survive its own subject's legitimate growth will be routed around.**
   Presence-based, not exact-shape, is not a stylistic choice; it's the only guard shape that
   stays useful over time.
4. **The correct response to "should we build this generically" is almost always "not yet."**
   Every piece of unnecessary generality this research avoided (an event bus, a plugin loader, a
   metrics service) was avoided by the same test: does a second real consumer exist. None did.
5. **Judgment calls made silently are the platform's single highest-risk failure mode** — higher
   than any specific bug. Every mechanism in this platform exists either to gather evidence for a
   human judgment or to apply an already-explicit, already-approved policy — never to make a new
   judgment on a human's behalf.

---

# Part 2 — Canonical Documents

Every engineering document this research produced, in dependency order, with its permanent
status stated plainly — not inferred from where it sits in a folder.

| Document | Purpose | Status | Dependencies | Permanent platform artifact? | Historical only? |
|---|---|---|---|---|---|
| `ENGINEERING_PLATFORM_V1.md` | First pain-point analysis + tooling recommendations, grounded in one repository's own history. | Approved | None | No | **Yes** — superseded in full by the Blueprint and Product Spec. |
| `ENGINEERING_PLATFORM_V2.md` | Expanded the V1 wish-list into a complete 9-layer "Developer Operating System" design. | Approved | V1 | No | **Yes** — superseded by the Blueprint's generalized layer model. |
| `ENGINEERING_PLATFORM_GAP_ANALYSIS.md` | Audited V2's design against real repository state; found a third knowledge tier V2 itself missed. | Approved (audit) | V1, V2 | No | **Yes** — a point-in-time audit of one repository. |
| `ENGINEERING_EVOLUTION_ROADMAP.md` | Sequenced the Gap Analysis's findings into small, independently-mergeable milestones (Phases A–I). | Approved (design) | Gap Analysis | **Partially — the phase-sequencing *pattern* feeds Part 3, below** | The specific milestone content (A1–I2) is historical. |
| `ENGINEERING_PLATFORM_BLUEPRINT.md` | Generalized the Roadmap into a portable, repository-independent 9-layer blueprint; first document to state the layer non-dependency rule explicitly. | Approved | Roadmap | **Partially — superseded in content by the Product Spec, but its reusable/repo-specific classification work is the direct ancestor of Product Spec §3** | The specific repo-mapping table is historical. |
| `GOVERNANCE_ENGINE_DESIGN.md` | Catalogued 25 governance rules across 8 categories, with a shared-mechanism consolidation principle. | Planning only | None | **Yes — the 8-category taxonomy and Rule Definition Format are canonical** | The 24 undesigned-in-detail rule *contents* are this repository's own; the format is not. |
| `GOVERNANCE_ENGINE_RUNTIME.md` | Designed the Rule Execution Pipeline and every runtime concern (registry, lifecycle, validation, reporting, rollback, versioning, deprecation, testing, API). | Planning only, Revision 1 applied | Governance Engine Design | **Yes** — directly implements as Product Spec §4. | No. |
| `GOVERNANCE_OBJECT_MODEL.md` | Formally typed the 23 first-class objects the Runtime touches. | Planning only, Revision 1 applied | Runtime Architecture | **Yes** — the object catalog is canonical, referenced by Product Spec §26–27. | No. |
| `GOVERNANCE_RUNTIME_LIFECYCLE.md` | Specified HOW the runtime behaves — startup, execution stages, state machine, failure model, retry/rollback/parallelism. | Planning only, Revision 1 (post formal Architecture Review) | Object Model | **Yes** | No. |
| `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` | Reverse-engineered `REVIEW-3`'s own real implementation into the mandatory process for every future rule. | Planning only / canonical template | REVIEW-3 (real code) | **Yes — this is Part 4 of this playbook, operationalized** | No. |
| `GOVERNANCE_ARCHITECTURE_FREEZE.md` | Froze the entire Governance Engine architecture (v1.0) after a formal, two-pass Architecture Review. | **FROZEN** | Every document above | **Yes — the freeze record itself is the permanent marker of "design complete, implementation authorized"** | No. |
| `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md` | Translated the frozen architecture into strict, phase-by-phase (0–4) implementation constraints — its own Implementation Order table ends at Phase 4; nothing past that point is Contract-authorized (`CONTRACT_PLAYBOOK_ALIGNMENT_REVIEW.md`). | Contract; Phases 0–4 **all implemented** | Architecture Freeze | **Yes — this Playbook's own Phase 0–4 rows implement it directly; Playbook content beyond Phase 4 carries no Contract authority and lives in `ENGINEERING_PLATFORM_FUTURE_BACKLOG.md`** | No. |
| `ENGINEERING_PLATFORM_EXTRACTION.md` | Extracted portable patterns from the full case study into a repository-independent analysis. | Extraction only | All of the above | **Partially — its reasoning is the direct ancestor of the Product Spec; superseded as the canonical reference by it** | The document itself is a historical waypoint. |
| `ENGINEERING_PLATFORM_PRODUCT_SPEC.md` | The standalone, versioned product specification for Engineering Platform v2 — 40 sections, frozen at this playbook's own instruction. | **FROZEN — the canonical design** | Extraction | **Yes — this is now the single source of truth every phase in Part 3 implements against** | No. |
| `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` (this document) | Turns the frozen Product Spec into an executable phase sequence, rule set, and bootstrap prompt. | **Canonical, living** — Part 3's checklist state is expected to update as phases complete; its design content does not. | Product Spec | **Yes** | No. |

**Implemented, non-planning artifacts** (the only real code/config produced by this entire
research arc, kept here for completeness since Part 3 treats them as the proven reference
implementation, not as documents): `app/scripts/verifyPushState.ts`,
`app/scripts/lib/governanceRuntime.ts`, `.claude/commands/ci-review.md`,
`PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/{REVIEW-3.md,REGISTRY.md}`.

---

# Part 3 — Implementation Order

**Ground rule for every phase below, inherited unmodified from the Implementation Contract's own
§9 Stop Conditions:** a phase halts immediately and waits for explicit human input if verification
fails and isn't fixable within its own declared scope, if its real file footprint would exceed
what's declared or exceed 8 files, if a forbidden file would need to change, if a genuine
architecture inconsistency is found, or if any temptation arises to add a capability not named in
its own scope.

**Relationship to this repository's own, already-real Phase 0–4:** none of Phases 0–4 below are
hypothetical — each has a proven, working reference implementation in this repository, confirmed
directly against `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`'s own same-numbered phase as
each was actually built (`verifyPushState.ts` → `governanceRuntime.ts` →
`validateGovernanceRule.ts`). A new platform installation's own Phase 0–4 work is **porting and
generalizing that proof**, not inventing from nothing. This is also, by direct evidence rather
than assumption (`CONTRACT_PLAYBOOK_ALIGNMENT_REVIEW.md`), the exact boundary of what the
Contract authorizes — the Contract's own Implementation Order table contains exactly five phases,
0–4, and nothing past this point shares this same-numbered correspondence with it.

| Phase | Goal | Deliverables | Required verification | Rollback strategy | Est. effort | Expected reuse | Stop conditions |
|---|---|---|---|---|---|---|---|
| **0 — Platform Scaffold** | Stand up the empty L1–L2 skeleton + the Rule Definition Format + Command contract as pure documentation/schema, zero code. | Folder skeleton (Product Spec §29), Rule Definition Format (§6), Command contract (§7), one root instructions file, a Knowledge System scaffold script producing the L2 folder tree + ownership map (absorbed from the former Phase 7 — same character as the rest of this phase: pure scaffolding, zero code, no dependency on rule or command count existing first). | YAML-block validity check only; no `tsc`/test run needed since zero executable code exists. | Trivial — delete the unused skeleton. | Very low (1 commit, documentation only) | 100% — this is the exact shape that already shipped once as this repository's own Runtime Phase 0. | Any temptation to pre-populate L9–L14 content before real work demands it. |
| **1 — Reusable Runtime Port** | Generalize the proven Reusable Runtime (this repository's `governanceRuntime.ts`) into a standalone, repository-agnostic package. | `sh()`, `repoRoot()`/`currentBranch()`/`ownerRepoFromRemote()`, `CheckResult`, `printCheckResult()`, `findMaskedStepNames()` (generalized to a provider-agnostic contract, §26), `pollUntil()`. | Byte-for-byte behavioral parity check against the source implementation's own before/after diff method; zero new dependency. | `git revert` — this is a pure extraction, no consumer depends on it yet. | Low (this exact work already shipped once; porting is mechanical) | Very high — this is literally the same code, generalized. | Any signature change during the port — a signature change is a rewrite, not a port, and is out of scope for this phase. |
| **2 — RuleExecution Formalization** | Each run constructs an explicit, in-memory `RuleExecution`-shaped record instead of treating "the script ran" as an implicit, untracked event. | The `RuleExecution` shape added to the Runtime package; the reference rule's script populates it. | Field-by-field check against the Object Model's required fields (`repo_root`, `branch`, `owner`, `repo`, `head_sha`, `rule_id`, `version`, `triggered_by`, `timestamp`). | `git revert`, single commit. | Low | High — the shape is fully generic; only the reference rule's wiring is instance-specific. | Same as this repository's own Runtime Contract Phase 2 scope. |
| **3 — Durable Report** | Each `RuleExecution`'s result is appended to a durable, queryable log — not only printed to console. | A `writeReport()` function; one new append-only log file convention. | Concrete append-only check: run twice, confirm the log gains a second, distinct entry rather than overwriting the first. | `git revert`. | Low–Medium | High — the log format and append discipline are fully generic. | The log must start empty for a new installation — no historical data is ever fabricated to pre-populate it. |
| **4 — Validator** | An on-demand check that a `RuleDefinition` file is well-formed (declared script exists and runs standalone; command adapter contains no logic beyond invoke-and-relay). | One new script implementing the Validator contract (Product Spec §4, §12). | Run against the reference rule's own definition (confirms well-formed); construct one deliberately-malformed definition locally, never committed, confirm it's correctly flagged. | `git revert`. | Low | High — the well-formedness checks are generic; only the heuristic thresholds need per-language tuning. | Do not wire the Validator into automatic per-execution flow — Revision 1's scope boundary (Product Spec §4) is binding: on-demand only, never per-execution. |

**The Contract-backed sequence ends here.** `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`'s own
Implementation Order table contains exactly five phases, 0–4 — confirmed by direct inspection
(`CONTRACT_PLAYBOOK_ALIGNMENT_REVIEW.md`), not assumed. Candidate future work beyond this point —
additional governance rules, a command pack, a plugin system — is Product-Spec-recommended but
**not Contract-authorized**, and is tracked separately in `ENGINEERING_PLATFORM_FUTURE_BACKLOG.md`,
never as a continuation of this numbered sequence. The former Phase 9 (First Real Pilot) is not
relocated there — it had no discrete deliverable of its own, and is instead restated as a standing
validation criterion in Part 4, below.

---

# Part 4 — Vertical Slice Strategy

**Every feature, at any layer, is built through this exact template — no exceptions, and no
separate process for "big" vs. "small" changes.** This operationalizes
`GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` as a fill-in-the-blanks contract every slice must satisfy
before it may be presented as complete.

| Field | Requirement |
|---|---|
| **Inputs** | The specific frozen document(s) or prior slice's output this slice implements against — never invented in the abstract. State the exact section/table row being implemented. |
| **Outputs** | The exact artifact(s) produced — a script, a command adapter, a schema addition. State the count before writing any file; a later change to that count must be disclosed, not silent. |
| **Files allowed to change** | An explicit, enumerated list — never a directory, never "and related files." New files only unless the slice's own stated purpose is to extend an existing one. |
| **Tests** | At minimum: does the artifact run standalone with zero AI-agent/command-dispatch dependency; does a non-vacuous case exist (a real problem the check actually catches, deliberately constructed if not naturally present — never skipped because nothing happened to fail). |
| **Verification** | Run at least twice against real state; the whole-project verification triad (compile/type-check + architecture guard + full suite) confirmed unaffected or explicitly, narrowly extended. |
| **Commit boundary** | One commit per slice, never per file and never bundling two slices — matches Product Spec §37 exactly. |
| **Rollback** | Stated explicitly, not assumed: `git revert` for anything read-only or purely additive (the default); for anything that blocks, a stated override path that doesn't remove the check for everyone; for anything that mutates state, a stated separate undo for the mutation itself. |
| **Definition of Done** | All of: (1) only the declared files changed, verified via `git status`, not assumed; (2) verification passed, including the slice's own specific checks; (3) run ≥2× against real state with ≥1 non-vacuous result; (4) exactly one commit exists, pushed, CI polled to genuine completion; (5) a short report states summary/files/verification/commit hash/CI result/what's reusable; (6) explicit human approval given before the next slice's first file is touched. |

**Selection criteria for which slice to build next, at any point in Part 3's phases** (carried
forward unmodified, since no evidence anywhere in this research contradicted it): lowest
implementation complexity relative to its category, highest realized/expected frequency,
self-contained (no dependency on a not-yet-built prerequisite), non-mutating preferred over
mutating for any first instance of a new mechanism.

**The one addition every slice must accommodate, discovered mid-sequence in the original case
study and now permanent:** if implementation reveals a gap the Inputs/Outputs disclosure didn't
anticipate, the slice does not restart — the gap is fixed within the same slice, disclosed
transparently (the Outputs count revised and explained), and folded into the remaining fields
rather than treated as a second slice.

**Standing criterion — Application Stack Validation** (absorbed from the former Phase 9 —
"First Real Pilot" — designation; restated here as a permanent rule rather than a numbered phase
because it has no discrete deliverable of its own, unlike Phases 0–4): whenever any real
Application Stack (L9–L14) work is attempted, at any point, in any order — not gated on any
specific Core Platform phase completing first — it must prove the whole Core Platform (L1–L8)
against that real build with zero Core Platform file modified in the process. The full
verification triad (Product Spec §8) must stay green throughout; an architecture guard must
confirm zero L1–L8 file was touched by L9+ work. Any point where L9+ work would require modifying
an L1–L8 file is a platform design defect, not an Application Stack problem — it stops that work
and reopens Product Spec §3 for review, not a silent workaround.

---

# Part 5 — Engineering Rules

**Only rules with evidence they should persist indefinitely — nothing situational, nothing tied
to a single repository's own tuned numbers.**

### Governance
- No phase or slice begins without its dependency having reached its own Definition of Done first.
- A frozen document is superseded by a new version, never silently edited in place.
- Every rollback is `git revert` (or the host VCS's direct equivalent) — never automatic, never
  self-healing.
- A rule's `failure_behavior` and `rollback_behavior` are fixed at authoring time; neither varies
  per-execution.

### Reviews
- Pre-implementation (Architect) and post-implementation (Reviewer) checkpoints are procedurally
  distinct and neither may substitute for the other.
- A review verdict is always appended to a durable, queryable log — never left only in a
  conversation transcript.
- A domain-specific review checkpoint is new content plugged into the existing two-checkpoint
  discipline — never a redesign of the discipline itself.

### CI
- A new CI step defaults to non-blocking whenever pre-existing, unrelated debt would otherwise
  immediately redden the pipeline; it is flipped to blocking only once a confirmed,
  mechanically-verified zero-error baseline exists — never an assumed one.
- Any fix to a previously-broken tool invocation ships with a regression-guard preventing silent
  reversion to the broken form.
- A CI provider's reported "success" is never taken at face value where `continue-on-error`
  (or an equivalent masking mechanism) is in play — the masking is always explicitly surfaced.

### Documentation
- A document exists only if it answers something git history, CI logs, or source code cannot
  already answer.
- One owning file per fact, enforced by an explicit ownership map, not by memory.
- A "current state" file is archived-before-overwrite into a history file — never silently
  allowed to become the historical log itself.
- Every planning/design document states its own status (`PLANNING ONLY`, `FROZEN`, `IMPLEMENTED`)
  at the top, always.

### Contracts
- The exit-code contract (`0` iff every check passed) is never broken by any rule at any version.
- A required field on any stable schema never disappears within a major version; only optional
  fields may be added.
- The Layer 1–8 / Layer 9+ non-dependency boundary is never crossed by any Core Platform file, in
  either direction.

### Runtime
- Rule-specific check logic is never extracted into shared infrastructure — this is each rule's
  real, irreducible content, by permanent design, not an oversight to fix later.
- A generic runtime utility is only extracted once genuine, present duplication exists — never
  spec'd ahead of a second real consumer.
- An event system, a plugin loader, or any other decoupling mechanism is built only once a second
  real, independent consumer exists to justify it.

### Knowledge
- Engineering knowledge (debt/risk/decisions/lessons) and domain/business knowledge are never
  the same folder, the same file, or the same ownership map — conflating them breaks portability
  permanently.
- Every completed unit of work asks, before being declared complete, whether it produced a debt
  item, a risk, a lesson, a decision, or a rejected alternative not already captured anywhere —
  and if so, writes it down, even if only one line.

### Versioning
- A change to any stable contract, any closed enum, or the layer boundary itself is a major
  version change, requiring its own explicit review — never shipped as a minor or patch.
- An adopting repository is never silently auto-upgraded; a version bump is always an explicit,
  reviewed, disclosed action.
- A platform version pins to the Core Platform (L1–L8) only — Application Stack (L9–L14) content
  is never versioned by the platform itself.

---

# Part 6 — Anti-patterns

Every engineering mistake this research directly evidenced — not hypothetical risks, real ones,
each with its own concrete incident behind it.

### 1. Silent-no-op verification
**Why it happens:** a tool's invocation surface *looks* correct (a familiar flag, a plausible
command) while its actual behavior silently diverges — e.g. a non-`--build` type-check invocation
against a solution-style config compiling zero files while still exiting `0`.
**How to detect it:** any verification step whose "it passed" claim isn't cross-checked against
an independent signal (a file count, an error count from a from-scratch run) is suspect by
default.
**How to prevent it:** every verification command's *positive* result must be provable
non-vacuous at least once, deliberately — run it against a known-bad case and confirm it actually
fails, not just that it can pass.

### 2. Duplicate trackers
**Why it happens:** a second "current status" file gets created for local convenience, and only
one of the two is ever kept current going forward — usually the newer one, silently orphaning the
older.
**How to detect it:** any two files independently claiming to state "what's current" for the same
fact is the signature, regardless of how differently they're named.
**How to prevent it:** one owning file per fact, declared in a real, checked ownership map — not
a rule anyone has to remember, a structural fact a duplicate-claim check can flag mechanically.

### 3. Exact-shape architecture guards
**Why it happens:** the easiest guard to write against a set of items is "assert the exact count"
or "assert the exact literal list" — and it works fine until the protected set legitimately grows.
**How to detect it:** any guard using an exact-count or exact-literal assertion against something
documented as additively extensible.
**How to prevent it:** guards assert **presence**, never exact shape, wherever the protected set
is expected to grow — stated as a standing default every future guard-writer sees, not buried in
one exception's fine print.

### 4. Blanket-ignoring a directory that holds mixed content
**Why it happens:** a directory is ignored wholesale because *some* of its contents are genuinely
local/machine-specific — the reasoning silently sweeps up shared content that happens to live in
the same directory.
**How to detect it:** any `.gitignore`-equivalent entry that ignores a directory rather than the
specific files that are actually local.
**How to prevent it:** always ignore the specific files that are local, never a directory as a
proxy for them — verified by checking `git status`/an equivalent immediately after creating any
file outside an already-familiar tracked tree.

### 5. Trusting a fast-path tool as equivalent to the real check
**Why it happens:** a lightweight runner (a transpiler, a quick syntax check) "succeeding" during
manual testing feels like evidence the real, stricter tool would also succeed — it isn't; the two
can diverge silently.
**How to detect it:** any claim of "verified" that names only the fast-path tool, never the
authoritative one.
**How to prevent it:** both must be run and both must be named in any verification claim — a
script "running successfully" is never treated as equivalent to it passing a real, strict check.

### 6. Silent scope drift (in either direction)
**Why it happens:** implementation reveals more (or less) work than the original disclosure
estimated, and it's simpler in the moment to just do the extra work, or quietly skip the
now-unnecessary work, without updating the record.
**How to detect it:** a slice's final file list doesn't match its own pre-implementation
disclosure, with no note explaining the difference.
**How to prevent it:** any deviation is disclosed at the moment it's discovered, re-checked
against budget, and explained — never silently absorbed into "what actually shipped."

### 7. Logic embedded in a thin adapter
**Why it happens:** it's often faster to add "just one more check" directly into a command/prompt
file than to modify the underlying script it wraps.
**How to detect it:** any conditional or comparison inside a command adapter that isn't simply
"invoke the script and relay its output."
**How to prevent it:** the script/adapter split is structural, not a convention — an adapter with
any real logic in it is treated as a defect at review time, not a style nitpick.

### 8. Automating a judgment call
**Why it happens:** a repeated manual decision (is this failure a known flake, does this change
need an ADR) feels tedious enough that it's tempting to have the automation just *decide*, rather
than gather evidence and present it for a decision.
**How to detect it:** any mechanism whose output is a final verdict on something a human would
reasonably want to weigh in on, rather than evidence plus a recommendation.
**How to prevent it:** every rule states its `failure_behavior` explicitly (`block`/`warn`/`flag`)
and every judgment-heavy check defaults to `flag`, never `block`, until its false-positive rate
is well understood — this is the platform's single highest-standing risk theme, guarded against
by design in every mechanism, not by exception.

### 9. Premature generalization
**Why it happens:** designing a shared framework feels more "complete" than shipping one concrete
instance, especially when the abstraction is genuinely visible in the design.
**How to detect it:** any shared mechanism (an event bus, a plugin loader, a generic scheduler)
being built with zero, or exactly one, real consumer.
**How to prevent it:** resist extracting or generalizing anything until at least 2–3 real
instances exist to generalize *from* — stated as a standing default, not a case-by-case
judgment call each time the temptation arises.

### 10. Conflating engineering knowledge with domain knowledge
**Why it happens:** both are colloquially "knowledge," and a single combined folder feels simpler
than maintaining the distinction.
**How to detect it:** a "knowledge base" directory containing both debt/risk/decision records
*and* end-user-facing domain content.
**How to prevent it:** treat the boundary as structural from day one of any new installation — L2
(engineering memory) and L9–L14's Knowledge Layer (domain content) are never the same directory,
regardless of how small the project currently is.

---

# Part 7 — Migration Guide

**How to start a brand-new repository using this Engineering Platform**, in the exact order a
new session should follow. Every step below assumes the frozen `ENGINEERING_PLATFORM_PRODUCT_
SPEC.md` as its source of truth — nothing here re-derives a decision that document already made.

### Step 1 — Repository initialization
Create the repository. Add a root instructions file (this platform's `CLAUDE.md`-equivalent)
stating, at minimum: the layer boundary rule (Product Spec §3), the ten Platform Principles
(§2), and a pointer to wherever this playbook's own copy lives in the new repository. Do not
write any domain content into it yet — an empty product identity is a valid, honest starting
state.

### Step 2 — Knowledge initialization
Scaffold the three-tier L2 structure (Product Spec §5, §29) — curated summary, narrative,
detailed register — plus one Ownership Map file, empty except for its own header explaining the
convention. Do not backfill any content; a new repository has no history yet to record.

### Step 3 — Governance initialization
Create the governance-rules directory (Product Spec §6) with the Rule Definition Format
documented but zero rules populated. Write the Decision Budget threshold and the ADR-trigger
checklist into their owning L1 files — tuned for this specific new repository's own risk profile,
never copied numerically from a different installation without re-deriving whether the same
threshold actually fits.

### Step 4 — Runtime initialization
Port the Reusable Runtime package (Part 3, Phase 1) — this is the one step in this entire guide
with a proven, working reference implementation to port from rather than design fresh. Confirm it
runs standalone with zero rule wired into it yet.

### Step 5 — Verification initialization
Stand up the whole-project verification triad appropriate to this new repository's own stack
(compiler/type-check + an architecture-guard test suite, even if it starts with only one trivial
guard + the real test runner). Confirm all three run and report correctly against a genuinely
empty or trivial codebase before any real feature work begins — this is the non-vacuous check
this entire guide's own Part 6 (#1) insists on, applied to the guide's own first real step.

### Step 6 — First Vertical Slice
Choose the first governance rule by the Part 4 selection criteria (lowest complexity, highest
expected frequency, self-contained, non-mutating) — a post-push verification rule
(`REVIEW-3`-shaped) is the proven, lowest-risk choice, since it has direct precedent. Follow the
full Vertical Slice template (Part 4) exactly, including its Definition of Done, before declaring
it complete.

### Step 7 — First release
Freeze this initial slice (Product Spec §10): run `/verify`-equivalent, confirm git-state sync
and a genuinely clean working tree, poll CI to real completion, write the freeze report (evidence
+ human narrative, never restated tool output), and perform the after-freeze Knowledge Update
step (Product Spec §35) even though there is, at this point, exactly one lesson to record: that
the platform's own bootstrap worked. Tag the release. This is the point at which the new
repository has a real, working, minimal instance of Layers 1–4 — everything past this is either
more Core Platform depth (Part 3's later phases) or the start of real Layer 9+ product work.

---

# Part 8 — My AI Platform

**Platform infrastructure only — no business logic, no domain rules, no procurement/legal/asset/
education content of any kind.** Each product below is described strictly in terms of which
Application Stack layers (L9–L14, Product Spec §14–19) it leans on most heavily and what it
supplies to the shared Core Platform (L1–L8) unmodified — never in terms of what the product
actually decides or recommends.

| Product | Layers it stresses most | What the Core Platform (L1–L8) provides it, unmodified |
|---|---|---|
| **Vietnam Public Procurement AI** | L9 (Business Modules) + L11 (Document Generation, for dossier output) | Verification, governance rules, review discipline, and freeze mechanism identical to every other product below — none of it aware this product is about procurement. |
| **Legal AI** | L9 + L10 (Knowledge Layer, for statute/case retrieval) | Same Core Platform, unmodified — a `/verify` or `/architecture-review` run against this product looks byte-identical to one run against Procurement AI. |
| **Asset Management AI** | L9 + L10 | Same. |
| **Education AI** | L9 + L11 + L12 (Workflow Layer, for course-completion sequencing) | Same. |
| **Knowledge Base AI** | L10 almost exclusively — this product effectively *is* a Knowledge Layer instance operating at scale | Same Core Platform; the Knowledge System (L2) that tracks this product's own engineering debt/decisions stays entirely separate from the domain content the product itself serves (Part 6, #10 — never conflate the two). |
| **Document Generation AI** | L11 almost exclusively | Same. |
| **Workflow AI** | L12 almost exclusively | Same Core Platform; L12 explicitly reuses L5's composition primitives rather than inventing a second orchestration mechanism (Product Spec §17). |
| **Multi-Agent AI** | L13 + (conditionally) L14 | Same Core Platform; L14 remains gated on the same evidenced-need trigger as every other product — "this product is called Multi-Agent AI" is not, by itself, sufficient evidence to build L14 (Product Spec §19). |

**The one claim this section makes, and the only one it needs to make:** every product above can
run `/verify`, be governed by the same 8 governance-rule categories, pass through the same
Architect/Reviewer checkpoints, and freeze through the same mechanism — with **zero** Core
Platform file aware of which product it's currently protecting. Proving that in practice is
exactly what Part 4's standing Application Stack Validation criterion exists to do.

---

# Part 9 — Next Session Bootstrap

The following prompt is ready to paste into a brand-new Claude session. It assumes this playbook
and the frozen Product Spec are already committed and readable; it does not re-derive anything
this research already settled.

```
You are starting implementation work on the Engineering Platform, following an already-completed
and frozen design. Do not re-analyze, re-audit, or re-derive the platform's architecture — that
work is finished and lives in two canonical documents:

  PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_PRODUCT_SPEC.md   (frozen design)
  PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md
    (this execution plan — Part 2 lists every other document's status; treat all of them,
    including the Governance Engine Design/Runtime/Object Model/Lifecycle/Vertical Slice
    Template/Architecture Freeze/Implementation Contract documents, as canonical and binding,
    not as drafts to reconsider)

Read both in full before touching anything. Do not open, re-summarize, or re-evaluate any other
prior research document unless this playbook's Part 2 tells you to consult it for a specific,
named reason.

Part 3's phase table contains exactly five Contract-backed phases (0–4). Nothing past Phase 4
carries Contract authority — candidate future work is tracked separately in
`ENGINEERING_PLATFORM_FUTURE_BACKLOG.md`, never as a continuation of this table. Do not attempt a
"Phase 5" or higher against this Playbook under the assumption that the same numbering continuity
observed for Phases 0–4 extends further; it does not.

Your task: begin Part 3, Phase 0 (Platform Scaffold) of the Implementation Playbook — the
lowest-risk, zero-code, documentation-only first phase. Follow its Goal/Deliverables/Required
verification/Rollback/Stop-conditions exactly as specified. Follow the Vertical Slice Strategy
(Playbook Part 4) as the mandatory process for this and every phase after it — including its
pre-implementation disclosure step, which you must present and have explicitly approved before
creating any file.

Do not skip ahead to Phase 1 or later. Do not add any capability not named in Phase 0's own
scope. Do not begin any Application Stack (L9–L14) work. If you discover a gap Phase 0's own
disclosure didn't anticipate, disclose it, fold it into the same phase per Part 4's stated
exception, and continue — do not restart or expand scope silently.

Stop after Phase 0 is complete and its Definition of Done (Playbook Part 4) is fully satisfied.
Report per Part 4's Definition of Done fields and wait for explicit approval before Phase 1
begins.
```

---

*End of playbook. Per instruction: planning only, no code, no TypeScript, no runtime, no commit,
no CI, no repository modification beyond this one document. Exactly one markdown file was
written.*
