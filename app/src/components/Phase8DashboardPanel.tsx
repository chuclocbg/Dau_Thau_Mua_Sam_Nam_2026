/**
 * 8-J / 8-Q: Phase8DashboardPanel — collapsible dashboard composing all Phase 8 panels.
 *
 * Sections (9 total):
 *   agent-output         — AgentOutputPanel (8-B) — 4 specialist agents
 *   legal-kb             — LegalKBPanel (8-D) — live KB search results
 *   legal-review         — PackageLegalReviewPanel (8-E) — P5-03 reviewPackage findings
 *   audit-report         — AgentAuditExporter (8-H) summary — overallRisk / auditReadiness
 *   agent-trace          — AgentTracePanel (8-K) — chronological message audit trail
 *   agent-registry       — AgentRegistryPanel (8-L) — multi-trace registry overview
 *   agent-flow           — AgentFlowPanel (8-M) — routing/flow summary
 *   agent-legal-citation — AgentLegalCitationPanel (8-N) — citation frequency
 *   agent-error          — AgentErrorPanel (8-O) — error-only filtered view
 *
 * Collapsible behavior:
 *   Controlled via the `collapsed` prop (SectionCollapseState).
 *   When a section key is true the section header is still rendered but the
 *   child panel is omitted — tested by data-collapsed="true|false" attribute.
 *   No hooks or browser globals — fully SSR-compatible and testable via renderToString.
 *
 * Fallback when data is unavailable:
 *   agentBundle=null       → <div data-section-fallback="agent-output"> shown
 *   legalReviewResult=null → <div data-section-fallback="legal-review"> shown
 *   auditReport=null       → <div data-section-fallback="audit-report"> shown
 *   registry=null          → <div data-section-fallback="agent-registry"> shown
 *   kbResults/traceMessages null → child panel renders its own empty state
 */

import AgentOutputPanel from './AgentOutputPanel';
import LegalSummaryPanel, { type LegalSummaryPanelProps } from './LegalSummaryPanel';
import { type TracePanelProps } from './TracePanel';
import { type ChecklistPanelProps } from './ChecklistPanel';
import { type RiskPanelProps } from './RiskPanel';
import { type RecommendationPanelProps } from './RecommendationPanel';
import { type TimelinePanelProps } from './TimelinePanel';
import { type LegalDashboardProps } from './LegalDashboard';
import LegalKBPanel from './LegalKBPanel';
import PackageLegalReviewPanel from './PackageLegalReviewPanel';
import AgentTracePanel from './AgentTracePanel';
import AgentRegistryPanel from './AgentRegistryPanel';
import AgentFlowPanel from './AgentFlowPanel';
import AgentLegalCitationPanel from './AgentLegalCitationPanel';
import AgentErrorPanel from './AgentErrorPanel';
import type { AgentSystemBundle } from './AgentProviderPanel';
import type { SearchResult } from '../ai/legalKnowledgeBase';
import type { LegalReviewResult } from '../ai/legalReviewer';
import type { AgentAuditReport } from '../ai/agentAuditExporter';
import type { AgentMessage } from '../agents/types';
import type { AgentRegistry } from '../agents/AgentRegistry';

// ─── Public constants ─────────────────────────────────────────────────────────

