import type { Money } from './money';
import { FinancialError } from './money';

// Mirror of masterdata FundSource.type — financial domain uses this for type-safety.
// Do not import FundSource from masterdata in this file; use code strings at call sites.
export type FundingSourceType = 'STATE' | 'ODA' | 'PPP' | 'ENTERPRISE';

export const FUNDING_SOURCE_TYPES: readonly FundingSourceType[] = ['STATE', 'ODA', 'PPP', 'ENTERPRISE'];

// Financial-domain FundingSource — wraps the masterdata reference with budget data.
export interface FundingSource {
  readonly id:             string;
  readonly code:           string; // references masterdata FundSource.code
  readonly name:           string;
  readonly type:           FundingSourceType;
  readonly fiscalYear:     number;
  readonly totalBudget:    Money;
  readonly isActive:       boolean;
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

export type CommitmentStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED';
export type ReservationStatus = 'RESERVED' | 'CONSUMED' | 'CANCELLED';

export interface FundingCommitment {
  readonly id:           string;
  readonly allocationId: string;
  readonly packageId?:   string;  // optional link to procurement package
  readonly amount:       Money;
  readonly committedAt:  string;
  readonly committedBy:  string;
  readonly status:       CommitmentStatus;
  readonly notes?:       string;
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

export interface FundingReservation {
  readonly id:             string;
  readonly allocationId:   string;
  readonly reservedAmount: Money;
  readonly purpose:        string;
  readonly reservedAt:     string;
  readonly reservedBy:     string;
  readonly status:         ReservationStatus;
  readonly notes?:         string;
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

export function createFundingCommitment(params: {
  id: string;
  allocationId: string;
  packageId?: string;
  amount: Money;
  committedBy: string;
  notes?: string;
}): FundingCommitment {
  if (!params.allocationId.trim())
    throw new FinancialError('INVALID_AMOUNT', 'allocationId', 'allocationId is required');
  if (params.amount.amount <= 0n)
    throw new FinancialError('ZERO_AMOUNT', 'amount', 'Commitment amount must be positive');
  const now = new Date().toISOString();
  return {
    ...params,
    committedAt: now,
    status:      'ACTIVE',
    createdAt:   now,
    updatedAt:   now,
  };
}

export function releaseFundingCommitment(commitment: FundingCommitment): FundingCommitment {
  if (commitment.status !== 'ACTIVE')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot release commitment with status: ${commitment.status}`);
  return { ...commitment, status: 'RELEASED', updatedAt: new Date().toISOString() };
}

export function createFundingReservation(params: {
  id: string;
  allocationId: string;
  reservedAmount: Money;
  purpose: string;
  reservedBy: string;
  notes?: string;
}): FundingReservation {
  if (!params.purpose.trim())
    throw new FinancialError('INVALID_AMOUNT', 'purpose', 'purpose is required');
  if (params.reservedAmount.amount <= 0n)
    throw new FinancialError('ZERO_AMOUNT', 'reservedAmount', 'Reservation amount must be positive');
  const now = new Date().toISOString();
  return {
    ...params,
    reservedAt: now,
    status:     'RESERVED',
    createdAt:  now,
    updatedAt:  now,
  };
}

export function consumeFundingReservation(reservation: FundingReservation): FundingReservation {
  if (reservation.status !== 'RESERVED')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot consume reservation with status: ${reservation.status}`);
  return { ...reservation, status: 'CONSUMED', updatedAt: new Date().toISOString() };
}

export function cancelFundingReservation(reservation: FundingReservation): FundingReservation {
  if (reservation.status === 'CONSUMED')
    throw new FinancialError('INVALID_STATUS', 'status', 'Cannot cancel a CONSUMED reservation');
  return { ...reservation, status: 'CANCELLED', updatedAt: new Date().toISOString() };
}
