/**
 * Phase 11.1 — GovernanceDashboard tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 * AuditHistory built with historyFromRecords() (pure function, no class).
 * RegulationSnapshot from getRegulationSnapshot() or synthetic construction.
 *
 * Groups:
 *   GD-01  (3)  Renders without throwing
 *   GD-02  (3)  Root container and five section structure
 *   GD-03  (3)  Procurement Summary section
 *   GD-04  (3)  Audit Summary section
 *   GD-05  (3)  Legal Alerts section
 *   GD-06  (3)  Missing Documents section
 *   GD-07  (3)  Legal Snapshot section
 *   GD-08  (3)  className passthrough and dashboardFromInputs helper
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';

import {
  GovernanceDashboard,
  dashboardFromInputs,
  type GovernanceDashboardProps,
} from '../components/GovernanceDashboard';
import { historyFromRecords }          from '../agents/AuditTrail';
import type { AuditRecord }            from '../agents/AuditTrail';
import type { RecommendationCode }     from '../agents/RecommendationEngine';
import { getRegulationSnapshot }       from '../ai/effectiveDateEngine';
import type { RegulationSnapshot }     from '../ai/effectiveDateEngine';

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

// Histories
const EMPTY_HISTORY  = historyFromRecords([]);

const MIXED_HISTORY  = historyFromRecords([
  synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', hasActions: true,  totalCount: 10 }),
  synRecord({ sequence: 1, primaryCode: 'NO_ACTION',   hasActions: false, totalCount: 0, recommendationCount: 1 }),
  synRecord({ sequence: 2, primaryCode: 'FOCUS_REQUIRED', hasActions: true, totalCount: 4 }),
]);

const ACTION_ONLY_HISTORY = historyFromRecords([
  synRecord({ sequence: 0, primaryCode: 'PREPARE_ALL', hasActions: true, totalCount: 5 }),
]);

// Snapshots — use the real engine for READY, synthetic struct for EMPTY
const READY_SNAPSHOT: RegulationSnapshot = getRegulationSnapshot('2026-01-01');

const EMPTY_SNAPSHOT: RegulationSnapshot = {
  targetDate:       '2020-01-01',
  thresholds:       [],
  procurementBands: [],
  contractTypes:    [],
  fundSources:      [],
  riskThresholds:   [],
};

function render(props: GovernanceDashboardProps): string {
  return renderToString(<GovernanceDashboard {...props} />);
}

// ── GD-01 Renders without throwing ───────────────────────────────────────────

describe('GD-01 Renders without throwing', () => {
  it('GD-01-01 empty history + empty snapshot renders without throwing', () => {
    expect(() => render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT })).not.toThrow();
  });

  it('GD-01-02 mixed history + ready snapshot renders without throwing', () => {
    expect(() => render({ history: MIXED_HISTORY, snapshot: READY_SNAPSHOT })).not.toThrow();
  });

  it('GD-01-03 action-only history + empty snapshot renders without throwing', () => {
    expect(() => render({ history: ACTION_ONLY_HISTORY, snapshot: EMPTY_SNAPSHOT })).not.toThrow();
  });
});

// ── GD-02 Root container and five section structure ───────────────────────────

describe('GD-02 Root container and five section structure', () => {
  it('GD-02-01 data-panel="governance-dashboard" always present', () => {
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-panel="governance-dashboard"');
  });

  it('GD-02-02 all five data-section attributes are present', () => {
    const html = render({ history: MIXED_HISTORY, snapshot: READY_SNAPSHOT });
    expect(html).toContain('data-section="procurement-summary"');
    expect(html).toContain('data-section="audit-summary"');
    expect(html).toContain('data-section="legal-alerts"');
    expect(html).toContain('data-section="missing-documents"');
    expect(html).toContain('data-section="legal-snapshot"');
  });

  it('GD-02-03 all five sections render even for empty history + empty snapshot', () => {
    const html = render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT });
    expect(html).toContain('data-section="procurement-summary"');
    expect(html).toContain('data-section="audit-summary"');
    expect(html).toContain('data-section="legal-alerts"');
    expect(html).toContain('data-section="missing-documents"');
    expect(html).toContain('data-section="legal-snapshot"');
  });
});

// ── GD-03 Procurement Summary section ────────────────────────────────────────

describe('GD-03 Procurement Summary section', () => {
  it('GD-03-01 LegalStatusBadge renders latestRecord.primaryCode in summary', () => {
    const html = render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT });
    // latestRecord for MIXED_HISTORY is sequence 2 (FOCUS_REQUIRED)
    expect(html).toContain('data-badge="legal-status"');
    expect(html).toContain('Ưu tiên bắt buộc');
  });

  it('GD-03-02 LegalCountBadge renders latestRecord.totalCount in summary', () => {
    const html = render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT });
    // latestRecord totalCount = 4
    expect(html).toContain('data-badge="legal-count"');
    expect(html).toContain('4');
  });

  it('GD-03-03 empty history renders empty-state in procurement-summary', () => {
    const html = render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT });
    expect(html).toContain('data-section="procurement-summary"');
    expect(html).toContain('Chưa có dữ liệu đấu thầu');
  });
});

// ── GD-04 Audit Summary section ──────────────────────────────────────────────

describe('GD-04 Audit Summary section', () => {
  it('GD-04-01 data-field="total-audits" is present', () => {
    expect(render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-field="total-audits"');
  });

  it('GD-04-02 total-audits value matches history.totalAudits', () => {
    const html = render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT });
    // MIXED_HISTORY has 3 records → totalAudits=3
    expect(html).toContain('>3<');
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('>0<');
  });

  it('GD-04-03 actionable-count reflects history.actionableCount', () => {
    // MIXED_HISTORY: seq 0 (hasActions=true), seq 1 (false), seq 2 (true) → actionableCount=2
    const html = render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT });
    expect(html).toContain('data-field="actionable-count"');
    expect(html).toContain('>2<');
  });
});

// ── GD-05 Legal Alerts section ───────────────────────────────────────────────

describe('GD-05 Legal Alerts section', () => {
  it('GD-05-01 data-section="legal-alerts" is present', () => {
    expect(render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-section="legal-alerts"');
  });

  it('GD-05-02 data-alert-count matches count of hasActions=true records', () => {
    // MIXED_HISTORY: 2 actionable records (seq 0 and 2)
    expect(render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-alert-count="2"');
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-alert-count="0"');
  });

  it('GD-05-03 no actionable records → empty-state "Không có cảnh báo"', () => {
    const noAlerts = historyFromRecords([
      synRecord({ primaryCode: 'NO_ACTION', hasActions: false, totalCount: 0, recommendationCount: 1 }),
    ]);
    expect(render({ history: noAlerts, snapshot: EMPTY_SNAPSHOT }))
      .toContain('Không có cảnh báo');
  });
});

// ── GD-06 Missing Documents section ──────────────────────────────────────────

describe('GD-06 Missing Documents section', () => {
  it('GD-06-01 data-section="missing-documents" is present', () => {
    expect(render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-section="missing-documents"');
  });

  it('GD-06-02 data-missing-count matches count of records with totalCount > 0', () => {
    // MIXED_HISTORY: seq 0 (totalCount=10) + seq 2 (totalCount=4) → 2 missing
    expect(render({ history: MIXED_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-missing-count="2"');
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('data-missing-count="0"');
  });

  it('GD-06-03 all records totalCount=0 → empty-state "Đủ tài liệu"', () => {
    const noMissing = historyFromRecords([
      synRecord({ primaryCode: 'NO_ACTION', hasActions: false, totalCount: 0, recommendationCount: 1 }),
    ]);
    expect(render({ history: noMissing, snapshot: EMPTY_SNAPSHOT }))
      .toContain('Đủ tài liệu');
  });
});

// ── GD-07 Legal Snapshot section ─────────────────────────────────────────────

describe('GD-07 Legal Snapshot section', () => {
  it('GD-07-01 data-section="legal-snapshot" with data-snapshot-date present', () => {
    const html = render({ history: EMPTY_HISTORY, snapshot: READY_SNAPSHOT });
    expect(html).toContain('data-section="legal-snapshot"');
    expect(html).toContain(`data-snapshot-date="${READY_SNAPSHOT.targetDate}"`);
  });

  it('GD-07-02 data-field="threshold-count" reflects snapshot.thresholds.length', () => {
    const html = render({ history: EMPTY_HISTORY, snapshot: READY_SNAPSHOT });
    expect(html).toContain('data-field="threshold-count"');
    expect(html).toContain(`>${READY_SNAPSHOT.thresholds.length}<`);
    // Empty snapshot: 0
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .toContain('>0<');
  });

  it('GD-07-03 threshold items render with data-item="threshold" and data-code', () => {
    const html = render({ history: EMPTY_HISTORY, snapshot: READY_SNAPSHOT });
    if (READY_SNAPSHOT.thresholds.length > 0) {
      const matches = html.match(/data-item="threshold"/g);
      expect(matches).toHaveLength(READY_SNAPSHOT.thresholds.length);
      expect(html).toContain(`data-code="${READY_SNAPSHOT.thresholds[0].code}"`);
    }
    // Empty snapshot: no threshold items
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT }))
      .not.toContain('data-item="threshold"');
  });
});

// ── GD-08 className passthrough and dashboardFromInputs helper ─────────────────

describe('GD-08 className passthrough and dashboardFromInputs helper', () => {
  it('GD-08-01 className prop appears on the root element', () => {
    expect(render({ history: EMPTY_HISTORY, snapshot: EMPTY_SNAPSHOT, className: 'gov-dash' }))
      .toContain('gov-dash');
  });

  it('GD-08-02 dashboardFromInputs returns props with same history and snapshot references', () => {
    const props = dashboardFromInputs(MIXED_HISTORY, READY_SNAPSHOT);
    expect(props.history).toBe(MIXED_HISTORY);
    expect(props.snapshot).toBe(READY_SNAPSHOT);
  });

  it('GD-08-03 rendering dashboardFromInputs props produces same output as direct props', () => {
    const props  = dashboardFromInputs(MIXED_HISTORY, READY_SNAPSHOT);
    const direct = render({ history: MIXED_HISTORY, snapshot: READY_SNAPSHOT });
    expect(renderToString(<GovernanceDashboard {...props} />)).toBe(direct);
  });
});
