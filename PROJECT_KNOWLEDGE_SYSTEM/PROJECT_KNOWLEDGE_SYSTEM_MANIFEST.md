# PROJECT_KNOWLEDGE_SYSTEM — Manifest

**Purpose:** Itemized inventory of every file in `PROJECT_KNOWLEDGE_SYSTEM v1.0`, with its
layer and one-line purpose — the manifest a future session or tool should check a copy of this
system against to confirm nothing is missing.

**Version:** v1.0 · **Generated:** 2026-07-05 · **Total files described:** 68 (pre-release-package)
+ 5 (this release package) = 73.

**Related:** [`PROJECT_KNOWLEDGE_SYSTEM_RELEASE.md`](PROJECT_KNOWLEDGE_SYSTEM_RELEASE.md) · [`PROJECT_KNOWLEDGE_SYSTEM_FILE_INDEX.md`](PROJECT_KNOWLEDGE_SYSTEM_FILE_INDEX.md)

---

## Governance Layer (9 files, root)

| File | Purpose |
|---|---|
| `DOCUMENTATION_CONSTITUTION.md` | 8 supreme articles governing the documentation system itself |
| `DOCUMENTATION_STYLE_GUIDE.md` | Naming, capitalization, status legend, jargon, link style rules |
| `DOCUMENTATION_LIFECYCLE.md` | 4 lifecycle stages + the archival-before-overwrite trigger |
| `DOCUMENTATION_CHANGE_POLICY.md` | Per-folder change rules |
| `DOCUMENTATION_REVIEW_CHECKLIST.md` | Operationalized QA checklist for future changes |
| `DOCUMENTATION_TEMPLATE.md` | Canonical copy-paste templates for all 4 document types |
| `DOCUMENTATION_VERSIONING.md` | How this system versions independently of code releases |
| `AI_CONTEXT_UPDATE_POLICY.md` | Event-to-file update map for `02_AI_CONTEXT/` |
| `KNOWLEDGE_BASE_EDITOR_GUIDE.md` | Sourcing rules for future Knowledge Base population |

## Audit Artifacts (2 files, root)

| File | Purpose |
|---|---|
| `DOCUMENTATION_HEALTH_REPORT.md` | Scored QA audit (7 dimensions) |
| `DOCUMENTATION_BACKLOG.md` | Prioritized findings: 1 Critical, 3 High, 4 Medium, 3 Low, 4 Future Ideas |

## Release Package (5 files, root — this delivery)

| File | Purpose |
|---|---|
| `PROJECT_KNOWLEDGE_SYSTEM_RELEASE.md` | Version, coverage, layer summary |
| `PROJECT_KNOWLEDGE_SYSTEM_MANIFEST.md` | This file — itemized inventory |
| `PROJECT_KNOWLEDGE_SYSTEM_FILE_INDEX.md` | Full alphabetical/path index |
| `PROJECT_KNOWLEDGE_SYSTEM_DEPENDENCY_GRAPH.md` | Cross-reference graph |
| `PROJECT_KNOWLEDGE_SYSTEM_CHECKSUM.md` | SHA-256 per file, integrity record |

## `01_PROJECT_DOCS/` (14 files)

| File | Purpose |
|---|---|
| `README.md` | Folder index, reading order |
| `EXECUTIVE_SUMMARY.md` | What this project is, in five minutes |
| `PROJECT_BLUEPRINT.md` | Business goals → technical execution plan |
| `BUSINESS_ARCHITECTURE.md` | Domains, stakeholders, workflows, legal context |
| `TECHNICAL_ARCHITECTURE.md` | Hexagonal architecture, layering, extension discipline |
| `MODULE_CATALOG.md` | Every module: status, location, test coverage |
| `DOMAIN_MODEL.md` | Entities, value objects, aggregates, bounded contexts |
| `KNOWLEDGE_PLATFORM.md` | The 16-provider Phase N platform |
| `AI_ADVISORY_ARCHITECTURE.md` | The approved (not implemented) Phase X design |
| `DEVELOPMENT_GUIDE.md` | How to build in this codebase without breaking it |
| `CONSTITUTION.md` | Non-negotiable code rules (condensed index of `CLAUDE.md`/`PROJECT_CONSTITUTION.md`) |
| `ROADMAP.md` | Built, next, in what order, and why |
| `RELEASE_HISTORY.md` | Every tagged code release |
| `GLOSSARY.md` | ~50 curated onboarding terms |

## `02_AI_CONTEXT/` (15 files)

| File | Purpose |
|---|---|
| `README.md` | Folder index, per-tool usage guidance |
| `SCHEMA.md` | Shared YAML vocabulary + fact-ownership map |
| `SYSTEM_CONTEXT.md` | What this system is, AI-parseable |
| `REPOSITORY_CONTEXT.md` | Directory layout, naming collisions, git facts |
| `FREEZE_STATUS.md` | Exact frozen-module list + extension rules |
| `CURRENT_MILESTONE.md` | Current milestone (archival-subject) |
| `CURRENT_RELEASE.md` | Current numeric release snapshot (archival-subject) |
| `ARCHITECTURE_CONSTRAINTS.md` | 10 load-bearing architectural rulings |
| `CODING_RULES.md` | Concrete coding conventions |
| `REPOSITORY_RULES.md` | Git/commit/tag conventions |
| `DEPENDENCY_RULES.md` | What may import what |
| `DDD_RULES.md` | Bounded contexts, aggregates, value objects |
| `TECHNICAL_DEBT.md` | Current open-debt snapshot |
| `KNOWN_RISKS.md` | Current ranked risk register |
| `NEXT_APPROVED_PHASE.md` | What's authorized to build next |

## `03_KNOWLEDGE_BASE/` (16 files — all scaffold-only)

`README.md` (scope statement) + 15 domain folder READMEs: `legal/`, `procurement/`,
`workflow/`, `approval/`, `contract/`, `acceptance/`, `asset/`, `forms/`, `templates/`,
`checklists/`, `faq/`, `glossary/`, `ontology/`, `adr/`, `decision-log/`.

## `04_PROJECT_MEMORY/` (11 files)

| File | Purpose |
|---|---|
| `README.md` | Folder index |
| `TIMELINE.md` | Chronological project history |
| `DECISION_HISTORY.md` | Why key decisions were made |
| `ARCHITECTURE_EVOLUTION.md` | How the architecture changed, incl. the two-history reconciliation |
| `LESSONS_LEARNED.md` | What went wrong before, what changed |
| `REJECTED_DESIGNS.md` | Alternatives considered and not chosen |
| `KNOWN_TECHNICAL_DEBT.md` | Narrative behind each debt item |
| `MILESTONE_HISTORY.md` | Archived past milestones |
| `RELEASE_TIMELINE.md` | Archived past releases |
| `SESSION_RECOVERY_GUIDE.md` | How to recover context after a gap |
| `AI_HANDOFF_GUIDE.md` | How one AI session hands off to the next |

## Root Master Index (1 file)

`README.md` — top-level entry point for the entire system.
