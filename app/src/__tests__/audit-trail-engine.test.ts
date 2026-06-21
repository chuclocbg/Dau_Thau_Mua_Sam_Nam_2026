/**
 * Legal v4.9 — Audit Trail Engine Tests
 *
 * AT-01..AT-11: 11 groups × 3 tests = 33 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED  → impactLevel HIGH
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED → impactLevel HIGH
 *   same     2025-07-01 → 2025-07-01: no changes          → impactLevel LOW
 *
 * Stage index map:
 *   0 Resolve versions        3 Build update package
 *   1 Load snapshots          4 Build migration plan
 *   2 Compute diff            5 Build compliance report
 *                             6 Build notification
 *
 * MEDIUM and CRITICAL impact levels cannot be produced from real snapshot data.
 * AT-02 and AT-04 call computeStageStatus() directly with synthetic values.
 *
 * Groups:
 *   AT-01 Low severity          — same date: all stages SUCCESS, LOW summary
 *   AT-02 Medium severity       — computeStageStatus: only stage 6 WARNING
 *   AT-03 High severity         — forward: stages 4–6 WARNING, 0–3 SUCCESS
 *   AT-04 Critical severity     — computeStageStatus: stages 3–6 CRITICAL
 *   AT-05 Stage ordering        — fixed names in the correct sequence
 *   AT-06 All stages exist      — exactly 7 stages regardless of diff result
 *   AT-07 Summary generation    — four summary strings, each at correct level
 *   AT-08 Deterministic output  — identical inputs → identical outputs
 *   AT-09 Warning propagation   — HIGH: three trailing stages flip to WARNING
 *   AT-10 Critical propagation  — CRITICAL boundary at index 2/3
 *   AT-11 Backward compatibility — pre-history fallback, generatedAt field
 */

import { describe, it, expect } from 'vitest';
import { buildAuditTrail, computeStageStatus } from '../ai/auditTrailEngine';

// ─── Convenience helpers ──────────────────────────────────────────────────────

const FIXED_TS = '2026-01-01T00:00:00.000Z';

const same25   = () => buildAuditTrail('2025-07-01', '2025-07-01', FIXED_TS);
const forward  = () => buildAuditTrail('2025-07-01', '2026-01-01', FIXED_TS);
const backward = () => buildAuditTrail('2026-01-01', '2025-07-01', FIXED_TS);

// ─── AT-01: Low severity ─────────────────────────────────────────────────────

describe('AT-01: Low severity — same date: all stages SUCCESS', () => {
  it('AT-01-01 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('AT-01-02 all 7 stages have status SUCCESS', () => {
    expect(same25().stages.every(s => s.status === 'SUCCESS')).toBe(true);
  });

  it('AT-01-03 summary is "No significant regulatory impact."', () => {
    expect(same25().summary).toBe('No significant regulatory impact.');
  });
});

// ─── AT-02: Medium severity ──────────────────────────────────────────────────

describe('AT-02: Medium severity — only notification stage (6) is WARNING', () => {
  it('AT-02-01 computeStageStatus(6, MEDIUM) === WARNING', () => {
    expect(computeStageStatus(6, 'MEDIUM')).toBe('WARNING');
  });

  it('AT-02-02 computeStageStatus(5, MEDIUM) === SUCCESS (report is not WARNING)', () => {
    expect(computeStageStatus(5, 'MEDIUM')).toBe('SUCCESS');
  });

  it('AT-02-03 computeStageStatus(0, MEDIUM) === SUCCESS (resolve versions)', () => {
    expect(computeStageStatus(0, 'MEDIUM')).toBe('SUCCESS');
  });
});

// ─── AT-03: High severity ─────────────────────────────────────────────────────

describe('AT-03: High severity — forward diff: stages 4–6 WARNING, 0–3 SUCCESS', () => {
  it('AT-03-01 impactLevel is HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('AT-03-02 stages 4, 5, 6 are WARNING', () => {
    const { stages } = forward();
    expect(stages[4]!.status).toBe('WARNING');
    expect(stages[5]!.status).toBe('WARNING');
    expect(stages[6]!.status).toBe('WARNING');
  });

  it('AT-03-03 stages 0, 1, 2, 3 are SUCCESS', () => {
    const { stages } = forward();
    expect(stages[0]!.status).toBe('SUCCESS');
    expect(stages[1]!.status).toBe('SUCCESS');
    expect(stages[2]!.status).toBe('SUCCESS');
    expect(stages[3]!.status).toBe('SUCCESS');
  });
});

// ─── AT-04: Critical severity ─────────────────────────────────────────────────

describe('AT-04: Critical severity — stages 3–6 become CRITICAL', () => {
  it('AT-04-01 computeStageStatus(3, CRITICAL) === CRITICAL (first post-diff stage)', () => {
    expect(computeStageStatus(3, 'CRITICAL')).toBe('CRITICAL');
  });

  it('AT-04-02 computeStageStatus(2, CRITICAL) === SUCCESS (diff stage itself is not CRITICAL)', () => {
    expect(computeStageStatus(2, 'CRITICAL')).toBe('SUCCESS');
  });

  it('AT-04-03 computeStageStatus(6, CRITICAL) === CRITICAL (notification stage)', () => {
    expect(computeStageStatus(6, 'CRITICAL')).toBe('CRITICAL');
  });
});

