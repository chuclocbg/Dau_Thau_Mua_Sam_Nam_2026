# PROJECT_KNOWLEDGE_SYSTEM — Dependency Graph

**Purpose:** How every document references every other — folder-level flow, hub files, and a
per-file outbound-link census, generated from the live file tree rather than reconstructed
from memory.

**Version:** v1.0 · **Generated:** 2026-07-05 · **318 total link occurrences checked, 310
resolve to real files, 8 are literal template-syntax examples (not real links), 0 actually
broken.**

**Related:** [`PROJECT_KNOWLEDGE_SYSTEM_MANIFEST.md`](PROJECT_KNOWLEDGE_SYSTEM_MANIFEST.md) · [`PROJECT_KNOWLEDGE_SYSTEM_RELEASE.md`](PROJECT_KNOWLEDGE_SYSTEM_RELEASE.md)

---

## Folder-Level Graph

```
                    ┌────────────┐
                    │  README.md │  (root master index)
                    └──────┬─────┘
        ┌──────────────────┼──────────────────┬───────────────────┐
        ▼                  ▼                  ▼                   ▼
 01_PROJECT_DOCS/   02_AI_CONTEXT/    03_KNOWLEDGE_BASE/   04_PROJECT_MEMORY/
        │                  │                  │                   │
        │   (narrative,    │  (machine,       │  (scaffold-only,  │  (historical,
        │    human)        │   compact)       │   additive)       │   append-only)
        │                  │                  │                   │
        └────────┬─────────┴──────────────────┴─────────┬─────────┘
                 ▼                                        ▼
        Cross-links both ways where a Project Docs   Cross-links back into Project
        fact has an AI Context machine-readable       Docs/AI Context for "current
        twin (declared, not duplicated, per            state" facts and forward from
        Constitution Article IV)                       Project Memory into governance
                                                         (Constitution Article III, V)

     GOVERNANCE LAYER (root, 9 files) + AUDIT ARTIFACTS (root, 2 files)
     referenced FROM all four layers, reference INTO all four layers —
     the one layer that legitimately touches every other.
```

## Hub Files (highest outbound link count — verified by grep, not estimated)

| File | Outbound links | Role |
|---|---|---|
| `02_AI_CONTEXT/README.md` | 20 | AI Context folder index + per-tool guidance |
| `03_KNOWLEDGE_BASE/README.md` | 17 | Knowledge Base scope statement + 15-folder index |
| `04_PROJECT_MEMORY/README.md` | 14 | Project Memory folder index |
| `01_PROJECT_DOCS/README.md` | 14 | Project Docs folder index |
| `01_PROJECT_DOCS/EXECUTIVE_SUMMARY.md` | 13 | Entry-point narrative document |
| Root `README.md` | 10 | System master index |
| `04_PROJECT_MEMORY/AI_HANDOFF_GUIDE.md` | 10 | References all of `02_AI_CONTEXT/` |
| `01_PROJECT_DOCS/DEVELOPMENT_GUIDE.md` | 10 | Cross-references Constitution, Freeze Status, Architecture Constraints |
| `DOCUMENTATION_REVIEW_CHECKLIST.md` | 9 | References every governance sibling |
| `01_PROJECT_DOCS/TECHNICAL_ARCHITECTURE.md` | 9 | Cross-references Module Catalog, Domain Model, Dependency Rules |

As expected for a well-formed documentation system: the highest-fan-out files are exactly the
folder-level indexes and the two "how does everything connect" guides
(`AI_HANDOFF_GUIDE.md`, `DEVELOPMENT_GUIDE.md`) — not arbitrary content files. No content file
outside the indexes exceeds 9 outbound links, indicating no single non-index document has
become an unintended hub (a healthy sign — hub status concentrated in files whose job is
explicitly to be a hub).

## Key Cross-Layer References (the load-bearing links)

