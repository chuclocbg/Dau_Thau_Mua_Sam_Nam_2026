/**
 * Phase 10.3 — DocumentTableRow tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   DTR-01  (3)  Renders without throwing
 *   DTR-02  (3)  Row root data-* attributes
 *   DTR-03  (3)  DocumentCard cell integration
 *   DTR-04  (3)  LegalStatusBadge cell integration
 *   DTR-05  (3)  LegalActionBadge cell integration
 *   DTR-06  (3)  LegalCountBadge cell integration
 *   DTR-07  (3)  All four <td> cells present
 *   DTR-08  (3)  className passthrough and rowFromRecord helper
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';

import {
  DocumentTableRow,
  rowFromRecord,
  type DocumentTableRowProps,
} from '../components/DocumentTableRow';
import type { AuditRecord }        from '../agents/AuditTrail';
import type { RecommendationCode } from '../agents/RecommendationEngine';

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
const UNCHANGED_RECORD = synRecord({ sequence: 1, primaryCode: 'NO_ACTION',   hasActions: false, totalCount: 0, recommendationCount: 1 });
const NAMED_RECORD     = synRecord({ sequence: 2, primaryCode: 'NAMED_FOCUS', totalCount: 5 });

function render(props: DocumentTableRowProps): string {
  return renderToString(<DocumentTableRow {...props} />);
}

// ── DTR-01 Renders without throwing ──────────────────────────────────────────

describe('DTR-01 Renders without throwing', () => {
  it('DTR-01-01 READY record renders without throwing', () => {
    expect(() => render({ record: READY_RECORD })).not.toThrow();
  });

  it('DTR-01-02 UNCHANGED record renders without throwing', () => {
    expect(() => render({ record: UNCHANGED_RECORD })).not.toThrow();
  });

  it('DTR-01-03 NAMED_FOCUS record renders without throwing', () => {
    expect(() => render({ record: NAMED_RECORD })).not.toThrow();
  });
});

// ── DTR-02 Row root data-* attributes ─────────────────────────────────────────

describe('DTR-02 Row root data-* attributes', () => {
  it('DTR-02-01 data-row="document-table-row" always present', () => {
    expect(render({ record: READY_RECORD }))
      .toContain('data-row="document-table-row"');
  });

  it('DTR-02-02 data-sequence matches record.sequence on root <tr>', () => {
    const readyHtml     = render({ record: READY_RECORD     });
    const unchangedHtml = render({ record: UNCHANGED_RECORD });
    expect(readyHtml).toContain('data-sequence="0"');
    expect(unchangedHtml).toContain('data-sequence="1"');
  });

  it('DTR-02-03 data-code on root <tr> matches record.primaryCode', () => {
    expect(render({ record: READY_RECORD     })).toContain('data-code="PREPARE_ALL"');
    expect(render({ record: UNCHANGED_RECORD })).toContain('data-code="NO_ACTION"');
  });
});

// ── DTR-03 DocumentCard cell integration ──────────────────────────────────────

describe('DTR-03 DocumentCard cell integration', () => {
  it('DTR-03-01 data-cell="card" td is present', () => {
    expect(render({ record: READY_RECORD })).toContain('data-cell="card"');
  });

  it('DTR-03-02 data-panel="document-card" from DocumentCard is inside the row', () => {
    expect(render({ record: READY_RECORD })).toContain('data-panel="document-card"');
  });

  it('DTR-03-03 DocumentCard sequence field (1-based) is present in output', () => {
    const html = render({ record: synRecord({ sequence: 2 }) });
    expect(html).toContain('data-field="sequence"');
    expect(html).toContain('>3<');
  });
});

// ── DTR-04 LegalStatusBadge cell integration ──────────────────────────────────

describe('DTR-04 LegalStatusBadge cell integration', () => {
  it('DTR-04-01 data-cell="status" td is present', () => {
    expect(render({ record: READY_RECORD })).toContain('data-cell="status"');
  });

  it('DTR-04-02 LegalStatusBadge is inside the status cell', () => {
    const html = render({ record: READY_RECORD });
    expect(html).toContain('data-badge="legal-status"');
  });

  it('DTR-04-03 NAMED_FOCUS renders "Tài liệu được chọn" label in status cell', () => {
    expect(render({ record: NAMED_RECORD })).toContain('Tài liệu được chọn');
  });
});

// ── DTR-05 LegalActionBadge cell integration ──────────────────────────────────

describe('DTR-05 LegalActionBadge cell integration', () => {
  it('DTR-05-01 data-cell="action" td is present', () => {
    expect(render({ record: READY_RECORD })).toContain('data-cell="action"');
  });

  it('DTR-05-02 hasActions=true renders data-active="true" in action cell', () => {
    expect(render({ record: READY_RECORD })).toContain('data-active="true"');
  });

  it('DTR-05-03 hasActions=false renders "Không có hành động" in action cell', () => {
    expect(render({ record: UNCHANGED_RECORD })).toContain('Không có hành động');
  });
});

// ── DTR-06 LegalCountBadge cell integration ───────────────────────────────────

describe('DTR-06 LegalCountBadge cell integration', () => {
  it('DTR-06-01 data-cell="count" td is present', () => {
    expect(render({ record: READY_RECORD })).toContain('data-cell="count"');
  });

  it('DTR-06-02 totalCount from record is rendered in the count cell', () => {
    const html = render({ record: synRecord({ totalCount: 7 }) });
    expect(html).toContain('data-badge="legal-count"');
    expect(html).toContain('7');
  });

  it('DTR-06-03 totalCount=0 for UNCHANGED record renders "0" in count cell', () => {
    const html = render({ record: UNCHANGED_RECORD });
    expect(html).toContain('data-cell="count"');
    expect(html).toContain('0');
  });
});

// ── DTR-07 All four <td> cells present ───────────────────────────────────────

describe('DTR-07 All four td cells present', () => {
  it('DTR-07-01 exactly four data-cell attributes in the row output', () => {
    const html    = render({ record: READY_RECORD });
    const matches = html.match(/data-cell=/g);
    expect(matches).toHaveLength(4);
  });

  it('DTR-07-02 all four cell names (card, status, action, count) are present', () => {
    const html = render({ record: READY_RECORD });
    expect(html).toContain('data-cell="card"');
    expect(html).toContain('data-cell="status"');
    expect(html).toContain('data-cell="action"');
    expect(html).toContain('data-cell="count"');
  });

  it('DTR-07-03 row contains multiple badge instances (card badges + cell badges)', () => {
    const html         = render({ record: READY_RECORD });
    const statusBadges = html.match(/data-badge="legal-status"/g);
    const actionBadges = html.match(/data-badge="legal-action"/g);
    // DocumentCard renders one of each; the cells render one more each
    expect(statusBadges).toHaveLength(2);
    expect(actionBadges).toHaveLength(2);
  });
});

// ── DTR-08 className passthrough and rowFromRecord helper ─────────────────────

describe('DTR-08 className passthrough and rowFromRecord helper', () => {
  it('DTR-08-01 className prop appears on the root <tr>', () => {
    expect(render({ record: READY_RECORD, className: 'row-highlight' }))
      .toContain('row-highlight');
  });

  it('DTR-08-02 rowFromRecord returns props with the same record reference', () => {
    const props = rowFromRecord(READY_RECORD);
    expect(props.record).toBe(READY_RECORD);
  });

  it('DTR-08-03 rendering rowFromRecord props produces same output as direct props', () => {
    const props  = rowFromRecord(READY_RECORD);
    const direct = render({ record: READY_RECORD });
    expect(renderToString(<DocumentTableRow {...props} />)).toBe(direct);
  });
});
