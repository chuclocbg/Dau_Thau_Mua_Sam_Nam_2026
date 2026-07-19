import type { ApprovalType, SubjectType, CreateApprovalRequestParams } from './approvalTypes';
export { createMemoryApprovalRepositories } from './memoryApprovalRepositories';
export { buildPrismaApprovalRepositories } from './prismaApprovalRepositories';

export function generateApprovalCode(type: ApprovalType, year: number, sequence: number): string {
  const typeTag: Record<ApprovalType, string> = {
    PLAN_APPROVAL:               'KH',
    PACKAGE_APPROVAL:            'GK',
    BIDDING_DOCUMENT_APPROVAL:   'HS',
    EVALUATION_RESULT_APPROVAL:  'KQ',
    CONTRACT_APPROVAL:           'HD',
    PAYMENT_APPROVAL:            'TT',
  };
  return `APR/${typeTag[type] ?? type}/${year}/${String(sequence).padStart(4, '0')}`;
}

export function buildCreateApprovalRequestParams(
  opts: {
    type:           ApprovalType;
    subjectId:      string;
    subjectType:    SubjectType;
    requestedBy:    string;
    department:     string;
    estimatedValue: number;
    year:           number;
    sequence:       number;
    dueDate?:       string;
    notes?:         string;
  },
): CreateApprovalRequestParams {
  return {
    requestCode:    generateApprovalCode(opts.type, opts.year, opts.sequence),
    approvalType:   opts.type,
    subjectId:      opts.subjectId,
    subjectType:    opts.subjectType,
    requestedBy:    opts.requestedBy,
    department:     opts.department,
    estimatedValue: opts.estimatedValue,
    dueDate:        opts.dueDate,
    notes:          opts.notes,
  };
}
