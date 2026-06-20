/**
 * Legal v3.1 — Document Generator tests
 *
 * All functions are synchronous and pure. No renderToString, no jsdom.
 *
 * Groups:
 *   DG-01  (3)  Open bidding
 *   DG-02  (3)  Competitive quotation
 *   DG-03  (3)  Direct appointment
 *   DG-04  (3)  Abbreviated direct appointment
 *   DG-05  (3)  ODA source
 *   DG-06  (3)  State budget source
 *   DG-07  (3)  Enterprise source
 *   DG-08  (3)  Existing documents complete
 *   DG-09  (3)  Missing documents
 *   DG-10  (3)  Timeline
 *   DG-11  (3)  Risk
 *   DG-12  (3)  Legal basis
 *   DG-13  (3)  Deterministic output
 *   DG-14  (3)  UTF-8 Vietnamese
 *   DG-15  (3)  Backward compatibility
 */

import { describe, it, expect } from 'vitest';
import {
  generateDocuments,
  type DocumentGeneratorInput,
  type DocumentGeneratorOutput,
} from '../ai/documentGenerator';

// Backward-compatibility imports — must remain usable independently.
import { searchLegalIndex }       from '../ai/searchLegalIndex';
import { buildChecklist }         from '../ai/legalChecklistEngine';
import { evaluateRisk }           from '../ai/legalRiskEngine';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const PKG_DATES = { start: '2026-01-01', end: '2026-12-31' };

// Full lifecycle for open bidding / competitive quotation / direct purchase.
const ALL_DOCS_FULL = [
  'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

// Full lifecycle for direct appointment (no khlcnt/hsyc).
const ALL_DOCS_CHI_DINH = [
  'to-trinh', 'quyet-dinh-phe-duyet',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

// Full lifecycle for abbreviated direct appointment.
const ALL_DOCS_RUT_GON = [
  'to-trinh',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

const VALID_RISK_LEVELS = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

// ─── DG-01 · Open bidding ────────────────────────────────────────────────────

describe('DG-01 · Open bidding', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'dau-thau-rong-rai',
    fundingSourceName: 'ngan-sach-nha-nuoc',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-01-01: accepts alias "open-bidding"', () => {
    const out = generateDocuments({ ...input, methodCode: 'open-bidding' });
    expect(out.requiredDocuments.length).toBe(9);
  });

  it('DG-01-02: lifecycle includes khlcnt and hsyc', () => {
    const out   = generateDocuments(input);
    const types = out.requiredDocuments.map(d => d.docType);
    expect(types).toContain('khlcnt');
    expect(types).toContain('hsyc');
  });

  it('DG-01-03: warnings include open-bidding portal publication notice', () => {
    const out = generateDocuments(input);
    const hasPortalWarning = out.warnings.some(w =>
      w.includes('mạng đấu thầu') || w.includes('đấu thầu rộng rãi'),
    );
    expect(hasPortalWarning).toBe(true);
  });
});

// ─── DG-02 · Competitive quotation ───────────────────────────────────────────

describe('DG-02 · Competitive quotation', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'competitive-quotation',
    fundingSourceName: 'von-su-nghiep',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-02-01: accepts alias "chao-hang-canh-tranh"', () => {
    const out = generateDocuments({ ...input, methodCode: 'chao-hang-canh-tranh' });
    expect(out.requiredDocuments.length).toBe(9);
  });

  it('DG-02-02: lifecycle includes khlcnt and hsyc', () => {
    const out   = generateDocuments(input);
    const types = out.requiredDocuments.map(d => d.docType);
    expect(types).toContain('khlcnt');
    expect(types).toContain('hsyc');
  });

  it('DG-02-03: riskScore lower than open bidding with same empty dossier', () => {
    const outChaoHang = generateDocuments(input);
    const outDauThau  = generateDocuments({
      ...input,
      methodCode: 'dau-thau-rong-rai',
    });
    // Open bidding carries a higher method risk bonus (5 vs 3).
    expect(outDauThau.riskScore).toBeGreaterThanOrEqual(outChaoHang.riskScore);
  });
});

// ─── DG-03 · Direct appointment ──────────────────────────────────────────────

describe('DG-03 · Direct appointment', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'direct-appointment',
    fundingSourceName: 'ngan-sach-nha-nuoc',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-03-01: lifecycle does NOT include khlcnt or hsyc', () => {
    const out   = generateDocuments(input);
    const types = out.requiredDocuments.map(d => d.docType);
    expect(types).not.toContain('khlcnt');
    expect(types).not.toContain('hsyc');
  });

  it('DG-03-02: lifecycle DOES include quyet-dinh-phe-duyet and hop-dong', () => {
    const out   = generateDocuments(input);
    const types = out.requiredDocuments.map(d => d.docType);
    expect(types).toContain('quyet-dinh-phe-duyet');
    expect(types).toContain('hop-dong');
  });

  it('DG-03-03: requiredDocuments length is 7 (shorter than open bidding)', () => {
    const out = generateDocuments(input);
    expect(out.requiredDocuments.length).toBe(7);
  });
});

