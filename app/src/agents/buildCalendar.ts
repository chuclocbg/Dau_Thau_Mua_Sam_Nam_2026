/**
 * P6-01C: buildCalendar — pure functions, no side effects.
 *
 * Builds an annual procurement calendar from a list of AISuggestion packages.
 * Also exports getProcurementLeadTime and assignQuarter for independent use.
 *
 * Invariants guaranteed by buildCalendar():
 *   calendar.entries.length === packages.length
 *   sum(Object.values(totalByQuarter)) === totalAnnual
 *
 * khlcntSubmissionDate defaults to January 15 of the budget year
 * per Điều 38 Luật Đấu thầu 22/2023/QH15.
 */

import type { AISuggestion } from '../ai/packageGenerator';

// ─── Calendar interfaces ──────────────────────────────────────────────────────

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface CalendarEntry {
  packageCode:      string;
  packageName:      string;
  quarter:          Quarter;
  /** Recommended start month within the quarter (1–12). */
  estimatedMonth:   number;
  leadTimeDays:     number;
  /** Vietnamese rationale for the quarter assignment. */
  rationale:        string;
  procurementMethod: string;
  estimatedTotal:   number;
}

export interface ProcurementCalendar {
  budgetYear:           number;
  entries:              CalendarEntry[];
  /** All four keys always present, even if value is 0. */
  totalByQuarter:       Record<Quarter, number>;
  totalAnnual:          number;
  /** ISO 8601 date — recommended KHLCNT submission deadline. */
  khlcntSubmissionDate: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAD_TIME_DAYS: Record<string, number> = {
  DIRECT_50:                   14,
  DIRECT_SELECTION_SIMPLIFIED: 28,
  COMPETITIVE_SHOPPING:        45,
  OPEN_BIDDING:                90,
};

const QUARTER_MONTH_MAP: Record<Quarter, number> = {
  Q1: 2,
  Q2: 4,
  Q3: 7,
  Q4: 10,
};

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Returns the procurement lead time in days from a method-hint string.
 * Uses substring matching so hints like "OPEN_BIDDING — Đấu thầu rộng rãi" work.
 * Defaults to 30 days when no key matches.
 */
export function getProcurementLeadTime(methodHint: string): number {
  for (const [key, days] of Object.entries(LEAD_TIME_DAYS)) {
    if (methodHint.includes(key)) return days;
  }
  return 30;
}

/**
 * Assigns a fiscal quarter to a package based on type and estimated value.
 *
 * Rules:
 *   goods_consumable | service              → Q1  (need immediately, short lead)
 *   goods_fixed_asset with total > 500 M   → Q3  (long KHLCNT + delivery time)
 *   everything else                         → Q2
 */
export function assignQuarter(pkg: AISuggestion): Quarter {
  if (pkg.packageType === 'goods_consumable' || pkg.packageType === 'service') {
    return 'Q1';
  }
  if (pkg.packageType === 'goods_fixed_asset' && pkg.estimatedTotal > 500_000_000) {
    return 'Q3';
  }
  return 'Q2';
}

function buildRationale(pkg: AISuggestion, quarter: Quarter): string {
  if (pkg.packageType === 'goods_consumable') {
    return 'Vật tư tiêu hao cần ngay đầu năm học';
  }
  if (pkg.packageType === 'service') {
    return 'Dịch vụ triển khai đầu năm';
  }
  if (quarter === 'Q3') {
    return 'Tài sản lớn cần chuẩn bị KHLCNT và thời gian giao hàng dài';
  }
  return 'Tài sản cố định phân vào Q2 để chuẩn bị KHLCNT';
}

/**
 * Builds an annual procurement calendar from a list of packages.
 *
 * Entries are sorted by estimatedMonth ascending.
 * totalByQuarter is always initialised with all four Q1-Q4 keys.
 */
export function buildCalendar(
  packages: AISuggestion[],
  budgetYear: number,
): ProcurementCalendar {
  const totalByQuarter: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

  const entries: CalendarEntry[] = packages.map(pkg => {
    const quarter        = assignQuarter(pkg);
    const estimatedMonth = QUARTER_MONTH_MAP[quarter];
    const leadTimeDays   = getProcurementLeadTime(pkg.procurementMethodHint);
    totalByQuarter[quarter] += pkg.estimatedTotal;

    return {
      packageCode:      pkg.packageCode,
      packageName:      pkg.packageName,
      quarter,
      estimatedMonth,
      leadTimeDays,
      rationale:        buildRationale(pkg, quarter),
      procurementMethod: pkg.procurementMethodHint,
      estimatedTotal:   pkg.estimatedTotal,
    };
  });

  entries.sort((a, b) => a.estimatedMonth - b.estimatedMonth);

  const totalAnnual = packages.reduce((s, p) => s + p.estimatedTotal, 0);

  return {
    budgetYear,
    entries,
    totalByQuarter,
    totalAnnual,
    // Per Điều 38 Luật ĐT 22/2023: KHLCNT must be approved before the first package starts.
    khlcntSubmissionDate: `${budgetYear}-01-15`,
  };
}
