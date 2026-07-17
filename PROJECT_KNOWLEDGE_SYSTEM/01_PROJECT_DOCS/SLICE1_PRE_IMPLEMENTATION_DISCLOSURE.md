# Runtime Contract Iteration 2 — Slice 1 — Pre-Implementation Disclosure

**Status:** PLANNING ONLY. No code, no repository modification besides this one document. No ADR.
No Runtime Contract created or amended. No reportable-execution semantic chosen or recommended.
Presented for approval before any file named below is touched, per `GOVERNANCE_VERTICAL_SLICE_
TEMPLATE.md` / Playbook Part 4's mandatory pre-implementation disclosure gate.

**Repository verification performed before drafting this document:** HEAD (`58fd70a`) in sync
with `origin/develop`; no staged changes exist; all six required sources exist at their real
paths and are committed (`GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md` at `40d8e98`,
`RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md` at `02f4c9b`, `RUNTIME_CAPABILITY_SURFACE_SELECTION.md` at
`58fd70a`, `IMPLEMENTATION_SLICE_01.md` at `e309096`, `governance-rules/REGISTRY.md` at `9933e45`,
`RULE_DEFINITION_FORMAT.md` at `373d0a3`); `REGISTRY.md` still lists exactly one rule (`REVIEW-3`).
No discrepancy found.

---

# Objective

Implement the capability surface selected, without recommendation of any semantic, by
`RUNTIME_CAPABILITY_SURFACE_SELECTION.md`: **Surface C, a separate diagnostic artifact.** This
slice makes the three raw reportable-execution signals durably observable across real, organic
invocations of `verifyPushState.ts`, closing the specific gap `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`
identified — that no observable signal currently exists anywhere in the runtime for any of the
three candidate reportable-execution semantics to eventually be evaluated against.

---

# Runtime capability being implemented

A new, append-only diagnostic artifact, fully decoupled from `REVIEW_LOG.md` and the Contract
Phase 3 `Report` artifact, that gains one entry per real `verifyPushState.ts` invocation. Each
entry records three raw, already-computable facts about that invocation:

1. The invocation's `triggeredBy` value (already constructed as part of `RuleExecution`).
2. Whether this execution's Check-verdict content differs from the immediately preceding
   `REVIEW-3` entry in `REVIEW_LOG.md` — a boolean observation, not an algorithm specification.
3. Whether an explicit, currently-nonexistent, optional CLI signal was passed at invocation — a
   boolean observation of caller intent, present or absent.

None of the three is used to decide anything. `writeReport()` continues to run unconditionally,
exactly as it does today; the existing three Checks, the exit code, and `REVIEW_LOG.md`'s content
and append behavior are all unaffected. This capability computes and exposes facts; it makes no
claim about which of those facts should someday govern reportability, and no such claim is made,
implied, or scored by anything in this document.

---

# Slice boundary

**Inputs:** `RUNTIME_CAPABILITY_SURFACE_SELECTION.md`'s Slice Boundary section (Surface C);
`RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s three raw signal definitions; `GOVERNANCE_RUNTIME_
IMPLEMENTATION_CONTRACT.md` §3 (Forbidden Files), §5 (Runtime Invariants), and §8 (Rollback
Procedure) as binding constraints.

**Outputs:**
- One new function, `writeSignalRecord()`, added to `app/scripts/lib/governanceRuntime.ts` — the
  file Contract Phase 1 created to hold the Reusable Runtime's shared pieces. Adding to it now is
  this slice's own placement choice, not a use of Contract authority: this slice sits entirely
  outside the Contract's five-phase Implementation Order table (see Explicit non-goals, below),
  and this placement is not asserted as precedent for any future non-Contract-authorized addition.
  The new function is structurally modeled on `writeReport()`'s own append-only, never-overwrite
  behavior, but targets a distinct file.
- One new file, `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REPORTABLE_EXECUTION_SIGNALS.md` —
  decoupled from `REVIEW_LOG.md`, in the same directory Product Spec designates for durable
  project-memory logs, named to match the existing `REPORTABLE_EXECUTION_*` document series this
  decision process has already established.
- `verifyPushState.ts`'s `main()` computes the three signals and calls `writeSignalRecord()` once,
  additively, alongside (not instead of) the existing unconditional `writeReport()` call.

**Files allowed to change:**
- `app/scripts/lib/governanceRuntime.ts` (new function only — additive).
- `app/scripts/verifyPushState.ts` (add signal computation and one new call in `main()` — additive
  only; the three existing Checks' own logic is not touched).
- `PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REPORTABLE_EXECUTION_SIGNALS.md` (new file).

Three files total — within the Decision Budget threshold this platform's own documents use.

**Files forbidden to change:** every entry in Contract §3's global forbidden list (`app/src/`,
every test directory, `.github/workflows/ci.yml`, `app/package.json`/`app/package-lock.json`,
`prisma/schema.prisma` and its migrations, all 10 frozen architecture documents, `CURRENT_
MILESTONE.md`'s `do_not` list, `.claude/commands/ci-review.md`); plus, specific to this slice,
`PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REVIEW_LOG.md` itself (this slice's entire value
depends on leaving it untouched), `app/scripts/validateGovernanceRule.ts`, and `governance-rules/
REGISTRY.md`/`REVIEW-3.md` (no rule content changes in this slice).

**Verification commands:**
1. `npx tsc -b` — zero new errors attributable to the files this slice touches.
2. Architecture guard suite — must remain exactly as green as the pre-slice baseline.
3. Full test suite — must remain unaffected.
4. A direct run of `verifyPushState.ts` against real repository state, twice, confirming
   `REPORTABLE_EXECUTION_SIGNALS.md` gains a second, distinct entry rather than overwriting the
   first (the non-vacuous append-only check, matching Contract Phase 3's own precedent exactly).
5. A parity check: `REVIEW_LOG.md`'s content and append behavior, and the three existing Checks'
   PASS/FAIL verdicts and the script's exit code, confirmed byte-for-byte unchanged before and
   after this slice, proving the capability is purely additive.
6. `git status --porcelain` — confirms only the three declared files changed.

**Rollback:** `git revert` of this slice's single commit — the `revert` category per Contract §8,
since every change is new and purely additive; nothing pre-existing is modified, and no downstream
consumer depends on the new artifact yet. No rollback drill is required against `REVIEW_LOG.md`,
since it is never touched by this slice.

**Exit condition:** `REPORTABLE_EXECUTION_SIGNALS.md` exists and gains one entry per real
invocation, carrying the three raw signals, with `REVIEW_LOG.md` and the existing three Checks
provably byte-for-byte unaffected. At that point, a future Decision Matrix re-scoring can cite
real, accumulated data for Auditability and Runtime observability instead of "Insufficient
evidence" — satisfying `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s own stated Exit Condition for the
first time. No semantic becomes chosen, recommended, or implied by reaching this exit condition.

