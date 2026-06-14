/**
 * P6-01C: validateAuthority — pure function, no side effects.
 *
 * Determines the approval authority level for a procurement package
 * per Thông tư 13/2026/TT-BCT and Nghị định 214/2025/NĐ-CP.
 *
 * Thresholds:
 *   ≤  50 000 000 VND → Hiệu trưởng (direct, no KHLCNT)
 *   ≤ 500 000 000 VND → Hiệu trưởng + KHLCNT internal
 *   > 500 000 000 VND → Ministry of Industry and Trade approval
 */

import type { AISuggestion } from '../ai/packageGenerator';

// ─── AuthorityCheck interface ─────────────────────────────────────────────────

/** Per-package authority approval requirements. */
export interface AuthorityCheck {
  packageCode: string;
  packageName: string;
  estimatedTotal: number;
  approvalLevel: 'rector_direct' | 'rector_with_khlcnt' | 'ministry';
  /** Human-readable Vietnamese description of who must approve. */
  approvalAuthority: string;
  khlcntRequired: boolean;
  ministerialApproval: boolean;
  /** Legal citations for this authority level (string[], not string). */
  legalBasis: string[];
}

// ─── Legal basis constants ────────────────────────────────────────────────────

const AUTHORITY_BASIS_DIRECT: readonly string[] = [
  'Điểm m Khoản 1 Điều 23 Luật Đấu thầu 22/2023/QH15',
  'Khoản 4 Điều 80 Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4',
];

const AUTHORITY_BASIS_KHLCNT: readonly string[] = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập KHLCNT',
  'Khoản 2 và 3 Điều 80 Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4',
];

const AUTHORITY_BASIS_MINISTRY: readonly string[] = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — KHLCNT',
  'Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4 — thẩm quyền Bộ Công Thương',
];

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Returns the AuthorityCheck for a single procurement package.
 *
 * Boundary behaviour (per implementation plan §C-05):
 *   total === 50 000 000  → rector_direct   (≤ boundary)
 *   total === 500 000 000 → rector_with_khlcnt (≤ boundary)
 *   total === 500 000 001 → ministry
 */
export function validateAuthority(pkg: AISuggestion): AuthorityCheck {
  const total = pkg.estimatedTotal;

  if (total <= 50_000_000) {
    return {
      packageCode:       pkg.packageCode,
      packageName:       pkg.packageName,
      estimatedTotal:    total,
      approvalLevel:     'rector_direct',
      approvalAuthority: 'Hiệu trưởng (quyết định trực tiếp, không qua quy trình thầu)',
      khlcntRequired:    false,
      ministerialApproval: false,
      legalBasis:        [...AUTHORITY_BASIS_DIRECT],
    };
  }

  if (total <= 500_000_000) {
    return {
      packageCode:       pkg.packageCode,
      packageName:       pkg.packageName,
      estimatedTotal:    total,
      approvalLevel:     'rector_with_khlcnt',
      approvalAuthority: 'Hiệu trưởng (cần lập và phê duyệt KHLCNT nội bộ trước khi triển khai)',
      khlcntRequired:    true,
      ministerialApproval: false,
      legalBasis:        [...AUTHORITY_BASIS_KHLCNT],
    };
  }

  return {
    packageCode:       pkg.packageCode,
    packageName:       pkg.packageName,
    estimatedTotal:    total,
    approvalLevel:     'ministry',
    approvalAuthority: 'Hiệu trưởng trình Bộ Công Thương phê duyệt KHLCNT trước khi tổ chức LCNT',
    khlcntRequired:    true,
    ministerialApproval: true,
    legalBasis:        [...AUTHORITY_BASIS_MINISTRY],
  };
}
