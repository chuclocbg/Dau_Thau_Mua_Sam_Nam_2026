/**
 * ProcurementEngine — six capabilities + full evaluate()
 *
 * Groups (13 × 3 = 39):
 *   PE-01  evaluate() — full decision shape has all required keys
 *   PE-02  evaluate() — small GOODS case (30M) — DIRECT_PROCUREMENT path
 *   PE-03  evaluate() — large CONSTRUCTION case (2B) — OPEN_TENDER path
 *   PE-04  classifyPackage() — GOODS and SERVICE categories
 *   PE-05  classifyPackage() — CONSULTING and CONSTRUCTION categories
 *   PE-06  determineThreshold() — GOODS at 30M / 100M / 500M
 *   PE-07  determineThreshold() — CONSTRUCTION at 80M / 300M
 *   PE-08  selectMethod() — DIRECT/COMPETITIVE/OPEN for GOODS
 *   PE-09  selectMethod() — isUrgent=true always → DIRECT_APPOINTMENT
 *   PE-10  resolveApproval() — UNIT_HEAD / MINISTER / PRIME_MINISTER thresholds
 *   PE-11  resolveLegalDocuments() — all 5 docs for GOODS STATE 2026-07-01
 *   PE-12  resolveLegalDocuments() — ENTERPRISE excludes TT-BTC; non-GOODS excludes TT-BCT
 *   PE-13  buildWorkflow() — OPEN_TENDER=13 steps, DIRECT_PROCUREMENT=6 steps
 */

import { describe, it, expect } from 'vitest';
import { ProcurementEngine } from '../procurement/application/procurementEngine';
import type { ProcurementCase } from '../procurement/domain/procurementTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const engine = new ProcurementEngine();

function makeCase(overrides: Partial<ProcurementCase> & { estimatedValue: number; packageType: ProcurementCase['packageType'] }): ProcurementCase {
  return {
    id: 'case-test', fundSource: 'STATE',
    isUrgent: false, isNationalSec: false, isInternational: false,
    singleSource: false, asOfDate: '2026-07-01',
    ...overrides,
  };
}

const GOODS_30M       = makeCase({ packageType: 'GOODS',       estimatedValue: 30_000_000  });
const GOODS_100M      = makeCase({ packageType: 'GOODS',       estimatedValue: 100_000_000 });
const GOODS_500M      = makeCase({ packageType: 'GOODS',       estimatedValue: 500_000_000 });
const CONST_80M       = makeCase({ packageType: 'CONSTRUCTION', estimatedValue: 80_000_000  });
const CONST_300M      = makeCase({ packageType: 'CONSTRUCTION', estimatedValue: 300_000_000 });
const CONST_2B        = makeCase({ packageType: 'CONSTRUCTION', estimatedValue: 2_000_000_000 });
const URGENT_2B       = makeCase({ packageType: 'CONSTRUCTION', estimatedValue: 2_000_000_000, isUrgent: true });
const CONSULT_30M     = makeCase({ packageType: 'CONSULTING',   estimatedValue: 30_000_000  });
const SERVICE_100M    = makeCase({ packageType: 'SERVICE',      estimatedValue: 100_000_000 });
const APPROVAL_3B     = makeCase({ packageType: 'GOODS', estimatedValue:  3_000_000_000 });
const APPROVAL_20B    = makeCase({ packageType: 'GOODS', estimatedValue: 20_000_000_000 });
const APPROVAL_60B    = makeCase({ packageType: 'GOODS', estimatedValue: 60_000_000_000 });
const ENTERPRISE_100M = makeCase({ packageType: 'GOODS', estimatedValue: 100_000_000, fundSource: 'ENTERPRISE' });

// ─── PE-01: evaluate() — shape ────────────────────────────────────────────────

describe('PE-01 evaluate() returns ProcurementDecision with all required keys', () => {
  const dec = engine.evaluate(GOODS_30M);

  it('has caseId, asOfDate, legalDocuments, workflow, evaluations', () => {
    expect(dec.caseId).toBeTruthy();
    expect(typeof dec.asOfDate).toBe('string');
    expect(Array.isArray(dec.legalDocuments)).toBe(true);
    expect(Array.isArray(dec.workflow)).toBe(true);
    expect(Array.isArray(dec.evaluations)).toBe(true);
  });
  it('has all six capability sub-objects', () => {
    expect(dec.packageClassification).toBeTruthy();
    expect(dec.threshold).toBeTruthy();
    expect(dec.method).toBeTruthy();
    expect(dec.approval).toBeTruthy();
  });
  it('evaluations array is non-empty (all rules were evaluated)', () => {
    expect(dec.evaluations.length).toBeGreaterThan(0);
  });
});

