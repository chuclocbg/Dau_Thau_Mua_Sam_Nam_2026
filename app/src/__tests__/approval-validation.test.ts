import { describe, it, expect } from 'vitest';
import {
  validateRequiredRequestFields, validateEstimatedValue,
  validateStatusTransition, validateAuthorityAssigned,
  validateDecisionParams, validateCommentContent, validateAttachmentParams,
} from '../approval/approvalValidation';
import { ApprovalError } from '../approval/approvalTypes';
import type { CreateApprovalRequestParams, RecordDecisionParams, ApprovalRequest, AddAttachmentParams } from '../approval/approvalTypes';

// APR-V-01
describe('validateRequiredRequestFields — valid input', () => {
  it('returns valid for all fields present', () => {
    const r = validateRequiredRequestFields(fullParams());
    expect(r.valid).toBe(true);
  });
  it('errors is empty array for valid input', () => {
    expect(validateRequiredRequestFields(fullParams()).errors).toHaveLength(0);
  });
  it('warnings is empty array', () => {
    expect(validateRequiredRequestFields(fullParams()).warnings).toHaveLength(0);
  });
});

// APR-V-02
describe('validateRequiredRequestFields — missing fields', () => {
  it('fails when requestCode is missing', () => {
    const r = validateRequiredRequestFields({ ...fullParams(), requestCode: '' });
    expect(r.valid).toBe(false);
  });
  it('fails when subjectId is missing', () => {
    const r = validateRequiredRequestFields({ ...fullParams(), subjectId: '' });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('reports all missing required fields', () => {
    const r = validateRequiredRequestFields({ ...fullParams(), requestCode: '', requestedBy: '' });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// APR-V-03
describe('validateEstimatedValue', () => {
  it('valid for positive value', () => { expect(validateEstimatedValue(1000).valid).toBe(true); });
  it('invalid for zero', () => { expect(validateEstimatedValue(0).valid).toBe(false); });
  it('invalid for negative', () => { expect(validateEstimatedValue(-1).valid).toBe(false); });
});

// APR-V-04
describe('validateStatusTransition', () => {
  it('does not throw when status is in allowed list', () => {
    expect(() => validateStatusTransition('DRAFT', ['DRAFT', 'SUBMITTED'], 'status')).not.toThrow();
  });
  it('throws ApprovalError when status not in allowed list', () => {
    expect(() => validateStatusTransition('APPROVED', ['DRAFT'], 'status')).toThrow(ApprovalError);
  });
  it('thrown error has INVALID_STATUS code', () => {
    try { validateStatusTransition('WITHDRAWN', ['DRAFT'], 'status'); }
    catch (e) { expect((e as ApprovalError).code).toBe('INVALID_STATUS'); }
  });
});

// APR-V-05
describe('validateAuthorityAssigned', () => {
  it('does not throw when authority is set', () => {
    expect(() => validateAuthorityAssigned(reqWithAuthority())).not.toThrow();
  });
  it('throws when assignedAuthorityCode is absent', () => {
    expect(() => validateAuthorityAssigned(reqWithoutAuthority())).toThrow(ApprovalError);
  });
  it('error code is NO_AUTHORITY', () => {
    try { validateAuthorityAssigned(reqWithoutAuthority()); }
    catch (e) { expect((e as ApprovalError).code).toBe('NO_AUTHORITY'); }
  });
});

// APR-V-06
describe('validateDecisionParams — APPROVED outcome', () => {
  it('valid with required fields', () => {
    expect(validateDecisionParams(approvedDecision()).valid).toBe(true);
  });
  it('fails when decidedBy is empty', () => {
    const r = validateDecisionParams({ ...approvedDecision(), decidedBy: '' });
    expect(r.valid).toBe(false);
  });
  it('fails when legalBasis is empty', () => {
    const r = validateDecisionParams({ ...approvedDecision(), legalBasis: '' });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// APR-V-07
describe('validateDecisionParams — RETURNED outcome', () => {
  it('fails when revisionRequired is empty', () => {
    const r = validateDecisionParams({ outcome: 'RETURNED', decidedBy: 'U1', legalBasis: 'L', decisionReference: 'D', revisionRequired: [] });
    expect(r.valid).toBe(false);
  });
  it('valid when revisionRequired has items', () => {
    const r = validateDecisionParams({ outcome: 'RETURNED', decidedBy: 'U1', legalBasis: 'L', decisionReference: 'D', revisionRequired: ['Fix X'] });
    expect(r.valid).toBe(true);
  });
  it('fails when decisionReference is missing', () => {
    const r = validateDecisionParams({ outcome: 'APPROVED', decidedBy: 'U1', legalBasis: 'L', decisionReference: '' });
    expect(r.valid).toBe(false);
  });
});

// APR-V-08
describe('validateCommentContent', () => {
  it('does not throw for valid content', () => {
    expect(() => validateCommentContent('Hello world')).not.toThrow();
  });
  it('throws for empty string', () => {
    expect(() => validateCommentContent('')).toThrow(ApprovalError);
  });
  it('throws for whitespace-only', () => {
    expect(() => validateCommentContent('   ')).toThrow(ApprovalError);
  });
});

// APR-V-09
describe('validateCommentContent — too long', () => {
  it('throws when content exceeds 5000 chars', () => {
    expect(() => validateCommentContent('x'.repeat(5001))).toThrow(ApprovalError);
  });
  it('accepts exactly 5000 chars', () => {
    expect(() => validateCommentContent('x'.repeat(5000))).not.toThrow();
  });
  it('error code is COMMENT_TOO_LONG for long content', () => {
    try { validateCommentContent('x'.repeat(5001)); }
    catch (e) { expect((e as ApprovalError).code).toBe('COMMENT_TOO_LONG'); }
  });
});

// APR-V-10
describe('validateAttachmentParams — valid', () => {
  it('returns valid for proper params', () => {
    expect(validateAttachmentParams(attachment()).valid).toBe(true);
  });
  it('errors is empty for valid input', () => {
    expect(validateAttachmentParams(attachment()).errors).toHaveLength(0);
  });
  it('warnings is empty for valid input', () => {
    expect(validateAttachmentParams(attachment()).warnings).toHaveLength(0);
  });
});

// APR-V-11
describe('validateAttachmentParams — invalid', () => {
  it('fails when fileName is empty', () => {
    expect(validateAttachmentParams({ ...attachment(), fileName: '' }).valid).toBe(false);
  });
  it('fails when fileSize is 0', () => {
    expect(validateAttachmentParams({ ...attachment(), fileSize: 0 }).valid).toBe(false);
  });
  it('fails when fileSize exceeds 50MB', () => {
    expect(validateAttachmentParams({ ...attachment(), fileSize: 51 * 1024 * 1024 }).valid).toBe(false);
  });
});

// APR-V-12
describe('validateAttachmentParams — edge cases', () => {
  it('fails when fileType is empty', () => {
    expect(validateAttachmentParams({ ...attachment(), fileType: '' }).valid).toBe(false);
  });
  it('accepts exactly 50MB', () => {
    expect(validateAttachmentParams({ ...attachment(), fileSize: 50 * 1024 * 1024 }).valid).toBe(true);
  });
  it('reports multiple errors at once', () => {
    const r = validateAttachmentParams({ ...attachment(), fileName: '', fileType: '', fileSize: -1 });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// APR-V-13
describe('validateStatusTransition — edge cases', () => {
  it('allows RETURNED → SUBMITTED transition', () => {
    expect(() => validateStatusTransition('RETURNED', ['DRAFT', 'RETURNED'], 'status')).not.toThrow();
  });
  it('throws ApprovalError for EXPIRED status trying to submit', () => {
    expect(() => validateStatusTransition('EXPIRED', ['DRAFT', 'SUBMITTED'], 'status')).toThrow(ApprovalError);
  });
  it('error field matches provided field name', () => {
    try { validateStatusTransition('WITHDRAWN', ['DRAFT'], 'myField'); }
    catch (e) { expect((e as ApprovalError).field).toBe('myField'); }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullParams(): CreateApprovalRequestParams {
  return { requestCode: 'APR/001', approvalType: 'PLAN_APPROVAL', subjectId: 'S1', subjectType: 'PLAN', requestedBy: 'EMP-1', department: 'DEPT-A', estimatedValue: 1_000_000 };
}
function approvedDecision(): RecordDecisionParams {
  return { outcome: 'APPROVED', decidedBy: 'MGR-1', legalBasis: 'NĐ 214', decisionReference: 'QĐ/001' };
}
function attachment(): AddAttachmentParams {
  return { fileName: 'doc.pdf', fileType: 'application/pdf', fileSize: 1024, documentType: 'SUPPORTING_DOCUMENT' };
}
function reqWithAuthority(): ApprovalRequest {
  return { ...baseRequest(), assignedAuthorityCode: 'AUTH-1', assignedAuthorityName: 'Director' };
}
function reqWithoutAuthority(): ApprovalRequest {
  return baseRequest();
}
function baseRequest(): ApprovalRequest {
  return {
    id: '1', requestCode: 'A', approvalType: 'PLAN_APPROVAL', subjectId: 'S', subjectType: 'PLAN',
    requestedBy: 'U', requestedAt: '2026-01-01T00:00:00Z', department: 'D', estimatedValue: 1000,
    status: 'UNDER_REVIEW', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}