// ─── DG-04 · Abbreviated direct appointment ──────────────────────────────────

describe('DG-04 · Abbreviated direct appointment', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'abbreviated-direct-appointment',
    fundingSourceName: 'von-tu-co',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-04-01: requiredDocuments length is 6 (shortest lifecycle)', () => {
    const out = generateDocuments(input);
    expect(out.requiredDocuments.length).toBe(6);
  });

  it('DG-04-02: lifecycle does NOT include khlcnt, hsyc, or quyet-dinh-phe-duyet', () => {
    const out   = generateDocuments(input);
    const types = out.requiredDocuments.map(d => d.docType);
    expect(types).not.toContain('khlcnt');
    expect(types).not.toContain('hsyc');
    expect(types).not.toContain('quyet-dinh-phe-duyet');
  });

  it('DG-04-03: accepts engine code "chi-dinh-thau-rut-gon"', () => {
    const out = generateDocuments({ ...input, methodCode: 'chi-dinh-thau-rut-gon' });
    expect(out.requiredDocuments.length).toBe(6);
  });
});

// ─── DG-05 · ODA source ──────────────────────────────────────────────────────

describe('DG-05 · ODA source', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'dau-thau-rong-rai',
    fundingSourceName: 'oda',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-05-01: accepts alias "von-vay-oda"', () => {
    const out = generateDocuments({ ...input, fundingSourceName: 'von-vay-oda' });
    expect(out.riskLevel).toBeDefined();
  });

  it('DG-05-02: warnings include ODA donor compliance notice', () => {
    const out = generateDocuments(input);
    const hasOdaWarning = out.warnings.some(w =>
      w.toLowerCase().includes('oda') || w.includes('nhà tài trợ') || w.includes('điều ước'),
    );
    expect(hasOdaWarning).toBe(true);
  });

  it('DG-05-03: riskScore higher than enterprise source for the same method + dossier', () => {
    const outOda        = generateDocuments(input);
    const outEnterprise = generateDocuments({ ...input, fundingSourceName: 'enterprise' });
    // ODA carries higher fund risk bonus (5 vs 0).
    expect(outOda.riskScore).toBeGreaterThan(outEnterprise.riskScore);
  });
});

// ─── DG-06 · State budget source ─────────────────────────────────────────────

describe('DG-06 · State budget source', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'dau-thau-rong-rai',
    fundingSourceName: 'state-budget',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-06-01: accepts alias "ngan-sach-nha-nuoc"', () => {
    const out = generateDocuments({ ...input, fundingSourceName: 'ngan-sach-nha-nuoc' });
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('DG-06-02: warnings include state budget appropriation requirement', () => {
    const out = generateDocuments(input);
    const hasBudgetWarning = out.warnings.some(w =>
      w.includes('ngân sách') || w.includes('dự toán'),
    );
    expect(hasBudgetWarning).toBe(true);
  });

  it('DG-06-03: riskScore higher than enterprise source for the same method + dossier', () => {
    const outBudget     = generateDocuments(input);
    const outEnterprise = generateDocuments({ ...input, fundingSourceName: 'enterprise' });
    // State budget carries fund risk bonus of 3 vs 0.
    expect(outBudget.riskScore).toBeGreaterThan(outEnterprise.riskScore);
  });
});

// ─── DG-07 · Enterprise source ───────────────────────────────────────────────

describe('DG-07 · Enterprise source', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'chi-dinh-thau-rut-gon',
    fundingSourceName: 'enterprise',
    pkgDates:          PKG_DATES,
    existingDocuments: ALL_DOCS_RUT_GON,
  };

  it('DG-07-01: accepts alias "von-tu-co"', () => {
    const out = generateDocuments({ ...input, fundingSourceName: 'von-tu-co' });
    expect(out).toBeDefined();
  });

  it('DG-07-02: no ODA or budget warnings when source is enterprise', () => {
    const out = generateDocuments(input);
    const hasOdaOrBudgetWarning = out.warnings.some(w =>
      w.includes('oda') || w.includes('ODA') || w.includes('ngân sách') || w.includes('dự toán'),
    );
    expect(hasOdaOrBudgetWarning).toBe(false);
  });

  it('DG-07-03: riskScore is 0 when all documents present (no missing, no modifiers)', () => {
    // chi-dinh-thau-rut-gon + von-tu-co = zero method and fund risk bonus.
    // All docs present + no warnings = riskScore 0.
    const out = generateDocuments(input);
    expect(out.riskScore).toBe(0);
    expect(out.riskLevel).toBe('LOW');
  });
});

