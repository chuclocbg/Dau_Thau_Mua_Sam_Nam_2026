/**
 * P6-01C: detectPackageSplitting — pure function, no side effects.
 *
 * Also exports parseGoalIntoItems and generateTraceId (goal-parsing utilities
 * needed by PlannerAgent).
 *
 * Legal basis: Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15.
 * No brand names, no fabricated citations, no real people per CLAUDE.md.
 */

import type { AISuggestion } from '../ai/packageGenerator';
import type { LegalFinding }  from '../ai/legalReviewer';

// ─── Goal parsing ─────────────────────────────────────────────────────────────

/** Non-capturing group so .split() does not include connector words in results. */
const CONNECTOR_PATTERN =
  /\s+(?:và|cùng với|cùng|cộng với|thêm|bao gồm)\s+/gi;
const COMMA_PATTERN = /\s*[,;]\s*/g;

/** Generates a UUID v4 or a safe fallback string for audit traceId. */
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `planner-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Splits a natural-language procurement goal into individual item fragments.
 *
 * "20 máy tính và văn phòng phẩm" → ["20 máy tính", "văn phòng phẩm"]
 * "máy tính, điều hòa, bàn ghế"  → ["máy tính", "điều hòa", "bàn ghế"]
 */
export function parseGoalIntoItems(goal: string): string[] {
  const trimmed = goal.trim();
  if (!trimmed) return [];

  const normalized = trimmed.replace(/\s+/g, ' ');

  // First split on connector words, then on commas/semicolons.
  const fragments: string[] = [];
  for (const part of normalized.split(CONNECTOR_PATTERN)) {
    for (const sub of part.split(COMMA_PATTERN)) {
      fragments.push(sub);
    }
  }

  return fragments.map(f => f.trim()).filter(f => f.length >= 3);
}

// ─── Split detection ──────────────────────────────────────────────────────────

const SPLIT_THRESHOLDS = [
  { value: 50_000_000,    label: '50 triệu (ngưỡng mua sắm trực tiếp)' },
  { value: 500_000_000,   label: '500 triệu (ngưỡng chỉ định thầu rút gọn)' },
  { value: 5_000_000_000, label: '5 tỷ (ngưỡng chào hàng cạnh tranh)' },
] as const;

/**
 * Detects potential package-splitting violations (Điều 44 khoản 6 Luật ĐT 22/2023).
 *
 * Groups packages by detectedCategory.  If all packages in a group are individually
 * below a procurement threshold but their combined total exceeds it, that is a
 * [CRITICAL] splitting finding (code PA-001).
 *
 * @param packages        New packages to evaluate.
 * @param existingPackages Already-planned packages to include in the group totals.
 */
export function detectPackageSplitting(
  packages: AISuggestion[],
  existingPackages: AISuggestion[] = [],
): LegalFinding[] {
  const all = [...existingPackages, ...packages];
  const groups = new Map<string, AISuggestion[]>();

  for (const pkg of all) {
    const key = pkg.detectedCategory || 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), pkg]);
  }

  const findings: LegalFinding[] = [];

  for (const [category, pkgs] of groups) {
    if (pkgs.length < 2) continue;

    const groupTotal = pkgs.reduce((s, p) => s + p.estimatedTotal, 0);
    const maxSingle  = Math.max(...pkgs.map(p => p.estimatedTotal));

    for (const threshold of SPLIT_THRESHOLDS) {
      if (maxSingle <= threshold.value && groupTotal > threshold.value) {
        findings.push({
          severity: 'CRITICAL',
          code: 'PA-001',
          category: 'package-splitting',
          field: category,
          message:
            `Phát hiện ${pkgs.length} gói "${category}": tổng ` +
            `${groupTotal.toLocaleString('vi-VN')} đồng vượt ngưỡng ${threshold.label} ` +
            `nhưng từng gói riêng lẻ đều ≤ ngưỡng. Đây là dấu hiệu chia nhỏ gói thầu.`,
          // LegalFinding.legalBasis is a single string (per legalReviewer.ts)
          legalBasis:
            'Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — nghiêm cấm chia nhỏ gói thầu ' +
            'nhằm lẩn tránh quy trình lựa chọn nhà thầu.',
          recommendation:
            `Hợp nhất tất cả ${pkgs.length} gói "${category}" thành 1 gói, ` +
            `áp dụng phương thức LCNT tương ứng với tổng giá trị.`,
        });
        break; // report only the lowest violated threshold per category
      }
    }
  }

  return findings;
}
