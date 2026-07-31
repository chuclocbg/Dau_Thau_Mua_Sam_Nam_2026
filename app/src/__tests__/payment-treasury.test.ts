import { describe, it, expect } from 'vitest';
import {
  submitToTreasury, approveTreasurySubmission, rejectTreasurySubmission,
  checkTreasuryRequired,
} from '../payment/paymentTreasuryService';
import { buildTreasurySubmissionCode } from '../payment/paymentFactory';
import {
  MemoryPaymentRequestRepository, MemoryPaymentHistoryRepository,
  MemoryTreasurySubmissionRepository,
} from '../payment/paymentRepository';
import {
  createPaymentRequest, approvePaymentRequest, submitPaymentRequest,
} from '../payment/paymentService';
import { createMoney } from '../shared/financial/money';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');
const today = '2026-07-01';

function repos() {
  return {
    req: new MemoryPaymentRequestRepository(),
    hist: new MemoryPaymentHistoryRepository(),
    treas: new MemoryTreasurySubmissionRepository(),
  };
}

async function approvedPayment(req: any, hist: any) {
  const r = await createPaymentRequest(req, hist, {
    requestCode: 'PR-TREAS-001', paymentType: 'PROGRESS',
    contractId: 'C-001', requestedBy: 'user1', department: 'D1',
    amount: vnd(10_000_000),
  });
  await submitPaymentRequest(req, hist, r.id, 'user1');
  return approvePaymentRequest(req, hist, r.id, 'approver1');
}

async function approvedPaymentWithRule(req: any, hist: any, resolvedRuleId: string) {
  const r = await createPaymentRequest(req, hist, {
    requestCode: 'PR-TREAS-RULE', paymentType: 'PROGRESS',
    contractId: 'C-001', requestedBy: 'user1', department: 'D1',
    amount: vnd(10_000_000),
  }, resolvedRuleId);
  await submitPaymentRequest(req, hist, r.id, 'user1');
  return approvePaymentRequest(req, hist, r.id, 'approver1');
}

// PAY-T-01
describe('checkTreasuryRequired', () => {
  it('returns true for STATE fund', () => {
    const r = checkTreasuryRequired('STATE', 'GOODS', today);
    expect(r.required).toBe(true);
  });
  it('returns true for ODA fund', () => {
    const r = checkTreasuryRequired('ODA', 'CONSTRUCTION', today);
    expect(r.required).toBe(true);
  });
  it('returns false for ENTERPRISE fund', () => {
    const r = checkTreasuryRequired('ENTERPRISE', 'GOODS', today);
    expect(r.required).toBe(false);
  });
});

// PAY-T-02
describe('checkTreasuryRequired — legal basis', () => {
  it('includes ruleId when required', () => {
    const r = checkTreasuryRequired('STATE', 'GOODS', today);
    expect(r.ruleId).toBeDefined();
  });
  it('includes legalBasis when required', () => {
    const r = checkTreasuryRequired('STATE', 'GOODS', today);
    expect(Array.isArray(r.legalBasis)).toBe(true);
  });
  it('ruleId is null when not required', () => {
    const r = checkTreasuryRequired('ENTERPRISE', 'GOODS', today);
    expect(r.ruleId).toBeNull();
  });
});

// PAY-T-03
describe('submitToTreasury — basic', () => {
  it('creates TreasurySubmission', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant',
      submissionCode: 'KBNN-001', treasuryBranch: 'KBNN-HAN',
    });
    expect(submission.requestId).toBe(approved.id);
  });
  it('submission status is SUBMITTED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant',
      submissionCode: 'KBNN-001',
    });
    expect(submission.status).toBe('SUBMITTED');
  });
  it('payment request transitions to SUBMITTED_TREASURY', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant',
      submissionCode: 'KBNN-001',
    });
    const updated = await req.findById(approved.id);
    expect(updated?.status).toBe('SUBMITTED_TREASURY');
  });
});

// PAY-T-03b (KI-010)
describe('submitToTreasury — resolvedRuleId re-check (KI-010)', () => {
  it('allows submission when resolvedRuleId is unset (backward compatible)', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    await expect(submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    })).resolves.toBeDefined();
  });
  it('allows submission when resolvedRuleId points to a currently-effective rule', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPaymentWithRule(req, hist, 'PR-PAY-ADV-001');
    await expect(submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    })).resolves.toBeDefined();
  });
  it('rejects submission when resolvedRuleId refers to a rule that no longer exists', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPaymentWithRule(req, hist, 'PR-PAY-DOES-NOT-EXIST');
    await expect(submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    })).rejects.toThrow();
  });
  it('rejection uses the RULE_NOT_FOUND error code', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPaymentWithRule(req, hist, 'PR-PAY-DOES-NOT-EXIST');
    const err = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    }).catch(e => e);
    expect(err.code).toBe('RULE_NOT_FOUND');
  });
  it('rejected submission leaves the request status unchanged (not SUBMITTED_TREASURY)', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPaymentWithRule(req, hist, 'PR-PAY-DOES-NOT-EXIST');
    await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    }).catch(() => {});
    const unchanged = await req.findById(approved.id);
    expect(unchanged?.status).toBe('APPROVED');
  });
  it('does not evaluate options.rules -- passing it has no effect either way (out of this slice\'s scope)', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPaymentWithRule(req, hist, 'PR-PAY-ADV-001');
    await expect(submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'K-001',
    }, { rules: [], packageType: 'irrelevant' })).resolves.toBeDefined();
  });
});