---

# Risks

- **Shared-module surface growth with no second consumer yet.** Adding `writeSignalRecord()` to
  `governanceRuntime.ts` before a second governance rule exists is a mild echo of Playbook Anti-
  pattern #9 (premature generalization). Mitigated: the function is trivial and additive; placing
  it in the file Contract Phase 1 already established for shared pieces avoids creating a fourth
  file for a one-function addition, though this placement is a choice made by this slice, not an
  exercise of Contract authority (this slice sits outside the Contract's Implementation Order
  table, per Explicit non-goals) — not a new abstraction invented ahead of need.
- **New read dependency on `REVIEW_LOG.md`.** Signal 2 requires reading a file that is currently
  write-only from code (no reader exists anywhere in the repository today). This introduces a new
  failure mode — a missing or malformed `REVIEW_LOG.md` — that did not previously exist for
  `verifyPushState.ts`. Not resolved by this disclosure; the implementation must handle it, and
  verification command 5 above is the check that would catch a regression here.
- **Wiring into an already-shipped, working file.** `verifyPushState.ts`'s `main()` already has a
  parity-preservation history (Contract Phase 1's own byte-for-byte requirement). Any mistake in
  adding the new signal computation risks incidentally affecting the three existing Checks or the
  exit code. Mitigated by verification command 5's explicit parity check.
- **Misreadability of the new artifact.** Because every invocation is recorded unconditionally,
  with no semantic gating, a future reader could mistake the new file's raw signal data for an
  already-made classification decision. This is a documentation risk for the new file's own
  header text at implementation time, not resolved here.

---

# Explicit non-goals

- **No semantic selection.** None of trigger-based, content-based, or explicit-intent-based
  reportable-execution semantics is chosen, favored, or implied by this slice or this document.
- **No Runtime Contract changes.** `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md` is not amended,
  extended, or reinterpreted; this slice operates entirely outside its five-phase Implementation
  Order table, consistent with `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s own status as
  Playbook/Product-Spec-adjacent, non-Contract-authorized work.
- **No governance-rule changes.** `REVIEW-3.md` is not modified; its `RuleDefinition` is untouched.
- **No new registry rule.** `governance-rules/REGISTRY.md` is not modified; it continues to list
  exactly one rule.
- **No report classification.** `writeReport()`'s unconditional-write behavior is not changed,
  gated, or suppressed by this slice — it continues to run exactly as it does today.
- **No implementation beyond this capability surface.** No candidate semantic's classification
  logic, no Decision Matrix re-scoring, and no future rule content is implemented here.

---

# READY FOR IMPLEMENTATION

Justification: all six required sources are verified committed and consistent; HEAD is in sync
with `origin/develop` with no staged changes; the prior GitHub Actions run succeeded; the slice
boundary is fully specified (exact files, exact new artifact, exact verification, exact rollback)
with no open design question blocking it — unlike Candidate 2's semantic fix, this capability
requires no unresolved decision, only additive plumbing already scoped by `RUNTIME_CAPABILITY_
SURFACE_SELECTION.md`. Nothing in Contract §9's Stop Conditions is currently triggered.

---

*End of disclosure. No repository file was modified besides this one document. No code was
written. No semantic was chosen. No ADR was written. No Runtime Contract was created or amended.
Exactly one markdown file was written.*
