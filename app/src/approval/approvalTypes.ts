/**
 * Approval Module — entity types and enums.
 *
 * Legal basis:
 *   Luật 22/2023/QH15  — Chương VII: Phê duyệt và triển khai kế hoạch lựa chọn nhà thầu
 *   NĐ 214/2025/NĐ-CP  — Chương VIII: Thẩm quyền phê duyệt
 *   NĐ 104/2026/NĐ-CP  — updates to approval authority thresholds
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export const APPROVAL_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'WITHDRAWN',
  'EXPIRED',
] as const;
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export const APPROVAL_TYPES = [
  'PLAN_APPROVAL',
  'PACKAGE_APPROVAL',
  'BIDDING_DOCUMENT_APPROVAL',
  'EVALUATION_RESULT_APPROVAL',
  'CONTRACT_APPROVAL',
  'PAYMENT_APPROVAL',
] as const;
export type ApprovalType = typeof APPROVAL_TYPES[number];

export const DECISION_OUTCOMES = ['APPROVED', 'REJECTED', 'RETURNED'] as const;
export type DecisionOutcome = typeof DECISION_OUTCOMES[number];

export const APPROVAL_ACTIONS = [
  'CREATED', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW',
  'APPROVED', 'REJECTED', 'RETURNED', 'WITHDRAWN',
  'COMMENTED', 'ATTACHMENT_ADDED', 'EXPIRED',
] as const;
export type ApprovalAction = typeof APPROVAL_ACTIONS[number];

export const APPROVAL_DOC_TYPES = [
  'SUPPORTING_DOCUMENT', 'LEGAL_REFERENCE', 'TECHNICAL_SPEC',
  'COST_ESTIMATE', 'AUTHORITY_CONFIRMATION',
] as const;
export type ApprovalDocumentType = typeof APPROVAL_DOC_TYPES[number];

export const SUBJECT_TYPES = ['PLAN', 'PACKAGE'] as const;
export type SubjectType = typeof SUBJECT_TYPES[number];

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApprovalError extends Error {
  constructor(readonly code: string, readonly field: string, message: string) {
    super(message);
    this.name = 'ApprovalError';
  }
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  readonly id:                    string;
  readonly requestCode:           string;    // unique e.g. APR/DTMS/2026/001
  readonly approvalType:          ApprovalType;
  readonly subjectId:             string;    // planId or packageId
  readonly subjectType:           SubjectType;
  readonly requestedBy:           string;    // employee code
  readonly requestedAt:           string;    // ISO
  readonly department:            string;    // requesting department code
  readonly estimatedValue:        number;    // VNĐ — used for authority threshold
  readonly assignedAuthorityCode?: string;   // from masterdata ApprovalAuthority.code
  readonly assignedAuthorityName?: string;
  readonly dueDate?:              string;    // YYYY-MM-DD
  readonly status:                ApprovalStatus;
  readonly decisionId?:           string;    // links to ApprovalDecisionRecord
  readonly notes?:                string;
  readonly createdAt:             string;
  readonly updatedAt:             string;
}

export interface ApprovalDecisionRecord {
  readonly id:                string;
  readonly requestId:         string;
  readonly outcome:           DecisionOutcome;
  readonly decidedBy:         string;    // employee code
  readonly decidedAt:         string;    // ISO
  readonly legalBasis:        string;    // e.g. 'NĐ 214/2025 Điều 76 khoản 1'
  readonly conditions:        readonly string[];
  readonly revisionRequired:  readonly string[];  // for RETURNED outcome
  readonly decisionReference: string;   // official reference number
  readonly createdAt:         string;
  readonly updatedAt:         string;
}

export interface ApprovalHistoryEntry {
  readonly id:          string;
  readonly requestId:   string;
  readonly action:      ApprovalAction;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly fromStatus?: ApprovalStatus;
  readonly toStatus?:   ApprovalStatus;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export interface ApprovalComment {
  readonly id:         string;
  readonly requestId:  string;
  readonly content:    string;
  readonly authorCode: string;
  readonly isInternal: boolean;
  readonly createdAt:  string;
  readonly updatedAt:  string;
}

export interface ApprovalAttachment {
  readonly id:           string;
  readonly requestId:    string;
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;  // bytes
  readonly uploadedBy:   string;
  readonly documentType: ApprovalDocumentType;
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface CreateApprovalRequestParams {
  readonly requestCode:    string;
  readonly approvalType:   ApprovalType;
  readonly subjectId:      string;
  readonly subjectType:    SubjectType;
  readonly requestedBy:    string;
  readonly department:     string;
  readonly estimatedValue: number;
  readonly dueDate?:       string;
  readonly notes?:         string;
}

export interface RecordDecisionParams {
  readonly outcome:           DecisionOutcome;
  readonly decidedBy:         string;
  readonly legalBasis:        string;
  readonly conditions?:       readonly string[];
  readonly revisionRequired?: readonly string[];
  readonly decisionReference: string;
}

export interface AddCommentParams {
  readonly content:    string;
  readonly authorCode: string;
  readonly isInternal?: boolean;
}

export interface AddAttachmentParams {
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;
  readonly documentType: ApprovalDocumentType;
}

// ─── Query / result ───────────────────────────────────────────────────────────

export interface ApprovalSearchQuery {
  readonly term?:        string;
  readonly status?:      ApprovalStatus;
  readonly approvalType?: ApprovalType;
  readonly department?:  string;
  readonly subjectId?:   string;
  readonly page?:        number;
  readonly pageSize?:    number;
}

export interface ApprovalSearchResult<T> {
  readonly items:    readonly T[];
  readonly total:    number;
  readonly page:     number;
  readonly pageSize: number;
}

export interface ApprovalValidationResult {
  readonly valid:    boolean;
  readonly errors:   readonly string[];
  readonly warnings: readonly string[];
}

export interface ApprovalSummary {
  readonly requestCode:      string;
  readonly approvalType:     ApprovalType;
  readonly status:           ApprovalStatus;
  readonly subjectId:        string;
  readonly subjectType:      SubjectType;
  readonly assignedAuthority?: string;
  readonly decisionOutcome?:  DecisionOutcome;
  readonly commentCount:     number;
  readonly attachmentCount:  number;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isApprovalStatus(v: unknown): v is ApprovalStatus {
  return typeof v === 'string' && (APPROVAL_STATUSES as readonly string[]).includes(v);
}

export function isDecisionOutcome(v: unknown): v is DecisionOutcome {
  return typeof v === 'string' && (DECISION_OUTCOMES as readonly string[]).includes(v);
}

export function isApprovalType(v: unknown): v is ApprovalType {
  return typeof v === 'string' && (APPROVAL_TYPES as readonly string[]).includes(v);
}

export function isSubjectType(v: unknown): v is SubjectType {
  return v === 'PLAN' || v === 'PACKAGE';
}
