/**
 * Legal v2.3 — TracePanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   TP-01  (3)  Full trace — all 7 stages present
 *   TP-02  (3)  Empty metadata returns null
 *   TP-03  (3)  Stage order — DOM order matches pipeline order
 *   TP-04  (3)  Stage attributes — data-* attributes present and correct
 *   TP-05  (3)  Panel structure — title, root attr, stage-list
 *   TP-06  (3)  Different metadata triggers — any single field activates trace
 *   TP-07  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import TracePanel, { type TracePanelProps } from '../components/TracePanel';
import AgentOutputPanel                     from '../components/AgentOutputPanel';
import Phase8DashboardPanel                 from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_TRACE: TracePanelProps = { riskLevel: 'LOW' };

const FULL_TRACE: TracePanelProps = {
  applicableDocuments: [{ title: 'Luật Đấu thầu số 22/2023/QH15' }],
  missingDocuments:    [],
  warnings:            ['[LOW] Kiểm tra định kỳ'],
  completionScore:     100,
  riskLevel:           'LOW',
  riskScore:           3,
  recommendations:     ['Lưu hồ sơ đầy đủ'],
};

// Vietnamese stage labels in pipeline order
const STAGE_LABELS = [
  'Tra cứu văn bản',
  'Trích dẫn điều khoản',
  'Xác định văn bản áp dụng',
  'Phân tích hồ sơ',
  'Kiểm tra tài liệu',
  'Đánh giá rủi ro',
  'Sinh kết quả',
];

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── TP-01 · Full trace — all 7 stages present ───────────────────────────────

describe('TP-01 · Full trace — all 7 stages present', () => {
  it('TP-01-01: exactly 7 stage elements are rendered', () => {
    const html = renderToString(<TracePanel {...FULL_TRACE} />);
    const count = (html.match(/data-field="stage"/g) ?? []).length;
    expect(count).toBe(7);
  });

  it('TP-01-02: all 7 stages carry status="success"', () => {
    const html = renderToString(<TracePanel {...FULL_TRACE} />);
    const count = (html.match(/data-stage-status="success"/g) ?? []).length;
    expect(count).toBe(7);
  });

  it('TP-01-03: all 7 Vietnamese stage labels are rendered', () => {
    const html = renderToString(<TracePanel {...FULL_TRACE} />);
    for (const label of STAGE_LABELS) {
      expect(html).toContain(label);
    }
  });
});

// ─── TP-02 · Empty metadata returns null ─────────────────────────────────────

describe('TP-02 · Empty metadata returns null', () => {
  it('TP-02-01: no props at all renders empty string', () => {
    const html = renderToString(<TracePanel />);
    expect(html).toBe('');
  });

  it('TP-02-02: all-empty arrays and no scalars renders empty string', () => {
    const html = renderToString(
      <TracePanel
        applicableDocuments={[]}
        missingDocuments={[]}
        warnings={[]}
        recommendations={[]}
      />,
    );
    expect(html).toBe('');
  });

  it('TP-02-03: data-panel="trace" is absent when no metadata', () => {
    const html = renderToString(<TracePanel />);
    expect(html).not.toContain('data-panel="trace"');
  });
});

// ─── TP-03 · Stage order — DOM order matches pipeline order ──────────────────

describe('TP-03 · Stage order — DOM order matches pipeline order', () => {
  it('TP-03-01: each stage index appears before the next in DOM order', () => {
    const html = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    const pos  = (idx: number) => html.indexOf(`data-stage-index="${idx}"`);
    for (let i = 0; i < 6; i++) {
      expect(pos(i)).toBeLessThan(pos(i + 1));
    }
  });

  it('TP-03-02: first stage label appears before last stage label in DOM', () => {
    const html   = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    const first  = html.indexOf('Tra cứu văn bản');
    const last   = html.indexOf('Sinh kết quả');
    expect(first).toBeGreaterThan(-1);
    expect(last).toBeGreaterThan(-1);
    expect(first).toBeLessThan(last);
  });

  it('TP-03-03: 6 arrow separators are present between the 7 stages', () => {
    const html  = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    const count = (html.match(/data-field="stage-arrow"/g) ?? []).length;
    expect(count).toBe(6);
  });
});

// ─── TP-04 · Stage attributes ────────────────────────────────────────────────

describe('TP-04 · Stage attributes — data-* attributes present and correct', () => {
  it('TP-04-01: each stage carries data-stage-id attribute', () => {
    const html  = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    const count = (html.match(/data-stage-id="/g) ?? []).length;
    expect(count).toBe(7);
  });

  it('TP-04-02: stage index 0 is search-index and index 6 is final-answer', () => {
    const html = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    expect(html).toContain('data-stage-id="search-index"');
    expect(html).toContain('data-stage-id="final-answer"');
    const searchIdx   = html.indexOf('data-stage-id="search-index"');
    const finalIdx    = html.indexOf('data-stage-id="final-answer"');
    expect(searchIdx).toBeLessThan(finalIdx);
  });

  it('TP-04-03: stage-label and stage-status fields are present for each stage', () => {
    const html       = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    const labelCount  = (html.match(/data-field="stage-label"/g) ?? []).length;
    const statusCount = (html.match(/data-field="stage-status"/g) ?? []).length;
    expect(labelCount).toBe(7);
    expect(statusCount).toBe(7);
  });
});

// ─── TP-05 · Panel structure ─────────────────────────────────────────────────

describe('TP-05 · Panel structure — title, root attr, stage-list', () => {
  it('TP-05-01: root element has data-panel="trace"', () => {
    const html = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    expect(html).toContain('data-panel="trace"');
  });

  it('TP-05-02: panel title "Quy trình pháp lý" is rendered', () => {
    const html = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    expect(html).toContain('Quy trình pháp lý');
    expect(html).toContain('data-field="title"');
  });

  it('TP-05-03: stage container has data-field="stage-list"', () => {
    const html = renderToString(<TracePanel {...MINIMAL_TRACE} />);
    expect(html).toContain('data-field="stage-list"');
  });
});

// ─── TP-06 · Different metadata triggers ─────────────────────────────────────

describe('TP-06 · Any single metadata field activates trace', () => {
  it('TP-06-01: completionScore alone activates the panel', () => {
    const html = renderToString(<TracePanel completionScore={75} />);
    expect(html).toContain('data-panel="trace"');
  });

  it('TP-06-02: warnings alone activates the panel', () => {
    const html = renderToString(<TracePanel warnings={['[HIGH] Thiếu hồ sơ']} />);
    expect(html).toContain('data-panel="trace"');
  });

  it('TP-06-03: recommendations alone activates the panel', () => {
    const html = renderToString(<TracePanel recommendations={['Bổ sung hồ sơ']} />);
    expect(html).toContain('data-panel="trace"');
  });
});

// ─── TP-07 · Backward compatibility ──────────────────────────────────────────

describe('TP-07 · Backward compatibility', () => {
  it('TP-07-01: AgentOutputPanel without legalTrace prop renders no trace panel', () => {
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
    expect(html).not.toContain('data-panel="trace"');
  });

  it('TP-07-02: TracePanel renders below CitationCardPanel inside AgentOutputPanel', () => {
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
        citations={['Điều 38-41 Luật Đấu thầu 22/2023/QH15 — kế hoạch']}
        legalTrace={MINIMAL_TRACE}
      />,
    );

    const citationPos = html.indexOf('data-panel="citation-card"');
    const tracePos    = html.indexOf('data-panel="trace"');
    expect(citationPos).toBeGreaterThan(-1);
    expect(tracePos).toBeGreaterThan(-1);
    expect(citationPos).toBeLessThan(tracePos);
  });

  it('TP-07-03: Phase8DashboardPanel without legalTrace renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="trace"');
  });
});
