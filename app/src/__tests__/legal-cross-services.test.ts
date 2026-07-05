/**
 * Cross-domain services — citation building, cross-references,
 * procurement rules, threshold resolution
 *
 * Groups (13 × 3 = 39):
 *   LCS-01  buildCitation — document only
 *   LCS-02  buildCitation — with article number
 *   LCS-03  buildCitation — with article + clause + point
 *   LCS-04  findCrossReferences — cites (docs this doc cites)
 *   LCS-05  findCrossReferences — citedBy (docs that cite this one)
 *   LCS-06  findCrossReferences — empty for doc with no citations
 *   LCS-07  determineProcurementRule — matches correct rule by value
 *   LCS-08  determineProcurementRule — value not in any rule returns null
 *   LCS-09  determineProcurementRule — method filter narrows result
 *   LCS-10  resolveThresholdRule — returns correct band for value
 *   LCS-11  resolveThresholdRule — open-ended band (maxValue null)
 *   LCS-12  resolveThresholdRule — value below all bands returns null
 *   LCS-13  resolveThresholdRule — domain "*" matches any domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCitation,
  findCrossReferences,
  determineProcurementRule,
  resolveThresholdRule,
} from '../legal/domain/legalCrossServices';
import { MemoryLegalDocumentRepository, MemoryCitationRepository } from '../legal/memoryRepositories';
import type { LegalDocument } from '../legal/legalRegistry';
import type { LegalCitation } from '../legal/legalSchema';
import type { ProcurementRule, ThresholdBand } from '../legal/domain/legalDomainTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW: LegalDocument = {
  id: 'luat-22-2023', symbol: '22/2023/QH15', title: 'Luật Đấu thầu',
  type: 'LAW', issuer: 'Quốc hội', effectiveDate: '2024-01-01',
  status: 'ACTIVE', source: 'Công báo', priority: 1,
  tags: ['đấu thầu'], summary: 'Luật đấu thầu', confidence: 1.0,
};
const DECREE: LegalDocument = {
  id: 'nd-214-2025', symbol: '214/2025/NĐ-CP', title: 'Nghị định đấu thầu',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2025-07-01',
  status: 'ACTIVE', source: 'Công báo', priority: 2,
  tags: ['đấu thầu'], summary: 'NĐ hướng dẫn', confidence: 0.9,
};

const CIT_FROM: LegalCitation = {
  id: 'cit-1', citingDocId: 'nd-214-2025', citedDocId: 'luat-22-2023',
  citingArticle: 'dieu-3', citedArticle: 'dieu-10',
  citedClause: 'khoan-1', citedPoint: null,
  formatted: 'khoản 1 Điều 10 Luật 22/2023/QH15', isDirect: true,
};
const CIT_FROM_2: LegalCitation = {
  id: 'cit-2', citingDocId: 'nd-214-2025', citedDocId: 'other-doc',
  citingArticle: 'dieu-5', citedArticle: null,
  citedClause: null, citedPoint: null,
  formatted: 'other-doc', isDirect: false,
};
const CIT_TO: LegalCitation = {
  id: 'cit-3', citingDocId: 'tt-79-2025', citedDocId: 'luat-22-2023',
  citingArticle: 'dieu-1', citedArticle: 'dieu-5',
  citedClause: null, citedPoint: null,
  formatted: 'Điều 5 Luật 22/2023/QH15', isDirect: true,
};

// Procurement rules (representative values from NĐ 214/2025)
const RULES: ProcurementRule[] = [
  {
    id: 'r-direct', method: 'DIRECT', minValue: 0, maxValue: 50_000_000,
    documentRef: '214/2025/NĐ-CP', effectiveDate: '2025-07-01',
  },
  {
    id: 'r-quote', method: 'COMPETITIVE_QUOTE', minValue: 50_000_000, maxValue: 200_000_000,
    documentRef: '214/2025/NĐ-CP', effectiveDate: '2025-07-01',
  },
  {
    id: 'r-open', method: 'OPEN_TENDER', minValue: 200_000_000, maxValue: null,
    documentRef: '22/2023/QH15', effectiveDate: '2024-01-01',
  },
];

// Threshold bands
const BANDS: ThresholdBand[] = [
  { domain: 'goods',    minValue: 0,           maxValue: 50_000_000,  method: 'DIRECT',           documentRef: '214/2025/NĐ-CP' },
  { domain: 'goods',    minValue: 50_000_000,  maxValue: 200_000_000, method: 'COMPETITIVE_QUOTE', documentRef: '214/2025/NĐ-CP' },
  { domain: 'goods',    minValue: 200_000_000, maxValue: null,        method: 'OPEN_TENDER',       documentRef: '22/2023/QH15' },
  { domain: 'services', minValue: 0,           maxValue: 100_000_000, method: 'DIRECT',           documentRef: '214/2025/NĐ-CP' },
  { domain: 'services', minValue: 100_000_000, maxValue: null,        method: 'OPEN_TENDER',       documentRef: '22/2023/QH15' },
  { domain: '*',        minValue: 1_000_000_000, maxValue: null,      method: 'OPEN_TENDER_INTL', documentRef: '22/2023/QH15' },
];

// ─── LCS-01: buildCitation — document only ────────────────────────────────────

describe('LCS-01 buildCitation returns document symbol for doc-only target', () => {
  let docRepo: MemoryLegalDocumentRepository;
  beforeEach(async () => {
    docRepo = new MemoryLegalDocumentRepository();
    await docRepo.save(LAW);
  });

  it('builds citation with symbol "22/2023/QH15"', async () => {
    const cit = await buildCitation({ docId: 'luat-22-2023' }, docRepo);
    expect(cit).toBe('22/2023/QH15');
  });
  it('falls back to docId when document not in repo', async () => {
    const cit = await buildCitation({ docId: 'unknown-doc' }, docRepo);
    expect(cit).toContain('unknown-doc');
  });
  it('result is a non-empty string', async () => {
    const cit = await buildCitation({ docId: 'luat-22-2023' }, docRepo);
    expect(typeof cit).toBe('string');
    expect(cit.length).toBeGreaterThan(0);
  });
});

// ─── LCS-02: buildCitation — with article ────────────────────────────────────

describe('LCS-02 buildCitation with article number', () => {
  let docRepo: MemoryLegalDocumentRepository;
  beforeEach(async () => {
    docRepo = new MemoryLegalDocumentRepository();
    await docRepo.save(LAW);
  });

  it('includes "Điều 43"', async () => {
    const cit = await buildCitation({ docId: 'luat-22-2023', articleNumber: 43 }, docRepo);
    expect(cit).toContain('Điều 43');
  });
  it('includes document symbol', async () => {
    const cit = await buildCitation({ docId: 'luat-22-2023', articleNumber: 43 }, docRepo);
    expect(cit).toContain('22/2023/QH15');
  });
  it('Điều appears before symbol in citation', async () => {
    const cit = await buildCitation({ docId: 'luat-22-2023', articleNumber: 43 }, docRepo);
    expect(cit.indexOf('Điều 43')).toBeLessThan(cit.indexOf('22/2023/QH15'));
  });
});

// ─── LCS-03: buildCitation — with article + clause + point ───────────────────

describe('LCS-03 buildCitation with article, clause, and point', () => {
  let docRepo: MemoryLegalDocumentRepository;
  beforeEach(async () => {
    docRepo = new MemoryLegalDocumentRepository();
    await docRepo.save(DECREE);
  });

  it('includes "điểm a khoản 2 Điều 10"', async () => {
    const cit = await buildCitation(
      { docId: 'nd-214-2025', articleNumber: 10, clauseNumber: 2, pointLabel: 'a' },
      docRepo,
    );
    expect(cit).toContain('điểm a');
    expect(cit).toContain('khoản 2');
    expect(cit).toContain('Điều 10');
  });
  it('order is điểm > khoản > Điều > symbol', async () => {
    const cit = await buildCitation(
      { docId: 'nd-214-2025', articleNumber: 10, clauseNumber: 2, pointLabel: 'b' },
      docRepo,
    );
    const idxDiem  = cit.indexOf('điểm b');
    const idxKhoan = cit.indexOf('khoản 2');
    const idxDieu  = cit.indexOf('Điều 10');
    const idxSym   = cit.indexOf('214/2025');
    expect(idxDiem).toBeLessThan(idxKhoan);
    expect(idxKhoan).toBeLessThan(idxDieu);
    expect(idxDieu).toBeLessThan(idxSym);
  });
  it('includes DECREE symbol', async () => {
    const cit = await buildCitation(
      { docId: 'nd-214-2025', articleNumber: 1 },
      docRepo,
    );
    expect(cit).toContain('214/2025/NĐ-CP');
  });
});

// ─── LCS-04: findCrossReferences — cites ─────────────────────────────────────

describe('LCS-04 findCrossReferences returns documents this doc cites', () => {
  let citationRepo: MemoryCitationRepository;
  beforeEach(async () => {
    citationRepo = new MemoryCitationRepository();
    await citationRepo.saveCitation(CIT_FROM);   // nd-214-2025 → luat-22-2023
    await citationRepo.saveCitation(CIT_FROM_2); // nd-214-2025 → other-doc
    await citationRepo.saveCitation(CIT_TO);     // tt-79-2025 → luat-22-2023
  });

  it('cites has 2 entries for nd-214-2025', async () => {
    const r = await findCrossReferences('nd-214-2025', citationRepo);
    expect(r.cites).toHaveLength(2);
  });
  it('cites[0] citedDocId is luat-22-2023', async () => {
    const r = await findCrossReferences('nd-214-2025', citationRepo);
    expect(r.cites.some(c => c.citedDocId === 'luat-22-2023')).toBe(true);
  });
  it('cites is empty for doc that cites nothing', async () => {
    const r = await findCrossReferences('no-cites-doc', citationRepo);
    expect(r.cites).toHaveLength(0);
  });
});

// ─── LCS-05: findCrossReferences — citedBy ───────────────────────────────────

describe('LCS-05 findCrossReferences returns docs that cite this doc', () => {
  let citationRepo: MemoryCitationRepository;
  beforeEach(async () => {
    citationRepo = new MemoryCitationRepository();
    await citationRepo.saveCitation(CIT_FROM); // nd-214-2025 → luat-22-2023
    await citationRepo.saveCitation(CIT_TO);   // tt-79-2025  → luat-22-2023
  });

  it('luat-22-2023 is cited by 2 docs', async () => {
    const r = await findCrossReferences('luat-22-2023', citationRepo);
    expect(r.citedBy).toHaveLength(2);
  });
  it('citedBy contains nd-214-2025 and tt-79-2025', async () => {
    const r = await findCrossReferences('luat-22-2023', citationRepo);
    const ids = r.citedBy.map(c => c.citingDocId);
    expect(ids).toContain('nd-214-2025');
    expect(ids).toContain('tt-79-2025');
  });
  it('citedBy is empty for doc nobody cites', async () => {
    const r = await findCrossReferences('not-cited', citationRepo);
    expect(r.citedBy).toHaveLength(0);
  });
});

// ─── LCS-06: findCrossReferences — empty for unknown doc ─────────────────────

describe('LCS-06 findCrossReferences empty for doc with no citations', () => {
  const citationRepo = new MemoryCitationRepository();

  it('cites is empty for unknown docId', async () => {
    const r = await findCrossReferences('unknown', citationRepo);
    expect(r.cites).toHaveLength(0);
  });
  it('citedBy is empty for unknown docId', async () => {
    const r = await findCrossReferences('unknown', citationRepo);
    expect(r.citedBy).toHaveLength(0);
  });
  it('both cites and citedBy are arrays', async () => {
    const r = await findCrossReferences('unknown', citationRepo);
    expect(Array.isArray(r.cites)).toBe(true);
    expect(Array.isArray(r.citedBy)).toBe(true);
  });
});

// ─── LCS-07: determineProcurementRule — value match ──────────────────────────

describe('LCS-07 determineProcurementRule matches rule by value', () => {
  it('value 30M → DIRECT rule', () => {
    const r = determineProcurementRule(30_000_000, null, RULES);
    expect(r!.method).toBe('DIRECT');
  });
  it('value 100M → COMPETITIVE_QUOTE rule', () => {
    const r = determineProcurementRule(100_000_000, null, RULES);
    expect(r!.method).toBe('COMPETITIVE_QUOTE');
  });
  it('value 500M → OPEN_TENDER rule (open-ended band)', () => {
    const r = determineProcurementRule(500_000_000, null, RULES);
    expect(r!.method).toBe('OPEN_TENDER');
  });
});

// ─── LCS-08: determineProcurementRule — no match ─────────────────────────────

describe('LCS-08 determineProcurementRule returns null when no rule matches', () => {
  it('empty rules list returns null', () => {
    expect(determineProcurementRule(100_000_000, null, [])).toBeNull();
  });
  it('negative value returns null (below minimum of all rules)', () => {
    const strictRules: ProcurementRule[] = [{
      id: 'r1', method: 'OPEN_TENDER', minValue: 1, maxValue: null,
      documentRef: 'doc', effectiveDate: '2024-01-01',
    }];
    expect(determineProcurementRule(-1, null, strictRules)).toBeNull();
  });
  it('method filter with no matching method returns null', () => {
    expect(determineProcurementRule(100_000_000, 'DIRECT', RULES)).toBeNull();
    // 100M is in COMPETITIVE_QUOTE range, not DIRECT
  });
});

// ─── LCS-09: determineProcurementRule — method filter ────────────────────────

describe('LCS-09 determineProcurementRule method filter narrows result', () => {
  it('value 500M + method OPEN_TENDER → matches', () => {
    const r = determineProcurementRule(500_000_000, 'OPEN_TENDER', RULES);
    expect(r).not.toBeNull();
    expect(r!.method).toBe('OPEN_TENDER');
  });
  it('value 30M + method OPEN_TENDER → no match (wrong method for range)', () => {
    expect(determineProcurementRule(30_000_000, 'OPEN_TENDER', RULES)).toBeNull();
  });
  it('null method matches any rule in range', () => {
    const r = determineProcurementRule(30_000_000, null, RULES);
    expect(r!.method).toBe('DIRECT');
  });
});

// ─── LCS-10: resolveThresholdRule — correct band ─────────────────────────────

describe('LCS-10 resolveThresholdRule returns correct band for value', () => {
  it('30M goods → DIRECT band', () => {
    const r = resolveThresholdRule(30_000_000, 'goods', BANDS);
    expect(r!.method).toBe('DIRECT');
  });
  it('100M goods → COMPETITIVE_QUOTE band', () => {
    const r = resolveThresholdRule(100_000_000, 'goods', BANDS);
    expect(r!.method).toBe('COMPETITIVE_QUOTE');
  });
  it('500M goods → OPEN_TENDER band', () => {
    const r = resolveThresholdRule(500_000_000, 'goods', BANDS);
    expect(r!.method).toBe('OPEN_TENDER');
  });
});

// ─── LCS-11: resolveThresholdRule — open-ended band ──────────────────────────

describe('LCS-11 resolveThresholdRule matches open-ended band (maxValue null)', () => {
  it('very large value still matches open-ended band', () => {
    const r = resolveThresholdRule(999_000_000_000, 'goods', BANDS);
    expect(r).not.toBeNull();
    expect(r!.band.maxValue).toBeNull();
  });
  it('300M services → OPEN_TENDER open-ended band', () => {
    const r = resolveThresholdRule(300_000_000, 'services', BANDS);
    expect(r!.method).toBe('OPEN_TENDER');
    expect(r!.band.maxValue).toBeNull();
  });
  it('result.band has maxValue null for open-ended band', () => {
    const openBand: ThresholdBand = { domain: 'goods', minValue: 0, maxValue: null, method: 'OPEN', documentRef: 'doc' };
    const r = resolveThresholdRule(1, 'goods', [openBand]);
    expect(r!.band.maxValue).toBeNull();
  });
});

// ─── LCS-12: resolveThresholdRule — value below all bands ────────────────────

describe('LCS-12 resolveThresholdRule returns null when value below all bands', () => {
  it('0 value below a band starting at 1 returns null', () => {
    const bands: ThresholdBand[] = [{ domain: '*', minValue: 1, maxValue: null, method: 'OPEN', documentRef: 'doc' }];
    expect(resolveThresholdRule(0, 'goods', bands)).toBeNull();
  });
  it('empty bands array returns null', () => {
    expect(resolveThresholdRule(100_000_000, 'goods', [])).toBeNull();
  });
  it('negative value returns null', () => {
    expect(resolveThresholdRule(-1, 'goods', BANDS)).toBeNull();
  });
});

// ─── LCS-13: resolveThresholdRule — domain "*" matches any domain ─────────────

describe('LCS-13 resolveThresholdRule domain "*" matches any domain', () => {
  const wildBands: ThresholdBand[] = [
    { domain: '*', minValue: 0, maxValue: 500_000_000, method: 'COMPETITIVE_QUOTE', documentRef: 'doc' },
    { domain: '*', minValue: 500_000_000, maxValue: null, method: 'OPEN_TENDER_INTL', documentRef: 'doc' },
  ];

  it('domain "goods" matches wildcard band', () => {
    const r = resolveThresholdRule(100_000_000, 'goods', wildBands);
    expect(r!.method).toBe('COMPETITIVE_QUOTE');
  });
  it('domain "construction" also matches wildcard band', () => {
    const r = resolveThresholdRule(100_000_000, 'construction', wildBands);
    expect(r!.method).toBe('COMPETITIVE_QUOTE');
  });
  it('specific domain takes precedence over wildcard when both match', () => {
    const mixed: ThresholdBand[] = [
      { domain: 'goods', minValue: 0, maxValue: null, method: 'SPECIAL', documentRef: 'doc' },
      { domain: '*',     minValue: 0, maxValue: null, method: 'GENERIC', documentRef: 'doc' },
    ];
    // First match wins — SPECIAL (goods) is first
    const r = resolveThresholdRule(100_000_000, 'goods', mixed);
    expect(r!.method).toBe('SPECIAL');
  });
});
