# Project Knowledge System

**Purpose:** This is the canonical, permanent documentation system for the AI Procurement Agent
for Industrial Technical College (Trường Cao đẳng Kỹ thuật Công nghiệp). It exists so that any
future human contributor or AI session can understand — accurately, without re-deriving from
source — what this system is, what has been built, why it was built that way, and what is
approved to come next.

**Audience:** Every future contributor: human developers, the project owner, and every AI
assistant (Claude Code, ChatGPT, Gemini, Cursor, Codex, NotebookLM, or any future tool) that
works on this repository.

**Status:** Created 2026-07-05, immediately after the Release Candidate `v1.0-knowledge-platform`
was tagged and pushed to `origin/develop`. Documents the repository **as it exists at that
tag** — Phase A through Phase N complete and frozen, Phase X approved as architecture/design
only (no Phase X code exists yet).

**Relationship to existing documentation:** This system does **not** replace `app/docs/`,
`app/knowledge/`, or `app/.memory/` — those remain the module-level technical documentation,
the original design corpus, and the AI's own session-to-session working memory, respectively.
`PROJECT_KNOWLEDGE_SYSTEM/` is the **one level up** canonical index: it tells a reader what
exists in those three places and why, without duplicating their content wholesale. Where this
system needs to state a fact already documented in detail elsewhere, it summarizes and links
rather than repeats.

---

## Structure

```
PROJECT_KNOWLEDGE_SYSTEM/
├── 01_PROJECT_DOCS/       — Human-facing strategic and technical documentation
├── 02_AI_CONTEXT/         — Machine-optimized, fast-loading context for AI assistants
├── 03_KNOWLEDGE_BASE/     — Long-term business/domain knowledge repository (scaffolded, grows over time)
└── 04_PROJECT_MEMORY/     — Historical record: what happened, why, and what was learned
```

| Folder | Read this if you are... |
|---|---|
| [`01_PROJECT_DOCS/`](01_PROJECT_DOCS/README.md) | A new human contributor, or need the full architectural picture |
| [`02_AI_CONTEXT/`](02_AI_CONTEXT/README.md) | An AI assistant starting a new session and need to load context fast |
| [`03_KNOWLEDGE_BASE/`](03_KNOWLEDGE_BASE/README.md) | Looking for domain-specific (legal, procurement, workflow...) reference material |
| [`04_PROJECT_MEMORY/`](04_PROJECT_MEMORY/README.md) | Trying to understand *why* a decision was made, or recovering a lost session |

---

## Where to start

This root file intentionally does not repeat any folder's own reading order — each folder
owns and maintains its own:

- New AI session → [`02_AI_CONTEXT/README.md`](02_AI_CONTEXT/README.md)
- New human contributor → [`01_PROJECT_DOCS/README.md`](01_PROJECT_DOCS/README.md)
- Looking for domain reference material → [`03_KNOWLEDGE_BASE/README.md`](03_KNOWLEDGE_BASE/README.md)
- Understanding *why* a decision was made → [`04_PROJECT_MEMORY/README.md`](04_PROJECT_MEMORY/README.md)

---

## Ground truth right now

Repository: `E:\Dau_Thau_Mua_Sam_Nam_2026` (`app/` = the Node/TS application; `Legal/` = source
legal `.docx` documents, not code). Phases A through N are complete and frozen; Phase X is
approved as architecture/design only.

**For the exact current numbers (test counts, release tag, milestone) — this root file does
not state them, to avoid the exact duplication this system is built to prevent — see
[`02_AI_CONTEXT/CURRENT_RELEASE.md`](02_AI_CONTEXT/CURRENT_RELEASE.md) and
[`02_AI_CONTEXT/CURRENT_MILESTONE.md`](02_AI_CONTEXT/CURRENT_MILESTONE.md), the sole owners of
those facts.**
