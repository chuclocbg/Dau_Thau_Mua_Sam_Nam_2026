# Governance Runtime Lifecycle — Execution Behavior Specification

**Status:** PLANNING ONLY. No source, test, CI, workflow, or governance file was created or
modified. No TypeScript, no interfaces, no commands, no commits. This document specifies HOW the
Governance Engine Runtime behaves; `GOVERNANCE_OBJECT_MODEL.md` already specifies WHAT exists.

---

## Validation Performed Before Writing

Per instruction, checked against `GOVERNANCE_RUNTIME_ARCHITECTURE.md`, `GOVERNANCE_OBJECT_MODEL.md`,
`GOVERNANCE_ENGINE_RUNTIME.md`, and `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md`. Findings, listed
explicitly rather than silently resolved:

1. **`GOVERNANCE_RUNTIME_ARCHITECTURE.md` does not exist** (confirmed via directory listing).
   The document actually titled "Governance Engine Runtime — Architecture" is
   `GOVERNANCE_ENGINE_RUNTIME.md`. This document validates against that file under the
   assumption the reference meant it — flagged, not silently substituted without comment.

2. **Real, unresolved conflict: "Validator Creation" / "Evidence Validation" (this document's
   requested Execution Lifecycle) vs. `Validator`/`ValidationResult` (`GOVERNANCE_OBJECT_MODEL.md`,
   `GOVERNANCE_ENGINE_RUNTIME.md` §5).** The Object Model and Runtime Architecture both define
   `Validator` as validating a **`RuleDefinition`'s well-formedness** — invoked "on-demand, when a
   `RuleDefinition` is authored or edited, not continuously running" (Object Model, `Validator`
   lifecycle). But the Execution Lifecycle this document is asked to specify places "Validator
   Creation" and "Evidence Validation" **inside every single rule execution**, between "Check
   Scheduling" and "Result Aggregation" — i.e., per-run, not per-authoring. These cannot both be
   the same object: either (a) every execution re-validates the rule's own definition (contradicting
   the Object Model's stated on-demand-only lifecycle), or (b) "Evidence Validation" here names a
   **different, currently-undefined concept** — a per-run sanity check on the raw `Evidence`
   gathered during *this* execution (e.g., "did the GitHub API actually return valid JSON"),
   distinct from `Validator`'s rule-definition-level concern. **This document proceeds under
   interpretation (b)** — treating "Evidence Validation" as a new, lighter-weight, per-execution
   concept — because interpretation (a) would require rewriting `Validator`'s lifecycle, which was
   not authorized here. This is a genuine gap the Object Model did not anticipate, named plainly,
   not silently patched into that document.

3. **Minor terminology nuance, not a hard conflict: `Evidence`'s "owner."** The Object Model
   states `Evidence` is "consumed-by one-or-more `Check`s." This document's invariants section
   (§10) states "every `Evidence` has exactly one owner." These are reconcilable — *ownership*
   (which `RuleExecution` captured the evidence, exactly one) is distinct from *consumption*
   (which `Check`s within that same execution read it, possibly more than one) — but the Object
   Model did not draw this distinction explicitly. Resolved here by definition, stated openly.

4. **No conflict, confirmed by re-reading:** the rollback taxonomy (`revert`/`override`/
   `data-undo`, `GOVERNANCE_ENGINE_RUNTIME.md` §7), the failure-severity taxonomy (`block`/`warn`/
   `flag`, §14), and `Report`'s immutability (Object Model) are all reused unchanged below — this
   document adds a failure-*source* taxonomy (git/network/timeout/etc.) as an orthogonal
   dimension, not a replacement for the existing failure-*severity* taxonomy.