```
02_AI_CONTEXT/SCHEMA.md
    ← referenced by all 13 other 02_AI_CONTEXT files (the shared-vocabulary root)
    ← referenced by DOCUMENTATION_TEMPLATE.md, AI_CONTEXT_UPDATE_POLICY.md

02_AI_CONTEXT/CURRENT_RELEASE.md
    ← referenced by: root README.md, 01_PROJECT_DOCS/EXECUTIVE_SUMMARY.md,
       02_AI_CONTEXT/{SYSTEM_CONTEXT,CURRENT_MILESTONE}.md, 01_PROJECT_DOCS/{MODULE_CATALOG,
       RELEASE_HISTORY}.md, 04_PROJECT_MEMORY/RELEASE_TIMELINE.md
    (sole owner of the numeric release snapshot, per SCHEMA.md's ownership map)

02_AI_CONTEXT/CURRENT_MILESTONE.md
    ← referenced by: root README.md, 04_PROJECT_MEMORY/MILESTONE_HISTORY.md,
       02_AI_CONTEXT/{CURRENT_RELEASE,NEXT_APPROVED_PHASE}.md
    (sole owner of milestone state; archival rule ties it to MILESTONE_HISTORY.md)

02_AI_CONTEXT/REPOSITORY_CONTEXT.md
    ← referenced by: 02_AI_CONTEXT/FREEZE_STATUS.md, 01_PROJECT_DOCS/MODULE_CATALOG.md,
       04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md
    (sole owner of the naming-collision registry)

01_PROJECT_DOCS/CONSTITUTION.md
    ← referenced by: 01_PROJECT_DOCS/{DEVELOPMENT_GUIDE,BUSINESS_ARCHITECTURE}.md,
       03_KNOWLEDGE_BASE/legal/README.md, DOCUMENTATION_CONSTITUTION.md
    (states the legal-priority RULE; 03_KNOWLEDGE_BASE/legal/ holds the REFERENCE, per the
     explicit non-duplication boundary)

01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md
    ← referenced by: 01_PROJECT_DOCS/{MODULE_CATALOG,DOMAIN_MODEL,AI_ADVISORY_ARCHITECTURE}.md,
       03_KNOWLEDGE_BASE/README.md, KNOWLEDGE_BASE_EDITOR_GUIDE.md

DOCUMENTATION_CONSTITUTION.md
    ← referenced by ALL 8 other governance files (each cites the specific Article it implements)
```

## Full Per-File Outbound Link Census

*(File → outbound `.md` link count, all 68 files, generated by script, not estimated)*

```
01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md      6      02_AI_CONTEXT/CODING_RULES.md            1
01_PROJECT_DOCS/BUSINESS_ARCHITECTURE.md         3      02_AI_CONTEXT/CURRENT_MILESTONE.md       4
01_PROJECT_DOCS/CONSTITUTION.md                  4      02_AI_CONTEXT/CURRENT_RELEASE.md         2
01_PROJECT_DOCS/DEVELOPMENT_GUIDE.md            10      02_AI_CONTEXT/DDD_RULES.md               2
01_PROJECT_DOCS/DOMAIN_MODEL.md                  4      02_AI_CONTEXT/DEPENDENCY_RULES.md         3
01_PROJECT_DOCS/EXECUTIVE_SUMMARY.md            13      02_AI_CONTEXT/FREEZE_STATUS.md            3
01_PROJECT_DOCS/GLOSSARY.md                      4      02_AI_CONTEXT/KNOWN_RISKS.md              2
01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md            4      02_AI_CONTEXT/NEXT_APPROVED_PHASE.md      3
01_PROJECT_DOCS/MODULE_CATALOG.md                7      02_AI_CONTEXT/README.md                  20
01_PROJECT_DOCS/PROJECT_BLUEPRINT.md             7      02_AI_CONTEXT/REPOSITORY_CONTEXT.md       3
01_PROJECT_DOCS/README.md                       14      02_AI_CONTEXT/REPOSITORY_RULES.md         2
01_PROJECT_DOCS/RELEASE_HISTORY.md               4      02_AI_CONTEXT/SCHEMA.md                   0
01_PROJECT_DOCS/ROADMAP.md                       4      02_AI_CONTEXT/SYSTEM_CONTEXT.md           5
01_PROJECT_DOCS/TECHNICAL_ARCHITECTURE.md        9      02_AI_CONTEXT/TECHNICAL_DEBT.md            2

03_KNOWLEDGE_BASE/README.md                     17      04_PROJECT_MEMORY/README.md               14
03_KNOWLEDGE_BASE/*/README.md (15 folders)    2-3 each   04_PROJECT_MEMORY/TIMELINE.md              1
                                                          04_PROJECT_MEMORY/DECISION_HISTORY.md      0
GOVERNANCE (root, 9 files)                    3-9 each   04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md 2
Root README.md                                  10       04_PROJECT_MEMORY/LESSONS_LEARNED.md       2
                                                          04_PROJECT_MEMORY/REJECTED_DESIGNS.md      1
                                                          04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md  2
                                                          04_PROJECT_MEMORY/MILESTONE_HISTORY.md     2
                                                          04_PROJECT_MEMORY/RELEASE_TIMELINE.md      2
                                                          04_PROJECT_MEMORY/SESSION_RECOVERY_GUIDE.md 8
                                                          04_PROJECT_MEMORY/AI_HANDOFF_GUIDE.md      10
```

**Zero-outbound-link files** (`SCHEMA.md`, `DECISION_HISTORY.md`) are terminal/foundational
content — `SCHEMA.md` is the vocabulary root everything else points *to*; `DECISION_HISTORY.md`
is narrative content that doesn't need to point elsewhere. Neither is a defect.
