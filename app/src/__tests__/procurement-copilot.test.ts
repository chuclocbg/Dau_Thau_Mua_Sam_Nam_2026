/**
 * Legal v3.3 — Procurement Copilot Tests
 *
 * 21 groups × 3 = 63 tests  (PC-01..PC-21 × 3)
 *
 * Groups:
 *   PC-01  open bidding
 *   PC-02  direct appointment
 *   PC-03  abbreviated direct appointment
 *   PC-04  state budget
 *   PC-05  enterprise source
 *   PC-06  complete package
 *   PC-07  missing documents
 *   PC-08  contract problems
 *   PC-09  recommendations
 *   PC-10  legal basis
 *   PC-11  timeline
 *   PC-12  generated documents
 *   PC-13  risk propagation
 *   PC-14  completion score
 *   PC-15  warnings
 *   PC-16  deterministic output
 *   PC-17  UTF-8 Vietnamese
 *   PC-18  empty input
 *   PC-19  backward compatibility
 *   PC-20  multiple findings
 *   PC-21  aggregate response shape
 *
 * Pure .ts — no React, no renderToString.
 */

import { describe, it, expect } from 'vitest';
import { runCopilot, type ProcurementCopilotInput } from '../ai/procurementCopilot';
import { generateDocuments }  from '../ai/documentGenerator';
import { reviewContract }     from '../ai/contractReviewer';
import { searchLegalIndex }   from '../ai/searchLegalIndex';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** Every clause ID the reviewer knows about. */
const FULL_CLAUSES = [
  'doi-tuong', 'gia-tri', 'thoi-han', 'thanh-toan',
  'nghiem-thu', 'phat-vi-pham', 'bat-kha-khang', 'tranh-chap',
  'bao-hanh', 'bao-dam-thuc-hien', 'dieu-chinh-gia', 'tuan-thu-nha-tai-tro',
];