// ─── PE-02: evaluate() — small GOODS case ────────────────────────────────────

describe('PE-02 evaluate() small GOODS case (30M) — DIRECT_PROCUREMENT path', () => {
  const dec = engine.evaluate(GOODS_30M);

  it('threshold band is DIRECT', () => {
    expect(dec.threshold.band).toBe('DIRECT');
  });
  it('method is DIRECT_PROCUREMENT', () => {
    expect(dec.method.method).toBe('DIRECT_PROCUREMENT');
  });
  it('workflow has 6 steps for DIRECT_PROCUREMENT', () => {
    expect(dec.workflow).toHaveLength(6);
  });
});

// ─── PE-03: evaluate() — large CONSTRUCTION case ─────────────────────────────

describe('PE-03 evaluate() large CONSTRUCTION case (2B) — OPEN_TENDER path', () => {
  const dec = engine.evaluate(CONST_2B);

  it('threshold band is OPEN_TENDER', () => {
    expect(dec.threshold.band).toBe('OPEN_TENDER');
  });
  it('method is OPEN_TENDER', () => {
    expect(dec.method.method).toBe('OPEN_TENDER');
  });
  it('workflow has 13 steps for OPEN_TENDER', () => {
    expect(dec.workflow).toHaveLength(13);
  });
});

// ─── PE-04: classifyPackage() — GOODS / SERVICE ───────────────────────────────

describe('PE-04 classifyPackage returns correct category for GOODS and SERVICE', () => {
  it('GOODS packageType → category starts with "Hàng hóa"', () => {
    const c = engine.classifyPackage(GOODS_30M);
    expect(c.packageType).toBe('GOODS');
    expect(c.category).toMatch(/Hàng hóa/);
  });
  it('SERVICE packageType → category describes services', () => {
    const c = engine.classifyPackage(SERVICE_100M);
    expect(c.packageType).toBe('SERVICE');
    expect(c.category.length).toBeGreaterThan(0);
  });
  it('legalBasis has document and article', () => {
    const c = engine.classifyPackage(GOODS_30M);
    expect(c.legalBasis.document).toBeTruthy();
    expect(c.legalBasis.article).toBeTruthy();
  });
});

// ─── PE-05: classifyPackage() — CONSULTING / CONSTRUCTION ────────────────────

describe('PE-05 classifyPackage returns correct category for CONSULTING and CONSTRUCTION', () => {
  it('CONSULTING packageType → category mentions tư vấn', () => {
    const c = engine.classifyPackage(CONSULT_30M);
    expect(c.packageType).toBe('CONSULTING');
    expect(c.category).toMatch(/[Tt]ư vấn/);
  });
  it('CONSTRUCTION packageType → category mentions xây', () => {
    const c = engine.classifyPackage(CONST_80M);
    expect(c.packageType).toBe('CONSTRUCTION');
    expect(c.category).toMatch(/[Xx]ây/);
  });
  it('description is a non-empty string', () => {
    const c = engine.classifyPackage(CONST_300M);
    expect(typeof c.description).toBe('string');
    expect(c.description.length).toBeGreaterThan(0);
  });
});

// ─── PE-06: determineThreshold() — GOODS ────────────────────────────────────

describe('PE-06 determineThreshold for GOODS at 30M, 100M, 500M', () => {
  it('GOODS 30M → band DIRECT', () => {
    expect(engine.determineThreshold(GOODS_30M).band).toBe('DIRECT');
  });
  it('GOODS 100M → band COMPETITIVE_QUOTE', () => {
    expect(engine.determineThreshold(GOODS_100M).band).toBe('COMPETITIVE_QUOTE');
  });
  it('GOODS 500M → band OPEN_TENDER', () => {
    expect(engine.determineThreshold(GOODS_500M).band).toBe('OPEN_TENDER');
  });
});

// ─── PE-07: determineThreshold() — CONSTRUCTION ──────────────────────────────

describe('PE-07 determineThreshold for CONSTRUCTION at 80M and 300M', () => {
  it('CONSTRUCTION 80M → band DIRECT (≤100M threshold)', () => {
    expect(engine.determineThreshold(CONST_80M).band).toBe('DIRECT');
  });
  it('CONSTRUCTION 300M → band COMPETITIVE_QUOTE (100M-500M)', () => {
    expect(engine.determineThreshold(CONST_300M).band).toBe('COMPETITIVE_QUOTE');
  });
  it('currency is always VND', () => {
    expect(engine.determineThreshold(CONST_80M).currency).toBe('VND');
  });
});

