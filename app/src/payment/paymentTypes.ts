import type { Money } from '../shared/financial/money';
import type { LegalBasis } from '../shared/financial/financialFactory';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
  'SUBMITTED_TREASURY', 'TREASURY_APPROVED', 'TREASURY_REJECTED',
  'PAID', 'SUSPENDED', 'CANCELLED', 'REJECTED',
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const PAYMENT_TYPES = [
  'ADVANCE',           // Tạm ứng
  'PROGRESS',          // Thanh toán theo tiến độ
  'FINAL',             // Quyết toán / Thanh toán cuối
  'RETENTION_RELEASE', // Giải phóng khấu trừ bảo hành
  'WARRANTY_RELEASE',  // Giải phóng bảo đảm bảo hành
  'GUARANTEE_RELEASE', // Giải phóng bảo đảm thực hiện hợp đồng
] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export const TREASURY_STATUSES = [
  'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED',
] as const;
export type TreasuryStatus = typeof TREASURY_STATUSES[number];

export const PAYMENT_ACTIONS = [
  'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED',
  'TREASURY_SUBMITTED', 'TREASURY_APPROVED', 'TREASURY_REJECTED',
  'PAID', 'SUSPENDED', 'RESUMED', 'CANCELLED', 'NOTE_ADDED', 'ATTACHMENT_ADDED',
] as const;
export type PaymentAction = typeof PAYMENT_ACTIONS[number];

