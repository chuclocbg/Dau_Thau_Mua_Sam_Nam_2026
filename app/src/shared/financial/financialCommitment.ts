// Financial commitment aggregate — encapsulates all commitments and reservations
// for a single procurement package against one or more budget allocations.

import type { Money } from './money';
import { FinancialError, addMoney, zeroMoney, compareMoney } from './money';
import type { FundingCommitment, FundingReservation } from './fundingSource';
import type { LegalBasis } from './financialFactory';

export type CommitmentAggregateStatus =
  | 'DRAFT'
  | 'COMMITTED'
  | 'PARTIALLY_RELEASED'
  | 'FULLY_RELEASED'
  | 'EXPIRED';

export interface FinancialCommitmentAggregate {
  readonly id:             string;
  readonly packageId:      string;
  readonly totalCommitted: Money;
  readonly totalReserved:  Money;
  readonly totalReleased:  Money;
  readonly commitments:    readonly FundingCommitment[];
  readonly reservations:   readonly FundingReservation[];
  readonly status:         CommitmentAggregateStatus;
  readonly legalBasis:     readonly LegalBasis[];
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

export interface FinancialLimit {
  readonly maxAmount:  Money;
  readonly scope:      string; // "UNIT_HEAD" | "DEPARTMENT" | "MINISTRY" | description
  readonly legalBasis: LegalBasis;
}

export function buildCommitmentAggregate(params: {
  id:          string;
  packageId:   string;
  commitments: readonly FundingCommitment[];
  reservations: readonly FundingReservation[];
  legalBasis:  readonly LegalBasis[];
}): FinancialCommitmentAggregate {
  if (!params.packageId.trim())
    throw new FinancialError('NOT_FOUND', 'packageId', 'packageId is required');

  const currency = params.commitments[0]?.amount.currency
    ?? params.reservations[0]?.reservedAmount.currency
    ?? 'VND';

  const totalCommitted = params.commitments
    .filter(c => c.status === 'ACTIVE')
    .reduce((sum, c) => addMoney(sum, c.amount), zeroMoney(currency));

  const totalReserved = params.reservations
    .filter(r => r.status === 'RESERVED')
    .reduce((sum, r) => addMoney(sum, r.reservedAmount), zeroMoney(currency));

  const totalReleased = params.commitments
    .filter(c => c.status === 'RELEASED')
    .reduce((sum, c) => addMoney(sum, c.amount), zeroMoney(currency));

  const status: CommitmentAggregateStatus =
    params.commitments.length === 0 && params.reservations.length === 0
      ? 'DRAFT'
      : compareMoney(totalReleased, totalCommitted) === 0 && params.commitments.length > 0
        ? 'FULLY_RELEASED'
        : compareMoney(totalReleased, zeroMoney(currency)) > 0
          ? 'PARTIALLY_RELEASED'
          : 'COMMITTED';

  const now = new Date().toISOString();
  return {
    id:             params.id,
    packageId:      params.packageId,
    totalCommitted,
    totalReserved,
    totalReleased,
    commitments:    params.commitments,
    reservations:   params.reservations,
    status,
    legalBasis:     params.legalBasis,
    createdAt:      now,
    updatedAt:      now,
  };
}

export function checkFinancialLimit(amount: Money, limit: FinancialLimit): void {
  if (compareMoney(amount, limit.maxAmount) > 0)
    throw new FinancialError('INSUFFICIENT_BUDGET', 'amount',
      `Amount ${amount.amount} ${amount.currency} exceeds limit ${limit.maxAmount.amount} for scope: ${limit.scope}`);
}
