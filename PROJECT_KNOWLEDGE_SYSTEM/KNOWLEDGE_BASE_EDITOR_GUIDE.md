# Knowledge Base Editor Guide

**Purpose:** Guide for whoever eventually populates the currently-scaffolded
`03_KNOWLEDGE_BASE/` folders with real content — so population doesn't recreate the
duplication problems this system's governance layer exists to prevent.

**Audience:** Whoever adds the first real content to any `03_KNOWLEDGE_BASE/` folder.

**Dependencies:** [`03_KNOWLEDGE_BASE/README.md`](03_KNOWLEDGE_BASE/README.md) (the scope
statement), [`DOCUMENTATION_TEMPLATE.md`](DOCUMENTATION_TEMPLATE.md).

**Status:** ACTIVE guide as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`. Written before any Knowledge
Base folder has real content — treat this as the rule to follow for the *first* population
pass, and revise it based on what's actually learned doing that pass.

**Related:** [`03_KNOWLEDGE_BASE/README.md`](03_KNOWLEDGE_BASE/README.md) · [`01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)

## Table of Contents

1. [Source From the Knowledge Platform Where Possible](#source-from-the-knowledge-platform-where-possible)
2. [The Rule vs. Reference Boundary](#the-rule-vs-reference-boundary)
3. [The Glossary/Ontology Boundary](#the-glossaryontology-boundary)
4. [Per-Folder Sourcing Notes](#per-folder-sourcing-notes)
5. [What to Do About the 9 Unmapped Knowledge Platform Domains](#what-to-do-about-the-9-unmapped-knowledge-platform-domains)

---

## Source From the Knowledge Platform Where Possible

Before hand-transcribing any fact into a Knowledge Base folder, check whether the Knowledge
Platform's corresponding provider (see
[`01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)'s domain
table) already models it as structured `KnowledgeItem` data. If it does, the Knowledge Base
content should be *generated from or cross-checked against* that data, not independently
authored — two independently-authored copies of the same legal citation will drift apart the
same way `.memory/` did.

## The Rule vs. Reference Boundary

Already established and must be preserved: `01_PROJECT_DOCS/CONSTITUTION.md` states the *rule*
("always prefer newer regulations"); `03_KNOWLEDGE_BASE/legal/` holds the *exhaustive
reference* (full citations, dates, cross-references). When populating `legal/`, do not also
edit `CONSTITUTION.md` to add reference detail — that would violate the boundary both
documents currently state explicitly.

## The Glossary/Ontology Boundary

Already established: `01_PROJECT_DOCS/GLOSSARY.md` stays at ~50 curated onboarding terms,
never grows past that. All exhaustive glossary population happens in
`03_KNOWLEDGE_BASE/glossary/`, sourced from the `GlossaryProvider`'s actual
`ABBREVIATES`/`TRANSLATES_TO` relation data. Ontology content
(`03_KNOWLEDGE_BASE/ontology/`) sources from `OntologyProvider`'s `SIMILAR_TO`/`BROADER_THAN`
data the same way.

## Per-Folder Sourcing Notes

| Folder | Primary source when populating |
|---|---|
| `legal/` | Knowledge Platform `legal` provider + source `.docx` files in repo-root `Legal/` |
| `procurement/` | `procurement` provider + `app/knowledge/reasoning/pipeline.md`'s threshold table |
| `workflow/` | `src/procurement/workflow/` code + tests (no KP provider backs this) |
| `approval/` | `src/approval/` code + tests + `school` provider for institution-specific overrides |
| `contract/` | `templates` provider + `src/contract/` code |
| `acceptance/` | `checklists` provider + `src/acceptance/` code (mind TD-01, see Technical Debt) |
| `asset/` | `asset` provider |
| `forms/`, `templates/` | `templates` provider |
| `checklists/` | `checklists` provider |
| `faq/` | Real usage questions only — never speculative ones (per its own README) |
| `glossary/` | `GlossaryProvider` data |
| `ontology/` | `OntologyProvider` data |
| `adr/`, `decision-log/` | `app/.memory/decision-index.md`, `app/docs/adr/` — link, do not re-author |

## What to Do About the 9 Unmapped Knowledge Platform Domains

`vendor`, `budget`, `notification`, `risk`, `audit`, `school`, `cases`, `bestpractice`,
`ai_feedback` currently have no dedicated Knowledge Base folder (a stated scope decision, not
an oversight — see `03_KNOWLEDGE_BASE/README.md`). Before adding a folder for any of these,
first decide — and document the decision in
[`04_PROJECT_MEMORY/DECISION_HISTORY.md`](04_PROJECT_MEMORY/DECISION_HISTORY.md) — whether the
provider's own structured data is sufficient on its own, or whether human-readable reference
content genuinely adds value beyond it. Do not add a folder reflexively just because a
provider exists; that would be documentation for its own sake, not for a stated need.
