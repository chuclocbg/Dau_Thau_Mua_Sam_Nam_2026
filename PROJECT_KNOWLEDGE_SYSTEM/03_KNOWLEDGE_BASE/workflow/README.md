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

## Boundaries

Describes states/transitions in plain language only; the state machine's actual code
(`src/procurement/workflow/`) is the single source of truth for behavior — this folder must
never contradict it.

## Ownership

Owned by whoever maintains `src/procurement/workflow/`. No Knowledge Platform provider backs
this domain (a stated scope decision — see [`../README.md`](../README.md)).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a workflow state or transition rule changes.

**Related:** [`../../01_PROJECT_DOCS/MODULE_CATALOG.md`](../../01_PROJECT_DOCS/MODULE_CATALOG.md) · [`../checklists/README.md`](../checklists/README.md)
