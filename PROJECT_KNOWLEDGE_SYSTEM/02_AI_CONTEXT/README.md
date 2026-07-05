# 02_AI_CONTEXT

**Purpose:** Fast, machine-readable context for any AI assistant working on this repository.
Every file in this folder is deliberately short, structured, and fact-dense — optimized for
being loaded whole at the start of a session, not for narrative reading.

**Audience:** Claude Code, ChatGPT, Gemini, Cursor, Codex, NotebookLM, Continue, or any future
AI tool. Also useful to a human who wants the same fast-loading summary.

**Dependencies:** None to read. Content here summarizes `app/.memory/`, `app/docs/`, and
`app/PROJECT_CONSTITUTION.md` — those remain authoritative for full detail; these files are
the compressed, always-current index over them.

**Status:** Must be kept in sync with `app/.memory/repository-health.md`,
`app/.memory/next-task.md`, and `app/.memory/architecture-index.md` every time those change.
Staleness here is a known historical failure mode of this project (see
[`../04_PROJECT_MEMORY/LESSONS_LEARNED.md`](../04_PROJECT_MEMORY/LESSONS_LEARNED.md)) — treat
keeping these 15 files current as part of closing out any phase, not an optional afterthought.
[`SCHEMA.md`](SCHEMA.md) defines which file owns which fact — check it before adding a new
fact anywhere in this folder, to avoid recreating the duplication this system was built to
eliminate.

---

## How to use this folder, per tool

| Tool | Recommended usage |
|---|---|
| **Claude Code** | Already has `CLAUDE.md` at repo root auto-loaded; use this folder for the *repository-specific* facts CLAUDE.md doesn't cover (current test counts, current milestone). |
| **ChatGPT / Gemini (no native repo access)** | Paste [`SYSTEM_CONTEXT.md`](SYSTEM_CONTEXT.md) + [`REPOSITORY_CONTEXT.md`](REPOSITORY_CONTEXT.md) + [`FREEZE_STATUS.md`](FREEZE_STATUS.md) at the start of a session — together they're under 400 lines and cover 90% of what's needed to avoid re-deriving context. |
| **Cursor / Continue / Codex (IDE-integrated)** | Point the tool's "project context" or "rules" setting at this entire folder — every file here is written to be safe to include in a system prompt verbatim. |
| **NotebookLM** | Upload `02_AI_CONTEXT/` and `01_PROJECT_DOCS/` together as one source set, not separately — AI Context files assume Project Docs exist for narrative depth, and heavy cross-linking between the two means splitting them causes NotebookLM to cite dangling references. For questions about *why* something was decided rather than *what* currently is, also include `04_PROJECT_MEMORY/`. |

---

## Table of Contents

| # | File | Answers |
|---|---|---|
| 0 | [Schema](SCHEMA.md) | The shared vocabulary every file below conforms to — read once, not per-session |
| 1 | [System Context](SYSTEM_CONTEXT.md) | What is this system, in AI-parseable form |
| 2 | [Repository Context](REPOSITORY_CONTEXT.md) | Where is everything, what's the tech stack |
| 3 | [Freeze Status](FREEZE_STATUS.md) | What must never be touched, and why |
| 4 | [Architecture Constraints](ARCHITECTURE_CONSTRAINTS.md) | What patterns are mandatory |
| 5 | [Coding Rules](CODING_RULES.md) | Style, conventions, what's forbidden |
| 6 | [Repository Rules](REPOSITORY_RULES.md) | Git, commit, branch conventions actually in use |
| 7 | [Dependency Rules](DEPENDENCY_RULES.md) | What may import what |
| 8 | [DDD Rules](DDD_RULES.md) | Bounded contexts, aggregates, value objects |
| 9 | [Technical Debt](TECHNICAL_DEBT.md) | Every known open issue, by ID |
| 10 | [Current Milestone](CURRENT_MILESTONE.md) | What phase are we in, right now |
| 11 | [Current Release](CURRENT_RELEASE.md) | What's tagged, what's pushed |
| 12 | [Known Risks](KNOWN_RISKS.md) | What could go wrong, ranked |
| 13 | [Next Approved Phase](NEXT_APPROVED_PHASE.md) | What's authorized to build next |

---

## The single most important fact

**Phase A through Phase N are FROZEN.** No file inside `app/src/legal/`, `app/src/procurement/`,
`app/src/masterdata/`, `app/src/approval/`, `app/src/contract/`, `app/src/acceptance/`,
`app/src/shared/`, `app/src/payment/`, `app/src/auth/`, `app/src/storage/`,
`app/src/notification/`, or `app/src/knowledge/` may be modified. New functionality is added
via a new file only (Integration Bridge or `registerProvider()`). See
[Freeze Status](FREEZE_STATUS.md) for the complete, exact list.
