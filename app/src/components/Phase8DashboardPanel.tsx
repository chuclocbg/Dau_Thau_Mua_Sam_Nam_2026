/**
 * 8-J: Phase8DashboardPanel — collapsible dashboard composing all Phase 8 panels.
 *
 * Sections (4 total):
 *   agent-output  — AgentOutputPanel (8-B) — 4 specialist agents
 *   legal-kb      — LegalKBPanel (8-D) — live KB search results
 *   legal-review  — PackageLegalReviewPanel (8-E) — P5-03 reviewPackage findings
 *   audit-report  — AgentAuditExporter (8-H) summary — overallRisk / auditReadiness
 *
 * Collapsible behavior:
 *   Controlled via the `collapsed` prop (SectionCollapseState).
 *   When a section key is true the section header is still rendered but the
 *   child panel is omitted — tested by data-collapsed="true|false" attribute.
 *   No hooks or browser globals — fully SSR-compatible and testable via renderToString.
 *
 * Fallback when data is unavailable:
 *   agentBundle=null     → <div data-section-fallback="agent-output"> shown instead of AgentOutputPanel
 *   legalReviewResult=null → <div data-section-fallback="legal-review"> shown
 *   auditReport=null     → <div data-section-fallback="audit-report"> shown
 *   kbResults=null/[]    → LegalKBPanel renders empty state (data-state="empty")
 */

import AgentOutputPanel from './AgentOutputPanel';
import LegalKBPanel from './LegalKBPanel';
import PackageLegalReviewPanel from './PackageLegalReviewPanel';
import type { AgentSystemBundle } from './AgentProviderPanel';
import type { SearchResult } from '../ai/legalKnowledgeBase';
import type { LegalReviewResult } from '../ai/legalReviewer';
import type { AgentAuditReport } from '../ai/agentAuditExporter';

// ─── Public constants ─────────────────────────────────────────────────────────

export const PHASE8_DASHBOARD_VERSION       = '8-J';
export const PHASE8_DASHBOARD_SECTION_COUNT = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectionCollapseState {
  agentOutput?: boolean;
  legalKb?:     boolean;
  legalReview?: boolean;
  auditReport?: boolean;
}

export interface Phase8DashboardPanelProps {
  /** Phase 8 agent bundle from createAgentSystem() — null shows agent-output fallback. */
  agentBundle?:       AgentSystemBundle | null;
  /** Query string forwarded to LegalKBPanel — null treated as empty string. */
  kbQuery?:           string | null;
  /** Pre-computed KB results — null/undefined treated as empty array. */
  kbResults?:         SearchResult[] | null;
  /** Pre-computed legal review — null shows legal-review fallback. */
  legalReviewResult?: LegalReviewResult | null;
  /** Pre-computed audit report — null shows audit-report fallback. */
  auditReport?:       AgentAuditReport | null;
  /** Which sections are collapsed; missing keys default to false (expanded). */
  collapsed?:         SectionCollapseState | null;
  /** When true the panel renders a loading skeleton instead of sections. */
  loading?:           boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Phase8DashboardPanel({
  agentBundle,
  kbQuery,
  kbResults,
  legalReviewResult,
  auditReport,
  collapsed,
  loading = false,
}: Phase8DashboardPanelProps) {
  if (loading) {
    return (
      <div data-panel="phase8-dashboard" data-state="loading">
        <span data-field="message">Đang khởi động hệ thống AI Phase 8...</span>
      </div>
    );
  }

  const col = collapsed ?? {};

  return (
    <div
      data-panel="phase8-dashboard"
      data-state="ready"
      data-section-count={PHASE8_DASHBOARD_SECTION_COUNT}
    >
      <h1 data-field="title">Hệ thống AI mua sắm — Phase 8</h1>

      {/* ── Section 1: Specialist Agents ─────────────────────────────────── */}
      <section
        data-section="agent-output"
        data-collapsed={String(col.agentOutput ?? false)}
      >
        <h2 data-field="section-title">Tác nhân chuyên biệt</h2>
        {!col.agentOutput && (
          agentBundle != null ? (
            <AgentOutputPanel
              planner={agentBundle.planner}
              spec={agentBundle.spec}
              legal={agentBundle.legal}
              risk={agentBundle.risk}
            />
          ) : (
            <div data-field="fallback" data-section-fallback="agent-output">
              Hệ thống Agent chưa sẵn sàng.
            </div>
          )
        )}
      </section>

      {/* ── Section 2: Legal Knowledge Base ──────────────────────────────── */}
      <section
        data-section="legal-kb"
        data-collapsed={String(col.legalKb ?? false)}
      >
        <h2 data-field="section-title">Căn cứ pháp lý</h2>
        {!col.legalKb && (
          <LegalKBPanel
            query={kbQuery ?? ''}
            results={kbResults ?? []}
          />
        )}
      </section>

      {/* ── Section 3: Package Legal Review ──────────────────────────────── */}
      <section
        data-section="legal-review"
        data-collapsed={String(col.legalReview ?? false)}
      >
        <h2 data-field="section-title">Rà soát pháp lý gói thầu</h2>
        {!col.legalReview && (
          legalReviewResult != null ? (
            <PackageLegalReviewPanel result={legalReviewResult} />
          ) : (
            <div data-field="fallback" data-section-fallback="legal-review">
              Chưa có kết quả rà soát pháp lý.
            </div>
          )
        )}
      </section>

      {/* ── Section 4: Agent Audit Report ────────────────────────────────── */}
      <section
        data-section="audit-report"
        data-collapsed={String(col.auditReport ?? false)}
      >
        <h2 data-field="section-title">Báo cáo kiểm toán Agent</h2>
        {!col.auditReport && (
          auditReport != null ? (
            <div
              data-field="audit-summary"
              data-overall-risk={auditReport.overallRisk}
              data-audit-readiness={auditReport.auditReadiness}
              data-finding-count={auditReport.findingCount}
              data-cross-check-count={auditReport.crossCheckCount}
              data-generated-at={auditReport.generatedAt}
            >
              <span data-field="filename">{auditReport.filename}</span>
              <span data-field="overall-risk">{auditReport.overallRisk}</span>
              <span data-field="audit-readiness">{auditReport.auditReadiness}</span>
              <span data-field="finding-count">{String(auditReport.findingCount)}</span>
              {auditReport.complianceScore !== null && (
                <span data-field="compliance-score">{String(auditReport.complianceScore)}</span>
              )}
            </div>
          ) : (
            <div data-field="fallback" data-section-fallback="audit-report">
              Chưa tạo báo cáo kiểm toán.
            </div>
          )
        )}
      </section>
    </div>
  );
}
