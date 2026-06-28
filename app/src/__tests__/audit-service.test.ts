/**
 * Phase 13 — AuditService tests
 *
 * Groups (13 × 3 = 39):
 *   AS-01  (3)  reviewCompliance — no audit config → FAILED (INSUFFICIENT_DATA)
 *   AS-02  (3)  reviewCompliance — audit config present → SUCCESS
 *   AS-03  (3)  reviewCompliance — risk rule triggers REQUIRES_REVIEW
 *   AS-04  (3)  reviewCompliance — result shape (data is RuleResult)
 *   AS-05  (3)  getAuditRules — returns active AUDIT_RULE configs
 *   AS-06  (3)  getAuditRules — returns empty for no configs
 *   AS-07  (3)  getAuditRules — uses ctx.effectiveDate when present
 *   AS-08  (3)  validateConfiguration — valid configs → SUCCESS
 *   AS-09  (3)  validateConfiguration — duplicate ids → FAILED
 *   AS-10  (3)  validateConfiguration — warnings forwarded
 *   AS-11  (3)  validateConfiguration — stats in result.data
 *   AS-12  (3)  result shape — auditTrail populated
 *   AS-13  (3)  buildAuditService factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }             from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver }      from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import type { GovernanceConfig }    from '../legal/governanceConfig';
import { buildAuditService, AuditService } from '../application/auditService';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }   from '../application/governanceContext';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD' };

// ─── Config fixtures ──────────────────────────────────────────────────────────

const AUDIT_MONTHLY = createConfig({
  id: 'audit-monthly', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['audit'],
  metadata: { frequency: 'monthly' },
});

const RISK_REVIEW = createConfig({
  id: 'risk-review', type: 'RISK_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-risk',
  status: 'ACTIVE', priority: 1, confidence: 0.9, tags: ['risk'],
  metadata: { requiresReview: 'true' },
});

const AUDIT_DRAFT = createConfig({
  id: 'audit-draft', type: 'AUDIT_RULE', version: '0.1.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'DRAFT', priority: 1, confidence: 1.0, tags: ['audit'],
  metadata: {},
});

const LOW_CONF_AUDIT = createConfig({
  id: 'audit-low-conf', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 0.5, tags: [],
  metadata: {},
});

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(configs: GovernanceConfig[] = []) {
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  return buildAuditService(ruleEngine, resolver);
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── AS-01: reviewCompliance — no config → FAILED ────────────────────────────

describe('AS-01 reviewCompliance no config', () => {
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.reviewCompliance(ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('data.verdict is INSUFFICIENT_DATA', () => {
    expect(result.data?.verdict).toBe('INSUFFICIENT_DATA');
  });
  it('errors or warnings present', () => {
    expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── AS-02: reviewCompliance — audit config present → SUCCESS ─────────────────

describe('AS-02 reviewCompliance audit config SUCCESS', () => {
  const svc    = makeService([AUDIT_MONTHLY]);
  const ctx    = makeCtx();
  const result = svc.reviewCompliance(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data.verdict is APPROVED', () => {
    expect(result.data?.verdict).toBe('APPROVED');
  });
  it('legalReferences includes source', () => {
    expect(result.legalReferences).toContain('qc-audit');
  });
});

// ─── AS-03: reviewCompliance — risk rule REQUIRES_REVIEW ─────────────────────

describe('AS-03 reviewCompliance risk REQUIRES_REVIEW', () => {
  const svc    = makeService([AUDIT_MONTHLY, RISK_REVIEW]);
  const ctx    = makeCtx();
  const result = svc.reviewCompliance(ctx);

  it('status is REQUIRES_REVIEW', () => {
    expect(result.status).toBe('REQUIRES_REVIEW');
  });
  it('data.verdict is REQUIRES_REVIEW', () => {
    expect(result.data?.verdict).toBe('REQUIRES_REVIEW');
  });
  it('warnings mention manual review', () => {
    expect(result.warnings[0]).toContain('review');
  });
});

// ─── AS-04: reviewCompliance — result.data shape ─────────────────────────────

describe('AS-04 reviewCompliance result.data shape', () => {
  const svc    = makeService([AUDIT_MONTHLY]);
  const ctx    = makeCtx();
  const result = svc.reviewCompliance(ctx);

  it('data has verdict field', () => {
    expect(result.data?.verdict).toBeDefined();
  });
  it('data has reason field', () => {
    expect(result.data?.reason).toBeDefined();
  });
  it('data.checkedConfigs is positive', () => {
    expect((result.data?.checkedConfigs ?? 0)).toBeGreaterThan(0);
  });
});

// ─── AS-05: getAuditRules — active configs ────────────────────────────────────

describe('AS-05 getAuditRules active configs', () => {
  const svc    = makeService([AUDIT_MONTHLY, AUDIT_DRAFT]);
  const ctx    = makeCtx();
  const result = svc.getAuditRules(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns only ACTIVE configs', () => {
    const ids = result.data?.map(c => c.id) ?? [];
    expect(ids).not.toContain('audit-draft');
  });
  it('returns audit-monthly', () => {
    expect(result.data?.map(c => c.id)).toContain('audit-monthly');
  });
});

// ─── AS-06: getAuditRules — no configs → empty ────────────────────────────────

describe('AS-06 getAuditRules empty', () => {
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.getAuditRules(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty array', () => {
    expect(result.data).toHaveLength(0);
  });
  it('confidence defaults to 1.0', () => {
    expect(result.confidence).toBe(1.0);
  });
});

// ─── AS-07: getAuditRules — effectiveDate override ───────────────────────────

describe('AS-07 getAuditRules effectiveDate override', () => {
  // AUDIT_MONTHLY effectiveDate='2024-01-01'; asking with effectiveDate='2023-01-01'
  const svc    = makeService([AUDIT_MONTHLY]);
  const ctx    = makeCtx({ effectiveDate: '2023-01-01' });
  const result = svc.getAuditRules(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty (config not yet effective)', () => {
    expect(result.data).toHaveLength(0);
  });
  it('confidence is 1.0 for empty result', () => {
    expect(result.confidence).toBe(1.0);
  });
});

// ─── AS-08: validateConfiguration — valid → SUCCESS ──────────────────────────

describe('AS-08 validateConfiguration valid', () => {
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.validateConfiguration([AUDIT_MONTHLY, RISK_REVIEW], ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data.ok is true', () => {
    expect(result.data?.ok).toBe(true);
  });
  it('errors array is empty', () => {
    expect(result.errors).toHaveLength(0);
  });
});

// ─── AS-09: validateConfiguration — duplicate ids → FAILED ───────────────────

describe('AS-09 validateConfiguration duplicate ids', () => {
  const DUP = createConfig({
    ...AUDIT_MONTHLY,
    id: 'audit-monthly', // same id as AUDIT_MONTHLY
    version: '2.0.0',
  });
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.validateConfiguration([AUDIT_MONTHLY, DUP], ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('data.ok is false', () => {
    expect(result.data?.ok).toBe(false);
  });
  it('errors mention duplicate', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── AS-10: validateConfiguration — warnings forwarded ───────────────────────

describe('AS-10 validateConfiguration warnings', () => {
  // LOW_CONF_AUDIT has confidence=0.5 → LOW_CONFIDENCE warning
  // LOW_CONF_AUDIT has tags=[] → MISSING_TAGS warning
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.validateConfiguration([LOW_CONF_AUDIT], ctx);

  it('status is SUCCESS (warnings not errors)', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('warnings array is non-empty', () => {
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('data.warnings are present in report', () => {
    expect(result.data?.warnings.length).toBeGreaterThan(0);
  });
});

// ─── AS-11: validateConfiguration — stats in result.data ─────────────────────

describe('AS-11 validateConfiguration stats', () => {
  const svc    = makeService();
  const ctx    = makeCtx();
  const result = svc.validateConfiguration([AUDIT_MONTHLY, AUDIT_DRAFT, RISK_REVIEW], ctx);

  it('data.stats.total is 3', () => {
    expect(result.data?.stats.total).toBe(3);
  });
  it('data.stats.active is 2 (ACTIVE configs)', () => {
    expect(result.data?.stats.active).toBe(2);
  });
  it('data.stats.draft is 1', () => {
    expect(result.data?.stats.draft).toBe(1);
  });
});

// ─── AS-12: result shape — auditTrail ────────────────────────────────────────

describe('AS-12 result shape auditTrail', () => {
  const svc = makeService([AUDIT_MONTHLY]);
  const ctx = makeCtx();

  it('reviewCompliance auditTrail populated', () => {
    const r = svc.reviewCompliance(ctx);
    expect(r.auditTrail).toHaveLength(1);
  });
  it('getAuditRules auditTrail action is correct', () => {
    const r = svc.getAuditRules(ctx);
    expect(r.auditTrail[0]?.action).toBe('getAuditRules');
  });
  it('validateConfiguration auditTrail action is correct', () => {
    const r = svc.validateConfiguration([AUDIT_MONTHLY], ctx);
    expect(r.auditTrail[0]?.action).toBe('validateConfiguration');
  });
});

// ─── AS-13: buildAuditService factory ────────────────────────────────────────

describe('AS-13 buildAuditService factory', () => {
  it('returns AuditService instance', () => {
    const svc = makeService();
    expect(svc).toBeInstanceOf(AuditService);
  });
  it('has reviewCompliance method', () => {
    const svc = makeService();
    expect(typeof svc.reviewCompliance).toBe('function');
  });
  it('has validateConfiguration method', () => {
    const svc = makeService();
    expect(typeof svc.validateConfiguration).toBe('function');
  });
});
