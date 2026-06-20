/**
 * Legal v2.4 — ChecklistPanel
 *
 * Read-only visualization of procurement document completeness derived from
 * AgentMessage pipeline enrichment fields (missingDocuments, warnings,
 * completionScore) plus an optional presentDocuments list supplied by the caller.
 *
 * Four collapsible sections:
 *   1. Tiến độ hồ sơ        — completion score + percentage
 *   2. Tài liệu có sẵn      — present documents (✓)
 *   3. Tài liệu còn thiếu   — missing documents (❌)
 *   4. Cảnh báo             — warnings with severity level on separate line
 *
 * Each section collapses when its data is empty/absent.
 * Returns null when no checklist metadata exists.
 * Never throws. All arrays default to [].
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistPanelProps {
  /** Docs confirmed present — explicit type since this is caller-supplied, not from AgentMessage. */
  presentDocuments?: Array<{ label: string; docType?: string }>;
  /** RequiredDocument[] from AgentMessage.missingDocuments (unknown[] in transport layer). */
  missingDocuments?: unknown[];
  /** Warning strings with [LEVEL] prefix from AgentMessage.warnings. */
  warnings?:         string[];
  /** 0–100 from AgentMessage.completionScore. */
  completionScore?:  number;
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

export default function ChecklistPanel({
  presentDocuments = [],
  missingDocuments = [],
  warnings         = [],
  completionScore,
}: ChecklistPanelProps) {
  const hasAny =
    presentDocuments.length > 0 ||
    missingDocuments.length > 0 ||
    warnings.length         > 0 ||
    completionScore != null;

  if (!hasAny) return null;

  return (
    <div data-panel="checklist">

      {/* ── Section 1: Completion score ──────────────────────────────────── */}
      {completionScore != null && (
        <section data-section="completion">
          <h3 data-field="section-title">Tiến độ hồ sơ</h3>
          <span
            data-field="completion-score"
            data-score={completionScore}
          >
            {`${completionScore}%`}
          </span>
        </section>
      )}

      {/* ── Section 2: Present documents ─────────────────────────────────── */}
      {presentDocuments.length > 0 && (
        <section data-section="present-documents">
          <h3 data-field="section-title">Tài liệu có sẵn</h3>
          <ul data-field="present-list">
            {presentDocuments.map((doc, i) => (
              <li
                key={i}
                data-field="present-doc"
                data-doc-type={doc.docType ?? ''}
              >
                <span data-field="present-icon">✓</span>
                {doc.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 3: Missing documents ─────────────────────────────────── */}
      {missingDocuments.length > 0 && (
        <section data-section="missing-documents">
          <h3 data-field="section-title">Tài liệu còn thiếu</h3>
          <ul data-field="missing-list">
            {(missingDocuments as Array<{ label?: string; docType?: string }>).map((doc, i) => (
              <li
                key={i}
                data-field="missing-doc"
                data-doc-type={doc.docType ?? ''}
              >
                <span data-field="missing-icon">❌</span>
                {doc.label ?? doc.docType ?? ''}
              </li>
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
