/**
 * Legal v4.7 — Compliance Report Engine Tests
 *
 * CR-01..CR-11: 11 groups × 3 tests = 33 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED   → HIGH, no humanReview
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED → HIGH, humanReview=true
 *   same     2025-07-01 → 2025-07-01: no changes          → LOW,  humanReview=false
 *
 * MEDIUM / CRITICAL scenarios and non-threshold categories use buildSections()
 * directly with synthetic action lists.
 *
 * Groups:
 *   CR-01 No changes            — same date: empty sections, no-changes summary
 *   CR-02 Threshold section     — forward: section title, severity, lines
 *   CR-03 Procurement band      — synthetic: UPDATE_TEMPLATE section for bands
 *   CR-04 Contract type         — synthetic: UPDATE_TEMPLATE section for types
 *   CR-05 Fund source           — synthetic: UPDATE_TEMPLATE section for sources
 *   CR-06 Risk section          — synthetic: UPDATE_RISK_RULES section, CRITICAL severity
 *   CR-07 Manual review section — backward: REVIEW_MANUALLY → manual-review section
 *   CR-08 Critical impact       — synthetic CRITICAL → critical-impact section appended last
 *   CR-09 Deterministic ordering — sections appear in spec-defined order
 *   CR-10 Empty sections removed — unaffected categories produce no sections
 *   CR-11 Backward compatibility — pre-history fallback dates work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  buildComplianceReport,
  buildSections,
} from '../ai/complianceReportEngine';
import type { Action } from '../ai/migrationEngine';
import type { AffectedArea } from '../ai/updatePackageEngine';

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const same25   = () => buildComplianceReport('2025-07-01', '2025-07-01');
const forward  = () => buildComplianceReport('2025-07-01', '2026-01-01');
const backward = () => buildComplianceReport('2026-01-01', '2025-07-01');

// ─── Synthetic action helpers ─────────────────────────────────────────────────

function action(area: AffectedArea, act: Action['action'], reason = 'test reason'): Action {
  return { area, action: act, reason };
}

// ─── CR-01: No changes ────────────────────────────────────────────────────────

describe('CR-01: No changes — same date produces empty report', () => {
  it('CR-01-01 sections array is empty', () => {
    expect(same25().sections).toHaveLength(0);
  });

  it('CR-01-02 summary is "No regulatory changes detected."', () => {
    expect(same25().summary).toBe('No regulatory changes detected.');
  });

  it('CR-01-03 humanReviewRequired is false', () => {
    expect(same25().humanReviewRequired).toBe(false);
  });
});

// ─── CR-02: Threshold section ─────────────────────────────────────────────────

describe('CR-02: Threshold section (2025 → 2026, 1 threshold added)', () => {
  it('CR-02-01 first section title is "Threshold changes"', () => {
    expect(forward().sections[0]!.title).toBe('Threshold changes');
  });

  it('CR-02-02 threshold section severity is HIGH', () => {
    expect(forward().sections[0]!.severity).toBe('HIGH');
  });

  it('CR-02-03 threshold section has at least one line', () => {
    expect(forward().sections[0]!.lines.length).toBeGreaterThan(0);
  });
});

// ─── CR-03: Procurement band section ─────────────────────────────────────────

describe('CR-03: Procurement band section (synthetic)', () => {
  const sections = buildSections(
    ['procurementBands'],
    [action('procurementBands', 'UPDATE_TEMPLATE', '1 added, 0 removed, 0 changed')],
    'MEDIUM',
    false,
  );

  it('CR-03-01 section title is "Procurement band changes"', () => {
    expect(sections[0]!.title).toBe('Procurement band changes');
  });

  it('CR-03-02 section severity is MEDIUM', () => {
    expect(sections[0]!.severity).toBe('MEDIUM');
  });

  it('CR-03-03 section lines contain the action reason', () => {
    expect(sections[0]!.lines[0]).toBe('1 added, 0 removed, 0 changed');
  });
});

// ─── CR-04: Contract type section ────────────────────────────────────────────

describe('CR-04: Contract type section (synthetic)', () => {
  const sections = buildSections(
    ['contractTypes'],
    [action('contractTypes', 'UPDATE_TEMPLATE', '2 added, 0 removed, 1 changed')],
    'MEDIUM',
    false,
  );

  it('CR-04-01 section title is "Contract type changes"', () => {
    expect(sections[0]!.title).toBe('Contract type changes');
  });

  it('CR-04-02 section severity is MEDIUM', () => {
    expect(sections[0]!.severity).toBe('MEDIUM');
  });

  it('CR-04-03 section lines contain the action reason', () => {
    expect(sections[0]!.lines[0]).toBe('2 added, 0 removed, 1 changed');
  });
});

// ─── CR-05: Fund source section ───────────────────────────────────────────────

describe('CR-05: Fund source section (synthetic)', () => {
  const sections = buildSections(
    ['fundSources'],
    [action('fundSources', 'UPDATE_TEMPLATE', '0 added, 1 removed, 0 changed')],
    'LOW',
    false,
  );

  it('CR-05-01 section title is "Fund source changes"', () => {
    expect(sections[0]!.title).toBe('Fund source changes');
  });

  it('CR-05-02 section severity is LOW', () => {
    expect(sections[0]!.severity).toBe('LOW');
  });

  it('CR-05-03 section lines contain the action reason', () => {
    expect(sections[0]!.lines[0]).toBe('0 added, 1 removed, 0 changed');
  });
});

// ─── CR-06: Risk section ──────────────────────────────────────────────────────

describe('CR-06: Risk rule section (synthetic)', () => {
  const sections = buildSections(
    ['riskThresholds'],
    [action('riskThresholds', 'UPDATE_RISK_RULES', '0 added, 0 removed, 1 changed')],
    'CRITICAL',
    true,
  );

  it('CR-06-01 section title is "Risk rule changes"', () => {
    expect(sections.find(s => s.title === 'Risk rule changes')).toBeDefined();
  });

  it('CR-06-02 risk section severity is CRITICAL', () => {
    expect(sections.find(s => s.title === 'Risk rule changes')!.severity).toBe('CRITICAL');
  });

  it('CR-06-03 risk section lines contain the action reason', () => {
    const riskSection = sections.find(s => s.title === 'Risk rule changes')!;
    expect(riskSection.lines[0]).toBe('0 added, 0 removed, 1 changed');
  });
});

// ─── CR-07: Manual review section ────────────────────────────────────────────

describe('CR-07: Manual review section (2026 → 2025, 1 threshold removed)', () => {
  it('CR-07-01 report contains "Manual review items" section', () => {
    const sections = backward().sections;
    expect(sections.some(s => s.title === 'Manual review items')).toBe(true);
  });

  it('CR-07-02 manual review section severity is HIGH', () => {
    const section = backward().sections.find(s => s.title === 'Manual review items')!;
    expect(section.severity).toBe('HIGH');
  });

  it('CR-07-03 manual review lines identify the source area', () => {
    const section = backward().sections.find(s => s.title === 'Manual review items')!;
    expect(section.lines[0]).toContain('thresholds');
  });
});

// ─── CR-08: Critical impact section ──────────────────────────────────────────

describe('CR-08: Critical impact section (synthetic CRITICAL)', () => {
  const sections = buildSections(
    ['riskThresholds'],
    [
      action('riskThresholds', 'UPDATE_RISK_RULES', '0 added, 0 removed, 1 changed'),
    ],
    'CRITICAL',
    true,
  );

  it('CR-08-01 report contains "Critical impact" section', () => {
    expect(sections.some(s => s.title === 'Critical impact')).toBe(true);
  });

  it('CR-08-02 critical impact section severity is CRITICAL', () => {
    expect(sections.find(s => s.title === 'Critical impact')!.severity).toBe('CRITICAL');
  });

  it('CR-08-03 critical impact section lines contain "Immediate review required."', () => {
    const section = sections.find(s => s.title === 'Critical impact')!;
    expect(section.lines[0]).toBe('Immediate review required.');
  });
});

// ─── CR-09: Deterministic ordering ───────────────────────────────────────────

describe('CR-09: Sections appear in spec-defined order', () => {
  it('CR-09-01 backward diff: threshold section before manual review section', () => {
    const sections = backward().sections;
    const thresholdIdx    = sections.findIndex(s => s.title === 'Threshold changes');
    const manualReviewIdx = sections.findIndex(s => s.title === 'Manual review items');
    expect(thresholdIdx).toBeLessThan(manualReviewIdx);
  });

  it('CR-09-02 critical impact section is always last', () => {
    const sections = buildSections(
      ['thresholds', 'riskThresholds'],
      [
        action('thresholds',      'UPDATE_DECISION_LOGIC', 'test'),
        action('riskThresholds',  'UPDATE_RISK_RULES',     'test'),
      ],
      'CRITICAL',
      true,
    );
    expect(sections[sections.length - 1]!.title).toBe('Critical impact');
  });

  it('CR-09-03 forward diff: first section is always Threshold changes', () => {
    expect(forward().sections[0]!.title).toBe('Threshold changes');
  });
});

// ─── CR-10: Empty sections removed ───────────────────────────────────────────

describe('CR-10: Empty sections are omitted', () => {
  it('CR-10-01 forward diff: no procurement band section (bands not affected)', () => {
    const sections = forward().sections;
    expect(sections.some(s => s.title === 'Procurement band changes')).toBe(false);
  });

  it('CR-10-02 same-date diff: sections array is empty', () => {
    expect(same25().sections).toHaveLength(0);
  });

  it('CR-10-03 buildSections with only riskThresholds: no threshold section', () => {
    const sections = buildSections(
      ['riskThresholds'],
      [action('riskThresholds', 'UPDATE_RISK_RULES', 'test')],
      'HIGH',
      false,
    );
    expect(sections.some(s => s.title === 'Threshold changes')).toBe(false);
    expect(sections.some(s => s.title === 'Risk rule changes')).toBe(true);
  });
});

// ─── CR-11: Backward compatibility ───────────────────────────────────────────

describe('CR-11: Backward compatibility / fallback dates', () => {
  it('CR-11-01 pre-history date does not throw and returns a valid report', () => {
    const report = buildComplianceReport('2020-01-01', '2025-07-01');
    expect(report).toHaveProperty('sections');
    expect(report).toHaveProperty('summary');
  });

  it('CR-11-02 pre-history vs 2026-01-01 → report contains Threshold changes section', () => {
    const report = buildComplianceReport('2020-01-01', '2026-01-01');
    expect(report.sections.some(s => s.title === 'Threshold changes')).toBe(true);
  });

  it('CR-11-03 oldDate and newDate in report match original inputs', () => {
    const report = buildComplianceReport('2020-01-01', '2099-12-31');
    expect(report.oldDate).toBe('2020-01-01');
    expect(report.newDate).toBe('2099-12-31');
  });
});