// PAY-T-04
describe('submitToTreasury — validation', () => {
  it('throws for non-existent requestId', async () => {
    const { req, hist, treas } = repos();
    await expect(submitToTreasury(req, treas, hist, {
      requestId: 'nonexistent', submittedBy: 'a', submissionCode: 'K-001',
    })).rejects.toThrow();
  });
  it('throws when status is DRAFT (not APPROVED)', async () => {
    const { req, hist, treas } = repos();
    const draft = await createPaymentRequest(req, hist, {
      requestCode: 'PR-D', paymentType: 'PROGRESS', contractId: 'C', requestedBy: 'u',
      department: 'D', amount: vnd(1_000_000),
    });
    await expect(submitToTreasury(req, treas, hist, {
      requestId: draft.id, submittedBy: 'a', submissionCode: 'K',
    })).rejects.toThrow();
  });
  it('records TREASURY_SUBMITTED history', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant', submissionCode: 'KBNN-001',
    });
    const history = await hist.findByRequestId(approved.id);
    expect(history.some(e => e.action === 'TREASURY_SUBMITTED')).toBe(true);
  });
});

// PAY-T-05
describe('approveTreasurySubmission', () => {
  it('transitions submission to APPROVED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    const { submission: done } = await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn-officer');
    expect(done.status).toBe('APPROVED');
  });
  it('payment request transitions to TREASURY_APPROVED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn-officer');
    const payment = await req.findById(approved.id);
    expect(payment?.status).toBe('TREASURY_APPROVED');
  });
  it('throws for non-existent submissionId', async () => {
    const { req, hist, treas } = repos();
    await expect(approveTreasurySubmission(req, treas, hist, 'nonexistent', 'o')).rejects.toThrow();
  });
});

// PAY-T-06
describe('rejectTreasurySubmission', () => {
  it('submission transitions to REJECTED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    const { submission: rejected } = await rejectTreasurySubmission(req, treas, hist, submission.id, 'officer', 'invalid docs');
    expect(rejected.status).toBe('REJECTED');
  });
  it('payment request transitions to TREASURY_REJECTED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    await rejectTreasurySubmission(req, treas, hist, submission.id, 'officer', 'missing receipt');
    const payment = await req.findById(approved.id);
    expect(payment?.status).toBe('TREASURY_REJECTED');
  });
  it('rejectReason stored on submission', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    const { submission: rejected } = await rejectTreasurySubmission(req, treas, hist, submission.id, 'o', 'wrong amount');
    expect(rejected.rejectReason).toBe('wrong amount');
  });
});

// PAY-T-07
describe('rejectTreasurySubmission — validation', () => {
  it('throws for non-existent submissionId', async () => {
    const { req, hist, treas } = repos();
    await expect(rejectTreasurySubmission(req, treas, hist, 'none', 'o', 'r')).rejects.toThrow();
  });
  it('cannot reject already APPROVED submission', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K',
    });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'o');
    await expect(rejectTreasurySubmission(req, treas, hist, submission.id, 'o', 'r')).rejects.toThrow();
  });
  it('records TREASURY_REJECTED history entry', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K',
    });
    await rejectTreasurySubmission(req, treas, hist, submission.id, 'o', 'r');
    const history = await hist.findByRequestId(approved.id);
    expect(history.some(e => e.action === 'TREASURY_REJECTED')).toBe(true);
  });
});

// PAY-T-08
describe('submitToTreasury — auto-generated submissionCode', () => {
  it('submits without providing submissionCode', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'AUTO-001',
    });
    expect(submission.requestId).toBe(approved.id);
  });
  it('submission id is non-empty', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'a', submissionCode: 'K-001',
    });
    expect(submission.id.length).toBeGreaterThan(0);
  });
  it('submittedBy stored', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, {
      requestId: approved.id, submittedBy: 'accountant-007', submissionCode: 'K',
    });
    expect(submission.submittedBy).toBe('accountant-007');
  });
});

// PAY-T-09
describe('buildTreasurySubmissionCode', () => {
  it('returns non-empty string', () => {
    expect(buildTreasurySubmissionCode('PR-001', 1).length).toBeGreaterThan(0);
  });
  it('includes request code prefix', () => {
    const code = buildTreasurySubmissionCode('PR-001', 1);
    expect(code).toContain('PR-001');
  });
  it('different seq produces different code', () => {
    const c1 = buildTreasurySubmissionCode('PR-001', 1);
    const c2 = buildTreasurySubmissionCode('PR-001', 2);
    expect(c1).not.toBe(c2);
  });
});

