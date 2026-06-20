/**
 * Legal v1.9 — legalRiskEngine tests
 *
 * Groups:
 *   RI-01  (4)  Basic output shape
 *   RI-02  (5)  Spec examples: critical-document risk levels
 *   RI-03  (4)  Score thresholds and modifiers
 *   RI-04  (5)  Recommendations
 *   RI-05  (3)  Determinism and Vietnamese UTF-8
 *
 * All RI-02 tests use chi-dinh-thau-rut-gon + von-tu-co + completionScore=75
 * (neutral conditions that produce zero method/fund/completion modifiers)
 * to isolate the per-document weight and forced-minimum rules.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRisk,
  type RiskInput,
  type RiskLevel,
} from '../ai/legalRiskEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function missingDoc(
  docType: RiskInput['missingDocuments'][number]['docType'],
  label:   string,
): RiskInput['missingDocuments'][number] {
  return { docType, label, mandatory: true, legalBasis: '' };
}

// Neutral baseline — no modifiers from method, fund, or completion.
const NEUTRAL: Pick<RiskInput, 'procurementMethod' | 'sourceOfFunds' | 'warnings' | 'completionScore'> = {
  procurementMethod: 'chi-dinh-thau-rut-gon',
  sourceOfFunds:     'von-tu-co',
  warnings:          [],
  completionScore:   75,
};

// ─── RI-01 · Basic output shape ───────────────────────────────────────────────

describe('RI-01 · Basic output shape', () => {
  const input: RiskInput = {
    documentType:     'khlcnt',
    ...NEUTRAL,
    missingDocuments: [],
  };

  it('RI-01-01: never throws for a valid input', () => {
    expect(() => evaluateRisk(input)).not.toThrow();
  });

  it('RI-01-02: returns riskLevel, riskScore, reasons[], recommendations[]', () => {
    const result = evaluateRisk(input);
    expect(typeof result.riskLevel).toBe('string');
    expect(typeof result.riskScore).toBe('number');
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('RI-01-03: riskLevel is one of CRITICAL | HIGH | MEDIUM | LOW', () => {
    const { riskLevel } = evaluateRisk(input);
    const VALID_LEVELS: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    expect(VALID_LEVELS).toContain(riskLevel);
  });

  it('RI-01-04: riskScore is a non-negative number', () => {
    const { riskScore } = evaluateRisk(input);
    expect(riskScore).toBeGreaterThanOrEqual(0);
  });
});

// ─── RI-02 · Critical-document risk levels ───────────────────────────────────

describe('RI-02 · Critical-document risk levels', () => {
  // These five cases are the core spec requirements.
  // Each tests the risk level produced by a single missing document
  // under neutral procurement conditions.

  it('RI-02-01: missing Quyết định phê duyệt → CRITICAL', () => {
    const { riskLevel } = evaluateRisk({
      documentType:     'hop-dong',
      ...NEUTRAL,
      missingDocuments: [missingDoc('quyet-dinh-phe-duyet', 'Quyết định phê duyệt')],
    });
    expect(riskLevel).toBe('CRITICAL');
  });

  it('RI-02-02: missing KHLCNT → HIGH', () => {
    const { riskLevel } = evaluateRisk({
      documentType:     'hsyc',
      ...NEUTRAL,
      missingDocuments: [missingDoc('khlcnt', 'Kế hoạch lựa chọn nhà thầu')],
    });
    expect(riskLevel).toBe('HIGH');
  });

  it('RI-02-03: missing Biên bản nghiệm thu → HIGH (forced, score is MEDIUM)', () => {
    // bien-ban-nghiem-thu weight=20 → MEDIUM by score, but DOC_FORCE_MIN lifts to HIGH
    const { riskLevel, riskScore } = evaluateRisk({
      documentType:     'bien-ban-ban-giao',
      ...NEUTRAL,
      missingDocuments: [missingDoc('bien-ban-nghiem-thu', 'Biên bản nghiệm thu')],
    });
    expect(riskLevel).toBe('HIGH');
    expect(riskScore).toBeGreaterThanOrEqual(15);
    expect(riskScore).toBeLessThan(25);   // score below HIGH threshold; force made the difference
  });

  it('RI-02-04: missing Biên bản bàn giao → MEDIUM', () => {
    // bien-ban-ban-giao weight=15, no forced minimum
    const { riskLevel } = evaluateRisk({
      documentType:     'thanh-toan',
      ...NEUTRAL,
      missingDocuments: [missingDoc('bien-ban-ban-giao', 'Biên bản bàn giao')],
    });
    expect(riskLevel).toBe('MEDIUM');
  });

  it('RI-02-05: missing Thanh lý → LOW', () => {
    // thanh-ly weight=5, no forced minimum
    const { riskLevel } = evaluateRisk({
      documentType:     'khlcnt',
      ...NEUTRAL,
      missingDocuments: [missingDoc('thanh-ly', 'Thanh lý')],
    });
    expect(riskLevel).toBe('LOW');
  });
});

// ─── RI-03 · Score thresholds and modifiers ──────────────────────────────────

describe('RI-03 · Score thresholds and modifiers', () => {
  it('RI-03-01: no missing docs + neutral method/fund → LOW', () => {
    const { riskLevel, riskScore } = evaluateRisk({
      documentType:     'to-trinh',
      ...NEUTRAL,
      missingDocuments: [],
    });
    // Priority for to-trinh + chi-dinh-thau-rut-gon is 'low' → 0 bonus
    expect(riskScore).toBeLessThan(15);
    expect(riskLevel).toBe('LOW');
  });

  it('RI-03-02: dau-thau-rong-rai increases riskScore vs chi-dinh-thau-rut-gon', () => {
    const base: Omit<RiskInput, 'procurementMethod'> = {
      documentType:     'khlcnt',
      sourceOfFunds:    'von-tu-co',
      warnings:         [],
      completionScore:  100,
      missingDocuments: [],
    };
    const scoreOpen  = evaluateRisk({ ...base, procurementMethod: 'dau-thau-rong-rai' }).riskScore;
    const scoreShort = evaluateRisk({ ...base, procurementMethod: 'chi-dinh-thau-rut-gon' }).riskScore;
    expect(scoreOpen).toBeGreaterThan(scoreShort);
  });

  it('RI-03-03: ngan-sach-nha-nuoc increases riskScore vs von-tu-co', () => {
    const base: Omit<RiskInput, 'sourceOfFunds'> = {
      documentType:     'khlcnt',
      procurementMethod: 'chi-dinh-thau',
      warnings:         [],
      completionScore:  100,
      missingDocuments: [],
    };
    const scoreState = evaluateRisk({ ...base, sourceOfFunds: 'ngan-sach-nha-nuoc' }).riskScore;
    const scoreSelf  = evaluateRisk({ ...base, sourceOfFunds: 'von-tu-co' }).riskScore;
    expect(scoreState).toBeGreaterThan(scoreSelf);
  });

  it('RI-03-04: completionScore < 25 applies a +10 penalty vs completionScore = 100', () => {
    const base: Omit<RiskInput, 'completionScore'> = {
      documentType:     'to-trinh',
      ...NEUTRAL,
      missingDocuments: [],
    };
    const scoreLow  = evaluateRisk({ ...base, completionScore: 10 }).riskScore;
    const scoreHigh = evaluateRisk({ ...base, completionScore: 100 }).riskScore;
    expect(scoreLow - scoreHigh).toBe(10);
  });
});

// ─── RI-04 · Recommendations ─────────────────────────────────────────────────

describe('RI-04 · Recommendations', () => {
  it('RI-04-01: CRITICAL risk produces "Bổ sung ngay" recommendation for missing doc', () => {
    const { recommendations } = evaluateRisk({
      documentType:     'hop-dong',
      ...NEUTRAL,
      missingDocuments: [missingDoc('quyet-dinh-phe-duyet', 'Quyết định phê duyệt')],
    });
    const found = recommendations.some(r => r.includes('Bổ sung ngay'));
    expect(found).toBe(true);
  });

  it('RI-04-02: HIGH risk produces "Ưu tiên bổ sung" recommendation for missing doc', () => {
    const { recommendations } = evaluateRisk({
      documentType:     'hsyc',
      ...NEUTRAL,
      missingDocuments: [missingDoc('khlcnt', 'Kế hoạch lựa chọn nhà thầu')],
    });
    const found = recommendations.some(r => r.includes('Ưu tiên bổ sung'));
    expect(found).toBe(true);
  });

  it('RI-04-03: dau-thau-rong-rai produces portal-publication recommendation', () => {
    const { recommendations } = evaluateRisk({
      documentType:     'khlcnt',
      procurementMethod: 'dau-thau-rong-rai',
      sourceOfFunds:    'von-tu-co',
      warnings:         [],
      completionScore:  100,
      missingDocuments: [],
    });
    const found = recommendations.some(r => r.includes('Hệ thống mạng đấu thầu quốc gia'));
    expect(found).toBe(true);
  });

  it('RI-04-04: ngan-sach-nha-nuoc produces budget-approval recommendation', () => {
    const { recommendations } = evaluateRisk({
      documentType:     'khlcnt',
      procurementMethod: 'chi-dinh-thau',
      sourceOfFunds:    'ngan-sach-nha-nuoc',
      warnings:         [],
      completionScore:  100,
      missingDocuments: [],
    });
    const found = recommendations.some(r => r.includes('dự toán ngân sách'));
    expect(found).toBe(true);
  });

  it('RI-04-05: recommendations is always an array — never throws', () => {
    const inputs: RiskInput[] = [
      { documentType: 'to-trinh',  ...NEUTRAL, missingDocuments: [] },
      { documentType: 'thanh-ly',  ...NEUTRAL, missingDocuments: [] },
      { documentType: 'hop-dong',  ...NEUTRAL, missingDocuments: [missingDoc('quyet-dinh-phe-duyet', 'Quyết định phê duyệt')] },
    ];
    for (const input of inputs) {
      expect(() => evaluateRisk(input)).not.toThrow();
      expect(Array.isArray(evaluateRisk(input).recommendations)).toBe(true);
    }
  });
});

// ─── RI-05 · Determinism and Vietnamese UTF-8 ────────────────────────────────

describe('RI-05 · Determinism and Vietnamese UTF-8', () => {
  const FIXED: RiskInput = {
    documentType:     'hop-dong',
    ...NEUTRAL,
    missingDocuments: [missingDoc('quyet-dinh-phe-duyet', 'Quyết định phê duyệt')],
  };

  it('RI-05-01: same input twice yields identical output (deterministic)', () => {
    const r1 = evaluateRisk(FIXED);
    const r2 = evaluateRisk(FIXED);
    expect(r1).toEqual(r2);
  });

  it('RI-05-02: reasons preserve Vietnamese diacritics', () => {
    const { reasons } = evaluateRisk(FIXED);
    expect(reasons.length).toBeGreaterThan(0);
    const hasVietnamese = reasons.some(r =>
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(r),
    );
    expect(hasVietnamese).toBe(true);
  });

  it('RI-05-03: recommendations preserve Vietnamese diacritics', () => {
    const { recommendations } = evaluateRisk(FIXED);
    expect(recommendations.length).toBeGreaterThan(0);
    const hasVietnamese = recommendations.some(r =>
      /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(r),
    );
    expect(hasVietnamese).toBe(true);
  });
});
