/**
 * Legal v2.5 — RiskPanel
 *
 * Read-only visualization of procurement risk derived from AgentMessage
 * pipeline enrichment fields: riskLevel, riskScore, warnings, recommendations.
 *
 * Four collapsible sections:
 *   1. Mức độ rủi ro   — risk level badge (colored)
 *   2. Điểm rủi ro     — numeric score 0–100
 *   3. Khuyến nghị     — recommendation bullet list
 *   4. Cảnh báo        — warnings with severity level on separate line
 *
 * Each section collapses when its data is empty/absent.
 * Returns null when no risk metadata exists.
 * Never throws. All arrays default to [].
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskPanelProps {
  /** 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' from AgentMessage.riskLevel. */
  riskLevel?:       string;
  /** 0–100 from AgentMessage.riskScore. */
  riskScore?:       number;
  /** Warning strings with [LEVEL] prefix from AgentMessage.warnings. */
  warnings?:        string[];
  /** Recommendation strings from AgentMessage.recommendations. */
  recommendations?: string[];
}

// ─── Internal constants ───────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: 'red',
  HIGH:     'orange',
  MEDIUM:   'yellow',
  LOW:      'green',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts CRITICAL | HIGH | MEDIUM | LOW from "[LEVEL] text…", or '' if absent. */
function severityOf(warning: string): string {
  const m = warning.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]/);
  return m ? m[1] : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RiskPanel({
  riskLevel,
  riskScore,
  warnings        = [],
  recommendations = [],
}: RiskPanelProps) {
  const hasAny =
    riskLevel       != null ||
    riskScore       != null ||
    recommendations.length > 0 ||
    warnings.length        > 0;

  if (!hasAny) return null;

  const level = (riskLevel ?? '').toUpperCase();
  const color = LEVEL_COLOR[level] ?? 'inherit';

  return (
    <div data-panel="risk">

      {/* ── Section 1: Risk level badge ──────────────────────────────────── */}
      {riskLevel != null && (
        <section data-section="risk-level">
          <h3 data-field="section-title">Mức độ rủi ro</h3>
          <span
            data-field="risk-level"
            data-risk-level={level}
            data-risk-color={color}
            style={{ color, fontWeight: 'bold' }}
          >
            {level}
          </span>
        </section>
      )}

      {/* ── Section 2: Risk score ─────────────────────────────────────────── */}
      {riskScore != null && (
        <section data-section="risk-score">
          <h3 data-field="section-title">Điểm rủi ro</h3>
          <span data-field="risk-score" data-score={riskScore}>
            {riskScore}
          </span>
        </section>
      )}

      {/* ── Section 3: Recommendations ───────────────────────────────────── */}
      {recommendations.length > 0 && (
        <section data-section="recommendations">
          <h3 data-field="section-title">Khuyến nghị</h3>
          <ul data-field="recommendations-list">
            {recommendations.map((r, i) => (
              <li key={i} data-field="recommendation">{r}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 4: Warnings ──────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <section data-section="warnings">
          <h3 data-field="section-title">Cảnh báo</h3>
          <ul data-field="warnings-list">
            {warnings.map((w, i) => {
              const sev  = severityOf(w);
              const clr  = LEVEL_COLOR[sev] ?? 'inherit';
              const body = sev ? w.slice(`[${sev}] `.length) : w;
              return (
                <li key={i} data-field="warning" data-warning-severity={sev}>
                  <span
                    data-field="warning-level"
                    data-risk-level={sev}
                    data-risk-color={clr}
                    style={{ color: clr, fontWeight: 'bold' }}
                  >
                    {sev}
                  </span>
                  <span data-field="warning-body">{body}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
