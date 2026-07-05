/**
 * Domain services — legal reasoning functions
 *
 * Groups (13 × 3 = 39):
 *   LDS-01  determineApplicableLaw — empty docs
 *   LDS-02  determineApplicableLaw — filters out non-in-force docs
 *   LDS-03  determineApplicableLaw — sorts by hierarchy (LAW before DECREE)
 *   LDS-04  determineApplicableLaw — domain filter via tags
 *   LDS-05  resolveEffectiveDocument — isInForce true for open period
 *   LDS-06  resolveEffectiveDocument — isInForce false before startDate
 *   LDS-07  resolveEffectiveDocument — status=IN_FORCE for covered date
 *   LDS-08  resolveAmendmentChain — chronological order
 *   LDS-09  resolveAmendmentChain — asOf filter excludes future amendments
 *   LDS-10  resolveHierarchyConflict — LAW prevails over DECREE (HIERARCHY)
 *   LDS-11  resolveHierarchyConflict — same level, later date wins (LEX_POSTERIOR)
 *   LDS-12  determineApplicability — keyword filter and relevance scoring
 *   LDS-13  resolveLegalStatus — IN_FORCE / SUPERSEDED / UNKNOWN scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  determineApplicableLaw,
  resolveEffectiveDocument,
  resolveAmendmentChain,
  resolveHierarchyConflict,
  determineApplicability,
  resolveLegalStatus,
} from '../legal/domain/legalDomainServices';
import { MemoryAmendmentRepository, MemoryEffectivePeriodRepository } from '../legal/memoryRepositories';
import type { LegalDocument } from '../legal/legalRegistry';
import type { Article, Amendment } from '../legal/legalSchema';
import type { ApplicabilityContext } from '../legal/domain/legalDomainTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW: LegalDocument = {
  id: 'luat-22-2023', symbol: '22/2023/QH15', title: 'Luật Đấu thầu',
  type: 'LAW', issuer: 'Quốc hội', effectiveDate: '2024-01-01',
  status: 'ACTIVE', source: 'Công báo', priority: 1,
  tags: ['đấu thầu', 'mua sắm công'], summary: 'Luật đấu thầu', confidence: 1.0,
};
const DECREE: LegalDocument = {
  id: 'nd-214-2025', symbol: '214/2025/NĐ-CP', title: 'Nghị định đấu thầu',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2025-07-01',
  status: 'ACTIVE', source: 'Công báo', priority: 2,
  tags: ['đấu thầu'], summary: 'NĐ hướng dẫn', confidence: 0.9,
};
const CIRCULAR: LegalDocument = {
  id: 'tt-79-2025', symbol: '79/2025/TT-BTC', title: 'Thông tư tài chính',
  type: 'CIRCULAR', issuer: 'Bộ Tài chính', effectiveDate: '2025-08-01',
  status: 'ACTIVE', source: 'Công báo', priority: 3,
  tags: ['tài chính'], summary: 'TT tài chính', confidence: 0.8,
};
const DECREE_OLD: LegalDocument = {
  ...DECREE, id: 'nd-99-2020', symbol: '99/2020/NĐ-CP',
  effectiveDate: '2020-01-01',
};

const ARTICLES: Article[] = [
  {
    id: 'doc-dieu-1', documentId: 'doc', versionId: null,
    number: 1, title: 'Đấu thầu rộng rãi', content: 'Áp dụng đối với gói thầu lớn.',
    chapterRef: 'I', sortOrder: 0,
  },
  {
    id: 'doc-dieu-2', documentId: 'doc', versionId: null,
    number: 2, title: 'Hồ sơ yêu cầu', content: 'Đấu thầu trong nước cần nộp hồ sơ.',
    chapterRef: 'I', sortOrder: 1,
  },
  {
    id: 'doc-dieu-3', documentId: 'doc', versionId: null,
    number: 3, title: 'Thanh toán hợp đồng', content: 'Bên mời thầu thanh toán trong 30 ngày.',
    chapterRef: 'II', sortOrder: 2,
  },
];

const AMD_MODIFY: Amendment = {
  id: 'amd-1', baseDocumentId: 'luat-22-2023', amendingDocumentId: 'nd-104-2026',
  amendmentType: 'MODIFY', effectiveDate: '2024-07-01',
  affectedArticles: ['dieu-10'], summary: 'Sửa đổi',
};
const AMD_REPLACE: Amendment = {
  id: 'amd-2', baseDocumentId: 'luat-22-2023', amendingDocumentId: 'luat-new',
  amendmentType: 'REPLACE', effectiveDate: '2030-01-01',
  affectedArticles: [], summary: 'Thay thế toàn bộ',
};

// ─── LDS-01: determineApplicableLaw — empty ───────────────────────────────────

describe('LDS-01 determineApplicableLaw with empty docs returns empty', () => {
  const always = () => true;
  const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };

  it('empty docs → empty result', () => {
    expect(determineApplicableLaw([], ctx, always)).toHaveLength(0);
  });
  it('all docs not in force → empty result', () => {
    const never = () => false;
    expect(determineApplicableLaw([LAW, DECREE], ctx, never)).toHaveLength(0);
  });
  it('result is readonly array', () => {
    expect(Array.isArray(determineApplicableLaw([], ctx, always))).toBe(true);
  });
});

// ─── LDS-02: determineApplicableLaw — in-force filter ────────────────────────

describe('LDS-02 determineApplicableLaw filters docs not in force', () => {
  const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };
  // only LAW is in force
  const isInForce = (id: string) => id === LAW.id;

  it('only LAW passes in-force filter', () => {
    expect(determineApplicableLaw([LAW, DECREE, CIRCULAR], ctx, isInForce)).toHaveLength(1);
  });
  it('returned doc is LAW', () => {
    const [doc] = determineApplicableLaw([LAW, DECREE], ctx, isInForce);
    expect(doc!.type).toBe('LAW');
  });
  it('DECREE excluded when not in force', () => {
    const result = determineApplicableLaw([LAW, DECREE], ctx, isInForce);
    expect(result.some(d => d.type === 'DECREE')).toBe(false);
  });
});

// ─── LDS-03: determineApplicableLaw — hierarchy sort ─────────────────────────

describe('LDS-03 determineApplicableLaw sorts results by authority (LAW first)', () => {
  const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };
  const always = () => true;

  it('LAW is first when mixed with DECREE', () => {
    const result = determineApplicableLaw([DECREE, LAW], ctx, always);
    expect(result[0]!.type).toBe('LAW');
  });
  it('DECREE is second, CIRCULAR is third', () => {
    const result = determineApplicableLaw([CIRCULAR, DECREE, LAW], ctx, always);
    expect(result[1]!.type).toBe('DECREE');
    expect(result[2]!.type).toBe('CIRCULAR');
  });
  it('3 docs sorted by hierarchy level (ascending level number)', () => {
    const result = determineApplicableLaw([CIRCULAR, LAW, DECREE], ctx, always);
    expect(result.map(d => d.type)).toEqual(['LAW', 'DECREE', 'CIRCULAR']);
  });
});

// ─── LDS-04: determineApplicableLaw — domain filter ──────────────────────────

describe('LDS-04 determineApplicableLaw filters by domainId tag', () => {
  const always = () => true;

  it('domainId "đấu thầu" returns LAW and DECREE only', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01', domainId: 'đấu thầu' };
    const result = determineApplicableLaw([LAW, DECREE, CIRCULAR], ctx, always);
    expect(result).toHaveLength(2);
    expect(result.some(d => d.id === 'tt-79-2025')).toBe(false);
  });
  it('domainId "tài chính" returns only CIRCULAR', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01', domainId: 'tài chính' };
    expect(determineApplicableLaw([LAW, DECREE, CIRCULAR], ctx, always)).toHaveLength(1);
  });
  it('no domainId returns all in-force docs', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };
    expect(determineApplicableLaw([LAW, DECREE, CIRCULAR], ctx, always)).toHaveLength(3);
  });
});

// ─── LDS-05: resolveEffectiveDocument — isInForce true ────────────────────────

describe('LDS-05 resolveEffectiveDocument isInForce=true for open period', () => {
  let periodRepo: MemoryEffectivePeriodRepository;
  beforeEach(async () => {
    periodRepo = new MemoryEffectivePeriodRepository();
    await periodRepo.openPeriod('luat-22-2023', '2024-01-01', null);
  });

  it('isInForce=true for date within open period', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2025-06-01', periodRepo);
    expect(r.isInForce).toBe(true);
  });
  it('period is not null when in force', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2025-06-01', periodRepo);
    expect(r.period).not.toBeNull();
  });
  it('docId is returned correctly', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2025-06-01', periodRepo);
    expect(r.docId).toBe('luat-22-2023');
  });
});

// ─── LDS-06: resolveEffectiveDocument — isInForce false ──────────────────────

describe('LDS-06 resolveEffectiveDocument isInForce=false before startDate', () => {
  let periodRepo: MemoryEffectivePeriodRepository;
  beforeEach(async () => {
    periodRepo = new MemoryEffectivePeriodRepository();
    await periodRepo.openPeriod('luat-22-2023', '2024-01-01', null);
  });

  it('isInForce=false for date before startDate', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2023-12-31', periodRepo);
    expect(r.isInForce).toBe(false);
  });
  it('period is null when not in force', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2023-12-31', periodRepo);
    expect(r.period).toBeNull();
  });
  it('isInForce=false for unknown docId', async () => {
    const r = await resolveEffectiveDocument('nonexistent', '2025-01-01', periodRepo);
    expect(r.isInForce).toBe(false);
  });
});

// ─── LDS-07: resolveEffectiveDocument — status ────────────────────────────────

describe('LDS-07 resolveEffectiveDocument returns correct status', () => {
  let periodRepo: MemoryEffectivePeriodRepository;
  beforeEach(async () => {
    periodRepo = new MemoryEffectivePeriodRepository();
    await periodRepo.openPeriod('luat-22-2023', '2024-01-01', null);
  });

  it('status=IN_FORCE for date in period', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2025-01-01', periodRepo);
    expect(r.status).toBe('IN_FORCE');
  });
  it('status=UNKNOWN for date outside all periods', async () => {
    const r = await resolveEffectiveDocument('luat-22-2023', '2020-01-01', periodRepo);
    expect(r.status).toBe('UNKNOWN');
  });
  it('status=UNKNOWN for unknown docId', async () => {
    const r = await resolveEffectiveDocument('no-such-doc', '2025-01-01', periodRepo);
    expect(r.status).toBe('UNKNOWN');
  });
});

// ─── LDS-08: resolveAmendmentChain — chronological order ─────────────────────

describe('LDS-08 resolveAmendmentChain returns amendments in chronological order', () => {
  let amendRepo: MemoryAmendmentRepository;
  beforeEach(async () => {
    amendRepo = new MemoryAmendmentRepository();
    await amendRepo.saveAmendment(AMD_REPLACE); // 2030-01-01
    await amendRepo.saveAmendment(AMD_MODIFY);  // 2024-07-01
  });

  it('returns 2 amendments when asOf is 2030-06-01', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2030-06-01', amendRepo);
    expect(chain).toHaveLength(2);
  });
  it('first entry is AMD_MODIFY (earliest date)', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2030-06-01', amendRepo);
    expect(chain[0]!.amendment.id).toBe('amd-1');
  });
  it('appliedDate equals amendment.effectiveDate', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2030-06-01', amendRepo);
    for (const entry of chain) {
      expect(entry.appliedDate).toBe(entry.amendment.effectiveDate);
    }
  });
});

// ─── LDS-09: resolveAmendmentChain — asOf filter ─────────────────────────────

describe('LDS-09 resolveAmendmentChain asOf excludes future amendments', () => {
  let amendRepo: MemoryAmendmentRepository;
  beforeEach(async () => {
    amendRepo = new MemoryAmendmentRepository();
    await amendRepo.saveAmendment(AMD_MODIFY);  // 2024-07-01
    await amendRepo.saveAmendment(AMD_REPLACE); // 2030-01-01
  });

  it('asOf 2025-01-01 returns only AMD_MODIFY', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2025-01-01', amendRepo);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.amendment.amendmentType).toBe('MODIFY');
  });
  it('asOf before any amendment returns empty', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2023-12-31', amendRepo);
    expect(chain).toHaveLength(0);
  });
  it('asOf 2030-06-01 returns both amendments', async () => {
    const chain = await resolveAmendmentChain('luat-22-2023', '2030-06-01', amendRepo);
    expect(chain).toHaveLength(2);
  });
});

// ─── LDS-10: resolveHierarchyConflict — HIERARCHY rule ───────────────────────

describe('LDS-10 resolveHierarchyConflict LAW prevails over DECREE', () => {
  it('LAW beats DECREE → rule=HIERARCHY', () => {
    const r = resolveHierarchyConflict(LAW, DECREE);
    expect(r.rule).toBe('HIERARCHY');
    expect(r.prevailingDocId).toBe(LAW.id);
  });
  it('DECREE beats CIRCULAR → rule=HIERARCHY', () => {
    const r = resolveHierarchyConflict(DECREE, CIRCULAR);
    expect(r.rule).toBe('HIERARCHY');
    expect(r.prevailingDocId).toBe(DECREE.id);
  });
  it('order of arguments does not affect result', () => {
    const rAB = resolveHierarchyConflict(LAW, DECREE);
    const rBA = resolveHierarchyConflict(DECREE, LAW);
    expect(rAB.prevailingDocId).toBe(rBA.prevailingDocId);
  });
});

// ─── LDS-11: resolveHierarchyConflict — LEX_POSTERIOR rule ───────────────────

describe('LDS-11 resolveHierarchyConflict same level, later date prevails', () => {
  it('DECREE_OLD (2020) yields to DECREE (2025) → LEX_POSTERIOR', () => {
    const r = resolveHierarchyConflict(DECREE_OLD, DECREE);
    expect(r.rule).toBe('LEX_POSTERIOR');
    expect(r.prevailingDocId).toBe(DECREE.id);
  });
  it('prevailing doc has later effectiveDate', () => {
    const r = resolveHierarchyConflict(DECREE, DECREE_OLD);
    expect(r.prevailingDocId).toBe(DECREE.id);
  });
  it('reason mentions dates', () => {
    const r = resolveHierarchyConflict(DECREE_OLD, DECREE);
    expect(r.reason).toContain('2025');
  });
});

// ─── LDS-12: determineApplicability ──────────────────────────────────────────

describe('LDS-12 determineApplicability keyword filter and relevance scoring', () => {
  it('subjectMatter "đấu thầu" matches 2 of 3 articles', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01', subjectMatter: 'đấu thầu' };
    expect(determineApplicability(ARTICLES, ctx)).toHaveLength(2);
  });
  it('title match scores 1.0; content-only match scores 0.5', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01', subjectMatter: 'đấu thầu' };
    const results = determineApplicability(ARTICLES, ctx);
    expect(results[0]!.relevanceScore).toBe(1.0);  // "Đấu thầu rộng rãi" in title
    expect(results[1]!.relevanceScore).toBe(0.5);  // "Đấu thầu" only in content
  });
  it('no subjectMatter returns all 3 articles at score 1.0', () => {
    const ctx: ApplicabilityContext = { asOfDate: '2025-01-01' };
    const results = determineApplicability(ARTICLES, ctx);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.relevanceScore === 1.0)).toBe(true);
  });
});

// ─── LDS-13: resolveLegalStatus ───────────────────────────────────────────────

describe('LDS-13 resolveLegalStatus IN_FORCE / SUPERSEDED / UNKNOWN', () => {
  it('IN_FORCE when open period covers the date', async () => {
    const periodRepo = new MemoryEffectivePeriodRepository();
    const amendRepo  = new MemoryAmendmentRepository();
    await periodRepo.openPeriod('luat-22-2023', '2024-01-01', null);
    const status = await resolveLegalStatus('luat-22-2023', '2025-06-01', periodRepo, amendRepo);
    expect(status).toBe('IN_FORCE');
  });
  it('SUPERSEDED when REPLACE amendment effective and no period', async () => {
    const periodRepo = new MemoryEffectivePeriodRepository();
    const amendRepo  = new MemoryAmendmentRepository();
    await amendRepo.saveAmendment({ ...AMD_REPLACE, effectiveDate: '2026-01-01' });
    const status = await resolveLegalStatus('luat-22-2023', '2027-01-01', periodRepo, amendRepo);
    expect(status).toBe('SUPERSEDED');
  });
  it('UNKNOWN when no period and no amendments', async () => {
    const periodRepo = new MemoryEffectivePeriodRepository();
    const amendRepo  = new MemoryAmendmentRepository();
    const status = await resolveLegalStatus('luat-22-2023', '2025-01-01', periodRepo, amendRepo);
    expect(status).toBe('UNKNOWN');
  });
});