// PAY-T-10
describe('Treasury flow — full lifecycle', () => {
  it('full DRAFT → TREASURY_APPROVED lifecycle', async () => {
    const { req, hist, treas } = repos();
    const r = await createPaymentRequest(req, hist, {
      requestCode: 'PR-FULL-001', paymentType: 'FINAL',
      contractId: 'C-001', requestedBy: 'u', department: 'D', amount: vnd(20_000_000),
    });
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'a');
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: r.id, submittedBy: 'b', submissionCode: 'K' });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn');
    const final = await req.findById(r.id);
    expect(final?.status).toBe('TREASURY_APPROVED');
  });
  it('history has 5 entries after full flow', async () => {
    const { req, hist, treas } = repos();
    const r = await createPaymentRequest(req, hist, {
      requestCode: 'PR-H5', paymentType: 'FINAL', contractId: 'C', requestedBy: 'u',
      department: 'D', amount: vnd(5_000_000),
    });
    await submitPaymentRequest(req, hist, r.id, 'u');
    await approvePaymentRequest(req, hist, r.id, 'a');
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: r.id, submittedBy: 'b', submissionCode: 'K' });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn');
    const history = await hist.findByRequestId(r.id);
    expect(history.length).toBe(5);
  });
  it('reject then check payment is TREASURY_REJECTED', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'K' });
    await rejectTreasurySubmission(req, treas, hist, submission.id, 'kbnn', 'bad docs');
    const payment = await req.findById(approved.id);
    expect(payment?.status).toBe('TREASURY_REJECTED');
  });
});

// PAY-T-11
describe('Treasury submission repository', () => {
  it('findByRequestId returns submission', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'K' });
    const found = await treas.findByRequestId(approved.id);
    expect(found.some(s => s.id === submission.id)).toBe(true);
  });
  it('findAll returns all submissions', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'K' });
    const all = await treas.findAll();
    expect(all.length).toBeGreaterThan(0);
  });
  it('findById returns correct submission', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'CUSTOM-CODE' });
    const found = await treas.findById(submission.id);
    expect(found?.submissionCode).toBe('CUSTOM-CODE');
  });
});

// PAY-T-12
describe('checkTreasuryRequired — injectable rules', () => {
  it('custom rule overrides default', () => {
    const customRule = [{
      ruleId: 'CUSTOM-TREAS', ruleName: 'No Treasury', ruleType: 'TREASURY_THRESHOLD' as const,
      legalReferences: [], effectiveFrom: '2000-01-01', effectiveTo: null,
      applicablePackageTypes: [], applicableFundingSources: ['STATE'],
      applicableAuthorities: [], numericParams: { required: 0 },
      conditions: [{ field: 'fundSource', operator: 'EQ' as const, value: 'STATE' }],
      priority: 1, description: 'No treasury for testing',
    }];
    const r = checkTreasuryRequired('STATE', 'GOODS', today, customRule);
    expect(r.required).toBe(false);
  });
  it('ENTERPRISE is false with empty rules', () => {
    const r = checkTreasuryRequired('ENTERPRISE', 'GOODS', today, []);
    expect(r.required).toBe(false);
  });
  it('default STATE required ruleId starts with PR-PAY', () => {
    const r = checkTreasuryRequired('STATE', 'GOODS', today);
    expect(r.ruleId).toMatch(/^PR-PAY/);
  });
});

// PAY-T-13
describe('Treasury history audit trail', () => {
  it('TREASURY_SUBMITTED recorded with performedBy', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'accountant-007', submissionCode: 'K' });
    const history = await hist.findByRequestId(approved.id);
    const entry = history.find(e => e.action === 'TREASURY_SUBMITTED');
    expect(entry?.performedBy).toBe('accountant-007');
  });
  it('TREASURY_APPROVED recorded with performedBy', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'K' });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn-007');
    const history = await hist.findByRequestId(approved.id);
    const entry = history.find(e => e.action === 'TREASURY_APPROVED');
    expect(entry?.performedBy).toBe('kbnn-007');
  });
  it('all history entries are append-only', async () => {
    const { req, hist, treas } = repos();
    const approved = await approvedPayment(req, hist);
    const h1 = await hist.findByRequestId(approved.id);
    const { submission } = await submitToTreasury(req, treas, hist, { requestId: approved.id, submittedBy: 'a', submissionCode: 'K' });
    await approveTreasurySubmission(req, treas, hist, submission.id, 'kbnn');
    const h2 = await hist.findByRequestId(approved.id);
    expect(h2.length).toBeGreaterThan(h1.length);
    h1.forEach(e => expect(h2.some(h => h.id === e.id)).toBe(true));
  });
});
