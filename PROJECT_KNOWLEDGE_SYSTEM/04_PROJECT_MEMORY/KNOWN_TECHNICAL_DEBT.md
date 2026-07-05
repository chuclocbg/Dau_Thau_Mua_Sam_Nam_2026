# Known Technical Debt (Narrative)

**Purpose:** The story behind each open debt item — how it was found, why it was accepted
rather than fixed immediately. The *current status* of each item is owned by
[`../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../02_AI_CONTEXT/TECHNICAL_DEBT.md) — this file is the
narrative companion, not a duplicate status list.

**Related:** [`../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../02_AI_CONTEXT/TECHNICAL_DEBT.md) · [Lessons Learned](LESSONS_LEARNED.md)

## TD-01 and TD-02: Debt Created by the Freeze Discipline Itself

Both were found *after* their modules (`acceptance`, `procurement/application`) were already
frozen. Because frozen modules cannot be edited even for bug fixes, both remain open by design
— fixing them requires a bridge-layer correction, not a source edit. This is the clearest
illustration in the whole project of the freeze discipline's real trade-off: regression safety
at the cost of some debt becoming permanently harder to fix directly.

## TD-04/TD-05/KI-004: A Documentation Staleness Case Study

Before Phase M1, these were accurately described as "Prisma repos are stub-only" and "Float
used for money." Phase M1 (2026-07-05) fixed both in the actual schema — but `technical-debt.md`
and `known-issues.md` still described the old, pre-M1 state for a full session afterward, until
the Release Candidate audit caught the mismatch and corrected the wording to "fix applied,
unverified against a live database" — the honest middle state, neither "still broken" nor
"resolved."

## The resolveCases Signature Gap: Found by Reading, Not by Testing

This one is unusual: it was never caught by any test (no test exercises the still-unwritten
Phase X reasoning pipeline), never caught by `tsc` (the mismatch is between a markdown design
doc and a TypeScript interface, not two pieces of code), and never caught by any prior review.
It was found only when the Phase X architecture review read both documents side by side and
compared method signatures by hand. The lesson generalized in
[Lessons Learned](LESSONS_LEARNED.md#lesson-3-a-design-document-and-a-frozen-interface-can-silently-disagree).

## The ADR Dual-Numbering Issue: A Documentation Debt With No Test Coverage

Like the resolveCases gap, this is a class of debt that no automated check catches — it lives
entirely in documentation structure, not code. It's included here specifically because most of
this repository's technical debt register is code-focused; this entry exists to note that
documentation itself can and does accumulate debt the same way code does.