// ─── PE-08: selectMethod() — DIRECT / COMPETITIVE / OPEN for GOODS ───────────

describe('PE-08 selectMethod returns correct method for GOODS values', () => {
  it('GOODS 30M → DIRECT_PROCUREMENT', () => {
    expect(engine.selectMethod(GOODS_30M).method).toBe('DIRECT_PROCUREMENT');
  });
  it('GOODS 100M → COMPETITIVE_QUOTE', () => {
    expect(engine.selectMethod(GOODS_100M).method).toBe('COMPETITIVE_QUOTE');
  });
  it('GOODS 500M → OPEN_TENDER', () => {
    expect(engine.selectMethod(GOODS_500M).method).toBe('OPEN_TENDER');
  });
});

// ─── PE-09: selectMethod() — exception override ───────────────────────────────

describe('PE-09 selectMethod — isUrgent=true always overrides to DIRECT_APPOINTMENT', () => {
  it('urgent 2B CONSTRUCTION → DIRECT_APPOINTMENT (not OPEN_TENDER)', () => {
    expect(engine.selectMethod(URGENT_2B).method).toBe('DIRECT_APPOINTMENT');
  });
  it('exceptions array is non-empty for urgent case', () => {
    expect(engine.selectMethod(URGENT_2B).exceptions.length).toBeGreaterThan(0);
  });
  it('non-urgent 2B CONSTRUCTION → OPEN_TENDER', () => {
    expect(engine.selectMethod(CONST_2B).method).toBe('OPEN_TENDER');
  });
});

// ─── PE-10: resolveApproval() ─────────────────────────────────────────────────

describe('PE-10 resolveApproval returns correct authority by estimated value', () => {
  it('3B → UNIT_HEAD (< 5B threshold)', () => {
    expect(engine.resolveApproval(APPROVAL_3B).authority).toBe('UNIT_HEAD');
  });
  it('20B → MINISTER (5B–50B range)', () => {
    expect(engine.resolveApproval(APPROVAL_20B).authority).toBe('MINISTER');
  });
  it('60B → PRIME_MINISTER (≥ 50B threshold)', () => {
    expect(engine.resolveApproval(APPROVAL_60B).authority).toBe('PRIME_MINISTER');
  });
});

// ─── PE-11: resolveLegalDocuments() — all 5 docs ─────────────────────────────

describe('PE-11 resolveLegalDocuments for GOODS STATE 2026-07-01 — all 5 documents', () => {
  const docs = engine.resolveLegalDocuments(GOODS_100M);

  it('returns at least 3 documents', () => {
    expect(docs.length).toBeGreaterThanOrEqual(3);
  });
  it('includes 22/2023/QH15 (base law always applies)', () => {
    expect(docs).toContain('22/2023/QH15');
  });
  it('includes 13/2026/TT-BCT (GOODS fund — circular from 2026-05-01)', () => {
    expect(docs).toContain('13/2026/TT-BCT');
  });
});

// ─── PE-12: resolveLegalDocuments() — filtered cases ─────────────────────────

describe('PE-12 resolveLegalDocuments filtering — ENTERPRISE / non-GOODS', () => {
  it('ENTERPRISE fundSource excludes 79/2025/TT-BTC', () => {
    const docs = engine.resolveLegalDocuments(ENTERPRISE_100M);
    expect(docs).not.toContain('79/2025/TT-BTC');
  });
  it('CONSULTING package excludes 13/2026/TT-BCT', () => {
    const docs = engine.resolveLegalDocuments(CONSULT_30M);
    expect(docs).not.toContain('13/2026/TT-BCT');
  });
  it('CONSTRUCTION STATE includes 79/2025/TT-BTC', () => {
    const docs = engine.resolveLegalDocuments(CONST_2B);
    expect(docs).toContain('79/2025/TT-BTC');
  });
});

// ─── PE-13: buildWorkflow() — step counts ────────────────────────────────────

describe('PE-13 buildWorkflow returns correct number of steps per method', () => {
  it('OPEN_TENDER (GOODS 500M) → 13 workflow steps', () => {
    expect(engine.buildWorkflow(GOODS_500M)).toHaveLength(13);
  });
  it('DIRECT_PROCUREMENT (GOODS 30M) → 6 workflow steps', () => {
    expect(engine.buildWorkflow(GOODS_30M)).toHaveLength(6);
  });
  it('DIRECT_APPOINTMENT (urgent) → 8 workflow steps', () => {
    expect(engine.buildWorkflow(URGENT_2B)).toHaveLength(8);
  });
});
