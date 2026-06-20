/**
 * Legal v2.7 — TimelinePanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   TL-01  (3)  Full timeline — 5 present + 3 missing
 *   TL-02  (3)  Empty returns null
 *   TL-03  (3)  All stages present — no current-stage indicator
 *   TL-04  (3)  Missing final stage only
 *   TL-05  (3)  Missing middle stages
 *   TL-06  (3)  Current stage detection
 *   TL-07  (3)  Snapshot and stage count
 *   TL-08  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import TimelinePanel, { type TimelinePanelProps } from '../components/TimelinePanel';
import AgentOutputPanel    from '../components/AgentOutputPanel';
import Phase8DashboardPanel from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_PRESENT: Array<{ label: string; docType: string }> = [
  { label: 'Tờ trình',              docType: 'to-trinh' },
  { label: 'KHLCNT',                docType: 'khlcnt' },
  { label: 'HSYC',                  docType: 'hsyc' },
  { label: 'Quyết định phê duyệt',  docType: 'quyet-dinh-phe-duyet' },
  { label: 'Hợp đồng',              docType: 'hop-dong' },
  { label: 'Nghiệm thu',            docType: 'bien-ban-nghiem-thu' },
  { label: 'Bàn giao',              docType: 'bien-ban-ban-giao' },
  { label: 'Thanh lý',              docType: 'thanh-ly' },
];

function makeMissing(label: string, docType: string) {
  return { docType, label, mandatory: true, legalBasis: '' };
}

const FULL_TIMELINE_PROPS: TimelinePanelProps = {
  presentDocuments: ALL_PRESENT.slice(0, 5),
  missingDocuments: [
    makeMissing('Nghiệm thu', 'bien-ban-nghiem-thu'),
    makeMissing('Bàn giao',   'bien-ban-ban-giao'),
    makeMissing('Thanh lý',   'thanh-ly'),
  ],
};

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── TL-01 · Full timeline — 5 present + 3 missing ───────────────────────────

describe('TL-01 · Full timeline — 5 present + 3 missing', () => {
  it('TL-01-01: data-panel="timeline" is present', () => {
    const html = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    expect(html).toContain('data-panel="timeline"');
  });

  it('TL-01-02: exactly 5 stages have data-stage-status="present"', () => {
    const html  = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    const count = (html.match(/data-stage-status="present"/g) ?? []).length;
    expect(count).toBe(5);
  });

  it('TL-01-03: exactly 3 stages have data-stage-status="missing"', () => {
    const html  = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    const count = (html.match(/data-stage-status="missing"/g) ?? []).length;
    expect(count).toBe(3);
  });
});

// ─── TL-02 · Empty returns null ───────────────────────────────────────────────

describe('TL-02 · Empty returns null', () => {
  it('TL-02-01: no props at all renders empty string', () => {
    const html = renderToString(<TimelinePanel />);
    expect(html).toBe('');
  });

  it('TL-02-02: both arrays empty renders empty string', () => {
    const html = renderToString(
      <TimelinePanel presentDocuments={[]} missingDocuments={[]} />,
    );
    expect(html).toBe('');
  });

  it('TL-02-03: data-panel="timeline" absent when both arrays empty', () => {
    const html = renderToString(<TimelinePanel />);
    expect(html).not.toContain('data-panel="timeline"');
  });
});

// ─── TL-03 · All stages present — no current-stage indicator ─────────────────

describe('TL-03 · All stages present — no current-stage indicator', () => {
  it('TL-03-01: all 8 stages have data-stage-status="present"', () => {
    const html  = renderToString(
      <TimelinePanel presentDocuments={ALL_PRESENT} missingDocuments={[]} />,
    );
    const count = (html.match(/data-stage-status="present"/g) ?? []).length;
    expect(count).toBe(8);
  });

  it('TL-03-02: data-field="current-stage" is absent when no missing docs', () => {
    const html = renderToString(
      <TimelinePanel presentDocuments={ALL_PRESENT} missingDocuments={[]} />,
    );
    expect(html).not.toContain('data-field="current-stage"');
  });

  it('TL-03-03: no ⚠ icon appears in the rendered output', () => {
    const html = renderToString(
      <TimelinePanel presentDocuments={ALL_PRESENT} missingDocuments={[]} />,
    );
    expect(html).not.toContain('⚠');
  });
});

// ─── TL-04 · Missing final stage only ────────────────────────────────────────

describe('TL-04 · Missing final stage only', () => {
  const props: TimelinePanelProps = {
    presentDocuments: ALL_PRESENT.slice(0, 7),
    missingDocuments: [makeMissing('Thanh lý', 'thanh-ly')],
  };

  it('TL-04-01: stage "thanh-ly" has data-stage-status="missing"', () => {
    const html = renderToString(<TimelinePanel {...props} />);
    expect(html).toContain('data-stage-id="thanh-ly"');
    expect(html).toContain('data-stage-status="missing"');
  });

  it('TL-04-02: current-stage indicator points to "thanh-ly"', () => {
    const html = renderToString(<TimelinePanel {...props} />);
    expect(html).toContain('data-field="current-stage"');
    // current-stage section carries data-stage-id of the detected stage
    const currentPos  = html.indexOf('data-field="current-stage"');
    const afterCurrent = html.slice(currentPos, currentPos + 200);
    expect(afterCurrent).toContain('data-stage-id="thanh-ly"');
  });

  it('TL-04-03: exactly 7 stages have data-stage-status="present"', () => {
    const html  = renderToString(<TimelinePanel {...props} />);
    const count = (html.match(/data-stage-status="present"/g) ?? []).length;
    expect(count).toBe(7);
  });
});

// ─── TL-05 · Missing middle stages ───────────────────────────────────────────

describe('TL-05 · Missing middle stages', () => {
  const props: TimelinePanelProps = {
    presentDocuments: ALL_PRESENT.slice(0, 5),
    missingDocuments: [
      makeMissing('Nghiệm thu', 'bien-ban-nghiem-thu'),
      makeMissing('Bàn giao',   'bien-ban-ban-giao'),
      makeMissing('Thanh lý',   'thanh-ly'),
    ],
  };

  it('TL-05-01: exactly 5 stages have data-stage-status="present"', () => {
    const html  = renderToString(<TimelinePanel {...props} />);
    const count = (html.match(/data-stage-status="present"/g) ?? []).length;
    expect(count).toBe(5);
  });

  it('TL-05-02: exactly 3 stages have data-stage-status="missing"', () => {
    const html  = renderToString(<TimelinePanel {...props} />);
    const count = (html.match(/data-stage-status="missing"/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('TL-05-03: current stage is "bien-ban-nghiem-thu" (first missing in order)', () => {
    const html        = renderToString(<TimelinePanel {...props} />);
    const currentPos  = html.indexOf('data-field="current-stage"');
    expect(currentPos).toBeGreaterThan(-1);
    const afterCurrent = html.slice(currentPos, currentPos + 200);
    expect(afterCurrent).toContain('data-stage-id="bien-ban-nghiem-thu"');
  });
});

// ─── TL-06 · Current stage detection ─────────────────────────────────────────

describe('TL-06 · Current stage detection', () => {
  it('TL-06-01: when first missing is khlcnt, current-stage has data-stage-id="khlcnt"', () => {
    const html = renderToString(
      <TimelinePanel
        presentDocuments={[ALL_PRESENT[0]]}
        missingDocuments={[
          makeMissing('KHLCNT', 'khlcnt'),
          makeMissing('HSYC',   'hsyc'),
        ]}
      />,
    );
    const currentPos  = html.indexOf('data-field="current-stage"');
    expect(currentPos).toBeGreaterThan(-1);
    const afterCurrent = html.slice(currentPos, currentPos + 200);
    expect(afterCurrent).toContain('data-stage-id="khlcnt"');
  });

  it('TL-06-02: only the current stage has data-current-stage="true"', () => {
    const html  = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    const count = (html.match(/data-current-stage="true"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('TL-06-03: all other stages have data-current-stage="false"', () => {
    const html  = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    const count = (html.match(/data-current-stage="false"/g) ?? []).length;
    expect(count).toBe(7);
  });
});

// ─── TL-07 · Snapshot and stage count ────────────────────────────────────────

describe('TL-07 · Snapshot and stage count', () => {
  it('TL-07-01: full timeline render matches snapshot', () => {
    const html = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    expect(html).toMatchSnapshot();
  });

  it('TL-07-02: exactly 8 data-field="stage" elements are rendered', () => {
    const html  = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    const count = (html.match(/data-field="stage"/g) ?? []).length;
    expect(count).toBe(8);
  });

  it('TL-07-03: stage indices 0 through 7 are all present', () => {
    const html = renderToString(<TimelinePanel {...FULL_TIMELINE_PROPS} />);
    for (let i = 0; i < 8; i++) {
      expect(html).toContain(`data-stage-index="${i}"`);
    }
  });
});

// ─── TL-08 · Backward compatibility ──────────────────────────────────────────

describe('TL-08 · Backward compatibility', () => {
  it('TL-08-01: AgentOutputPanel without legalTimeline renders no timeline panel', () => {
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
      />,
    );

    expect(html).toContain('data-panel="agent-output"');
    expect(html).not.toContain('data-panel="timeline"');
  });

  it('TL-08-02: TimelinePanel renders below RecommendationPanel inside AgentOutputPanel', () => {
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
        legalRecommendations={{ recommendations: ['[LOW] Lưu hồ sơ đầy đủ'] }}
        legalTimeline={FULL_TIMELINE_PROPS}
      />,
    );

    const recPos      = html.indexOf('data-panel="recommendation"');
    const timelinePos = html.indexOf('data-panel="timeline"');
    expect(recPos).toBeGreaterThan(-1);
    expect(timelinePos).toBeGreaterThan(-1);
    expect(recPos).toBeLessThan(timelinePos);
  });

  it('TL-08-03: Phase8DashboardPanel without legalTimeline renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="timeline"');
  });
});
