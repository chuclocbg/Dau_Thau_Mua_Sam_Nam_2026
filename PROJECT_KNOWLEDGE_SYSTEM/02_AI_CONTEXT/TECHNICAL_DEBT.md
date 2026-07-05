# Technical Debt

**Purpose:** Current snapshot of every open, tracked technical debt item. This file owns the
*current state* (open/resolved, severity) — the *narrative* of how each item was found and
why it was accepted lives in [`../04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md`](../04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md).

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
owner_file: null   # owns: open_debt_items_snapshot (current status only)
related: [../04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md, KNOWN_RISKS.md]
full_register: app/.memory/technical-debt.md   # authoritative, this file is a curated summary

critical:
  - id: TD-01
    what: "acceptanceService.ts DEFAULT_LEGAL_BASIS is string[], not LegalBasis[]"
    status: open, module frozen, fix requires bridge layer
  - id: TD-02
    what: "procurementEngine.ts hardcodes law-symbol conditionals in resolveLegalDocuments()"
    status: open, module frozen
  - id: TD-03
    what: "No auth enforcement wired to any endpoint yet (Auth module itself IS built, Phase J)"
    status: open
  - id: TD-04
    what: "Prisma repositories implemented, never verified against a live PostgreSQL instance"
    status: open, updated 2026-07-05 (was 'stub-only' before Phase M1)

high:
  - id: TD-05
    what: "Money/Prisma Float mismatch"
    status: RESOLVED 2026-07-05 (Phase M1) — Decimal(18,2) applied, unverified live
  - id: TD-06
    what: "No HTTP-boundary input validation (Zod etc.)"
    status: open
  - id: TD-07
    what: "buildPlanWorkflow hardcodes OPEN_TENDER"
    status: open, accepted (ADR-014)
  - id: TD-08
    what: "IBaseRepository.findAll() has no pagination — repo-wide, including Knowledge Platform"
    status: open

new_findings_from_phase_x_review:
  - what: "resolveCases/resolveBestPractice signature mismatch between pre-existing Phase X
           design docs and the frozen IKnowledgePlatform interface"
    status: "RESOLVED 2026-07-05 — ratified as ADR-022 (app/.memory/decision-index.md), via
             ADR-X01_FINAL.md. Uses existing searchKnowledge() instead of a new method; zero
             changes to the frozen IKnowledgePlatform."
  - what: "ADR dual-numbering: docs/adr/ADR-004 and .memory/decisions/ADR-004 are different
           decisions sharing a number"
    status: open, low effort to fix (renumber one sequence)
  - what: "No indexing strategy designed for Knowledge Platform's eventual Prisma migration"
    status: open, blocks 10,000+ knowledge item scale

medium_and_low: "see app/.memory/technical-debt.md for TD-09 through TD-15 (transactions,
                 caching, soft delete, null-guard crashes, jsdom parallelism, seed scripts,
                 workflowState law shorthand constants)"
```