export const PHASE8_DASHBOARD_VERSION       = '8-J';
export const PHASE8_DASHBOARD_SECTION_COUNT = 9;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectionCollapseState {
  agentOutput?:        boolean;
  legalKb?:            boolean;
  legalReview?:        boolean;
  auditReport?:        boolean;
  agentTrace?:         boolean;
  agentRegistry?:      boolean;
  agentFlow?:          boolean;
  agentLegalCitation?: boolean;
  agentError?:         boolean;
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
  /** Flat message log for trace/flow/citation/error panels — null defaults to []. */
  traceMessages?:     AgentMessage[] | null;
  /** Active trace ID forwarded to AgentTracePanel — null shows all. */
  traceId?:           string | null;
  /** Live AgentRegistry for AgentRegistryPanel — null shows fallback. */
  registry?:          AgentRegistry | null;
  /** TraceIds to display in AgentRegistryPanel — null defaults to []. */
  traceIds?:          string[] | null;
  /** Which sections are collapsed; missing keys default to false (expanded). */
  collapsed?:         SectionCollapseState | null;
  /** When true the panel renders a loading skeleton instead of sections. */
  loading?:           boolean;
  /** Legal v2.1: optional pipeline metadata for LegalSummaryPanel. */
  legalMetadata?:     LegalSummaryPanelProps | null;
  /** Legal v2.2: AgentMessage.legalBasis — threaded to AgentOutputPanel CitationCardPanel. */
  legalCitations?:    string[] | null;
  /** Legal v2.3: pipeline trace metadata — threaded to AgentOutputPanel TracePanel. */
  legalTrace?:        TracePanelProps | null;
  /** Legal v2.4: checklist metadata — threaded to AgentOutputPanel ChecklistPanel. */
  legalChecklist?:    ChecklistPanelProps | null;
  /** Legal v2.5: risk metadata — threaded to AgentOutputPanel RiskPanel. */
  legalRisk?:              RiskPanelProps | null;
  /** Legal v2.6: severity-grouped recommendations — threaded to AgentOutputPanel RecommendationPanel. */
  legalRecommendations?:   RecommendationPanelProps | null;
  /** Legal v2.7: procurement lifecycle timeline — threaded to AgentOutputPanel TimelinePanel. */
  legalTimeline?:          TimelinePanelProps | null;
  /** Legal v3.0: unified dashboard — threaded to AgentOutputPanel LegalDashboard. */
  legalDashboard?:         LegalDashboardProps | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Phase8DashboardPanel({
  agentBundle,
  kbQuery,
  kbResults,
  legalReviewResult,
  auditReport,
  traceMessages,
  traceId,
  registry,
  traceIds,
  collapsed,
  loading              = false,
  legalMetadata,
  legalCitations,
  legalTrace,
  legalChecklist,
  legalRisk,
  legalRecommendations,
  legalTimeline,
  legalDashboard,
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
              legalSummary={legalMetadata}
              citations={legalCitations}
              legalTrace={legalTrace}
              legalChecklist={legalChecklist}
              legalRisk={legalRisk}
              legalRecommendations={legalRecommendations}
              legalTimeline={legalTimeline}
              legalDashboard={legalDashboard}
            />
          ) : (
            <>
              <div data-field="fallback" data-section-fallback="agent-output">
                Hệ thống Agent chưa sẵn sàng.
              </div>
              {legalMetadata != null && <LegalSummaryPanel {...legalMetadata} />}
            </>
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

      {/* ── Section 5: Agent Trace (8-K) ─────────────────────────────────── */}
      <section
        data-section="agent-trace"
        data-collapsed={String(col.agentTrace ?? false)}
      >
        <h2 data-field="section-title">Nhật ký Agent</h2>
        {!col.agentTrace && (
          <AgentTracePanel
            messages={traceMessages ?? []}
            traceId={traceId ?? null}
          />
        )}
      </section>

      {/* ── Section 6: Agent Registry (8-L) ──────────────────────────────── */}
      <section
        data-section="agent-registry"
        data-collapsed={String(col.agentRegistry ?? false)}
      >
        <h2 data-field="section-title">Registry Agent</h2>
        {!col.agentRegistry && (
          registry != null ? (
            <AgentRegistryPanel
              registry={registry}
              traceIds={traceIds ?? []}
            />
          ) : (
            <div data-field="fallback" data-section-fallback="agent-registry">
              Hệ thống Registry chưa sẵn sàng.
            </div>
          )
        )}
      </section>

      {/* ── Section 7: Agent Flow (8-M) ──────────────────────────────────── */}
      <section
        data-section="agent-flow"
        data-collapsed={String(col.agentFlow ?? false)}
      >
        <h2 data-field="section-title">Luồng giao tiếp Agent</h2>
        {!col.agentFlow && (
          <AgentFlowPanel messages={traceMessages ?? []} />
        )}
      </section>

      {/* ── Section 8: Legal Citation (8-N) ──────────────────────────────── */}
      <section
        data-section="agent-legal-citation"
        data-collapsed={String(col.agentLegalCitation ?? false)}
      >
        <h2 data-field="section-title">Trích dẫn pháp lý</h2>
        {!col.agentLegalCitation && (
          <AgentLegalCitationPanel messages={traceMessages ?? []} />
        )}
      </section>

      {/* ── Section 9: Agent Error (8-O) ─────────────────────────────────── */}
      <section
        data-section="agent-error"
        data-collapsed={String(col.agentError ?? false)}
      >
        <h2 data-field="section-title">Lỗi Agent</h2>
        {!col.agentError && (
          <AgentErrorPanel messages={traceMessages ?? []} />
        )}
      </section>
    </div>
  );
}
