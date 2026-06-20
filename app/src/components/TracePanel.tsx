/**
 * Legal v2.3 — TracePanel
 *
 * Read-only, static visualization of the 7-stage legal pipeline.
 * Every stage is shown with status="success" whenever pipeline metadata
 * is present, because the pipeline is deterministic and synchronous —
 * if AgentMessage carries enrichment fields the full pipeline ran.
 *
 * Collapses (returns null) when no legal metadata exists, matching the
 * same hasAny guard used by LegalSummaryPanel.
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TracePanelProps {
  applicableDocuments?: unknown[];
  missingDocuments?:    unknown[];
  warnings?:            string[];
  completionScore?:     number;
  riskLevel?:           string;
  riskScore?:           number;
  recommendations?:     string[];
}

// ─── Stage definitions ────────────────────────────────────────────────────────

interface Stage {
  id:    string;
  label: string;
}

const STAGES: Stage[] = [
  { id: 'search-index',    label: 'Tra cứu văn bản' },
  { id: 'citation-engine', label: 'Trích dẫn điều khoản' },
  { id: 'applicability',   label: 'Xác định văn bản áp dụng' },
  { id: 'doc-context',     label: 'Phân tích hồ sơ' },
  { id: 'checklist',       label: 'Kiểm tra tài liệu' },
  { id: 'risk-engine',     label: 'Đánh giá rủi ro' },
  { id: 'final-answer',    label: 'Sinh kết quả' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TracePanel({
  applicableDocuments = [],
  missingDocuments    = [],
  warnings            = [],
  completionScore,
  riskLevel,
  riskScore,
  recommendations     = [],
}: TracePanelProps) {
  const hasAny =
    applicableDocuments.length > 0 ||
    missingDocuments.length    > 0 ||
    warnings.length            > 0 ||
    completionScore != null        ||
    riskLevel       != null        ||
    riskScore       != null        ||
    recommendations.length     > 0;

  if (!hasAny) return null;

  return (
    <div data-panel="trace">
      <h3 data-field="title">Quy trình pháp lý</h3>
      <div data-field="stage-list">
        {STAGES.map((stage, i) => (
          <React.Fragment key={stage.id}>
            <div
              data-field="stage"
              data-stage-id={stage.id}
              data-stage-status="success"
              data-stage-index={i}
            >
              <span data-field="stage-label">{stage.label}</span>
              <span data-field="stage-status" data-status="success">✓</span>
            </div>
            {i < STAGES.length - 1 && (
              <div data-field="stage-arrow" aria-hidden="true">↓</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