5. **No conflict, but a clarification required:** this document's requested state machine
   (`UNINITIALIZED → ... → COMPLETED/FAILED`) is a **different, complementary** state machine from
   `Rule`'s own lifecycle (`designed → implemented → active → deprecated`, `GOVERNANCE_ENGINE_
   RUNTIME.md` §3). The former is the runtime's per-invocation operational state; the latter is a
   rule's slow-moving editorial status. Both are real, both coexist, neither replaces the other.

---

## Revision 1 (Architecture Review Remediation)

A formal Architecture Review of this document returned **NEEDS ARCHITECTURE REVISION**, citing
one BLOCKER and two HIGH findings. This revision resolves exactly those three, minimally, and
nothing else — findings the review classified MEDIUM/LOW (the `git fetch` mutation wording, the
Report-immutability invariant's missing caveat, §3's scattered-vs-unified honesty note, the
Configuration/Git category boundary) are **intentionally untouched**, out of scope for this pass.

1. **BLOCKER resolved:** every reference to "Validator Creation" / "Evidence Validation" below is
   now explicitly marked **Future capability. Not implemented. Out of current runtime scope.**
   and explicitly distinguished from the `Validator`/`ValidationResult` objects
   (`GOVERNANCE_OBJECT_MODEL.md`, `GOVERNANCE_ENGINE_RUNTIME.md` §5 — both now state this
   boundary explicitly too). No new object was formally specified for it; that remains an open
   decision for whenever real implementation need arises, not decided here.
2. **HIGH resolved:** §4 (Event Flow) now opens with an unmissable capability marker instead of
   only an inline honesty note.
3. **HIGH resolved:** `Request` now has a corresponding object in `GOVERNANCE_OBJECT_MODEL.md`;
   §12's mapping table below is updated to reference it instead of "—".

---

## 1. Runtime Startup Sequence

**Honesty note up front:** almost none of this section describes real, existing behavior.
`verifyPushState.ts` has no registry, no discovery, no dependency resolution — it *is* the one
rule it implements, invoked directly. This section specifies the *designed* startup sequence a
real registry-backed runtime would need; every stage below is marked accordingly.

- **Initialization** — the runtime process starts, triggered by a `Command` invocation or a
  dogfood run. *Real today*: this is just `node`/`tsx` starting the script.
- **Configuration loading** — reading Governance Engine–wide settings distinct from any single
  rule's `ExecutionContext`: the Decision Budget thresholds and ADR checklist (both now in
  `ARCHITECTURE_CONSTRAINTS.md`), and — once it exists — the Rule Registry's location. *Not real
  today*: `verifyPushState.ts` reads none of this; its behavior is fully hardcoded to `REVIEW-3`'s
  own logic.
- **Rule discovery** — scanning `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/`
  (`GOVERNANCE_ENGINE_RUNTIME.md` §2) for available `RuleDefinition`s. *Not real today*: that
  directory does not exist; there is nothing to discover, only one hardcoded script.
  Gap, named honestly.
- **Dependency validation** — checking a selected rule's `dependencies` (§8 of the Runtime
  Architecture) are satisfied before allowing execution (e.g. refusing to run `ARCH-1` until its
  named prerequisite, the structured frozen-path list, exists). *Not real today*: no dependency
  graph exists to check against.
- **Runtime readiness** — the point at which the runtime accepts a `Request`. *Real today*, but
  trivial: readiness is just "Node.js started successfully" — no formal readiness check, no
  distinct `READY` state is actually observed by anything.

---

## 2. Execution Lifecycle

`Request → ExecutionContext → Rule Selection → Validator Creation → Check Scheduling → Evidence
Collection → Evidence Validation → Result Aggregation → Report Generation → Exit`

Mapped stage-by-stage against `verifyPushState.ts`'s real code:

| Stage | Real today? | Evidence |
|---|---|---|
| Request | **Real** | A human/AI runs `npx tsx app/scripts/verifyPushState.ts` (or the `/ci-review` command) |
| ExecutionContext | **Real**, but not reified as an object | `main()`'s opening calls: `currentBranch()`, `ownerRepoFromRemote()`, `sh('git rev-parse HEAD')` |
| Rule Selection | **Vacuous** | There is exactly one rule; "selection" performs no real choice. Becomes real only once the Rule Registry exists (§1) |
| Validator Creation | **Future capability. Not implemented. Out of current runtime scope.** | Does **not** instantiate the Object Model's `Validator` (that object is scoped to `RuleDefinition` well-formedness, checked on-demand at authoring time — see `GOVERNANCE_OBJECT_MODEL.md`'s `Validator` entry). This stage name refers to a distinct, currently-undefined, per-execution concept with no formal specification yet. |
| Check Scheduling | **Real, but not a scheduler** | The three checks run in a fixed, hardcoded sequential order in source code — not dynamically scheduled, prioritized, or parallelized |
| Evidence Collection | **Real, but inlined** | Happens *inside* each check function (`sh()`/`fetch()` calls) — `Evidence` is not separated from `Check` logic in the real code the way the Object Model's schema implies |
| Evidence Validation | **Future capability. Not implemented. Out of current runtime scope.** | Same undefined concept as "Validator Creation" above, not `Validator`. No sanity check exists today on raw evidence before it's trusted — a malformed API response would propagate into an incorrect `Check` result or an uncaught exception, not a graceful validation failure. |
| Result Aggregation | **Real** | `const allOk = results.every(r => r.ok)` |
| Report Generation | **Real, but ephemeral** | `console.log` statements throughout `main()` — not a durable artifact (the same gap `GOVERNANCE_ENGINE_RUNTIME.md` §6 already names) |
| Exit | **Real** | `process.exit(allOk ? 0 : 1)` |

**Summary, stated plainly:** roughly half this pipeline (Request, ExecutionContext, Evidence
Collection, Result Aggregation, Exit) is real today; the other half (Rule Selection, Validator
Creation, real Check Scheduling, Evidence Validation, durable Report Generation) is designed but
not implemented.

---

## 3. State Machine

Distinct from `Rule`'s own lifecycle (Validation Finding 5, above) — this is the runtime's
per-invocation operational state:

```
UNINITIALIZED
     │ (process starts)
     ▼
