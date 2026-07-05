# Next Approved Phase

**Purpose:** State precisely what is and is not authorized to be built next, so no AI session
begins unapproved work.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
owner_file: null   # owns: phase_x_status, approved_scope
related: [CURRENT_MILESTONE.md, ../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md, ../01_PROJECT_DOCS/ROADMAP.md]

approved: "Phase X architecture and design ONLY"
approved_artifacts:
  - "Full layered architecture (Presentation -> Conversation -> Advisor -> Reasoning ->
     Planning -> Knowledge Platform -> Repositories -> Prisma -> PostgreSQL)"
  - "15 advisor profiles designed (data records, not services)"
  - "7 ADR drafts written (not yet ratified into app/.memory/decision-index.md)"
  - "Phase breakdown: X.1 through X.10/X.11, each independently freezeable"
  - "Golden Question Regression strategy across 10 domains"
  - "MCP and Multi-Agent designs — DESIGN ONLY, explicitly gated behind proven need"

NOT_approved:
  - "Any Phase X source code"
  - "Any modification to app/src/knowledge/ (frozen)"
  - "Beginning MCP (X.9) or Multi-Agent (X.10) implementation"
  - "Ratifying the ADR drafts into app/.memory/ (requires explicit human action)"

blocking_prerequisite: "ADR-DRAFT-X01 (resolveCases/resolveBestPractice retrieval strategy)
                        must be formally ratified before Phase X.2 (Reasoning Engine) can
                        start. Phase X.1 (Conversation Core) has no blocker and may start
                        once explicitly authorized."

immediate_next_action: "None assigned. Waiting for explicit human approval to begin Phase X.1."
```
