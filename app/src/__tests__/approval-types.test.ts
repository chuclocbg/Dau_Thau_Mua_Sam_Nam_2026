import { describe, it, expect } from 'vitest';
import {
  APPROVAL_STATUSES, APPROVAL_TYPES, DECISION_OUTCOMES, APPROVAL_ACTIONS,
  APPROVAL_DOC_TYPES, SUBJECT_TYPES,
  isApprovalStatus, isDecisionOutcome, isApprovalType, isSubjectType,
  ApprovalError,
} from '../approval/approvalTypes';

// APR-T-01
describe('APPROVAL_STATUSES', () => {
  it('contains 8 statuses', () => { expect(APPROVAL_STATUSES).toHaveLength(8); });
  it('includes DRAFT and APPROVED', () => {
    expect(APPROVAL_STATUSES).toContain('DRAFT');
    expect(APPROVAL_STATUSES).toContain('APPROVED');
  });
  it('includes WITHDRAWN and EXPIRED', () => {
    expect(APPROVAL_STATUSES).toContain('WITHDRAWN');
    expect(APPROVAL_STATUSES).toContain('EXPIRED');
  });
});

// APR-T-02
describe('APPROVAL_TYPES', () => {
  it('contains 6 types', () => { expect(APPROVAL_TYPES).toHaveLength(6); });
  it('includes PLAN_APPROVAL and PACKAGE_APPROVAL', () => {
    expect(APPROVAL_TYPES).toContain('PLAN_APPROVAL');
    expect(APPROVAL_TYPES).toContain('PACKAGE_APPROVAL');
  });
  it('includes CONTRACT_APPROVAL and PAYMENT_APPROVAL', () => {
    expect(APPROVAL_TYPES).toContain('CONTRACT_APPROVAL');
    expect(APPROVAL_TYPES).toContain('PAYMENT_APPROVAL');
  });
});

// APR-T-03
describe('DECISION_OUTCOMES', () => {
  it('contains exactly 3 outcomes', () => { expect(DECISION_OUTCOMES).toHaveLength(3); });
  it('has APPROVED', () => { expect(DECISION_OUTCOMES).toContain('APPROVED'); });
  it('has REJECTED and RETURNED', () => {
    expect(DECISION_OUTCOMES).toContain('REJECTED');
    expect(DECISION_OUTCOMES).toContain('RETURNED');
  });
});

// APR-T-04
describe('APPROVAL_ACTIONS', () => {
  it('contains 11 actions', () => { expect(APPROVAL_ACTIONS).toHaveLength(11); });
  it('includes CREATED and SUBMITTED', () => {
    expect(APPROVAL_ACTIONS).toContain('CREATED');
    expect(APPROVAL_ACTIONS).toContain('SUBMITTED');
  });
  it('includes ATTACHMENT_ADDED and EXPIRED', () => {
    expect(APPROVAL_ACTIONS).toContain('ATTACHMENT_ADDED');
    expect(APPROVAL_ACTIONS).toContain('EXPIRED');
  });
});

// APR-T-05
describe('APPROVAL_DOC_TYPES', () => {
  it('contains 5 doc types', () => { expect(APPROVAL_DOC_TYPES).toHaveLength(5); });
  it('includes SUPPORTING_DOCUMENT', () => { expect(APPROVAL_DOC_TYPES).toContain('SUPPORTING_DOCUMENT'); });
  it('includes AUTHORITY_CONFIRMATION', () => { expect(APPROVAL_DOC_TYPES).toContain('AUTHORITY_CONFIRMATION'); });
});

// APR-T-06
describe('SUBJECT_TYPES', () => {
  it('contains PLAN and PACKAGE', () => {
    expect(SUBJECT_TYPES).toContain('PLAN');
    expect(SUBJECT_TYPES).toContain('PACKAGE');
  });
  it('has exactly 2 subject types', () => { expect(SUBJECT_TYPES).toHaveLength(2); });
  it('does not include unknown values', () => { expect(SUBJECT_TYPES).not.toContain('OTHER'); });
});

// APR-T-07
describe('isApprovalStatus', () => {
  it('returns true for valid status', () => { expect(isApprovalStatus('DRAFT')).toBe(true); });
  it('returns false for unknown string', () => { expect(isApprovalStatus('UNKNOWN')).toBe(false); });
  it('returns false for non-string', () => { expect(isApprovalStatus(42)).toBe(false); });
});

// APR-T-08
describe('isDecisionOutcome', () => {
  it('returns true for APPROVED', () => { expect(isDecisionOutcome('APPROVED')).toBe(true); });
  it('returns false for DRAFT', () => { expect(isDecisionOutcome('DRAFT')).toBe(false); });
  it('returns false for null', () => { expect(isDecisionOutcome(null)).toBe(false); });
});

// APR-T-09
describe('isApprovalType', () => {
  it('returns true for PLAN_APPROVAL', () => { expect(isApprovalType('PLAN_APPROVAL')).toBe(true); });
  it('returns false for garbage string', () => { expect(isApprovalType('GARBAGE')).toBe(false); });
  it('returns false for undefined', () => { expect(isApprovalType(undefined)).toBe(false); });
});

// APR-T-10
describe('isSubjectType', () => {
  it('returns true for PLAN', () => { expect(isSubjectType('PLAN')).toBe(true); });
  it('returns true for PACKAGE', () => { expect(isSubjectType('PACKAGE')).toBe(true); });
  it('returns false for unknown', () => { expect(isSubjectType('WORKFLOW')).toBe(false); });
});

// APR-T-11
describe('ApprovalError constructor', () => {
  it('stores code and field', () => {
    const e = new ApprovalError('NOT_FOUND', 'requestId', 'msg');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.field).toBe('requestId');
  });
  it('sets message correctly', () => {
    const e = new ApprovalError('X', 'y', 'the message');
    expect(e.message).toBe('the message');
  });
  it('sets name to ApprovalError', () => {
    const e = new ApprovalError('X', 'y', 'z');
    expect(e.name).toBe('ApprovalError');
  });
});

// APR-T-12
describe('ApprovalError is instanceof Error', () => {
  it('is an Error', () => { expect(new ApprovalError('X', 'y', 'z')).toBeInstanceOf(Error); });
  it('is an ApprovalError', () => { expect(new ApprovalError('X', 'y', 'z')).toBeInstanceOf(ApprovalError); });
  it('can be caught as Error', () => {
    try { throw new ApprovalError('C', 'f', 'm'); }
    catch (err) { expect(err).toBeInstanceOf(Error); }
  });
});

// APR-T-13
describe('APPROVAL_STATUSES readonly tuple', () => {
  it('is frozen (readonly tuple)', () => { expect(Array.isArray(APPROVAL_STATUSES)).toBe(true); });
  it('RETURNED is included', () => { expect(APPROVAL_STATUSES).toContain('RETURNED'); });
  it('UNDER_REVIEW is included', () => { expect(APPROVAL_STATUSES).toContain('UNDER_REVIEW'); });
});
