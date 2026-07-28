/**
 * Phase 10.0 — LegalBadges
 *
 * Atomic presentation primitives for the LegalFacade output layer.
 * All three components are pure functional, no hooks, no state, SSR-safe.
 *
 * LegalStatusBadge
 *   Renders a RecommendationCode as a localised Vietnamese label.
 *   data-badge="legal-status"  data-code={code}
 *   Codes → labels:
 *     NO_ACTION         → "Không cần thao tác"
 *     NAMED_FOCUS       → "Tài liệu được chọn"
 *     PREPARE_ALL       → "Chuẩn bị tài liệu"
 *     FOCUS_REQUIRED    → "Ưu tiên bắt buộc"
 *     CONSIDER_OPTIONAL → "Xem xét thêm"
 *
 * LegalActionBadge
 *   Renders a hasActions boolean as a Vietnamese action indicator.
 *   data-badge="legal-action"  data-active="true"/"false"
 *   true  → "Cần thực hiện"
 *   false → "Không có hành động"
 *
 * LegalCountBadge
 *   Renders a numeric count with a localised label suffix.
 *   data-badge="legal-count"
 *   Default label: "tài liệu"
 *   Zero count renders normally — callers decide visibility.
 *
 * labelForCode() is exported as a pure mapping helper for tests that need
 * the label string without rendering.
 *
 * Never throws. All prop types are required except optional className/label.
 * No browser globals. No LLM calls. No IndexedDB. SSR-compatible.
 */

import type { RecommendationCode } from '../agents/RecommendationEngine';

// ─── LegalStatusBadge ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RecommendationCode, string> = {
  NO_ACTION:         'Không cần thao tác',
  NAMED_FOCUS:       'Tài liệu được chọn',
  PREPARE_ALL:       'Chuẩn bị tài liệu',
  FOCUS_REQUIRED:    'Ưu tiên bắt buộc',
  CONSIDER_OPTIONAL: 'Xem xét thêm',
};

export function labelForCode(code: RecommendationCode): string {
  return STATUS_LABELS[code];
}

export interface LegalStatusBadgeProps {
  code:       RecommendationCode;
  className?: string;
}

export function LegalStatusBadge({ code, className }: LegalStatusBadgeProps) {
  return (
    <span data-badge="legal-status" data-code={code} className={className}>
      {STATUS_LABELS[code]}
    </span>
  );
}

// ─── LegalActionBadge ─────────────────────────────────────────────────────────

export interface LegalActionBadgeProps {
  hasActions: boolean;
  className?: string;
}

export function LegalActionBadge({ hasActions, className }: LegalActionBadgeProps) {
  return (
    <span
      data-badge="legal-action"
      data-active={String(hasActions)}
      className={className}
    >
      {hasActions ? 'Cần thực hiện' : 'Không có hành động'}
    </span>
  );
}

// ─── LegalCountBadge ──────────────────────────────────────────────────────────

export interface LegalCountBadgeProps {
  count:      number;
  label?:     string;
  className?: string;
}

export function LegalCountBadge({ count, label = 'tài liệu', className }: LegalCountBadgeProps) {
  return (
    <span data-badge="legal-count" className={className}>
      {count} {label}
    </span>
  );
}
