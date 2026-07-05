/**
 * Payment Service — PaymentRequest lifecycle
 *
 * Manages the full lifecycle of a PaymentRequest:
 *   DRAFT → PENDING_APPROVAL → APPROVED → SUBMITTED_TREASURY
 *   → TREASURY_APPROVED → PAID
 *   SUSPENDED / CANCELLED / REJECTED at any pre-PAID stage.
 *
 * All state transitions record to the immutable audit trail (PRINCIPLE 3).
 * All validation is legal-rule-driven — no hardcoded limits.
 */

import type { LegalBasis } from '../shared/financial/financialFactory';
import { PROCUREMENT_LEGAL_BASIS } from '../shared/financial/financialFactory';
import type {
  PaymentRequest, Payment, PaymentDocument, PaymentSummary,
  CreatePaymentRequestParams, AddAttachmentParams,
  PaymentStatus, PaymentType,
} from './paymentTypes';
import { PaymentError } from './paymentTypes';
import type {
  IPaymentRequestRepository, IPaymentRepository,
  IPaymentHistoryRepository, IPaymentDocumentRepository,
} from './paymentRepository';
import {
  buildPaymentRequest, buildPayment, buildDocument,
  buildPaymentRequestCode, buildPaymentNumber, buildPaymentSummary,
} from './paymentFactory';
import { validateCreatePaymentRequestParams, validateStatusTransition } from './paymentValidation';
import { recordPaymentAction } from './paymentHistoryService';

let _seq = 0;
function uid(): string { return `pr-${Date.now()}-${++_seq}`; }
function payUid(): string { return `pay-${Date.now()}-${++_seq}`; }
function docUid(): string { return `doc-${Date.now()}-${++_seq}`; }

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  params:      CreatePaymentRequestParams,
  resolvedRuleId?: string,
): Promise<PaymentRequest> {
  const validation = validateCreatePaymentRequestParams(params);
  if (!validation.valid)
    throw new PaymentError('INVALID_PARAMS', 'params', validation.errors.join('; '));

  const seqNum = (await repo.count()) + 1;
  const requestCode = params.requestCode ||
    buildPaymentRequestCode(params.department, params.paymentType, seqNum);

  const entity = buildPaymentRequest({
    ...params,
    requestCode,
    id: uid(),
    resolvedRuleId,
    legalBasis: params.legalBasis?.length ? params.legalBasis : PROCUREMENT_LEGAL_BASIS,
  });

  const created = await repo.create(entity as Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt'>);
  await recordPaymentAction(historyRepo, created.id, 'CREATED', params.requestedBy, {
    toStatus: 'DRAFT',
  });
  return created;
}

// ─── Submit for approval ──────────────────────────────────────────────────────

export async function submitPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'PENDING_APPROVAL');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'PENDING_APPROVAL' });
  await recordPaymentAction(historyRepo, id, 'SUBMITTED', performedBy, {
    fromStatus: req.status,
    toStatus:   'PENDING_APPROVAL',
  });
  return updated;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export async function approvePaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
  notes?:      string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'APPROVED');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'APPROVED' });
  await recordPaymentAction(historyRepo, id, 'APPROVED', performedBy, {
    fromStatus: req.status,
    toStatus:   'APPROVED',
    notes,
  });
  return updated;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
  reason:      string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'REJECTED');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'REJECTED', notes: reason });
  await recordPaymentAction(historyRepo, id, 'REJECTED', performedBy, {
    fromStatus: req.status,
    toStatus:   'REJECTED',
    notes:      reason,
  });
  return updated;
}

// ─── Suspend ──────────────────────────────────────────────────────────────────

export async function suspendPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
  reason:      string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'SUSPENDED');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'SUSPENDED', notes: reason });
  await recordPaymentAction(historyRepo, id, 'SUSPENDED', performedBy, {
    fromStatus: req.status,
    toStatus:   'SUSPENDED',
    notes:      reason,
  });
  return updated;
}

