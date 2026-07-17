# Runtime Capability Bootstrap Plan

**Status:** PLANNING ONLY. No code, no repository modification besides this one document. No ADR.
No Runtime Contract created. The Decision branch (which semantic — trigger-based, content-based,
or explicit-intent-based) is closed and not reopened here. This document identifies only the
minimum runtime capability required before any semantic decision could ever become observable.

---

# Objective

The blocked Decision Matrix rows (Auditability; Runtime observability; Determinism for
explicit-intent-based) share one root cause: no observable signal exists anywhere in the runtime
today that reflects what any of the three candidate semantics would classify a real invocation as.
`Report`'s persisted shape has three fields (`sourceId`, `content`, `createdAt`) and no existing
`REVIEW_LOG.md` entry carries any classification-relevant data. The missing capability is not a
semantic decision — it is the absence of any observable signal to decide *between*. Until raw
signal data exists somewhere a reviewer can inspect, no amount of additional repository research
can fill those Decision Matrix cells, because the fact being asked about does not yet exist to
observe.

---

# Smallest observable capability

A semantic-neutral **signal recorder**: for each real invocation, compute and expose the three raw
values each candidate's own definition depends on, without gating anything on them:

1. The invocation's existing `triggeredBy` value — already computed at `verifyPushState.ts:139`,
   currently surfaced only in one ephemeral console line, never persisted.
2. A single boolean: whether this execution's result content differs from the immediately
   preceding `REVIEW-3` entry in `REVIEW_LOG.md` — a pure read-and-compare, computed fresh each
   run, never used to decide whether the write happens.
3. A single boolean: whether an explicit, currently-nonexistent, optional CLI flag was passed at
   invocation — plumbing only; its presence is recorded, never acted upon.

Critically, none of the three signals changes whether `writeReport()` is called, when it is
called, or what the existing three Checks decide. The already-shipped, already-verified
unconditional-append behavior from Contract Phase 3 is preserved exactly. This is the smallest
change that converts "Insufficient evidence" into observable, evidence-bearing data for
Auditability and Runtime observability — and partially for Determinism, since a flag's mere
presence-or-absence is trivially deterministic given the invocation alone, independent of what (if
anything) is ever done with that flag later. This symmetry is not perfectly even at the
implementation level: signal 1 requires zero new logic (already computed), signal 3 requires only
trivial CLI-argument plumbing, but signal 2 requires building a `REVIEW_LOG.md` reader/comparator
that does not exist anywhere in the repository today (Evidence item 3). Building that reader is
observation, not interpretation — it computes a fact, gates nothing — but it is also substantially
the same mechanism content-based semantics would itself need. This plan does not treat that as
disqualifying, but it is disclosed here rather than left implicit, since building signal 2 does
more of one candidate's eventual implementation work as an observational side effect than building
signals 1 or 3 does for the other two.

---

# Candidate implementations

Listed, not chosen:

- **Surface A — console-only diagnostic.** Print the three raw signal values as one additional
  line in `verifyPushState.ts`'s existing console output. Zero persistence change, zero schema
  change, purely ephemeral.
- **Surface B — extend `Report.content`.** Append the three raw signal values as additional text
  inside the already-free-form `content` field written to `REVIEW_LOG.md`. No interface/shape
  change (`content` is already `string`), but durably persists the signals for the first time.
  Distinct risk, not shared by Surfaces A, C, or D: Contract Phase 3 defines `content` as recording
  each `RuleExecution`'s Check-verdict result specifically; mixing diagnostic signal text into that
  same field changes what an already-Contract-defined artifact represents going forward, even
  though no existing (already-written) entry is edited. If this surface is ever chosen, the signal
  text would need clear, unambiguous separation from the Check-verdict text within the field — not
  assumed safe by default the way Surfaces A, C, and D are.
- **Surface C — a separate diagnostic artifact.** A new, distinct, append-only file (decoupled
  from `REVIEW_LOG.md` and the Contract Phase 3 `Report` artifact entirely) recording the three
  signals per invocation. Keeps the existing, already-frozen `Report`/`REVIEW_LOG.md` artifact
  completely untouched.
- **Surface D — ephemeral, non-persisted only.** Expose the three signals solely via stdout under
  an opt-in `--debug-signals`-style flag, with no file written at all under any circumstance. The
  most conservative option in terms of repository footprint.

---

# Required observable outputs

- The current `triggeredBy` value already constructed for the invocation.
- A yes/no signal: content identical to the immediately preceding `REVIEW-3` entry.
- A yes/no signal (plus value, if present): explicit intent flag provided at invocation.
- No change to exit code.
- No change to whether or when a `Report` entry is written.
- No change to the PASS/FAIL verdict of any of the three existing Checks
  (`checkHeadMatchesOrigin`, `checkWorkingTreeClean`, the CI-poll check).

---

# Verification strategy

Verifies the capability exists and computes correctly — not that any semantic is correct:

1. Run the script twice against identical repository state; confirm the `triggeredBy` signal is
   present and identical both times.
2. Run the script once, then again after a repository state change (e.g. a new commit); confirm
   the content-comparison signal correctly flips from "identical" to "different" — this verifies
   the comparison computation exists and functions, not that content-based semantics is preferable.
3. Run the script once with and once without the new optional flag (whichever surface includes
   one); confirm the presence signal correctly reflects each case.
4. `git status --porcelain` — confirms only the declared files for whichever surface is later
   chosen changed.
5. Full triad (`tsc -b`, architecture guard, full suite) plus a parity check against the three
   existing Checks' pre-capability console output — confirms exit code and verdicts are
   byte-for-byte unchanged, proving the capability is purely observational.

---

# Independence

None of the three signals gates anything — each is computed and exposed, never acted upon. The
already-shipped, already-verified Contract Phase 3 behavior (unconditional append) is preserved
exactly; nothing about whether or when a `Report` entry is written changes. This means implementing
the signal recorder makes no judgment call about reportability at all — it only makes the raw
inputs to that future judgment observable. This mirrors the discipline already used throughout
this decision process: `REPORTABLE_EXECUTION_EVIDENCE_PACK.md` gathered observable facts without
interpreting them into a decision; this capability does the runtime equivalent, gathering
observable signals without gating behavior on them. Because it commits to no semantic, it can be
built, verified, and shipped entirely independently of which candidate is eventually chosen — and
its own existence is what would let a future Decision Matrix re-scoring cite real data instead of
marking the same cells "Insufficient evidence" again.

---

# Exit condition

After this capability exists, for any real invocation a reviewer would be able to observe — via
whichever candidate surface is chosen — the three raw signal values each candidate semantic's
classification would be based on, across multiple genuine invocations over time. This upgrades
Auditability and Runtime observability from "Insufficient evidence" to evidence-bearing in a
future Decision Matrix re-scoring, and partially strengthens Determinism's explicit-intent-based
cell. It does not resolve Backward compatibility for existing callers (still needs an actual
chosen default), Implementation complexity, Verification cost, or Rollback simplicity (pure
research gaps, unrelated to this capability), or Future extensibility (still requires a second
real governance rule). No semantic becomes chosen, recommended, or implied by this capability's
existence — it only makes the previously-unobservable observable.

---

*End of plan. No repository file was modified besides this one document. No semantic was
recommended. No capability surface was chosen. No implementation was performed. No ADR was
written. No Runtime Contract was created. Exactly one markdown file was written.*
