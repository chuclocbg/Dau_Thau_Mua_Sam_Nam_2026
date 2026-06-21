/**
 * Legal v3.2 — Contract Reviewer Engine Tests
 *
 * 15 groups × 3 = 45 tests  (CR-01..CR-15 × 3)
 *
 * Groups:
 *   CR-01  Mandatory clause missing
 *   CR-02  Open bidding (dau-thau-rong-rai)
 *   CR-03  Direct appointment (chi-dinh-thau)
 *   CR-04  Abbreviated direct appointment (chi-dinh-thau-rut-gon)
 *   CR-05  State budget (ngan-sach-nha-nuoc)
 *   CR-06  Enterprise / self-funded (von-tu-co)
 *   CR-07  Duration validation
 *   CR-08  Contract type mismatch
 *   CR-09  Recommendations
 *   CR-10  Legal basis
 *   CR-11  UTF-8 Vietnamese in output
 *   CR-12  Deterministic output
 *   CR-13  Backward compatibility (other engines unaffected)
 *   CR-14  Empty / minimal input
 *   CR-15  Multiple findings + severity aggregation
 *
 * Pure .ts — no React, no renderToString.
 */

import { describe, it, expect } from 'vitest';
import {
  reviewContract,
  type ContractReviewerInput,
  type ContractType,
} from '../ai/contractReviewer';
import { searchLegalIndex }   from '../ai/searchLegalIndex';
import { extractCitations }   from '../ai/legalCitationEngine';
import { generateDocuments }  from '../ai/documentGenerator';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** All known clause IDs — covers universal + type-specific + fund-specific. */
const FULL_CLAUSES = [
  'doi-tuong', 'gia-tri', 'thoi-han', 'thanh-toan',
  'nghiem-thu', 'phat-vi-pham', 'bat-kha-khang', 'tranh-chap',
  'bao-hanh', 'bao-dam-thuc-hien', 'dieu-chinh-gia', 'tuan-thu-nha-tai-tro',
];

/** Base happy-path input — passes all clause checks. */
const BASE: ContractReviewerInput = {
  contractType:      'tron-goi',
  procurementMethod: 'dau-thau-rong-rai',
  fundingSource:     'ngan-sach-nha-nuoc',
  durationDays:      180,
  clauses:           FULL_CLAUSES,
  packageValue:      100_000_000,   // 100 million VND > 50M threshold
};

/** Returns a copy of BASE with specific fields overridden. */
function override(patch: Partial<ContractReviewerInput>): ContractReviewerInput {
  return { ...BASE, ...patch };
}

/** Returns a clause list with the specified IDs removed. */
function without(...ids: string[]): string[] {
  const ex = new Set(ids);
  return FULL_CLAUSES.filter(c => !ex.has(c));
}

/** True iff the string contains at least one non-ASCII character (Vietnamese diacritic). */
function hasVietnamese(s: string): boolean {
  return !/^[\x00-\x7F]*$/.test(s);
}

// ─── CR-01: Mandatory clause missing ──────────────────────────────────────────

