import { describe, it, expect } from 'vitest';
import {
  validateRequiredAcceptanceFields, validateFormCommitteeParams,
  validateMemberParams, validateSessionParams, validateItemParams,
  validateMinuteParams, validateAttachmentParams,
  validateAcceptanceStatusTransition,
} from '../acceptance/acceptanceValidation';
import { AcceptanceError } from '../acceptance/acceptanceTypes';
import type {
  CreateAcceptanceParams, FormCommitteeParams, AddMemberParams,
  CreateSessionParams, RecordItemParams, CreateMinuteParams, AddAttachmentParams,
} from '../acceptance/acceptanceTypes';

// ACR-V-01
describe('validateRequiredAcceptanceFields — valid', () => {
  it('returns valid for all required fields', () => {
    expect(validateRequiredAcceptanceFields(fullParams()).valid).toBe(true);
  });
  it('errors is empty for valid', () => {
    expect(validateRequiredAcceptanceFields(fullParams()).errors).toHaveLength(0);
  });
  it('warnings is empty for valid', () => {
    expect(validateRequiredAcceptanceFields(fullParams()).warnings).toHaveLength(0);
  });
});

// ACR-V-02
describe('validateRequiredAcceptanceFields — missing fields', () => {
  it('fails when requestCode is empty', () => {
    expect(validateRequiredAcceptanceFields({ ...fullParams(), requestCode: '' }).valid).toBe(false);
  });
  it('fails when contractId is missing', () => {
    expect(validateRequiredAcceptanceFields({ ...fullParams(), contractId: '' }).valid).toBe(false);
  });
  it('reports multiple errors at once', () => {
    const r = validateRequiredAcceptanceFields({ ...fullParams(), requestCode: '', department: '' });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ACR-V-03
describe('validateFormCommitteeParams', () => {
  it('valid for full params', () => { expect(validateFormCommitteeParams(committee()).valid).toBe(true); });
  it('fails when committeeCode is empty', () => {
    expect(validateFormCommitteeParams({ ...committee(), committeeCode: '' }).valid).toBe(false);
  });
  it('fails when establishedBy is empty', () => {
    expect(validateFormCommitteeParams({ ...committee(), establishedBy: '' }).valid).toBe(false);
  });
});

// ACR-V-04
describe('validateMemberParams', () => {
  it('valid for full params', () => { expect(validateMemberParams(member()).valid).toBe(true); });
  it('fails when memberCode is empty', () => {
    expect(validateMemberParams({ ...member(), memberCode: '' }).valid).toBe(false);
  });
  it('fails when memberName is empty', () => {
    expect(validateMemberParams({ ...member(), memberName: '' }).valid).toBe(false);
  });
});

// ACR-V-05
describe('validateSessionParams', () => {
  it('valid for full params', () => { expect(validateSessionParams(session()).valid).toBe(true); });
  it('fails when scheduledDate is empty', () => {
    expect(validateSessionParams({ ...session(), scheduledDate: '' }).valid).toBe(false);
  });
  it('fails when sessionType is missing', () => {
    expect(validateSessionParams({ ...session(), sessionType: undefined as any }).valid).toBe(false);
  });
});

// ACR-V-06
describe('validateItemParams — quantity rules', () => {
  it('valid for balanced quantities', () => { expect(validateItemParams(item()).valid).toBe(true); });
  it('fails when contractedQuantity is zero', () => {
    expect(validateItemParams({ ...item(), contractedQuantity: 0 }).valid).toBe(false);
  });
  it('fails when accepted + rejected > contracted', () => {
    expect(validateItemParams({ ...item(), acceptedQuantity: 8, rejectedQuantity: 5, contractedQuantity: 10 }).valid).toBe(false);
  });
});

// ACR-V-07
describe('validateItemParams — negative quantity guard', () => {
  it('fails when acceptedQuantity is negative', () => {
    expect(validateItemParams({ ...item(), acceptedQuantity: -1 }).valid).toBe(false);
  });
  it('fails when rejectedQuantity is negative', () => {
    expect(validateItemParams({ ...item(), rejectedQuantity: -1 }).valid).toBe(false);
  });
  it('valid when zero rejected', () => {
    expect(validateItemParams({ ...item(), acceptedQuantity: 10, rejectedQuantity: 0 }).valid).toBe(true);
  });
});

// ACR-V-08
describe('validateMinuteParams', () => {
  it('valid for full params', () => { expect(validateMinuteParams(minute()).valid).toBe(true); });
  it('fails when minuteCode is empty', () => {
    expect(validateMinuteParams({ ...minute(), minuteCode: '' }).valid).toBe(false);
  });
  it('fails when conclusion is empty', () => {
    expect(validateMinuteParams({ ...minute(), conclusion: '' }).valid).toBe(false);
  });
});

// ACR-V-09
describe('validateAttachmentParams', () => {
  it('valid for proper attachment', () => { expect(validateAttachmentParams(attach()).valid).toBe(true); });
  it('fails when fileName is empty', () => {
    expect(validateAttachmentParams({ ...attach(), fileName: '' }).valid).toBe(false);
  });
  it('fails when fileSize is 0', () => {
    expect(validateAttachmentParams({ ...attach(), fileSize: 0 }).valid).toBe(false);
  });
});

// ACR-V-10
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

// ACR-V-11
describe('validateAcceptanceStatusTransition', () => {
  it('does not throw when status is allowed', () => {
    expect(() => validateAcceptanceStatusTransition('DRAFT', ['DRAFT', 'IN_PROGRESS'], 'status')).not.toThrow();
  });
  it('throws AcceptanceError for disallowed status', () => {
    expect(() => validateAcceptanceStatusTransition('COMPLETED', ['DRAFT'], 'status')).toThrow(AcceptanceError);
  });
  it('error code is INVALID_STATUS', () => {
    try { validateAcceptanceStatusTransition('WITHDRAWN', ['DRAFT'], 'status'); }
    catch (e) { expect((e as AcceptanceError).code).toBe('INVALID_STATUS'); }
  });
});

// ACR-V-12
describe('validateAcceptanceStatusTransition — field name', () => {
  it('throws with correct field in error', () => {
    try { validateAcceptanceStatusTransition('REJECTED', ['DRAFT'], 'myField'); }
    catch (e) { expect((e as AcceptanceError).field).toBe('myField'); }
  });
  it('allows IN_PROGRESS from list containing it', () => {
    expect(() => validateAcceptanceStatusTransition('IN_PROGRESS', ['IN_PROGRESS', 'PARTIAL_ACCEPTED'], 'status')).not.toThrow();
  });
  it('throws for COMPLETED not in narrow list', () => {
    expect(() => validateAcceptanceStatusTransition('COMPLETED', ['IN_PROGRESS'], 'status')).toThrow(AcceptanceError);
  });
});

// ACR-V-13
describe('validateItemParams — description guard', () => {
  it('fails when description is empty', () => {
    expect(validateItemParams({ ...item(), description: '' }).valid).toBe(false);
  });
  it('fails when itemCode is empty', () => {
    expect(validateItemParams({ ...item(), itemCode: '' }).valid).toBe(false);
  });
  it('valid with equal accepted+rejected == contracted', () => {
    expect(validateItemParams({ ...item(), acceptedQuantity: 7, rejectedQuantity: 3, contractedQuantity: 10 }).valid).toBe(true);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullParams(): CreateAcceptanceParams {
  return { requestCode: 'NT/001', acceptanceType: 'FINAL', contractId: 'C-1', requestedBy: 'EMP', department: 'BLD' };
}
function committee(): FormCommitteeParams { return { committeeCode: 'HDNT-01', establishedBy: 'DIR-01' }; }
function member(): AddMemberParams { return { memberCode: 'EMP-01', memberName: 'Nguyễn A', role: 'CHAIRMAN' }; }
function session(): CreateSessionParams { return { sessionType: 'FINAL', scheduledDate: '2026-08-01' }; }
function item(): RecordItemParams { return { itemCode: 'ITEM-01', description: 'Hạng mục A', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }; }
function minute(): CreateMinuteParams { return { minuteCode: 'BB/001', conclusion: 'Đạt yêu cầu' }; }
function attach(): AddAttachmentParams { return { fileName: 'minute.pdf', fileType: 'application/pdf', fileSize: 2048, documentType: 'ACCEPTANCE_MINUTE' }; }
