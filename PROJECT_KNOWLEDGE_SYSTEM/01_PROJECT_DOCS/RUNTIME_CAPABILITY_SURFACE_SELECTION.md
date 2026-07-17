# Runtime Capability Surface Selection

**Status:** PLANNING ONLY. No code, no repository modification besides this one document. No ADR.
No Runtime Contract created. No semantic decision made. `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md` is
treated as authoritative for the four candidate surfaces evaluated below; none of the three
candidate reportable-execution semantics (trigger-based, content-based, explicit-intent-based) is
reopened, chosen, or implied by any finding here.

---

# Current repository verification

Rebuilt from the repository itself, not from prior conversational assumptions:

- `RULE_REGISTRY.md` does not exist under that name. Per explicit instruction, this iteration
  treats `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/REGISTRY.md` as the
  authoritative Rule Registry — the repository's real path, not an alias.
- All six required sources exist and are committed: `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`
  (`40d8e98`), `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` (`e309096`),
  `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md` (`02f4c9b`), `IMPLEMENTATION_SLICE_01.md` (`e309096`),
  `RULE_DEFINITION_FORMAT.md` (`373d0a3`), `governance-rules/REGISTRY.md` (`9933e45`).
- No staged changes exist. HEAD (`02f4c9b`) is in sync with `origin/develop`. GitHub Actions for
  `02f4c9b` succeeded (run `29545670264`, conclusion=success) — verified directly in this session.
- The Playbook's own Part 3 table confirms the Contract-backed sequence ends at Phase 4; nothing
  past that point (including this capability-bootstrap work) carries Contract authority — it is
  Playbook/Product-Spec-adjacent planning work, consistent with `RUNTIME_CAPABILITY_BOOTSTRAP_
  PLAN.md`'s own status line.
- `governance-rules/REGISTRY.md` still lists exactly one rule, `REVIEW-3`, status `active` —
  unchanged since Phase 0.

No discrepancy found beyond the one already reported and resolved (Rule Registry filename).

---

# Candidate capability surfaces

