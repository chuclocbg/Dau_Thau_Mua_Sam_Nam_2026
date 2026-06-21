/**
 * Legal v4.8 — Update Notification Engine Tests
 *
 * UN-01..UN-11: 11 groups × 3 tests = 33 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED  → HIGH, no human review
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED → HIGH, humanReview=true
 *   same     2025-07-01 → 2025-07-01: no changes          → LOW, humanReview=false
 *
 * CRITICAL impact cannot be produced from real snapshot data; UN-09 verifies
 * the notification behavior under the closest real scenario (HIGH + humanReview).
 *
 * Groups:
 *   UN-01 No changes           — title, messageLines, sections for zero-change diff
 *   UN-02 Title generation     — "No regulatory changes" vs "Regulatory update detected"
 *   UN-03 Severity propagation — severity copied from impactLevel
 *   UN-04 Summary propagation  — summary in both field and messageLines[1]
 *   UN-05 Section ordering     — section titles appear in messageLines in spec order
 *   UN-06 No duplicates        — messageLines contains no repeated entries
 *   UN-07 No empty lines       — every line in messageLines is non-empty
 *   UN-08 Human review flag    — requiresHumanReview propagated correctly
 *   UN-09 Critical impact      — backward diff: human-review section in messageLines
 *   UN-10 Deterministic output — repeated calls produce identical results
 *   UN-11 Backward compatibility — pre-history fallback dates work correctly
 */

import { describe, it, expect } from 'vitest';
import { buildUpdateNotification } from '../ai/updateNotificationEngine';

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const same25   = () => buildUpdateNotification('2025-07-01', '2025-07-01');
const forward  = () => buildUpdateNotification('2025-07-01', '2026-01-01');
const backward = () => buildUpdateNotification('2026-01-01', '2025-07-01');

// ─── UN-01: No changes ────────────────────────────────────────────────────────

describe('UN-01: No changes — same date produces minimal notification', () => {
  it('UN-01-01 title is "No regulatory changes"', () => {
    expect(same25().title).toBe('No regulatory changes');
  });

  it('UN-01-02 messageLines has exactly 2 entries (date range + summary, no section lines)', () => {
    expect(same25().messageLines).toHaveLength(2);
  });

  it('UN-01-03 sections is empty', () => {
    expect(same25().sections).toHaveLength(0);
  });
});

// ─── UN-02: Title generation ──────────────────────────────────────────────────

describe('UN-02: Title generation rules', () => {
  it('UN-02-01 forward diff → "Regulatory update detected"', () => {
    expect(forward().title).toBe('Regulatory update detected');
  });

  it('UN-02-02 same date → "No regulatory changes"', () => {
    expect(same25().title).toBe('No regulatory changes');
  });

  it('UN-02-03 backward diff → "Regulatory update detected"', () => {
    expect(backward().title).toBe('Regulatory update detected');
  });
});

// ─── UN-03: Severity propagation ─────────────────────────────────────────────

describe('UN-03: Severity copied from impactLevel', () => {
  it('UN-03-01 forward diff → severity HIGH (threshold added)', () => {
    expect(forward().severity).toBe('HIGH');
  });

  it('UN-03-02 same date → severity LOW', () => {
    expect(same25().severity).toBe('LOW');
  });

  it('UN-03-03 backward diff → severity HIGH (threshold removed)', () => {
    expect(backward().severity).toBe('HIGH');
  });
});

// ─── UN-04: Summary propagation ───────────────────────────────────────────────

describe('UN-04: Summary appears in both field and messageLines', () => {
  it('UN-04-01 forward → summary field is "1 affected areas detected."', () => {
    expect(forward().summary).toBe('1 affected areas detected.');
  });

  it('UN-04-02 same date → summary field is "No regulatory changes detected."', () => {
    expect(same25().summary).toBe('No regulatory changes detected.');
  });

  it('UN-04-03 messageLines[1] equals the summary field', () => {
    const n = forward();
    expect(n.messageLines[1]).toBe(n.summary);
  });
});

// ─── UN-05: Section ordering ──────────────────────────────────────────────────

describe('UN-05: Section titles appear in messageLines in spec-defined order', () => {
  it('UN-05-01 forward → "Threshold changes" is messageLines[2] (first section title)', () => {
    expect(forward().messageLines[2]).toBe('Threshold changes');
  });

  it('UN-05-02 backward → "Threshold changes" appears before "Manual review items" in messageLines', () => {
    const lines = backward().messageLines;
    const thresholdIdx    = lines.indexOf('Threshold changes');
    const manualReviewIdx = lines.indexOf('Manual review items');
    expect(thresholdIdx).toBeGreaterThan(-1);
    expect(manualReviewIdx).toBeGreaterThan(-1);
    expect(thresholdIdx).toBeLessThan(manualReviewIdx);
  });

  it('UN-05-03 section titles in messageLines match sections[].title in order', () => {
    const n = backward();
    const sectionTitlesFromLines = n.messageLines.slice(2);
    const sectionTitlesFromSections = n.sections.map(s => s.title);
    expect(sectionTitlesFromLines).toEqual(sectionTitlesFromSections);
  });
});

