import { describe, it, expect } from 'vitest';
import {
  validateRequiredContractFields, validateContractValue,
  validateContractStatusTransition, validateGuaranteeParams,
  validateMilestoneParams, validateAmendmentParams, validateAttachmentParams,
} from '../contract/contractValidation';
import { ContractError } from '../contract/contractTypes';
import type { CreateContractParams, AddGuaranteeParams, AddMilestoneParams, CreateAmendmentParams, AddAttachmentParams } from '../contract/contractTypes';

// CTR-V-01
describe('validateRequiredContractFields — valid', () => {
  it('returns valid for all required fields', () => {
    expect(validateRequiredContractFields(fullParams()).valid).toBe(true);
  });
  it('errors is empty for valid input', () => {
    expect(validateRequiredContractFields(fullParams()).errors).toHaveLength(0);
  });
  it('warnings is empty', () => {
    expect(validateRequiredContractFields(fullParams()).warnings).toHaveLength(0);
  });
});

// CTR-V-02
describe('validateRequiredContractFields — missing fields', () => {
  it('fails when contractNumber is empty', () => {
    expect(validateRequiredContractFields({ ...fullParams(), contractNumber: '' }).valid).toBe(false);
  });
  it('fails when packageId is missing', () => {
    expect(validateRequiredContractFields({ ...fullParams(), packageId: '' }).valid).toBe(false);
  });
  it('reports multiple errors at once', () => {
    const r = validateRequiredContractFields({ ...fullParams(), contractNumber: '', winnerCode: '' });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// CTR-V-03
describe('validateContractValue', () => {
  it('valid for positive value', () => { expect(validateContractValue(1_000_000).valid).toBe(true); });
  it('invalid for zero', () => { expect(validateContractValue(0).valid).toBe(false); });
  it('invalid for negative', () => { expect(validateContractValue(-500).valid).toBe(false); });
});

// CTR-V-04
describe('validateContractStatusTransition', () => {
  it('does not throw when status is allowed', () => {
    expect(() => validateContractStatusTransition('DRAFT', ['DRAFT', 'SIGNED'], 'status')).not.toThrow();
  });
  it('throws ContractError for disallowed status', () => {
    expect(() => validateContractStatusTransition('COMPLETED', ['DRAFT'], 'status')).toThrow(ContractError);
  });
  it('error code is INVALID_STATUS', () => {
    try { validateContractStatusTransition('TERMINATED', ['DRAFT'], 'status'); }
    catch (e) { expect((e as ContractError).code).toBe('INVALID_STATUS'); }
  });
});

// CTR-V-05
describe('validateGuaranteeParams — valid', () => {
  it('returns valid for full params', () => {
    expect(validateGuaranteeParams(guarantee()).valid).toBe(true);
  });
  it('fails when amount is zero', () => {
    expect(validateGuaranteeParams({ ...guarantee(), amount: 0 }).valid).toBe(false);
  });
  it('fails when issuerCode is empty', () => {
    expect(validateGuaranteeParams({ ...guarantee(), issuerCode: '' }).valid).toBe(false);
  });
});

// CTR-V-06
describe('validateGuaranteeParams — date validation', () => {
  it('fails when expiryDate is before issuedDate', () => {
    const r = validateGuaranteeParams({ ...guarantee(), issuedDate: '2026-12-01', expiryDate: '2026-01-01' });
    expect(r.valid).toBe(false);
  });
  it('fails when guaranteeNumber is empty', () => {
    expect(validateGuaranteeParams({ ...guarantee(), guaranteeNumber: '' }).valid).toBe(false);
  });
  it('fails when expiryDate is missing', () => {
    expect(validateGuaranteeParams({ ...guarantee(), expiryDate: '' }).valid).toBe(false);
  });
});

// CTR-V-07
describe('validateMilestoneParams', () => {
  it('returns valid for full params', () => {
    expect(validateMilestoneParams(milestone()).valid).toBe(true);
  });
  it('fails when milestoneCode is empty', () => {
    expect(validateMilestoneParams({ ...milestone(), milestoneCode: '' }).valid).toBe(false);
  });
  it('fails when plannedValue is zero', () => {
    expect(validateMilestoneParams({ ...milestone(), plannedValue: 0 }).valid).toBe(false);
  });
});

// CTR-V-08
describe('validateMilestoneParams — title and date', () => {
  it('fails when title is empty', () => {
    expect(validateMilestoneParams({ ...milestone(), title: '' }).valid).toBe(false);
  });
  it('fails when plannedDate is empty', () => {
    expect(validateMilestoneParams({ ...milestone(), plannedDate: '' }).valid).toBe(false);
  });
  it('valid with description', () => {
    expect(validateMilestoneParams({ ...milestone(), description: 'Detailed desc' }).valid).toBe(true);
  });
});

// CTR-V-09
describe('validateAmendmentParams', () => {
  it('returns valid for correct params', () => {
    expect(validateAmendmentParams(amendment()).valid).toBe(true);
  });
  it('fails when reason is empty', () => {
    expect(validateAmendmentParams({ ...amendment(), reason: '' }).valid).toBe(false);
  });
  it('fails when changedFields is empty', () => {
    expect(validateAmendmentParams({ ...amendment(), changedFields: [] }).valid).toBe(false);
  });
});

// CTR-V-10
describe('validateAmendmentParams — value and time', () => {
  it('valid with negative valueChange (reduction)', () => {
    expect(validateAmendmentParams({ ...amendment(), valueChange: -1_000_000 }).valid).toBe(true);
  });
  it('fails when timeExtensionDays is negative', () => {
    expect(validateAmendmentParams({ ...amendment(), timeExtensionDays: -5 }).valid).toBe(false);
  });
  it('valid with zero timeExtensionDays', () => {
    expect(validateAmendmentParams({ ...amendment(), timeExtensionDays: 0 }).valid).toBe(true);
  });
});

// CTR-V-11
describe('validateAttachmentParams', () => {
  it('returns valid for proper attachment', () => {
    expect(validateAttachmentParams(attach()).valid).toBe(true);
  });
  it('fails when fileName is empty', () => {
    expect(validateAttachmentParams({ ...attach(), fileName: '' }).valid).toBe(false);
  });
  it('fails when fileSize is 0', () => {
    expect(validateAttachmentParams({ ...attach(), fileSize: 0 }).valid).toBe(false);
  });
});

// CTR-V-12
describe('validateAttachmentParams — size limit', () => {
  it('accepts exactly 100MB', () => {
    expect(validateAttachmentParams({ ...attach(), fileSize: 100 * 1024 * 1024 }).valid).toBe(true);
  });
  it('fails for 101MB', () => {
    expect(validateAttachmentParams({ ...attach(), fileSize: 101 * 1024 * 1024 }).valid).toBe(false);
  });
  it('fails when fileType is empty', () => {
    expect(validateAttachmentParams({ ...attach(), fileType: '' }).valid).toBe(false);
  });
});

// CTR-V-13
describe('validateContractStatusTransition — edge cases', () => {
  it('throws with correct field name in error', () => {
    try { validateContractStatusTransition('SUSPENDED', ['EFFECTIVE'], 'myField'); }
    catch (e) { expect((e as ContractError).field).toBe('myField'); }
  });
  it('allows SUSPENDED from EFFECTIVE', () => {
    expect(() => validateContractStatusTransition('EFFECTIVE', ['EFFECTIVE', 'SIGNED'], 'status')).not.toThrow();
  });
  it('TERMINATED is not in EFFECTIVE transition list', () => {
    expect(() => validateContractStatusTransition('TERMINATED', ['DRAFT', 'SIGNED', 'EFFECTIVE'], 'status')).toThrow(ContractError);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullParams(): CreateContractParams {
  return { contractNumber: 'HĐ/001', contractType: 'LUMP_SUM', packageId: 'PKG-1', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 1_000_000_000 };
}
function guarantee(): AddGuaranteeParams {
  return { guaranteeType: 'PERFORMANCE', amount: 100_000_000, issuerCode: 'BANK-01', issuerName: 'VCB', guaranteeNumber: 'G-001', issuedDate: '2026-01-01', expiryDate: '2027-01-01' };
}
function milestone(): AddMilestoneParams {
  return { milestoneCode: 'MS-01', title: 'Delivery', plannedDate: '2026-06-30', plannedValue: 500_000_000 };
}
function amendment(): CreateAmendmentParams {
  return { reason: 'Market price change', changedFields: ['contractValue'] };
}
function attach(): AddAttachmentParams {
  return { fileName: 'contract.pdf', fileType: 'application/pdf', fileSize: 2048, documentType: 'CONTRACT_DOCUMENT' };
}
