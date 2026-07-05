import { describe, it, expect } from 'vitest';
import {
  CONTRACT_STATUSES, CONTRACT_TYPES, AMENDMENT_STATUSES, MILESTONE_STATUSES,
  GUARANTEE_TYPES, GUARANTEE_STATUSES, CONTRACT_ACTIONS, CONTRACT_DOC_TYPES,
  isContractStatus, isContractType, isGuaranteeType, isMilestoneStatus, isAmendmentStatus,
  ContractError,
} from '../contract/contractTypes';

// CTR-T-01
describe('CONTRACT_STATUSES', () => {
  it('contains 6 statuses', () => { expect(CONTRACT_STATUSES).toHaveLength(6); });
  it('includes DRAFT and SIGNED', () => {
    expect(CONTRACT_STATUSES).toContain('DRAFT');
    expect(CONTRACT_STATUSES).toContain('SIGNED');
  });
  it('includes COMPLETED and TERMINATED', () => {
    expect(CONTRACT_STATUSES).toContain('COMPLETED');
    expect(CONTRACT_STATUSES).toContain('TERMINATED');
  });
});

// CTR-T-02
describe('CONTRACT_TYPES', () => {
  it('contains 4 types', () => { expect(CONTRACT_TYPES).toHaveLength(4); });
  it('includes LUMP_SUM (hợp đồng trọn gói)', () => { expect(CONTRACT_TYPES).toContain('LUMP_SUM'); });
  it('includes UNIT_PRICE and TIME_BASED', () => {
    expect(CONTRACT_TYPES).toContain('UNIT_PRICE');
    expect(CONTRACT_TYPES).toContain('TIME_BASED');
  });
});

// CTR-T-03
describe('AMENDMENT_STATUSES', () => {
  it('contains 3 statuses', () => { expect(AMENDMENT_STATUSES).toHaveLength(3); });
  it('includes DRAFT and APPROVED', () => {
    expect(AMENDMENT_STATUSES).toContain('DRAFT');
    expect(AMENDMENT_STATUSES).toContain('APPROVED');
  });
  it('includes REJECTED', () => { expect(AMENDMENT_STATUSES).toContain('REJECTED'); });
});

// CTR-T-04
describe('MILESTONE_STATUSES', () => {
  it('contains 4 statuses', () => { expect(MILESTONE_STATUSES).toHaveLength(4); });
  it('includes PENDING and REACHED', () => {
    expect(MILESTONE_STATUSES).toContain('PENDING');
    expect(MILESTONE_STATUSES).toContain('REACHED');
  });
  it('includes DELAYED and CANCELLED', () => {
    expect(MILESTONE_STATUSES).toContain('DELAYED');
    expect(MILESTONE_STATUSES).toContain('CANCELLED');
  });
});

// CTR-T-05
describe('GUARANTEE_TYPES', () => {
  it('contains 3 types', () => { expect(GUARANTEE_TYPES).toHaveLength(3); });
  it('includes PERFORMANCE (bảo đảm thực hiện)', () => { expect(GUARANTEE_TYPES).toContain('PERFORMANCE'); });
  it('includes ADVANCE_PAYMENT and WARRANTY', () => {
    expect(GUARANTEE_TYPES).toContain('ADVANCE_PAYMENT');
    expect(GUARANTEE_TYPES).toContain('WARRANTY');
  });
});

// CTR-T-06
describe('GUARANTEE_STATUSES', () => {
  it('contains 4 statuses', () => { expect(GUARANTEE_STATUSES).toHaveLength(4); });
  it('includes ACTIVE and RETURNED', () => {
    expect(GUARANTEE_STATUSES).toContain('ACTIVE');
    expect(GUARANTEE_STATUSES).toContain('RETURNED');
  });
  it('includes EXPIRED and FORFEITED', () => {
    expect(GUARANTEE_STATUSES).toContain('EXPIRED');
    expect(GUARANTEE_STATUSES).toContain('FORFEITED');
  });
});

// CTR-T-07
describe('CONTRACT_ACTIONS', () => {
  it('includes CREATED and SIGNED', () => {
    expect(CONTRACT_ACTIONS).toContain('CREATED');
    expect(CONTRACT_ACTIONS).toContain('SIGNED');
  });
  it('includes COMPLETED and TERMINATED', () => {
    expect(CONTRACT_ACTIONS).toContain('COMPLETED');
    expect(CONTRACT_ACTIONS).toContain('TERMINATED');
  });
  it('includes GUARANTEE_ADDED and MILESTONE_REACHED', () => {
    expect(CONTRACT_ACTIONS).toContain('GUARANTEE_ADDED');
    expect(CONTRACT_ACTIONS).toContain('MILESTONE_REACHED');
  });
});

// CTR-T-08
describe('CONTRACT_DOC_TYPES', () => {
  it('includes CONTRACT_DOCUMENT', () => { expect(CONTRACT_DOC_TYPES).toContain('CONTRACT_DOCUMENT'); });
  it('includes AMENDMENT_DOCUMENT and PERFORMANCE_SECURITY', () => {
    expect(CONTRACT_DOC_TYPES).toContain('AMENDMENT_DOCUMENT');
    expect(CONTRACT_DOC_TYPES).toContain('PERFORMANCE_SECURITY');
  });
  it('includes PAYMENT_RECORD and OTHER', () => {
    expect(CONTRACT_DOC_TYPES).toContain('PAYMENT_RECORD');
    expect(CONTRACT_DOC_TYPES).toContain('OTHER');
  });
});

// CTR-T-09
describe('isContractStatus', () => {
  it('returns true for DRAFT', () => { expect(isContractStatus('DRAFT')).toBe(true); });
  it('returns true for TERMINATED', () => { expect(isContractStatus('TERMINATED')).toBe(true); });
  it('returns false for unknown', () => { expect(isContractStatus('CANCELLED')).toBe(false); });
});

// CTR-T-10
describe('isContractType', () => {
  it('returns true for LUMP_SUM', () => { expect(isContractType('LUMP_SUM')).toBe(true); });
  it('returns true for MIXED', () => { expect(isContractType('MIXED')).toBe(true); });
  it('returns false for non-string', () => { expect(isContractType(42)).toBe(false); });
});

// CTR-T-11
describe('isGuaranteeType', () => {
  it('returns true for PERFORMANCE', () => { expect(isGuaranteeType('PERFORMANCE')).toBe(true); });
  it('returns false for unknown', () => { expect(isGuaranteeType('BOND')).toBe(false); });
  it('returns false for null', () => { expect(isGuaranteeType(null)).toBe(false); });
});

// CTR-T-12
describe('isMilestoneStatus + isAmendmentStatus', () => {
  it('isMilestoneStatus returns true for REACHED', () => { expect(isMilestoneStatus('REACHED')).toBe(true); });
  it('isMilestoneStatus returns false for APPROVED', () => { expect(isMilestoneStatus('APPROVED')).toBe(false); });
  it('isAmendmentStatus returns true for DRAFT', () => { expect(isAmendmentStatus('DRAFT')).toBe(true); });
});

// CTR-T-13
describe('ContractError', () => {
  it('stores code and field', () => {
    const e = new ContractError('NOT_FOUND', 'contractId', 'msg');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.field).toBe('contractId');
  });
  it('is instanceof Error', () => { expect(new ContractError('X', 'y', 'z')).toBeInstanceOf(Error); });
  it('name is ContractError', () => { expect(new ContractError('X', 'y', 'z').name).toBe('ContractError'); });
});
