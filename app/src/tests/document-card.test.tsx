/**
 * Phase 10.1 — DocumentCard tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   DC-01  (3)  Renders without throwing
 *   DC-02  (3)  Root container data-* attributes
 *   DC-03  (3)  Sequence field display (1-based)
 *   DC-04  (3)  Target date field
 *   DC-05  (3)  LegalStatusBadge integration
 *   DC-06  (3)  LegalActionBadge integration
 *   DC-07  (3)  LegalCountBadge integration
 *   DC-08  (3)  className passthrough and cardFromRecord helper
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';

import { DocumentCard, cardFromRecord } from '../components/DocumentCard';
import type { AuditRecord }             from '../agents/AuditTrail';
import type { RecommendationCode }      from '../agents/RecommendationEngine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
    recommendationCount: opts.recommendationCount ?? 2,
  };
}

const READY_RECORD     = synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', totalCount: 10 });
const UNCHANGED_RECORD = synRecord({ sequence: 1, primaryCode: 'NO_ACTION',   totalCount: 0, hasActions: false, recommendationCount: 1 });
const NAMED_RECORD     = synRecord({ sequence: 2, primaryCode: 'NAMED_FOCUS', totalCount: 5 });

function render(record: AuditRecord, className?: string): string {
  return renderToString(<DocumentCard record={record} className={className} />);
}

// ── DC-01 Renders without throwing ───────────────────────────────────────────

describe('DC-01 Renders without throwing', () => {
  it('DC-01-01 READY record renders without throwing', () => {
    expect(() => render(READY_RECORD)).not.toThrow();
  });

  it('DC-01-02 UNCHANGED record renders without throwing', () => {
    expect(() => render(UNCHANGED_RECORD)).not.toThrow();
  });

  it('DC-01-03 NAMED_FOCUS record renders without throwing', () => {
    expect(() => render(NAMED_RECORD)).not.toThrow();
  });
});

// ── DC-02 Root container data-* attributes ────────────────────────────────────

describe('DC-02 Root container data-* attributes', () => {
  it('DC-02-01 data-panel="document-card" is always present', () => {
    expect(render(READY_RECORD)).toContain('data-panel="document-card"');
  });

  it('DC-02-02 data-sequence matches record.sequence', () => {
    expect(render(READY_RECORD)).toContain('data-sequence="0"');
    expect(render(UNCHANGED_RECORD)).toContain('data-sequence="1"');
  });

  it('DC-02-03 data-code on root matches record.primaryCode', () => {
    expect(render(READY_RECORD)).toContain('data-code="PREPARE_ALL"');
    expect(render(UNCHANGED_RECORD)).toContain('data-code="NO_ACTION"');
  });
});

// ── DC-03 Sequence field display (1-based) ────────────────────────────────────

describe('DC-03 Sequence field display (1-based)', () => {
  it('DC-03-01 data-field="sequence" element is present', () => {
    expect(render(READY_RECORD)).toContain('data-field="sequence"');
  });

  it('DC-03-02 sequence 0 displays "1" (1-based ordinal)', () => {
    const html = render(synRecord({ sequence: 0 }));
    expect(html).toContain('>1<');
  });

  it('DC-03-03 sequence 4 displays "5"', () => {
    const html = render(synRecord({ sequence: 4 }));
    expect(html).toContain('>5<');
  });
});

// ── DC-04 Target date field ───────────────────────────────────────────────────

describe('DC-04 Target date field', () => {
  it('DC-04-01 data-field="target-date" element is present', () => {
    expect(render(READY_RECORD)).toContain('data-field="target-date"');
  });

  it('DC-04-02 targetDate "2026-01-01" is visible in output', () => {
    expect(render(READY_RECORD)).toContain('2026-01-01');
  });

  it('DC-04-03 arbitrary targetDate is rendered correctly', () => {
    const html = render(synRecord({ targetDate: '2099-12-31' }));
    expect(html).toContain('2099-12-31');
  });
});

// ── DC-05 LegalStatusBadge integration ───────────────────────────────────────

describe('DC-05 LegalStatusBadge integration', () => {
  it('DC-05-01 data-badge="legal-status" is present (badge rendered)', () => {
    expect(render(READY_RECORD)).toContain('data-badge="legal-status"');
  });

  it('DC-05-02 data-code on badge matches record.primaryCode', () => {
    // Both root and badge carry data-code; badge is inside a span
    const html = render(READY_RECORD);
    const spanMatch = html.match(/<span[^>]*data-badge="legal-status"[^>]*data-code="([^"]+)"/);
    const spanMatchAlt = html.match(/<span[^>]*data-code="([^"]+)"[^>]*data-badge="legal-status"/);
    const code = (spanMatch ?? spanMatchAlt)?.[1];
    expect(code).toBe('PREPARE_ALL');
  });

  it('DC-05-03 PREPARE_ALL renders "Chuẩn bị tài liệu" label', () => {
    expect(render(READY_RECORD)).toContain('Chuẩn bị tài liệu');
  });
});

// ── DC-06 LegalActionBadge integration ───────────────────────────────────────

describe('DC-06 LegalActionBadge integration', () => {
  it('DC-06-01 data-badge="legal-action" is present', () => {
    expect(render(READY_RECORD)).toContain('data-badge="legal-action"');
  });

  it('DC-06-02 hasActions=true renders data-active="true"', () => {
    expect(render(READY_RECORD)).toContain('data-active="true"');
  });

  it('DC-06-03 hasActions=false renders data-active="false"', () => {
    expect(render(UNCHANGED_RECORD)).toContain('data-active="false"');
  });
});

// ── DC-07 LegalCountBadge integration ────────────────────────────────────────

describe('DC-07 LegalCountBadge integration', () => {
  it('DC-07-01 totalCount is rendered as a number in output', () => {
    const html = render(synRecord({ totalCount: 7 }));
    expect(html).toContain('7');
  });

  it('DC-07-02 recommendationCount and "khuyến nghị" label are rendered', () => {
    const html = render(synRecord({ recommendationCount: 3 }));
    expect(html).toContain('3');
    expect(html).toContain('khuyến nghị');
  });

  it('DC-07-03 two data-badge="legal-count" elements are present', () => {
    const html    = render(READY_RECORD);
    const matches = html.match(/data-badge="legal-count"/g);
    expect(matches).toHaveLength(2);
  });
});

// ── DC-08 className passthrough and cardFromRecord helper ─────────────────────

describe('DC-08 className passthrough and cardFromRecord helper', () => {
  it('DC-08-01 className prop appears in rendered output', () => {
    expect(render(READY_RECORD, 'card-highlight')).toContain('card-highlight');
  });

  it('DC-08-02 cardFromRecord returns props with the same record reference', () => {
    const props = cardFromRecord(READY_RECORD);
    expect(props.record).toBe(READY_RECORD);
  });

  it('DC-08-03 rendering cardFromRecord props produces same output as direct props', () => {
    const props = cardFromRecord(READY_RECORD);
    const fromHelper = renderToString(<DocumentCard {...props} />);
    const direct     = render(READY_RECORD);
    expect(fromHelper).toBe(direct);
  });
});
