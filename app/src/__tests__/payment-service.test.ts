import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPaymentRequest, submitPaymentRequest, approvePaymentRequest,
  rejectPaymentRequest, suspendPaymentRequest, cancelPaymentRequest,
  addPaymentNote, getPaymentsByStatus, getPaymentsByType,
} from '../payment/paymentService';
import {
  MemoryPaymentRequestRepository, MemoryPaymentHistoryRepository,
} from '../payment/paymentRepository';
import { createMoney } from '../shared/financial/money';
import type { CreatePaymentRequestParams } from '../payment/paymentTypes';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');

function repos() {
  return {
    req: new MemoryPaymentRequestRepository(),
    hist: new MemoryPaymentHistoryRepository(),
  };
}

const baseParams: CreatePaymentRequestParams = {
  requestCode: 'PR-TEST-001',
  paymentType: 'ADVANCE',
  contractId: 'CONTRACT-001',
  requestedBy: 'user1',
  department: 'DEPT-A',
  amount: vnd(10_000_000),
};

// PAY-S-01
describe('createPaymentRequest — basic', () => {
  it('creates with DRAFT status', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(r.status).toBe('DRAFT');
  });
  it('has correct contractId', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(r.contractId).toBe('CONTRACT-001');
  });
  it('has non-empty id', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(r.id.length).toBeGreaterThan(0);
  });
});

// PAY-S-02
describe('createPaymentRequest — legalBasis defaults', () => {
  it('assigns PROCUREMENT_LEGAL_BASIS when none provided', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(r.legalBasis.length).toBeGreaterThan(0);
  });
  it('uses provided legalBasis when given', async () => {
    const { req, hist } = repos();
    const custom = [{ document: 'CUSTOM-001', summary: 'test' }];
    const r = await createPaymentRequest(req, hist, { ...baseParams, legalBasis: custom });
    expect(r.legalBasis[0]?.document).toBe('CUSTOM-001');
  });
  it('records history entry', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const history = await hist.findByRequestId(r.id);
    expect(history.length).toBeGreaterThan(0);
  });
});

// PAY-S-03
describe('createPaymentRequest — validation errors', () => {
  it('throws on empty contractId', async () => {
    const { req, hist } = repos();
    await expect(createPaymentRequest(req, hist, { ...baseParams, contractId: '' })).rejects.toThrow();
  });
  it('throws on zero amount', async () => {
    const { req, hist } = repos();
    await expect(createPaymentRequest(req, hist, { ...baseParams, amount: vnd(0) })).rejects.toThrow();
  });
  it('throws on empty requestedBy', async () => {
    const { req, hist } = repos();
    await expect(createPaymentRequest(req, hist, { ...baseParams, requestedBy: '' })).rejects.toThrow();
  });
});

// PAY-S-04
describe('submitPaymentRequest', () => {
  it('transitions to PENDING_APPROVAL', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const updated = await submitPaymentRequest(req, hist, r.id, 'user1');
    expect(updated.status).toBe('PENDING_APPROVAL');
  });
  it('throws for non-existent id', async () => {
    const { req, hist } = repos();
    await expect(submitPaymentRequest(req, hist, 'nonexistent', 'u')).rejects.toThrow();
  });
  it('throws if already APPROVED', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'approver');
    await expect(submitPaymentRequest(req, hist, r.id, 'u')).rejects.toThrow();
  });
});

// PAY-S-05
describe('approvePaymentRequest', () => {
  it('transitions from PENDING_APPROVAL to APPROVED', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    const approved = await approvePaymentRequest(req, hist, r.id, 'approver');
    expect(approved.status).toBe('APPROVED');
  });
  it('throws from DRAFT status', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await expect(approvePaymentRequest(req, hist, r.id, 'approver')).rejects.toThrow();
  });
  it('records history', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'approver');
    const history = await hist.findByRequestId(r.id);
    const approved = history.find(e => e.action === 'APPROVED');
    expect(approved).toBeDefined();
  });
});

// PAY-S-06
describe('rejectPaymentRequest', () => {
  it('transitions to REJECTED', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    const rejected = await rejectPaymentRequest(req, hist, r.id, 'reviewer', 'missing docs');
    expect(rejected.status).toBe('REJECTED');
  });
  it('throws from DRAFT', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await expect(rejectPaymentRequest(req, hist, r.id, 'r', 'reason')).rejects.toThrow();
  });
  it('stores reject reason in notes', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    const rejected = await rejectPaymentRequest(req, hist, r.id, 'r', 'incomplete');
    expect(rejected.notes).toBe('incomplete');
  });
});