All four surfaces are as defined in `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s "Candidate
implementations" section — none is chosen or discarded there; evaluated fresh here against the
requested dimensions.

| Surface | Scope | Dependencies | Runtime risk | Verification | Rollback |
|---|---|---|---|---|---|
| **A — console-only diagnostic** | One additional `console.log` line in `verifyPushState.ts`'s existing output. No new file, no schema change. | Signal computation only (`triggeredBy` already exists; a content-diff or flag-presence signal would need its own logic). | Very low — no persisted artifact touched. | Run twice, confirm the new line appears correctly; parity-check exit code/verdicts unchanged. | Trivial `git revert`; nothing persisted depends on it. |
| **B — extend `Report.content`** | Modify the string passed to `writeReport()` to include signal text, persisted into `REVIEW_LOG.md`. | Same signal computation, plus careful formatting to keep new text separated from existing Check-verdict text. | Medium — the only surface writing into the already-Contract-defined, already-shipped `Report` artifact. | Needs Phase 3's own append-only check, plus confirmation the new text stays clearly delineated from verdict text. | Medium — `git revert` removes the code, but already-written `REVIEW_LOG.md` entries (append-only, never edited) retain the new text; a rollback drill is needed to confirm future entries return to the pre-change format. |
| **C — separate diagnostic artifact** | New, distinct, append-only file, fully decoupled from `REVIEW_LOG.md`/`Report`. | Same signal computation, plus one new small write function modeled on `writeReport()`'s own append-only pattern. | Low — a defect here cannot corrupt or dilute the existing, Contract-defined artifact. | New non-vacuous append-only check (run twice, two distinct entries) plus a check confirming `REVIEW_LOG.md` is provably byte-for-byte unaffected. | Low — `git revert`; `REVIEW_LOG.md` was never touched, so no drill is needed there; the new file's own already-written entries remain as an orphaned historical artifact if fully reverted, matching the "purely additive" rollback category. |
| **D — ephemeral, opt-in flag only** | New CLI flag (e.g. `--debug-signals`); prints signals to stdout only when passed; no file touched ever. | Signal computation, plus new CLI-argument parsing (currently absent — the sole call site passes no flags). | Very low — default (flag-absent) invocation is byte-for-byte unchanged from today. | Verify both flag-present and flag-absent paths; confirm the default path is unaffected. | Trivial `git revert`; nothing ever persisted. |

---

# Acceptance criteria

A qualifying surface must, independent of which reportable-execution semantic is eventually
chosen:

1. Preserve every existing Contract Phase 0–4 guarantee exactly — exit code, the three Checks'
   verdicts, and `REVIEW_LOG.md`'s existing append-only behavior and content shape, unless a
   deviation is the surface's own deliberate, disclosed purpose.
2. Introduce no reportable-execution semantic — compute and expose signals, never gate `writeReport()`
   or any Check on them.
3. Have a rollback strategy fully contained to the surface's own new artifact(s), without requiring
   a drill against any artifact the surface didn't itself modify.
4. Be verifiable for existence (does the signal get computed and exposed correctly) independent of
   verifying any future semantic's correctness.
5. Have a bounded, small file footprint, consistent with this platform's own Decision Budget
   discipline.
6. Durably accumulate signal data across real, organic invocations (via the sole existing call
   site, `/ci-review`) rather than only under a deliberately-invoked debug path — this is required
   to actually satisfy `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s own Exit Condition ("across
   multiple genuine invocations over time"), not merely to expose a signal once.

---

# Selected surface

**Surface C — a separate diagnostic artifact.**

Criterion 6 above is the deciding factor. Surfaces A and D are both ephemeral: console output
(A) is not captured anywhere unless a human happens to be watching at the time, and D only
produces data when someone deliberately passes `--debug-signals` — under the sole real call site
(`/ci-review`, Evidence item 1, `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`), neither would accumulate
any historical record from ordinary use. Without durable accumulation, a future Decision Matrix
re-scoring would have nothing more to cite than it does today. That leaves B and C as the only two
surfaces that durably satisfy criterion 6 — and B is the one surface with a named, specific risk
(criterion 1): it writes into the same `content` field Contract Phase 3 defined for Check-verdict
results, risking exactly the kind of Contract-artifact conflation `RUNTIME_CAPABILITY_BOOTSTRAP_
PLAN.md`'s own self-review flagged and required disclosure for. Surface C is the only candidate
that is simultaneously durable (satisfies criterion 6) and fully decoupled from every artifact the
Contract already defines (satisfies criterion 1 with the least risk of the four). It is not the
cheapest surface to build (A and D have lower implementation effort), but it is the only one that
is both safe and actually useful for the stated purpose — the other three each fail one of those
two properties.

---

# Slice boundary

**Inputs:** `RUNTIME_CAPABILITY_BOOTSTRAP_PLAN.md`'s Surface C definition and its three raw signal
definitions (§"Smallest observable capability"); `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`
§3 (Forbidden Files) and §8 (Rollback Procedure) as binding constraints this slice must not
violate.

**Outputs:** one new, small append-only write function (structurally analogous to `writeReport()`'s
own append-only behavior, but operating on a distinct file from `REVIEW_LOG.md` — never the same
one); a new, decoupled file whose sole required property is that it is not `REVIEW_LOG.md` and is
not read by anything that currently reads `REVIEW_LOG.md` (which, per the Evidence Pack, is
nothing); the three raw signal computations wired into `verifyPushState.ts`'s `main()` to call the
new function. Exact field names, exact new filename, exact directory, and exact signal-computation
logic are not decided by this selection — they belong to that future slice's own
pre-implementation disclosure, not to this document.

**Files allowed to change (for that future slice, not this one):** `app/scripts/verifyPushState.ts`
(to call the new write function with computed signals); the new write function itself may be added
to the existing `app/scripts/lib/governanceRuntime.ts` or placed in a new module — this
organizational choice is not fixed by this selection; exactly one new file, at a location decoupled
from `REVIEW_LOG.md`'s own directory, for the diagnostic artifact itself.

**Files forbidden to change:** every entry in Contract §3's global forbidden list (`app/src/`,
every test directory, `.github/workflows/ci.yml`, `app/package.json`/`app/package-lock.json`,
`prisma/schema.prisma` and its migrations, all 10 frozen architecture documents,
`CURRENT_MILESTONE.md`'s `do_not` list, `.claude/commands/ci-review.md` unless its invocation path
changes — which this slice does not authorize); plus, specific to this slice,
`PROJECT_KNOWLEDGE_SYSTEM/04_PROJECT_MEMORY/REVIEW_LOG.md` itself (Surface C's entire value
proposition depends on leaving it untouched) and `app/scripts/validateGovernanceRule.ts` (no
reason for this slice to touch the Validator).

**Verification commands:** the existing triad (`npx tsc -b`; architecture guard suite; full test
suite) plus a parity check confirming `REVIEW_LOG.md`'s append behavior and content remain
byte-for-byte unaffected; a new non-vacuous append-only check on the new file (run the script
twice, confirm two distinct entries rather than one overwritten); `git status --porcelain`
confirming only the declared files changed.

**Rollback procedure:** `git revert` of the slice's single commit — the `revert` category per
Contract §8, since the new file is decoupled and purely additive. No rollback drill against
`REVIEW_LOG.md` is required, unlike what Surface B would have needed, because `REVIEW_LOG.md` is
never touched by this slice.

**Exit condition:** the new diagnostic file exists and accumulates one entry per real invocation,
carrying the three raw signals, with `REVIEW_LOG.md` provably byte-for-byte unaffected throughout.
At that point, a future Decision Matrix re-scoring could cite real, accumulated data for
Auditability and Runtime observability instead of "Insufficient evidence" — satisfying `RUNTIME_
CAPABILITY_BOOTSTRAP_PLAN.md`'s own stated Exit Condition for the first time, via a concrete,
bounded slice. No semantic becomes chosen, recommended, or implied by reaching this exit condition.

---

*End of selection. No repository file was modified besides this one document. No semantic was
recommended or chosen. No capability was implemented. No ADR was written. No Runtime Contract was
created. Exactly one markdown file was written.*