INITIALIZING            -- §1: config loading, rule discovery, dependency validation
     │ (startup checks pass)
     ▼
READY                   -- real today only in the trivial sense of "process alive"
     │ (a Request arrives)
     ▼
RUNNING
     │ (ExecutionContext constructed, Rule selected)
     ▼
COLLECTING_EVIDENCE      -- real: git/API calls happen here; includes the one real retry
     │                      loop (pollWorkflowRun's bounded polling)
     ▼
VALIDATING               -- FUTURE CAPABILITY, NOT IMPLEMENTED (§2). Not the Validator object
     │                      (GOVERNANCE_OBJECT_MODEL.md) -- that validates RuleDefinitions
     │                      on-demand at authoring time, not per-execution Evidence.
     ▼
REPORTING                -- real (console output); durable-report extension is designed,
     │                      not built
     ▼
COMPLETED  ────────────────────────────┐
                                        │
     (any state) ── unrecoverable ──►  FAILED
                     error
```

**Transition conditions:**
- `UNINITIALIZED → INITIALIZING`: process start.
- `INITIALIZING → READY`: all startup checks (§1) pass. *Real today*: this is unconditional,
  since no real startup checks exist yet to fail.
- `READY → RUNNING`: a `Request` arrives.
- `RUNNING → COLLECTING_EVIDENCE`: `ExecutionContext` constructed and a `Rule` selected.
- `COLLECTING_EVIDENCE → VALIDATING`: all scheduled `Check`s have gathered their `Evidence`.
- `VALIDATING → REPORTING`: evidence sanity-checked (or, today, this transition is skipped
  outright — there is no real `VALIDATING` state to occupy).
- `REPORTING → COMPLETED`: report emitted (console today; durable log once §6 of the Runtime
  Architecture is built).

**Failure transitions:** any state may transition directly to `FAILED` on an unrecoverable error.
*Real today*: exactly one such path exists — `verifyPushState.ts`'s top-level
`main().catch(err => { ...; process.exit(1) })`, which can fire from anywhere inside
`COLLECTING_EVIDENCE` (an uncaught `git`/`fetch` exception) and jumps straight to `FAILED`,
skipping `VALIDATING`/`REPORTING` entirely — there is no real report generated on an uncaught
exception today, only a bare error line. Named as a real, current gap.

**Retry transitions:** the *only* real retry today is a self-loop *within*
`COLLECTING_EVIDENCE` — `pollWorkflowRun`'s bounded loop (up to 40 attempts, 15s apart) re-enters
its own polling logic without changing top-level state. No transition returns the runtime from a
*later* state (`VALIDATING`, `REPORTING`) back to an *earlier* one — once evidence collection
concludes, there is no real backward path.

---

## 4. Event Flow

> **FUTURE CAPABILITY. NOT IMPLEMENTED. OUT OF CURRENT RUNTIME SCOPE.**
> No event, event bus, `EventEmitter`, or pub/sub mechanism exists anywhere in this platform
> today. `verifyPushState.ts` is a plain procedural script with zero discrete event objects.
> Every row below is a **speculative sketch**, not a specification ready to implement — per the
> Architecture Review (HIGH finding), do not build this table's contents as literal
> infrastructure. Revisit only once a second rule or a real consumer needs to react to another
> rule's outcome independently of console output; several rows below (`CheckStarted`,
> `RuntimeCompleted`, `RuntimeFailed`) have no designed consumer even in this sketch, which is
> itself evidence this section is ahead of real, evidenced need.

Every event below is mapped to the closest real analogue (usually a `console.log` line,
sometimes nothing at all) so the gap is honest rather than implied to already exist.

| Event | Producer | Consumer (designed) | Payload | Real analogue today |
|---|---|---|---|---|
| `RuntimeStarted` | Runtime | Reporting Pipeline | `{timestamp}` | None — process just starts |
| `RuleLoaded` | Rule Registry | Execution Pipeline | `RuleDefinition` | None — the rule is hardcoded, never "loaded" |
| `RuleStarted` | Execution Pipeline | Reporting Pipeline | `{rule_id, execution_context}` | `console.log('=== verifyPushState: ...')` |
| `CheckStarted` | Execution Pipeline | (none today) | `{check_name}` | **None** — no per-check start is logged, only the result |
| `EvidenceCollected` | a `Check` | Evidence Validation (designed) | `Evidence` | Implicit — the `sh()`/`fetch()` call returning, never logged as a distinct fact |
| `EvidenceValidated` | Evidence Validation (designed) | Result Aggregation | `ValidationResult`-shaped outcome | **None** — this stage doesn't exist |
| `RuleSucceeded` | Result Aggregation | Reporting Pipeline, Rollback Pipeline | `RuleResult` | `console.log('=== VERDICT: ALL CHECKS PASSED ===')` + `process.exit(0)` |
| `RuleFailed` | Result Aggregation | Reporting Pipeline, Rollback Pipeline | `RuleResult` | `console.log('=== VERDICT: FAILED ...')` + `process.exit(1)` |
| `ReportCreated` | Reporting Pipeline | Knowledge System (future) | `Report` | The `console.log` calls themselves, ephemeral, not "created" as a durable artifact |
| `RuntimeCompleted` | Runtime | (none today) | `{exit_code}` | `process.exit(allOk ? 0 : 1)` |
| `RuntimeFailed` | Runtime | (none today) | `{error}` | `main().catch(err => {...; process.exit(1)})` |

**Ordering guarantees:** today, trivially total — Node.js is single-threaded, every step is
synchronously sequenced or explicitly `await`-ed, so the same sequence of operations happens
identically on every run (no concurrency, no ordering ambiguity to guarantee against). This is a
real, positive property, not a designed aspiration — but it holds *because* nothing is
parallelized yet (§9), not because of any explicit ordering mechanism.

---

## 5. Evidence Lifecycle

`Evidence → Validation → Normalization → Aggregation → Storage → Expiration → Archive`

**Conflict restated from the Validation section:** the Object Model states `Evidence` is "not
independently persisted beyond `Report`" — implying no separate storage lifecycle exists. This
section's `Storage`/`Expiration`/`Archive` stages are therefore **entirely aspirational**,
blocked on the same gap the Object Model's own Runtime Dependency Graph already identified as
the platform's actual critical path: `Report` becoming a durable log instead of console-only
output. Until then, `Evidence`'s real lifecycle is simply: **captured → consumed by one `Check`
→ discarded** (never stored, never expires, nothing to archive).

**Ownership, stage by stage (designed):**
- `Evidence` (capture) — owned by the rule's own `Check` logic (rule-specific, per Object Model).
- `Validation` (per-execution sanity — the same future capability as §2/§3's "Evidence
  Validation," explicitly not the `Validator` object) — owned by the Execution Pipeline
  (generic, reusable), if and when it is ever specified and built.
- `Normalization` — owned by the Execution Pipeline (e.g. converting a raw git timestamp and a
  raw API timestamp into one comparable format) — **not real today**: `verifyPushState.ts` uses
  each source's raw format as-is, no normalization step exists.
- `Aggregation` — owned by Result Aggregation (real today, informally — the `results` array).
- `Storage`/`Expiration`/`Archive` — owned by the Reporting Pipeline, entirely blocked on §6 of
  the Runtime Architecture, not built.

---

## 6. Failure Model

Failure **source** categories (orthogonal to the existing `block`/`warn`/`flag` **severity**
taxonomy, §14 of the Runtime Architecture — every row below states which severity would apply).
Grounded in `verifyPushState.ts`'s real, verifiable behavior wherever it exists:

| Category | Retry? | Rollback? | Report? | Continue? | Fail-fast? | Real evidence |
|---|---|---|---|---|---|---|
| **Configuration** (e.g. unparseable git remote) | No — retrying won't fix malformed config | N/A, nothing executed yet | Yes | No | **Yes** | `ownerRepoFromRemote()` throws immediately if its regex doesn't match; propagates uncaught |
| **Rule** (a `Check`'s own logic has a defect) | No | Per that rule's `rollback_behavior` | Yes | No, for that check | For that rule only | Speculative — no real defect has occurred in `REVIEW-3` yet |
| **Validator** (the not-yet-built rule-definition validator fails) | No | N/A | Yes | Arguably yes — shouldn't block the rule's own execution, only block *authoring* a new/edited rule | No | Entirely speculative, `Validator` doesn't exist |
| **Filesystem** (e.g. `.github/workflows/ci.yml` missing) | No | N/A | Yes, as a degraded-capability note | **Yes** | **No** | Real: `findMaskedStepNames()` uses `existsSync` and returns an empty `Set` rather than throwing — a genuine graceful-degradation case, verified by reading the actual code |
| **Git** (e.g. `git rev-parse` fails outside a repo) | No — rarely transient | N/A | Yes | No | **Yes** | Real: `sh()` uses `execSync`, which throws on non-zero exit; nothing inside the check functions catches it |
| **GitHub API — hard error** (non-2xx response) | No | N/A | Yes | No | Yes | Real: `pollWorkflowRun` checks `runsRes.ok` and returns a failed `CheckResult` immediately, not via exception |
| **GitHub API — not ready yet** (run not found / still `in_progress`) | **Yes**, up to 40 attempts | N/A | Only the final outcome | Yes, within the retry loop | No — deliberately patient | Real: the core, working retry logic in `pollWorkflowRun` |
| **Network** (e.g. `fetch` itself throws, no connectivity) | No — no retry-on-network-error exists today | N/A | Yes, via the top-level catch | No | **Yes** | Real gap: unlike the "not ready yet" case, a raw network exception is not distinguished or retried, it propagates to `main().catch()` |
| **Timeout** (40 attempts exhausted) | No further retry — already exhausted | N/A | Yes, explicit "Timed out" detail | No, verdict becomes failed | No — bounded, patient wait first | Real: `pollWorkflowRun`'s final fallback return |
| **Unexpected exception** (anything else uncaught) | No | N/A | Yes, bare error message | No | **Yes** | Real: `main().catch(err => {...; process.exit(1)})` |

**Notable, honest gap surfaced by this table:** network errors and "not-ready-yet" API responses
are currently handled with *different* rigor (the latter retries patiently, the former doesn't
retry at all) despite both being plausibly-transient conditions. This asymmetry was not a
deliberate design decision recorded anywhere — it is simply what the code happens to do. Named
here as a candidate improvement, not implemented.

---

## 7. Retry Strategy

- **Retry limits:** real today = 40 attempts, but *only* for the GitHub Actions "not found /
  still running" case inside `pollWorkflowRun`. No other failure category retries at all (§6).
- **Exponential backoff:** **not implemented.** Real behavior is a fixed 15-second interval
  (`intervalMs = 15000`), not exponential. Assessed here, not just noted: this is a reasonable
  simplification, not a defect — GitHub Actions runs complete in a roughly known, bounded window
  (this session's own runs: ~3–8 minutes), so backoff's main benefit (protecting a struggling
  service under unpredictable load) doesn't clearly apply to polling one's own, already-committed
  workflow run.
- **Idempotency:** every retry is safe to repeat without side effects — `REVIEW-3`'s checks are
  entirely read-only (`git rev-parse`, `git status`, `git fetch` [safe, no local mutation], GET
  requests to the GitHub API). This is a genuine, real, positive property, not aspirational.
- **Duplicate detection:** **not implemented.** Nothing prevents two concurrent invocations of
  `verifyPushState.ts` running simultaneously; nothing checks for an already-in-flight execution
  before starting a new one. Named gap, not a current problem given single-developer,
  single-session usage, but a real gap nonetheless.
- **Cancellation:** **not implemented.** No `SIGINT`/`SIGTERM` handling exists; a user pressing
  Ctrl+C during the 40-attempt poll simply kills the Node process abruptly — no graceful
  in-flight-check cleanup, no partial report emitted.

---

## 8. Rollback Model

Reuses `GOVERNANCE_ENGINE_RUNTIME.md` §7's taxonomy exactly — `revert` / `override` / `data-undo`
— no new taxonomy introduced.

**What can be rolled back:** a rule's own *implementation* (its script and command-adapter files)
— always, via `git revert <rule's implementation commit>`. `REVIEW-3` is fully in this category.

**What cannot be rolled back:** a specific *past* `RuleExecution`'s `RuleResult`/`Report`. Per the
Object Model, these are immutable and append-only — you cannot erase the historical fact that a
check failed at a point in time, only supersede it with a later, passing execution. "Rolling
back" a bad result means re-running the rule after fixing the underlying problem, not editing
history.

**When rollback is automatic:** **never, today.** No auto-rollback mechanism exists anywhere in
this platform — every rollback so far (and every one designed) is a human-initiated `git revert`.

**When rollback is forbidden:** speculative, since no `override`-category rule exists yet — the
principle, stated for when one does: reverting a rule that is the *sole* safeguard against a
known-dangerous action (e.g. a future frozen-path guard) should be forbidden without an
explicit, equally-documented replacement safeguard in the same change — reverting the check must
never silently remove the protection it existed for.

---

## 9. Parallelism Model

**Real today: fully sequential, single-threaded, single Node.js process.**
`checkHeadMatchesOrigin()` and `checkWorkingTreeClean()` run one after the other synchronously;
`pollWorkflowRun()` is `await`-ed, blocking `main()`'s continuation until it resolves. Nothing
runs concurrently.

- **Sequential operations (all of them, today):** every check in `verifyPushState.ts`.
- **Parallel-safe operations, not yet exploited:** `checkHeadMatchesOrigin()` and
  `checkWorkingTreeClean()` are mutually independent (neither reads the other's result) and could
  safely run via `Promise.all` without correctness risk. Not implemented, because it wouldn't
  meaningfully help — the CI poll dominates wall-clock time (minutes) versus these two checks
  (milliseconds), so the optimization has no real payoff yet.
- **Synchronization points:** exactly one real join point today — awaiting `pollWorkflowRun()`
  before Result Aggregation can proceed.
- **Deterministic ordering:** guaranteed today, but *because* nothing is parallel, not via any
  explicit ordering mechanism — the `results` array is always built in the same source-code order
  every run.
- **Thread-safety assumptions:** not a real concern today (Node.js is single-threaded for JS
  execution; no worker threads are used). Becomes a real, **currently unexamined** question only
  if a future Workflow Platform runs multiple `RuleExecution`s concurrently as separate processes
  — e.g., two rules both running `git fetch` against the same working tree at once. Named as an
  open question for future parallel-rule execution, not a solved problem, and not to be assumed
  safe without testing when that day comes.

---

## 10. Runtime Invariants

- Every `Check` belongs to exactly one `Rule` (Object Model, confirmed, unchanged).
- Every `Evidence` has exactly one **owner** (the `RuleExecution` that captured it), though it
  may be **consumed** by more than one `Check` within that same execution — the ownership/
  consumption distinction drawn in Validation Finding 3, stated here as the resolved invariant.
- Reports are immutable after publication (Object Model, confirmed, unchanged).
- Neither `Validator` nor any per-execution evidence-sanity-check ever mutates `Evidence` —
  validation produces a verdict, never alters what it examined. Written to cover both
  interpretations left open by Validation Finding 2, since which mechanism ultimately performs
  "Evidence Validation" is not yet decided.
- **The runtime does not currently uphold "never skips Validation."** Stated as an honest,
  present-tense admission, not a future guarantee: `REVIEW-3` was implemented, verified, and
  shipped without ever passing through a formal `Validator`, because none exists
  (`GOVERNANCE_ENGINE_RUNTIME.md` §5 states this plainly already). This invariant is aspirational
  until §5's validation pipeline is actually built.
- A `RuleResult` is immutable once produced (Object Model, confirmed).
- Exit code is `0` if and only if every `Check`'s `ok` is `true` — real, verified directly against
  `verifyPushState.ts`'s `allOk = results.every(r => r.ok)` / `process.exit(allOk ? 0 : 1)`.
- Every `Failure`/`Warning` references exactly one `Check` (Object Model, confirmed).
- A rule's `rollback_behavior` is fixed at `RuleDefinition` authoring time and does not vary
  per-execution.

---

## 11. Lifecycle Diagrams (text only)

**Startup:**
```
UNINITIALIZED -> INITIALIZING -> READY
   (process       (config load,    (accepting
    starts)        rule discovery,  Requests --
                    dependency       trivial today,
                    validation --    no real gate
                    none of this     exists)
                    is real today)
```

**Execution (the real path, today):**
```
Request -> ExecutionContext -> [Rule Selection: vacuous, 1 rule]
   -> Check Scheduling (fixed source order)
      -> checkHeadMatchesOrigin()  --\
      -> checkWorkingTreeClean()   ---> Evidence Collection (inline per check)
      -> pollWorkflowRun()         --/     (retry loop lives here)
   -> Result Aggregation (allOk = every check ok)
   -> Report Generation (console.log, ephemeral)
   -> Exit (process.exit(0|1))
```

**Failure (the real path, today):**
```
[any check throws, or execSync/fetch fails uncaught]
   -> propagates past every intermediate stage
   -> main().catch(err => ...)
   -> console.error (bare message, NOT a full Report)
   -> process.exit(1)

Note: this path skips Evidence Validation and Report Generation's normal
shape entirely -- a real, current gap, not a designed behavior.
```

**Retry (the real path, today -- exists only inside Evidence Collection):**
```
pollWorkflowRun(attempt=1) -> not ready -> wait 15s -> attempt=2 -> ...
   -> up to attempt=40 -> [ready: return real result] or [exhausted: return timeout Failure]

No retry exists anywhere outside this one loop.
```

**Rollback (fully manual, today and for the foreseeable future):**
```
[a human decides a rule implementation is wrong]
   -> git revert <implementation commit>
   -> push
   -> (no automated trigger initiates this sequence)
```

**Shutdown:**
```
[Exit reached, or FAILED reached]
   -> process.exit(code)
   -> (no graceful-shutdown hooks exist -- e.g. no flush of an
       in-flight Report to durable storage, since none exists yet)
```

---

## 12. Mapping

| Lifecycle stage | Governance Object Model | Governance Engine Runtime (Architecture) | REVIEW-3 implementation | `verifyPushState.ts` line-level evidence |
|---|---|---|---|---|
| Request | `Request` object (added, Revision 1) | §4 "trigger" (same concept, different name — cross-referenced in `Request`'s entry) | The `/ci-review` command / direct `npx tsx` invocation | N/A (external to the file) |
| ExecutionContext | `ExecutionContext` object | §1 metadata's implicit inputs | The opening of `main()` | `currentBranch()`, `ownerRepoFromRemote()`, `sh('git rev-parse HEAD')` |
| Rule Selection | `Rule`, `RuleDefinition` | §2 Rule Registry (not built) | Hardcoded — one script, one rule | N/A — no selection logic exists |
| Validator Creation | **Not `Validator`** — future capability, no object defined (Object Model's `Validator` entry now states this boundary explicitly, Revision 1) | §5 (explicitly "not built now"; scope boundary added, Revision 1) | Does not exist | N/A |
| Check Scheduling | `Check` | §4's pipeline shape | Fixed source-code order | `main()`'s linear call sequence |
| Evidence Collection | `Evidence` | §4 "run script" | Inline per check function | `sh()` calls, `fetch()` calls |
| Evidence Validation | Same future capability as "Validator Creation" above — not in Object Model, by design, until real need arises | Not addressed | Does not exist | N/A |
| Result Aggregation | `RuleResult` | §4 "capture `CheckResult[]`... classify" | `results` array + `allOk` | `const allOk = results.every(r => r.ok)` |
| Report Generation | `Report` | §6 (console-only today, durable-log designed) | `console.log` calls | Every `console.log` in `main()` |
| Exit | — | §19 Rule Execution API (exit-code contract) | `process.exit()` | `process.exit(allOk ? 0 : 1)` |

**Gaps identified honestly, consolidated:** Rule Registry, Validator, per-execution Evidence
Validation, Evidence normalization/storage/expiration/archive, durable Report, event emission (all
of §4), duplicate-execution detection, and cancellation handling are every one of them **designed
here, not implemented anywhere.** The only genuinely real, load-bearing retry/resilience logic in
the entire platform today is `pollWorkflowRun`'s bounded polling loop inside one script.

---

*End of lifecycle specification. Per instruction, nothing was implemented: no TypeScript, no
interfaces, no commands, no source, test, CI, workflow, or governance file was created or
modified, and no commit was made. The original Validation Performed section's three findings were
surfaced and left unresolved on first writing; Revision 1 above resolves the BLOCKER and both HIGH
findings a subsequent Architecture Review identified, minimally and without expanding scope. The
remaining MEDIUM/LOW findings from that review are intentionally untouched. Waiting for approval
before implementing any runtime component.*
