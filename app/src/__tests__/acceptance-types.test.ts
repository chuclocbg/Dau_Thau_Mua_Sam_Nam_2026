import { describe, it, expect } from 'vitest';
import {
  ACCEPTANCE_STATUSES, ACCEPTANCE_TYPES, SESSION_STATUSES, ITEM_STATUSES,
  MINUTE_STATUSES, MEMBER_ROLES, ACCEPTANCE_ACTIONS, ACCEPTANCE_DOC_TYPES,
  isAcceptanceStatus, isAcceptanceType, isMemberRole,
  isSessionStatus, isMinuteStatus, isAcceptanceItemStatus,
  AcceptanceError,
} from '../acceptance/acceptanceTypes';

// ACR-T-01
describe('ACCEPTANCE_STATUSES', () => {
  it('contains 7 statuses', () => { expect(ACCEPTANCE_STATUSES).toHaveLength(7); });
  it('includes DRAFT and COMMITTEE_FORMED', () => {
    expect(ACCEPTANCE_STATUSES).toContain('DRAFT');
    expect(ACCEPTANCE_STATUSES).toContain('COMMITTEE_FORMED');
  });
  it('includes COMPLETED, REJECTED, WITHDRAWN', () => {
    expect(ACCEPTANCE_STATUSES).toContain('COMPLETED');
    expect(ACCEPTANCE_STATUSES).toContain('REJECTED');
    expect(ACCEPTANCE_STATUSES).toContain('WITHDRAWN');
  });
});

// ACR-T-02
describe('ACCEPTANCE_TYPES', () => {
  it('contains 3 types', () => { expect(ACCEPTANCE_TYPES).toHaveLength(3); });
  it('includes PARTIAL (nghiệm thu từng phần)', () => { expect(ACCEPTANCE_TYPES).toContain('PARTIAL'); });
  it('includes FINAL and WARRANTY', () => {
    expect(ACCEPTANCE_TYPES).toContain('FINAL');
    expect(ACCEPTANCE_TYPES).toContain('WARRANTY');
  });
});

// ACR-T-03
describe('SESSION_STATUSES', () => {
  it('contains 4 statuses', () => { expect(SESSION_STATUSES).toHaveLength(4); });
  it('includes PENDING and IN_PROGRESS', () => {
    expect(SESSION_STATUSES).toContain('PENDING');
    expect(SESSION_STATUSES).toContain('IN_PROGRESS');
  });
  it('includes COMPLETED and CANCELLED', () => {
    expect(SESSION_STATUSES).toContain('COMPLETED');
    expect(SESSION_STATUSES).toContain('CANCELLED');
  });
});

// ACR-T-04
describe('ITEM_STATUSES', () => {
  it('contains 3 statuses', () => { expect(ITEM_STATUSES).toHaveLength(3); });
  it('includes PENDING, ACCEPTED, REJECTED', () => {
    expect(ITEM_STATUSES).toContain('PENDING');
    expect(ITEM_STATUSES).toContain('ACCEPTED');
    expect(ITEM_STATUSES).toContain('REJECTED');
  });
  it('is readonly tuple', () => { expect(Array.isArray(ITEM_STATUSES)).toBe(true); });
});

// ACR-T-05
describe('MINUTE_STATUSES', () => {
  it('contains 3 statuses', () => { expect(MINUTE_STATUSES).toHaveLength(3); });
  it('includes DRAFT and SIGNED', () => {
    expect(MINUTE_STATUSES).toContain('DRAFT');
    expect(MINUTE_STATUSES).toContain('SIGNED');
  });
  it('includes VOIDED', () => { expect(MINUTE_STATUSES).toContain('VOIDED'); });
});

// ACR-T-06
describe('MEMBER_ROLES', () => {
  it('contains 4 roles', () => { expect(MEMBER_ROLES).toHaveLength(4); });
  it('includes CHAIRMAN and SECRETARY', () => {
    expect(MEMBER_ROLES).toContain('CHAIRMAN');
    expect(MEMBER_ROLES).toContain('SECRETARY');
  });
  it('includes MEMBER and EXPERT', () => {
    expect(MEMBER_ROLES).toContain('MEMBER');
    expect(MEMBER_ROLES).toContain('EXPERT');
  });
});

