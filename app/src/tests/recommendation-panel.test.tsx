/**
 * Phase 10.2 — LegalRecommendationPanel tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   RP-01  (3)  Renders without throwing
 *   RP-02  (3)  Root container data-* attributes
 *   RP-03  (3)  LegalStatusBadge integration
 *   RP-04  (3)  LegalActionBadge integration
 *   RP-05  (3)  LegalCountBadge integration
 *   RP-06  (3)  Recommendations list structure
 *   RP-07  (3)  Recommendation message and labels
 *   RP-08  (3)  AuditRecord fields and panelFromResult helper
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';

import {
  LegalRecommendationPanel,
  panelFromResult,
  type LegalRecommendationPanelProps,
} from '../components/LegalRecommendationPanel';
import type { RecommendationResult, Recommendation, RecommendationCode } from '../agents/RecommendationEngine';
import type { AuditRecord }                                               from '../agents/AuditTrail';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function synRec(code: RecommendationCode, priority: number, labels: string[] = []): Recommendation {
  return {
    code,
    priority,
    message: `Message for ${code} (priority ${priority})`,
    labels,
  };
}

function synResult(opts: {
  primaryCode?:    RecommendationCode;
  hasActions?:     boolean;
  totalCount?:     number;
  targetDate?:     string;
  recommendations?: Recommendation[];
} = {}): RecommendationResult {
  const primaryCode = opts.primaryCode ?? 'PREPARE_ALL';
  const hasActions  = opts.hasActions  ?? primaryCode !== 'NO_ACTION';
  return {
    primaryCode,
    hasActions,
    totalCount:      opts.totalCount      ?? 10,
    targetDate:      opts.targetDate      ?? '2026-01-01',
    recommendations: opts.recommendations ?? [synRec(primaryCode, 1)],
  };
}

function synRecord(opts: {
  sequence?:            number;
  primaryCode?:         RecommendationCode;
  hasActions?:          boolean;
  totalCount?:          number;
  targetDate?:          string;
  recommendationCount?: number;
} = {}): AuditRecord {
  const primaryCode = opts.primaryCode ?? 'PREPARE_ALL';
  return {
    sequence:            opts.sequence            ?? 0,
    descriptor:          {},
    primaryCode,
    hasActions:          opts.hasActions          ?? primaryCode !== 'NO_ACTION',
    totalCount:          opts.totalCount          ?? 10,
    targetDate:          opts.targetDate          ?? '2026-01-01',
    recommendationCount: opts.recommendationCount ?? 1,
  };
}

// ── Full READY fixture ────────────────────────────────────────────────────────

const READY_RESULT = synResult({
  primaryCode: 'PREPARE_ALL',
  totalCount:  10,
  recommendations: [
    synRec('PREPARE_ALL',    1, ['KE_HOACH_LCNT.DOCX', 'HO_SO_YEU_CAU.DOCX']),
    synRec('FOCUS_REQUIRED', 2, ['KE_HOACH_LCNT.DOCX']),
  ],
});
const READY_RECORD = synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', totalCount: 10, recommendationCount: 2 });

// ── UNCHANGED fixture ─────────────────────────────────────────────────────────

const UNCHANGED_RESULT = synResult({
  primaryCode: 'NO_ACTION',
  hasActions:  false,
  totalCount:  0,
  targetDate:  '2025-07-01',
  recommendations: [synRec('NO_ACTION', 1)],
});
const UNCHANGED_RECORD = synRecord({ sequence: 1, primaryCode: 'NO_ACTION', hasActions: false, totalCount: 0, recommendationCount: 1 });

// ── NAMED_FOCUS fixture ───────────────────────────────────────────────────────

const NAMED_RESULT = synResult({
  primaryCode: 'NAMED_FOCUS',
  totalCount:  5,
  recommendations: [
    synRec('NAMED_FOCUS',    1, ['TO_TRINH_MUA_SAM.DOCX']),
    synRec('PREPARE_ALL',    2, ['TO_TRINH_MUA_SAM.DOCX', 'DU_TOAN_MUA_SAM.DOCX']),
  ],
});
const NAMED_RECORD = synRecord({ sequence: 2, primaryCode: 'NAMED_FOCUS', totalCount: 5, recommendationCount: 2 });

function render(props: LegalRecommendationPanelProps): string {
  return renderToString(<LegalRecommendationPanel {...props} />);
}

// ── RP-01 Renders without throwing ────────────────────────────────────────────

describe('RP-01 Renders without throwing', () => {
  it('RP-01-01 READY result renders without throwing', () => {
    expect(() => render({ result: READY_RESULT, record: READY_RECORD })).not.toThrow();
  });

  it('RP-01-02 UNCHANGED result renders without throwing', () => {
    expect(() => render({ result: UNCHANGED_RESULT, record: UNCHANGED_RECORD })).not.toThrow();
  });

  it('RP-01-03 NAMED_FOCUS result renders without throwing', () => {
    expect(() => render({ result: NAMED_RESULT, record: NAMED_RECORD })).not.toThrow();
  });
});

// ── RP-02 Root container data-* attributes ────────────────────────────────────

describe('RP-02 Root container data-* attributes', () => {
  it('RP-02-01 data-panel="legal-recommendation-panel" always present', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('data-panel="legal-recommendation-panel"');
  });

  it('RP-02-02 data-primary-code matches result.primaryCode', () => {
    const readyHtml     = render({ result: READY_RESULT,     record: READY_RECORD     });
    const unchangedHtml = render({ result: UNCHANGED_RESULT, record: UNCHANGED_RECORD });
    expect(readyHtml).toContain('data-primary-code="PREPARE_ALL"');
    expect(unchangedHtml).toContain('data-primary-code="NO_ACTION"');
  });

  it('RP-02-03 data-has-actions reflects result.hasActions', () => {
    const readyHtml     = render({ result: READY_RESULT,     record: READY_RECORD     });
    const unchangedHtml = render({ result: UNCHANGED_RESULT, record: UNCHANGED_RECORD });
    expect(readyHtml).toContain('data-has-actions="true"');
    expect(unchangedHtml).toContain('data-has-actions="false"');
  });
});

// ── RP-03 LegalStatusBadge integration ───────────────────────────────────────

describe('RP-03 LegalStatusBadge integration', () => {
  it('RP-03-01 data-badge="legal-status" present from LegalStatusBadge', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('data-badge="legal-status"');
  });

  it('RP-03-02 LegalStatusBadge data-code matches result.primaryCode', () => {
    const html = render({ result: NAMED_RESULT, record: NAMED_RECORD });
    expect(html).toContain('data-badge="legal-status"');
    expect(html).toContain('data-code="NAMED_FOCUS"');
  });

  it('RP-03-03 PREPARE_ALL badge renders "Chuẩn bị tài liệu" label', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('Chuẩn bị tài liệu');
  });
});

// ── RP-04 LegalActionBadge integration ───────────────────────────────────────

describe('RP-04 LegalActionBadge integration', () => {
  it('RP-04-01 data-badge="legal-action" present from LegalActionBadge', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('data-badge="legal-action"');
  });

  it('RP-04-02 hasActions=true renders "Cần thực hiện"', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('Cần thực hiện');
  });

  it('RP-04-03 hasActions=false renders "Không có hành động"', () => {
    expect(render({ result: UNCHANGED_RESULT, record: UNCHANGED_RECORD }))
      .toContain('Không có hành động');
  });
});

// ── RP-05 LegalCountBadge integration ────────────────────────────────────────

describe('RP-05 LegalCountBadge integration', () => {
  it('RP-05-01 data-badge="legal-count" present from LegalCountBadge', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('data-badge="legal-count"');
  });

  it('RP-05-02 totalCount=10 is rendered as "10"', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD })).toContain('10');
  });

  it('RP-05-03 totalCount=0 renders "0" for UNCHANGED result', () => {
    const html = render({ result: UNCHANGED_RESULT, record: UNCHANGED_RECORD });
    expect(html).toContain('data-badge="legal-count"');
    expect(html).toContain('0');
  });
});

// ── RP-06 Recommendations list structure ──────────────────────────────────────

describe('RP-06 Recommendations list structure', () => {
  it('RP-06-01 data-list="recommendations" present', () => {
    expect(render({ result: READY_RESULT, record: READY_RECORD }))
      .toContain('data-list="recommendations"');
  });

  it('RP-06-02 data-item="recommendation" count matches recommendations.length', () => {
    const html    = render({ result: READY_RESULT, record: READY_RECORD });
    const matches = html.match(/data-item="recommendation"/g);
    expect(matches).toHaveLength(READY_RESULT.recommendations.length);
  });

  it('RP-06-03 data-priority attribute present on each recommendation item', () => {
    const html = render({ result: READY_RESULT, record: READY_RECORD });
    expect(html).toContain('data-priority="1"');
    expect(html).toContain('data-priority="2"');
  });
});

// ── RP-07 Recommendation message and labels ───────────────────────────────────

describe('RP-07 Recommendation message and labels', () => {
  it('RP-07-01 data-field="message" present for each recommendation', () => {
    const html    = render({ result: READY_RESULT, record: READY_RECORD });
    const matches = html.match(/data-field="message"/g);
    expect(matches).toHaveLength(READY_RESULT.recommendations.length);
  });

  it('RP-07-02 non-empty labels render data-field="labels" with comma-joined text', () => {
    const html = render({ result: READY_RESULT, record: READY_RECORD });
    expect(html).toContain('data-field="labels"');
    expect(html).toContain('KE_HOACH_LCNT.DOCX, HO_SO_YEU_CAU.DOCX');
  });

  it('RP-07-03 empty labels array omits data-field="labels"', () => {
    const resultWithNoLabels = synResult({
      recommendations: [synRec('NO_ACTION', 1, [])],
    });
    const html = render({ result: resultWithNoLabels, record: READY_RECORD });
    expect(html).not.toContain('data-field="labels"');
  });
});

// ── RP-08 AuditRecord fields and panelFromResult helper ───────────────────────

describe('RP-08 AuditRecord fields and panelFromResult helper', () => {
  it('RP-08-01 data-field="audit-sequence" renders record.sequence', () => {
    const html = render({ result: READY_RESULT, record: synRecord({ sequence: 3 }) });
    expect(html).toContain('data-field="audit-sequence"');
    expect(html).toContain('>3<');
  });

  it('RP-08-02 panelFromResult returns props with same result and record references', () => {
    const props = panelFromResult(READY_RESULT, READY_RECORD);
    expect(props.result).toBe(READY_RESULT);
    expect(props.record).toBe(READY_RECORD);
  });

  it('RP-08-03 rendering panelFromResult props produces same output as direct props', () => {
    const props  = panelFromResult(READY_RESULT, READY_RECORD);
    const direct = render({ result: READY_RESULT, record: READY_RECORD });
    expect(renderToString(<LegalRecommendationPanel {...props} />)).toBe(direct);
  });
});
