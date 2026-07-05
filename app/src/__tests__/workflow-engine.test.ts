/**
 * WorkflowEngine — 8 public API functions + full lifecycle
 *
 * Groups (13 × 3 = 39):
 *   WE-01  createWorkflow — context starts in DRAFT, status=ACTIVE
 *   WE-02  createWorkflow — history has 1 CREATE entry
 *   WE-03  startWorkflow — advances to PROCUREMENT_REQUEST
 *   WE-04  advance — valid transition succeeds and returns new instance
 *   WE-05  advance — invalid (skip) returns ok=false
 *   WE-06  rollback — moves one step back
 *   WE-07  rollback — fails from DRAFT
 *   WE-08  cancel — sets status=CANCELLED
 *   WE-09  cancel — fails on COMPLETED workflow
 *   WE-10  getPendingTasks — returns remaining states
 *   WE-11  getRequiredDocuments — returns current state docs
 *   WE-12  getHistory — returns all history entries
 *   WE-13  getWorkflowResult — returns complete result shape
 */

import { describe, it, expect } from 'vitest';
import {
  createWorkflow,
  startWorkflow,
  advance,
  rollback,
  cancel,
  getPendingTasks,
  getRequiredDocuments,
  getHistory,
  getWorkflowResult,
} from '../procurement/workflow/workflowEngine';
import { getEntriesByAction } from '../procurement/workflow/workflowHistory';
import type { WorkflowInstance } from '../procurement/workflow/workflowEngine';
import type { WorkflowContext } from '../procurement/workflow/workflowContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PARAMS = {
  packageId: 'pkg-001', packageType: 'GOODS', estimatedValue: 100_000_000,
  procurementMethod: 'COMPETITIVE_QUOTE', approvalAuthority: 'UNIT_HEAD',
  performedBy: 'nguyen.van.a',
};

function freshWorkflow(): WorkflowInstance {
  return createWorkflow(PARAMS);
}

function atState(stateId: WorkflowContext['currentState'], extra: Partial<WorkflowContext> = {}): WorkflowInstance {
  const base = freshWorkflow();
  return {
    ...base,
    context: {
      ...base.context,
      currentState: stateId,
      status: stateId === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
      ...extra,
    },
  };
}

// ─── WE-01: createWorkflow — context in DRAFT ────────────────────────────────

describe('WE-01 createWorkflow returns context in DRAFT state with ACTIVE status', () => {
  const inst = freshWorkflow();

  it('currentState is DRAFT', () => {
    expect(inst.context.currentState).toBe('DRAFT');
  });
  it('status is ACTIVE', () => {
    expect(inst.context.status).toBe('ACTIVE');
  });
  it('packageId matches params', () => {
    expect(inst.context.packageId).toBe('pkg-001');
  });
});

// ─── WE-02: createWorkflow — history ─────────────────────────────────────────

describe('WE-02 createWorkflow initialises history with one CREATE entry', () => {
  const inst = freshWorkflow();

  it('history has exactly 1 entry', () => {
    expect(inst.history.entries).toHaveLength(1);
  });
  it('first entry action is CREATE', () => {
    expect(inst.history.entries[0]?.action).toBe('CREATE');
  });
  it('CREATE entry toState is DRAFT', () => {
    expect(inst.history.entries[0]?.toState).toBe('DRAFT');
  });
});

// ─── WE-03: startWorkflow ────────────────────────────────────────────────────

describe('WE-03 startWorkflow advances to PROCUREMENT_REQUEST', () => {
  const result = startWorkflow(freshWorkflow(), 'nguyen.van.a');

  it('ok=true', () => {
    expect(result.ok).toBe(true);
  });
  it('new context currentState is PROCUREMENT_REQUEST', () => {
    expect(result.data?.context.currentState).toBe('PROCUREMENT_REQUEST');
  });
  it('history has 2 entries after start', () => {
    expect(result.data?.history.entries).toHaveLength(2);
  });
});

// ─── WE-04: advance — valid transition ───────────────────────────────────────

describe('WE-04 advance to valid next state succeeds', () => {
  const r1 = startWorkflow(freshWorkflow(), 'officer');
  const r2 = advance(r1.data!, 'FUND_CONFIRMED', 'officer');

  it('ok=true for valid transition', () => {
    expect(r2.ok).toBe(true);
  });
  it('new state is FUND_CONFIRMED', () => {
    expect(r2.data?.context.currentState).toBe('FUND_CONFIRMED');
  });
  it('original instance state is unchanged (immutable)', () => {
    expect(r1.data?.context.currentState).toBe('PROCUREMENT_REQUEST');
  });
});

// ─── WE-05: advance — invalid transition (skip) ──────────────────────────────

