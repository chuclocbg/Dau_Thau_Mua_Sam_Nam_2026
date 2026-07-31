/**
 * Treasury Submission Service (Kiểm soát chi KBNN)
 *
 * Handles submission to Kho bạc Nhà nước (State Treasury).
 * Whether treasury submission is required is resolved via PaymentRuleEngine.
 * No hardcoded fund source checks or document thresholds.
 */

import type { PaymentRequest, TreasurySubmission, CreateTreasurySubmissionParams } from './paymentTypes';
import { PaymentError } from './paymentTypes';
import type { IPaymentRequestRepository, ITreasurySubmissionRepository, IPaymentHistoryRepository } from './paymentRepository';
import type { PaymentLegalRule, PaymentRuleContext } from './paymentLegalRule';
import { resolvePaymentRule, isRulePresentlyEffective } from './paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from './paymentRuleRegistry';
import { buildTreasurySubmission, buildTreasurySubmissionCode } from './paymentFactory';
import { recordPaymentAction } from './paymentHistoryService';

let _seq = 0;
function uid(): string { return `treas-${Date.now()}-${++_seq}`; }

// ─── Submit to treasury ───────────────────────────────────────────────────────

export async function submitToTreasury(
  requestRepo:  IPaymentRequestRepository,
  treasuryRepo: ITreasurySubmissionRepository,
  historyRepo:  IPaymentHistoryRepository,
  params:       CreateTreasurySubmissionParams,
  options?:     { rules?: readonly PaymentLegalRule[]; packageType?: string },
): Promise<{ submission: TreasurySubmission; updatedRequest: PaymentRequest }> {
  const req = await requestRepo.findById(params.requestId);
  if (!req) throw new PaymentError('NOT_FOUND', 'requestId', `PaymentRequest ${params.requestId} not found`);

  if (req.status !== 'APPROVED')
    throw new PaymentError('INVALID_STATUS', 'status', `Only APPROVED requests can be submitted to treasury; current: ${req.status}`);

  // KI-010: re-check the request's already-resolved governing rule (set earlier in the
  // payment lifecycle) is still effective. Does not evaluate options.rules or resolve a
  // rule from scratch -- narrower scope, see ADR-KI-010.md.
  if (req.resolvedRuleId) {
    const rule = PAYMENT_LEGAL_RULES.find(r => r.ruleId === req.resolvedRuleId);
    const asOfDate = new Date().toISOString().slice(0, 10);
    if (!rule || !isRulePresentlyEffective(rule, asOfDate)) {
      throw new PaymentError(
        'RULE_NOT_FOUND', 'resolvedRuleId',
        `Governing rule ${req.resolvedRuleId} is no longer effective; treasury submission blocked`,
      );
    }
  }

  const seqNum = (await treasuryRepo.count()) + 1;
  const submissionCode = params.submissionCode ||
    buildTreasurySubmissionCode(req.requestCode, seqNum);

  const entity = buildTreasurySubmission({ ...params, id: uid(), submissionCode });
  const submission = await treasuryRepo.create(
    entity as Omit<TreasurySubmission, 'id' | 'createdAt' | 'updatedAt'>,
  );

  const updatedRequest = await requestRepo.update(params.requestId, { status: 'SUBMITTED_TREASURY' });

  await recordPaymentAction(historyRepo, params.requestId, 'TREASURY_SUBMITTED', params.submittedBy, {
    fromStatus: 'APPROVED',
    toStatus:   'SUBMITTED_TREASURY',
    notes:      `Submitted to treasury branch: ${params.treasuryBranch ?? 'unspecified'}`,
  });

  return { submission, updatedRequest };
}

// ─── Treasury approve ─────────────────────────────────────────────────────────

export async function approveTreasurySubmission(
  requestRepo:   IPaymentRequestRepository,
  treasuryRepo:  ITreasurySubmissionRepository,
  historyRepo:   IPaymentHistoryRepository,
  submissionId:  string,
  approvedBy:    string,
): Promise<{ submission: TreasurySubmission; updatedRequest: PaymentRequest }> {
  const submission = await treasuryRepo.findById(submissionId);
  if (!submission) throw new PaymentError('NOT_FOUND', 'submissionId', `TreasurySubmission ${submissionId} not found`);
  if (submission.status !== 'SUBMITTED')
    throw new PaymentError('INVALID_STATUS', 'status', `Submission is ${submission.status}, not SUBMITTED`);

  const updatedSubmission = await treasuryRepo.update(submissionId, {
    status:     'APPROVED',
    approvedAt: new Date().toISOString(),
  });

  const updatedRequest = await requestRepo.update(submission.requestId, { status: 'TREASURY_APPROVED' });

  await recordPaymentAction(historyRepo, submission.requestId, 'TREASURY_APPROVED', approvedBy, {
    fromStatus: 'SUBMITTED_TREASURY',
    toStatus:   'TREASURY_APPROVED',
  });

  return { submission: updatedSubmission, updatedRequest };
}

// ─── Treasury reject ──────────────────────────────────────────────────────────

export async function rejectTreasurySubmission(
  requestRepo:   IPaymentRequestRepository,
  treasuryRepo:  ITreasurySubmissionRepository,
  historyRepo:   IPaymentHistoryRepository,
  submissionId:  string,
  rejectedBy:    string,
  rejectReason:  string,
): Promise<{ submission: TreasurySubmission; updatedRequest: PaymentRequest }> {
  const submission = await treasuryRepo.findById(submissionId);
  if (!submission) throw new PaymentError('NOT_FOUND', 'submissionId', `TreasurySubmission ${submissionId} not found`);
  if (submission.status !== 'SUBMITTED')
    throw new PaymentError('INVALID_STATUS', 'status', `Submission is ${submission.status}, not SUBMITTED`);

  const updatedSubmission = await treasuryRepo.update(submissionId, {
    status:       'REJECTED',
    rejectedAt:   new Date().toISOString(),
    rejectReason,
  });

  const updatedRequest = await requestRepo.update(submission.requestId, { status: 'TREASURY_REJECTED' });

  await recordPaymentAction(historyRepo, submission.requestId, 'TREASURY_REJECTED', rejectedBy, {
    fromStatus: 'SUBMITTED_TREASURY',
    toStatus:   'TREASURY_REJECTED',
    notes:      rejectReason,
  });

  return { submission: updatedSubmission, updatedRequest };
}

// ─── Check treasury requirement ───────────────────────────────────────────────

export function checkTreasuryRequired(
  fundSource:  string,
  packageType: string,
  asOfDate:    string,
  rules:       readonly PaymentLegalRule[] = PAYMENT_LEGAL_RULES,
): { required: boolean; ruleId: string | null; legalBasis: readonly import('../shared/financial/financialFactory').LegalBasis[] } {
  const ctx: PaymentRuleContext = { packageType, fundSource, asOfDate };
  const resolution = resolvePaymentRule('TREASURY_THRESHOLD', ctx, rules);
  return {
    required:   resolution.resolved && (resolution.params['required'] ?? 0) === 1,
    ruleId:     resolution.rule?.ruleId ?? null,
    legalBasis: resolution.legalBasis,
  };
}

// ─── Get active treasury submissions for a request ────────────────────────────

export async function getActiveTreasurySubmissions(
  treasuryRepo: ITreasurySubmissionRepository,
  requestId:    string,
): Promise<readonly TreasurySubmission[]> {
  const all = await treasuryRepo.findByRequestId(requestId);
  return all.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING');
}
