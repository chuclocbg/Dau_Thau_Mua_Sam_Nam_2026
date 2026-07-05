# Repository Context

*Machine-readable. Where things are and how they relate. This file is the sole owner of the
project's naming-collision registry — do not restate collision detail in other files; link
here instead.*

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
owner_file: null   # owns: directory_layout, naming_collisions, git_facts
related: [FREEZE_STATUS.md, SCHEMA.md, SYSTEM_CONTEXT.md]

repo_root: "E:\\Dau_Thau_Mua_Sam_Nam_2026"

top_level_entries:
  app/:
    description: "The entire Node/TypeScript application. All source code, tests, and
                   module-level docs live here."
  Legal/:
    description: "Source Vietnamese legal documents (.docx) used as reference material for
                   the legal corpus. NOT source code. Do not confuse with app/src/legal/."
  PROJECT_KNOWLEDGE_SYSTEM/:
    description: "This documentation system. Repo-root sibling to app/ and Legal/ by design —
                   it documents the whole repository, not just the app subdirectory."

app_subdirectory_layout:
  src/:
    __tests__/: "Nearly all tests live here (395 files). A second, unrelated test directory
                 src/tests/ also exists from a different, pre-existing commit track — do not
                 confuse the two when searching for tests."
    legal/: "Phase A. TWO coexisting, unrelated models: the Phase A schema/repository model
             (legalSchema.ts, legalArticleStore.ts, etc.) AND a pre-existing, different Legal
             Registry/Knowledge Graph (legalRegistry.ts, knowledgeGraph.ts, graphQueryEngine.ts)
             from an earlier, unrelated commit track. Same directory, two different things."
    agents/: "Mostly a large (55-file), pre-existing, unrelated agent/pipeline framework.
              Phase A added exactly 3 new files here: LegalDocumentImporter.ts,
              LegalTextExtractor.ts, VietnamLegalStructureParser.ts."
    masterdata/: "Phase C, frozen."
    procurement/:
      workflow/: "Phase B, frozen."
      rules/: "Phase B, frozen."
      application/: "Phase B, frozen (procurementEngine.ts — has known technical debt, see TECHNICAL_DEBT.md)."
      package/: "Phase D, frozen."
      planning/: "Phase E, frozen."
      api/: "Phase B (procurementApi.ts)."
      domain/: "Phase B (procurementTypes.ts)."
    approval/: "Phase F, frozen."
    contract/: "Phase G, frozen."
    acceptance/: "Phase H, frozen."
    shared/financial/: "Phase H.5, frozen. Money/LegalBasis value objects used repo-wide."
    payment/: "Phase I, frozen."
    auth/: "Phase J, frozen."
    storage/: "Phase K, frozen."
    notification/: "Phase L, frozen."
    knowledge/: "Phase N. Frozen core (platform/, graph/, search/, repositories/, application/)
                 plus 16 frozen providers (providers/). ALSO contains two pre-existing,
                 unrelated files (knowledgeBase.ts, knowledgeTypes.ts) from an earlier commit
                 track — a documented naming collision, not an import collision (verified)."
    persistence/: "Mostly pre-existing (IndexedDB-era storage). Phase M1 added exactly 2 new
                   files: decimalMapping.ts, prismaClient.ts."
    orchestrator/: "Pre-existing, unrelated track. NOT part of Phase A-N. NOT committed to
                    v1.0-knowledge-platform. Do not assume stable."
    memory/: "Pre-existing, unrelated track (session/workspace layer). NOT app/.memory/.
              NOT part of Phase A-N. NOT committed to v1.0-knowledge-platform."
    capabilities/: "Pre-existing, unrelated track (Procurement/Legal Capability framework,
                    Phases 17-20 in a DIFFERENT numbering scheme than this project's A-Y
                    lettered phases — see ARCHITECTURE_EVOLUTION.md for how these two
                    numbering schemes coexist in one git history)."
  docs/: "Module-level technical documentation (29 files + 10 ADRs under docs/adr/)."
  knowledge/: "The ORIGINAL Phase N/N1-N3 design corpus (33 files) — corpus foundation, legal
               hierarchy, reasoning architecture, AND a remarkably complete pre-existing Phase X
               design (knowledge/ai-advisory/, knowledge/reasoning/) written before this
               review cycle began."
  .memory/: "The AI's own persistent working memory (66 files) — architecture-index,
             module-index, decision-index, repository-health, technical-debt, known-issues,
             next-task, and more. This is a DIFFERENT thing from PROJECT_KNOWLEDGE_SYSTEM/:
             .memory/ is session-to-session AI scratch-and-recall; PROJECT_KNOWLEDGE_SYSTEM/
             is the curated, human-and-AI-facing canonical index."
  PROJECT_CONSTITUTION.md: "The original constitution file. See
                            01_PROJECT_DOCS/CONSTITUTION.md for the condensed cross-reference."
  prisma/: "Phase M1. Schema + one real (never-applied) migration."

two_numbering_schemes_coexist:
  lettered_phases: "A, B, C, ... N, O, P, ... — THIS project's roadmap (business modules,
                    Knowledge Platform, future Phase X onward). Tracked in
                    app/.memory/roadmap-index.md."
  numbered_phases: "Phase 8, 9, 10, ... 21 — an EARLIER, UNRELATED commit track (agent
                    pipeline, governance workspace, capability framework, session layer).
                    37 of these commits sit between origin/develop and this project's first
                    commit. See 04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md for the full
                    reconciliation — they do not conflict at the file level, but they DO
                    share some directory names (legal/, knowledge/) with different meanings."

git_facts:
  current_tag: v1.0-knowledge-platform
  tag_commit: dad6b3d
  branch: develop
  last_commit_before_this_projects_work: 7765a02 ("Phase 21: Governance Workspace & Session Layer")
```

**If you're an AI searching for something and get confused by a naming collision** (two
"legal knowledge graphs," two "memory" concepts, two phase-numbering schemes) — this file
exists specifically because that confusion is real and has already caught this project's own
sessions off guard. Trust this file's disambiguation over your own pattern-matching.
