/**
 * Phase 13 — DashboardService tests
 *
 * Groups (13 × 3 = 39):
 *   DS-01  (3)  getGovernanceDashboard — returns DashboardSummary
 *   DS-02  (3)  getGovernanceDashboard — activeLegalDocuments count
 *   DS-03  (3)  getGovernanceDashboard — activeConfigurations count
 *   DS-04  (3)  getGovernanceDashboard — complianceStatus reflects rule result
 *   DS-05  (3)  getGovernanceDashboard — asOfDate matches ctx
 *   DS-06  (3)  getLegalSummary — returns LegalSummary
 *   DS-07  (3)  getLegalSummary — effectiveOnDate uses ctx.currentDate
 *   DS-08  (3)  getActiveConfigurations — all types when no type given
 *   DS-09  (3)  getActiveConfigurations — filtered by type
 *   DS-10  (3)  getActiveConfigurations — respects asOfDate
 *   DS-11  (3)  result shape — metadata fields
 *   DS-12  (3)  result shape — legalReferences and auditTrail
 *   DS-13  (3)  buildDashboardService factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }             from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver }      from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import { createRegistry }           from '../legal/legalRegistry';
import { buildQueryEngine }         from '../legal/registryQueryEngine';
import type { GovernanceConfig }    from '../legal/governanceConfig';
import type { LegalDocument }       from '../legal/legalRegistry';
import { buildDashboardService, DashboardService } from '../application/dashboardService';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }   from '../application/governanceContext';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD' };

// ─── Document fixtures ────────────────────────────────────────────────────────

const DOC_A: LegalDocument = {
  id: 'doc-a', symbol: '01/2024/QH', title: 'Luật A', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2024-01-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 10, tags: ['luật'], summary: 'Luật A',
  confidence: 1.0,
};

const DOC_B: LegalDocument = {
  id: 'doc-b', symbol: '02/2024/NĐ', title: 'Nghị định B', type: 'DECREE',
  issuer: 'Chính phủ', effectiveDate: '2024-03-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 5, tags: ['nghị định'], summary: 'NĐ B',
  confidence: 0.9,
};

// ─── Config fixtures ──────────────────────────────────────────────────────────

const THRESH = createConfig({
  id: 'thresh-001', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '100000000' },
});

const AUDIT = createConfig({
  id: 'audit-001', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['audit'],
  metadata: {},
});

const RISK_REVIEW = createConfig({
  id: 'risk-001', type: 'RISK_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-risk',
  status: 'ACTIVE', priority: 1, confidence: 0.9, tags: ['risk'],
  metadata: { requiresReview: 'true' },
});

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(docs: LegalDocument[] = [], configs: GovernanceConfig[] = []) {
  const registry   = createRegistry(docs);
  const query      = buildQueryEngine(registry);
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  return buildDashboardService(query, resolver, ruleEngine);
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── DS-01: getGovernanceDashboard — DashboardSummary ───────────────────────

describe('DS-01 getGovernanceDashboard summary', () => {
  const svc    = makeService([DOC_A], [THRESH]);
  const ctx    = makeCtx();
  const result = svc.getGovernanceDashboard(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is defined', () => {
    expect(result.data).toBeDefined();
  });
  it('data has asOfDate', () => {
    expect(result.data?.asOfDate).toBe(DATE);
  });
});

// ─── DS-02: getGovernanceDashboard — activeLegalDocuments ────────────────────

describe('DS-02 getGovernanceDashboard activeLegalDocuments', () => {
  it('0 docs → activeLegalDocuments=0', () => {
    const svc    = makeService([], []);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeLegalDocuments).toBe(0);
  });
  it('1 doc → activeLegalDocuments=1', () => {
    const svc    = makeService([DOC_A], []);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeLegalDocuments).toBe(1);
  });
  it('2 docs → activeLegalDocuments=2', () => {
    const svc    = makeService([DOC_A, DOC_B], []);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeLegalDocuments).toBe(2);
  });
});

// ─── DS-03: getGovernanceDashboard — activeConfigurations ────────────────────

describe('DS-03 getGovernanceDashboard activeConfigurations', () => {
  it('0 configs → activeConfigurations=0', () => {
    const svc    = makeService([], []);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeConfigurations).toBe(0);
  });
  it('1 config → activeConfigurations=1', () => {
    const svc    = makeService([], [THRESH]);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeConfigurations).toBe(1);
  });
  it('2 configs → activeConfigurations=2', () => {
    const svc    = makeService([], [THRESH, AUDIT]);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.activeConfigurations).toBe(2);
  });
});

// ─── DS-04: getGovernanceDashboard — complianceStatus ───────────────────────

describe('DS-04 getGovernanceDashboard complianceStatus', () => {
  it('no audit config → PENDING (INSUFFICIENT_DATA)', () => {
    const svc    = makeService([], []);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.complianceStatus).toBe('PENDING');
  });
  it('audit config only → SUCCESS', () => {
    const svc    = makeService([], [AUDIT]);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.complianceStatus).toBe('SUCCESS');
  });
  it('risk rule with requiresReview → REQUIRES_REVIEW', () => {
    const svc    = makeService([], [AUDIT, RISK_REVIEW]);
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.complianceStatus).toBe('REQUIRES_REVIEW');
  });
});

// ─── DS-05: getGovernanceDashboard — asOfDate ────────────────────────────────

describe('DS-05 getGovernanceDashboard asOfDate', () => {
  it('data.asOfDate matches ctx.currentDate', () => {
    const svc    = makeService();
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.data?.asOfDate).toBe(DATE);
  });
  it('data.asOfDate uses ctx.effectiveDate when present', () => {
    const svc    = makeService();
    const ctx    = makeCtx({ effectiveDate: '2023-06-01' });
    const result = svc.getGovernanceDashboard(ctx);
    expect(result.data?.asOfDate).toBe('2023-06-01');
  });
  it('messages mention the asOfDate', () => {
    const svc    = makeService();
    const result = svc.getGovernanceDashboard(makeCtx());
    expect(result.messages[0]).toContain(DATE);
  });
});

// ─── DS-06: getLegalSummary — LegalSummary ───────────────────────────────────

describe('DS-06 getLegalSummary summary', () => {
  const svc    = makeService([DOC_A, DOC_B]);
  const ctx    = makeCtx();
  const result = svc.getLegalSummary(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is defined', () => {
    expect(result.data).toBeDefined();
  });
  it('activeDocuments is 2', () => {
    expect(result.data?.activeDocuments).toBe(2);
  });
});

// ─── DS-07: getLegalSummary — effectiveOnDate ─────────────────────────────────

describe('DS-07 getLegalSummary effectiveOnDate', () => {
  // DOC_A effective from 2024-01-01, DOC_B from 2024-03-01
  const svc = makeService([DOC_A, DOC_B]);

  it('effectiveOnDate=1 when date between DOC_A and DOC_B effectiveDate', () => {
    const ctx    = makeCtx({ currentDate: '2024-02-01' });
    const result = svc.getLegalSummary(ctx);
    expect(result.data?.effectiveOnDate).toBe(1);
  });
  it('effectiveOnDate=2 when date after both effectiveDates', () => {
    const ctx    = makeCtx();
    const result = svc.getLegalSummary(ctx);
    expect(result.data?.effectiveOnDate).toBe(2);
  });
  it('effectiveOnDate=0 when date before all docs', () => {
    const ctx    = makeCtx({ currentDate: '2023-01-01' });
    const result = svc.getLegalSummary(ctx);
    expect(result.data?.effectiveOnDate).toBe(0);
  });
});

// ─── DS-08: getActiveConfigurations — all types ───────────────────────────────

describe('DS-08 getActiveConfigurations all types', () => {
  const svc    = makeService([], [THRESH, AUDIT]);
  const ctx    = makeCtx();
  const result = svc.getActiveConfigurations(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns all active configs', () => {
    expect(result.data).toHaveLength(2);
  });
  it('metadata.type is ALL', () => {
    expect(result.metadata['type']).toBe('ALL');
  });
});

// ─── DS-09: getActiveConfigurations — filtered by type ───────────────────────

describe('DS-09 getActiveConfigurations by type', () => {
  const svc    = makeService([], [THRESH, AUDIT]);
  const ctx    = makeCtx();
  const result = svc.getActiveConfigurations(ctx, 'PROCUREMENT_THRESHOLD');

  it('returns only PROCUREMENT_THRESHOLD configs', () => {
    expect(result.data?.every(c => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });
  it('returns exactly 1 threshold config', () => {
    expect(result.data).toHaveLength(1);
  });
  it('metadata.type is PROCUREMENT_THRESHOLD', () => {
    expect(result.metadata['type']).toBe('PROCUREMENT_THRESHOLD');
  });
});

// ─── DS-10: getActiveConfigurations — respects asOfDate ──────────────────────

describe('DS-10 getActiveConfigurations asOfDate', () => {
  const svc = makeService([], [THRESH]); // THRESH effectiveDate='2024-01-01'
  const ctx = makeCtx({ currentDate: '2023-01-01' });

  it('empty before effectiveDate', () => {
    const result = svc.getActiveConfigurations(ctx);
    expect(result.data).toHaveLength(0);
  });
  it('non-empty on effectiveDate', () => {
    const ctx2   = makeCtx({ currentDate: '2024-01-01' });
    const result = svc.getActiveConfigurations(ctx2, 'PROCUREMENT_THRESHOLD');
    expect(result.data).toHaveLength(1);
  });
  it('metadata.asOfDate matches ctx.currentDate', () => {
    const result = svc.getActiveConfigurations(ctx);
    expect(result.metadata['asOfDate']).toBe('2023-01-01');
  });
});

// ─── DS-11: result shape — metadata ──────────────────────────────────────────

describe('DS-11 result shape metadata', () => {
  const svc = makeService([DOC_A], [THRESH]);
  const ctx = makeCtx();

  it('getGovernanceDashboard metadata has activeLegalDocuments', () => {
    const r = svc.getGovernanceDashboard(ctx);
    expect(r.metadata['activeLegalDocuments']).toBe('1');
  });
  it('getGovernanceDashboard metadata has activeConfigurations', () => {
    const r = svc.getGovernanceDashboard(ctx);
    expect(r.metadata['activeConfigurations']).toBe('1');
  });
  it('getActiveConfigurations metadata.count matches data length', () => {
    const r = svc.getActiveConfigurations(ctx);
    expect(r.metadata['count']).toBe(String(r.data?.length ?? 0));
  });
});

// ─── DS-12: result shape — legalReferences and auditTrail ────────────────────

describe('DS-12 result shape legalReferences auditTrail', () => {
  const svc    = makeService([], [THRESH]);
  const ctx    = makeCtx();
  const result = svc.getActiveConfigurations(ctx, 'PROCUREMENT_THRESHOLD');

  it('legalReferences contains config source', () => {
    expect(result.legalReferences).toContain('nd-214');
  });
  it('auditTrail has one entry', () => {
    expect(result.auditTrail).toHaveLength(1);
  });
  it('auditTrail action is getActiveConfigurations', () => {
    expect(result.auditTrail[0]?.action).toBe('getActiveConfigurations');
  });
});

// ─── DS-13: buildDashboardService factory ────────────────────────────────────

describe('DS-13 buildDashboardService factory', () => {
  it('returns a DashboardService instance', () => {
    const svc = makeService();
    expect(svc).toBeInstanceOf(DashboardService);
  });
  it('has getGovernanceDashboard method', () => {
    const svc = makeService();
    expect(typeof svc.getGovernanceDashboard).toBe('function');
  });
  it('has getLegalSummary method', () => {
    const svc = makeService();
    expect(typeof svc.getLegalSummary).toBe('function');
  });
});
