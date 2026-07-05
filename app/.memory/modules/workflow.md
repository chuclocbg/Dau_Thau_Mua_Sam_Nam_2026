# Module: Workflow Engine

**Status:** FROZEN (v1.0, 2026-07-02) — SEALED
**Location:** `src/procurement/workflow/`
**Tests:** ~156

---

## Purpose

A 17-state procurement lifecycle state machine. Manages all transitions for a procurement
workflow instance — from DRAFT through PLANNING, APPROVAL, TENDER, CONTRACT, to COMPLETED.
Leaf module — no imports from any other business module.

---

## Files

- `workflowEngine.ts` — 8 public functions (SEALED)
- `workflowState.ts` — state definitions + law shorthand constants
- `workflowHistory.ts` — event log for a workflow instance
- `workflowContext.ts` — context data passed through transitions
- `workflowTransition.ts` — transition validation
- `workflowValidator.ts` — pre/post transition invariant checks

---

## Public API (8 functions — SEALED)

```typescript
createWorkflow(packageId, options): WorkflowInstance
transitionWorkflow(instance, event, actor, context): WorkflowInstance
validateTransition(instance, event): ValidationResult
getAvailableTransitions(instance): WorkflowEvent[]
getWorkflowHistory(instanceId, repos): WorkflowHistoryEntry[]
canTransition(instance, event, actor): boolean
buildWorkflowContext(package, plan, approvals): WorkflowContext
getWorkflowState(instance): WorkflowState
```

---

## 17 Workflow States

```
DRAFT → NEEDS_ASSESSMENT → PLANNING → PLAN_APPROVED →
PROCUREMENT_PREP → TENDER_PUBLISHED → BID_OPEN → EVALUATION →
AWARD_DECIDED → CONTRACT_NEGOTIATION → CONTRACT_SIGNED →
PERFORMANCE → ACCEPTANCE → PAYMENT → COMPLETED

Error paths: CANCELLED, SUSPENDED (from any active state)
```

---

## Dependencies

- No business module imports (leaf module)
- TD-15: hardcodes 5 law shorthand constants (L, D, D2, F, T) in `workflowState.ts`

---

## Consumers

- `packageIntegration.ts` → workflow creates/manages package lifecycle
- `planningIntegration.ts` → workflow state used in planning decisions
- `approvalIntegration.ts` → workflow transitions trigger approval requests
- `contractIntegration.ts` → contract creation tied to workflow state
- `acceptanceIntegration.ts` → acceptance tied to workflow state

---

## Business Rules Enforced

- All transitions are validated against a state machine (no invalid state jumps)
- Transition history is append-only (audit log)
- Actor is recorded for every transition (who performed the action)
- CANCELLED and SUSPENDED are terminal states that can only be reversed with special authority

---

## Known Limitations

- TD-07: `buildPlanWorkflow` hardcodes OPEN_TENDER as default (accepted, tracked in KI-001)
- TD-15: Law shorthand constants in `workflowState.ts` — frozen, low risk
- Adding a 6th law requires modifying this frozen file (deferred to Phase N knowledge integration)

---

## SEALED Note

The 8 public functions are sealed. No new public functions are added to this module.
Additional workflow operations are implemented in integration bridges.
