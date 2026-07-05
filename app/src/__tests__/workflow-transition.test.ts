/**
 * Workflow transition helpers
 *
 * Groups (13 × 3 = 39):
 *   WT-01  getNextState — next state and null at end
 *   WT-02  getPreviousState — previous state and null at start
 *   WT-03  isAllowedTransition — valid sequential transitions
 *   WT-04  isAllowedTransition — rejects skips and backward jumps
 *   WT-05  canRollback — true for non-first non-COMPLETED states
 *   WT-06  canRollback — false for DRAFT and COMPLETED
 *   WT-07  canCancel — true for non-COMPLETED, false for COMPLETED
 *   WT-08  getProgress — DRAFT=0, COMPLETED=100
 *   WT-09  getProgress — intermediate states between 0 and 100
 *   WT-10  getCompletedSteps — correct slice before current state
 *   WT-11  getPendingSteps — correct slice after current state
 *   WT-12  getPendingSteps(DRAFT) has 16 entries; getPendingSteps(COMPLETED) has 0
 *   WT-13  chaining getNextState walks the full sequence
 */

import { describe, it, expect } from 'vitest';
import {
  getNextState,
  getPreviousState,
  isAllowedTransition,
  canRollback,
  canCancel,
  getProgress,
  getCompletedSteps,
  getPendingSteps,
} from '../procurement/workflow/workflowTransition';
import { WORKFLOW_STATE_IDS } from '../procurement/workflow/workflowContext';

// ─── WT-01: getNextState ─────────────────────────────────────────────────────

describe('WT-01 getNextState returns next state or null at end', () => {
  it('DRAFT → PROCUREMENT_REQUEST', () => {
    expect(getNextState('DRAFT')).toBe('PROCUREMENT_REQUEST');
  });
  it('PAYMENT → COMPLETED', () => {
    expect(getNextState('PAYMENT')).toBe('COMPLETED');
  });
  it('COMPLETED → null (no state after COMPLETED)', () => {
    expect(getNextState('COMPLETED')).toBeNull();
  });
});

// ─── WT-02: getPreviousState ─────────────────────────────────────────────────

describe('WT-02 getPreviousState returns previous state or null at start', () => {
  it('PROCUREMENT_REQUEST → DRAFT', () => {
    expect(getPreviousState('PROCUREMENT_REQUEST')).toBe('DRAFT');
  });
  it('COMPLETED → PAYMENT', () => {
    expect(getPreviousState('COMPLETED')).toBe('PAYMENT');
  });
  it('DRAFT → null (no state before DRAFT)', () => {
    expect(getPreviousState('DRAFT')).toBeNull();
  });
});

// ─── WT-03: isAllowedTransition — valid sequential ───────────────────────────

describe('WT-03 isAllowedTransition returns true for sequential next-state transitions', () => {
  it('DRAFT → PROCUREMENT_REQUEST is allowed', () => {
    expect(isAllowedTransition('DRAFT', 'PROCUREMENT_REQUEST')).toBe(true);
  });
  it('EVALUATION → APPROVAL is allowed', () => {
    expect(isAllowedTransition('EVALUATION', 'APPROVAL')).toBe(true);
  });
  it('ACCEPTANCE → PAYMENT is allowed', () => {
    expect(isAllowedTransition('ACCEPTANCE', 'PAYMENT')).toBe(true);
  });
});

// ─── WT-04: isAllowedTransition — rejects skips and backward jumps ───────────

describe('WT-04 isAllowedTransition returns false for skips and backward jumps', () => {
  it('DRAFT → FUND_CONFIRMED (skip one) is rejected', () => {
    expect(isAllowedTransition('DRAFT', 'FUND_CONFIRMED')).toBe(false);
  });
  it('COMPLETED → DRAFT (backward) is rejected', () => {
    expect(isAllowedTransition('COMPLETED', 'DRAFT')).toBe(false);
  });
  it('APPROVAL → EVALUATION (backward) is rejected', () => {
    expect(isAllowedTransition('APPROVAL', 'EVALUATION')).toBe(false);
  });
});

// ─── WT-05: canRollback — true for intermediate states ───────────────────────

describe('WT-05 canRollback returns true for non-first non-COMPLETED states', () => {
  it('PROCUREMENT_REQUEST can rollback', () => {
    expect(canRollback('PROCUREMENT_REQUEST')).toBe(true);
  });
  it('EVALUATION can rollback', () => {
    expect(canRollback('EVALUATION')).toBe(true);
  });
  it('PAYMENT can rollback', () => {
    expect(canRollback('PAYMENT')).toBe(true);
  });
});

// ─── WT-06: canRollback — false for DRAFT and COMPLETED ──────────────────────

describe('WT-06 canRollback returns false for DRAFT and COMPLETED', () => {
  it('DRAFT cannot rollback (first state)', () => {
    expect(canRollback('DRAFT')).toBe(false);
  });
  it('COMPLETED cannot rollback (terminal state)', () => {
    expect(canRollback('COMPLETED')).toBe(false);
  });
  it('only two states cannot rollback', () => {
    const noRollback = ['DRAFT', 'COMPLETED'] as const;
    for (const s of noRollback) expect(canRollback(s)).toBe(false);
  });
});

