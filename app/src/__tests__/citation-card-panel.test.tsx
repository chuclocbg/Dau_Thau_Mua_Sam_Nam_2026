/**
 * Legal v2.2 — CitationCardPanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   CC-01  (3)  Group by document name
 *   CC-02  (3)  Duplicate citations removed
 *   CC-03  (3)  Empty / undefined returns null
 *   CC-04  (3)  Multiple documents grouped correctly
 *   CC-05  (3)  Single citation
 *   CC-06  (3)  Render structure and snapshot
 *   CC-07  (3)  Backward compatibility
 */

import { describe, it, expect }   from 'vitest';
import { renderToString }         from 'react-dom/server';
import React                      from 'react';

import CitationCardPanel, { groupCitations } from '../components/CitationCardPanel';
import AgentOutputPanel                      from '../components/AgentOutputPanel';
import Phase8DashboardPanel                  from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LUAT_1   = 'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt kế hoạch';
const LUAT_2   = 'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh';
const LUAT_3   = 'Điều 62 Luật Đấu thầu 22/2023/QH15 — loại hợp đồng';
const ND_1     = 'Điều 81 Nghị định 214/2025/NĐ-CP — khoảng cách thời gian tối thiểu';
const ND_2     = 'Nghị định 214/2025/NĐ-CP Điều 24 — ngưỡng và phương thức lựa chọn';
const TT_1     = 'Thông tư 79/2025/TT-BTC Điều 5 — chứng từ thanh toán';

const SNAPSHOT_CITATIONS = [LUAT_1, ND_1, LUAT_2];

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── CC-01 · Group by document name ──────────────────────────────────────────

describe('CC-01 · Group by document name', () => {
  it('CC-01-01: Luật citation appears under the Luật group', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1]} />);
    expect(html).toContain('Luật Đấu thầu 22/2023/QH15');
    expect(html).toContain('data-field="citation-group"');
  });

  it('CC-01-02: Nghị định citation is grouped separately from Luật', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, ND_1]} />);
    expect(html).toContain('data-doc-name="Luật Đấu thầu 22/2023/QH15"');
    expect(html).toContain('data-doc-name="Nghị định 214/2025/NĐ-CP"');
  });

  it('CC-01-03: article reference is extracted without the description suffix', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1]} />);
    // Article "Điều 38-41" should appear; the description should not
    expect(html).toContain('Điều 38-41');
    expect(html).not.toContain('lập và phê duyệt kế hoạch');
  });
});

// ─── CC-02 · Duplicate citations removed ─────────────────────────────────────

describe('CC-02 · Duplicate citations removed', () => {
  it('CC-02-01: exact duplicate renders each article only once', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, LUAT_1]} />);
    // "Điều 38-41" should appear exactly once as a list item
    const count = (html.match(/data-field="article"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('CC-02-02: groupCitations deduplicates before grouping', () => {
    const groups = groupCitations([LUAT_1, LUAT_1, ND_1, ND_1]);
    expect(groups.get('Luật Đấu thầu 22/2023/QH15')).toHaveLength(1);
    expect(groups.get('Nghị định 214/2025/NĐ-CP')).toHaveLength(1);
  });

  it('CC-02-03: different articles for the same doc are both kept', () => {
    const groups = groupCitations([LUAT_1, LUAT_2]);
    const articles = groups.get('Luật Đấu thầu 22/2023/QH15') ?? [];
    expect(articles).toHaveLength(2);
  });
});

// ─── CC-03 · Empty / undefined returns null ───────────────────────────────────

describe('CC-03 · Empty / undefined returns null', () => {
  it('CC-03-01: empty array renders nothing', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[]} />);
    expect(html).toBe('');
  });

  it('CC-03-02: no prop (undefined) renders nothing', () => {
    const html = renderToString(<CitationCardPanel />);
    expect(html).toBe('');
  });

  it('CC-03-03: data-panel="citation-card" is absent when array is empty', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[]} />);
    expect(html).not.toContain('data-panel="citation-card"');
  });
});

// ─── CC-04 · Multiple documents grouped correctly ────────────────────────────

describe('CC-04 · Multiple documents grouped correctly', () => {
  it('CC-04-01: two docs produce two citation-group elements', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, ND_1]} />);
    const count = (html.match(/data-field="citation-group"/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('CC-04-02: three distinct docs all appear as groups', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, ND_1, TT_1]} />);
    const count = (html.match(/data-field="citation-group"/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('CC-04-03: each citation-group carries correct data-doc-name attribute', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, ND_1, TT_1]} />);
    expect(html).toContain('data-doc-name="Luật Đấu thầu 22/2023/QH15"');
    expect(html).toContain('data-doc-name="Nghị định 214/2025/NĐ-CP"');
    expect(html).toContain('data-doc-name="Thông tư 79/2025/TT-BTC"');
  });
});

// ─── CC-05 · Single citation ─────────────────────────────────────────────────

describe('CC-05 · Single citation', () => {
  it('CC-05-01: one citation produces exactly one citation-group', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[ND_1]} />);
    const count = (html.match(/data-field="citation-group"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('CC-05-02: article text from the single citation is rendered', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[ND_1]} />);
    expect(html).toContain('Điều 81');
  });

  it('CC-05-03: panel root has data-panel="citation-card" when non-empty', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_3]} />);
    expect(html).toContain('data-panel="citation-card"');
  });
});

// ─── CC-06 · Render structure and snapshot ───────────────────────────────────

describe('CC-06 · Render structure and snapshot', () => {
  it('CC-06-01: panel title "Trích dẫn pháp lý" is rendered', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1]} />);
    expect(html).toContain('Trích dẫn pháp lý');
    expect(html).toContain('data-field="title"');
  });

  it('CC-06-02: article list items carry data-field="article"', () => {
    const html = renderToString(<CitationCardPanel legalBasis={[LUAT_1, LUAT_2]} />);
    const count = (html.match(/data-field="article"/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('CC-06-03: snapshot of multi-doc render matches', () => {
    const html = renderToString(<CitationCardPanel legalBasis={SNAPSHOT_CITATIONS} />);
    expect(html).toMatchSnapshot();
  });
});

// ─── CC-07 · Backward compatibility ──────────────────────────────────────────

describe('CC-07 · Backward compatibility', () => {
  it('CC-07-01: AgentOutputPanel without citations prop still renders 4 agents', () => {
    const planner = makeAgent('planner', 'Planner Agent');
    const spec    = makeAgent('specification', 'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk', 'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec as never}
        legal={legal as never}
        risk={risk as never}
      />,
    );

    expect(html).toContain('data-panel="agent-output"');
    expect(html).toContain('Planner Agent');
    expect(html).toContain('Legal Reviewer Agent');
    expect(html).not.toContain('data-panel="citation-card"');
  });

  it('CC-07-02: AgentOutputPanel with citations=[] has no citation panel in output', () => {
    const planner = makeAgent('planner', 'Planner Agent');
    const spec    = makeAgent('specification', 'Specification Agent');
    const legal   = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk    = makeAgent('risk', 'Risk Agent');

    const html = renderToString(
      <AgentOutputPanel
        planner={planner as never}
        spec={spec as never}
        legal={legal as never}
        risk={risk as never}
        citations={[]}
      />,
    );

    expect(html).not.toContain('data-panel="citation-card"');
  });

  it('CC-07-03: Phase8DashboardPanel without legalCitations prop renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).toContain('data-section-fallback="agent-output"');
  });
});
