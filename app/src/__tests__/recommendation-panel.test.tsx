/**
 * Legal v2.6 — RecommendationPanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   RC-01  (3)  Full panel — all 4 severity groups rendered
 *   RC-02  (3)  Empty metadata returns null
 *   RC-03  (3)  Critical group
 *   RC-04  (3)  High group
 *   RC-05  (3)  Medium group
 *   RC-06  (3)  Low group
 *   RC-07  (3)  Snapshot and groupRecommendations helper
 *   RC-08  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import RecommendationPanel, {
  groupRecommendations,
} from '../components/RecommendationPanel';
import AgentOutputPanel    from '../components/AgentOutputPanel';
import Phase8DashboardPanel from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CRITICAL_REC = '[CRITICAL] Bổ sung ngay KHLCNT — bắt buộc để tiếp tục quy trình';
const HIGH_REC_1   = '[HIGH] Đăng tải kế hoạch lựa chọn nhà thầu trên mạng đấu thầu';
const HIGH_REC_2   = '[HIGH] Bổ sung biên bản nghiệm thu';
const MEDIUM_REC   = '[MEDIUM] Bổ sung biên bản bàn giao tài sản';
const LOW_REC      = '[LOW] Thanh lý hợp đồng khi hết thời hạn';

const FULL_RECOMMENDATIONS = [CRITICAL_REC, HIGH_REC_1, HIGH_REC_2, MEDIUM_REC, LOW_REC];

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── RC-01 · Full panel — all 4 severity groups rendered ─────────────────────

describe('RC-01 · Full panel — all 4 severity groups rendered', () => {
  it('RC-01-01: all 4 section data-section attributes present', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={FULL_RECOMMENDATIONS} />,
    );
    expect(html).toContain('data-section="recommendations-critical"');
    expect(html).toContain('data-section="recommendations-high"');
    expect(html).toContain('data-section="recommendations-medium"');
    expect(html).toContain('data-section="recommendations-low"');
  });

  it('RC-01-02: panel root has data-panel="recommendation"', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={FULL_RECOMMENDATIONS} />,
    );
    expect(html).toContain('data-panel="recommendation"');
  });

  it('RC-01-03: CRITICAL section appears before LOW section in DOM', () => {
    const html     = renderToString(
      <RecommendationPanel recommendations={FULL_RECOMMENDATIONS} />,
    );
    const critPos  = html.indexOf('data-section="recommendations-critical"');
    const lowPos   = html.indexOf('data-section="recommendations-low"');
    expect(critPos).toBeGreaterThan(-1);
    expect(lowPos).toBeGreaterThan(-1);
    expect(critPos).toBeLessThan(lowPos);
  });
});

// ─── RC-02 · Empty metadata returns null ─────────────────────────────────────

describe('RC-02 · Empty metadata returns null', () => {
  it('RC-02-01: no props at all renders empty string', () => {
    const html = renderToString(<RecommendationPanel />);
    expect(html).toBe('');
  });

  it('RC-02-02: empty array renders empty string', () => {
    const html = renderToString(<RecommendationPanel recommendations={[]} />);
    expect(html).toBe('');
  });

  it('RC-02-03: data-panel="recommendation" absent when no recommendations', () => {
    const html = renderToString(<RecommendationPanel />);
    expect(html).not.toContain('data-panel="recommendation"');
  });
});

// ─── RC-03 · Critical group ───────────────────────────────────────────────────

describe('RC-03 · Critical group', () => {
  it('RC-03-01: CRITICAL recommendation body appears in critical section', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[CRITICAL_REC]} />,
    );
    expect(html).toContain('data-section="recommendations-critical"');
    expect(html).toContain('Bổ sung ngay KHLCNT');
  });

  it('RC-03-02: data-severity="CRITICAL" attribute is set on the section', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[CRITICAL_REC]} />,
    );
    expect(html).toContain('data-severity="CRITICAL"');
    expect(html).toContain('data-risk-color="red"');
  });

  it('RC-03-03: CRITICAL section collapses when no CRITICAL items present', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[HIGH_REC_1, LOW_REC]} />,
    );
    expect(html).not.toContain('data-section="recommendations-critical"');
    expect(html).toContain('data-section="recommendations-high"');
  });
});

// ─── RC-04 · High group ───────────────────────────────────────────────────────

describe('RC-04 · High group', () => {
  it('RC-04-01: HIGH recommendation body appears in high section', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[HIGH_REC_1]} />,
    );
    expect(html).toContain('data-section="recommendations-high"');
    expect(html).toContain('Đăng tải kế hoạch lựa chọn nhà thầu');
  });

  it('RC-04-02: multiple HIGH items are all rendered in the same section', () => {
    const html  = renderToString(
      <RecommendationPanel recommendations={[HIGH_REC_1, HIGH_REC_2]} />,
    );
    const count = (html.match(/data-recommendation-severity="HIGH"/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('RC-04-03: HIGH section collapses when no HIGH items present', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[CRITICAL_REC, LOW_REC]} />,
    );
    expect(html).not.toContain('data-section="recommendations-high"');
    expect(html).toContain('data-section="recommendations-critical"');
  });
});

// ─── RC-05 · Medium group ─────────────────────────────────────────────────────

describe('RC-05 · Medium group', () => {
  it('RC-05-01: MEDIUM recommendation body appears in medium section', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[MEDIUM_REC]} />,
    );
    expect(html).toContain('data-section="recommendations-medium"');
    expect(html).toContain('Bổ sung biên bản bàn giao tài sản');
  });

  it('RC-05-02: data-severity="MEDIUM" and data-risk-color="yellow" are set', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[MEDIUM_REC]} />,
    );
    expect(html).toContain('data-severity="MEDIUM"');
    expect(html).toContain('data-risk-color="yellow"');
  });

  it('RC-05-03: MEDIUM section collapses when no MEDIUM items present', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[HIGH_REC_1]} />,
    );
    expect(html).not.toContain('data-section="recommendations-medium"');
    expect(html).toContain('data-section="recommendations-high"');
  });
});

// ─── RC-06 · Low group ────────────────────────────────────────────────────────

describe('RC-06 · Low group', () => {
  it('RC-06-01: LOW recommendation body appears in low section', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[LOW_REC]} />,
    );
    expect(html).toContain('data-section="recommendations-low"');
    expect(html).toContain('Thanh lý hợp đồng khi hết thời hạn');
  });

  it('RC-06-02: strings without [LEVEL] prefix are placed in the LOW group', () => {
    const unprefixed = 'Lưu hồ sơ đầy đủ cho kiểm toán';
    const html = renderToString(
      <RecommendationPanel recommendations={[unprefixed]} />,
    );
    expect(html).toContain('data-section="recommendations-low"');
    expect(html).toContain('Lưu hồ sơ đầy đủ cho kiểm toán');
  });

  it('RC-06-03: LOW section collapses when no LOW or un-prefixed items present', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={[HIGH_REC_1, MEDIUM_REC]} />,
    );
    expect(html).not.toContain('data-section="recommendations-low"');
    expect(html).toContain('data-section="recommendations-high"');
  });
});

// ─── RC-07 · Snapshot and groupRecommendations helper ────────────────────────

describe('RC-07 · Snapshot and groupRecommendations helper', () => {
  it('RC-07-01: full panel render matches snapshot', () => {
    const html = renderToString(
      <RecommendationPanel recommendations={FULL_RECOMMENDATIONS} />,
    );
    expect(html).toMatchSnapshot();
  });

  it('RC-07-02: groupRecommendations assigns each string to correct severity bucket', () => {
    const groups = groupRecommendations(FULL_RECOMMENDATIONS);
    expect(groups.CRITICAL).toHaveLength(1);
    expect(groups.HIGH).toHaveLength(2);
    expect(groups.MEDIUM).toHaveLength(1);
    expect(groups.LOW).toHaveLength(1);
  });

  it('RC-07-03: groupRecommendations strips the [LEVEL] prefix from body text', () => {
    const groups = groupRecommendations([CRITICAL_REC, HIGH_REC_1]);
    expect(groups.CRITICAL[0]).not.toContain('[CRITICAL]');
    expect(groups.HIGH[0]).not.toContain('[HIGH]');
    expect(groups.CRITICAL[0]).toContain('Bổ sung ngay KHLCNT');
  });
});

// ─── RC-08 · Backward compatibility ──────────────────────────────────────────

describe('RC-08 · Backward compatibility', () => {
  it('RC-08-01: AgentOutputPanel without legalRecommendations renders no recommendation panel', () => {
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
    expect(html).not.toContain('data-panel="recommendation"');
  });

  it('RC-08-02: RecommendationPanel renders below RiskPanel inside AgentOutputPanel', () => {
    const planner = makeAgent('planner',        'Planner Agent');
    const spec    = makeAgent('specification',   'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk',           'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec       as never}
        legal={legal     as never}
        risk={risk       as never}
        legalRisk={{ riskLevel: 'HIGH', riskScore: 28 }}
        legalRecommendations={{ recommendations: [HIGH_REC_1] }}
      />,
    );

    const riskPos = html.indexOf('data-panel="risk"');
    const recPos  = html.indexOf('data-panel="recommendation"');
    expect(riskPos).toBeGreaterThan(-1);
    expect(recPos).toBeGreaterThan(-1);
    expect(riskPos).toBeLessThan(recPos);
  });

  it('RC-08-03: Phase8DashboardPanel without legalRecommendations renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="recommendation"');
  });
});