/** All 9 lifecycle docs for dau-thau-rong-rai / chao-hang-canh-tranh / mua-sam-truc-tiep. */
const ALL_DOCS_FULL = [
  'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

/** All 7 lifecycle docs for chi-dinh-thau. */
const ALL_DOCS_CHI_DINH = [
  'to-trinh', 'quyet-dinh-phe-duyet',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

/** All 6 lifecycle docs for chi-dinh-thau-rut-gon. */
const ALL_DOCS_RUT_GON = [
  'to-trinh',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
];

/** Happy-path base: open bidding, state budget, lump-sum, all docs + all clauses. */
const BASE: ProcurementCopilotInput = {
  procurementMethod: 'dau-thau-rong-rai',
  fundingSource:     'ngan-sach-nha-nuoc',
  contractType:      'tron-goi',
  packageValue:      100_000_000,
  durationDays:      180,
  existingDocuments: ALL_DOCS_FULL,
  clauses:           FULL_CLAUSES,
};

function override(patch: Partial<ProcurementCopilotInput>): ProcurementCopilotInput {
  return { ...BASE, ...patch };
}

function hasVietnamese(s: string): boolean {
  return !/^[\x00-\x7F]*$/.test(s);
}

// ─── PC-01: open bidding ──────────────────────────────────────────────────────

describe('PC-01: open bidding (dau-thau-rong-rai)', () => {
  it('PC-01-01: requiredDocuments.length === 9', () => {
    expect(runCopilot(BASE).requiredDocuments.length).toBe(9);
  });

  it('PC-01-02: no TYPE_MISMATCH in contractFindings for tron-goi + dau-thau-rong-rai', () => {
    expect(runCopilot(BASE).contractFindings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('PC-01-03: portal publication warning present in warnings', () => {
    expect(runCopilot(BASE).warnings.some(w => w.includes('mạng đấu thầu quốc gia'))).toBe(true);
  });
});

// ─── PC-02: direct appointment ───────────────────────────────────────────────

describe('PC-02: direct appointment (chi-dinh-thau)', () => {
  const INPUT = override({ procurementMethod: 'chi-dinh-thau', existingDocuments: ALL_DOCS_CHI_DINH });

  it('PC-02-01: requiredDocuments.length === 7', () => {
    expect(runCopilot(INPUT).requiredDocuments.length).toBe(7);
  });

  it('PC-02-02: no khlcnt or hsyc in requiredDocuments', () => {
    const ids = runCopilot(INPUT).requiredDocuments.map(d => d.docType);
    expect(ids).not.toContain('khlcnt');
    expect(ids).not.toContain('hsyc');
  });

  it('PC-02-03: riskLevel is one of the four valid levels', () => {
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(runCopilot(INPUT).riskLevel);
  });
});

// ─── PC-03: abbreviated direct appointment ───────────────────────────────────

describe('PC-03: abbreviated direct appointment (chi-dinh-thau-rut-gon)', () => {
  const INPUT = override({ procurementMethod: 'chi-dinh-thau-rut-gon', existingDocuments: ALL_DOCS_RUT_GON });

  it('PC-03-01: requiredDocuments.length === 6', () => {
    expect(runCopilot(INPUT).requiredDocuments.length).toBe(6);
  });

  it('PC-03-02: no khlcnt / hsyc / quyet-dinh-phe-duyet in requiredDocuments', () => {
    const ids = runCopilot(INPUT).requiredDocuments.map(d => d.docType);
    expect(ids).not.toContain('khlcnt');
    expect(ids).not.toContain('hsyc');
    expect(ids).not.toContain('quyet-dinh-phe-duyet');
  });

  it('PC-03-03: high-value rut-gon (200M) → ceiling warning in warnings', () => {
    const out = runCopilot(override({
      procurementMethod: 'chi-dinh-thau-rut-gon',
      packageValue:      200_000_000,
    }));
    expect(out.warnings.some(w => w.includes('rút gọn'))).toBe(true);
  });
});

// ─── PC-04: state budget ─────────────────────────────────────────────────────

describe('PC-04: state budget (ngan-sach-nha-nuoc)', () => {
  it('PC-04-01: legalBasis non-empty', () => {
    expect(runCopilot(BASE).legalBasis.length).toBeGreaterThan(0);
  });

  it('PC-04-02: missing bao-dam-thuc-hien → HIGH contractFinding', () => {
    const out = runCopilot(override({ clauses: FULL_CLAUSES.filter(c => c !== 'bao-dam-thuc-hien') }));
    const f   = out.contractFindings.find(x => x.message.includes('Bảo đảm thực hiện'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('PC-04-03: bao-dam-thuc-hien present → no bảo đảm contractFinding', () => {
    expect(runCopilot(BASE).contractFindings.some(f => f.message.includes('Bảo đảm thực hiện'))).toBe(false);
  });
});

// ─── PC-05: enterprise source ────────────────────────────────────────────────

describe('PC-05: enterprise source (von-tu-co)', () => {
  it('PC-05-01: von-tu-co → no FUND_CLAUSE contractFindings', () => {
    expect(runCopilot(override({ fundingSource: 'von-tu-co' })).contractFindings
      .some(f => f.code === 'FUND_CLAUSE')).toBe(false);
  });

  it('PC-05-02: von-tu-co → no ODA warnings', () => {
    expect(runCopilot(override({ fundingSource: 'von-tu-co' })).warnings
      .some(w => w.toLowerCase().includes('oda'))).toBe(false);
  });

  it('PC-05-03: von-tu-co + 100M + missing bao-dam-thuc-hien → value-based contractFinding', () => {
    const out = runCopilot(override({
      fundingSource: 'von-tu-co',
      packageValue:  100_000_000,
      clauses:       FULL_CLAUSES.filter(c => c !== 'bao-dam-thuc-hien'),
    }));
    expect(out.contractFindings.some(f => f.message.includes('Bảo đảm thực hiện'))).toBe(true);
  });
});

// ─── PC-06: complete package ─────────────────────────────────────────────────

describe('PC-06: complete package (all docs present)', () => {
  it('PC-06-01: missingDocuments.length === 0', () => {
    expect(runCopilot(BASE).missingDocuments).toHaveLength(0);
  });

  it('PC-06-02: completionScore === 100', () => {
    expect(runCopilot(BASE).completionScore).toBe(100);
  });

  it('PC-06-03: generatedDocuments.length === 9', () => {
    expect(runCopilot(BASE).generatedDocuments.length).toBe(9);
  });
});

// ─── PC-07: missing documents ────────────────────────────────────────────────

describe('PC-07: missing documents', () => {
  it('PC-07-01: missing hop-dong → appears in missingDocuments', () => {
    const out = runCopilot(override({ existingDocuments: ALL_DOCS_FULL.filter(d => d !== 'hop-dong') }));
    expect(out.missingDocuments.some(d => d.docType === 'hop-dong')).toBe(true);
  });

  it('PC-07-02: missingDocuments entries each have non-empty docType and label', () => {
    const out = runCopilot(override({ existingDocuments: [] }));
    expect(out.missingDocuments.length).toBeGreaterThan(0);
    for (const d of out.missingDocuments) {
      expect(typeof d.docType).toBe('string');
      expect(d.docType.length).toBeGreaterThan(0);
      expect(typeof d.label).toBe('string');
      expect(d.label.length).toBeGreaterThan(0);
    }
  });

  it('PC-07-03: missing docs → completionScore < 100', () => {
    const out = runCopilot(override({ existingDocuments: ALL_DOCS_FULL.filter(d => d !== 'hop-dong') }));
    expect(out.completionScore).toBeLessThan(100);
  });
});

// ─── PC-08: contract problems ────────────────────────────────────────────────

describe('PC-08: contract problems', () => {
  it('PC-08-01: ket-hop + chi-dinh-thau-rut-gon → TYPE_MISMATCH in contractFindings', () => {
    const out = runCopilot(override({
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    }));
    expect(out.contractFindings.some(f => f.code === 'TYPE_MISMATCH')).toBe(true);
  });

  it('PC-08-02: clauses: [] → contractFindings non-empty', () => {
    expect(runCopilot(override({ clauses: [] })).contractFindings.length).toBeGreaterThan(0);
  });

  it('PC-08-03: all contractFinding severities are valid', () => {
    const out = runCopilot(override({ clauses: [] }));
    for (const f of out.contractFindings) {
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(f.severity);
    }
  });
});

// ─── PC-09: recommendations ──────────────────────────────────────────────────

describe('PC-09: recommendations', () => {
  it('PC-09-01: missing bao-hanh → recommendation to add "Bảo hành"', () => {
    const out = runCopilot(override({ clauses: FULL_CLAUSES.filter(c => c !== 'bao-hanh') }));
    expect(out.recommendations.some(r => r.includes('Bảo hành'))).toBe(true);
  });

  it('PC-09-02: recommendations array is non-empty', () => {
    expect(runCopilot(BASE).recommendations.length).toBeGreaterThan(0);
  });

  it('PC-09-03: recommendations contain Vietnamese text (diacritics)', () => {
    expect(runCopilot(BASE).recommendations.some(hasVietnamese)).toBe(true);
  });
});

// ─── PC-10: legal basis ──────────────────────────────────────────────────────

describe('PC-10: legal basis', () => {
  it('PC-10-01: legalBasis is non-empty', () => {
    expect(runCopilot(BASE).legalBasis.length).toBeGreaterThan(0);
  });

  it('PC-10-02: legalBasis entries are unique (no duplicates)', () => {
    const out  = runCopilot(BASE);
    const uniq = [...new Set(out.legalBasis)];
    expect(out.legalBasis).toHaveLength(uniq.length);
  });

  it('PC-10-03: copilot legalBasis is a superset of documentGenerator legalBasis', () => {
    const out    = runCopilot(BASE);
    const docGen = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          { start: '2026-01-01', end: '2026-12-31' },
      existingDocuments: ALL_DOCS_FULL,
    });
    const copilotSet = new Set(out.legalBasis);
    for (const citation of docGen.legalBasis) {
      expect(copilotSet.has(citation)).toBe(true);
    }
  });
});

// ─── PC-11: timeline ─────────────────────────────────────────────────────────

describe('PC-11: timeline', () => {
  it('PC-11-01: timeline.length === requiredDocuments.length', () => {
    const out = runCopilot(BASE);
    expect(out.timeline.length).toBe(out.requiredDocuments.length);
  });

  it('PC-11-02: each stage has docType, label, status, sortOrder of correct types', () => {
    const out = runCopilot(BASE);
    for (const stage of out.timeline) {
      expect(typeof stage.docType).toBe('string');
      expect(typeof stage.label).toBe('string');
      expect(['present', 'missing']).toContain(stage.status);
      expect(typeof stage.sortOrder).toBe('number');
    }
  });

  it('PC-11-03: present docs → status "present"; absent docs → status "missing"', () => {
    const partial = ['to-trinh', 'hop-dong'];
    const out = runCopilot(override({ existingDocuments: partial }));
    for (const stage of out.timeline) {
      const expected = partial.includes(stage.docType) ? 'present' : 'missing';
      expect(stage.status).toBe(expected);
    }
  });
});

// ─── PC-12: generated documents ──────────────────────────────────────────────

describe('PC-12: generated documents', () => {
  it('PC-12-01: generatedDocuments is an array of strings', () => {
    const out = runCopilot(BASE);
    expect(Array.isArray(out.generatedDocuments)).toBe(true);
    for (const d of out.generatedDocuments) expect(typeof d).toBe('string');
  });

  it('PC-12-02: generatedDocuments = existingDocuments ∩ requiredDocuments (order by lifecycle)', () => {
    const partial = ['to-trinh', 'hop-dong', 'thanh-ly'];
    const out     = runCopilot(override({ existingDocuments: partial }));
    const reqIds  = new Set(out.requiredDocuments.map(d => d.docType));
    const expected = partial.filter(d => reqIds.has(d as any));
    expect(out.generatedDocuments).toEqual(expect.arrayContaining(expected));
    expect(out.generatedDocuments.length).toBe(expected.length);
  });

  it('PC-12-03: existingDocuments: [] → generatedDocuments is empty', () => {
    expect(runCopilot(override({ existingDocuments: [] })).generatedDocuments).toHaveLength(0);
  });
});

// ─── PC-13: risk propagation ─────────────────────────────────────────────────

describe('PC-13: risk propagation', () => {
  it('PC-13-01: CRITICAL contract finding (durationDays = 0) → riskLevel = CRITICAL', () => {
    expect(runCopilot(override({ durationDays: 0 })).riskLevel).toBe('CRITICAL');
  });

  it('PC-13-02: full docs + full clauses + valid duration → riskLevel ≤ MEDIUM', () => {
    // BASE: all docs present, all clauses present, no contract issues.
    // Only contextual warnings (portal); no CRITICAL/HIGH findings → riskLevel LOW or MEDIUM.
    expect(['LOW', 'MEDIUM']).toContain(runCopilot(BASE).riskLevel);
  });

  it('PC-13-03: TYPE_MISMATCH (HIGH) + empty docs → riskLevel ≥ HIGH', () => {
    const out = runCopilot(override({
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
      existingDocuments: [],
    }));
    expect(['CRITICAL', 'HIGH']).toContain(out.riskLevel);
  });
});

// ─── PC-14: completion score ─────────────────────────────────────────────────

describe('PC-14: completion score', () => {
  it('PC-14-01: all lifecycle docs present → completionScore === 100', () => {
    expect(runCopilot(BASE).completionScore).toBe(100);
  });

  it('PC-14-02: no docs present → completionScore === 0', () => {
    expect(runCopilot(override({ existingDocuments: [] })).completionScore).toBe(0);
  });

  it('PC-14-03: 3 of 6 rut-gon lifecycle docs present → completionScore === 50', () => {
    // chi-dinh-thau-rut-gon has 6 lifecycle docs; provide exactly 3.
    const out = runCopilot(override({
      procurementMethod: 'chi-dinh-thau-rut-gon',
      existingDocuments: ['to-trinh', 'hop-dong', 'bien-ban-nghiem-thu'],
    }));
    expect(out.completionScore).toBe(50);
  });
});

// ─── PC-15: warnings ─────────────────────────────────────────────────────────

describe('PC-15: warnings', () => {
  it('PC-15-01: warnings include both document-gap and contract-context warnings', () => {
    // existingDocuments:[] → missing-doc warnings; dau-thau-rong-rai → portal warning
    const out = runCopilot(override({ existingDocuments: [] }));
    expect(out.warnings.some(w => w.includes('mạng đấu thầu quốc gia'))).toBe(true);  // contract
    expect(out.warnings.some(w => w.includes('Thiếu'))).toBe(true);                    // docGen
  });

  it('PC-15-02: warnings are deduplicated (no exact duplicates)', () => {
    const out  = runCopilot(BASE);
    const uniq = [...new Set(out.warnings)];
    expect(out.warnings).toHaveLength(uniq.length);
  });

  it('PC-15-03: warnings contain Vietnamese text (diacritics)', () => {
    const out = runCopilot(BASE);
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.warnings.some(hasVietnamese)).toBe(true);
  });
});

// ─── PC-16: deterministic output ─────────────────────────────────────────────

describe('PC-16: deterministic output', () => {
  it('PC-16-01: identical input × 2 → identical JSON output', () => {
    expect(JSON.stringify(runCopilot(BASE))).toBe(JSON.stringify(runCopilot(BASE)));
  });

  it('PC-16-02: different procurementMethod → different requiredDocuments', () => {
    const a = runCopilot(BASE);
    const b = runCopilot(override({ procurementMethod: 'chi-dinh-thau', existingDocuments: ALL_DOCS_CHI_DINH }));
    expect(JSON.stringify(a.requiredDocuments)).not.toBe(JSON.stringify(b.requiredDocuments));
  });

  it('PC-16-03: different contractType → different contractFindings', () => {
    const a = runCopilot(BASE);
    const b = runCopilot(override({ contractType: 'ket-hop', procurementMethod: 'chi-dinh-thau-rut-gon' }));
    expect(JSON.stringify(a.contractFindings)).not.toBe(JSON.stringify(b.contractFindings));
  });
});

// ─── PC-17: UTF-8 Vietnamese ─────────────────────────────────────────────────

describe('PC-17: UTF-8 Vietnamese', () => {
  it('PC-17-01: requiredDocuments[0].label contains Vietnamese diacritics', () => {
    const out = runCopilot(BASE);
    expect(out.requiredDocuments.length).toBeGreaterThan(0);
    expect(hasVietnamese(out.requiredDocuments[0].label)).toBe(true);
  });

  it('PC-17-02: recommendations contain Vietnamese diacritics', () => {
    expect(runCopilot(BASE).recommendations.some(hasVietnamese)).toBe(true);
  });

  it('PC-17-03: warnings contain Vietnamese diacritics', () => {
    expect(runCopilot(BASE).warnings.some(hasVietnamese)).toBe(true);
  });
});

// ─── PC-18: empty input ──────────────────────────────────────────────────────

describe('PC-18: empty input', () => {
  it('PC-18-01: existingDocuments: [] → missingDocuments.length === requiredDocuments.length', () => {
    const out = runCopilot(override({ existingDocuments: [] }));
    expect(out.missingDocuments.length).toBe(out.requiredDocuments.length);
  });

  it('PC-18-02: clauses: [] → contractFindings.length >= 8 (all universal clauses missing)', () => {
    expect(runCopilot(override({ clauses: [] })).contractFindings.length).toBeGreaterThanOrEqual(8);
  });

  it('PC-18-03: existingDocuments: [] → completionScore === 0', () => {
    expect(runCopilot(override({ existingDocuments: [] })).completionScore).toBe(0);
  });
});

// ─── PC-19: backward compatibility ───────────────────────────────────────────

describe('PC-19: backward compatibility', () => {
  it('PC-19-01: generateDocuments still works independently', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          { start: '2026-01-01', end: '2026-12-31' },
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    expect(out.requiredDocuments.length).toBeGreaterThan(0);
  });

  it('PC-19-02: reviewContract still works independently', () => {
    const out = reviewContract({
      contractType:      'tron-goi',
      procurementMethod: 'dau-thau-rong-rai',
      fundingSource:     'ngan-sach-nha-nuoc',
      durationDays:      180,
      clauses:           FULL_CLAUSES,
      packageValue:      100_000_000,
    });
    expect(Array.isArray(out.findings)).toBe(true);
  });

  it('PC-19-03: searchLegalIndex still works independently', () => {
    const results = searchLegalIndex('đấu thầu mua sắm lựa chọn nhà thầu', { topK: 3, minScore: 1 });
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─── PC-20: multiple findings ────────────────────────────────────────────────

describe('PC-20: multiple findings', () => {
  it('PC-20-01: empty clauses + type mismatch + zero duration → contractFindings.length > 3', () => {
    const out = runCopilot(override({
      clauses:           [],
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
      durationDays:      0,
    }));
    expect(out.contractFindings.length).toBeGreaterThan(3);
  });

  it('PC-20-02: CRITICAL contract finding (durationDays = 0) → riskLevel = CRITICAL', () => {
    expect(runCopilot(override({ durationDays: 0 })).riskLevel).toBe('CRITICAL');
  });

  it('PC-20-03: multiple issues → recommendations.length > 3', () => {
    const out = runCopilot(override({
      clauses:           [],
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
      existingDocuments: [],
    }));
    expect(out.recommendations.length).toBeGreaterThan(3);
  });
});

// ─── PC-21: aggregate response shape ─────────────────────────────────────────

describe('PC-21: aggregate response shape', () => {
  it('PC-21-01: all 12 output fields are present', () => {
    const out = runCopilot(BASE);
    const fields: (keyof typeof out)[] = [
      'requiredDocuments', 'missingDocuments', 'applicableDocuments',
      'legalBasis', 'warnings', 'recommendations',
      'riskLevel', 'riskScore', 'completionScore',
      'generatedDocuments', 'contractFindings', 'timeline',
    ];
    for (const f of fields) expect(out).toHaveProperty(f);
  });

  it('PC-21-02: array fields are arrays; numeric fields are numbers; riskLevel is string', () => {
    const out = runCopilot(BASE);
    const arrayFields = [
      'requiredDocuments', 'missingDocuments', 'applicableDocuments',
      'legalBasis', 'warnings', 'recommendations',
      'generatedDocuments', 'contractFindings', 'timeline',
    ] as const;
    for (const f of arrayFields) expect(Array.isArray(out[f])).toBe(true);
    expect(typeof out.riskScore).toBe('number');
    expect(typeof out.completionScore).toBe('number');
    expect(typeof out.riskLevel).toBe('string');
  });

  it('PC-21-03: riskLevel is one of CRITICAL / HIGH / MEDIUM / LOW', () => {
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(runCopilot(BASE).riskLevel);
  });
});
