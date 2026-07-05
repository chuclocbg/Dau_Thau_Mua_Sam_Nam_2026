# 04_PROJECT_MEMORY

**Purpose:** The historical record — what happened, in what order, and *why* decisions were
made, not just what currently exists. Future contributors must understand the reasoning behind
architectural decisions, not only their outcome.

**Audience:** Anyone trying to understand why something is the way it is, or recovering
context after a gap (a new session, a new team member, a long pause in development).

**Dependencies:** None to read.

**Status:** Living, append-mostly. Entries here are never rewritten to change what was true at
the time — corrections are added as new entries, never edits to old ones.

## Table of Contents

| # | Document | Answers |
|---|---|---|
| 1 | [Timeline](TIMELINE.md) | What happened, in order |
| 2 | [Decision History](DECISION_HISTORY.md) | Why key decisions were made |
| 3 | [Architecture Evolution](ARCHITECTURE_EVOLUTION.md) | How the architecture changed over time, including the two-history reconciliation |
| 4 | [Lessons Learned](LESSONS_LEARNED.md) | What went wrong before, and what changed because of it |
| 5 | [Rejected Designs](REJECTED_DESIGNS.md) | What was considered and explicitly not chosen |
| 6 | [Known Technical Debt](KNOWN_TECHNICAL_DEBT.md) | The narrative behind each debt item |
| 7 | [Milestone History](MILESTONE_HISTORY.md) | Every past milestone, archived when superseded |
| 8 | [Release Timeline](RELEASE_TIMELINE.md) | Every past release, archived when superseded |
| 9 | [Session Recovery Guide](SESSION_RECOVERY_GUIDE.md) | How to recover full context after a gap |
| 10 | [AI Handoff Guide](AI_HANDOFF_GUIDE.md) | How one AI session hands off to the next |

## The One Rule This Folder Exists to Enforce

[`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md) and
[`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md) hold only the
*current* state. Before either is ever overwritten for a new milestone or release, the
outgoing content must be appended to [`MILESTONE_HISTORY.md`](MILESTONE_HISTORY.md) or
[`RELEASE_TIMELINE.md`](RELEASE_TIMELINE.md) respectively — first. This is the single most
important discipline for this system's 5-year survival: it is the only thing standing between
"a small, always-current AI Context folder" and either silently lost history or unbounded file
bloat.
