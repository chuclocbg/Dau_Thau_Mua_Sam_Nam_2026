# Engineering Platform Blueprint — A Reusable, Repository-Independent Layered Architecture

**Status:** PLANNING ONLY. No source, test, CI, workflow, or governance file was created or
modified. This document generalizes the approved `ENGINEERING_EVOLUTION_ROADMAP.md` (built for
this one repository) into a portable blueprint — every layer below is described abstractly
first, with this repository's concrete instance given only as evidence that the abstraction is
real and grounded, not invented.

## The one architectural principle that makes this portable

**Layers 1–8 must never depend upward on Layer 9.** A generic verification command, a generic
review checkpoint, a generic hook — none of them may contain procurement-specific,
legal-specific, or education-specific logic. Layer 9 (Business Modules) depends on everything
below it; nothing below it may depend on Layer 9. This single rule is what lets the same eight
layers underlie Procurement AI, Legal AI, Education AI, Asset Management AI, HR AI, and any
future repository — each supplies its own Layer 9, none of them touch Layers 1–8's own content.

---

## Layer 1 — Repository Foundation

**Purpose:** the baseline conventions every other layer assumes — what makes a repository
*governable* at all, before any tooling is built on top of it.

**Responsibilities:** frozen-zone rules, commit/freeze discipline, the ADR-trigger checklist,
Decision Budget thresholds, CI/migration/documentation policy, dependency/coding/DDD rules.

**Owned files (pattern):** a governance-rules directory (`ARCHITECTURE_CONSTRAINTS`,
`REPOSITORY_RULES`, `CODING_RULES`, `DDD_RULES`, `DEPENDENCY_RULES`, `KNOWN_RISKS`, a CI-policy
file, a structured frozen-path list). **This repository's instance:**
`PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/*`.

**Inputs:** explicit human governance decisions — freeze reports, ADRs, directly-stated rules.

**Outputs:** a checkable rule set every other layer consumes (the frozen-path list, the budget
thresholds, the ADR checklist).

**Dependencies:** none — this is the base layer.

**Extension points:** new rule domains added additively (a new policy file) without touching
existing ones.

**Never belongs here:** business logic, application code, anything specific to what the
repository's product *does* (Layer 9). Transient/session-specific state (belongs to Layer 2, or
nowhere durable at all).

---

## Layer 2 — Knowledge System

**Purpose:** durable, queryable memory of what happened and why — distinct from what the rules
*are* (Layer 1). The record of debt, risk, decisions, and lessons.

**Responsibilities:** technical-debt tracking, risk register, decision history, rejected
designs, lessons learned; enforcing "one owning file per fact" (no duplicate trackers).

**Owned files (pattern):** a narrative/history directory plus an optional deeper "full
register" tier, tied together by an explicit ownership map (curated-summary ↔ narrative ↔
detailed-register). **This repository's instance:** `04_PROJECT_MEMORY/*` (narrative) +
`app/.memory/*` (detailed register) + `SCHEMA.md`'s Ownership map (the tying mechanism).

**Inputs:** milestone freezes (the Knowledge Update step), incidental discoveries during any
layer's work.

**Outputs:** a debt/risk/decision index other layers query instead of re-deriving from scratch
(e.g. a flake-triage command reading the risk register rather than re-diagnosing from memory).

**Dependencies:** Layer 1 (needs governance rules to know what counts as debt, what "frozen"
means).

**Extension points:** new registers (e.g. a Vendor Risk Register for an Asset Management
variant) added without touching existing ones, provided the ownership-map discipline holds.

**Never belongs here:** the rules themselves (Layer 1). **Critically: end-user-facing domain
knowledge** — this repository's own `03_KNOWLEDGE_BASE/` (legal/procurement content, glossary,
FAQ) is a **Business Module (Layer 9) concern**, not an Engineering Platform one, even though
both are called "knowledge." Conflating the two would break the portability principle — a Legal
AI's engineering Knowledge System should look identical to Procurement AI's; its business
knowledge base will look nothing alike.

---

## Layer 3 — Prompt Platform

