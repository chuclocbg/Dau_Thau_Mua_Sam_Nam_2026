# Session Recovery Guide

**Purpose:** How to recover full, accurate context after a gap — a new AI session, a new
contributor, or a long pause in development.

**Related:** [`../02_AI_CONTEXT/README.md`](../02_AI_CONTEXT/README.md) · [AI Handoff Guide](AI_HANDOFF_GUIDE.md)

## Recovery Procedure

1. Read [`../02_AI_CONTEXT/SCHEMA.md`](../02_AI_CONTEXT/SCHEMA.md) — 1 minute, tells you which
   file owns which fact, so you don't waste time cross-checking files against each other.
2. Read [`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md) and
   [`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md) — where the
   project actually stands right now, in numbers.
3. Read [`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md) — what you
   must never modify.
4. Read [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md) —
   what you are and are not authorized to build next.
5. If you need to verify any of the above against ground truth rather than trust it blindly:
   ```
   git log --oneline -20
   git status
   npx vitest run --pool=forks --reporter=dot
   ```
   This project's own history shows memory/documentation can go stale — verifying against a
   live command is always safer than trusting a static file for anything consequential.

## If You Find a Contradiction

Do not silently pick one side. Investigate which is actually true (usually: re-run the
verification commands above), correct the stale file, and — if the contradiction reveals a
genuine gap in this documentation system's ownership rules — note it in
[Lessons Learned](LESSONS_LEARNED.md), following the same discipline that caught the five
simultaneous `.memory/` staleness incidents and the ADR dual-numbering issue.

## What NOT to Do

Do not assume `PROJECT_KNOWLEDGE_SYSTEM/` is the only source of truth for *code* facts — it is
the canonical index and narrative layer, but `app/.memory/`, `app/docs/`, and the actual source
code remain authoritative for anything this system merely summarizes. When in doubt, this
system tells you *where* to look, not always the final word itself.
