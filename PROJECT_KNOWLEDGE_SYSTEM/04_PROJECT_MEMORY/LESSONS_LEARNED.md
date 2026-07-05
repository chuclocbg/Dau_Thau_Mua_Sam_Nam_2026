# Lessons Learned

**Purpose:** What went wrong before, and what changed because of it — so the same mistake
isn't repeated by a future session that didn't live through the original one.

**Related:** [Rejected Designs](REJECTED_DESIGNS.md) · [`../02_AI_CONTEXT/README.md`](../02_AI_CONTEXT/README.md)

## Lesson 1: `.memory/` Staleness Recurs Silently Across Multiple Files at Once

During the Release Candidate audit, five separate memory files (`start-here.md`,
`completed.md`, `project-status.md`, `technical-debt.md`, `known-issues.md`) were found stale
**simultaneously** — each had drifted independently from reality (wrong test counts, missing
phase entries, outdated debt status) without anyone noticing until a dedicated audit checked
all of them at once. **What changed:** this documentation system's `02_AI_CONTEXT/SCHEMA.md`
now designates exactly one owner file per fact, specifically to make this class of drift
structurally harder to reintroduce — not just to rely on discipline a second time.

## Lesson 2: Pre-Existing Test Failures Are Fixed by Fixing the Test, Not the Business Rule

Twice (Storage's retention fixtures, `procurement-types.test.ts`/`workflow-engine.test.ts`),
a frozen module's test suite contained a test with an outdated fixture, not a code bug. Both
times, the fixture was corrected and the underlying business logic was verified as already
correct — never the reverse. **What this confirms:** "the test is wrong" is a real, legitimate
finding, but it must be verified against the actual business rule before acting on it, never
assumed as the default explanation for a red test.

## Lesson 3: A Design Document and a Frozen Interface Can Silently Disagree

The pre-existing Phase X reasoning-pipeline design assumed platform methods
(`resolveCases(question, context, limit)`) that were never actually built — discovered only
by close reading during the Phase X review, not by any earlier check. **What changed:** future
design documents referencing a frozen interface should be spot-checked against the actual
interface signature before being treated as implementation-ready, not just accepted as
authoritative because they're detailed and well-written.

## Lesson 4: Duplicate ADR Numbers Across Two Folders Went Unnoticed Until This Review

`docs/adr/ADR-004` and `.memory/decisions/ADR-004` are different decisions sharing a number —
present in the repository the whole time, only surfaced by a dedicated architecture review.
**What changed:** this documentation system's ADR folder ([`../03_KNOWLEDGE_BASE/adr/README.md`](../03_KNOWLEDGE_BASE/adr/README.md))
explicitly documents this as a known, unfixed issue rather than silently perpetuating it by
adding a third numbering sequence.

## Lesson 5: A Reviewed Recommendation Is Not the Same As an Executed Fix

Every review in this project's history (Release Candidate, Phase X architecture review,
documentation architecture review) produced *findings and recommendations*, not automatic
fixes. The discipline of pausing after review, presenting findings, and waiting for explicit
approval before acting was maintained consistently — this is why this Wave 2 documentation
build only proceeded after the Wave 1 review's findings were explicitly approved.
