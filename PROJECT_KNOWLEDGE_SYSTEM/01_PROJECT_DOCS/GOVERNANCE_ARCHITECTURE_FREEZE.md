# Governance Engine Architecture — Freeze

**Purpose:** freeze the Governance Engine / Engineering Platform architecture exactly as it
exists today, following the second Architecture Review's **READY FOR IMPLEMENTATION** verdict.
This is a design freeze, not a feature-complete claim — see "Definition of Architecture
Complete" below for the precise, honest boundary of what "frozen" means here.

**No architecture document was modified to produce this freeze. No runtime code was written. No
ADR was created.** This document only records and consolidates decisions already made and
already approved across the documents it references.

---

## Architecture Version

**Governance Engine Architecture v1.0**, frozen 2026-07-14, following the second Architecture
Review's `READY FOR IMPLEMENTATION` verdict on `GOVERNANCE_RUNTIME_LIFECYCLE.md` (post-Revision
1). This is the *first* frozen version — no prior version exists to diff against.

---

## Approved Documents

Every document this freeze covers, in the order they were produced, with current status:

| Document | Status |
|---|---|
| `ENGINEERING_PLATFORM_V1.md` | Approved |
| `ENGINEERING_PLATFORM_V2.md` | Approved |
| `ENGINEERING_PLATFORM_GAP_ANALYSIS.md` | Approved |
| `ENGINEERING_EVOLUTION_ROADMAP.md` | Approved |
| `ENGINEERING_PLATFORM_BLUEPRINT.md` | Approved |
| `GOVERNANCE_ENGINE_DESIGN.md` | Approved |
| `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` | Approved |
| `GOVERNANCE_ENGINE_RUNTIME.md` | Approved as planning artifact; Revision 1 applied (Architecture Review remediation) |
| `GOVERNANCE_OBJECT_MODEL.md` | Approved as planning artifact; Revision 1 applied (added `Request`, bounded `Validator`'s scope) |
| `GOVERNANCE_RUNTIME_LIFECYCLE.md` | Approved — second Architecture Review returned `READY FOR IMPLEMENTATION` after Revision 1 |

**Implemented artifact this architecture was reverse-engineered from** (not an architecture
document, listed for completeness and because the freeze's invariants depend on it remaining
true): `app/scripts/verifyPushState.ts`, `.claude/commands/ci-review.md`, the narrowed
`.gitignore` — commit `be88ecd`, Governance Rule `REVIEW-3`. This is the one piece of real,
committed, shipped code in the entire Governance Engine to date; every document above either
describes it or generalizes from it.

---

## Runtime Scope

What "the Governance Engine Runtime" covers, as frozen:

- Executing **one rule at a time**, correctly and reusably (`GOVERNANCE_ENGINE_RUNTIME.md` §4,
  `GOVERNANCE_RUNTIME_LIFECYCLE.md` §2).
- The Rule Definition Format, Registry, Lifecycle, Execution/Validation/Reporting/Rollback
  pipelines, Dependencies, Priorities, Categories, Failure Handling, Metadata, Versioning,
  Deprecation, Testing Strategy, and Execution API (`GOVERNANCE_ENGINE_RUNTIME.md` §1–§20).
- The 23-object catalog and their relationships, ownership, lifecycle, and immutability rules
  (`GOVERNANCE_OBJECT_MODEL.md`).
- The startup sequence, execution lifecycle, state machine, failure model, retry strategy,
  rollback model, parallelism model, and runtime invariants for a *single* rule execution
  (`GOVERNANCE_RUNTIME_LIFECYCLE.md` §1–§10).

**Explicitly out of this runtime's scope** (owned by other Blueprint layers, per
`GOVERNANCE_ENGINE_RUNTIME.md` §11's own boundary, reaffirmed nowhere contradicted since):
composing multiple rules into a named sequence (Workflow Platform, Layer 5); the
Architect/Reviewer review discipline built atop rule results (Review Platform, Layer 6); hook
trigger mechanisms (Automation Platform, Layer 7); multi-agent execution (AI Runtime, Layer 8);
and anything domain/business-specific (Business Modules, Layer 9).

---

## Explicit Non-Goals

Carried forward from every document in this arc, consolidated here so they aren't scattered
across ten files:

- **No rule composition or Workflow Platform inside this runtime** — the single most-repeated
  boundary across every document; building it twice was named as the platform's own likeliest
  drift risk.
- **No rule inheritance** — evaluated and rejected (`GOVERNANCE_ENGINE_RUNTIME.md` §12); no
  evidenced need for a class hierarchy over composition of shared mechanisms.
- **No event bus / pub-sub / `EventEmitter`** — `GOVERNANCE_RUNTIME_LIFECYCLE.md` §4 is marked
  Future Capability, not a build target, until a second rule or real decoupled consumer exists.
- **No formally-specified per-execution "Evidence Validation" object** — deliberately left
  undefined rather than invented under pressure to close the BLOCKER finding; a real object
  specification is deferred until genuine implementation need forces the question.
- **No machine-readable (`--json`) execution API** — deferred until a real programmatic consumer
  exists (`GOVERNANCE_ENGINE_RUNTIME.md` §19).
- **No new hook-runner dependency** (e.g. Husky) — a plain script is the standing default per the
  Gap Analysis's own "should never be implemented" list.
- **No `/plan` command** — the planning discipline this entire arc was produced under is already
  the platform's best-functioning process; V1's original rejection stands.
- **No multi-agent runtime** — Layer 8 stays at "role definitions as documentation" until a real
  parallelization need is demonstrated, not assumed.
- **No Business Package (Layer 9) work of any kind** under this architecture — CLAUDE.md's own
  domain rules and the procurement application itself are entirely untouched by everything in
  this freeze.

---

## Deferred Findings

From the formal Architecture Review of `GOVERNANCE_RUNTIME_LIFECYCLE.md`, explicitly **not**
resolved by Revision 1 (in scope was only the 1 BLOCKER + 2 HIGH findings):

- **[MEDIUM]** §7's "`git fetch` ... safe, no local mutation" is factually imprecise (fetch does
  mutate remote-tracking refs, safely and idempotently, but not mutation-free).
