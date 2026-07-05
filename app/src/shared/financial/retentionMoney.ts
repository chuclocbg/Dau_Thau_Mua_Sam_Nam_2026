import type { Money } from './money';
import { FinancialError, multiplyMoney, subtractMoney, addMoney, compareMoney } from './money';
import type { LegalBasis } from './financialFactory';

export type RetentionStatus = 'HELD' | 'PARTIALLY_RELEASED' | 'FULLY_RELEASED';

export interface RetentionPercentage {
  readonly rate:        number; // 0.0 – 1.0 (e.g., 0.05 = 5%)
  readonly maxDuration: number; // months the retention can be held
  readonly legalBasis:  LegalBasis;
}

export interface RetentionMoney {
  readonly id:              string;
  readonly contractId:      string;
  readonly contractValue:   Money;
  readonly retentionRate:   number;
  readonly retentionAmount: Money;  // calculated: contractValue × retentionRate
  readonly releasedAmount:  Money;  // cumulative amount released so far
  readonly heldAmount:      Money;  // retentionAmount - releasedAmount
  readonly status:          RetentionStatus;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

// Max retention rate per Vietnamese procurement regulations (5% is common; 10% is absolute max)
export const MAX_RETENTION_RATE = 0.10;
export const DEFAULT_RETENTION_RATE: RetentionPercentage = {
  rate:        0.05,
  maxDuration: 12, // 12 months warranty period
  legalBasis:  {
    document: 'NĐ 214/2025/NĐ-CP',
    article:  'Điều 18',
    summary:  'Khấu trừ bảo hành công trình',
  },
};

export function validateRetentionRate(rate: number): void {
  if (rate < 0 || rate > MAX_RETENTION_RATE)
    throw new FinancialError('INVALID_RETENTION', 'rate',
      `Retention rate ${rate} out of range [0, ${MAX_RETENTION_RATE}]`);
}

export function calculateRetentionAmount(contractValue: Money, rate: number): Money {
  validateRetentionRate(rate);
  return multiplyMoney(contractValue, rate);
}

export function createRetentionMoney(params: {
  id: string;
  contractId: string;
  contractValue: Money;
  retentionRate: number;
}): RetentionMoney {
  validateRetentionRate(params.retentionRate);
  const retentionAmount = calculateRetentionAmount(params.contractValue, params.retentionRate);
  const now = new Date().toISOString();
  return {
    id:              params.id,
    contractId:      params.contractId,
    contractValue:   params.contractValue,
    retentionRate:   params.retentionRate,
    retentionAmount,
    releasedAmount:  { amount: 0n, currency: retentionAmount.currency },
    heldAmount:      retentionAmount,
    status:          'HELD',
    createdAt:       now,
    updatedAt:       now,
  };
}

export function releaseRetention(retention: RetentionMoney, releaseAmount: Money): RetentionMoney {
  if (retention.status === 'FULLY_RELEASED')
    throw new FinancialError('INVALID_STATUS', 'status', 'Retention is already fully released');
  if (compareMoney(releaseAmount, retention.heldAmount) > 0)
    throw new FinancialError('INSUFFICIENT_BUDGET', 'releaseAmount',
      `Release amount ${releaseAmount.amount} exceeds held amount ${retention.heldAmount.amount}`);

  const newReleased = addMoney(retention.releasedAmount, releaseAmount);
  const newHeld     = subtractMoney(retention.retentionAmount, newReleased);
  const status: RetentionStatus = newHeld.amount === 0n
    ? 'FULLY_RELEASED'
    : 'PARTIALLY_RELEASED';

  return {
    ...retention,
    releasedAmount: newReleased,
    heldAmount:     newHeld,
    status,
    updatedAt:      new Date().toISOString(),
  };
}