// ─── DG-08 · Existing documents complete ─────────────────────────────────────

describe('DG-08 · Existing documents complete', () => {
  it('DG-08-01: open bidding with all 9 docs — missingDocuments is empty', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ALL_DOCS_FULL,
    });
    expect(out.missingDocuments).toHaveLength(0);
  });

  it('DG-08-02: direct appointment with all 7 docs — missingDocuments is empty', () => {
    const out = generateDocuments({
      methodCode:        'chi-dinh-thau',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ALL_DOCS_CHI_DINH,
    });
    expect(out.missingDocuments).toHaveLength(0);
  });

  it('DG-08-03: abbreviated direct with all 6 docs — timeline shows all present', () => {
    const out = generateDocuments({
      methodCode:        'chi-dinh-thau-rut-gon',
      fundingSourceName: 'von-tu-co',
      pkgDates:          PKG_DATES,
      existingDocuments: ALL_DOCS_RUT_GON,
    });
    const statuses = out.timeline.map(s => s.status);
    expect(statuses.every(s => s === 'present')).toBe(true);
  });
});

// ─── DG-09 · Missing documents ────────────────────────────────────────────────

describe('DG-09 · Missing documents', () => {
  it('DG-09-01: empty dossier — all required docs appear in missingDocuments', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: [],
    });
    expect(out.missingDocuments.length).toBe(9);
    expect(out.requiredDocuments.length).toBe(out.missingDocuments.length);
  });

  it('DG-09-02: missing docs emit [CRITICAL] warnings', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: [],
    });
    const criticals = out.warnings.filter(w => w.startsWith('[CRITICAL]'));
    expect(criticals.length).toBeGreaterThan(0);
  });

  it('DG-09-03: partial dossier — only missing docs appear in missingDocuments', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ['to-trinh', 'khlcnt', 'hsyc'],
    });
    const missingTypes = out.missingDocuments.map(d => d.docType);
    expect(missingTypes).not.toContain('to-trinh');
    expect(missingTypes).not.toContain('khlcnt');
    expect(missingTypes).toContain('quyet-dinh-phe-duyet');
  });
});

// ─── DG-10 · Timeline ─────────────────────────────────────────────────────────

describe('DG-10 · Timeline', () => {
  it('DG-10-01: timeline length equals requiredDocuments length', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    expect(out.timeline.length).toBe(out.requiredDocuments.length);
  });

  it('DG-10-02: stages are in lifecycle order (sortOrder 0, 1, 2, …)', () => {
    const out    = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: [],
    });
    const orders = out.timeline.map(s => s.sortOrder);
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i]).toBe(i);
    }
  });

  it('DG-10-03: status=present for existing docs, status=missing for absent docs', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    const toTrinh = out.timeline.find(s => s.docType === 'to-trinh')!;
    const hsyc    = out.timeline.find(s => s.docType === 'hsyc')!;
    expect(toTrinh.status).toBe('present');
    expect(hsyc.status).toBe('missing');
  });
});

// ─── DG-11 · Risk ─────────────────────────────────────────────────────────────

describe('DG-11 · Risk', () => {
  it('DG-11-01: riskLevel is one of CRITICAL | HIGH | MEDIUM | LOW', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: [],
    });
    expect(VALID_RISK_LEVELS.has(out.riskLevel)).toBe(true);
  });

  it('DG-11-02: empty dossier riskLevel >= complete dossier riskLevel', () => {
    const RISK_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 } as const;
    const outEmpty    = generateDocuments({
      methodCode:        'chi-dinh-thau',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: [],
    });
    const outComplete = generateDocuments({
      methodCode:        'chi-dinh-thau',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          PKG_DATES,
      existingDocuments: ALL_DOCS_CHI_DINH,
    });
    const emptyRank    = RISK_RANK[outEmpty.riskLevel];
    const completeRank = RISK_RANK[outComplete.riskLevel];
    expect(emptyRank).toBeGreaterThanOrEqual(completeRank);
  });

  it('DG-11-03: riskScore is a non-negative integer', () => {
    const out = generateDocuments({
      methodCode:        'chao-hang-canh-tranh',
      fundingSourceName: 'von-vay-oda',
      pkgDates:          PKG_DATES,
      existingDocuments: ['to-trinh'],
    });
    expect(typeof out.riskScore).toBe('number');
    expect(out.riskScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(out.riskScore)).toBe(true); // weights are all integers
  });
});

