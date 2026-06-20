/**
 * Unit tests — P1-01: numberToWords()
 *
 * Verifies the full Vietnamese number-to-words implementation that replaced
 * the 4-hardcode stub. Covers edge cases, special Vietnamese rules, and the
 * 4 values that were previously hardcoded (regression).
 */
import { describe, it, expect } from 'vitest';
import { numberToWords } from '../docTemplates';

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('numberToWords — edge cases', () => {
  it('returns "Không đồng" for zero', () => {
    expect(numberToWords(0)).toBe('Không đồng');
  });

  it('returns error string for negative numbers', () => {
    expect(numberToWords(-1)).toBe('Giá trị không hợp lệ');
    expect(numberToWords(-100_000_000)).toBe('Giá trị không hợp lệ');
  });

  it('returns error string for NaN', () => {
    expect(numberToWords(NaN)).toBe('Giá trị không hợp lệ');
  });

  it('returns error string for Infinity', () => {
    expect(numberToWords(Infinity)).toBe('Giá trị không hợp lệ');
    expect(numberToWords(-Infinity)).toBe('Giá trị không hợp lệ');
  });
});

// ---------------------------------------------------------------------------
// Regression — the 4 previously hardcoded values must be preserved exactly
// ---------------------------------------------------------------------------
describe('numberToWords — regression: previously hardcoded values', () => {
  it('320,000,000 → "Ba trăm hai mươi triệu đồng chẵn"', () => {
    expect(numberToWords(320_000_000)).toBe('Ba trăm hai mươi triệu đồng chẵn');
  });

  it('80,000,000 → "Tám mươi triệu đồng chẵn"', () => {
    expect(numberToWords(80_000_000)).toBe('Tám mươi triệu đồng chẵn');
  });

  it('650,000,000 → "Sáu trăm năm mươi triệu đồng chẵn"', () => {
    expect(numberToWords(650_000_000)).toBe('Sáu trăm năm mươi triệu đồng chẵn');
  });

  it('45,000,000 → "Bốn mươi lăm triệu đồng chẵn"', () => {
    expect(numberToWords(45_000_000)).toBe('Bốn mươi lăm triệu đồng chẵn');
  });
});

// ---------------------------------------------------------------------------
// Previously failing value — used to return placeholder garbage
// ---------------------------------------------------------------------------
describe('numberToWords — previously failing: arbitrary values', () => {
  it('522,000,000 returns a real Vietnamese phrase (not a placeholder)', () => {
    const result = numberToWords(522_000_000);
    expect(result).not.toContain('Xem chi tiết');
    expect(result).not.toContain('đồng (Bằng chữ:');
    expect(result).toContain('đồng chẵn');
    expect(result).toBe('Năm trăm hai mươi hai triệu đồng chẵn');
  });

  it('175,500,000 returns a real phrase', () => {
    const result = numberToWords(175_500_000);
    expect(result).toContain('đồng chẵn');
    expect(result).not.toContain('Xem chi tiết');
    expect(result).toBe('Một trăm bảy mươi lăm triệu năm trăm nghìn đồng chẵn');
  });
});

// ---------------------------------------------------------------------------
// Vietnamese special number rules
// ---------------------------------------------------------------------------
describe('numberToWords — Vietnamese special rules', () => {
  it('"mười" for 10 (not "một mươi")', () => {
    expect(numberToWords(10_000)).toBe('Mười nghìn đồng chẵn');
  });

  it('"mười một" for 11 (not "mười mốt")', () => {
    expect(numberToWords(11_000)).toBe('Mười một nghìn đồng chẵn');
  });

  it('"mười lăm" for 15', () => {
    expect(numberToWords(15_000)).toBe('Mười lăm nghìn đồng chẵn');
  });

  it('"hai mươi mốt" for 21 (mốt applies after mươi when tens > 1)', () => {
    expect(numberToWords(21_000)).toBe('Hai mươi mốt nghìn đồng chẵn');
  });

  it('"hai mươi lăm" for 25', () => {
    expect(numberToWords(25_000)).toBe('Hai mươi lăm nghìn đồng chẵn');
  });

  it('"hai mươi hai" for 22 (normal ones digit)', () => {
    expect(numberToWords(22_000)).toBe('Hai mươi hai nghìn đồng chẵn');
  });

  it('"một trăm linh một" for 101 (linh bridges hundreds to lone units)', () => {
    expect(numberToWords(101_000)).toBe('Một trăm linh một nghìn đồng chẵn');
  });

  it('"một trăm linh năm" for 105 — "lăm" only applies after a tens digit, not after "linh"', () => {
    expect(numberToWords(105_000)).toBe('Một trăm linh năm nghìn đồng chẵn');
  });

  it('no linh when tens digit is non-zero', () => {
    expect(numberToWords(110_000)).toBe('Một trăm mười nghìn đồng chẵn');
  });

  it('"năm" for bare 5 (not "lăm" without a tens digit)', () => {
    expect(numberToWords(5_000)).toBe('Năm nghìn đồng chẵn');
  });
});