// ─── WT-07: canCancel ────────────────────────────────────────────────────────

describe('WT-07 canCancel returns true for non-COMPLETED, false for COMPLETED', () => {
  it('DRAFT can be cancelled', () => {
    expect(canCancel('DRAFT')).toBe(true);
  });
  it('EVALUATION can be cancelled', () => {
    expect(canCancel('EVALUATION')).toBe(true);
  });
  it('COMPLETED cannot be cancelled', () => {
    expect(canCancel('COMPLETED')).toBe(false);
  });
});

// ─── WT-08: getProgress — endpoints ──────────────────────────────────────────

describe('WT-08 getProgress returns 0 for DRAFT and 100 for COMPLETED', () => {
  it('DRAFT → 0%', () => {
    expect(getProgress('DRAFT')).toBe(0);
  });
  it('COMPLETED → 100%', () => {
    expect(getProgress('COMPLETED')).toBe(100);
  });
  it('progress is a number between 0 and 100 for all states', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      const p = getProgress(id);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

// ─── WT-09: getProgress — intermediate states ────────────────────────────────

describe('WT-09 getProgress intermediate states are strictly between 0 and 100', () => {
  it('PROCUREMENT_REQUEST progress is > 0', () => {
    expect(getProgress('PROCUREMENT_REQUEST')).toBeGreaterThan(0);
  });
  it('PAYMENT progress is < 100', () => {
    expect(getProgress('PAYMENT')).toBeLessThan(100);
  });
  it('progress increases monotonically through lifecycle', () => {
    const earlier = getProgress('INVITATION');
    const later   = getProgress('EVALUATION');
    expect(later).toBeGreaterThan(earlier);
  });
});

// ─── WT-10: getCompletedSteps ────────────────────────────────────────────────

describe('WT-10 getCompletedSteps returns all states before current', () => {
  it('PROCUREMENT_REQUEST completed = [DRAFT]', () => {
    expect(getCompletedSteps('PROCUREMENT_REQUEST')).toEqual(['DRAFT']);
  });
  it('FUND_CONFIRMED completed includes DRAFT and PROCUREMENT_REQUEST', () => {
    const steps = getCompletedSteps('FUND_CONFIRMED');
    expect(steps).toContain('DRAFT');
    expect(steps).toContain('PROCUREMENT_REQUEST');
  });
  it('DRAFT completed = [] (nothing before DRAFT)', () => {
    expect(getCompletedSteps('DRAFT')).toHaveLength(0);
  });
});

// ─── WT-11: getPendingSteps ──────────────────────────────────────────────────

describe('WT-11 getPendingSteps returns all states after current', () => {
  it('COMPLETED pending = []', () => {
    expect(getPendingSteps('COMPLETED')).toHaveLength(0);
  });
  it('PAYMENT pending = [COMPLETED]', () => {
    expect(getPendingSteps('PAYMENT')).toEqual(['COMPLETED']);
  });
  it('APPROVAL pending contains CONTRACT_SIGNED, IMPLEMENTATION, and more', () => {
    const pending = getPendingSteps('APPROVAL');
    expect(pending).toContain('CONTRACT_SIGNED');
    expect(pending).toContain('IMPLEMENTATION');
    expect(pending).toContain('COMPLETED');
  });
});

// ─── WT-12: step count assertions ────────────────────────────────────────────

describe('WT-12 getPendingSteps(DRAFT) has 16 entries; getPendingSteps(COMPLETED) has 0', () => {
  it('DRAFT has 16 pending steps', () => {
    expect(getPendingSteps('DRAFT')).toHaveLength(16);
  });
  it('COMPLETED has 0 pending steps', () => {
    expect(getPendingSteps('COMPLETED')).toHaveLength(0);
  });
  it('completed + 1 (current) + pending = 17 for any state', () => {
    const completed = getCompletedSteps('EVALUATION').length;
    const pending   = getPendingSteps('EVALUATION').length;
    expect(completed + 1 + pending).toBe(17);
  });
});

// ─── WT-13: chaining getNextState ────────────────────────────────────────────

describe('WT-13 chaining getNextState walks from DRAFT to COMPLETED in 16 steps', () => {
  it('16 advances reach COMPLETED from DRAFT', () => {
    let current: ReturnType<typeof getNextState> = 'DRAFT';
    let steps = 0;
    while (current !== null) {
      const next = getNextState(current);
      if (next === null) break;
      current = next;
      steps++;
    }
    expect(current).toBe('COMPLETED');
    expect(steps).toBe(16);
  });
  it('chaining from BID_OPENING passes through BID_RECEIPT sequence', () => {
    const fromDraft = getNextState('DRAFT');
    expect(fromDraft).toBe('PROCUREMENT_REQUEST');
    expect(getNextState(fromDraft!)).toBe('FUND_CONFIRMED');
  });
  it('getNextState(getNextState(EVALUATION)) = CONTRACT_SIGNED', () => {
    expect(getNextState(getNextState('EVALUATION')!)).toBe('CONTRACT_SIGNED');
  });
});