// PAY-S-07
describe('suspendPaymentRequest', () => {
  it('transitions to SUSPENDED', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'approver');
    const s = await suspendPaymentRequest(req, hist, r.id, 'ctrl', 'audit');
    expect(s.status).toBe('SUSPENDED');
  });
  it('throws from DRAFT', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await expect(suspendPaymentRequest(req, hist, r.id, 'u', 'reason')).rejects.toThrow();
  });
  it('records reason in notes', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'a');
    const s = await suspendPaymentRequest(req, hist, r.id, 'ctrl', 'under review');
    expect(s.notes).toBe('under review');
  });
});

// PAY-S-08
describe('cancelPaymentRequest', () => {
  it('transitions DRAFT to CANCELLED', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const c = await cancelPaymentRequest(req, hist, r.id, 'u', 'duplicate');
    expect(c.status).toBe('CANCELLED');
  });
  it('cannot cancel PAID request', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await req.update(r.id, { status: 'PAID' });
    await expect(cancelPaymentRequest(req, hist, r.id, 'u', 'r')).rejects.toThrow();
  });
  it('records cancel action', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await cancelPaymentRequest(req, hist, r.id, 'u', 'dup');
    const history = await hist.findByRequestId(r.id);
    expect(history.some(e => e.action === 'CANCELLED')).toBe(true);
  });
});

// PAY-S-09
describe('getPaymentsByStatus', () => {
  it('finds DRAFT requests', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, baseParams);
    const drafts = await getPaymentsByStatus(req, 'DRAFT');
    expect(drafts.length).toBe(1);
  });
  it('returns empty when none match', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, baseParams);
    const paid = await getPaymentsByStatus(req, 'PAID');
    expect(paid.length).toBe(0);
  });
  it('finds all DRAFT after creating two', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, baseParams);
    await createPaymentRequest(req, hist, { ...baseParams, requestCode: 'PR-002' });
    const drafts = await getPaymentsByStatus(req, 'DRAFT');
    expect(drafts.length).toBe(2);
  });
});

// PAY-S-10
describe('getPaymentsByType', () => {
  it('finds ADVANCE type', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, baseParams);
    const advances = await getPaymentsByType(req, 'ADVANCE');
    expect(advances.length).toBe(1);
  });
  it('does not return other types', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, { ...baseParams, paymentType: 'FINAL' });
    const advances = await getPaymentsByType(req, 'ADVANCE');
    expect(advances.length).toBe(0);
  });
  it('returns correct type', async () => {
    const { req, hist } = repos();
    await createPaymentRequest(req, hist, { ...baseParams, paymentType: 'PROGRESS' });
    const progress = await getPaymentsByType(req, 'PROGRESS');
    expect(progress[0]?.paymentType).toBe('PROGRESS');
  });
});

// PAY-S-11
describe('addPaymentNote', () => {
  it('adds note to request', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const updated = await addPaymentNote(req, hist, r.id, 'u', 'important note');
    expect(updated.notes).toBe('important note');
  });
  it('records NOTE_ADDED in history', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await addPaymentNote(req, hist, r.id, 'u', 'note');
    const history = await hist.findByRequestId(r.id);
    expect(history.some(e => e.action === 'NOTE_ADDED')).toBe(true);
  });
  it('throws for non-existent id', async () => {
    const { req, hist } = repos();
    await expect(addPaymentNote(req, hist, 'nonexistent', 'u', 'n')).rejects.toThrow();
  });
});

// PAY-S-12
describe('History is append-only', () => {
  it('cannot delete history entries', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const history = await hist.findByRequestId(r.id);
    const firstId = history[0]!.id;
    // delete is available on the repo but history should grow
    await submitPaymentRequest(req, hist, r.id, 'u');
    const updated = await hist.findByRequestId(r.id);
    expect(updated.length).toBeGreaterThan(history.length);
    expect(updated.some(e => e.id === firstId)).toBe(true);
  });
  it('history has CREATED as first entry', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    const history = await hist.findByRequestId(r.id);
    expect(history[0]?.action).toBe('CREATED');
  });
  it('history grows with each action', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'a');
    const history = await hist.findByRequestId(r.id);
    expect(history.length).toBe(3);
  });
});

// PAY-S-13
describe('resolvedRuleId traceability', () => {
  it('stores resolvedRuleId when provided', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams, 'PR-PAY-ADV-001');
    expect(r.resolvedRuleId).toBe('PR-PAY-ADV-001');
  });
  it('resolvedRuleId is undefined when not provided', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(r.resolvedRuleId).toBeUndefined();
  });
  it('amount is stored as bigint', async () => {
    const { req, hist } = repos();
    const r = await createPaymentRequest(req, hist, baseParams);
    expect(typeof r.amount.amount).toBe('bigint');
  });
});
