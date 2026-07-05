import type { Money } from '../shared/financial/money';
import { createMoney } from '../shared/financial/money';
import type { LegalBasis } from '../shared/financial/financialFactory';
import { createLegalBasis, PROCUREMENT_LEGAL_BASIS } from '../shared/financial/financialFactory';
import type {
  PaymentRequest, Payment, PaymentInstallment, TreasurySubmission,
  PaymentHistoryEntry, PaymentDocument, PaymentEvent, PaymentSummary,
  PaymentTimeline, PaymentBatch,
  CreatePaymentRequestParams, CreateInstallmentParams,
  CreateTreasurySubmissionParams, AddAttachmentParams,
  PaymentAction, TreasuryStatus,
} from './paymentTypes';

// ─── Code generators ──────────────────────────────────────────────────────────

export function buildPaymentRequestCode(
  department:  string,
  paymentType: string,
  seq:         number,
  fiscalYear?: number,
): string {
  const year = fiscalYear ?? new Date().getFullYear();
  const typeCode = paymentType.slice(0, 3).toUpperCase();
  return `PR-${department.toUpperCase().slice(0, 4)}-${typeCode}-${year}-${String(seq).padStart(4, '0')}`;
}

export function buildPaymentNumber(requestCode: string, seq: number): string {
  return `PAY/${requestCode}/${String(seq).padStart(3, '0')}`;
}

export function buildInstallmentCode(requestCode: string, seq: number): string {
  return `INST/${requestCode}/${String(seq).padStart(2, '0')}`;
}

export function buildTreasurySubmissionCode(requestCode: string, seq: number): string {
  return `KBNN/${requestCode}/${String(seq).padStart(3, '0')}`;
}

export function buildBatchCode(department: string, seq: number): string {
  const year = new Date().getFullYear();
  return `BATCH-${department.toUpperCase().slice(0, 4)}-${year}-${String(seq).padStart(4, '0')}`;
}

// ─── Entity factories ─────────────────────────────────────────────────────────

export function buildPaymentRequest(
  params: CreatePaymentRequestParams & { id: string; resolvedRuleId?: string },
): PaymentRequest {
  const ts = new Date().toISOString();
  return {
    id:             params.id,
    requestCode:    params.requestCode,
    paymentType:    params.paymentType,
    contractId:     params.contractId,
    packageId:      params.packageId,
    acceptanceId:   params.acceptanceId,
    workflowId:     params.workflowId,
    requestedBy:    params.requestedBy,
    requestedAt:    ts,
    department:     params.department,
    amount:         params.amount,
    legalBasis:     params.legalBasis?.length ? params.legalBasis : PROCUREMENT_LEGAL_BASIS,
    resolvedRuleId: params.resolvedRuleId,
    status:         'DRAFT',
    notes:          params.notes,
    createdAt:      ts,
    updatedAt:      ts,
  };
}

export function buildPayment(params: {
  id:          string;
  requestId:   string;
  paymentNumber: string;
  amount:      Money;
  paidAt?:     string;
  treasuryRef?: string;
  notes?:      string;
}): Payment {
  const ts = new Date().toISOString();
  return {
    ...params,
    status:    'PAID',
    createdAt: ts,
    updatedAt: ts,
  };
}

export function buildInstallment(
  params: CreateInstallmentParams & { id: string },
): PaymentInstallment {
  const ts = new Date().toISOString();
  return {
    id:                 params.id,
    requestId:          params.requestId,
    installmentCode:    params.installmentCode,
    installmentNumber:  params.installmentNumber,
    amount:             params.amount,
    dueDate:            params.dueDate,
    status:             'DRAFT',
    notes:              params.notes,
    createdAt:          ts,
    updatedAt:          ts,
  };
}

export function buildTreasurySubmission(
  params: CreateTreasurySubmissionParams & { id: string },
): TreasurySubmission {
  const ts = new Date().toISOString();
  return {
    id:              params.id,
    requestId:       params.requestId,
    submissionCode:  params.submissionCode,
    submittedBy:     params.submittedBy,
    submittedAt:     ts,
    treasuryBranch:  params.treasuryBranch,
    status:          'SUBMITTED',
    createdAt:       ts,
    updatedAt:       ts,
  };
}

