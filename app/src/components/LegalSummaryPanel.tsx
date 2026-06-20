/**
 * Legal v2.1 — LegalSummaryPanel
 *
 * Read-only panel exposing legal pipeline metadata from AgentMessage
 * (injected by legalPipelineEnricher in Legal v2.0).
 *
 * Sections rendered (each collapses automatically when its array is empty):
 *   1. Văn bản pháp lý áp dụng  — applicableDocuments
 *   2. Tài liệu còn thiếu        — missingDocuments
 *   3. Cảnh báo                   — warnings (colored severity tags)
 *   4. Tiến độ hoàn thành         — completionScore + progress bar
 *   5. Mức độ rủi ro              — riskLevel badge (colored) + riskScore
 *   6. Khuyến nghị                — recommendations bullet list
 *
 * Returns null when no metadata is present — callers need not guard.
 *
 * No hooks. No browser globals. SSR-compatible. No edit controls.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalSummaryPanelProps {
  /** ApplicableDocument[] — serialized as unknown[] in AgentMessage.applicableDocuments */
  applicableDocuments?: unknown[];
  /** RequiredDocument[] — serialized as unknown[] in AgentMessage.missingDocuments */
  missingDocuments?:    unknown[];
  warnings?:            string[];
  completionScore?:     number;   // 0–100
  riskLevel?:           string;   // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  riskScore?:           number;
  recommendations?:     string[];
}

// ─── Internal colour map ──────────────────────────────────────────────────────

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: 'red',
  HIGH:     'orange',
  MEDIUM:   'yellow',
  LOW:      'green',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extracts CRITICAL | HIGH | MEDIUM | LOW from "[LEVEL] text…", or '' if absent. */
function severityOf(warning: string): string {
  const m = warning.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]/);
  return m ? m[1] : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegalSummaryPanel({
  applicableDocuments = [],
  missingDocuments    = [],
  warnings            = [],
  completionScore,
  riskLevel,
  riskScore,
  recommendations     = [],
}: LegalSummaryPanelProps) {
  // Return nothing when no metadata has been provided at all.
  const hasAny =
    applicableDocuments.length > 0 ||
    missingDocuments.length    > 0 ||
    warnings.length            > 0 ||
    completionScore != null        ||
    riskLevel       != null        ||
    riskScore       != null        ||
    recommendations.length     > 0;

  if (!hasAny) return null;

  const score  = completionScore ?? 0;
  const level  = (riskLevel ?? '').toUpperCase();
  const color  = LEVEL_COLOR[level] ?? 'inherit';

  return (
    <div data-panel="legal-summary">

      {/* ── Section 1: Applicable documents ──────────────────────────────── */}
      {applicableDocuments.length > 0 && (
        <section data-section="applicable-documents">
          <h3 data-field="section-title">Văn bản pháp lý áp dụng</h3>
          <ul data-field="applicable-documents-list">
            {(applicableDocuments as Array<{ title?: string }>).map((doc, i) => (
              <li key={i} data-field="applicable-doc">
                {doc.title ?? ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 2: Missing documents ─────────────────────────────────── */}
      {missingDocuments.length > 0 && (
        <section data-section="missing-documents">
          <h3 data-field="section-title">Tài liệu còn thiếu</h3>
          <ul data-field="missing-documents-list">
            {(missingDocuments as Array<{ label?: string; docType?: string }>).map((doc, i) => (
              <li
                key={i}
                data-field="missing-doc"
                data-doc-type={doc.docType ?? ''}
              >
                {doc.label ?? doc.docType ?? ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 3: Warnings ──────────────────────────────────────────── */}
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
                    data-field="severity-tag"
                    data-risk-color={clr}
                    style={{ color: clr, fontWeight: 'bold' }}
                  >
                    {`[${sev}]`}
                  </span>{' '}
                  {body}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Section 4: Completion score ──────────────────────────────────── */}
      {completionScore != null && (
        <section data-section="completion">
          <h3 data-field="section-title">Tiến độ hoàn thành hồ sơ</h3>
          <span data-field="completion-score">{score}%</span>
          <div
            data-field="completion-bar-container"
            style={{ background: '#e0e0e0', width: '100%', height: '8px' }}
          >
            <div
              data-field="completion-bar"
              data-score={score}
              style={{ width: `${score}%`, height: '100%', background: '#4caf50' }}
            />
          </div>
        </section>
      )}

      {/* ── Section 5: Risk level + score ────────────────────────────────── */}
      {(riskLevel != null || riskScore != null) && (
        <section data-section="risk">
          <h3 data-field="section-title">Mức độ rủi ro</h3>
          {riskLevel != null && (
            <span
              data-field="risk-level"
              data-risk-level={level}
              data-risk-color={color}
              style={{ color, fontWeight: 'bold' }}
            >
              {level}
            </span>
          )}
          {riskScore != null && (
            <span data-field="risk-score">{riskScore}</span>
          )}
        </section>
      )}

      {/* ── Section 6: Recommendations ───────────────────────────────────── */}
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

    </div>
  );
}
