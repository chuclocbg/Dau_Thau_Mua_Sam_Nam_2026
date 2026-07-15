# Governance Object Model

**Status:** PLANNING ONLY. No source, test, CI, workflow, or governance file was created or
modified. This document defines the 23 first-class concepts `GOVERNANCE_ENGINE_RUNTIME.md`
assumes but never formally typed, grounded in `REVIEW-3`'s real artifacts and the runtime
document's own 20 sections wherever a direct mapping exists.

**Layer ownership convention used throughout:** each object is assigned to exactly one
`ENGINEERING_PLATFORM_BLUEPRINT.md` layer or Governance Engine Runtime pipeline (per
`GOVERNANCE_ENGINE_RUNTIME.md`'s §4–§7). No object is owned by two layers — where a runtime
pipeline and a Blueprint layer both touch an object (e.g. `Workflow`), the object's *definition*
belongs to one, and the other only *consumes* it, matching the Runtime document's own §11
composition boundary.

**Revision 1 (Architecture Review remediation):** the formal Architecture Review of
`GOVERNANCE_RUNTIME_LIFECYCLE.md` found two findings whose fix belongs in this document: (HIGH)
`Request` — the Execution Lifecycle's own first stage — had no corresponding object here; added
below. (BLOCKER) `Validator`'s scope was ambiguous relative to `GOVERNANCE_RUNTIME_LIFECYCLE.md`'s
"Evidence Validation"/"Validator Creation" stages; `Validator`'s entry below now states its scope
explicitly excludes them. Both are documentation-only clarifications — no object's already-defined
behavior changed, no runtime component was built.

---

## Request

- **Purpose:** the triggering signal that starts one `RuleExecution` — a human or AI invoking a
  `Command`, or a dogfood run invoking a script directly. The Execution Lifecycle's own first
  stage (`GOVERNANCE_RUNTIME_LIFECYCLE.md` §2); previously undefined here (Architecture Review
  finding, now resolved).
- **Ownership:** Command Platform (Blueprint Layer 4) for the human/AI-invoked case; no owner for
  a direct script invocation (there is no formal "Request" object instantiated when a human runs
  `npx tsx <script>.ts` directly — that case produces an `ExecutionContext` with no preceding
  `Request` record at all, today).
- **Lifecycle:** `issued → consumed` — issued when a `Command` is invoked or a script is run
  directly; consumed the moment `ExecutionContext` construction begins. Not tracked as a
  persisted object; this is the *concept* the pipeline's first arrow represents, not a stored
  record (matching `Rule`'s own "conceptual, not separately serialized" pattern above).
- **Required fields:** `rule_id` or `command_name` (which rule/command was requested).
- **Optional fields:** `arguments` (for a future parameterized command).
- **Relationships:** produced-by a `Command` invocation (or, for a direct script run, has no
  producing object); consumed-by the start of one `RuleExecution`.
- **Serialization:** not persisted — ephemeral, same treatment as `ExecutionContext`.
- **Immutability:** N/A — not a stored record.
- **Extension points:** none beyond what `Command`'s own extension points already cover (§ below).
- **Cross-reference:** this is the same concept `GOVERNANCE_ENGINE_RUNTIME.md` §4 calls "trigger"
  — noted here for traceability; that document's own wording is unchanged, out of scope for this
  revision.

## Rule

- **Purpose:** the abstract governance concept itself — "REVIEW-3, post-push verification" as a
  named idea, independent of any one execution or definition revision.
- **Ownership:** Governance Engine Runtime (conceptual layer, no independent storage — it is the
  identity `RuleDefinition`/`RuleMetadata`/`RuleVersion` all point back to).
- **Lifecycle:** `designed → implemented → active → deprecated` (`GOVERNANCE_ENGINE_RUNTIME.md`
  §3). Evidenced: 24 of 25 designed rules sit at `designed`; `REVIEW-3` alone is `active`.
- **Required fields:** `rule_id` (stable, unique, e.g. `REVIEW-3`).
- **Optional fields:** none — `Rule` is intentionally minimal; everything else lives on
  `RuleDefinition`/`RuleMetadata`.
- **Relationships:** has-exactly-one current `RuleDefinition`; has-many historical
  `RuleVersion`s; has-many `RuleExecution`s over time.
- **Serialization:** not separately serialized — `rule_id` is the join key across every other
  object's records.
- **Immutability:** `rule_id` is immutable for the life of the rule; renaming a rule is a
  deprecation-and-supersession (§17 of the Runtime document), never an in-place rename.
- **Extension points:** none needed — new rules are new `Rule` identities, not extensions of
  existing ones (§12 of the Runtime document already rejects inheritance).

## RuleDefinition

- **Purpose:** the concrete, serialized specification of a rule — `GOVERNANCE_ENGINE_RUNTIME.md`
  §1's YAML block, formalized.
- **Ownership:** Governance Engine Runtime; stored under
  `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/<RULE-ID>.md` (§2).
- **Lifecycle:** created at `designed`, edited (with a `RuleVersion` bump if logic-affecting) as
  the rule matures through its `Rule` lifecycle states.
- **Required fields:** `rule_id`, `category`, `title`, `status`, `version`,
  `current_manual_process`, `desired_automated_verification`, `execution_points`,
  `failure_behavior`, `rollback_behavior`, `dependencies`.
- **Optional fields:** `script`, `command_adapter` (absent until `implemented`), `deprecated`,
  `deprecated_reason`, `superseded_by`.
- **Relationships:** belongs-to one `Rule`; references zero-or-more other `RuleDefinition`s via
  `dependencies` (§8 of the Runtime document); produces `RuleMetadata` as a derived view (see
  below).
- **Serialization:** one Markdown file with a YAML front-matter/body block, matching this
  repository's existing `Machine Context` convention — not a new format.
- **Immutability:** mutable, but every logic-affecting edit requires a `RuleVersion` bump (§16)
  — "versioned-mutable," not append-only and not frozen.
- **Extension points:** new optional fields may be added additively; no field may be removed
  without a version bump and a migration note.

## RuleExecution

- **Purpose:** one specific, timestamped run of a rule's script — "REVIEW-3 executed at commit
  `be88ecd`, 2026-07-14."
- **Ownership:** the Rule Execution Pipeline (`GOVERNANCE_ENGINE_RUNTIME.md` §4).
- **Lifecycle:** `triggered → running → completed`. No further states — a completed execution is
  a permanent historical fact, never reopened.
- **Required fields:** `rule_id`, `version` (which `RuleVersion` ran), `triggered_by`
  (`execution_points` value: command / dogfood / ci / pre-commit / ai-review), `timestamp`,
  `execution_context` (see `ExecutionContext` below).
- **Optional fields:** `duration_ms`.
- **Relationships:** belongs-to one `Rule` at a specific `RuleVersion`; produces exactly one
  `RuleResult`; consumes one `ExecutionContext`.
- **Serialization:** feeds the Rule Reporting Pipeline (§6) as one `Report` entry; not
  independently persisted beyond that — `RuleExecution` is the event, `Report` is its durable
  record.
- **Immutability:** fully immutable once `completed` — matches this project's audit-first
  discipline (a past verification run is a fact, never edited after the fact).
- **Extension points:** `triggered_by` is an open enum — a future execution point (e.g. a
  scheduled/periodic trigger, per Runtime §18's "periodic re-verification via dogfooding") adds a
  new value, never redefines an existing one.

## RuleResult

- **Purpose:** the outcome of one `RuleExecution` — pass/fail plus per-`Check` detail. Maps
  directly onto `verifyPushState.ts`'s aggregated `CheckResult[]` plus the final
  `allOk`/exit-code verdict.
- **Ownership:** Rule Execution Pipeline.
- **Lifecycle:** created once, at the end of a `RuleExecution`; never mutated afterward.
- **Required fields:** `execution_id` (join key to `RuleExecution`), `overall_ok` (boolean),
  `checks` (array of `Check` outcomes — see `Check` below), `masked_or_ambiguous` (flags for
  results like `REVIEW-3`'s `continue-on-error`-masked steps, per Runtime §4's classification).
- **Optional fields:** none required beyond the above; a rule may attach rule-specific detail
  fields, but the four above are the contract every consumer (Reporting, Rollback, Review) can
  rely on.
- **Relationships:** belongs-to one `RuleExecution`; aggregates one-or-more `Check` outcomes;
  produces zero-or-more `Failure`/`Warning` records (one per non-passing `Check`).
- **Serialization:** the payload of a `Report` entry; also the shape a future `--json` flag
  (Runtime §19, not yet built) would emit.
- **Immutability:** fully immutable, same reasoning as `RuleExecution`.
- **Extension points:** the `checks` array is open — a rule with more or fewer checks than
  `REVIEW-3`'s three simply has a differently-sized array; no schema change needed per rule.

## RuleMetadata

- **Purpose:** the planning/prioritization subset of a rule's data — `category`, `complexity`,
  `value`, `priority` — exactly `GOVERNANCE_ENGINE_DESIGN.md`'s own table columns, now typed.
- **Ownership:** Governance Engine Runtime; derived from `RuleDefinition`, not independently
  authored.
- **Lifecycle:** re-derived whenever `RuleDefinition` changes; not separately versioned (it
  inherits `RuleDefinition`'s version implicitly).
- **Required fields:** `rule_id`, `category` (one of the 8, §10 of the Runtime document),
  `complexity` (low/medium/high), `value` (low/medium/high), `priority`
  (low/medium/high/highest).
- **Optional fields:** none.
- **Relationships:** a read-only projection of `RuleDefinition`; consumed by the registry (§2)
  for category/priority queries ("what's the next highest-ROI unblocked rule").
- **Serialization:** not separately stored — computed from `RuleDefinition` at query time (or
  cached, if the registry ever needs to scale beyond hand-maintenance, per §2's own caveat).
- **Immutability:** a pure function of `RuleDefinition`; has no independent mutable state.
- **Extension points:** none — extending this means extending `RuleDefinition` instead.

## RuleVersion

- **Purpose:** captures the versioning concept (`GOVERNANCE_ENGINE_RUNTIME.md` §16) — a
  lightweight integer, not full semver, matching this project's existing lightweight
  versioning conventions (Prisma migrations are timestamp-ordered; `PROJECT_KNOWLEDGE_SYSTEM`
  uses simple `v1.0`/`v1.1` tags).
- **Ownership:** Governance Engine Runtime.
- **Lifecycle:** created once per logic-affecting change to a rule's script; never mutated
  after creation (a past version's definition is a historical fact).
- **Required fields:** `rule_id`, `version_number` (integer, starts at 1), `changed_at`,
  `reason` (why the bump — must reference an actual behavioral change, not cosmetic edits).
- **Optional fields:** `previous_version_number`.
- **Relationships:** belongs-to one `Rule`; a `RuleExecution` records which `RuleVersion` it ran
  under.
- **Serialization:** append-only list inside the `RuleDefinition`'s file, or a sibling changelog
  — implementation detail, not specified further here (out of scope for an object-model
  document; a runtime-implementation decision).
- **Immutability:** fully append-only — a `RuleVersion` record, once created, is never edited.
- **Extension points:** none — this object is intentionally minimal by design (§16's own
  "lighter-weight than full semver" choice).

## Validator

- **Purpose:** performs the Rule Validation Pipeline (`GOVERNANCE_ENGINE_RUNTIME.md` §5) — checks
  that a `RuleDefinition` is well-formed and its implementation matches what it claims (does the
  declared script exist, does the command adapter avoid duplicated logic). Validates the *rule*,
  not the codebase the rule is about — a distinct concern from `Check`.
- **Scope boundary, stated explicitly (Architecture Review remediation):** `Validator` checks a
  `RuleDefinition`'s well-formedness only, on-demand, at authoring/edit time. It does **not**
  perform per-execution sanity-checking of `Evidence` gathered during a normal rule run.
  `GOVERNANCE_RUNTIME_LIFECYCLE.md`'s Execution Lifecycle names "Validator Creation" and
  "Evidence Validation" as pipeline stages between Check Scheduling and Result Aggregation —
  neither instantiates this object. That per-execution concept is a **future capability, not
  implemented, out of current runtime scope, with no corresponding object defined anywhere in
  this document** — naming it further, or formally specifying it as a new object, is deferred to
  whenever real implementation need arises, not decided here.
- **Ownership:** Rule Validation Pipeline; itself a candidate for a future governance rule (a
  rule that checks other rules — named, not built, per Runtime §5's own honest recursion note).
- **Lifecycle:** invoked on-demand (when a `RuleDefinition` is authored or edited), not
  continuously running.
- **Required fields:** `validator_id`, `checks_performed` (list of validation predicates, e.g.
  "script path exists," "adapter contains no logic beyond invoke-and-relay").
- **Optional fields:** none.
- **Relationships:** consumes one `RuleDefinition`; produces one `ValidationResult`.
- **Serialization:** not persisted independently — its behavior is code, not data.
- **Immutability:** the `Validator`'s check logic is itself subject to `RuleVersion`-style
  change control if it ever becomes a real governance rule.
- **Extension points:** new validation predicates are added additively as the authoring
  checklist (`GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` §6/§20) grows.

## ValidationResult

- **Purpose:** the outcome of a `Validator` run — is this `RuleDefinition` well-formed.
- **Ownership:** Rule Validation Pipeline.
- **Lifecycle:** created once per validation run; immutable afterward.
- **Required fields:** `rule_id`, `ok` (boolean), `findings` (list of specific problems, if any).
- **Optional fields:** none.
- **Relationships:** belongs-to one `RuleDefinition` (at a point in time); structurally
  parallel to `RuleResult` but scoped to rule well-formedness rather than codebase compliance.
- **Serialization:** same reporting path as `RuleResult` — feeds a `Report`.
- **Immutability:** immutable, same reasoning as `RuleResult`.
- **Extension points:** `findings` is an open list, matching `RuleResult.checks`'s openness.

## Evidence

- **Purpose:** the raw, factual data a `Check` gathers before interpretation — e.g. the literal
  output of `git rev-parse HEAD`, or the GitHub API's raw JSON response. Distinct from the
  *judgment* made from it (that's `RuleResult`/`Check`'s `ok` field) — this separation exists
  specifically so raw facts remain auditable independent of the verdict drawn from them, matching
  this project's audit-first principle ("show your work").
- **Ownership:** Rule Execution Pipeline; captured inline during a `RuleExecution`.
- **Lifecycle:** captured once, at check time; immutable afterward.
- **Required fields:** `source` (what produced it — a command, an API endpoint), `raw_value`,
  `captured_at`.
- **Optional fields:** none.
- **Relationships:** consumed-by one-or-more `Check`s to produce their `ok`/`detail` verdict;
  referenced-by the `Report` for full auditability.
- **Serialization:** embedded in the `Report` entry, or truncated/summarized if voluminous (e.g.
  a full GitHub Actions job payload) — the summarization policy is left to implementation.
- **Immutability:** fully immutable — a raw fact captured at a point in time.
- **Extension points:** none — `Evidence` is intentionally a plain data container, not extended
  per rule.

## Check

- **Purpose:** one atomic, named verification unit within a rule — `checkHeadMatchesOrigin`,
  `checkWorkingTreeClean`, and the polling-derived CI check inside `verifyPushState.ts` are the
  three real, concrete `Check` instances `REVIEW-3` defines.
- **Ownership:** the rule's own script (rule-specific logic, per the Runtime document's own
  extraction table — `Check` definitions are explicitly *not* extracted into shared
  infrastructure, since they *are* each rule's actual content).
- **Lifecycle:** defined once (as code) when the rule is implemented; invoked once per
  `RuleExecution`.
- **Required fields:** `name`, `ok` (boolean outcome for this specific check), `detail`
  (human-readable explanation, matching `CheckResult.detail` in the real code).
- **Optional fields:** `evidence_ref` (pointer to the `Evidence` this check's verdict was drawn
  from).
- **Relationships:** belongs-to one `RuleExecution` (via its parent `RuleResult`); consumes
  `Evidence`; may produce a `Failure` or `Warning` if `ok` is false.
- **Serialization:** an array element inside `RuleResult.checks`.
- **Immutability:** the check's *outcome* (a specific instance) is immutable once produced; the
  check's *definition* (the function/logic) is mutable code, versioned via `RuleVersion`.
- **Extension points:** each rule defines its own `Check`s freely — this is the one object in
  the entire model explicitly designed to be authored fresh per rule, not reused.

## Step

- **Purpose:** one stage within a broader, multi-stage engineering `Workflow` — e.g. "Planning,"
  "Verification," within the 9-layer Platform Architecture pipeline
  (`ENGINEERING_PLATFORM_V2.md` §1). Distinct from `Check` (inside one rule's execution) — `Step`
  operates one layer up, potentially invoking one or more `Command`s/`RuleExecution`s.
- **Ownership:** Workflow Platform (Blueprint Layer 5) — **not** the Governance Engine Runtime,
  per the Runtime document's own §11 boundary. Included here only because the object model must
  define every concept the runtime's objects touch, even ones it doesn't own.
- **Lifecycle:** `pending → active → complete`, tracked per the roadmap's G1 milestone
  (a lightweight milestone-state field, not a heavyweight tracker).
- **Required fields:** `layer` (one of the 9 Platform Architecture layers), `status`.
- **Optional fields:** `associated_commands` (which `Command`s this step invokes, if any).
- **Relationships:** belongs-to one `Workflow`; may invoke zero-or-more `Command`s, each
  triggering a `RuleExecution`.
- **Serialization:** a field on an in-progress plan document's front matter (per roadmap G1),
  not a separate object store.
- **Immutability:** mutable while `active`; the historical record of which steps a completed
  workflow passed through should be immutable once the workflow completes.
- **Extension points:** owned by Workflow Platform — any extension happens there, not in this
  document.

## Workflow

- **Purpose:** a named, multi-step sequence composing multiple `Step`s/`Command`s/rule
  executions — e.g. a future `/freeze` composing `REVIEW-3` + `REVIEW-2` + git checks.
- **Ownership:** Workflow Platform (Blueprint Layer 5), explicitly **not** the Governance Engine
  Runtime (Runtime document §11) — stated here again because it is the single most important
  boundary in this whole object model, and the object most at risk of being accidentally
  rebuilt twice.
- **Lifecycle:** `defined → running → completed`, composed of its constituent `Step`s' lifecycles.
- **Required fields:** `name`, `steps` (ordered list).
- **Optional fields:** none specified here — Workflow Platform's own design owns further detail.
- **Relationships:** has-many `Step`s; each `Step` may trigger `Command`s, each `Command`
  triggers `RuleExecution`s. `Workflow` never invokes a rule's `Check` logic directly — it only
  ever goes through `Command` → `RuleExecution`, preserving the same interface a human uses.
- **Serialization:** owned by Workflow Platform's own future design — not specified further
  here, deliberately, to avoid this document overreaching into a layer it doesn't own.
- **Immutability:** a completed `Workflow`'s record (which steps ran, in what order, with what
  results) should be immutable, mirroring `RuleExecution`'s own immutability.
- **Extension points:** owned by Workflow Platform.

## Command

- **Purpose:** the human/AI-facing invocation mechanism — `.claude/commands/ci-review.md` is the
  one real, concrete instance. Translates a slash-command invocation into a `RuleExecution` (or,
  once `Workflow` exists, into a `Workflow` of multiple `RuleExecution`s).
- **Ownership:** Command Platform (Blueprint Layer 4); the file format itself is Claude-specific
  (per `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md`'s classification table), while the *concept* of a
  thin invocation wrapper is platform-wide.
- **Lifecycle:** `defined → invoked` (repeatedly, unboundedly — a `Command` is reusable across
  many invocations, unlike `RuleExecution` which is one specific run).
- **Required fields:** `command_name`, `description`, `invokes` (which `Rule`/script it wraps).
- **Optional fields:** `argument_hint` (matches the real frontmatter field observed in this
  environment's own installed plugin commands).
- **Relationships:** wraps exactly one `RuleDefinition`'s script (or, for a composite command
  like a future `/freeze`, one `Workflow`); each invocation produces one `RuleExecution` (or one
  `Workflow` run).
- **Serialization:** one Markdown file with YAML frontmatter, per the real, observed convention
  (`.claude/commands/<name>.md`).
- **Immutability:** mutable — a command's wording/instructions can be refined; unlike
  `RuleDefinition`, no formal versioning is required here since a command's *behavior* (what
  script it invokes) rarely changes independent of the rule itself.
- **Extension points:** new commands are added one at a time (per the roadmap's own Decision
  Budget discipline — never bundled), each wrapping exactly one rule or workflow.

## Review

- **Purpose:** the act of evaluating a proposed or completed change against governance rules —
  broader than any single `Rule`'s automated `Check`; adds human/AI judgment on top of
  `RuleResult`s (Blueprint Layer 6, Review Platform).
- **Ownership:** Review Platform, not the Governance Engine Runtime — this runtime only supplies
  the `RuleResult`s a `Review` consumes as input.
- **Lifecycle:** `requested → in_progress → concluded`. Two distinct checkpoint types exist per
  the roadmap's F1 (Architect, pre-implementation; Reviewer, post-implementation) — both are
  `Review` instances, distinguished by a `checkpoint_type` field.
- **Required fields:** `checkpoint_type` (architect | reviewer), `subject` (what's being
  reviewed — a plan, a diff, a commit), `inputs` (which `RuleResult`s informed it).
- **Optional fields:** `human_notes`.
- **Relationships:** consumes zero-or-more `RuleResult`s; produces exactly one `ReviewResult`.
- **Serialization:** feeds the roadmap's F2 review-history log — not specified further here
  (Review Platform's own design detail).
- **Immutability:** the `Review` activity itself is transient/in-progress state; only its
  `ReviewResult` is the durable, immutable record.
- **Extension points:** domain-specific review checkpoints (a future Legal Reviewer) are new
  `checkpoint_type` values, per `ENGINEERING_PLATFORM_BLUEPRINT.md` Layer 6's own extension point.

## ReviewResult

- **Purpose:** the outcome of a `Review` — a verdict (approved / needs-changes / blocked) plus
  which `RuleResult`s informed it. This is the real, concrete shape of what my own manual
  pre-/post-implementation disclosures during `REVIEW-3` already produced informally.
- **Ownership:** Review Platform.
- **Lifecycle:** created once, at `Review` conclusion; immutable afterward.
- **Required fields:** `review_id`, `verdict`, `informing_results` (list of `RuleResult`
  references).
- **Optional fields:** `rationale` (the human-authored "why," never templated — per
  `GOVERNANCE_ENGINE_RUNTIME.md`'s estimated-impact section, this is explicitly the part that
  cannot and should not be generated).
- **Relationships:** belongs-to one `Review`.
- **Serialization:** an entry in the review-history log (roadmap F2).
- **Immutability:** fully immutable once created.
- **Extension points:** none — deliberately minimal, matching this platform's standing principle
  that judgment-bearing records should not be templated or extended mechanically.

## Report

- **Purpose:** the durable, human-readable record produced after a `RuleExecution` or `Review` —
  today this is console output only (`REVIEW-3`'s actual current state); the designed extension
  (`GOVERNANCE_ENGINE_RUNTIME.md` §6) is a durable, queryable log entry.
- **Ownership:** Rule Reporting Pipeline.
- **Lifecycle:** created once per `RuleExecution`/`Review`; append-only from then on, mirroring
  `MILESTONE_HISTORY.md`'s own "archive, never overwrite" discipline (reused here, not
  reinvented, per §17 of the Runtime document already citing this same pattern).
- **Required fields:** `source_id` (the `RuleExecution` or `Review` this reports on), `content`,
  `created_at`.
- **Optional fields:** `evidence_refs`.
- **Relationships:** wraps one `RuleResult`/`ValidationResult`/`ReviewResult`.
- **Serialization:** a Markdown entry in a durable log file (roadmap F2's review-history log, or
  a sibling), or console text today, pending §6's extension.
- **Immutability:** append-only — a `Report` entry, once written, is never edited, only
  superseded by a later entry.
- **Extension points:** the reporting format may grow new fields additively (e.g. a future
  `--json` machine-readable variant, Runtime §19).

## ExecutionContext

- **Purpose:** the environment a `RuleExecution` runs within — maps directly onto what
  `verifyPushState.ts` gathers at the start of every run (`repoRoot()`, `currentBranch()`,
  `ownerRepoFromRemote()`).
- **Ownership:** Rule Execution Pipeline.
- **Lifecycle:** constructed fresh at the start of every `RuleExecution`; discarded after (its
  relevant fields are captured into `Evidence`/`Report`, not persisted as its own object).
- **Required fields:** `repo_root`, `branch`, `owner`, `repo`, `head_sha`.
- **Optional fields:** `environment_variables` (only those a specific rule needs, e.g.
  `DATABASE_URL` for a future migration-policy rule).
- **Relationships:** consumed-by exactly one `RuleExecution`.
- **Serialization:** ephemeral — not independently stored, only reflected into `Evidence`.
- **Immutability:** immutable once constructed (a snapshot of environment state at execution
  start).
- **Extension points:** new fields added as new rule categories need new environmental facts
  (e.g. a future Prisma-related rule adding `database_url_reachable: boolean`).

## ReviewContext

- **Purpose:** analogous to `ExecutionContext` but for a `Review` — what's being reviewed, which
  `RuleResult`s are available, which checkpoint type this represents.
- **Ownership:** Review Platform.
- **Lifecycle:** constructed fresh at `Review` start; discarded after (its relevant facts
  captured into `ReviewResult`).
- **Required fields:** `subject_ref` (the plan/diff/commit being reviewed), `checkpoint_type`,
  `available_results` (list of `RuleResult`s gathered so far).
- **Optional fields:** none.
- **Relationships:** consumed-by exactly one `Review`.
- **Serialization:** ephemeral, same reasoning as `ExecutionContext`.
- **Immutability:** immutable once constructed.
- **Extension points:** owned by Review Platform.

## RollbackContext

- **Purpose:** the state needed to actually perform a rollback (`GOVERNANCE_ENGINE_RUNTIME.md`
  §7) — which commit to revert, whether an override path exists, whether data-undo is needed.
- **Ownership:** Rule Rollback Pipeline.
- **Lifecycle:** constructed on-demand, only when a rollback is actually being considered — not
  proactively maintained for every rule.
- **Required fields:** `rule_id`, `rollback_behavior` (revert | override | data-undo, from
  `RuleDefinition`), `target_commit` (for `revert`).
- **Optional fields:** `override_path` (for `override`), `undo_procedure` (for `data-undo`).
- **Relationships:** derived from one `RuleDefinition`'s `rollback_behavior` field plus the
  specific `RuleExecution`/commit being rolled back.
- **Serialization:** ephemeral — constructed at rollback time, not persisted in advance.
- **Immutability:** immutable once constructed for a specific rollback attempt.
- **Extension points:** `rollback_behavior`'s three values (§7 of the Runtime document) are the
  only extension point — a genuinely new rollback shape would need a new value there first.

## Failure

- **Purpose:** a specific, non-passing `Check` outcome where `failure_behavior: block` applies —
  distinct from `Warning` (advisory).
- **Ownership:** Rule Execution Pipeline.
- **Lifecycle:** created once, when a `Check` fails under a blocking rule; immutable afterward.
- **Required fields:** `rule_id`, `check_name`, `detail`, `blocks_step` (boolean — per Runtime
  §14, a `block`-behavior failure halts the current workflow step).
- **Optional fields:** `override_available` (per `RollbackContext`'s `override_path`, if one
  exists for this rule).
- **Relationships:** produced-by one `Check` within one `RuleResult`.
- **Serialization:** embedded in the `Report`.
- **Immutability:** immutable, same reasoning as other execution-time records.
- **Extension points:** none — a plain, minimal record by design.

## Warning

- **Purpose:** the same shape as `Failure` but for `failure_behavior: warn`/`flag` outcomes —
  non-blocking, surfaced or logged but never halts the current step.
- **Ownership:** Rule Execution Pipeline.
- **Lifecycle:** created once, when a `Check` fails under a non-blocking rule; immutable
  afterward.
- **Required fields:** `rule_id`, `check_name`, `detail`.
- **Optional fields:** `flagged_for_review` (boolean — per Runtime §14's `flag` behavior,
  routes to a later `/review` rather than being lost).
- **Relationships:** produced-by one `Check`.
- **Serialization:** embedded in the `Report`.
- **Immutability:** immutable.
- **Extension points:** none.

## Artifact

- **Purpose:** any file produced by a rule's implementation or execution — the script file, the
  command adapter file, a generated `Report`, a log entry. The general "thing produced" category,
  distinct from the behavior-describing objects above (`Rule`, `Check`).
- **Ownership:** cross-cutting — any layer that produces a file produces an `Artifact` record
  describing it; not owned by one single layer.
- **Lifecycle:** `created → (optionally) modified → (optionally) deprecated`, tracked via normal
  git history for file-shaped artifacts (scripts, adapters) and via `Report`'s own append-only
  discipline for log-shaped artifacts.
- **Required fields:** `path`, `kind` (script | command_adapter | report | config), `rule_id`
  (which rule it belongs to, if any).
- **Optional fields:** `content_hash` (for content-addressed identity, matching git's own model).
- **Relationships:** a `RuleDefinition`'s `script`/`command_adapter` fields are references to
  `Artifact` instances.
- **Serialization:** the file itself, tracked by git — no separate metadata store needed beyond
  what `RuleDefinition` already references.
- **Immutability:** a specific `Artifact` instance (at a specific commit) is immutable, matching
  git's own content-addressing; the *file path* may be edited over time, producing new instances.
- **Extension points:** new `kind` values as new artifact types emerge (e.g. a future
  `dry_run_report` per Runtime §18's dry-run testing strategy).

---

## 1. Object Relationship Diagram (text only)

```
Request ──(issues)── (a Command invocation, or a direct script run) ──starts── RuleExecution

Rule ──1:1── RuleDefinition ──1:N── RuleVersion
  │                │
  │                └──(derives)── RuleMetadata
  │
  ├──1:N── RuleExecution ──1:1── RuleResult ──1:N── Check ──0:1── Evidence
  │             │                    │                │
  │             │                    ├──0:N── Failure ─┘  (when failure_behavior=block)
  │             │                    └──0:N── Warning ─┘  (when failure_behavior=warn/flag)
  │             │
  │             └──1:1── ExecutionContext (ephemeral, feeds Report)
  │
  ├──0:N── (validated by) Validator ──1:1── ValidationResult
  │
  └──(wrapped by)── Command ──(triggers)── RuleExecution
                        │
                        └──(composed into, Workflow Platform only)── Step ──(composes into)── Workflow

RuleExecution / ValidationResult / ReviewResult ──(all produce)── Report

Review ──1:1── ReviewContext (ephemeral) ──consumes── RuleResult[]
  │
  └──1:1── ReviewResult

RuleDefinition.rollback_behavior ──(instantiates, on demand)── RollbackContext

Artifact ──(referenced by)── RuleDefinition.script / RuleDefinition.command_adapter / Report
```

---

## 2. Runtime Dependency Graph

What must exist before what — a build-order graph, not a data-flow graph:

```
RuleDefinition schema (§1 of the Runtime doc)
  └── required before: Rule Registry (§2), RuleVersion, RuleMetadata

Check / RuleResult / Evidence shapes (already exist, informally, inside verifyPushState.ts)
  └── required before: RuleExecution can be formalized as a distinct object
      (today, REVIEW-3's execution is implicit -- running the script IS the execution,
       with no separate RuleExecution record kept)

RuleExecution + RuleResult
  └── required before: Report can be more than console text (§6 of the Runtime doc)
  └── required before: Failure / Warning can be distinguished as formal records
      (today, REVIEW-3's script only distinguishes ok/not-ok per check, not
       block-vs-warn severity -- this is a real, currently-unimplemented gap)

RuleDefinition.rollback_behavior field
  └── required before: RollbackContext has anything to dispatch on

Validator
  └── depends on: RuleDefinition schema existing first (nothing to validate otherwise)

Command (already exists, REVIEW-3's ci-review.md)
  └── depends on: a RuleDefinition's script existing first (already true for REVIEW-3)

Step / Workflow (Workflow Platform, not this runtime)
  └── depends on: Command existing (already true) and RuleResult being a stable,
      documented contract (already true, informally, via REVIEW-3's CheckResult shape)

Review / ReviewResult / ReviewContext (Review Platform, not this runtime)
  └── depends on: RuleResult being queryable across multiple RuleExecutions, which
      depends on Report existing as more than console text (§6) -- currently blocked
      on the same gap Report itself is blocked on
```

**The single clearest build-order finding:** almost every object above that isn't already
informally realized inside `verifyPushState.ts` is blocked, directly or transitively, on
`Report` becoming a durable log instead of console-only output. That is the runtime's actual
critical path, not a symmetric 23-object build effort.

---

## 3. Objects Reusable Across All Governance Rules

`Request`, `RuleDefinition`, `RuleExecution`, `RuleResult`, `RuleMetadata`, `RuleVersion`,
`Validator`, `ValidationResult`, `Evidence`, `Report`, `ExecutionContext`, `Failure`, `Warning`,
`Artifact`, `RollbackContext` — every one of these is a **schema/container**, identical in shape
regardless of which rule fills it. This matches `GOVERNANCE_ENGINE_RUNTIME.md`'s own extraction
table almost exactly: the containers are infrastructure, built once.

## 4. Objects That Must Remain Rule-Specific

**`Check`** — explicitly, singularly, the one object in this entire model that is never reused
across rules. Its *shape* (name/ok/detail) is standard; its *content* (the actual comparison
logic) is each rule's real, irreducible work. This matches both the Vertical Slice Template's
own finding (the check functions are what a future rule author writes fresh) and the Runtime
document's extraction table (explicitly excluding the specific check functions from extraction).

`Command`'s specific wording and `RuleDefinition`'s specific `current_manual_process`/
`desired_automated_verification` prose are also, by nature, rule-specific content within
otherwise-reusable containers — the container is shared, the words inside it are not.

## 5. REVIEW-3 Artifacts Mapped Onto This Model

| Real REVIEW-3 artifact | Maps onto |
|---|---|
| Running `npx tsx app/scripts/verifyPushState.ts` (or invoking `/ci-review`) | `Request` |
| `app/scripts/verifyPushState.ts` (the file) | `Artifact`, `kind: script` |
| `checkHeadMatchesOrigin()`, `checkWorkingTreeClean()`, the CI-polling check | Three `Check` definitions |
| Each function's returned `{ name, ok, detail }` | One `Check` outcome instance |
| The raw `git rev-parse`/GitHub API outputs those functions read | `Evidence` |
| The full `results: CheckResult[]` array + `allOk` | `RuleResult` |
| Running the script once (e.g. against commit `be88ecd`) | One `RuleExecution` |
| The console output printed | `Report` — today, ephemeral/console-only; the real gap Runtime §6 names |
| `.claude/commands/ci-review.md` | `Artifact`, `kind: command_adapter`, and the `Command` definition itself |
| `GOVERNANCE_ENGINE_DESIGN.md`'s `REVIEW-3` table row | `RuleMetadata` |
| The my pre-implementation disclosure (rule/why/files/rollback/architecture/CI/budget) | An informal `ReviewResult` from an unbuilt "Architect" `Review` checkpoint |
| The post-implementation report (summary/verification/files/commit/CI/lessons/reusable-parts) | An informal `Report`, manually composed rather than generated from `RuleResult` |
| The `.gitignore` fix, discovered mid-implementation | An `Artifact` fix, discovered because no `Validator` existed yet to catch it beforehand — direct evidence for why §5's `Validator` object is needed, not just designed |
| `version: 1` (implicit, never explicitly bumped) | `RuleVersion` — REVIEW-3 has never needed a second version, so this object has zero real instances yet beyond the initial one |

---

*End of object model. Per instruction, nothing was implemented: no source, test, CI, workflow,
or governance file was created or modified, and no commit was made. Waiting for approval before
implementing any runtime component.*