- **[MEDIUM]** §10's "Reports are immutable after publication" invariant lacks the aspirational
  caveat given to its neighbor ("never skips Validation") — today's Report Generation is
  ephemeral console output, not a persisted object this invariant meaningfully protects yet.
- **[MEDIUM]** §3's State Machine honesty notes are scattered as inline parentheticals rather
  than stated once, prominently, the way §4 now does.
- **[LOW]** §6's Configuration/Git failure-category boundary is ambiguous for at least one real
  case (`ownerRepoFromRemote()`'s throw).

Also explicitly deferred, named across multiple documents rather than the Review specifically:

- **Rule Conflict Resolution** (`GOVERNANCE_ENGINE_RUNTIME.md` §13) — speculative, "nothing real
  to test it against" until two rules with genuinely overlapping triggers exist.
- **The entire Runtime Architecture and Object Model's own recommendation**, stated at each
  document's own opening: treat both as drafts, re-validate once Governance Rules #2 and #3
  exist. This freeze does not override that recommendation — it freezes the *current* draft as
  the basis for implementation, not as a claim the draft is final.

---

## Known Limitations

Stated plainly, not softened:

- **This entire architecture generalizes from a sample size of one** (`REVIEW-3`). Every
  document says so at least once. Real validation against Rules #2 and #3 has not happened yet.
- **No Rule Registry exists** — `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/`
  is a designed path, not a real directory. Rule Selection is vacuous today (one rule, no choice
  to make).
- **No `Validator` exists** — the "never skips Validation" invariant is, by the architecture's
  own admission, currently violated in practice: `REVIEW-3` shipped without ever passing through
  one.
- **Report Generation is ephemeral** (console output only) — this is the single blocker nearly
  every other undelivered object in the Object Model's Runtime Dependency Graph traces back to.
- **No duplicate-execution detection, no cancellation handling** exist anywhere.
- **Cross-process/parallel-execution safety is untested and unexamined** — everything to date is
  single-threaded, single-process; a future concurrent-rule scenario (e.g. two rules both running
  `git fetch` at once) has not been considered in practice, only flagged as an open question.
- **A real, uncorrected asymmetry exists in retry behavior**: the GitHub API's "not ready yet"
  case retries patiently; a raw network exception does not retry at all. Named, not fixed.

---

## Future Extension Points

Consolidated from every document's own "Extension points" sections:

- New rule categories require an explicit runtime-design decision (closed enum today,
  `GOVERNANCE_ENGINE_RUNTIME.md` §10) — not something a rule author adds ad hoc.
- New hook points (before-release, before-workflow-change, etc.) may be added independently of
  each other, per the Roadmap's own Phase E structure.
- New agent roles (Layer 8, if ever built) must be thin wrappers selecting existing Layer 3/4/6
  primitives — never new logic of their own.
- New knowledge-base tiers may be added as long as `SCHEMA.md`'s ownership-map discipline holds
  (one owning file per fact, no duplicate trackers).
- The Rule Registry, once built, is the designed home for every future `RuleDefinition`.
- A `--json` machine-readable output mode is a named, deferred extension point for
  `GOVERNANCE_ENGINE_RUNTIME.md` §19's Rule Execution API, not a rejected one.
- `RollbackContext`'s `override`/`data-undo` behaviors remain unimplemented, speculative
  extension points until a blocking or mutating rule actually needs them.

---

## Architecture Invariants

The frozen set, reproduced from `GOVERNANCE_RUNTIME_LIFECYCLE.md` §10, with each one's actual
current status stated honestly rather than uniformly claimed as upheld:

| Invariant | Status today |
|---|---|
| Every `Check` belongs to exactly one `Rule` | **Upheld** |
| Every `Evidence` has exactly one owner (may be consumed by more than one `Check`) | **Upheld** |
| Reports are immutable after publication | **Vacuously true** — no persisted `Report` object exists yet to violate it (Deferred Finding, above) |
| Neither `Validator` nor any per-execution evidence-sanity-check ever mutates `Evidence` | **Upheld** (trivially, since neither runs today) |
| The runtime never skips Validation | **Currently violated** — `REVIEW-3` shipped without one, by the architecture's own honest admission |
| A `RuleResult` is immutable once produced | **Upheld** |
| Exit code is `0` if and only if every `Check`'s `ok` is `true` | **Upheld** — verified directly against `verifyPushState.ts` |
| Every `Failure`/`Warning` references exactly one `Check` | **Upheld** (though `Failure`/`Warning` as distinct severity-tagged records are not yet built — `REVIEW-3` only distinguishes ok/not-ok) |
| A rule's `rollback_behavior` is fixed at authoring time, does not vary per-execution | **Upheld** |
| `Validator`'s scope excludes per-execution `Evidence` checks (Revision 1) | **Upheld**, newly stated |

---

## Breaking-Change Policy

No prior policy existed for architecture-level changes specifically (as opposed to rule-script
changes, already governed by `RuleVersion`, `GOVERNANCE_ENGINE_RUNTIME.md` §16). Defined here,
grounded in the ADR/Decision Budget policy already established and frozen in
`ARCHITECTURE_CONSTRAINTS.md`:

1. **A change to an object's required fields, an invariant, or a pipeline stage's order** in any
   frozen document is an architecture-level change — evaluate it against the existing 7-question
   ADR checklist first (does it change persistence/API/architecture/Docker/auth/messaging/DB
   engine — none of these currently apply to any Governance Engine document, since all of it is
   developer tooling, not application architecture; re-run the checklist at the time, don't
   assume the answer stays no forever).
2. **Any such change requires an explicit, separate Architecture Review** before implementation,
   mirroring the process this exact freeze followed — never silently edited into a frozen
   document.
3. **Additive changes** (a new object, a new rule category requiring its own new §10 entry, a
   new extension point already named above) do not require a full re-review — they follow the
   same discipline as every other governance rule addition in this platform: one small,
   independently-reversible change, disclosed plainly.
4. **This freeze document itself is superseded, not edited in place**, by any future freeze —
   matching `MILESTONE_HISTORY.md`'s own "archive before overwrite" discipline, reused here
   rather than inventing a different retention policy.

---

## Definition of "Architecture Complete"

Precise, and deliberately narrower than "the runtime is built":

**The architecture is complete, for the purposes of this freeze, when:**
1. Every object, pipeline, and lifecycle stage a `RuleExecution` touches has a stated
   specification (met — `GOVERNANCE_OBJECT_MODEL.md`'s 23 objects, `GOVERNANCE_ENGINE_RUNTIME.md`'s
   20 sections, `GOVERNANCE_RUNTIME_LIFECYCLE.md`'s 12 sections).
2. Cross-document consistency has been independently verified via a formal Architecture Review,
   not just self-declared by whoever wrote the documents (met — two review passes, one BLOCKER
   and two HIGH findings found and resolved).
3. Every gap between "designed" and "real" is named explicitly, not implied to already exist
   (met — every document's own honesty notes, consolidated into "Known Limitations" above).
4. Remaining findings below BLOCKER/HIGH severity are explicitly deferred with a named reason,
   not silently dropped (met — "Deferred Findings" above).

**The architecture is explicitly NOT complete in the sense of:**
- The runtime being implemented — it is almost entirely unimplemented; only `REVIEW-3` exists
  as real code, predating and motivating this entire architecture rather than being produced by
  it.
- Being validated against more than one rule — every document's own stated recommendation to
  revisit after Rules #2 and #3 still stands, unweakened by this freeze.
- Being final — per the Breaking-Change Policy above, this is v1.0, supersedable, not immutable.

**This freeze exists to mark the point past which architecture-level indecision stops and
implementation may begin** — not to claim the design is perfect or complete in any larger sense.

---

## Verification: Every Referenced Document's Existence

Performed after writing, per instruction — direct filesystem check, not assumed:

| Reference | Status |
|---|---|
| `ENGINEERING_PLATFORM_V1.md` | EXISTS |
| `ENGINEERING_PLATFORM_V2.md` | EXISTS |
| `ENGINEERING_PLATFORM_GAP_ANALYSIS.md` | EXISTS |
| `ENGINEERING_EVOLUTION_ROADMAP.md` | EXISTS |
| `ENGINEERING_PLATFORM_BLUEPRINT.md` | EXISTS |
| `GOVERNANCE_ENGINE_DESIGN.md` | EXISTS |
| `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` | EXISTS |
| `GOVERNANCE_ENGINE_RUNTIME.md` | EXISTS |
| `GOVERNANCE_OBJECT_MODEL.md` | EXISTS |
| `GOVERNANCE_RUNTIME_LIFECYCLE.md` | EXISTS |
| `app/scripts/verifyPushState.ts` | EXISTS |
| `.claude/commands/ci-review.md` | EXISTS |
| `PROJECT_KNOWLEDGE_SYSTEM/02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md` | EXISTS |
| `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/MILESTONE_HISTORY.md` (cited for the archival-policy pattern) | EXISTS |
| `.gitignore` (cited for the `.claude/commands/` un-ignore) | EXISTS |

**All 15 referenced paths confirmed present. Zero broken references in this freeze.**

---

*End of freeze document. No architecture document was modified, no runtime code was written, no
ADR was created. Waiting for approval before any runtime implementation begins.*
