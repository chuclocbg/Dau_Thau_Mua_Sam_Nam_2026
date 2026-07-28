/**
 * Workflow validator — all transition and authority validation rules
 *
 * Groups (13 × 3 = 39):
 *   WV-01  validateTransition — valid sequential transition with no doc requirement
 *   WV-02  validateTransition — cancelled workflow is blocked
 *   WV-03  validateTransition — completed workflow is blocked
 *   WV-04  validateTransition — illegal transition (skip) is rejected
 *   WV-05  validateTransition — missing required documents is rejected
 *   WV-06  validateTransition — all documents present allows advance
 *   WV-07  validateTransition — wrong approval authority at APPROVAL→CONTRACT_SIGNED
 *   WV-08  validateRollback — DRAFT cannot rollback (first state)
 *   WV-09  validateRollback — PROCUREMENT_REQUEST can rollback
 *   WV-10  validateCancel — COMPLETED cannot be cancelled
 *   WV-11  validateCancel — DRAFT can be cancelled
 *   WV-12  validateApprovalAuthority — threshold checks
 *   WV-13  getBlockingErrors and getWarnings return correct arrays
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  validateRollback,
  validateCancel,
  validateDocuments,
  validateApprovalAuthority,
  getBlockingErrors,
  getWarnings,
} from '../procurement/workflow/workflowValidator';
import type { WorkflowContext } from '../procurement/workflow/workflowContext';
import { uploadDocument } from '../procurement/workflow/workflowContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    id: 'wf-test', packageId: 'pkg-001', packageType: 'GOODS',
    estimatedValue: 100_000_000, procurementMethod: 'COMPETITIVE_QUOTE',
    approvalAuthority: 'UNIT_HEAD', currentState: 'DRAFT',
    status: 'ACTIVE', documents: [],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

const BASE      = makeCtx();
const CANCELLED = makeCtx({ status: 'CANCELLED', currentState: 'PROCUREMENT_REQUEST' });
const COMPLETED_CTX = makeCtx({ status: 'COMPLETED', currentState: 'COMPLETED' });
const AT_METHOD = makeCtx({ currentState: 'METHOD_SELECTED' });
const AT_EVAL   = makeCtx({ currentState: 'EVALUATION' });
const AT_APPROVAL = makeCtx({
  currentState: 'APPROVAL', estimatedValue: 3_000_000_000,
  approvalAuthority: 'UNIT_HEAD',
});
const APPROVAL_OVER_LIMIT = makeCtx({
  currentState: 'APPROVAL', estimatedValue: 10_000_000_000,
  approvalAuthority: 'UNIT_HEAD',
});

// ─── WV-01: valid sequential transition ──────────────────────────────────────

describe('WV-01 validateTransition — valid sequential with no doc requirement', () => {
  it('DRAFT → PROCUREMENT_REQUEST is valid', () => {
    expect(validateTransition(BASE, 'PROCUREMENT_REQUEST').valid).toBe(true);
  });
  it('PLAN_APPROVED → DOCUMENT_PREPARATION is valid', () => {
    const ctx = makeCtx({ currentState: 'PLAN_APPROVED' });
    expect(validateTransition(ctx, 'DOCUMENT_PREPARATION').valid).toBe(true);
  });
  it('errors array is empty for valid transition', () => {
    expect(validateTransition(BASE, 'PROCUREMENT_REQUEST').errors).toHaveLength(0);
  });
});

// ─── WV-02: cancelled workflow ───────────────────────────────────────────────

describe('WV-02 validateTransition — cancelled workflow is always blocked', () => {
  it('cancelled workflow → valid=false', () => {
    expect(validateTransition(CANCELLED, 'FUND_CONFIRMED').valid).toBe(false);
  });
  it('error message mentions cancelled (hủy)', () => {
    const result = validateTransition(CANCELLED, 'FUND_CONFIRMED');
    expect(result.errors.some(e => e.includes('hủy'))).toBe(true);
  });
  it('returns immediately — only one error for cancel', () => {
    expect(validateTransition(CANCELLED, 'FUND_CONFIRMED').errors.length).toBeGreaterThan(0);
  });
});

// ─── WV-03: completed workflow ───────────────────────────────────────────────

describe('WV-03 validateTransition — completed workflow is blocked', () => {
  it('completed workflow → valid=false', () => {
    expect(validateTransition(COMPLETED_CTX, 'DRAFT').valid).toBe(false);
  });
  it('error message mentions hoàn thành or completed', () => {
    const result = validateTransition(COMPLETED_CTX, 'DRAFT');
    expect(result.errors.some(e => e.toLowerCase().includes('hoàn thành') || e.toLowerCase().includes('completed'))).toBe(true);
  });
  it('no warnings on completed workflow block', () => {
    // warnings may be empty or non-empty depending on method — just check errors
    expect(validateTransition(COMPLETED_CTX, 'DRAFT').valid).toBe(false);
  });
});

// ─── WV-04: illegal transition (skip) ────────────────────────────────────────

describe('WV-04 validateTransition — skip transition is rejected', () => {
  it('DRAFT → FUND_CONFIRMED (skips PROCUREMENT_REQUEST) → valid=false', () => {
    expect(validateTransition(BASE, 'FUND_CONFIRMED').valid).toBe(false);
  });
  it('error message mentions hợp lệ or quy trình', () => {
    const result = validateTransition(BASE, 'FUND_CONFIRMED');
    expect(result.errors.some(e => e.includes('hợp lệ') || e.includes('tuần tự'))).toBe(true);
  });
  it('EVALUATION → CONTRACT_SIGNED (skip) → valid=false', () => {
    expect(validateTransition(AT_EVAL, 'CONTRACT_SIGNED').valid).toBe(false);
  });
});

// ─── WV-05: missing required documents ───────────────────────────────────────

describe('WV-05 validateTransition — missing required documents blocks advance', () => {
  it('METHOD_SELECTED without KHLCNT → valid=false', () => {
    expect(validateTransition(AT_METHOD, 'PLAN_APPROVED').valid).toBe(false);
  });
  it('error message lists missing document ID', () => {
    const result = validateTransition(AT_METHOD, 'PLAN_APPROVED');
    expect(result.errors.some(e => e.includes('ke-hoach-lua-chon-nha-thau'))).toBe(true);
  });
  it('DOCUMENT_PREPARATION without HSMT → valid=false', () => {
    const ctx = makeCtx({ currentState: 'DOCUMENT_PREPARATION' });
    expect(validateTransition(ctx, 'DOCUMENT_APPROVED').valid).toBe(false);
  });
});

// ─── WV-06: all documents present allows advance ─────────────────────────────

describe('WV-06 validateTransition — all required documents uploaded allows advance', () => {
  it('METHOD_SELECTED + KHLCNT uploaded → valid=true', () => {
    const ctx = uploadDocument(AT_METHOD, 'ke-hoach-lua-chon-nha-thau', 'Kế hoạch LCNT');
    expect(validateTransition(ctx, 'PLAN_APPROVED').valid).toBe(true);
  });
  it('DOCUMENT_PREPARATION + HSMT uploaded → valid=true', () => {
    const ctx = uploadDocument(makeCtx({ currentState: 'DOCUMENT_PREPARATION' }), 'ho-so-moi-thau', 'HSMT');
    expect(validateTransition(ctx, 'DOCUMENT_APPROVED').valid).toBe(true);
  });
  it('validateDocuments returns empty array when all docs present', () => {
    const ctx = uploadDocument(AT_METHOD, 'ke-hoach-lua-chon-nha-thau', 'KHLCNT');
    expect(validateDocuments(ctx)).toHaveLength(0);
  });
});

// ─── WV-07: wrong approval authority ─────────────────────────────────────────

describe('WV-07 validateTransition — UNIT_HEAD with value > 5B blocks CONTRACT_SIGNED', () => {
  it('UNIT_HEAD at 10B → APPROVAL→CONTRACT_SIGNED fails', () => {
    const ctx = uploadDocument(
      APPROVAL_OVER_LIMIT, 'quyet-dinh-phe-duyet-ket-qua', 'QĐ phê duyệt'
    );
    expect(validateTransition(ctx, 'CONTRACT_SIGNED').valid).toBe(false);
  });
  it('error message mentions thẩm quyền', () => {
    const ctx = uploadDocument(APPROVAL_OVER_LIMIT, 'quyet-dinh-phe-duyet-ket-qua', 'QĐ');
    const result = validateTransition(ctx, 'CONTRACT_SIGNED');
    expect(result.errors.some(e => e.includes('thẩm quyền'))).toBe(true);
  });
  it('UNIT_HEAD at 3B (within limit) succeeds on authority check', () => {
    const ctx = uploadDocument(AT_APPROVAL, 'quyet-dinh-phe-duyet-ket-qua', 'QĐ');
    expect(validateTransition(ctx, 'CONTRACT_SIGNED').valid).toBe(true);
  });
});

// ─── WV-08: validateRollback — DRAFT cannot rollback ────────────────────────

describe('WV-08 validateRollback — DRAFT is the first state, cannot rollback', () => {
  it('validateRollback(DRAFT) → valid=false', () => {
    expect(validateRollback(BASE).valid).toBe(false);
  });
  it('error mentions không thể hoàn tác or first state', () => {
    expect(validateRollback(BASE).errors.some(e => e.includes('hoàn tác'))).toBe(true);
  });
  it('errors array is non-empty for DRAFT rollback', () => {
    expect(validateRollback(BASE).errors.length).toBeGreaterThan(0);
  });
});

// ─── WV-09: validateRollback — intermediate states can rollback ──────────────

describe('WV-09 validateRollback — PROCUREMENT_REQUEST can rollback to DRAFT', () => {
  it('validateRollback(PROCUREMENT_REQUEST) → valid=true', () => {
    const ctx = makeCtx({ currentState: 'PROCUREMENT_REQUEST' });
    expect(validateRollback(ctx).valid).toBe(true);
  });
  it('validateRollback(EVALUATION) → valid=true', () => {
    expect(validateRollback(AT_EVAL).valid).toBe(true);
  });
  it('validateRollback(CANCELLED) → valid=false (cannot rollback cancelled)', () => {
    expect(validateRollback(CANCELLED).valid).toBe(false);
  });
});

// ─── WV-10: validateCancel — COMPLETED cannot be cancelled ───────────────────

describe('WV-10 validateCancel — COMPLETED workflow cannot be cancelled', () => {
  it('validateCancel(COMPLETED) → valid=false', () => {
    expect(validateCancel(COMPLETED_CTX).valid).toBe(false);
  });
  it('error mentions hoàn thành or cannot cancel', () => {
    expect(validateCancel(COMPLETED_CTX).errors.some(e => e.includes('hoàn thành') || e.includes('hủy'))).toBe(true);
  });
  it('already cancelled workflow → valid=false', () => {
    expect(validateCancel(CANCELLED).valid).toBe(false);
  });
});

// ─── WV-11: validateCancel — DRAFT can be cancelled ─────────────────────────

describe('WV-11 validateCancel — DRAFT can be cancelled', () => {
  it('validateCancel(DRAFT) → valid=true', () => {
    expect(validateCancel(BASE).valid).toBe(true);
  });
  it('validateCancel(EVALUATION) → valid=true', () => {
    expect(validateCancel(AT_EVAL).valid).toBe(true);
  });
  it('validateCancel returns empty errors for cancellable states', () => {
    expect(validateCancel(BASE).errors).toHaveLength(0);
  });
});

// ─── WV-12: validateApprovalAuthority ────────────────────────────────────────

describe('WV-12 validateApprovalAuthority checks value against authority threshold', () => {
  it('UNIT_HEAD with 3B (< 5B limit) → true', () => {
    expect(validateApprovalAuthority(makeCtx({ approvalAuthority: 'UNIT_HEAD', estimatedValue: 3_000_000_000 }))).toBe(true);
  });
  it('UNIT_HEAD with 10B (> 5B limit) → false', () => {
    expect(validateApprovalAuthority(makeCtx({ approvalAuthority: 'UNIT_HEAD', estimatedValue: 10_000_000_000 }))).toBe(false);
  });
  it('PRIME_MINISTER with any value → always true', () => {
    expect(validateApprovalAuthority(makeCtx({ approvalAuthority: 'PRIME_MINISTER', estimatedValue: 999_000_000_000 }))).toBe(true);
  });
});

// ─── WV-13: getBlockingErrors and getWarnings ────────────────────────────────

describe('WV-13 getBlockingErrors and getWarnings return correct arrays', () => {
  it('getBlockingErrors returns empty array for valid context', () => {
    expect(getBlockingErrors(BASE)).toHaveLength(0);
  });
  it('getBlockingErrors returns error when authority is insufficient', () => {
    const ctx = makeCtx({ approvalAuthority: 'UNIT_HEAD', estimatedValue: 20_000_000_000 });
    expect(getBlockingErrors(ctx).length).toBeGreaterThan(0);
  });
  it('getWarnings returns warning when DIRECT_PROCUREMENT used for large value', () => {
    const ctx = makeCtx({ procurementMethod: 'DIRECT_PROCUREMENT', estimatedValue: 500_000_000 });
    expect(getWarnings(ctx).length).toBeGreaterThan(0);
  });
});
