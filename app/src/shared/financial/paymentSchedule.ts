import type { Money } from './money';
import { FinancialError, addMoney, zeroMoney, isPositiveMoney } from './money';
import type { LegalBasis } from './financialFactory';
import { createLegalBasis } from './financialFactory';

export type PaymentMilestoneStatus = 'PENDING' | 'DUE' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export const PAYMENT_MILESTONE_STATUSES: readonly PaymentMilestoneStatus[] = [
  'PENDING', 'DUE', 'PAID', 'OVERDUE', 'CANCELLED',
];

export interface PaymentMilestone {
  readonly id:            string;
  readonly code:          string;
  readonly description:   string;
  readonly scheduledDate: string; // YYYY-MM-DD
  readonly dueAmount:     Money;
  readonly actualAmount?: Money;
  readonly status:        PaymentMilestoneStatus;
  readonly paidAt?:       string;
  readonly notes?:        string;
}

// AdvanceRate — governs the advance payment to a contractor.
// Maximum 30% of contract value per TT 79/2025/TT-BTC for most package types.
export interface AdvanceRate {
  readonly rate:              number; // 0.0 – 1.0 (e.g., 0.30 = 30%)
  readonly maxAmount?:        Money;  // hard cap regardless of percentage
  readonly guaranteeRequired: boolean;
  readonly legalBasis:        LegalBasis;
}

export const DEFAULT_ADVANCE_RATE: AdvanceRate = {
  rate:              0.30,
  guaranteeRequired: true,
  legalBasis:        createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 15', summary: 'Tỷ lệ tạm ứng tối đa 30% giá trị hợp đồng' }),
};

export function createPaymentMilestone(params: {
  id:            string;
  code:          string;
  description:   string;
  scheduledDate: string;
  dueAmount:     Money;
  notes?:        string;
}): PaymentMilestone {
  if (!params.code.trim())
    throw new FinancialError('INVALID_AMOUNT', 'code', 'Milestone code is required');
  if (!params.description.trim())
    throw new FinancialError('INVALID_AMOUNT', 'description', 'Milestone description is required');
  if (!isPositiveMoney(params.dueAmount))
    throw new FinancialError('ZERO_AMOUNT', 'dueAmount', 'Milestone dueAmount must be positive');
  return { ...params, status: 'PENDING' };
}

export function markMilestoneDue(milestone: PaymentMilestone): PaymentMilestone {
  if (milestone.status !== 'PENDING')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot mark DUE from status: ${milestone.status}`);
  return { ...milestone, status: 'DUE' };
}

export function markMilestonePaid(milestone: PaymentMilestone, actualAmount: Money): PaymentMilestone {
  if (milestone.status !== 'DUE' && milestone.status !== 'OVERDUE')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot mark PAID from status: ${milestone.status}`);
  return { ...milestone, status: 'PAID', actualAmount, paidAt: new Date().toISOString() };
}

export function markMilestoneOverdue(milestone: PaymentMilestone): PaymentMilestone {
  if (milestone.status !== 'DUE' && milestone.status !== 'PENDING')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot mark OVERDUE from status: ${milestone.status}`);
  return { ...milestone, status: 'OVERDUE' };
}

export function cancelMilestone(milestone: PaymentMilestone): PaymentMilestone {
  if (milestone.status === 'PAID')
    throw new FinancialError('INVALID_STATUS', 'status', 'Cannot cancel a PAID milestone');
  return { ...milestone, status: 'CANCELLED' };
}

export function calculateScheduleTotal(milestones: readonly PaymentMilestone[]): Money {
  const active = milestones.filter(m => m.status !== 'CANCELLED');
  if (active.length === 0) return zeroMoney('VND');
  return active.reduce((sum, m) => addMoney(sum, m.dueAmount), zeroMoney(active[0]!.dueAmount.currency));
}

export function calculatePaidTotal(milestones: readonly PaymentMilestone[]): Money {
  const paid = milestones.filter(m => m.status === 'PAID' && m.actualAmount);
  if (paid.length === 0) return zeroMoney('VND');
  return paid.reduce((sum, m) => addMoney(sum, m.actualAmount!), zeroMoney(paid[0]!.actualAmount!.currency));
}
