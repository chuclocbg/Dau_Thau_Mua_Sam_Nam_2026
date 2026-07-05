# Documentation Backlog

**Purpose:** Every finding from the Documentation QA Audit, prioritized and made actionable.
Companion to [`DOCUMENTATION_HEALTH_REPORT.md`](DOCUMENTATION_HEALTH_REPORT.md) (the scored
summary) — this file is the to-do list.

**Status:** No item on this list has been fixed automatically. This is a backlog, not a
changelog — nothing here has happened yet.

---

## Critical

1. **Persist the Phase X design depth produced this session into permanent files.** The 7 full
   ADR drafts (Context/Decision/Alternatives/Consequences), the 10-domain Golden Question
   table, and the reasoning-pipeline sequence diagrams currently exist only in chat history.
   *Affected:* `01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md`, `04_PROJECT_MEMORY/DECISION_HISTORY.md`,
   `03_KNOWLEDGE_BASE/faq/README.md` (or a new file). *Why critical:* this is the single
   largest gap between "what this system claims to be canonical" and "what it actually
   contains" — the highest-value output of the entire Phase X design cycle is not durably
   captured anywhere this system controls.

---

## High

2. **Add an enforcement trigger to the archival-before-overwrite rule.** Currently stated as a
   rule with no owner-process. *Affected:* `02_AI_CONTEXT/CURRENT_MILESTONE.md`,
   `02_AI_CONTEXT/CURRENT_RELEASE.md`, `01_PROJECT_DOCS/DEVELOPMENT_GUIDE.md` (tie it to a
   concrete step, e.g. the phase-freeze checklist). *Why high:* this is the exact failure mode
   (`04_PROJECT_MEMORY/LESSONS_LEARNED.md` Lesson 1) this whole system was built to prevent —
   leaving it unenforced repeats the original mistake at one remove.
3. **Complete `SCHEMA.md`'s ownership map.** 6 of 13 named AI Context files
   (`SYSTEM_CONTEXT.md`, `ARCHITECTURE_CONSTRAINTS.md`, `CODING_RULES.md`,
   `REPOSITORY_RULES.md`, `DEPENDENCY_RULES.md`, `DDD_RULES.md`) are not registered in the
   `owns:` block despite each owning specific facts. *Why high:* undermines the exact mechanism
   meant to prevent duplication going forward.
4. **Fix the mandatory-template gaps in `01_PROJECT_DOCS/`.** `Status:` missing from 5 files,
   `Related:` missing from 3, `GLOSSARY.md` missing 3 of 6 required fields. *Why high:* this is
   a directly stated original requirement that was not fully honored — the clearest concrete
   SSOT-template compliance gap found.

---

## Medium

5. **Reconcile the Status legend.** `01_PROJECT_DOCS/README.md` declares
   `FROZEN`/`APPROVED`/`PLANNED`; only 3 of 14 files in the folder actually use one of those
   values. Either enforce it everywhere or scope the legend explicitly to architecture-status
   documents only.
6. **State explicitly that AI Context ↔ Project Docs fact restatement is intentional**, not a
   single-owner-rule violation, to prevent a future well-meaning "deduplication" pass from
   deleting one side of a deliberately dual-represented fact. *Affected:* `SCHEMA.md`.
7. **Add a curated "read these 4 for 80% of the depth" bundle** for `01_PROJECT_DOCS/`, mirroring
   the AI Context folder's existing fast-bundle guidance. *Affected:* `01_PROJECT_DOCS/README.md`.
8. **Monitor NotebookLM boilerplate-to-substance ratio** as real usage occurs; the repeated
   header block across 57 files is a larger fraction of total corpus size than it was in the
   original 9-file set.

---

## Low

9. Standardize the `**Related:**` field presentation style (single-line list vs. inline prose)
   across `01_PROJECT_DOCS/`.
10. Reword the "Wave 1"/"Wave 2" internal session jargon in
    `04_PROJECT_MEMORY/{LESSONS_LEARNED,TIMELINE}.md` into plain, context-free language.
11. State explicitly (one line, in the root `README.md` or `03_KNOWLEDGE_BASE/README.md`) that
    the `UPPER_SNAKE_CASE.md` (Project Docs/AI Context/Project Memory) vs.
    `lowercase-dash/README.md` (Knowledge Base) filename convention split is intentional.

---

## Future Ideas

- Once `03_KNOWLEDGE_BASE/` is populated with real content, re-run this audit's duplication
  checks specifically against it — the scaffolding stage couldn't meaningfully test for
  content-level duplication since there is no content yet.
- Consider an automated link-validation script (the one used for this audit, generalized)
  committed to the repository and run as part of any future documentation change, rather than
  re-derived by hand at audit time.
- Consider whether `DOCUMENTATION_HEALTH_REPORT.md` itself should move under
  `04_PROJECT_MEMORY/` once superseded by a later audit, following the same archival
  discipline recommended for `CURRENT_MILESTONE.md`/`CURRENT_RELEASE.md` — this report will
  itself go stale and should not simply be overwritten without a trace.
- Consider a lightweight terminology style guide (capitalization rules for `frozen`/`FROZEN`,
  etc.) once the corpus is large enough that ad hoc consistency stops scaling.
