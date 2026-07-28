/**
 * Phase 10.4 — DocumentTable tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 * AuditHistory fixtures built with historyFromRecords() (pure function, no class).
 *
 * Groups:
 *   DT-01  (3)  Renders without throwing
 *   DT-02  (3)  Root <table> data-* attributes
 *   DT-03  (3)  <thead> column headers
 *   DT-04  (3)  <tbody> rows — DocumentTableRow presence
 *   DT-05  (3)  Row count and row sequence identifiers
 *   DT-06  (3)  Empty history — empty-state row
 *   DT-07  (3)  Summary metadata on root element
 *   DT-08  (3)  className passthrough and tableFromHistory helper
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';

import {
  DocumentTable,
  tableFromHistory,
  type DocumentTableProps,
} from '../components/DocumentTable';
import { historyFromRecords }    from '../agents/AuditTrail';
import type { AuditRecord }      from '../agents/AuditTrail';
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

const EMPTY_HISTORY  = historyFromRecords([]);

const SINGLE_HISTORY = historyFromRecords([
  synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', totalCount: 10 }),
]);

const MULTI_HISTORY  = historyFromRecords([
  synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', totalCount: 10, hasActions: true  }),
  synRecord({ sequence: 1, primaryCode: 'NO_ACTION',   totalCount: 0,  hasActions: false, recommendationCount: 1 }),
  synRecord({ sequence: 2, primaryCode: 'NAMED_FOCUS', totalCount: 5,  hasActions: true  }),
]);

function render(props: DocumentTableProps): string {
  return renderToString(<DocumentTable {...props} />);
}

// ── DT-01 Renders without throwing ───────────────────────────────────────────

describe('DT-01 Renders without throwing', () => {
  it('DT-01-01 empty history renders without throwing', () => {
    expect(() => render({ history: EMPTY_HISTORY })).not.toThrow();
  });

  it('DT-01-02 single-record history renders without throwing', () => {
    expect(() => render({ history: SINGLE_HISTORY })).not.toThrow();
  });

  it('DT-01-03 multi-record history renders without throwing', () => {
    expect(() => render({ history: MULTI_HISTORY })).not.toThrow();
  });
});

// ── DT-02 Root <table> data-* attributes ─────────────────────────────────────

describe('DT-02 Root table data-* attributes', () => {
  it('DT-02-01 data-table="document-table" always present', () => {
    expect(render({ history: SINGLE_HISTORY }))
      .toContain('data-table="document-table"');
  });

  it('DT-02-02 data-total-audits reflects history.totalAudits', () => {
    expect(render({ history: SINGLE_HISTORY })).toContain('data-total-audits="1"');
    expect(render({ history: MULTI_HISTORY  })).toContain('data-total-audits="3"');
  });

  it('DT-02-03 data-actionable-count reflects history.actionableCount', () => {
    // MULTI_HISTORY: records 0 and 2 have hasActions=true → actionableCount=2
    expect(render({ history: MULTI_HISTORY })).toContain('data-actionable-count="2"');
    expect(render({ history: EMPTY_HISTORY })).toContain('data-actionable-count="0"');
  });
});

// ── DT-03 <thead> column headers ─────────────────────────────────────────────

describe('DT-03 thead column headers', () => {
  it('DT-03-01 data-section="header" is present on <thead>', () => {
    expect(render({ history: SINGLE_HISTORY })).toContain('data-section="header"');
  });

  it('DT-03-02 all four data-col header values are present', () => {
    const html = render({ history: SINGLE_HISTORY });
    expect(html).toContain('data-col="card"');
    expect(html).toContain('data-col="status"');
    expect(html).toContain('data-col="action"');
    expect(html).toContain('data-col="count"');
  });

  it('DT-03-03 header row is present even when history is empty', () => {
    const html = render({ history: EMPTY_HISTORY });
    expect(html).toContain('data-section="header"');
    expect(html).toContain('data-col="card"');
  });
});

// ── DT-04 <tbody> rows — DocumentTableRow presence ───────────────────────────

describe('DT-04 tbody rows and DocumentTableRow presence', () => {
  it('DT-04-01 data-section="body" is present on <tbody>', () => {
    expect(render({ history: SINGLE_HISTORY })).toContain('data-section="body"');
  });

  it('DT-04-02 data-row="document-table-row" present for each record', () => {
    const html    = render({ history: MULTI_HISTORY });
    const matches = html.match(/data-row="document-table-row"/g);
    expect(matches).toHaveLength(3);
  });

  it('DT-04-03 DocumentCard (data-panel="document-card") renders inside body rows', () => {
    const html    = render({ history: MULTI_HISTORY });
    const matches = html.match(/data-panel="document-card"/g);
    expect(matches).toHaveLength(3);
  });
});

// ── DT-05 Row count and row sequence identifiers ──────────────────────────────

describe('DT-05 Row count and row sequence identifiers', () => {
  it('DT-05-01 row count equals history.records.length', () => {
    const html    = render({ history: MULTI_HISTORY });
    const matches = html.match(/data-row="document-table-row"/g);
    expect(matches).toHaveLength(MULTI_HISTORY.records.length);
  });

  it('DT-05-02 data-sequence values 0, 1, 2 all present for MULTI_HISTORY', () => {
    const html = render({ history: MULTI_HISTORY });
    expect(html).toContain('data-sequence="0"');
    expect(html).toContain('data-sequence="1"');
    expect(html).toContain('data-sequence="2"');
  });

  it('DT-05-03 single-record history renders exactly one row with data-sequence="0"', () => {
    const html    = render({ history: SINGLE_HISTORY });
    const matches = html.match(/data-row="document-table-row"/g);
    expect(matches).toHaveLength(1);
    expect(html).toContain('data-sequence="0"');
  });
});

// ── DT-06 Empty history — empty-state row ────────────────────────────────────

describe('DT-06 Empty history empty-state row', () => {
  it('DT-06-01 data-row="empty-state" present when records is empty', () => {
    expect(render({ history: EMPTY_HISTORY })).toContain('data-row="empty-state"');
  });

  it('DT-06-02 "Không có dữ liệu" message rendered in empty state', () => {
    expect(render({ history: EMPTY_HISTORY })).toContain('Không có dữ liệu');
  });

  it('DT-06-03 no data-row="document-table-row" when records is empty', () => {
    expect(render({ history: EMPTY_HISTORY }))
      .not.toContain('data-row="document-table-row"');
  });
});

// ── DT-07 Summary metadata on root element ───────────────────────────────────

describe('DT-07 Summary metadata on root element', () => {
  it('DT-07-01 data-total-audits="0" on empty history', () => {
    expect(render({ history: EMPTY_HISTORY })).toContain('data-total-audits="0"');
  });

  it('DT-07-02 data-total-audits and data-actionable-count both present for SINGLE_HISTORY', () => {
    const html = render({ history: SINGLE_HISTORY });
    expect(html).toContain('data-total-audits="1"');
    expect(html).toContain('data-actionable-count="1"');
  });

  it('DT-07-03 actionableCount counts only records where hasActions=true', () => {
    // MULTI_HISTORY: seq 0 (PREPARE_ALL, hasActions=true), seq 1 (NO_ACTION, false), seq 2 (NAMED_FOCUS, true)
    expect(render({ history: MULTI_HISTORY })).toContain('data-actionable-count="2"');
  });
});

// ── DT-08 className passthrough and tableFromHistory helper ───────────────────

describe('DT-08 className passthrough and tableFromHistory helper', () => {
  it('DT-08-01 className prop appears on the root <table>', () => {
    expect(render({ history: SINGLE_HISTORY, className: 'audit-table' }))
      .toContain('audit-table');
  });

  it('DT-08-02 tableFromHistory returns props with the same history reference', () => {
    const props = tableFromHistory(MULTI_HISTORY);
    expect(props.history).toBe(MULTI_HISTORY);
  });

  it('DT-08-03 rendering tableFromHistory props produces same output as direct props', () => {
    const props  = tableFromHistory(MULTI_HISTORY);
    const direct = render({ history: MULTI_HISTORY });
    expect(renderToString(<DocumentTable {...props} />)).toBe(direct);
  });
});
