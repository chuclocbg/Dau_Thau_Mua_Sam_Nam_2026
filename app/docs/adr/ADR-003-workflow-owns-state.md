# ADR-003 — Workflow Owns State

Status: ACCEPTED
Date: 2026-07-02

---

## Context

The procurement lifecycle has 17+ states (DRAFT → PROCUREMENT_REQUEST → ...→ COMPLETED).
Multiple modules (Package, Planning, Approval, Contract) need to know the current
state and advance it. Without a single owner, state can be modified inconsistently.

---

## Decision

`WorkflowInstance` is the single source of truth for the procurement lifecycle state.

All state transitions are performed through `workflowEngine.advance()`.
All history entries are written through `addHistoryEntry()`.
No module may directly write `WorkflowInstance.currentState` or mutate history arrays.

The Workflow Engine (`src/procurement/workflow/`) is sealed:
- 6 files, all imports stay within the workflow subfolder.
- No file outside workflow/ imports internal workflow utilities.
- External code uses only the 8 public API functions in `workflowEngine.ts`.

`masterdataIntegration.ts` provides async helpers (authority limits, document templates)
that the workflow engine itself cannot call without creating a circular dependency.

---

## Consequences

**Positive:**
- Single authority for state — no split-brain between Package status and Workflow state.
- All state changes are validated (workflowValidator.ts) before they happen.
- Full audit trail guaranteed by the engine, not by each caller.

**Negative:**
- Any module that needs to advance workflow state must call `workflowEngine.advance()`.
  This couples all business modules to the workflow contract.
- The sealed boundary means adding a new workflow feature requires care not to
  break the public API surface.

---

## Alternatives Rejected

**State on ProcurementPackage**: Package holds its own `status` field and manages
its own lifecycle. Rejected because state would be duplicated (Workflow + Package),
and history would need to be written in two places.

**Event sourcing**: State is derived from an event log, not stored directly.
Rejected per PM directive — not in scope. Exceeds complexity budget.
