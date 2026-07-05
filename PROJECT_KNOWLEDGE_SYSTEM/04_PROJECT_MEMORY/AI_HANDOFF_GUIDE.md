# AI Handoff Guide

**Purpose:** How one AI session hands off cleanly to the next — what to leave behind, what to
check before ending a session, what the next session should expect to find.

**Related:** [Session Recovery Guide](SESSION_RECOVERY_GUIDE.md) · [`../02_AI_CONTEXT/README.md`](../02_AI_CONTEXT/README.md)

## Before Ending a Session

1. **Is `02_AI_CONTEXT/CURRENT_MILESTONE.md` still accurate?** If the milestone changed during
   this session, archive the outgoing one to
   [`MILESTONE_HISTORY.md`](MILESTONE_HISTORY.md) first, then update it.
2. **Is `02_AI_CONTEXT/CURRENT_RELEASE.md` still accurate?** Same archival rule, via
   [`RELEASE_TIMELINE.md`](RELEASE_TIMELINE.md).
3. **Did this session make any decision worth recording?** Add it to
   [`DECISION_HISTORY.md`](DECISION_HISTORY.md) (why) and, if formal, a real ADR in
   `app/.memory/decisions/`.
4. **Did this session find or fix a technical debt item?** Update
   [`../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../02_AI_CONTEXT/TECHNICAL_DEBT.md) (status) and
   [`KNOWN_TECHNICAL_DEBT.md`](KNOWN_TECHNICAL_DEBT.md) (narrative).
5. **Did this session reject an alternative design?** Add it to
   [`REJECTED_DESIGNS.md`](REJECTED_DESIGNS.md) so it isn't re-proposed blind next time.
6. **Run the verification gate** — `tsc --noEmit` and `vitest run --pool=forks` — before
   claiming anything is done. Never report a status this session didn't actually verify.

## What the Next Session Should Expect

A consistent, cross-linked, non-duplicated documentation system where every fact has exactly
one owner (per [`../02_AI_CONTEXT/SCHEMA.md`](../02_AI_CONTEXT/SCHEMA.md)'s ownership map). If
the next session finds a fact repeated in two places, that is itself a defect worth fixing —
this system was built specifically to make that the exception, not the norm.

## The Standing Instruction Every Session Inherits

Per this project's own [Constitution](../01_PROJECT_DOCS/CONSTITUTION.md): never fabricate a
completed task, a test result, or a citation. Never modify a frozen module. Ask at most three
clarifying questions when information is missing. Classify findings by severity
(`[CRITICAL]/[HIGH]/[MEDIUM]/[LOW]`). These rules apply to every session equally — this guide
exists to help you *apply* them across a handoff, not to introduce new ones.
