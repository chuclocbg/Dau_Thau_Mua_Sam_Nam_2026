/**
 * Legal v2.1 — LegalSummaryPanel tests
 *
 * All rendering done via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   LP-01  (2)  Render applicableDocuments
 *   LP-02  (2)  Render missingDocuments
 *   LP-03  (3)  Render warnings — severity tags and colors
 *   LP-04  (2)  Render recommendations
 *   LP-05  (2)  Progress bar
 *   LP-06  (3)  Risk badge colors — CRITICAL/HIGH/MEDIUM/LOW
 *   LP-07  (3)  Empty arrays collapse sections
 *   LP-08  (2)  Undefined / no metadata → renders nothing
 *   LP-09  (1)  Backward compatibility — AgentOutputPanel still renders agents
 *   LP-10  (1)  Snapshot
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import LegalSummaryPanel, {
  type LegalSummaryPanelProps,
} from '../components/LegalSummaryPanel';
import AgentOutputPanel         from '../components/AgentOutputPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function render(el: React.ReactElement): string {
  return renderToString(el);
}

// Minimal ApplicableDocument shape (fields used by the panel).
function makeDoc(title: string) {
  return { title, sourceFile: 'test.md', effectiveDate: '2025-01-01', relevanceTags: [] };
}

// Minimal RequiredDocument shape.
function makeMissing(label: string, docType: string) {
  return { docType, label, mandatory: true, legalBasis: '' };
}

// Agent stub for AgentOutputPanel backward compat test.
function makeAgent(id: string, name: string) {
  return { id, name, getCapabilities: () => [], process: async () => ({}) };
}

// Full props fixture for snapshot.
const FULL_PROPS: LegalSummaryPanelProps = {
  applicableDocuments: [
    makeDoc('Luật Đấu thầu số 22/2023/QH15'),
    makeDoc('Nghị định 214/2025/NĐ-CP'),
  ],
  missingDocuments: [
    makeMissing('Kế hoạch lựa chọn nhà thầu', 'khlcnt'),
    makeMissing('Biên bản nghiệm thu', 'bien-ban-nghiem-thu'),
  ],
  warnings:         [
    '[CRITICAL] Thiếu "Kế hoạch lựa chọn nhà thầu" — bắt buộc',
    '[HIGH] Đấu thầu rộng rãi yêu cầu đăng tải trên hệ thống mạng đấu thầu',
    '[MEDIUM] Nguồn ngân sách nhà nước yêu cầu dự toán được phê duyệt',
  ],
  completionScore:  50,
  riskLevel:        'HIGH',
  riskScore:        28,
  recommendations:  [
    'Ưu tiên bổ sung "Kế hoạch lựa chọn nhà thầu" để giảm rủi ro kiểm toán',
    'Kiểm tra đăng tải trên Hệ thống mạng đấu thầu quốc gia',
  ],
};

// ─── LP-01 · Render applicableDocuments ──────────────────────────────────────

describe('LP-01 · Render applicableDocuments', () => {
  it('LP-01-01: renders each document title in a list item', () => {
    const html = render(
      <LegalSummaryPanel
        applicableDocuments={[
          makeDoc('Luật Đấu thầu số 22/2023/QH15'),
          makeDoc('Nghị định 214/2025/NĐ-CP'),
        ]}
      />,
    );
    expect(html).toContain('Luật Đấu thầu số 22/2023/QH15');
    expect(html).toContain('Nghị định 214/2025/NĐ-CP');
  });

  it('LP-01-02: applicable-documents section has data-section attribute', () => {
    const html = render(
      <LegalSummaryPanel applicableDocuments={[makeDoc('Thông tư 79/2025/TT-BTC')]} />,
    );
    expect(html).toContain('data-section="applicable-documents"');
    expect(html).toContain('data-field="applicable-doc"');
  });
});

// ─── LP-02 · Render missingDocuments ─────────────────────────────────────────

describe('LP-02 · Render missingDocuments', () => {
  it('LP-02-01: renders Vietnamese label for each missing document', () => {
    const html = render(
      <LegalSummaryPanel
        missingDocuments={[
          makeMissing('Kế hoạch lựa chọn nhà thầu', 'khlcnt'),
          makeMissing('Biên bản nghiệm thu', 'bien-ban-nghiem-thu'),
        ]}
      />,
    );
    expect(html).toContain('Kế hoạch lựa chọn nhà thầu');
    expect(html).toContain('Biên bản nghiệm thu');
  });

  it('LP-02-02: missing-doc items carry data-doc-type attribute', () => {
    const html = render(
      <LegalSummaryPanel
        missingDocuments={[makeMissing('Biên bản bàn giao', 'bien-ban-ban-giao')]}
      />,
    );
    expect(html).toContain('data-doc-type="bien-ban-ban-giao"');
    expect(html).toContain('data-section="missing-documents"');
  });
});

// ─── LP-03 · Render warnings ─────────────────────────────────────────────────

describe('LP-03 · Render warnings', () => {
  it('LP-03-01: renders warning text content', () => {
    const html = render(
      <LegalSummaryPanel
        warnings={['[CRITICAL] Thiếu tờ trình — bắt buộc trước khi lập hợp đồng']}
      />,
    );
    expect(html).toContain('Thiếu tờ trình');
    expect(html).toContain('data-section="warnings"');
  });

  it('LP-03-02: severity tags are rendered as [CRITICAL]/[HIGH]/[MEDIUM]/[LOW]', () => {
    const html = render(
      <LegalSummaryPanel
        warnings={[
          '[CRITICAL] Lỗi nghiêm trọng',
          '[HIGH] Lỗi cao',
          '[MEDIUM] Lỗi trung bình',
          '[LOW] Lỗi thấp',
        ]}
      />,
    );
    expect(html).toContain('[CRITICAL]');
    expect(html).toContain('[HIGH]');
    expect(html).toContain('[MEDIUM]');
    expect(html).toContain('[LOW]');
  });

  it('LP-03-03: data-warning-severity attribute reflects parsed level', () => {
    const html = render(
      <LegalSummaryPanel warnings={['[HIGH] Đấu thầu rộng rãi yêu cầu đăng tải']} />,
    );
    expect(html).toContain('data-warning-severity="HIGH"');
    expect(html).toContain('data-field="severity-tag"');
  });
});

// ─── LP-04 · Render recommendations ──────────────────────────────────────────

describe('LP-04 · Render recommendations', () => {
  it('LP-04-01: renders each recommendation in a bullet list item', () => {
    const html = render(
      <LegalSummaryPanel
        recommendations={[
          'Bổ sung ngay "Quyết định phê duyệt"',
          'Kiểm tra đăng tải trên mạng đấu thầu quốc gia',
        ]}
      />,
    );
    expect(html).toContain('Bổ sung ngay');
    expect(html).toContain('Kiểm tra đăng tải');
    expect(html).toContain('data-field="recommendation"');
  });

  it('LP-04-02: recommendations section has data-section attribute', () => {
    const html = render(
      <LegalSummaryPanel recommendations={['Ưu tiên bổ sung hồ sơ']} />,
    );
    expect(html).toContain('data-section="recommendations"');
    expect(html).toContain('data-field="recommendations-list"');
  });
});

// ─── LP-05 · Progress bar ────────────────────────────────────────────────────

describe('LP-05 · Progress bar', () => {
  it('LP-05-01: progress bar renders with correct data-score attribute', () => {
    const html = render(<LegalSummaryPanel completionScore={75} />);
    expect(html).toContain('data-score="75"');
    expect(html).toContain('data-field="completion-bar"');
  });

  it('LP-05-02: completion score percentage text is present', () => {
    const html = render(<LegalSummaryPanel completionScore={50} />);
    expect(html).toContain('data-field="completion-score"');
    expect(html).toContain('50%');
    expect(html).toContain('data-section="completion"');
  });
});

// ─── LP-06 · Risk badge colors ───────────────────────────────────────────────

describe('LP-06 · Risk badge colors', () => {
  it('LP-06-01: CRITICAL level gets data-risk-color="red"', () => {
    const html = render(<LegalSummaryPanel riskLevel="CRITICAL" riskScore={45} />);
    expect(html).toContain('data-risk-level="CRITICAL"');
    expect(html).toContain('data-risk-color="red"');
  });

  it('LP-06-02: HIGH level gets data-risk-color="orange"', () => {
    const html = render(<LegalSummaryPanel riskLevel="HIGH" riskScore={28} />);
    expect(html).toContain('data-risk-level="HIGH"');
    expect(html).toContain('data-risk-color="orange"');
  });

  it('LP-06-03: MEDIUM and LOW get correct colors', () => {
    const htmlMed = render(<LegalSummaryPanel riskLevel="MEDIUM" riskScore={15} />);
    const htmlLow = render(<LegalSummaryPanel riskLevel="LOW"    riskScore={3}  />);
    expect(htmlMed).toContain('data-risk-color="yellow"');
    expect(htmlLow).toContain('data-risk-color="green"');
  });
});

// ─── LP-07 · Empty arrays collapse sections ───────────────────────────────────

describe('LP-07 · Empty arrays collapse sections', () => {
  it('LP-07-01: empty applicableDocuments hides the section', () => {
    const html = render(
      <LegalSummaryPanel applicableDocuments={[]} riskLevel="LOW" riskScore={0} />,
    );
    expect(html).not.toContain('data-section="applicable-documents"');
  });

  it('LP-07-02: empty missingDocuments hides the section', () => {
    const html = render(
      <LegalSummaryPanel missingDocuments={[]} riskLevel="LOW" riskScore={0} />,
    );
    expect(html).not.toContain('data-section="missing-documents"');
  });

  it('LP-07-03: empty warnings hides the warnings section', () => {
    const html = render(
      <LegalSummaryPanel warnings={[]} riskLevel="LOW" riskScore={0} />,
    );
    expect(html).not.toContain('data-section="warnings"');
  });
});

// ─── LP-08 · Undefined metadata returns null ─────────────────────────────────

describe('LP-08 · Undefined metadata returns null', () => {
  it('LP-08-01: no props at all renders empty string (null component)', () => {
    const html = render(<LegalSummaryPanel />);
    expect(html).toBe('');
  });

  it('LP-08-02: all-empty arrays and no scalars renders empty string', () => {
    const html = render(
      <LegalSummaryPanel
        applicableDocuments={[]}
        missingDocuments={[]}
        warnings={[]}
        recommendations={[]}
      />,
    );
    expect(html).toBe('');
  });
});

// ─── LP-09 · Backward compatibility ──────────────────────────────────────────

describe('LP-09 · Backward compatibility', () => {
  it('LP-09-01: AgentOutputPanel renders 4 agents without legalSummary prop', () => {
    const planner  = makeAgent('planner', 'Planner Agent');
    const spec     = makeAgent('specification', 'Specification Agent');
    const legal    = makeAgent('legal-reviewer', 'Legal Reviewer Agent');
    const risk     = makeAgent('risk', 'Risk Agent');

    const html = render(
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
    expect(html).not.toContain('data-panel="legal-summary"');
  });
});

// ─── LP-10 · Snapshot ────────────────────────────────────────────────────────

describe('LP-10 · Snapshot', () => {
  it('LP-10-01: full props render matches snapshot', () => {
    const html = render(<LegalSummaryPanel {...FULL_PROPS} />);
    expect(html).toMatchSnapshot();
  });
});