describe('WE-05 advance with skip returns ok=false and non-empty errors', () => {
  it('DRAFT → FUND_CONFIRMED (skip) → ok=false', () => {
    expect(advance(freshWorkflow(), 'FUND_CONFIRMED', 'officer').ok).toBe(false);
  });
  it('errors array is non-empty', () => {
    const r = advance(freshWorkflow(), 'FUND_CONFIRMED', 'officer');
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('data is undefined on failure', () => {
    const r = advance(freshWorkflow(), 'COMPLETED', 'officer');
    expect(r.data).toBeUndefined();
  });
});

// ─── WE-06: rollback — moves one step back ───────────────────────────────────

describe('WE-06 rollback moves one step back', () => {
  const started = startWorkflow(freshWorkflow(), 'officer').data!;
  const rb      = rollback(started, 'supervisor', 'Cần bổ sung thông tin');

  it('ok=true', () => {
    expect(rb.ok).toBe(true);
  });
  it('currentState returns to DRAFT', () => {
    expect(rb.data?.context.currentState).toBe('DRAFT');
  });
  it('history has a ROLLBACK entry', () => {
    const rollbacks = getEntriesByAction(rb.data!.history, 'ROLLBACK');
    expect(rollbacks).toHaveLength(1);
  });
});

// ─── WE-07: rollback — fails from DRAFT ──────────────────────────────────────

describe('WE-07 rollback from DRAFT returns ok=false', () => {
  const rb = rollback(freshWorkflow(), 'officer');

  it('ok=false', () => {
    expect(rb.ok).toBe(false);
  });
  it('errors array is non-empty', () => {
    expect(rb.errors.length).toBeGreaterThan(0);
  });
  it('data is undefined', () => {
    expect(rb.data).toBeUndefined();
  });
});

// ─── WE-08: cancel — sets status CANCELLED ───────────────────────────────────

describe('WE-08 cancel sets workflow status to CANCELLED', () => {
  const started   = startWorkflow(freshWorkflow(), 'officer').data!;
  const cancelled = cancel(started, 'director', 'Thay đổi ngân sách');

  it('ok=true', () => {
    expect(cancelled.ok).toBe(true);
  });
  it('status is CANCELLED', () => {
    expect(cancelled.data?.context.status).toBe('CANCELLED');
  });
  it('currentState unchanged after cancel', () => {
    expect(cancelled.data?.context.currentState).toBe('PROCUREMENT_REQUEST');
  });
});

// ─── WE-09: cancel — fails on COMPLETED ──────────────────────────────────────

describe('WE-09 cancel fails on COMPLETED workflow', () => {
  const completed = atState('COMPLETED');
  const result    = cancel(completed, 'officer');

  it('ok=false', () => {
    expect(result.ok).toBe(false);
  });
  it('errors array mentions hoàn thành', () => {
    expect(result.errors.some(e => e.includes('hoàn thành') || e.toLowerCase().includes('cancel'))).toBe(true);
  });
  it('data is undefined', () => {
    expect(result.data).toBeUndefined();
  });
});

// ─── WE-10: getPendingTasks ───────────────────────────────────────────────────

describe('WE-10 getPendingTasks returns states yet to be completed', () => {
  it('DRAFT has 16 pending tasks', () => {
    expect(getPendingTasks(freshWorkflow())).toHaveLength(16);
  });
  it('after startWorkflow, pending tasks is 15', () => {
    const started = startWorkflow(freshWorkflow(), 'officer').data!;
    expect(getPendingTasks(started)).toHaveLength(15);
  });
  it('COMPLETED has 0 pending tasks', () => {
    expect(getPendingTasks(atState('COMPLETED'))).toHaveLength(0);
  });
});

// ─── WE-11: getRequiredDocuments ─────────────────────────────────────────────

describe('WE-11 getRequiredDocuments returns required documents for current state', () => {
  it('DRAFT requires no documents', () => {
    expect(getRequiredDocuments(freshWorkflow())).toHaveLength(0);
  });
  it('METHOD_SELECTED requires ke-hoach-lua-chon-nha-thau', () => {
    expect(getRequiredDocuments(atState('METHOD_SELECTED'))).toContain('ke-hoach-lua-chon-nha-thau');
  });
  it('DOCUMENT_PREPARATION requires ho-so-moi-thau', () => {
    expect(getRequiredDocuments(atState('DOCUMENT_PREPARATION'))).toContain('ho-so-moi-thau');
  });
});

// ─── WE-12: getHistory ────────────────────────────────────────────────────────

describe('WE-12 getHistory returns full audit trail', () => {
  it('returns WorkflowHistory with workflowId and entries', () => {
    const h = getHistory(freshWorkflow());
    expect(h.workflowId).toBeTruthy();
    expect(Array.isArray(h.entries)).toBe(true);
  });
  it('after advance, history grows by 1', () => {
    const started = startWorkflow(freshWorkflow(), 'officer').data!;
    expect(getHistory(started).entries).toHaveLength(2);
  });
  it('ADVANCE entries have fromState=DRAFT and toState=PROCUREMENT_REQUEST', () => {
    const started = startWorkflow(freshWorkflow(), 'officer').data!;
    const advEntries = getEntriesByAction(getHistory(started), 'ADVANCE');
    expect(advEntries[0]?.fromState).toBe('DRAFT');
    expect(advEntries[0]?.toState).toBe('PROCUREMENT_REQUEST');
  });
});

// ─── WE-13: getWorkflowResult ────────────────────────────────────────────────

describe('WE-13 getWorkflowResult returns complete WorkflowResult shape', () => {
  const result = getWorkflowResult(freshWorkflow());

  it('has currentState with id=DRAFT', () => {
    expect(result.currentState.id).toBe('DRAFT');
  });
  it('progress=0, completedSteps=[], pendingSteps length=16', () => {
    expect(result.progress).toBe(0);
    expect(result.completedSteps).toHaveLength(0);
    expect(result.pendingSteps).toHaveLength(16);
  });
  it('has legalBasis, requiredDocuments, responsibleRole, nextAvailableActions', () => {
    expect(Array.isArray(result.legalBasis)).toBe(true);
    expect(Array.isArray(result.requiredDocuments)).toBe(true);
    expect(typeof result.responsibleRole).toBe('string');
    expect(Array.isArray(result.nextAvailableActions)).toBe(true);
  });
});