// ─── Error ────────────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(
    public readonly code: string,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface PaymentRequest {
  readonly id:              string;
  readonly requestCode:     string;
  readonly paymentType:     PaymentType;
  readonly contractId:      string;
  readonly packageId?:      string;
  readonly acceptanceId?:   string;
  readonly workflowId?:     string;
  readonly requestedBy:     string;
  readonly requestedAt:     string;  // ISO 8601
  readonly department:      string;
  readonly amount:          Money;   // bigint — never float
  readonly legalBasis:      readonly LegalBasis[];
  readonly resolvedRuleId?: string;  // traceability: which PaymentLegalRule governed this
  readonly status:          PaymentStatus;
  readonly notes?:          string;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export interface Payment {
  readonly id:            string;
  readonly requestId:     string;
  readonly paymentNumber: string;
  readonly amount:        Money;
  readonly paidAt?:       string;
  readonly treasuryRef?:  string;
  readonly status:        PaymentStatus;
  readonly notes?:        string;
  readonly createdAt:     string;
  readonly updatedAt:     string;
}

export interface PaymentInstallment {
  readonly id:                string;
  readonly requestId:         string;
  readonly installmentCode:   string;
  readonly installmentNumber: number;
  readonly amount:            Money;
  readonly dueDate:           string;  // YYYY-MM-DD
  readonly paidAt?:           string;
  readonly status:            PaymentStatus;
  readonly notes?:            string;
  readonly createdAt:         string;
  readonly updatedAt:         string;
}

export interface PaymentBatch {
  readonly id:          string;
  readonly batchCode:   string;
  readonly requestIds:  readonly string[];
  readonly totalAmount: Money;
  readonly status:      PaymentStatus;
  readonly processedBy: string;
  readonly processedAt: string;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export interface PaymentApproval {
  readonly id:         string;
  readonly requestId:  string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly decision:   'APPROVED' | 'REJECTED';
  readonly reason?:    string;
  readonly notes?:     string;
  readonly createdAt:  string;
  readonly updatedAt:  string;
}

export interface PaymentHistoryEntry {
  readonly id:          string;
  readonly requestId:   string;
  readonly action:      PaymentAction;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly fromStatus?: PaymentStatus;
  readonly toStatus?:   PaymentStatus;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export interface PaymentDocument {
  readonly id:           string;
  readonly requestId:    string;
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;
  readonly uploadedBy:   string;
  readonly documentType: string;
  readonly notes?:       string;
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

export interface TreasurySubmission {
  readonly id:              string;
  readonly requestId:       string;
  readonly submissionCode:  string;
  readonly submittedBy:     string;
  readonly submittedAt:     string;
  readonly treasuryBranch?: string;
  readonly status:          TreasuryStatus;
  readonly approvedAt?:     string;
  readonly rejectedAt?:     string;
  readonly rejectReason?:   string;
  readonly notes?:          string;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export interface PaymentAudit {
  readonly id:          string;
  readonly requestId:   string;
  readonly auditType:   string;
  readonly auditedBy:   string;
  readonly auditedAt:   string;
  readonly findings?:   string;
  readonly resolution?: string;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export interface PaymentTimeline {
  readonly requestId:       string;
  readonly requestedAt:     string;
  readonly approvedAt?:     string;
  readonly treasuryAt?:     string;
  readonly paidAt?:         string;
  readonly suspendedAt?:    string;
  readonly cancelledAt?:    string;
  readonly daysSinceRequest?: number;
  readonly isOverdue:       boolean;
}

export interface PaymentEvent {
  readonly id:          string;
  readonly requestId:   string;
  readonly eventType:   PaymentAction;
  readonly occurredAt:  string;
  readonly performedBy: string;
  readonly amount?:     Money;
  readonly notes?:      string;
}

export interface PaymentReference {
  readonly requestId:     string;
  readonly contractId:    string;
  readonly packageId?:    string;
  readonly acceptanceId?: string;
  readonly legalBasis:    readonly LegalBasis[];
}

export interface PaymentSummary {
  readonly requestCode:      string;
  readonly paymentType:      PaymentType;
  readonly status:           PaymentStatus;
  readonly contractId:       string;
  readonly department:       string;
  readonly amount:           Money;
  readonly legalBasisCount:  number;
  readonly installmentCount: number;
  readonly approvalStatus?:  string;
  readonly treasuryStatus?:  TreasuryStatus;
  readonly isOverdue:        boolean;
}

export interface PaymentValidationResult {
  readonly valid:         boolean;
  readonly errors:        readonly string[];
  readonly warnings:      readonly string[];
  readonly resolvedRule?: string;  // ruleId applied for traceability
  readonly legalBasis:    readonly LegalBasis[];
}

// ─── Params ────────────────────────────────────────────────────────────────────

export interface CreatePaymentRequestParams {
  requestCode:   string;
  paymentType:   PaymentType;
  contractId:    string;
  packageId?:    string;
  acceptanceId?: string;
  workflowId?:   string;
  requestedBy:   string;
  department:    string;
  amount:        Money;
  legalBasis?:   readonly LegalBasis[];
  notes?:        string;
}

export interface CreateInstallmentParams {
  requestId:          string;
  installmentCode:    string;
  installmentNumber:  number;
  amount:             Money;
  dueDate:            string;
  notes?:             string;
}

export interface CreateTreasurySubmissionParams {
  requestId:       string;
  submissionCode:  string;
  submittedBy:     string;
  treasuryBranch?: string;
}

export interface AddAttachmentParams {
  requestId:    string;
  fileName:     string;
  fileType:     string;
  fileSize:     number;
  uploadedBy:   string;
  documentType: string;
}

// ─── Search ────────────────────────────────────────────────────────────────────

export interface PaymentSearchQuery {
  contractId?:  string;
  status?:      PaymentStatus;
  paymentType?: PaymentType;
  department?:  string;
  page?:        number;
  pageSize?:    number;
}

export interface PaymentSearchResult<T> {
  readonly items:    readonly T[];
  readonly total:    number;
  readonly page:     number;
  readonly pageSize: number;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(v);
}

export function isPaymentType(v: unknown): v is PaymentType {
  return typeof v === 'string' && (PAYMENT_TYPES as readonly string[]).includes(v);
}

export function isTreasuryStatus(v: unknown): v is TreasuryStatus {
  return typeof v === 'string' && (TREASURY_STATUSES as readonly string[]).includes(v);
}

export function isPaymentAction(v: unknown): v is PaymentAction {
  return typeof v === 'string' && (PAYMENT_ACTIONS as readonly string[]).includes(v);
}