// ─── Resume from suspension ───────────────────────────────────────────────────

export async function resumePaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'APPROVED');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'APPROVED' });
  await recordPaymentAction(historyRepo, id, 'RESUMED', performedBy, {
    fromStatus: 'SUSPENDED',
    toStatus:   'APPROVED',
  });
  return updated;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
  reason:      string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);

  const validation = validateStatusTransition(req.status, 'CANCELLED');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const updated = await repo.update(id, { status: 'CANCELLED', notes: reason });
  await recordPaymentAction(historyRepo, id, 'CANCELLED', performedBy, {
    fromStatus: req.status,
    toStatus:   'CANCELLED',
    notes:      reason,
  });
  return updated;
}

// ─── Mark as paid ─────────────────────────────────────────────────────────────

export async function markPaymentPaid(
  requestRepo: IPaymentRequestRepository,
  paymentRepo: IPaymentRepository,
  historyRepo: IPaymentHistoryRepository,
  requestId:   string,
  performedBy: string,
  params:      { treasuryRef?: string; notes?: string },
): Promise<{ request: PaymentRequest; payment: Payment }> {
  const req = await requestRepo.findById(requestId);
  if (!req) throw new PaymentError('NOT_FOUND', 'requestId', `PaymentRequest ${requestId} not found`);

  const validation = validateStatusTransition(req.status, 'PAID');
  if (!validation.valid) throw new PaymentError('INVALID_TRANSITION', 'status', validation.errors[0]!);

  const seqNum = (await paymentRepo.count()) + 1;
  const paymentNumber = buildPaymentNumber(req.requestCode, seqNum);

  const paymentEntity = buildPayment({
    id:            payUid(),
    requestId,
    paymentNumber,
    amount:        req.amount,
    paidAt:        new Date().toISOString(),
    treasuryRef:   params.treasuryRef,
    notes:         params.notes,
  });

  const [updatedReq, payment] = await Promise.all([
    requestRepo.update(requestId, { status: 'PAID' }),
    paymentRepo.create(paymentEntity as Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>),
  ]);

  await recordPaymentAction(historyRepo, requestId, 'PAID', performedBy, {
    fromStatus: req.status,
    toStatus:   'PAID',
    notes:      params.notes,
  });

  return { request: updatedReq, payment };
}

// ─── Add document ─────────────────────────────────────────────────────────────

export async function addPaymentDocument(
  docRepo:  IPaymentDocumentRepository,
  histRepo: IPaymentHistoryRepository,
  params:   AddAttachmentParams,
): Promise<PaymentDocument> {
  const doc = buildDocument({ ...params, id: docUid() });
  const created = await docRepo.create(doc as Omit<PaymentDocument, 'id' | 'createdAt' | 'updatedAt'>);
  await recordPaymentAction(histRepo, params.requestId, 'ATTACHMENT_ADDED', params.uploadedBy);
  return created;
}

// ─── Add note ─────────────────────────────────────────────────────────────────

export async function addPaymentNote(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  id:          string,
  performedBy: string,
  note:        string,
): Promise<PaymentRequest> {
  const req = await repo.findById(id);
  if (!req) throw new PaymentError('NOT_FOUND', 'id', `PaymentRequest ${id} not found`);
  const updated = await repo.update(id, { notes: note });
  await recordPaymentAction(historyRepo, id, 'NOTE_ADDED', performedBy, { notes: note });
  return updated;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export async function getPaymentsByContract(
  repo:       IPaymentRequestRepository,
  contractId: string,
): Promise<readonly PaymentRequest[]> {
  return repo.findByContractId(contractId);
}

export async function getPaymentsByStatus(
  repo:   IPaymentRequestRepository,
  status: PaymentStatus,
): Promise<readonly PaymentRequest[]> {
  return repo.findByStatus(status);
}

export async function getPaymentsByType(
  repo:        IPaymentRequestRepository,
  paymentType: PaymentType,
): Promise<readonly PaymentRequest[]> {
  return repo.findByType(paymentType);
}