// ---------------------------------------------------------------------------
// Scale boundaries
// ---------------------------------------------------------------------------
describe('numberToWords — scale boundaries', () => {
  it('1,000 → "Một nghìn đồng chẵn"', () => {
    expect(numberToWords(1_000)).toBe('Một nghìn đồng chẵn');
  });

  it('1,000,000 → "Một triệu đồng chẵn"', () => {
    expect(numberToWords(1_000_000)).toBe('Một triệu đồng chẵn');
  });

  it('1,000,000,000 → "Một tỷ đồng chẵn"', () => {
    expect(numberToWords(1_000_000_000)).toBe('Một tỷ đồng chẵn');
  });

  it('5,000,000,000 → "Năm tỷ đồng chẵn" (COMPETITIVE_SHOPPING upper threshold)', () => {
    expect(numberToWords(5_000_000_000)).toBe('Năm tỷ đồng chẵn');
  });

  it('1,001,000 → "Một triệu một nghìn đồng chẵn"', () => {
    expect(numberToWords(1_001_000)).toBe('Một triệu một nghìn đồng chẵn');
  });

  it('result always starts with uppercase letter', () => {
    const values = [1_000, 25_000_000, 320_000_000, 1_500_000_000];
    for (const v of values) {
      const result = numberToWords(v);
      expect(result[0]).toBe(result[0].toUpperCase());
    }
  });

  it('result always ends with "đồng chẵn"', () => {
    const values = [1_000, 25_000_000, 320_000_000, 999_999_999];
    for (const v of values) {
      expect(numberToWords(v)).toMatch(/đồng chẵn$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Task-3 required output examples
// ---------------------------------------------------------------------------
describe('numberToWords — task-3 output examples', () => {
  it('0 → "Không đồng"', () => {
    expect(numberToWords(0)).toBe('Không đồng');
  });

  it('80,000,000 → "Tám mươi triệu đồng chẵn"', () => {
    expect(numberToWords(80_000_000)).toBe('Tám mươi triệu đồng chẵn');
  });

  it('320,000,000 → "Ba trăm hai mươi triệu đồng chẵn"', () => {
    expect(numberToWords(320_000_000)).toBe('Ba trăm hai mươi triệu đồng chẵn');
  });

  it('1,256,000,000 → "Một tỷ hai trăm năm mươi sáu triệu đồng chẵn"', () => {
    expect(numberToWords(1_256_000_000)).toBe('Một tỷ hai trăm năm mươi sáu triệu đồng chẵn');
  });

  it('9,987,654,321 → full mixed output', () => {
    expect(numberToWords(9_987_654_321)).toBe(
      'Chín tỷ chín trăm tám mươi bảy triệu sáu trăm năm mươi bốn nghìn ba trăm hai mươi mốt đồng chẵn'
    );
  });
});

// ---------------------------------------------------------------------------
// Trillion support (nghìn tỷ)
// ---------------------------------------------------------------------------
describe('numberToWords — trillion support', () => {
  it('1,000,000,000,000 → "Một nghìn tỷ đồng chẵn"', () => {
    expect(numberToWords(1_000_000_000_000)).toBe('Một nghìn tỷ đồng chẵn');
  });

  it('2,500,000,000,000 → "Hai nghìn năm trăm tỷ đồng chẵn"', () => {
    expect(numberToWords(2_500_000_000_000)).toBe('Hai nghìn năm trăm tỷ đồng chẵn');
  });

  it('1,001,000,000,000 → "Một nghìn một tỷ đồng chẵn"', () => {
    expect(numberToWords(1_001_000_000_000)).toBe('Một nghìn một tỷ đồng chẵn');
  });

  it('trillion result starts with uppercase', () => {
    expect(numberToWords(1_000_000_000_000)[0]).toBe('M');
  });

  it('trillion result ends with "đồng chẵn"', () => {
    expect(numberToWords(5_000_000_000_000)).toMatch(/đồng chẵn$/);
  });
});