// ─── AT-05: Stage ordering ────────────────────────────────────────────────────

describe('AT-05: Fixed stage ordering', () => {
  it('AT-05-01 stages[0].name is "Resolve versions"', () => {
    expect(same25().stages[0]!.name).toBe('Resolve versions');
  });

  it('AT-05-02 stages[6].name is "Build notification"', () => {
    expect(same25().stages[6]!.name).toBe('Build notification');
  });

  it('AT-05-03 all stage names in correct order', () => {
    const names = same25().stages.map(s => s.name);
    expect(names).toEqual([
      'Resolve versions',
      'Load snapshots',
      'Compute diff',
      'Build update package',
      'Build migration plan',
      'Build compliance report',
      'Build notification',
    ]);
  });
});

// ─── AT-06: All stages exist ──────────────────────────────────────────────────

describe('AT-06: Exactly 7 stages always present', () => {
  it('AT-06-01 same date → 7 stages', () => {
    expect(same25().stages).toHaveLength(7);
  });

  it('AT-06-02 forward diff → 7 stages', () => {
    expect(forward().stages).toHaveLength(7);
  });

  it('AT-06-03 backward diff → 7 stages', () => {
    expect(backward().stages).toHaveLength(7);
  });
});

// ─── AT-07: Summary generation ───────────────────────────────────────────────

describe('AT-07: Summary strings match impact levels', () => {
  it('AT-07-01 LOW summary is "No significant regulatory impact."', () => {
    expect(same25().summary).toBe('No significant regulatory impact.');
  });

  it('AT-07-02 HIGH summary is "High impact detected."', () => {
    expect(forward().summary).toBe('High impact detected.');
  });

  it('AT-07-03 backward diff also yields HIGH summary', () => {
    expect(backward().summary).toBe('High impact detected.');
  });
});

// ─── AT-08: Deterministic output ─────────────────────────────────────────────

describe('AT-08: Deterministic output with fixed generatedAt', () => {
  it('AT-08-01 two forward calls return same impactLevel', () => {
    expect(forward().impactLevel).toBe(forward().impactLevel);
  });

  it('AT-08-02 two forward calls return same stages count and statuses', () => {
    const a = forward();
    const b = forward();
    expect(a.stages.length).toBe(b.stages.length);
    expect(a.stages.map(s => s.status)).toEqual(b.stages.map(s => s.status));
  });

  it('AT-08-03 generatedAt in output matches the supplied parameter', () => {
    const trail = buildAuditTrail('2025-07-01', '2025-07-01', FIXED_TS);
    expect(trail.generatedAt).toBe(FIXED_TS);
  });
});

// ─── AT-09: Warning propagation ───────────────────────────────────────────────

describe('AT-09: HIGH impact: warning propagates to migration, report, notification', () => {
  it('AT-09-01 stages[4] (Build migration plan) is WARNING for HIGH', () => {
    expect(forward().stages[4]!.status).toBe('WARNING');
  });

  it('AT-09-02 stages[5] (Build compliance report) is WARNING for HIGH', () => {
    expect(forward().stages[5]!.status).toBe('WARNING');
  });

  it('AT-09-03 stages[6] (Build notification) is WARNING for HIGH', () => {
    expect(forward().stages[6]!.status).toBe('WARNING');
  });
});

// ─── AT-10: Critical propagation ─────────────────────────────────────────────

describe('AT-10: CRITICAL boundary at stage index 2/3', () => {
  it('AT-10-01 index 3 is CRITICAL under CRITICAL impact', () => {
    expect(computeStageStatus(3, 'CRITICAL')).toBe('CRITICAL');
  });

  it('AT-10-02 index 2 is SUCCESS under CRITICAL impact (diff stage not flagged)', () => {
    expect(computeStageStatus(2, 'CRITICAL')).toBe('SUCCESS');
  });

  it('AT-10-03 index 3 is SUCCESS under HIGH impact (only 4+ are WARNING)', () => {
    expect(computeStageStatus(3, 'HIGH')).toBe('SUCCESS');
  });
});

// ─── AT-11: Backward compatibility ───────────────────────────────────────────

describe('AT-11: Backward compatibility / fallback dates', () => {
  it('AT-11-01 pre-history date does not throw and returns a valid trail', () => {
    const trail = buildAuditTrail('2020-01-01', '2025-07-01', FIXED_TS);
    expect(trail).toHaveProperty('stages');
    expect(trail.stages).toHaveLength(7);
  });

  it('AT-11-02 pre-history vs 2026-01-01 → impactLevel HIGH', () => {
    expect(buildAuditTrail('2020-01-01', '2026-01-01', FIXED_TS).impactLevel).toBe('HIGH');
  });

  it('AT-11-03 generatedAt field is present and matches the supplied value', () => {
    const trail = buildAuditTrail('2020-01-01', '2099-12-31', FIXED_TS);
    expect(trail.generatedAt).toBe(FIXED_TS);
  });
});