**Purpose:** reusable framings of recurring engineering questions, executed by Layer 4's
commands.

**Responsibilities:** prompt categories, per-prompt metadata schema (purpose / required inputs
/ expected output shape / dependencies / blocked-by / last-validated), storage convention.

**Owned files (pattern):** a `prompts/` directory with one subdirectory per category, mapped to
either Platform-Architecture layers or Command Library categories.

**Inputs:** an identified recurring question (sourced from Layer 1's rules or Layer 2's
knowledge — e.g. "is this the known flake" only becomes a prompt once Layer 2 has the flake's
signature recorded).

**Outputs:** prompt files Layer 4 commands consume.

**Dependencies:** Layer 1 (rules inform content), Layer 2 (knowledge feeds content).

**Extension points:** new categories for new domains (e.g. `clinical-review/` for a Health AI
variant) added without touching existing categories.

**Never belongs here:** executable logic (Layer 4) — a prompt is a contract, not code.
Hardcoded domain business rules — a prompt should *reference* Layer 9's rule files, never
duplicate their content inline.

---

## Layer 4 — Command Platform

**Purpose:** the executable form of prompts — real tool calls (grep/compiler/git/CI-API)
wrapped as reusable, named, single-purpose operations.

**Responsibilities:** the command-dispatch mechanism itself, and the individual commands
(verify, audit, architecture-review, review, test-review, ci-review).

**Owned files (pattern):** a commands directory, wherever the host tooling discovers reusable
commands. **This repository's instance (planned, not yet built):** `.claude/commands/`.

**Inputs:** Prompt Library entries (Layer 3), Knowledge System data (Layer 2), Foundation rules
(Layer 1).

**Outputs:** pass/fail verdicts, evidence reports, diffs — consumed either directly by a human
or chained by Layer 5.

**Dependencies:** Layers 1–3.

**Extension points:** new commands added one at a time, each independently useful without the
others existing.

**Never belongs here:** multi-step orchestration (Layer 5) — a command does exactly one thing.
Business-domain-specific logic (Layer 9) — a generic `/verify` must never contain
procurement-specific validation.

---

## Layer 5 — Workflow Platform

**Purpose:** orchestration — chaining Layer 4 commands into the named, multi-step sequences
that form an actual engineering process (Planning → Architecture Review → Implementation →
Verification → CI → Freeze → Knowledge Update).

**Responsibilities:** the Platform Architecture's 9-layer sequence as a trackable pipeline;
milestone-state tracking; command chaining.

**Owned files (pattern):** a workflow-state convention (a field on each in-progress plan, or a
small per-milestone state file) plus a pipeline-definition reference.

**Inputs:** Layer 4 commands as building blocks.

**Outputs:** a trackable "where is this milestone in its lifecycle" status; chained
multi-command results.

**Dependencies:** Layer 4.

**Extension points:** new named workflows (a "release" workflow, a "hotfix" workflow) composed
entirely from existing Layer 4 commands, no new command logic required.