// ─── DG-12 · Legal basis ──────────────────────────────────────────────────────

describe('DG-12 · Legal basis', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'dau-thau-rong-rai',
    fundingSourceName: 'ngan-sach-nha-nuoc',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-12-01: legalBasis array is non-empty', () => {
    const out = generateDocuments(input);
    expect(out.legalBasis.length).toBeGreaterThan(0);
  });

  it('DG-12-02: legalBasis contains at least one Vietnamese legal document name', () => {
    const out     = generateDocuments(input);
    const hasLegal = out.legalBasis.some(
      b => b.includes('Luật') || b.includes('Nghị định') || b.includes('Thông tư'),
    );
    expect(hasLegal).toBe(true);
  });

  it('DG-12-03: legalBasis strings are unique (no duplicates)', () => {
    const out   = generateDocuments(input);
    const unique = new Set(out.legalBasis);
    expect(unique.size).toBe(out.legalBasis.length);
  });
});

// ─── DG-13 · Deterministic output ────────────────────────────────────────────

describe('DG-13 · Deterministic output', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'chao-hang-canh-tranh',
    fundingSourceName: 'ngan-sach-nha-nuoc',
    pkgDates:          PKG_DATES,
    existingDocuments: ['to-trinh', 'khlcnt'],
  };

  it('DG-13-01: same input called twice yields identical output', () => {
    const out1 = generateDocuments(input);
    const out2 = generateDocuments(input);
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
  });

  it('DG-13-02: different methods yield different requiredDocuments', () => {
    const outFull  = generateDocuments(input);
    const outShort = generateDocuments({ ...input, methodCode: 'chi-dinh-thau-rut-gon' });
    expect(outFull.requiredDocuments.length).toBeGreaterThan(outShort.requiredDocuments.length);
  });

  it('DG-13-03: invalid methodCode throws a Vietnamese error', () => {
    expect(() =>
      generateDocuments({ ...input, methodCode: 'invalid-code' }),
    ).toThrow('Không nhận diện được hình thức');
  });
});

// ─── DG-14 · UTF-8 Vietnamese ────────────────────────────────────────────────

describe('DG-14 · UTF-8 Vietnamese', () => {
  const input: DocumentGeneratorInput = {
    methodCode:        'dau-thau-rong-rai',
    fundingSourceName: 'ngan-sach-nha-nuoc',
    pkgDates:          PKG_DATES,
    existingDocuments: [],
  };

  it('DG-14-01: requiredDocuments labels contain Vietnamese text (diacritic check)', () => {
    const out    = generateDocuments(input);
    const labels = out.requiredDocuments.map(d => d.label).join(' ');
    // "Tờ trình" contains ờ (U+1EDD) — a Vietnamese character.
    expect(labels).toContain('Tờ trình');
    expect(labels).toContain('Hợp đồng');
  });

  it('DG-14-02: warnings contain Vietnamese diacritical text', () => {
    const out      = generateDocuments(input);
    const allWarn  = out.warnings.join(' ');
    expect(allWarn).toMatch(/[àáâãèéêìíòóôõùúăđĩũơưăạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i);
  });

  it('DG-14-03: timeline stage labels are Vietnamese (contain Vietnamese diacritics)', () => {
    const out    = generateDocuments(input);
    const labels = out.timeline.map(s => s.label).join(' ');
    expect(labels).toContain('Hồ sơ yêu cầu');
    expect(labels).toContain('Biên bản nghiệm thu');
  });
});

// ─── DG-15 · Backward compatibility ──────────────────────────────────────────

describe('DG-15 · Backward compatibility', () => {
  it('DG-15-01: searchLegalIndex still works independently after generator is imported', () => {
    const results = searchLegalIndex('đấu thầu lựa chọn nhà thầu', { topK: 3, minScore: 1 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('DG-15-02: buildChecklist still works independently after generator is imported', () => {
    const result = buildChecklist({
      documentType:      'hop-dong',
      packageCategory:   'hang-hoa',
      procurementMethod: 'dau-thau-rong-rai',
      sourceOfFunds:     'ngan-sach-nha-nuoc',
      existingDocuments: ['to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet'],
    });
    expect(result.missingDocuments).toHaveLength(0);
    expect(result.completionScore).toBe(100);
  });

  it('DG-15-03: evaluateRisk still works independently after generator is imported', () => {
    const result = evaluateRisk({
      documentType:      'thanh-ly',
      procurementMethod: 'chi-dinh-thau-rut-gon',
      sourceOfFunds:     'von-tu-co',
      missingDocuments:  [],
      warnings:          [],
      completionScore:   100,
    });
    expect(result.riskLevel).toBe('LOW');
    expect(result.riskScore).toBe(0);
  });
});
