/**
 * Phase 13 — LegalService tests
 *
 * Groups (13 × 3 = 39):
 *   LS-01  (3)  resolveApplicableLaw — returns active docs effective on date
 *   LS-02  (3)  resolveApplicableLaw — returns empty before any effectiveDate
 *   LS-03  (3)  resolveApplicableLaw — result shape (legalReferences, confidence)
 *   LS-04  (3)  resolveApplicableLaw — uses ctx.effectiveDate when present
 *   LS-05  (3)  getLegalImpact — unknown nodeId returns FAILED
 *   LS-06  (3)  getLegalImpact — empty graph node returns FAILED
 *   LS-07  (3)  searchLaw — keyword match returns docs
 *   LS-08  (3)  searchLaw — no match returns empty SUCCESS
 *   LS-09  (3)  searchLaw — blank keyword returns FAILED
 *   LS-10  (3)  searchLaw — case-insensitive match
 *   LS-11  (3)  result shape — auditTrail populated
 *   LS-12  (3)  result shape — metadata count field
 *   LS-13  (3)  buildLegalService factory
 */

import { describe, it, expect } from 'vitest';
import { createRegistry }         from '../legal/legalRegistry';
import { buildQueryEngine }        from '../legal/registryQueryEngine';
import { buildKnowledgeGraph }     from '../legal/knowledgeGraph';
import { buildGovernanceImpactEngine } from '../legal/governanceImpactEngine';
import type { LegalDocument }      from '../legal/legalRegistry';
import { buildLegalService, LegalService } from '../application/legalService';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }  from '../application/governanceContext';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD' };

// ─── Document fixtures ────────────────────────────────────────────────────────

const DOC_LAW: LegalDocument = {
  id: 'luat-dau-thau-2023', symbol: '22/2023/QH15', title: 'Luật Đấu thầu 2023',
  type: 'LAW', issuer: 'Quốc hội', effectiveDate: '2024-01-01',
  status: 'ACTIVE', source: 'vbpl.vn', priority: 10,
  tags: ['đấu thầu', 'mua sắm'], summary: 'Luật đấu thầu mới nhất',
  confidence: 1.0,
};

const DOC_DECREE: LegalDocument = {
  id: 'nd-24-2024', symbol: '24/2024/NĐ-CP', title: 'Nghị định hướng dẫn',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2024-03-01',
  status: 'ACTIVE', source: 'vbpl.vn', priority: 5,
  tags: ['nghị định'], summary: 'Hướng dẫn thi hành Luật Đấu thầu',
  confidence: 0.95,
};

const DOC_SUPERSEDED: LegalDocument = {
  id: 'nd-old-2020', symbol: '63/2020/NĐ-CP', title: 'Nghị định cũ',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2020-01-01',
  status: 'SUPERSEDED', source: 'vbpl.vn', priority: 5,
  tags: ['cũ'], summary: 'Nghị định đã bãi bỏ', confidence: 0.5,
};

const DOC_FUTURE: LegalDocument = {
  id: 'nd-future-2025', symbol: 'XX/2025/NĐ-CP', title: 'Nghị định tương lai',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2025-01-01',
  status: 'ACTIVE', source: 'vbpl.vn', priority: 5,
  tags: ['future'], summary: 'Chưa có hiệu lực', confidence: 0.9,
};

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(docs: LegalDocument[] = []) {
  const registry    = createRegistry(docs);
  const queryEngine = buildQueryEngine(registry);
  const graph       = buildKnowledgeGraph([], []);
  const impact      = buildGovernanceImpactEngine(graph);
  return buildLegalService(queryEngine, impact);
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── LS-01: resolveApplicableLaw — returns active docs ───────────────────────

describe('LS-01 resolveApplicableLaw active docs', () => {
  const svc    = makeService([DOC_LAW, DOC_DECREE, DOC_SUPERSEDED]);
  const ctx    = makeCtx();
  const result = svc.resolveApplicableLaw(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns only ACTIVE docs', () => {
    const ids = result.data?.map(d => d.id) ?? [];
    expect(ids).not.toContain('nd-old-2020');
  });
  it('returns both active docs', () => {
    expect(result.data).toHaveLength(2);
  });
});

// ─── LS-02: resolveApplicableLaw — before effectiveDate ──────────────────────

describe('LS-02 resolveApplicableLaw before effectiveDate', () => {
  const svc = makeService([DOC_LAW]);
  // currentDate is before DOC_LAW.effectiveDate '2024-01-01'
  const ctx    = makeCtx({ currentDate: '2023-01-01' });
  const result = svc.resolveApplicableLaw(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty', () => {
    expect(result.data).toHaveLength(0);
  });
  it('messages mention 0 documents', () => {
    expect(result.messages[0]).toContain('0');
  });
});

// ─── LS-03: resolveApplicableLaw — result shape ───────────────────────────────

describe('LS-03 resolveApplicableLaw result shape', () => {
  const svc    = makeService([DOC_LAW]);
  const ctx    = makeCtx();
  const result = svc.resolveApplicableLaw(ctx);

  it('legalReferences contains doc id', () => {
    expect(result.legalReferences).toContain('luat-dau-thau-2023');
  });
  it('confidence is 1.0 (only conf=1.0 docs)', () => {
    expect(result.confidence).toBe(1.0);
  });
  it('auditTrail has one entry', () => {
    expect(result.auditTrail).toHaveLength(1);
  });
});

// ─── LS-04: resolveApplicableLaw — uses effectiveDate ────────────────────────

