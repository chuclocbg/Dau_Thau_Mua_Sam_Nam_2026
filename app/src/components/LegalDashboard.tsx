/**
 * Legal v3.0 — LegalDashboard
 *
 * Unified read-only dashboard that composes all 7 legal UI panels in fixed
 * order. Pure orchestration — no business logic of its own.
 *
 * Render order (matches AgentMessage pipeline enrichment flow):
 *   1. LegalSummaryPanel     — aggregate metadata overview
 *   2. CitationCardPanel     — grouped article citations
 *   3. TracePanel            — 7-stage legal pipeline visualization
 *   4. ChecklistPanel        — document completeness
 *   5. RiskPanel             — risk level, score, warnings
 *   6. RecommendationPanel   — severity-grouped action items
 *   7. TimelinePanel         — 8-stage procurement lifecycle
 *
 * Each child panel handles its own empty-state (returns null when its data is
 * absent). LegalDashboard only adds the outer data-panel="legal-dashboard"
 * wrapper and performs a top-level hasAny guard so the wrapper itself is also
 * suppressed when every prop is absent or empty.
 *
 * Returns null when all metadata are absent.
 * Never throws. All arrays default to [].
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. SSR-compatible.
 */

import React from 'react';
import LegalSummaryPanel, { type LegalSummaryPanelProps } from './LegalSummaryPanel';
import CitationCardPanel from './CitationCardPanel';
import TracePanel, { type TracePanelProps } from './TracePanel';
import ChecklistPanel, { type ChecklistPanelProps } from './ChecklistPanel';
import RiskPanel, { type RiskPanelProps } from './RiskPanel';
import RecommendationPanel, { type RecommendationPanelProps } from './RecommendationPanel';
import TimelinePanel, { type TimelinePanelProps } from './TimelinePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalDashboardProps {
  /** Legal v2.1: aggregate metadata for LegalSummaryPanel. */
  summary?:         LegalSummaryPanelProps | null;
  /** Legal v2.2: AgentMessage.legalBasis — threaded to CitationCardPanel. */
  citations?:       string[] | null;
  /** Legal v2.3: pipeline trace metadata — threaded to TracePanel. */
  trace?:           TracePanelProps | null;
  /** Legal v2.4: document completeness — threaded to ChecklistPanel. */
  checklist?:       ChecklistPanelProps | null;
  /** Legal v2.5: risk metadata — threaded to RiskPanel. */
  risk?:            RiskPanelProps | null;
  /** Legal v2.6: severity-grouped recommendations — threaded to RecommendationPanel. */
  recommendations?: RecommendationPanelProps | null;
  /** Legal v2.7: procurement lifecycle — threaded to TimelinePanel. */
  timeline?:        TimelinePanelProps | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegalDashboard({
  summary,
  citations,
  trace,
  checklist,
  risk,
  recommendations,
  timeline,
}: LegalDashboardProps) {
  const hasAny =
    summary != null ||
    (citations != null && citations.length > 0) ||
    trace != null ||
    checklist != null ||
    risk != null ||
    (recommendations?.recommendations?.length ?? 0) > 0 ||
    timeline != null;

  if (!hasAny) return null;

  return (
    <div data-panel="legal-dashboard">
      {/* 1. Summary */}
      {summary != null && <LegalSummaryPanel {...summary} />}
      {/* 2. Citations — self-collapses when citations is null/empty */}
      <CitationCardPanel legalBasis={citations ?? []} />
      {/* 3. Trace */}
      {trace != null && <TracePanel {...trace} />}
      {/* 4. Checklist */}
      {checklist != null && <ChecklistPanel {...checklist} />}
      {/* 5. Risk */}
      {risk != null && <RiskPanel {...risk} />}
      {/* 6. Recommendations */}
      {recommendations != null && <RecommendationPanel {...recommendations} />}
      {/* 7. Timeline */}
      {timeline != null && <TimelinePanel {...timeline} />}
    </div>
  );
}
