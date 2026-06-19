/**
 * 8-J: Phase8DashboardPanel — 56 tests
 *
 * Groups:
 *   PD-01  (5)  Module exports and constants
 *   PD-02  (5)  Root element structure
 *   PD-03  (5)  Section structure and default collapse state
 *   PD-04  (5)  Collapsed prop behavior — sections hidden/shown
 *   PD-05  (4)  Loading state
 *   PD-06  (4)  Agent section — null bundle fallback
 *   PD-07  (5)  Agent section — live bundle renders AgentOutputPanel
 *   PD-08  (4)  KB section — live results pass through to LegalKBPanel
 *   PD-09  (5)  KB section — null/undefined defaults to empty LegalKBPanel
 *   PD-10  (5)  Legal review + audit — null fallbacks
 *   PD-11  (4)  Legal review + audit — live data
 *   PD-12  (5)  Integration and SSR safety
 *
 * All rendering via renderToString (SSR-compatible).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import Phase8DashboardPanel, {
  PHASE8_DASHBOARD_VERSION,
  PHASE8_DASHBOARD_SECTION_COUNT,
} from '../components/Phase8DashboardPanel';
import type { Phase8DashboardPanelProps } from '../components/Phase8DashboardPanel';
import { createAgentSystem } from '../components/AgentProviderPanel';
import { searchLegalKB } from '../ai/legalKnowledgeBase';
import { reviewPackage } from '../ai/legalReviewer';
import { buildAgentAuditReport } from '../ai/agentAuditExporter';
import type { ProcurementPackage } from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function render(props: Phase8DashboardPanelProps = {}): string {
  return renderToString(React.createElement(Phase8DashboardPanel, props));
}

function makeCleanPackage(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:            'pd-test',
    packageName:   'Mua sắm văn phòng phẩm',
    packageCode:   'PD-001',
    packageType:   'goods_consumable',
    contractType:  'lump_sum',
    fundingSource:     'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:        2026,
    estimatedValue:    80_000_000,
    rectorName:        '[Hiệu trưởng]',
    departmentName:    '[Phòng đề xuất]',
    departmentCode:    'PD',
    expertTeamLeader:  '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1: '[Thành viên tổ chuyên gia]',
    expertTeamMember2: '[Thành viên tổ chuyên gia]',
    appraisalLeader:   '[Tổ trưởng thẩm định độc lập]',
    appraisalMember:   '[Thành viên thẩm định độc lập]',
    supplier1Name:     '[Nhà cung cấp số 1]',
    supplier1Address:  '[Địa chỉ nhà cung cấp số 1]',
    supplier1TaxCode:  '0000000001',
    supplier1Representative: '[Người đại diện]',
    supplier1Position: 'Giám đốc',
    supplier2Name:     '[Nhà cung cấp số 2]',
    supplier2Address:  '[Địa chỉ nhà cung cấp số 2]',
    supplier3Name:     '[Nhà cung cấp số 3]',
    supplier3Address:  '[Địa chỉ nhà cung cấp số 3]',
    dateProposal:        '2026-01-10',
    dateSurvey:          '2026-01-12',
    dateQuotes:          '2026-01-14',
    dateCompare:         '2026-01-16',
    dateKhlcnt:          '2026-01-20',
    dateKhlcntApprove:   '2026-01-25',
    dateExpertEstablish: '2026-02-01',
    dateDocIssue:        '2026-02-05',
    dateBidClose:        '2026-02-15',
    dateEvaluate:        '2026-02-16',
    dateApprove:         '2026-02-20',
    dateContract:        '2026-02-25',
    dateDelivery:        '2026-03-10',
    dateAcceptance:      '2026-03-15',
    items: [
      {
        id: '1',
        name: 'Giấy in A4 70gsm',
        unit: 'Ream',
        quantity: 100,
        unitPrice: 80_000,
        totalPrice: 8_000_000,
        specs: 'Định lượng 70gsm, khổ A4',
      },
    ],
    ...overrides,
  };
}

const bundle        = createAgentSystem();
const kbResultsFull = searchLegalKB('mua sắm');
const cleanPkg      = makeCleanPackage();
const cleanReview   = reviewPackage(cleanPkg);
const auditClean    = buildAgentAuditReport(null, null);
const auditWithData = buildAgentAuditReport(null, null); // pre-built — timestamp fixed

// ─── PD-01: Module exports and constants ──────────────────────────────────────

describe('PD-01: module exports and constants', () => {
  it('PD-01-01: Phase8DashboardPanel is a function', () => {
    expect(typeof Phase8DashboardPanel).toBe('function');
  });

  it('PD-01-02: PHASE8_DASHBOARD_SECTION_COUNT is 4', () => {
    expect(PHASE8_DASHBOARD_SECTION_COUNT).toBe(4);
  });

  it('PD-01-03: PHASE8_DASHBOARD_VERSION is "8-J"', () => {
    expect(PHASE8_DASHBOARD_VERSION).toBe('8-J');
  });

  it('PD-01-04: default render (no props) returns non-empty HTML', () => {
    const html = render();
    expect(html.length).toBeGreaterThan(50);
  });

  it('PD-01-05: Phase8DashboardPanelProps type is importable (structural)', () => {
    const props: Phase8DashboardPanelProps = {};
    expect(typeof props).toBe('object');
  });
});

// ─── PD-02: Root element structure ───────────────────────────────────────────

describe('PD-02: root element structure', () => {
  it('PD-02-01: data-panel="phase8-dashboard"', () => {
    expect(render()).toContain('data-panel="phase8-dashboard"');
  });

  it('PD-02-02: data-state="ready" on default render', () => {
    expect(render()).toContain('data-state="ready"');
  });

  it('PD-02-03: data-section-count="4"', () => {
    expect(render()).toContain('data-section-count="4"');
  });

  it('PD-02-04: data-field="title" present', () => {
    expect(render()).toContain('data-field="title"');
  });

  it('PD-02-05: title text includes "Phase 8"', () => {
    expect(render()).toContain('Phase 8');
  });
});

// ─── PD-03: Section structure and default collapse state ─────────────────────

describe('PD-03: section structure and default collapse state', () => {
  it('PD-03-01: data-section="agent-output" present', () => {
    expect(render()).toContain('data-section="agent-output"');
  });

  it('PD-03-02: data-section="legal-kb" present', () => {
    expect(render()).toContain('data-section="legal-kb"');
  });

  it('PD-03-03: data-section="legal-review" present', () => {
    expect(render()).toContain('data-section="legal-review"');
  });

  it('PD-03-04: data-section="audit-report" present', () => {
    expect(render()).toContain('data-section="audit-report"');
  });

  it('PD-03-05: all four sections default to data-collapsed="false"', () => {
    const html = render();
    const matches = html.match(/data-collapsed="false"/g) ?? [];
    expect(matches.length).toBe(4);
  });
});

// ─── PD-04: Collapsed prop behavior ──────────────────────────────────────────

describe('PD-04: collapsed prop behavior', () => {
  it('PD-04-01: collapsed.agentOutput=true → data-collapsed="true" on agent-output section', () => {
    const html = render({ collapsed: { agentOutput: true } });
    expect(html).toContain(
      'data-section="agent-output" data-collapsed="true"',
    );
  });

  it('PD-04-02: collapsed.agentOutput=true → AgentOutputPanel not rendered (no data-panel="agent-output")', () => {
    const html = render({ agentBundle: bundle, collapsed: { agentOutput: true } });
    expect(html).not.toContain('data-panel="agent-output"');
  });

  it('PD-04-03: collapsed.legalKb=true → LegalKBPanel not rendered (no data-panel="legal-kb")', () => {
    const html = render({ collapsed: { legalKb: true } });
    expect(html).not.toContain('data-panel="legal-kb"');
  });

  it('PD-04-04: collapsed.legalReview=true → PackageLegalReviewPanel not rendered', () => {
    const html = render({ legalReviewResult: cleanReview, collapsed: { legalReview: true } });
    expect(html).not.toContain('data-panel="legal-review"');
  });

  it('PD-04-05: collapsed.auditReport=true → audit-summary not rendered', () => {
    const html = render({ auditReport: auditClean, collapsed: { auditReport: true } });
    expect(html).not.toContain('data-field="audit-summary"');
  });
});

// ─── PD-05: Loading state ─────────────────────────────────────────────────────

describe('PD-05: loading state', () => {
  it('PD-05-01: loading=true → data-state="loading"', () => {
    expect(render({ loading: true })).toContain('data-state="loading"');
  });

  it('PD-05-02: loading=true → loading message present', () => {
    expect(render({ loading: true })).toContain('Phase 8');
  });

  it('PD-05-03: loading=true → no data-section attributes', () => {
    const html = render({ loading: true });
    expect(html).not.toContain('data-section=');
  });

  it('PD-05-04: loading=false (default) → data-state="ready"', () => {
    expect(render({ loading: false })).toContain('data-state="ready"');
  });
});

// ─── PD-06: Agent section — null bundle fallback ──────────────────────────────

describe('PD-06: agent section — null bundle fallback', () => {
  it('PD-06-01: agentBundle=null → data-section-fallback="agent-output"', () => {
    expect(render({ agentBundle: null })).toContain('data-section-fallback="agent-output"');
  });

  it('PD-06-02: agentBundle=null → no data-panel="agent-output" from AgentOutputPanel', () => {
    expect(render({ agentBundle: null })).not.toContain('data-panel="agent-output"');
  });

  it('PD-06-03: agentBundle=undefined → also shows fallback', () => {
    expect(render({ agentBundle: undefined })).toContain('data-section-fallback="agent-output"');
  });

  it('PD-06-04: fallback text "Hệ thống Agent chưa sẵn sàng" visible', () => {
    expect(render({ agentBundle: null })).toContain('Hệ thống Agent chưa sẵn sàng');
  });
});

// ─── PD-07: Agent section — live bundle renders AgentOutputPanel ──────────────

describe('PD-07: agent section — live bundle', () => {
  it('PD-07-01: bundle provided → data-panel="agent-output" from inner AgentOutputPanel', () => {
    expect(render({ agentBundle: bundle })).toContain('data-panel="agent-output"');
  });

  it('PD-07-02: bundle → data-agent-count="4" on inner panel', () => {
    expect(render({ agentBundle: bundle })).toContain('data-agent-count="4"');
  });

  it('PD-07-03: bundle → no data-section-fallback="agent-output"', () => {
    expect(render({ agentBundle: bundle })).not.toContain('data-section-fallback="agent-output"');
  });

  it('PD-07-04: bundle → planner agent data-section="planner" from AgentSection', () => {
    expect(render({ agentBundle: bundle })).toContain('data-section="planner"');
  });

  it('PD-07-05: bundle → data-state="ready" on inner AgentOutputPanel', () => {
    const html = render({ agentBundle: bundle });
    expect(html).toContain('data-panel="agent-output"');
    expect(html).toContain('data-state="ready"');
  });
});

// ─── PD-08: KB section — live results pass through to LegalKBPanel ───────────

describe('PD-08: KB section — live results', () => {
  it('PD-08-01: kbResults=[] → data-state="empty" on inner LegalKBPanel', () => {
    expect(render({ kbResults: [] })).toContain('data-state="empty"');
  });

  it('PD-08-02: kbResultsFull → data-state="ready" on inner LegalKBPanel', () => {
    expect(render({ kbResults: kbResultsFull })).toContain('data-state="ready"');
  });

  it('PD-08-03: kbResultsFull length reflected in data-result-count', () => {
    const html = render({ kbResults: kbResultsFull });
    expect(html).toContain(`data-result-count="${kbResultsFull.length}"`);
  });

  it('PD-08-04: kbQuery visible in data-field="query" on inner LegalKBPanel', () => {
    const html = render({ kbQuery: 'đấu thầu', kbResults: kbResultsFull });
    expect(html).toContain('data-field="query"');
    expect(html).toContain('đấu thầu');
  });
});

// ─── PD-09: KB section — null/undefined defaults ─────────────────────────────

describe('PD-09: KB section — null/undefined defaults', () => {
  it('PD-09-01: kbResults=null → empty array used → data-state="empty"', () => {
    expect(render({ kbResults: null })).toContain('data-state="empty"');
  });

  it('PD-09-02: kbQuery=null → empty string forwarded to LegalKBPanel', () => {
    const html = render({ kbQuery: null });
    expect(html).toContain('data-panel="legal-kb"');
  });

  it('PD-09-03: kbResults=undefined → treated as empty → data-state="empty"', () => {
    expect(render({ kbResults: undefined })).toContain('data-state="empty"');
  });

  it('PD-09-04: kbQuery=undefined → data-panel="legal-kb" still rendered', () => {
    const html = render({ kbQuery: undefined });
    expect(html).toContain('data-panel="legal-kb"');
  });

  it('PD-09-05: null results → data-result-count="0"', () => {
    expect(render({ kbResults: null })).toContain('data-result-count="0"');
  });
});

// ─── PD-10: Legal review + audit — null fallbacks ────────────────────────────

describe('PD-10: legal review and audit — null fallbacks', () => {
  it('PD-10-01: legalReviewResult=null → data-section-fallback="legal-review"', () => {
    expect(render({ legalReviewResult: null })).toContain(
      'data-section-fallback="legal-review"',
    );
  });

  it('PD-10-02: legalReviewResult=null → no data-panel="legal-review" from child', () => {
    expect(render({ legalReviewResult: null })).not.toContain('data-panel="legal-review"');
  });

  it('PD-10-03: auditReport=null → data-section-fallback="audit-report"', () => {
    expect(render({ auditReport: null })).toContain('data-section-fallback="audit-report"');
  });

  it('PD-10-04: auditReport=null → no data-field="audit-summary"', () => {
    expect(render({ auditReport: null })).not.toContain('data-field="audit-summary"');
  });

  it('PD-10-05: both null → both data-section-fallback attributes present', () => {
    const html = render({ legalReviewResult: null, auditReport: null });
    expect(html).toContain('data-section-fallback="legal-review"');
    expect(html).toContain('data-section-fallback="audit-report"');
  });
});

// ─── PD-11: Legal review + audit — live data ─────────────────────────────────

describe('PD-11: legal review and audit — live data', () => {
  it('PD-11-01: cleanReview → data-panel="legal-review" from PackageLegalReviewPanel', () => {
    expect(render({ legalReviewResult: cleanReview })).toContain('data-panel="legal-review"');
  });

  it('PD-11-02: auditClean → data-field="audit-summary" present', () => {
    expect(render({ auditReport: auditClean })).toContain('data-field="audit-summary"');
  });

  it('PD-11-03: auditClean.overallRisk in data-overall-risk attribute', () => {
    const html = render({ auditReport: auditClean });
    expect(html).toContain(`data-overall-risk="${auditClean.overallRisk}"`);
  });

  it('PD-11-04: auditClean.filename visible as text content', () => {
    const html = render({ auditReport: auditClean });
    expect(html).toContain(auditClean.filename);
  });
});

// ─── PD-12: Integration and SSR safety ───────────────────────────────────────

describe('PD-12: integration and SSR safety', () => {
  it('PD-12-01: all data provided → no data-section-fallback in output', () => {
    const html = render({
      agentBundle:       bundle,
      kbQuery:           'mua sắm',
      kbResults:         kbResultsFull,
      legalReviewResult: cleanReview,
      auditReport:       auditWithData,
    });
    expect(html).not.toContain('data-section-fallback=');
  });

  it('PD-12-02: renderToString with all valid props does not throw', () => {
    expect(() =>
      render({
        agentBundle:       bundle,
        kbQuery:           'mua sắm',
        kbResults:         kbResultsFull,
        legalReviewResult: cleanReview,
        auditReport:       auditWithData,
      })
    ).not.toThrow();
  });

  it('PD-12-03: renderToString with all null/undefined props does not throw', () => {
    expect(() =>
      render({
        agentBundle:       null,
        kbQuery:           null,
        kbResults:         null,
        legalReviewResult: null,
        auditReport:       null,
      })
    ).not.toThrow();
  });

  it('PD-12-04: XSS — <script> in kbQuery is escaped in output', () => {
    const html = render({ kbQuery: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert');
  });

  it('PD-12-05: identical renders with same pre-built props', () => {
    const props = {
      agentBundle:       bundle,
      kbQuery:           'kiểm toán',
      kbResults:         kbResultsFull,
      legalReviewResult: cleanReview,
      auditReport:       auditWithData,
    };
    expect(render(props)).toBe(render(props));
  });
});
