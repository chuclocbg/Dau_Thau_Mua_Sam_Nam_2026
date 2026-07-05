# Workflow

**Purpose:** Reference material for the procurement workflow state machine — what states
exist, what transitions are valid, and why, in plain language rather than code.

**Status:** Scaffolded, not yet populated.

## Future Contents

- State diagram of `WorkflowInstance` (owned by `src/procurement/workflow/`, frozen).
- Per-state guidance: what must be true to enter this state, what happens next.
- Known limitation to document here: `buildPlanWorkflow` currently hardcodes `OPEN_TENDER` as
  the default method (tracked as accepted technical debt, ADR-014) — this folder should
  eventually explain the practical implication for a user whose plan uses a different method.

**Related:** [`../../01_PROJECT_DOCS/MODULE_CATALOG.md`](../../01_PROJECT_DOCS/MODULE_CATALOG.md) · [`../checklists/README.md`](../checklists/README.md)