// ─── UN-06: No duplicates ─────────────────────────────────────────────────────

describe('UN-06: messageLines contains no duplicate entries', () => {
  it('UN-06-01 forward → all messageLines are unique', () => {
    const lines = forward().messageLines;
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('UN-06-02 backward → all messageLines are unique', () => {
    const lines = backward().messageLines;
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('UN-06-03 same date → all messageLines are unique', () => {
    const lines = same25().messageLines;
    expect(new Set(lines).size).toBe(lines.length);
  });
});

// ─── UN-07: No empty lines ────────────────────────────────────────────────────

describe('UN-07: Every entry in messageLines is a non-empty string', () => {
  it('UN-07-01 forward → no empty messageLines', () => {
    expect(forward().messageLines.every(l => l.length > 0)).toBe(true);
  });

  it('UN-07-02 backward → no empty messageLines', () => {
    expect(backward().messageLines.every(l => l.length > 0)).toBe(true);
  });

  it('UN-07-03 same date → no empty messageLines', () => {
    expect(same25().messageLines.every(l => l.length > 0)).toBe(true);
  });
});

// ─── UN-08: Human review flag ─────────────────────────────────────────────────

describe('UN-08: requiresHumanReview propagated from complianceReport', () => {
  it('UN-08-01 backward → requiresHumanReview is true (threshold removed)', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });

  it('UN-08-02 forward → requiresHumanReview is false (threshold added, not removed)', () => {
    expect(forward().requiresHumanReview).toBe(false);
  });

  it('UN-08-03 same date → requiresHumanReview is false', () => {
    expect(same25().requiresHumanReview).toBe(false);
  });
});

// ─── UN-09: Critical impact / human-review in messageLines ───────────────────
// CRITICAL cannot be produced from real snapshot data.
// These tests verify notification behavior under the closest real scenario:
// HIGH impact with humanReview=true (backward diff — 1 threshold removed).

describe('UN-09: High-impact human-review scenario reflected in notification', () => {
  it('UN-09-01 backward → "Manual review items" appears in messageLines', () => {
    expect(backward().messageLines).toContain('Manual review items');
  });

  it('UN-09-02 backward → title is still "Regulatory update detected" (human review does not change title)', () => {
    expect(backward().title).toBe('Regulatory update detected');
  });

  it('UN-09-03 backward → messageLines has exactly 4 entries (date range, summary, threshold, manual review)', () => {
    // "From ... to ..." + "1 affected areas detected." + "Threshold changes" + "Manual review items"
    expect(backward().messageLines).toHaveLength(4);
  });
});

// ─── UN-10: Deterministic output ─────────────────────────────────────────────

describe('UN-10: Deterministic / idempotent output', () => {
  it('UN-10-01 forward called twice → same title', () => {
    expect(forward().title).toBe(forward().title);
  });

  it('UN-10-02 forward called twice → same messageLines length', () => {
    expect(forward().messageLines.length).toBe(forward().messageLines.length);
  });

  it('UN-10-03 same date called twice → same title and same messageLines[0]', () => {
    const a = same25();
    const b = same25();
    expect(a.title).toBe(b.title);
    expect(a.messageLines[0]).toBe(b.messageLines[0]);
  });
});

// ─── UN-11: Backward compatibility ───────────────────────────────────────────

describe('UN-11: Backward compatibility / fallback dates', () => {
  it('UN-11-01 pre-history date does not throw and returns a valid notification', () => {
    const n = buildUpdateNotification('2020-01-01', '2025-07-01');
    expect(n).toHaveProperty('title');
    expect(n).toHaveProperty('messageLines');
  });

  it('UN-11-02 pre-history vs 2026-01-01 → title is "Regulatory update detected"', () => {
    expect(buildUpdateNotification('2020-01-01', '2026-01-01').title).toBe('Regulatory update detected');
  });

  it('UN-11-03 messageLines[0] contains the original oldDate', () => {
    const n = buildUpdateNotification('2020-01-01', '2099-12-31');
    expect(n.messageLines[0]).toContain('2020-01-01');
    expect(n.messageLines[0]).toContain('2099-12-31');
  });
});
