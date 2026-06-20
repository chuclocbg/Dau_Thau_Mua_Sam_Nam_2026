/**
 * Legal v3.0 — LegalDashboard tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   LD-01  (3)  Full dashboard — all 7 panels present
 *   LD-02  (3)  Empty metadata returns null
 *   LD-03  (3)  Only summary present
 *   LD-04  (3)  Partial metadata
 *   LD-05  (3)  Rendering order
 *   LD-06  (3)  Snapshot
 *   LD-07  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import LegalDashboard, { type LegalDashboardProps } from '../components/LegalDashboard';
import AgentOutputPanel    from '../components/AgentOutputPanel';
import Phase8DashboardPanel from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMissing(label: string, docType: string) {
  return { docType, label, mandatory: true, legalBasis: '' };
}

const FULL_DASHBOARD: LegalDashboardProps = {
  summary: {
    applicableDocuments: [{ title: 'Luật Đấu thầu 22/2023/QH15' }],
    warnings:            ['[HIGH] Thiếu biên bản nghiệm thu'],
    completionScore:     75,
    riskLevel:           'MEDIUM',
    riskScore:           35,
  },
  citations: [
    'Luật Đấu thầu 22/2023/QH15 — Điều 1',
    'Nghị định 214/2025/NĐ-CP — Điều 5',
  ],
  trace: {
    completionScore: 75,
    riskLevel:       'MEDIUM',
  },
  checklist: {
    presentDocuments: [{ label: 'Tờ trình', docType: 'to-trinh' }],
    missingDocuments: [makeMissing('KHLCNT', 'khlcnt')],
    completionScore:  75,
  },
  risk: {
    riskLevel:       'MEDIUM',
    riskScore:       35,
    warnings:        ['[HIGH] Thiếu biên bản nghiệm thu'],
    recommendations: ['[LOW] Lưu hồ sơ đầy đủ'],
  },
  recommendations: {
    recommendations: ['[HIGH] Bổ sung KHLCNT ngay', '[LOW] Lưu hồ sơ đầy đủ'],
  },
  timeline: {
    presentDocuments: [{ label: 'Tờ trình', docType: 'to-trinh' }],
    missingDocuments: [makeMissing('KHLCNT', 'khlcnt')],
  },
};

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── LD-01 · Full dashboard — all 7 panels present ───────────────────────────

describe('LD-01 · Full dashboard — all 7 panels present', () => {
  it('LD-01-01: data-panel="legal-dashboard" is present', () => {
    const html = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    expect(html).toContain('data-panel="legal-dashboard"');
  });

  it('LD-01-02: all 7 sub-panel data-panel attributes are present', () => {
    const html = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    expect(html).toContain('data-panel="legal-summary"');
    expect(html).toContain('data-panel="citation-card"');
    expect(html).toContain('data-panel="trace"');
    expect(html).toContain('data-panel="checklist"');
    expect(html).toContain('data-panel="risk"');
    expect(html).toContain('data-panel="recommendation"');
    expect(html).toContain('data-panel="timeline"');
  });

  it('LD-01-03: all sub-panels appear inside the data-panel="legal-dashboard" wrapper', () => {
    const html        = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    const dashStart   = html.indexOf('data-panel="legal-dashboard"');
    const summaryPos  = html.indexOf('data-panel="legal-summary"');
    const timelinePos = html.indexOf('data-panel="timeline"');
    expect(dashStart).toBeGreaterThan(-1);
    expect(summaryPos).toBeGreaterThan(dashStart);
    expect(timelinePos).toBeGreaterThan(dashStart);
  });
});

// ─── LD-02 · Empty metadata returns null ─────────────────────────────────────

describe('LD-02 · Empty metadata returns null', () => {
  it('LD-02-01: no props at all renders empty string', () => {
    const html = renderToString(<LegalDashboard />);
    expect(html).toBe('');
  });

  it('LD-02-02: all props explicitly null renders empty string', () => {
    const html = renderToString(
      <LegalDashboard
        summary={null}
        citations={null}
        trace={null}
        checklist={null}
        risk={null}
        recommendations={null}
        timeline={null}
      />,
    );
    expect(html).toBe('');
  });

  it('LD-02-03: citations empty array with all others null renders empty string', () => {
    const html = renderToString(
      <LegalDashboard citations={[]} />,
    );
    expect(html).toBe('');
  });
});

// ─── LD-03 · Only summary present ────────────────────────────────────────────

describe('LD-03 · Only summary present', () => {
  const props: LegalDashboardProps = {
    summary: { completionScore: 80, riskLevel: 'LOW' },
  };

  it('LD-03-01: data-panel="legal-dashboard" is present', () => {
    const html = renderToString(<LegalDashboard {...props} />);
    expect(html).toContain('data-panel="legal-dashboard"');
  });

  it('LD-03-02: data-panel="legal-summary" is present', () => {
    const html = renderToString(<LegalDashboard {...props} />);
    expect(html).toContain('data-panel="legal-summary"');
  });

  it('LD-03-03: trace, checklist, risk, recommendation, timeline panels are absent', () => {
    const html = renderToString(<LegalDashboard {...props} />);
    expect(html).not.toContain('data-panel="trace"');
    expect(html).not.toContain('data-panel="checklist"');
    expect(html).not.toContain('data-panel="risk"');
    expect(html).not.toContain('data-panel="recommendation"');
    expect(html).not.toContain('data-panel="timeline"');
  });
});

// ─── LD-04 · Partial metadata ─────────────────────────────────────────────────

describe('LD-04 · Partial metadata', () => {
  it('LD-04-01: only citations — data-panel="citation-card" present, others absent', () => {
    const html = renderToString(
      <LegalDashboard citations={['Luật Đấu thầu 22/2023/QH15 — Điều 1']} />,
    );
    expect(html).toContain('data-panel="citation-card"');
    expect(html).not.toContain('data-panel="legal-summary"');
    expect(html).not.toContain('data-panel="risk"');
  });

  it('LD-04-02: only risk — data-panel="risk" present, summary and checklist absent', () => {
    const html = renderToString(
      <LegalDashboard risk={{ riskLevel: 'HIGH', riskScore: 72 }} />,
    );
    expect(html).toContain('data-panel="risk"');
    expect(html).not.toContain('data-panel="legal-summary"');
    expect(html).not.toContain('data-panel="checklist"');
  });

  it('LD-04-03: only timeline — data-panel="timeline" present, other panels absent', () => {
    const html = renderToString(
      <LegalDashboard
        timeline={{
          presentDocuments: [{ label: 'Tờ trình', docType: 'to-trinh' }],
          missingDocuments: [makeMissing('KHLCNT', 'khlcnt')],
        }}
      />,
    );
    expect(html).toContain('data-panel="timeline"');
    expect(html).not.toContain('data-panel="legal-summary"');
    expect(html).not.toContain('data-panel="recommendation"');
  });
});

// ─── LD-05 · Rendering order ─────────────────────────────────────────────────

describe('LD-05 · Rendering order', () => {
  it('LD-05-01: LegalSummaryPanel appears before CitationCardPanel', () => {
    const html       = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    const summaryPos = html.indexOf('data-panel="legal-summary"');
    const citPos     = html.indexOf('data-panel="citation-card"');
    expect(summaryPos).toBeGreaterThan(-1);
    expect(citPos).toBeGreaterThan(-1);
    expect(summaryPos).toBeLessThan(citPos);
  });

  it('LD-05-02: TracePanel appears before ChecklistPanel', () => {
    const html      = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    const tracePos  = html.indexOf('data-panel="trace"');
    const checkPos  = html.indexOf('data-panel="checklist"');
    expect(tracePos).toBeGreaterThan(-1);
    expect(checkPos).toBeGreaterThan(-1);
    expect(tracePos).toBeLessThan(checkPos);
  });

  it('LD-05-03: RecommendationPanel appears before TimelinePanel', () => {
    const html    = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    const recPos  = html.indexOf('data-panel="recommendation"');
    const tlPos   = html.indexOf('data-panel="timeline"');
    expect(recPos).toBeGreaterThan(-1);
    expect(tlPos).toBeGreaterThan(-1);
    expect(recPos).toBeLessThan(tlPos);
  });
});

// ─── LD-06 · Snapshot ─────────────────────────────────────────────────────────

describe('LD-06 · Snapshot', () => {
  it('LD-06-01: full dashboard render matches snapshot', () => {
    const html = renderToString(<LegalDashboard {...FULL_DASHBOARD} />);
    expect(html).toMatchSnapshot();
  });

  it('LD-06-02: summary-only render matches snapshot', () => {
    const html = renderToString(
      <LegalDashboard summary={{ completionScore: 80, riskLevel: 'LOW' }} />,
    );
    expect(html).toMatchSnapshot();
  });

  it('LD-06-03: risk-only render matches snapshot', () => {
    const html = renderToString(
      <LegalDashboard risk={{ riskLevel: 'HIGH', riskScore: 72 }} />,
    );
    expect(html).toMatchSnapshot();
  });
});

// ─── LD-07 · Backward compatibility ──────────────────────────────────────────

describe('LD-07 · Backward compatibility', () => {
  it('LD-07-01: AgentOutputPanel without legalDashboard renders no data-panel="legal-dashboard"', () => {
    const planner = makeAgent('planner',        'Planner Agent');
    const spec    = makeAgent('specification',  'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk',           'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec        as never}
        legal={legal      as never}
        risk={risk        as never}
        legalSummary={{ completionScore: 75, riskLevel: 'MEDIUM' }}
      />,
    );

    expect(html).toContain('data-panel="agent-output"');
    expect(html).not.toContain('data-panel="legal-dashboard"');
    // individual panel still renders via legacy path
    expect(html).toContain('data-panel="legal-summary"');
  });

  it('LD-07-02: AgentOutputPanel with legalDashboard renders dashboard and no standalone individual panels', () => {
    const planner = makeAgent('planner',        'Planner Agent');
    const spec    = makeAgent('specification',  'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk',           'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec        as never}
        legal={legal      as never}
        risk={risk        as never}
        // legalDashboard provided — replaces individual panel props
        legalDashboard={{ summary: { completionScore: 75, riskLevel: 'MEDIUM' } }}
        // legalSummary also passed — should be suppressed (no duplicate rendering)
        legalSummary={{ completionScore: 75, riskLevel: 'MEDIUM' }}
      />,
    );

    expect(html).toContain('data-panel="legal-dashboard"');
    // legal-summary must appear exactly once (inside dashboard), not twice
    const count = (html.match(/data-panel="legal-summary"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('LD-07-03: Phase8DashboardPanel without legalDashboard renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="legal-dashboard"');
  });
});