// ACR-T-07
describe('ACCEPTANCE_ACTIONS', () => {
  it('includes CREATED and COMMITTEE_FORMED', () => {
    expect(ACCEPTANCE_ACTIONS).toContain('CREATED');
    expect(ACCEPTANCE_ACTIONS).toContain('COMMITTEE_FORMED');
  });
  it('includes COMPLETED and REJECTED', () => {
    expect(ACCEPTANCE_ACTIONS).toContain('COMPLETED');
    expect(ACCEPTANCE_ACTIONS).toContain('REJECTED');
  });
  it('includes SESSION_STARTED and MINUTE_SIGNED', () => {
    expect(ACCEPTANCE_ACTIONS).toContain('SESSION_STARTED');
    expect(ACCEPTANCE_ACTIONS).toContain('MINUTE_SIGNED');
  });
});

// ACR-T-08
describe('ACCEPTANCE_DOC_TYPES', () => {
  it('includes ACCEPTANCE_MINUTE', () => { expect(ACCEPTANCE_DOC_TYPES).toContain('ACCEPTANCE_MINUTE'); });
  it('includes TEST_REPORT and INSPECTION_REPORT', () => {
    expect(ACCEPTANCE_DOC_TYPES).toContain('TEST_REPORT');
    expect(ACCEPTANCE_DOC_TYPES).toContain('INSPECTION_REPORT');
  });
  it('includes OTHER', () => { expect(ACCEPTANCE_DOC_TYPES).toContain('OTHER'); });
});

// ACR-T-09
describe('isAcceptanceStatus', () => {
  it('returns true for DRAFT', () => { expect(isAcceptanceStatus('DRAFT')).toBe(true); });
  it('returns true for PARTIAL_ACCEPTED', () => { expect(isAcceptanceStatus('PARTIAL_ACCEPTED')).toBe(true); });
  it('returns false for unknown', () => { expect(isAcceptanceStatus('PENDING_PAYMENT')).toBe(false); });
});

// ACR-T-10
describe('isAcceptanceType', () => {
  it('returns true for PARTIAL', () => { expect(isAcceptanceType('PARTIAL')).toBe(true); });
  it('returns true for WARRANTY', () => { expect(isAcceptanceType('WARRANTY')).toBe(true); });
  it('returns false for non-string', () => { expect(isAcceptanceType(123)).toBe(false); });
});

// ACR-T-11
describe('isMemberRole + isSessionStatus + isMinuteStatus', () => {
  it('isMemberRole returns true for CHAIRMAN', () => { expect(isMemberRole('CHAIRMAN')).toBe(true); });
  it('isSessionStatus returns true for COMPLETED', () => { expect(isSessionStatus('COMPLETED')).toBe(true); });
  it('isMinuteStatus returns false for unknown', () => { expect(isMinuteStatus('APPROVED')).toBe(false); });
});

// ACR-T-12
describe('isAcceptanceItemStatus', () => {
  it('returns true for ACCEPTED', () => { expect(isAcceptanceItemStatus('ACCEPTED')).toBe(true); });
  it('returns true for REJECTED', () => { expect(isAcceptanceItemStatus('REJECTED')).toBe(true); });
  it('returns false for null', () => { expect(isAcceptanceItemStatus(null)).toBe(false); });
});

// ACR-T-13
describe('AcceptanceError', () => {
  it('stores code and field', () => {
    const e = new AcceptanceError('NOT_FOUND', 'requestId', 'msg');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.field).toBe('requestId');
  });
  it('is instanceof Error', () => { expect(new AcceptanceError('X', 'y', 'z')).toBeInstanceOf(Error); });
  it('name is AcceptanceError', () => {
    expect(new AcceptanceError('X', 'y', 'z').name).toBe('AcceptanceError');
  });
});