describe('CR-01: mandatory clause missing', () => {
  it('CR-01-01: missing universal clause (doi-tuong) → CRITICAL finding', () => {
    const out = reviewContract(override({ clauses: without('doi-tuong') }));
    const f   = out.findings.find(x => x.message.includes('Đối tượng hợp đồng'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('CRITICAL');
  });

  it('CR-01-02: missing type-specific clause (bao-hanh for tron-goi) → HIGH finding', () => {
    const out = reviewContract(override({ clauses: without('bao-hanh') }));
    const f   = out.findings.find(x => x.message.includes('Bảo hành'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-01-03: all clauses present → no MISSING_CLAUSE or FUND_CLAUSE findings', () => {
    const out = reviewContract(BASE);
    const clause_findings = out.findings.filter(
      f => f.code === 'MISSING_CLAUSE' || f.code === 'FUND_CLAUSE',
    );
    expect(clause_findings).toHaveLength(0);
  });
});

// ─── CR-02: Open bidding ───────────────────────────────────────────────────────

describe('CR-02: open bidding (dau-thau-rong-rai)', () => {
  it('CR-02-01: dau-thau-rong-rai + tron-goi → no TYPE_MISMATCH', () => {
    const out = reviewContract(BASE);
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('CR-02-02: dau-thau-rong-rai + theo-thoi-gian → no TYPE_MISMATCH', () => {
    const out = reviewContract(
      override({ contractType: 'theo-thoi-gian', procurementMethod: 'dau-thau-rong-rai' }),
    );
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('CR-02-03: dau-thau-rong-rai → portal publication warning present in warnings', () => {
    const out = reviewContract(BASE);
    expect(out.warnings.some(w => w.includes('mạng đấu thầu quốc gia'))).toBe(true);
  });
});

// ─── CR-03: Direct appointment ────────────────────────────────────────────────

describe('CR-03: direct appointment (chi-dinh-thau)', () => {
  it('CR-03-01: chi-dinh-thau + tron-goi → no TYPE_MISMATCH', () => {
    const out = reviewContract(override({ procurementMethod: 'chi-dinh-thau' }));
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('CR-03-02: chi-dinh-thau + theo-don-gia-dieu-chinh → HIGH TYPE_MISMATCH', () => {
    const out = reviewContract(override({
      contractType:      'theo-don-gia-dieu-chinh',
      procurementMethod: 'chi-dinh-thau',
    }));
    const f = out.findings.find(x => x.code === 'TYPE_MISMATCH');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-03-03: chi-dinh-thau + theo-thoi-gian → no TYPE_MISMATCH', () => {
    const out = reviewContract(override({
      contractType:      'theo-thoi-gian',
      procurementMethod: 'chi-dinh-thau',
    }));
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });
});

// ─── CR-04: Abbreviated direct appointment ────────────────────────────────────

describe('CR-04: abbreviated direct appointment (chi-dinh-thau-rut-gon)', () => {
  it('CR-04-01: rut-gon + tron-goi → no TYPE_MISMATCH', () => {
    const out = reviewContract(override({ procurementMethod: 'chi-dinh-thau-rut-gon' }));
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('CR-04-02: rut-gon + theo-don-gia-dieu-chinh → HIGH TYPE_MISMATCH', () => {
    const out = reviewContract(override({
      contractType:      'theo-don-gia-dieu-chinh',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    }));
    const f = out.findings.find(x => x.code === 'TYPE_MISMATCH');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-04-03: rut-gon + packageValue > 100M → [HIGH] ceiling warning in warnings', () => {
    const out = reviewContract(override({
      procurementMethod: 'chi-dinh-thau-rut-gon',
      packageValue:      200_000_000,  // 200M > 100M threshold
    }));
    expect(out.warnings.some(w => w.startsWith('[HIGH]') && w.includes('rút gọn'))).toBe(true);
  });
});

// ─── CR-05: State budget ──────────────────────────────────────────────────────

describe('CR-05: state budget (ngan-sach-nha-nuoc)', () => {
  it('CR-05-01: ngan-sach + missing bao-dam-thuc-hien → FUND_CLAUSE or MISSING_CLAUSE HIGH finding', () => {
    const out = reviewContract(override({ clauses: without('bao-dam-thuc-hien') }));
    const f   = out.findings.find(x => x.message.includes('Bảo đảm thực hiện'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-05-02: ngan-sach + bao-dam-thuc-hien present → no bảo đảm finding', () => {
    const out = reviewContract(BASE);   // FULL_CLAUSES has bao-dam-thuc-hien
    expect(out.findings.some(f => f.message.includes('Bảo đảm thực hiện'))).toBe(false);
  });

  it('CR-05-03: ngan-sach + packageValue > 50M + missing bao-dam-thuc-hien → exactly ONE bảo đảm finding (deduped)', () => {
    const out     = reviewContract(override({ clauses: without('bao-dam-thuc-hien') }));
    const matches = out.findings.filter(f => f.message.includes('Bảo đảm thực hiện'));
    expect(matches).toHaveLength(1);
  });
});

// ─── CR-06: Enterprise / self-funded ─────────────────────────────────────────

describe('CR-06: enterprise / self-funded (von-tu-co)', () => {
  it('CR-06-01: von-tu-co → no FUND_CLAUSE findings at all', () => {
    const out = reviewContract(override({ fundingSource: 'von-tu-co' }));
    expect(out.findings.some(f => f.code === 'FUND_CLAUSE')).toBe(false);
  });

  it('CR-06-02: von-tu-co → no ODA warning in warnings', () => {
    const out = reviewContract(override({ fundingSource: 'von-tu-co' }));
    expect(out.warnings.some(w => w.toLowerCase().includes('oda'))).toBe(false);
  });

  it('CR-06-03: von-tu-co + packageValue > 50M + missing bao-dam-thuc-hien → value-based finding exists', () => {
    const out = reviewContract(override({
      fundingSource: 'von-tu-co',
      packageValue:  100_000_000,
      clauses:       without('bao-dam-thuc-hien'),
    }));
    expect(out.findings.some(f => f.message.includes('Bảo đảm thực hiện'))).toBe(true);
  });
});

// ─── CR-07: Duration validation ───────────────────────────────────────────────

describe('CR-07: duration validation', () => {
  it('CR-07-01: tron-goi + 400 days (9.6% over max 365) → MEDIUM DURATION_EXCEEDED', () => {
    const out = reviewContract(override({ durationDays: 400 }));
    const f   = out.findings.find(x => x.code === 'DURATION_EXCEEDED');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('MEDIUM');
  });

  it('CR-07-02: tron-goi + 600 days (64% over max 365) → HIGH DURATION_EXCEEDED', () => {
    const out = reviewContract(override({ durationDays: 600 }));
    const f   = out.findings.find(x => x.code === 'DURATION_EXCEEDED');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-07-03: durationDays = 0 → CRITICAL DURATION_INVALID', () => {
    const out = reviewContract(override({ durationDays: 0 }));
    const f   = out.findings.find(x => x.code === 'DURATION_INVALID');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('CRITICAL');
  });
});

// ─── CR-08: Contract type mismatch ────────────────────────────────────────────

describe('CR-08: contract type mismatch', () => {
  it('CR-08-01: chao-hang-canh-tranh + theo-thoi-gian → HIGH TYPE_MISMATCH', () => {
    const out = reviewContract(override({
      contractType:      'theo-thoi-gian',
      procurementMethod: 'chao-hang-canh-tranh',
    }));
    const f = out.findings.find(x => x.code === 'TYPE_MISMATCH');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('CR-08-02: chao-hang-canh-tranh + tron-goi → no TYPE_MISMATCH', () => {
    const out = reviewContract(override({ procurementMethod: 'chao-hang-canh-tranh' }));
    expect(out.findings.some(f => f.code === 'TYPE_MISMATCH')).toBe(false);
  });

  it('CR-08-03: chi-dinh-thau-rut-gon + ket-hop → HIGH TYPE_MISMATCH', () => {
    const out = reviewContract(override({
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    }));
    const f = out.findings.find(x => x.code === 'TYPE_MISMATCH');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });
});

// ─── CR-09: Recommendations ───────────────────────────────────────────────────

describe('CR-09: recommendations', () => {
  it('CR-09-01: missing doi-tuong → recommendation to add "Đối tượng hợp đồng"', () => {
    const out = reviewContract(override({ clauses: without('doi-tuong') }));
    expect(out.recommendations.some(r => r.includes('Đối tượng hợp đồng'))).toBe(true);
  });

  it('CR-09-02: TYPE_MISMATCH → recommendation suggests compatible contract type', () => {
    const out = reviewContract(override({
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',
    }));
    expect(out.recommendations.some(r => r.includes('Chuyển sang loại hợp đồng'))).toBe(true);
  });

  it('CR-09-03: DURATION_EXCEEDED → recommendation to reduce duration or split', () => {
    const out = reviewContract(override({ durationDays: 600 }));
    expect(out.recommendations.some(r => r.includes('Rút ngắn thời hạn'))).toBe(true);
  });
});

// ─── CR-10: Legal basis ───────────────────────────────────────────────────────

describe('CR-10: legal basis', () => {
  it('CR-10-01: legalBasis array is non-empty', () => {
    const out = reviewContract(BASE);
    expect(out.legalBasis.length).toBeGreaterThan(0);
  });

  it('CR-10-02: every legalBasis entry has content (non-empty string)', () => {
    const out = reviewContract(BASE);
    expect(out.legalBasis.every(s => s.length > 0)).toBe(true);
  });

  it('CR-10-03: legalBasis entries are unique (no duplicates)', () => {
    const out  = reviewContract(BASE);
    const uniq = [...new Set(out.legalBasis)];
    expect(out.legalBasis).toHaveLength(uniq.length);
  });
});

// ─── CR-11: UTF-8 Vietnamese in output ───────────────────────────────────────

describe('CR-11: UTF-8 Vietnamese in output', () => {
  it('CR-11-01: finding messages contain Vietnamese diacritics', () => {
    const out = reviewContract(override({ clauses: without('doi-tuong') }));
    expect(out.findings.length).toBeGreaterThan(0);
    expect(hasVietnamese(out.findings[0].message)).toBe(true);
  });

  it('CR-11-02: warnings contain Vietnamese text', () => {
    const out = reviewContract(BASE);
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(hasVietnamese(out.warnings[0])).toBe(true);
  });

  it('CR-11-03: recommendations contain Vietnamese text', () => {
    const out = reviewContract(override({ clauses: without('doi-tuong') }));
    expect(out.recommendations.length).toBeGreaterThan(0);
    expect(hasVietnamese(out.recommendations[0])).toBe(true);
  });
});

// ─── CR-12: Deterministic output ─────────────────────────────────────────────

describe('CR-12: deterministic output', () => {
  it('CR-12-01: identical input always produces identical JSON output', () => {
    const a = reviewContract(BASE);
    const b = reviewContract(BASE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('CR-12-02: different contractType produces different output', () => {
    const a = reviewContract(BASE);
    const b = reviewContract(override({ contractType: 'theo-thoi-gian' }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('CR-12-03: different procurementMethod produces different output', () => {
    const a = reviewContract(BASE);
    const b = reviewContract(override({ procurementMethod: 'chi-dinh-thau' }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

// ─── CR-13: Backward compatibility ────────────────────────────────────────────

describe('CR-13: backward compatibility (other engines unaffected)', () => {
  it('CR-13-01: searchLegalIndex still works independently', () => {
    const results = searchLegalIndex('đấu thầu mua sắm lựa chọn nhà thầu', { topK: 3, minScore: 1 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('CR-13-02: extractCitations still works independently', () => {
    const results     = searchLegalIndex('đấu thầu rộng rãi', { topK: 3, minScore: 1 });
    const citations   = extractCitations(results);
    expect(Array.isArray(citations)).toBe(true);
  });

  it('CR-13-03: documentGenerator (Legal v3.1) still returns valid output', () => {
    const out = generateDocuments({
      methodCode:        'dau-thau-rong-rai',
      fundingSourceName: 'ngan-sach-nha-nuoc',
      pkgDates:          { start: '2026-01-01', end: '2026-12-31' },
      existingDocuments: ['to-trinh', 'khlcnt'],
    });
    expect(out.requiredDocuments.length).toBeGreaterThan(0);
    expect(typeof out.riskScore).toBe('number');
  });
});

// ─── CR-14: Empty / minimal input ────────────────────────────────────────────

describe('CR-14: empty / minimal input', () => {
  it('CR-14-01: clauses: [] → findings.length >= 8 (all universal clauses missing)', () => {
    const out = reviewContract(override({ clauses: [] }));
    // 8 universal (CRITICAL) + type-specific + fund-specific
    expect(out.findings.length).toBeGreaterThanOrEqual(8);
    // All universal-clause findings must be CRITICAL
    const criticalFindings = out.findings.filter(f => f.severity === 'CRITICAL');
    expect(criticalFindings.length).toBeGreaterThanOrEqual(8);
  });

  it('CR-14-02: durationDays = 0 → DURATION_INVALID finding of severity CRITICAL exists', () => {
    const out = reviewContract(override({ durationDays: 0 }));
    expect(out.findings.some(f => f.code === 'DURATION_INVALID' && f.severity === 'CRITICAL')).toBe(true);
  });

  it('CR-14-03: packageValue = 0 → no PERF_SECURITY finding (below threshold)', () => {
    const out = reviewContract(override({ packageValue: 0 }));
    // bao-dam-thuc-hien may still be required by ngan-sach-nha-nuoc fund,
    // but the value-based PERF_SECURITY path is not triggered.
    // None of the findings should have code 'PERF_SECURITY'.
    expect(out.findings.some(f => f.code === 'PERF_SECURITY')).toBe(false);
  });
});

// ─── CR-15: Multiple findings + severity aggregation ─────────────────────────

describe('CR-15: multiple findings + severity aggregation', () => {
  it('CR-15-01: many issues at once → overall severity = CRITICAL (max)', () => {
    // Missing universal clauses (CRITICAL) + type mismatch (HIGH) + duration exceeded
    const out = reviewContract({
      contractType:      'ket-hop',
      procurementMethod: 'chi-dinh-thau-rut-gon',  // mismatch
      fundingSource:     'ngan-sach-nha-nuoc',
      durationDays:      600,                        // exceeds tron-goi max (doesn't apply here, but ket-hop max=1095)
      clauses:           [],                          // all missing → CRITICAL
      packageValue:      100_000_000,
    });
    expect(out.severity).toBe('CRITICAL');
    expect(out.findings.length).toBeGreaterThan(3);
  });

  it('CR-15-02: valid contract with no issues → severity = LOW', () => {
    // tron-goi + dau-thau-rong-rai + all clauses + valid duration — no findings at all.
    // Note: dau-thau-rong-rai always adds a MEDIUM portal warning but warnings ≠ findings.
    const out = reviewContract(BASE);
    // findings should be empty (no clause issues, no mismatch, no duration issue)
    expect(out.findings).toHaveLength(0);
    expect(out.severity).toBe('LOW');
  });

  it('CR-15-03: only HIGH findings → overall severity = HIGH', () => {
    // Missing bao-hanh (HIGH for tron-goi) + TYPE_MISMATCH (HIGH)
    const out = reviewContract(override({
      contractType:      'theo-don-gia-dieu-chinh',  // mismatch with chi-dinh-thau-rut-gon
      procurementMethod: 'chi-dinh-thau-rut-gon',
      clauses:           without('bao-hanh', 'bao-dam-thuc-hien', 'dieu-chinh-gia'), // remove type-specific
    }));
    // All findings must be HIGH (none CRITICAL because universal clauses are present)
    const allFindings = out.findings;
    expect(allFindings.every(f => f.severity === 'HIGH')).toBe(true);
    expect(out.severity).toBe('HIGH');
  });
});
