import type { CurrencyCode } from './money';
import { FinancialError } from './money';

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['VND', 'USD', 'EUR', 'JPY', 'AUD'];

export interface CurrencyMeta {
  readonly code:        CurrencyCode;
  readonly name:        string;
  readonly symbol:      string;
  readonly subUnitSize: number; // 1 for VND/JPY (no sub-units), 100 for USD/EUR/AUD
}

export const CURRENCY_META: Readonly<Record<CurrencyCode, CurrencyMeta>> = {
  VND: { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫',  subUnitSize: 1   },
  USD: { code: 'USD', name: 'US Dollar',        symbol: '$',  subUnitSize: 100 },
  EUR: { code: 'EUR', name: 'Euro',             symbol: '€',  subUnitSize: 100 },
  JPY: { code: 'JPY', name: 'Japanese Yen',     symbol: '¥',  subUnitSize: 1   },
  AUD: { code: 'AUD', name: 'Australian Dollar',symbol: 'A$', subUnitSize: 100 },
};

export function validateCurrency(code: string): code is CurrencyCode {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(code))
    throw new FinancialError('INVALID_CURRENCY', 'currency',
      `Unsupported currency: ${code}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`);
  return true;
}

export function isVND(code: CurrencyCode): boolean { return code === 'VND'; }
export function isUSD(code: CurrencyCode): boolean { return code === 'USD'; }

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  return CURRENCY_META[code];
}

// ExchangeRate — reserved for future multi-currency support.
// Not used in financial calculations yet; all procured values are in VND.
export interface ExchangeRate {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency:   CurrencyCode;
  readonly rate:         number;     // multiply fromCurrency amount by rate to get toCurrency
  readonly rateDate:     string;     // YYYY-MM-DD — must match transaction date
  readonly source:       string;     // "SBV" (State Bank of Vietnam), "ECB", etc.
}
