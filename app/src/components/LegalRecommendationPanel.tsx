/**
 * Phase 10.2 — LegalRecommendationPanel
 *
 * Renders a RecommendationResult (Legal v9.9) alongside the associated
 * AuditRecord (Legal v10.0) as a structured, read-only panel.
 *
 * Composes three Phase 10.0 badge atoms:
 *   LegalStatusBadge  — result.primaryCode → Vietnamese label
 *   LegalActionBadge  — result.hasActions   → action indicator
 *   LegalCountBadge   — result.totalCount   → document count
 *
 * This component is intentionally named LegalRecommendationPanel (not
 * RecommendationPanel) to avoid collision with the existing Legal v2.6
 * RecommendationPanel, which renders AgentMessage-based strings grouped by
 * severity level. The two serve different data models and must coexist.
 *
 * Data-* contract (stable for testing):
 *   data-panel="legal-recommendation-panel"   — root container
 *   data-primary-code={result.primaryCode}    — quick lookup on root
 *   data-has-actions="true"/"false"           — quick lookup on root
 *   data-field="header"                       — badge group wrapper
 *   data-field="target-date"                  — result.targetDate
 *   data-list="recommendations"               — ordered recommendation list
 *   data-item="recommendation"                — each Recommendation entry
 *   data-code={rec.code}                      — per-item code
 *   data-priority={rec.priority}              — per-item priority (1-based)
 *   data-field="message"                      — rec.message text
 *   data-field="labels"                       — rec.labels as comma list (omitted when empty)
 *   data-field="audit-sequence"               — record.sequence (0-based)
 *
 * Recommendation items render in source order (priority-ascending as guaranteed
 * by RecommendationEngine). No sorting performed here.
 *
 * Returns null when result.recommendations is empty (defensive; the pipeline
 * always produces at least one recommendation, including NO_ACTION).
 *
 * panelFromResult() is exported as a pure mapping helper for direct use in
 * tests without constructing JSX.
 *
 * Never throws. No browser globals. No LLM calls. No IndexedDB.
 * Pure functional. No hooks. No state. No side effects. SSR-compatible.
 */

import type { RecommendationResult } from '../agents/RecommendationEngine';
import type { AuditRecord }          from '../agents/AuditTrail';
import {
  LegalStatusBadge,
  LegalActionBadge,
  LegalCountBadge,
} from './LegalBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalRecommendationPanelProps {
  result:     RecommendationResult;
  record:     AuditRecord;
  className?: string;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function panelFromResult(
  result: RecommendationResult,
  record: AuditRecord,
): LegalRecommendationPanelProps {
  return { result, record };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegalRecommendationPanel({
  result,
  record,
  className,
}: LegalRecommendationPanelProps) {
  if (result.recommendations.length === 0) return null;

  return (
    <div
      data-panel="legal-recommendation-panel"
      data-primary-code={result.primaryCode}
      data-has-actions={String(result.hasActions)}
      className={className}
    >
      <div data-field="header">
        <LegalStatusBadge code={result.primaryCode} />
        <LegalActionBadge hasActions={result.hasActions} />
        <LegalCountBadge count={result.totalCount} />
      </div>

      <div data-field="target-date">{result.targetDate}</div>

      <ol data-list="recommendations">
        {result.recommendations.map(rec => (
          <li
            key={rec.priority}
            data-item="recommendation"
            data-code={rec.code}
            data-priority={rec.priority}
          >
            <span data-field="message">{rec.message}</span>
            {rec.labels.length > 0 && (
              <span data-field="labels">{rec.labels.join(', ')}</span>
            )}
          </li>
        ))}
      </ol>

      <div data-field="audit-sequence">{record.sequence}</div>
    </div>
  );
}