**Never belongs here:** new verification/review logic (Layer 4 or 6's job) — Workflow only
sequences already-defined steps, it never computes a new verdict itself.

---

## Layer 6 — Review Platform

**Purpose:** the specific discipline of independent, two-checkpoint review (a pre-implementation
Architect checkpoint and a post-implementation Reviewer checkpoint) — a specialized workflow
(built on Layer 5) enforcing this whole platform's central risk-mitigation theme: no judgment
call may be made silently.

**Responsibilities:** formalizing the Architect/Reviewer separation, review-history logging,
review-iteration metrics.

**Owned files (pattern):** a review-log file; the procedural rule itself actually lives in
Layer 1's governance files and is cross-referenced here, not duplicated.

**Inputs:** Layer 5's chaining primitives, Layer 4's architecture-review/review commands.

**Outputs:** review verdicts, a queryable review-history log, review-iteration counts (feeding
Layer 7's automation and any metrics consumer).

**Dependencies:** Layer 5, architecturally — though in practice, lightweight review discipline
can and should bootstrap directly on Layer 4 before Layer 5 fully exists (see the Roadmap
Mapping section: this repository's own Phase F did exactly that).

**Extension points:** domain-specific review checkpoints (a Legal Reviewer, a Clinical
Reviewer) plug in as new prompt+command pairs, without changing the two-checkpoint discipline
itself.

**Never belongs here:** the underlying verification logic (Layer 4) — Review Platform enforces
*when* and *by whom* a check runs, never *what* the check computes.

---

## Layer 7 — Automation Platform

**Purpose:** triggers — deciding *when* a Layer 4 command (or Layer 5/6 workflow) runs
automatically, at defined lifecycle points, without a human explicitly invoking it.

**Responsibilities:** the hook-runner mechanism; each hook's trigger condition and the
command/workflow it invokes.

**Owned files (pattern):** a hook-runner script plus per-hook trigger definitions.

**Inputs:** a lifecycle event (a commit being staged, a push happening, a freeze commit
landing).

**Outputs:** a block/warn/pass decision, or a triggered downstream command/workflow.

**Dependencies:** minimally Layer 4 only (a hook just needs *some* command to invoke) — **this
is a deliberate adjustment from the suggested ordering**: Automation's *minimum* dependency is
Layer 4, not Layers 5/6, and this repository's own roadmap built a minimal Automation Platform
early on exactly that minimum. It is placed at Layer 7 here because a *mature* Automation
Platform increasingly triggers richer, multi-step Workflow/Review sequences as those come
online, not because it structurally requires them from day one.

**Extension points:** new hook points (before-deploy, before-release) added independently of
existing ones.

**Never belongs here — the one hard anti-pattern to name explicitly:** new verification logic
written directly into a hook script instead of calling an existing Layer 4 command. A hook must
always be a thin trigger; a hook that reimplements a check in parallel to an existing command is
exactly the kind of duplicate-tracking drift this whole platform exists to prevent (the same
failure mode that produced the confirmed `app/.memory/project-status.md` duplication).

---

## Layer 8 — AI Runtime

**Purpose:** (only if and when warranted) genuine multi-agent parallel execution — distinct
agents (Planner, Explorer, Architect, Implementer, Reviewer, Test Reviewer, CI Reviewer,
domain-specific reviewers) running as separate, coordinated processes instead of one sequential
session performing every role.

**Responsibilities:** role definitions (valuable as documentation even without runtime
separation); agent coordination/handoff protocol (only once actually warranted).

**Owned files (pattern):** role-definition documents; a future, conditional agent-orchestration
config.

**Inputs:** Layers 1–7 in full — an agent is a "who" wrapper around already-defined commands,
workflows, and review checkpoints; it adds concurrency and independence, never new capability.

**Outputs:** parallel, cross-checked work product.

**Dependencies:** all lower layers — deliberately the most optional, topmost layer.

**Extension points:** new agent roles (a Clinical Reviewer for Health AI, an HR Compliance
Reviewer for HR AI) — but strictly as thin wrappers selecting which existing Layer 3/4/6
prompts/commands/checkpoints that role invokes, never new logic of its own.

**Never belongs here:** any logic not already expressible as a Layer 4 command or Layer 6
review checkpoint. This layer must never be built merely for architectural completeness — only
when a genuine parallelization need actually exists (this repository's own explicit gate for
this decision).

---

## Layer 9 — Business Modules

**Purpose:** what the repository is actually *for* — the domain application that Layers 1–8
exist to make faster and safer to build, but never define themselves.

**Responsibilities:** domain data models, domain business logic, domain-specific knowledge
bases, domain-specific review-checkpoint *content* (the actual rules a Legal Reviewer would
check against).

**Owned files (pattern):** the application source tree, the domain knowledge-base directory,
domain-specific skill/rule files. **This repository's instance:** `app/src/`,
`PROJECT_KNOWLEDGE_SYSTEM/03_KNOWLEDGE_BASE/`, and `skills/dau-thau-mua-sam.md` (referenced by
CLAUDE.md, still missing — a Layer 9 gap, not an Engineering Platform gap).

**Inputs:** everything Layers 1–8 provide as infrastructure.

**Outputs:** the actual product — procurement dossiers, legal risk assessments, education
records, asset registers, HR workflows, depending on which vertical this layer implements.

**Dependencies:** all 8 layers below it.

**Extension points:** this layer *is* the extension point — a new repository built from this
blueprint extends the platform by writing its own Layer 9 and reusing Layers 1–8 unmodified.

**Never belongs here:** anything Layers 1–8 already provide generically — a domain-specific
reimplementation of "does my code compile" instead of reusing `/verify`.

---

## Roadmap-to-Layer Mapping

Every milestone from `ENGINEERING_EVOLUTION_ROADMAP.md`, mapped to exactly one layer. Where the
roadmap's own phase letter already names the same concept as its target layer, the mapping is
direct; three deliberate exceptions are called out explicitly.

| Roadmap milestone(s) | Layer | Why |
|---|---|---|
| A1–A7 | **Layer 1 — Repository Foundation** | Direct mapping: ADR policy, commit/freeze discipline, CI policy, flake protocol, guard-writing standard, duplicate-tracker retirement, and the frozen-path list are exactly Layer 1's owned content. |
| B1–B5 | **Layer 2 — Knowledge System** | Direct mapping: reconciling and backfilling the debt/risk/decision/rejected-design/lessons registers is exactly Layer 2's job. |
| C1–C3 | **Layer 3 — Prompt Platform** | Direct mapping: scaffolding + authoring the prompt contracts Layer 4's commands consume. |
| D1–D6, and `/ci-review` half of D7 | **Layer 4 — Command Platform** | Direct mapping for single-purpose commands. |
| **`/freeze` half of D7** | **Layer 4 (built), architecturally Layer 5** | `/freeze` composes multiple commands (`/verify` + `/ci-review` + git checks) — that composition is Workflow-shaped behavior, built ahead of Layer 5 formally existing because the value was needed immediately. Flagged here as a candidate for later refactoring into a proper Layer 5 chained workflow via G3, which explicitly names `/freeze` as the pattern it generalizes. |
| G1–G4 | **Layer 5 — Workflow Platform** | Direct mapping: milestone-state tracking, status reporting, generalized chaining, and documenting the full pipeline. |
| F1–F3 | **Layer 6 — Review Platform** | Direct mapping: the Architect/Reviewer split, the review-history log, and review-iteration metrics. Built in the roadmap *before* Phase G, demonstrating Layer 6's own stated point: lightweight review discipline can bootstrap on Layer 4 alone before Layer 5 fully exists. |
| E1–E7 | **Layer 7 — Automation Platform** | Direct mapping: the hook-runner mechanism and all seven hook points. Built early in the roadmap (right after Phase D) using only Layer 4 primitives — the minimal-dependency form Layer 7's own description above discusses. |
| H1–H3 | **Layer 8 — AI Runtime** | Direct mapping: role definitions (H1, buildable now), the parallelization decision gate (H2, a decision not an implementation), and the blocked domain-reviewer agents (H3). |
| I1–I2 | **Layer 9 — Business Modules** | Direct mapping: the roadmap's own explicit acknowledgment that Layer 9 (the business/domain track) is separately governed and not scoped by this platform work. |

---

## Reusable vs. Repository-Specific Components

**Reusable (portable to Legal AI / Education AI / Asset Management AI / HR AI / any future repo
without modification to the pattern):**
- Layer 1's file-structure pattern, the ADR-checklist *mechanism*, and the Decision-Budget
  *concept* (exact numeric thresholds are tunable per repository, the mechanism isn't).
- Layer 2's three-tier knowledge structure (curated summary / narrative / detailed register)
  and its ownership-map discipline.
- Layer 3's prompt metadata schema and category taxonomy shape.
- Layer 4's generic commands as a *class*: `/verify`, `/audit`, `/architecture-review`,
  `/review`, `/ci-review` contain zero procurement-specific content and would work, unmodified
  in shape, against any codebase with a compiler, a test suite, and a CI pipeline.
- Layer 5's chaining mechanism and milestone-state convention.
- Layer 6's two-checkpoint Architect/Reviewer discipline and review-log format.
- Layer 7's hook-runner mechanism and the *generic* hook points (before-commit, before-schema-
  change, before-release, after-freeze).
- Layer 8's role taxonomy and — especially — its governing decision framework ("do not build
  until genuinely warranted").

**Repository-specific (this repository's own instance only, not portable as-is):**
- The actual frozen-path list content (A7) — this repository's own Phase X history.
- The Prisma-validate flake's exact signature (A4) — this repository's specific test
  infrastructure (`execSync` + Prisma + Vitest's 5000ms default). A different stack's variant of
  Layer 1's flake-handling protocol would record a *different* flake, using the same pattern.
- `tsc -b --listFilesOnly` as the specific before-commit sanity check (E2) — TypeScript-specific.
  The *hook point* is reusable; a Python repository's equivalent would check something else
  entirely (e.g. `mypy` actually running against real files).
- All of Layer 9, by definition: `app/src/`, `PROJECT_KNOWLEDGE_SYSTEM/03_KNOWLEDGE_BASE/`,
  `skills/dau-thau-mua-sam.md`, and CLAUDE.md's own domain rules (Legal Priority ordering, Demo
  Data Principles) — a Legal AI variant would have entirely different Layer 9 content built on
  the identical Layers 1–8.
- The exact directory names/numbering (`02_AI_CONTEXT`, `04_PROJECT_MEMORY`, `app/.memory`) are
  this repository's instantiation choice — the *pattern* (numbered, purpose-named doc folders;
  a two-tier memory split) is what's reusable, not the specific names.

---

## Final Categorization

### Core Platform
Layers 1–7 (Repository Foundation through Automation Platform) — the mandatory substrate every
future repository built from this blueprint receives, since even a Legal AI or Education AI
needs governance, knowledge tracking, prompts, commands, workflow orchestration, review
discipline, and automation triggers. This is the part of the roadmap (Phases A–G) that should
be built first and treated as non-negotiable baseline for any new repository.

### Reusable Modules
The specific, swappable pieces *within* the Core Platform that vary by technology stack while
sharing the same interface — e.g., the "before-commit sanity check" hook slot (Layer 7) is a
reusable module with a TypeScript instance (`tsc -b`) here and would have a different instance
(`mypy`, `go vet`) elsewhere, without changing the hook mechanism itself. Similarly, the
flake-registry *pattern* (Layer 2) is a reusable module even though this repository's specific
flake entry is not.

### Repository Template
What a brand-new repository (Legal AI, Education AI, etc.) would literally scaffold on day one:
the empty Layer 1–7 directory/file skeleton (governance-rules directory, knowledge-system
directory with its ownership map, prompts directory, commands directory, workflow-state
convention, review-log format, hook-runner script) plus this blueprint document itself as the
onboarding reference — before a single line of that repository's own Layer 9 exists.

### Business Packages
Layer 9 instances, plugged into the same Core Platform: this repository's own package
(Procurement AI — `app/src/`, `03_KNOWLEDGE_BASE/`, and `skills/dau-thau-mua-sam.md` once it
exists) is one; a Legal AI package, an Education AI package, an Asset Management AI package, and
an HR AI package would each be separate, independently-developed Layer 9 packages sharing the
identical Layers 1–8 beneath them.

### Future AI Agents
Layer 8, explicitly deferred and conditional — not a current deliverable. If and when Layer 8 is
ever built, H1's role taxonomy (Planner, Explorer, Architect, Implementer, Reviewer, Test
Reviewer, CI Reviewer) becomes the generic agent set every vertical shares; domain-specific
agents (a Legal Reviewer, a Clinical Reviewer, an HR Compliance Reviewer) are themselves Business
Package-conditional — this repository's own Legal Reviewer/Knowledge Reviewer agents (H3) stay
blocked until `skills/dau-thau-mua-sam.md` exists, exactly mirroring how any other vertical's
domain agents would stay blocked until *that* vertical's own Layer 9 content exists first.

---

*End of blueprint. Per instruction, nothing was implemented: no source, test, CI, workflow, or
governance file was created or modified, and no ADR was produced. Waiting for approval before
implementing any layer or roadmap milestone.*