export function buildHistoryEntry(params: {
  id:          string;
  requestId:   string;
  action:      PaymentAction;
  performedBy: string;
  fromStatus?: string;
  toStatus?:   string;
  notes?:      string;
}): PaymentHistoryEntry {
  const ts = new Date().toISOString();
  return {
    id:          params.id,
    requestId:   params.requestId,
    action:      params.action,
    performedBy: params.performedBy,
    performedAt: ts,
    fromStatus:  params.fromStatus as PaymentHistoryEntry['fromStatus'],
    toStatus:    params.toStatus as PaymentHistoryEntry['toStatus'],
    notes:       params.notes,
    createdAt:   ts,
    updatedAt:   ts,
  };
}

export function buildDocument(params: AddAttachmentParams & { id: string }): PaymentDocument {
  const ts = new Date().toISOString();
  return {
    id:           params.id,
    requestId:    params.requestId,
    fileName:     params.fileName,
    fileType:     params.fileType,
    fileSize:     params.fileSize,
    uploadedBy:   params.uploadedBy,
    documentType: params.documentType,
    createdAt:    ts,
    updatedAt:    ts,
  };
}

export function buildPaymentEvent(params: {
  id:          string;
  requestId:   string;
  eventType:   PaymentAction;
  performedBy: string;
  amount?:     Money;
  notes?:      string;
}): PaymentEvent {
  return { ...params, occurredAt: new Date().toISOString() };
}

// ─── Summary builder ──────────────────────────────────────────────────────────

export function buildPaymentSummary(
  request:           PaymentRequest,
  installmentCount:  number,
  approvalStatus?:   string,
  treasuryStatus?:   TreasuryStatus,
  isOverdue?:        boolean,
): PaymentSummary {
  return {
    requestCode:      request.requestCode,
    paymentType:      request.paymentType,
    status:           request.status,
    contractId:       request.contractId,
    department:       request.department,
    amount:           request.amount,
    legalBasisCount:  request.legalBasis.length,
    installmentCount,
    approvalStatus,
    treasuryStatus,
    isOverdue:        isOverdue ?? false,
  };
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

export function buildPaymentTimeline(
  requestId:   string,
  requestedAt: string,
  entries:     readonly PaymentHistoryEntry[],
  asOfDate:    string,
): PaymentTimeline {
  const find = (action: PaymentAction): string | undefined =>
    entries.find(e => e.action === action)?.performedAt;

  const paidAt = find('PAID');
  const start  = new Date(requestedAt).getTime();
  const now    = new Date(asOfDate).getTime();
  const days   = Math.floor((now - start) / 86_400_000);

  return {
    requestId,
    requestedAt,
    approvedAt:    find('APPROVED'),
    treasuryAt:    find('TREASURY_APPROVED'),
    paidAt,
    suspendedAt:   find('SUSPENDED'),
    cancelledAt:   find('CANCELLED'),
    daysSinceRequest: days,
    isOverdue:     !paidAt && days > 30,  // ponytail: 30-day flag; real limit resolved by rule engine
  };
}

// ─── Batch factory ────────────────────────────────────────────────────────────

export function buildPaymentBatch(params: {
  id:          string;
  batchCode:   string;
  requests:    readonly PaymentRequest[];
  processedBy: string;
}): PaymentBatch {
  const total = params.requests.reduce((sum, r) => ({
    amount:   sum.amount + r.amount.amount,
    currency: r.amount.currency,
  }), { amount: 0n, currency: params.requests[0]?.amount.currency ?? 'VND' });

  const ts = new Date().toISOString();
  return {
    id:          params.id,
    batchCode:   params.batchCode,
    requestIds:  params.requests.map(r => r.id),
    totalAmount: createMoney(total.amount, total.currency),
    status:      'PENDING_APPROVAL',
    processedBy: params.processedBy,
    processedAt: ts,
    createdAt:   ts,
    updatedAt:   ts,
  };
}

// ─── Legal basis helper ───────────────────────────────────────────────────────

export function buildPaymentLegalBasis(additional: readonly LegalBasis[] = []): readonly LegalBasis[] {
  const seen = new Set<string>();
  return [...PROCUREMENT_LEGAL_BASIS, ...additional].filter(b => {
    if (seen.has(b.document)) return false;
    seen.add(b.document);
    return true;
  });
}
