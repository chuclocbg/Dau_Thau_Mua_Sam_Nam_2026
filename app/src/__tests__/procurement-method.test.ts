/**
 * Unit tests — P1-02: getProcurementMethod() threshold correctness.
 *
 * Critical regression guard: the COMPETITIVE_SHOPPING threshold was 10B before
 * P1-02 and is now correctly 5B per NĐ 214/2025/NĐ-CP (SKILL.md §III).
 * Any package between 5B–10B must map to OPEN_BIDDING, not COMPETITIVE_SHOPPING.
 */
import { describe, it, expect } from 'vitest';
import { getProcurementMethod } from '../docTemplates';
import { makePkgWithTotal } from './fixtures';

describe('getProcurementMethod — DIRECT_50 (≤ 50,000,000)', () => {
  it('1 VND → DIRECT_50', () => {
    expect(getProcurementMethod(makePkgWithTotal(1)).code).toBe('DIRECT_50');
  });

  it('50,000,000 (boundary) → DIRECT_50', () => {
    expect(getProcurementMethod(makePkgWithTotal(50_000_000)).code).toBe('DIRECT_50');
  });

  it('legal basis cites NĐ 214/2025', () => {
    const method = getProcurementMethod(makePkgWithTotal(30_000_000));
    expect(method.basis.some(b => b.includes('214/2025'))).toBe(true);
  });
});

describe('getProcurementMethod — DIRECT_SELECTION_SIMPLIFIED (50M < total ≤ 500M)', () => {
  it('50,000,001 → DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(getProcurementMethod(makePkgWithTotal(50_000_001)).code).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });

  it('200,000,000 → DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(getProcurementMethod(makePkgWithTotal(200_000_000)).code).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });

  it('500,000,000 (boundary) → DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(getProcurementMethod(makePkgWithTotal(500_000_000)).code).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });
});

describe('getProcurementMethod — COMPETITIVE_SHOPPING (500M < total ≤ 5B)', () => {
  it('500,000,001 → COMPETITIVE_SHOPPING', () => {
    expect(getProcurementMethod(makePkgWithTotal(500_000_001)).code).toBe('COMPETITIVE_SHOPPING');
  });

  it('2,000,000,000 → COMPETITIVE_SHOPPING', () => {
    expect(getProcurementMethod(makePkgWithTotal(2_000_000_000)).code).toBe('COMPETITIVE_SHOPPING');
  });

  it('5,000,000,000 (boundary) → COMPETITIVE_SHOPPING', () => {
    expect(getProcurementMethod(makePkgWithTotal(5_000_000_000)).code).toBe('COMPETITIVE_SHOPPING');
  });

  it('legal basis cites NĐ 214/2025 Điều 81', () => {
    const method = getProcurementMethod(makePkgWithTotal(1_000_000_000));
    expect(method.basis.some(b => b.includes('214/2025'))).toBe(true);
  });
});

describe('getProcurementMethod — OPEN_BIDDING (> 5B) — P1-02 regression', () => {
  it('5,000,000,001 → OPEN_BIDDING (was COMPETITIVE_SHOPPING before P1-02)', () => {
    expect(getProcurementMethod(makePkgWithTotal(5_000_000_001)).code).toBe('OPEN_BIDDING');
  });

  it('7,500,000,000 → OPEN_BIDDING (was COMPETITIVE_SHOPPING before P1-02)', () => {
    expect(getProcurementMethod(makePkgWithTotal(7_500_000_000)).code).toBe('OPEN_BIDDING');
  });

  it('10,000,000,000 → OPEN_BIDDING (was COMPETITIVE_SHOPPING before P1-02)', () => {
    expect(getProcurementMethod(makePkgWithTotal(10_000_000_000)).code).toBe('OPEN_BIDDING');
  });

  it('20,000,000,000 → OPEN_BIDDING', () => {
    expect(getProcurementMethod(makePkgWithTotal(20_000_000_000)).code).toBe('OPEN_BIDDING');
  });

  it('legal basis cites TT 79 and TT 80', () => {
    const method = getProcurementMethod(makePkgWithTotal(6_000_000_000));
    const allBasis = method.basis.join(' ');
    expect(allBasis).toContain('79/2025');
    expect(allBasis).toContain('80/2025');
  });
});

describe('getProcurementMethod — returned name and basis are non-empty strings', () => {
  const boundaries = [1, 50_000_000, 50_000_001, 500_000_000, 500_000_001, 5_000_000_000, 5_000_000_001];

  for (const total of boundaries) {
    it(`total=${total} returns non-empty name and basis`, () => {
      const method = getProcurementMethod(makePkgWithTotal(total));
      expect(method.name.length).toBeGreaterThan(0);
      expect(method.basis.length).toBeGreaterThan(0);
      method.basis.forEach(b => expect(b.length).toBeGreaterThan(0));
    });
  }
});
