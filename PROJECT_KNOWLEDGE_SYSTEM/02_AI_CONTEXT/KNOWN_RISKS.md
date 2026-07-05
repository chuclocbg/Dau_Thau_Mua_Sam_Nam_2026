# Known Risks

**Purpose:** Current, ranked risk register — condensed from the Phase N Release Candidate
audit and the Phase X architecture review's top-50/top-30 risk lists.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
related: [TECHNICAL_DEBT.md, ../04_PROJECT_MEMORY/LESSONS_LEARNED.md]

critical:
  - "resolveCases/resolveBestPractice signature mismatch blocks Phase X.2 until ADR-DRAFT-X01
     is ratified"
  - "Hallucinated legal citation reaching a real procurement decision-maker — mitigated by
     OutputValidator design, NOT YET IMPLEMENTED, no code exists to test this against yet"
  - "No auth enforcement wired to endpoints yet — Phase X must not ship an endpoint before
     this is closed"
  - "Two disconnected 'Legal' bounded contexts in src/legal/ — risk of a future contributor
     importing the wrong one (see REPOSITORY_CONTEXT.md)"
  - "Phase M1 (Prisma) never verified against a live database — any production deployment
     inherits this unverified state"

high:
  - "Knowledge Platform repositories have zero indexing — fine in-memory, will need real work
     before 10,000+ items or Postgres migration"
  - "No caching layer anywhere in the repository"
  - "Provider/advisor registration is fully manual and imperative — won't scale past ~30
     entries ergonomically without a declarative manifest"
  - "RAG/vector search is 100% unimplemented scaffolding — interfaces exist, no real
     embeddings, no real vector store"
  - ".memory/ documentation staleness recurrence — already happened once (5 files went stale
     simultaneously), no automated sync check exists"

medium:
  - "Naming-convention drift across module generations (flat files vs. subdirectory structure)"
  - "No performance/load tests exist anywhere in the repository"
  - "470 pre-existing ESLint problems, never a merge gate"
  - "MCP/multi-agent (Phase X.9/X.10) risk of premature build if not gated behind proven need"

mitigation_owner: "each risk's full mitigation strategy is in the relevant PROJECT_DOCS file
                    (AI_ADVISORY_ARCHITECTURE.md for Phase X risks, TECHNICAL_ARCHITECTURE.md
                    for the rest) — this file only tracks WHAT the risk is and its severity"
```
