/**
 * Legal v2.4 — ChecklistPanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   CL-01  (3)  Full checklist — all 4 sections rendered
 *   CL-02  (3)  Empty metadata returns null
 *   CL-03  (3)  Completion score rendering
 *   CL-04  (3)  Missing documents rendering
 *   CL-05  (3)  Warning rendering with severity
 *   CL-06  (3)  Snapshot and section collapse
 *   CL-07  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import ChecklistPanel, { type ChecklistPanelProps } from '../components/ChecklistPanel';
import AgentOutputPanel                             from '../components/AgentOutputPanel';
import Phase8DashboardPanel                         from '../components/Phase8DashboardPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMissing(label: string, docType: string) {
  return { docType, label, mandatory: true, legalBasis: '' };
}

const PRESENT_DOCS = [
  { label: 'Tờ trình',            docType: 'to-trinh' },
  { label: 'KHLCNT',              docType: 'khlcnt' },
  { label: 'HSYC',                docType: 'hsyc' },
  { label: 'Quyết định phê duyệt', docType: 'quyet-dinh-phe-duyet' },
];

const MISSING_DOCS = [
  makeMissing('Biên bản nghiệm thu', 'bien-ban-nghiem-thu'),
  makeMissing('Biên bản bàn giao',   'bien-ban-ban-giao'),
  makeMissing('Thanh lý hợp đồng',   'thanh-ly-hop-dong'),
];

const WARNINGS = [
  '[HIGH] Thiếu biên bản nghiệm thu',
  '[MEDIUM] Thiếu biên bản bàn giao',
];

const FULL_CHECKLIST: ChecklistPanelProps = {
  presentDocuments: PRESENT_DOCS,
  missingDocuments: MISSING_DOCS,
  warnings:         WARNINGS,
  completionScore:  57,
};

// Agent stub for backward compat tests
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// ─── CL-01 · Full checklist — all 4 sections rendered ────────────────────────

describe('CL-01 · Full checklist — all 4 sections rendered', () => {
  it('CL-01-01: completion score section is present', () => {
    const html = renderToString(<ChecklistPanel {...FULL_CHECKLIST} />);
    expect(html).toContain('data-section="completion"');
    expect(html).toContain('57%');
  });

  it('CL-01-02: present-documents and missing-documents sections are present', () => {
    const html = renderToString(<ChecklistPanel {...FULL_CHECKLIST} />);
    expect(html).toContain('data-section="present-documents"');
    expect(html).toContain('data-section="missing-documents"');
  });

  it('CL-01-03: warnings section is present and all 4 sections rendered', () => {
    const html = renderToString(<ChecklistPanel {...FULL_CHECKLIST} />);
    expect(html).toContain('data-section="warnings"');
    expect(html).toContain('data-panel="checklist"');
  });
});

// ─── CL-02 · Empty metadata returns null ─────────────────────────────────────

describe('CL-02 · Empty metadata returns null', () => {
  it('CL-02-01: no props at all renders empty string', () => {
    const html = renderToString(<ChecklistPanel />);
    expect(html).toBe('');
  });

  it('CL-02-02: all-empty arrays and no score renders empty string', () => {
    const html = renderToString(
      <ChecklistPanel
        presentDocuments={[]}
        missingDocuments={[]}
        warnings={[]}
      />,
    );
    expect(html).toBe('');
  });

  it('CL-02-03: data-panel="checklist" absent when no metadata', () => {
    const html = renderToString(<ChecklistPanel />);
    expect(html).not.toContain('data-panel="checklist"');
  });
});

// ─── CL-03 · Completion score rendering ──────────────────────────────────────

describe('CL-03 · Completion score rendering', () => {
  it('CL-03-01: score renders as percentage text', () => {
    const html = renderToString(<ChecklistPanel completionScore={75} />);
    expect(html).toContain('75%');
    expect(html).toContain('data-field="completion-score"');
  });

  it('CL-03-02: data-score attribute carries the numeric value', () => {
    const html = renderToString(<ChecklistPanel completionScore={42} />);
    expect(html).toContain('data-score="42"');
  });

  it('CL-03-03: completion section collapses when completionScore is absent', () => {
    const html = renderToString(
      <ChecklistPanel missingDocuments={[makeMissing('KHLCNT', 'khlcnt')]} />,
    );
    expect(html).not.toContain('data-section="completion"');
  });
});

// ─── CL-04 · Missing documents rendering ─────────────────────────────────────

describe('CL-04 · Missing documents rendering', () => {
  it('CL-04-01: missing document labels are rendered', () => {
    const html = renderToString(
      <ChecklistPanel missingDocuments={MISSING_DOCS} />,
    );
    expect(html).toContain('Biên bản nghiệm thu');
    expect(html).toContain('Biên bản bàn giao');
    expect(html).toContain('Thanh lý hợp đồng');
  });

  it('CL-04-02: ❌ icon is present for each missing document', () => {
    const html  = renderToString(<ChecklistPanel missingDocuments={MISSING_DOCS} />);
    const count = (html.match(/data-field="missing-icon"/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('CL-04-03: data-doc-type attribute is set on each missing doc item', () => {
    const html = renderToString(
      <ChecklistPanel missingDocuments={[makeMissing('KHLCNT', 'khlcnt')]} />,
    );
    expect(html).toContain('data-doc-type="khlcnt"');
    expect(html).toContain('data-field="missing-doc"');
  });
});

// ─── CL-05 · Warning rendering with severity ─────────────────────────────────

describe('CL-05 · Warning rendering with severity', () => {
  it('CL-05-01: warning body text is rendered without the [LEVEL] prefix', () => {
    const html = renderToString(
      <ChecklistPanel warnings={['[HIGH] Thiếu biên bản nghiệm thu']} />,
    );
    expect(html).toContain('Thiếu biên bản nghiệm thu');
    expect(html).not.toContain('[HIGH]');
  });

  it('CL-05-02: severity level is rendered as a separate field', () => {
    const html = renderToString(
      <ChecklistPanel warnings={['[MEDIUM] Thiếu biên bản bàn giao']} />,
    );
    expect(html).toContain('data-field="warning-level"');
    expect(html).toContain('data-field="warning-body"');
    expect(html).toContain('MEDIUM');
  });

  it('CL-05-03: data-warning-severity and data-risk-color attributes are set', () => {
    const htmlHigh = renderToString(
      <ChecklistPanel warnings={['[HIGH] Lỗi cao']} />,
    );
    const htmlLow  = renderToString(
      <ChecklistPanel warnings={['[LOW] Lỗi thấp']} />,
    );
    expect(htmlHigh).toContain('data-warning-severity="HIGH"');
    expect(htmlHigh).toContain('data-risk-color="orange"');
    expect(htmlLow).toContain('data-warning-severity="LOW"');
    expect(htmlLow).toContain('data-risk-color="green"');
  });
});

// ─── CL-06 · Snapshot and section collapse ───────────────────────────────────

describe('CL-06 · Snapshot and section collapse', () => {
  it('CL-06-01: full checklist render matches snapshot', () => {
    const html = renderToString(<ChecklistPanel {...FULL_CHECKLIST} />);
    expect(html).toMatchSnapshot();
  });

  it('CL-06-02: empty presentDocuments collapses present-documents section', () => {
    const html = renderToString(
      <ChecklistPanel presentDocuments={[]} completionScore={50} />,
    );
    expect(html).not.toContain('data-section="present-documents"');
    expect(html).toContain('data-section="completion"');
  });

  it('CL-06-03: empty warnings collapses warnings section', () => {
    const html = renderToString(
      <ChecklistPanel warnings={[]} completionScore={100} />,
    );
    expect(html).not.toContain('data-section="warnings"');
    expect(html).toContain('data-section="completion"');
  });
});

// ─── CL-07 · Backward compatibility ──────────────────────────────────────────

describe('CL-07 · Backward compatibility', () => {
  it('CL-07-01: AgentOutputPanel without legalChecklist renders no checklist panel', () => {
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
    expect(html).not.toContain('data-panel="checklist"');
  });

  it('CL-07-02: ChecklistPanel renders below TracePanel inside AgentOutputPanel', () => {
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
        legalTrace={{ riskLevel: 'LOW' }}
        legalChecklist={{ completionScore: 75 }}
      />,
    );

    const tracePos     = html.indexOf('data-panel="trace"');
    const checklistPos = html.indexOf('data-panel="checklist"');
    expect(tracePos).toBeGreaterThan(-1);
    expect(checklistPos).toBeGreaterThan(-1);
    expect(tracePos).toBeLessThan(checklistPos);
  });

  it('CL-07-03: Phase8DashboardPanel without legalChecklist renders without error', () => {
    const html = renderToString(<Phase8DashboardPanel />);
    expect(html).toContain('data-panel="phase8-dashboard"');
    expect(html).not.toContain('data-panel="checklist"');
  });
});
