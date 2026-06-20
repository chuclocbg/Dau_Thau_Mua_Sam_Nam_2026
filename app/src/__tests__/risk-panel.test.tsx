/**
 * Legal v2.5 — RiskPanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   RP-01  (3)  Full risk panel — all 4 sections rendered
 *   RP-02  (3)  Empty metadata returns null
 *   RP-03  (3)  Risk level badge — colors and attributes
 *   RP-04  (3)  Risk score rendering
 *   RP-05  (3)  Recommendation rendering
 *   RP-06  (3)  Warning rendering with severity
 *   RP-07  (3)  Snapshot and section collapse
 *   RP-08  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import RiskPanel, { type RiskPanelProps } from '../components/RiskPanel';
import AgentOutputPanel                   from '../components/AgentOutputPanel';
import Phase8DashboardPanel               from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_RISK: RiskPanelProps = {
  riskLevel:       'HIGH',
  riskScore:       28,
  warnings:        [
    '[HIGH] Thiếu biên bản nghiệm thu',
    '[MEDIUM] Thiếu biên bản bàn giao',
  ],
  recommendations: [
    'Bổ sung KHLCNT',
    'Thực hiện đăng tải DGCC',
    'Bổ sung biên bản nghiệm thu',
  ],
};

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── RP-01 · Full risk panel — all 4 sections rendered ───────────────────────

describe('RP-01 · Full risk panel — all 4 sections rendered', () => {
  it('RP-01-01: risk-level and risk-score sections are present', () => {
    const html = renderToString(<RiskPanel {...FULL_RISK} />);
    expect(html).toContain('data-section="risk-level"');
    expect(html).toContain('data-section="risk-score"');
  });

  it('RP-01-02: recommendations and warnings sections are present', () => {
    const html = renderToString(<RiskPanel {...FULL_RISK} />);
    expect(html).toContain('data-section="recommendations"');
    expect(html).toContain('data-section="warnings"');
  });

  it('RP-01-03: panel root has data-panel="risk"', () => {
    const html = renderToString(<RiskPanel {...FULL_RISK} />);
    expect(html).toContain('data-panel="risk"');
  });
});

// ─── RP-02 · Empty metadata returns null ─────────────────────────────────────

describe('RP-02 · Empty metadata returns null', () => {
  it('RP-02-01: no props at all renders empty string', () => {
    const html = renderToString(<RiskPanel />);
    expect(html).toBe('');
  });

  it('RP-02-02: all-empty arrays with no scalars renders empty string', () => {
    const html = renderToString(
      <RiskPanel warnings={[]} recommendations={[]} />,
    );
    expect(html).toBe('');
  });

  it('RP-02-03: data-panel="risk" absent when no metadata', () => {
    const html = renderToString(<RiskPanel />);
    expect(html).not.toContain('data-panel="risk"');
  });
});

// ─── RP-03 · Risk level badge — colors and attributes ────────────────────────

describe('RP-03 · Risk level badge — colors and attributes', () => {
  it('RP-03-01: CRITICAL → data-risk-color="red", HIGH → data-risk-color="orange"', () => {
    const htmlCrit = renderToString(<RiskPanel riskLevel="CRITICAL" />);
    const htmlHigh = renderToString(<RiskPanel riskLevel="HIGH" />);
    expect(htmlCrit).toContain('data-risk-color="red"');
    expect(htmlHigh).toContain('data-risk-color="orange"');
  });

  it('RP-03-02: MEDIUM → data-risk-color="yellow", LOW → data-risk-color="green"', () => {
    const htmlMed = renderToString(<RiskPanel riskLevel="MEDIUM" />);
    const htmlLow = renderToString(<RiskPanel riskLevel="LOW" />);
    expect(htmlMed).toContain('data-risk-color="yellow"');
    expect(htmlLow).toContain('data-risk-color="green"');
  });

  it('RP-03-03: data-risk-level attribute and badge text match the level', () => {
    const html = renderToString(<RiskPanel riskLevel="HIGH" />);
    expect(html).toContain('data-risk-level="HIGH"');
    expect(html).toContain('data-field="risk-level"');
    // level text rendered inside the badge span
    expect(html).toContain('>HIGH<');
  });
});

// ─── RP-04 · Risk score rendering ────────────────────────────────────────────

describe('RP-04 · Risk score rendering', () => {
  it('RP-04-01: score value is rendered inside the score span', () => {
    const html = renderToString(<RiskPanel riskScore={42} />);
    expect(html).toContain('data-field="risk-score"');
    expect(html).toContain('>42<');
  });

  it('RP-04-02: data-score attribute carries the numeric value', () => {
    const html = renderToString(<RiskPanel riskScore={55} />);
    expect(html).toContain('data-score="55"');
  });

  it('RP-04-03: risk-score section collapses when riskScore is absent', () => {
    const html = renderToString(<RiskPanel riskLevel="LOW" />);
    expect(html).not.toContain('data-section="risk-score"');
    expect(html).toContain('data-panel="risk"');
  });
});

// ─── RP-05 · Recommendation rendering ────────────────────────────────────────

describe('RP-05 · Recommendation rendering', () => {
  it('RP-05-01: each recommendation string is rendered in a list item', () => {
    const html = renderToString(
      <RiskPanel recommendations={['Bổ sung KHLCNT', 'Thực hiện đăng tải DGCC']} />,
    );
    expect(html).toContain('Bổ sung KHLCNT');
    expect(html).toContain('Thực hiện đăng tải DGCC');
  });

  it('RP-05-02: items carry data-field="recommendation"', () => {
    const html  = renderToString(
      <RiskPanel recommendations={['A', 'B', 'C']} />,
    );
    const count = (html.match(/data-field="recommendation"/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('RP-05-03: recommendations section collapses when array is empty', () => {
    const html = renderToString(<RiskPanel riskLevel="LOW" recommendations={[]} />);
    expect(html).not.toContain('data-section="recommendations"');
    expect(html).toContain('data-panel="risk"');
  });
});

// ─── RP-06 · Warning rendering with severity ─────────────────────────────────

describe('RP-06 · Warning rendering with severity', () => {
  it('RP-06-01: warning body text rendered without the [LEVEL] prefix', () => {
    const html = renderToString(
      <RiskPanel warnings={['[HIGH] Thiếu biên bản nghiệm thu']} />,
    );
    expect(html).toContain('Thiếu biên bản nghiệm thu');
    expect(html).not.toContain('[HIGH]');
  });

  it('RP-06-02: severity level rendered as separate warning-level field', () => {
    const html = renderToString(
      <RiskPanel warnings={['[MEDIUM] Thiếu bàn giao']} />,
    );
    expect(html).toContain('data-field="warning-level"');
    expect(html).toContain('data-field="warning-body"');
    expect(html).toContain('data-warning-severity="MEDIUM"');
  });

  it('RP-06-03: warnings section collapses when array is empty', () => {
    const html = renderToString(<RiskPanel riskLevel="LOW" warnings={[]} />);
    expect(html).not.toContain('data-section="warnings"');
    expect(html).toContain('data-panel="risk"');
  });
});

// ─── RP-07 · Snapshot and section collapse ───────────────────────────────────

describe('RP-07 · Snapshot and section collapse', () => {
  it('RP-07-01: full risk panel render matches snapshot', () => {
    const html = renderToString(<RiskPanel {...FULL_RISK} />);
    expect(html).toMatchSnapshot();
  });

  it('RP-07-02: risk-level section collapses when riskLevel absent', () => {
    const html = renderToString(<RiskPanel riskScore={10} />);
    expect(html).not.toContain('data-section="risk-level"');
    expect(html).toContain('data-section="risk-score"');
  });

  it('RP-07-03: panel with only riskScore renders exactly one section', () => {
    const html  = renderToString(<RiskPanel riskScore={0} />);
    const count = (html.match(/data-section="/g) ?? []).length;
    expect(count).toBe(1);
  });
});

// ─── RP-08 · Backward compatibility ──────────────────────────────────────────

describe('RP-08 · Backward compatibility', () => {
  it('RP-08-01: AgentOutputPanel without legalRisk renders no risk panel', () => {
    const planner = makeAgent('planner',        'Planner Agent');
    const spec    = makeAgent('specification',   'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk',           'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec    as never}
        legal={legal  as never}
        risk={risk    as never}
      />,
    );

    expect(html).toContain('data-panel="agent-output"');
    expect(html).not.toContain('data-panel="risk"');
  });

  it('RP-08-02: RiskPanel renders below ChecklistPanel inside AgentOutputPanel', () => {
    const planner = makeAgent('planner',        'Planner Agent');
    const spec    = makeAgent('specification',   'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk',           'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner    as never}
        spec={spec          as never}
        legal={legal        as never}
        risk={risk          as never}
        legalChecklist={{ completionScore: 75 }}
        legalRisk={{ riskLevel: 'LOW' }}
      />,
    );

    const checklistPos = html.indexOf('data-panel="checklist"');
    const riskPos      = html.indexOf('data-panel="risk"');
    expect(checklistPos).toBeGreaterThan(-1);
    expect(riskPos).toBeGreaterThan(-1);
    expect(checklistPos).toBeLessThan(riskPos);
  });

  it('RP-08-03: Phase8DashboardPanel without legalRisk renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="risk"');
  });
});
