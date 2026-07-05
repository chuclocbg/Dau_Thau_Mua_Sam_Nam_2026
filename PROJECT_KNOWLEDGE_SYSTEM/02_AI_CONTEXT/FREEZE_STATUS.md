# Freeze Status

*Machine-readable. This is the single most consequential file in this folder — read it before
touching any file under `app/src/`.*

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
owner_file: null   # this file owns "what is frozen and how extension works" — the definitive list
related: [REPOSITORY_CONTEXT.md, SCHEMA.md, ../01_PROJECT_DOCS/CONSTITUTION.md]
```

## Rule

A "frozen" module means: **no file within it may be edited, ever, for any reason** (bug fixes
included — bugs in frozen modules are tracked as technical debt and fixed via a bridge layer,
never by unfreezing the source). The only two permitted extension mechanisms are:

1. **Integration Bridge** — a new `*Integration.ts` file that imports the frozen module
   one-way and adds behavior around it.
2. **Registration** — for the Knowledge Platform only: `platform.registerProvider(new
   SomeNewProvider(...))`. Zero core file changes.

## Frozen modules (exhaustive)

```yaml
business_modules_frozen:
  - path: app/src/legal/
    phase: A1
    note: "Coexists with an UNRELATED legacy Legal Registry/Knowledge Graph track
           (legalRegistry.ts, graphQueryEngine.ts, knowledgeGraph.ts) from a different,
           earlier commit history. Do not confuse the two — see REPOSITORY_CONTEXT.md."
  - path: app/src/procurement/workflow/
    phase: B
  - path: app/src/masterdata/
    phase: C
  - path: app/src/procurement/package/
    phase: D
  - path: app/src/procurement/planning/
    phase: E
  - path: app/src/approval/
    phase: F
  - path: app/src/contract/
    phase: G
  - path: app/src/acceptance/
    phase: H
  - path: app/src/shared/financial/
    phase: H.5
  - path: app/src/payment/
    phase: I
  - path: app/src/auth/
    phase: J
  - path: app/src/storage/
    phase: K
  - path: app/src/notification/
    phase: L

infrastructure_frozen:
  - prisma.config.ts, docker-compose.yml, prisma/schema.prisma
    phase: M0/M1
    note: "IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never call this VERIFIED or FROZEN
           in the completed sense until a live PostgreSQL migration has actually run."

knowledge_platform_frozen:
  - path: app/src/knowledge/platform/
    contents: [KnowledgePlatform, ProviderRegistry, QueryRouter]
  - path: app/src/knowledge/graph/
    contents: [KnowledgeGraphService]
  - path: app/src/knowledge/search/
    contents: [SearchEngine, ResultRanker, embedding/vector adapters]
  - path: app/src/knowledge/repositories/
    contents: [memory repository implementations]
  - path: app/src/knowledge/application/
    contents: [Retriever, Resolver]
  - path: app/src/knowledge/providers/
    phase: N (Stage 1+2, Batches 1-4)
    count: 16
    note: "ALL 16 providers are frozen individually. A 17th provider is an ADDITIVE new file,
           never a modification to any of the 16."
    providers:
      - legal, procurement, templates, checklists, ontology, glossary
      - vendor, asset, budget, notification
      - school, cases, risk, audit
      - bestpractice, ai_feedback

not_frozen_never_committed:
  - path: app/src/orchestrator/
    note: "Pre-existing, unrelated commit track. Deliberately excluded from v1.0-knowledge-platform.
           Not part of Phase A-N. Do not assume it is frozen or stable — it was never audited
           as part of this release."
  - path: app/src/memory/
    note: "Same unrelated track as above. NOT the same thing as app/.memory/ (AI working memory)."

phase_x_status:
  code_written: false
  architecture_approved: true
  design_documents_exist: true
  location_of_design: "app/knowledge/ai-advisory/, app/knowledge/reasoning/, plus this
                        PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md"
```

## Verification method

This file's contents were verified by direct repository inspection (grep for cross-module
imports, `git log` for commit provenance, `vitest run` for test counts) as part of the
`v1.0-knowledge-platform` Release Candidate audit — not asserted from memory. If in doubt,
re-verify with `git status`, `grep`, and `npx vitest run --pool=forks --reporter=dot` rather
than trusting this file blindly for anything safety-critical.
