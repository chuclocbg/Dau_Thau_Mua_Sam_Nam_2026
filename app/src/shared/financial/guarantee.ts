import type { Money } from './money';
import { FinancialError, multiplyMoney, compareMoney } from './money';

export type GuaranteeType   = 'ADVANCE' | 'PERFORMANCE' | 'WARRANTY';
export type GuaranteeStatus = 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'FORFEITED';

export const GUARANTEE_TYPES:   readonly GuaranteeType[]   = ['ADVANCE', 'PERFORMANCE', 'WARRANTY'];
export const GUARANTEE_STATUSES: readonly GuaranteeStatus[] = ['ACTIVE', 'EXPIRED', 'RELEASED', 'FORFEITED'];

// Rate bounds per Vietnamese procurement law (TT 79/2025, NĐ 214/2025)
export const GUARANTEE_RATE_BOUNDS: Readonly<Record<GuaranteeType, { min: number; max: number }>> = {
  ADVANCE:     { min: 0.01, max: 0.30 }, // advance guarantee ≤ 30% of advance amount
  PERFORMANCE: { min: 0.03, max: 0.10 }, // performance guarantee 3–10% of contract value
  WARRANTY:    { min: 0.02, max: 0.05 }, // warranty guarantee 2–5% of contract value
};

export interface BaseGuarantee {
  readonly id:              string;
  readonly type:            GuaranteeType;
  readonly guaranteeNumber: string;
  readonly issuingBank:     string;
  readonly beneficiary:     string; // usually the procuring entity name
  readonly contractValue:   Money;
  readonly guaranteeRate:   number; // fraction of contractValue (e.g. 0.05 = 5%)
  readonly guaranteeValue:  Money;  // contractValue × guaranteeRate
  readonly issuedDate:      string; // YYYY-MM-DD
  readonly expiryDate:      string; // YYYY-MM-DD
  readonly status:          GuaranteeStatus;
  readonly notes?:          string;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export interface AdvanceGuarantee     extends BaseGuarantee { readonly type: 'ADVANCE' }
export interface PerformanceGuarantee extends BaseGuarantee { readonly type: 'PERFORMANCE' }
export interface WarrantyGuarantee    extends BaseGuarantee { readonly type: 'WARRANTY' }

export type AnyGuarantee = AdvanceGuarantee | PerformanceGuarantee | WarrantyGuarantee;

export function validateGuaranteeRate(type: GuaranteeType, rate: number): void {
  const { min, max } = GUARANTEE_RATE_BOUNDS[type];
  if (rate < min || rate > max)
    throw new FinancialError('INVALID_GUARANTEE', 'guaranteeRate',
      `${type} guarantee rate ${rate} outside bounds [${min}, ${max}]`);
}

export function createGuarantee<T extends GuaranteeType>(params: {
  id:              string;
  type:            T;
  guaranteeNumber: string;
  issuingBank:     string;
  beneficiary:     string;
  contractValue:   Money;
  guaranteeRate:   number;
  issuedDate:      string;
  expiryDate:      string;
  notes?:          string;
}): BaseGuarantee & { readonly type: T } {
  validateGuaranteeRate(params.type, params.guaranteeRate);
  if (!params.guaranteeNumber.trim())
    throw new FinancialError('INVALID_GUARANTEE', 'guaranteeNumber', 'guaranteeNumber is required');
  if (!params.issuingBank.trim())
    throw new FinancialError('INVALID_GUARANTEE', 'issuingBank', 'issuingBank is required');
  if (params.expiryDate <= params.issuedDate)
    throw new FinancialError('INVALID_GUARANTEE', 'expiryDate', 'expiryDate must be after issuedDate');

  const now = new Date().toISOString();
  return {
    ...params,
    guaranteeValue: multiplyMoney(params.contractValue, params.guaranteeRate),
    status:    'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

export function releaseGuarantee(guarantee: BaseGuarantee): BaseGuarantee {
  if (guarantee.status !== 'ACTIVE')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot release guarantee with status: ${guarantee.status}`);
  return { ...guarantee, status: 'RELEASED', updatedAt: new Date().toISOString() };
}

export function forfeitGuarantee(guarantee: BaseGuarantee): BaseGuarantee {
  if (guarantee.status !== 'ACTIVE')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot forfeit guarantee with status: ${guarantee.status}`);
  return { ...guarantee, status: 'FORFEITED', updatedAt: new Date().toISOString() };
}

export function expireGuarantee(guarantee: BaseGuarantee): BaseGuarantee {
  if (guarantee.status !== 'ACTIVE')
    throw new FinancialError('INVALID_STATUS', 'status',
      `Cannot expire guarantee with status: ${guarantee.status}`);
  return { ...guarantee, status: 'EXPIRED', updatedAt: new Date().toISOString() };
}

export function isGuaranteeExpired(guarantee: BaseGuarantee, asOfDate: string): boolean {
  return guarantee.expiryDate < asOfDate;
}

export function daysUntilExpiry(guarantee: BaseGuarantee, asOfDate: string): number {
  const expiry = new Date(guarantee.expiryDate).getTime();
  const asOf   = new Date(asOfDate).getTime();
  return Math.floor((expiry - asOf) / (1000 * 60 * 60 * 24));
}