describe('LS-04 resolveApplicableLaw effectiveDate override', () => {
  const svc = makeService([DOC_FUTURE]);
  // ctx.currentDate='2024-06-01' < '2025-01-01', but effectiveDate='2025-06-01'
  const ctx    = makeCtx({ effectiveDate: '2025-06-01' });
  const result = svc.resolveApplicableLaw(ctx);

  it('future doc is included when effectiveDate covers it', () => {
    const ids = result.data?.map(d => d.id) ?? [];
    expect(ids).toContain('nd-future-2025');
  });
  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('legalReferences contains future doc', () => {
    expect(result.legalReferences).toContain('nd-future-2025');
  });
});

// ─── LS-05: getLegalImpact — unknown nodeId returns FAILED ───────────────────

describe('LS-05 getLegalImpact unknown nodeId', () => {
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.getLegalImpact('no-such-node', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors mention the nodeId', () => {
    expect(result.errors[0]).toContain('no-such-node');
  });
  it('data is undefined', () => {
    expect(result.data).toBeUndefined();
  });
});

// ─── LS-06: getLegalImpact — empty graph always returns FAILED ────────────────

describe('LS-06 getLegalImpact empty graph', () => {
  const svc    = makeService([DOC_LAW]);
  const ctx    = makeCtx();
  // The graph has no nodes even though the registry does
  const result = svc.getLegalImpact('luat-dau-thau-2023', ctx);

  it('status is FAILED for empty graph', () => {
    expect(result.status).toBe('FAILED');
  });
  it('auditTrail has an entry', () => {
    expect(result.auditTrail).toHaveLength(1);
  });
  it('data is undefined', () => {
    expect(result.data).toBeUndefined();
  });
});

// ─── LS-07: searchLaw — keyword match ─────────────────────────────────────────

describe('LS-07 searchLaw keyword match', () => {
  const svc    = makeService([DOC_LAW, DOC_DECREE]);
  const ctx    = makeCtx();
  const result = svc.searchLaw('đấu thầu', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns matching docs', () => {
    expect((result.data?.length ?? 0)).toBeGreaterThan(0);
  });
  it('legalReferences populated', () => {
    expect(result.legalReferences.length).toBeGreaterThan(0);
  });
});

// ─── LS-08: searchLaw — no match ──────────────────────────────────────────────

describe('LS-08 searchLaw no match', () => {
  const svc    = makeService([DOC_LAW]);
  const ctx    = makeCtx();
  const result = svc.searchLaw('xyznotexist999', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty', () => {
    expect(result.data).toHaveLength(0);
  });
  it('legalReferences is empty', () => {
    expect(result.legalReferences).toHaveLength(0);
  });
});

// ─── LS-09: searchLaw — blank keyword ────────────────────────────────────────

describe('LS-09 searchLaw blank keyword', () => {
  const svc = makeService([DOC_LAW]);
  const ctx = makeCtx();

  it('empty string returns FAILED', () => {
    expect(svc.searchLaw('', ctx).status).toBe('FAILED');
  });
  it('whitespace-only returns FAILED', () => {
    expect(svc.searchLaw('   ', ctx).status).toBe('FAILED');
  });
  it('errors mention blank', () => {
    expect(svc.searchLaw('', ctx).errors[0]).toContain('blank');
  });
});

// ─── LS-10: searchLaw — case-insensitive ──────────────────────────────────────

describe('LS-10 searchLaw case-insensitive', () => {
  const svc    = makeService([DOC_LAW]);
  const ctx    = makeCtx();
  const lower  = svc.searchLaw('luật đấu thầu', ctx);
  const upper  = svc.searchLaw('LUẬT ĐẤU THẦU', ctx);
  const mixed  = svc.searchLaw('Luật Đấu Thầu', ctx);

  it('lowercase matches', () => {
    expect(lower.data?.length).toBeGreaterThan(0);
  });
  it('uppercase matches', () => {
    expect(upper.data?.length).toBeGreaterThan(0);
  });
  it('mixed case matches', () => {
    expect(mixed.data?.length).toBeGreaterThan(0);
  });
});

// ─── LS-11: result shape — auditTrail ────────────────────────────────────────

describe('LS-11 result shape auditTrail', () => {
  const svc = makeService([DOC_LAW]);
  const ctx = makeCtx();

  it('resolveApplicableLaw auditTrail action is correct', () => {
    const r = svc.resolveApplicableLaw(ctx);
    expect(r.auditTrail[0]?.action).toBe('resolveApplicableLaw');
  });
  it('searchLaw auditTrail action is correct', () => {
    const r = svc.searchLaw('luật', ctx);
    expect(r.auditTrail[0]?.action).toBe('searchLaw');
  });
  it('getLegalImpact auditTrail action is correct', () => {
    const r = svc.getLegalImpact('x', ctx);
    expect(r.auditTrail[0]?.action).toBe('getLegalImpact');
  });
});

// ─── LS-12: result shape — metadata count ────────────────────────────────────

describe('LS-12 result shape metadata count', () => {
  const svc    = makeService([DOC_LAW, DOC_DECREE]);
  const ctx    = makeCtx();
  const result = svc.resolveApplicableLaw(ctx);

  it('metadata.count reflects result count', () => {
    expect(result.metadata['count']).toBe(String(result.data?.length ?? 0));
  });
  it('metadata.date matches ctx.currentDate', () => {
    expect(result.metadata['date']).toBe(DATE);
  });
  it('metadata is frozen', () => {
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });
});

// ─── LS-13: buildLegalService factory ─────────────────────────────────────────

describe('LS-13 buildLegalService factory', () => {
  it('returns a LegalService instance', () => {
    const svc = makeService();
    expect(svc).toBeInstanceOf(LegalService);
  });
  it('has resolveApplicableLaw method', () => {
    const svc = makeService();
    expect(typeof svc.resolveApplicableLaw).toBe('function');
  });
  it('has getLegalImpact method', () => {
    const svc = makeService();
    expect(typeof svc.getLegalImpact).toBe('function');
  });
});
