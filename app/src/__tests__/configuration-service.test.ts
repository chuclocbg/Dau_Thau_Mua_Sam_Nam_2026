/**
 * Phase 13 — ConfigurationService tests
 *
 * Groups (13 × 3 = 39):
 *   CS-01  (3)  resolveConfiguration — returns configs by type
 *   CS-02  (3)  resolveConfiguration — empty when no configs of that type
 *   CS-03  (3)  resolveConfiguration — respects asOfDate from ctx.currentDate
 *   CS-04  (3)  resolveConfiguration — uses ctx.effectiveDate when present
 *   CS-05  (3)  resolveConfiguration — result shape (legalReferences, confidence)
 *   CS-06  (3)  resolveThreshold — returns PROCUREMENT_THRESHOLD configs
 *   CS-07  (3)  resolveThreshold — delegates to resolveConfiguration
 *   CS-08  (3)  resolveThreshold — empty when no threshold configs
 *   CS-09  (3)  generateGovernanceContext — creates valid GovernanceContext
 *   CS-10  (3)  generateGovernanceContext — required fields set
 *   CS-11  (3)  generateGovernanceContext — optional fields preserved
 *   CS-12  (3)  result shape — auditTrail and metadata
 *   CS-13  (3)  buildConfigurationService factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }             from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver }      from '../legal/configResolver';
import type { GovernanceConfig }    from '../legal/governanceConfig';
import {
  buildConfigurationService, ConfigurationService,
} from '../application/configurationService';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }   from '../application/governanceContext';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD' };

// ─── Config fixtures ──────────────────────────────────────────────────────────

const THRESH_A = createConfig({
  id: 'thresh-a', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '100000000' },
});

const THRESH_B = createConfig({
  id: 'thresh-b', type: 'PROCUREMENT_THRESHOLD', version: '2.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 2, confidence: 0.95, tags: ['threshold'],
  metadata: { maxAmount: '200000000' },
});

const THRESH_FUTURE = createConfig({
  id: 'thresh-future', type: 'PROCUREMENT_THRESHOLD', version: '3.0.0',
  effectiveDate: '2025-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '500000000' },
});

const AUTH = createConfig({
  id: 'auth-001', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { role: 'UNIT_HEAD', maxAmount: '50000000' },
});

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(configs: GovernanceConfig[] = []) {
  const repo     = createInMemoryRepository(configs);
  const resolver = buildConfigResolver(repo);
  return buildConfigurationService(resolver);
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── CS-01: resolveConfiguration — returns configs by type ───────────────────

describe('CS-01 resolveConfiguration by type', () => {
  const svc    = makeService([THRESH_A, AUTH]);
  const ctx    = makeCtx();
  const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns only PROCUREMENT_THRESHOLD configs', () => {
    expect(result.data?.every(c => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });
  it('does not return AUTH configs', () => {
    const ids = result.data?.map(c => c.id) ?? [];
    expect(ids).not.toContain('auth-001');
  });
});

// ─── CS-02: resolveConfiguration — empty when no match ───────────────────────

describe('CS-02 resolveConfiguration empty', () => {
  const svc    = makeService([AUTH]);
  const ctx    = makeCtx();
  const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty', () => {
    expect(result.data).toHaveLength(0);
  });
  it('confidence is 1.0 for empty result', () => {
    expect(result.confidence).toBe(1.0);
  });
});

// ─── CS-03: resolveConfiguration — respects ctx.currentDate ──────────────────

describe('CS-03 resolveConfiguration currentDate filter', () => {
  const svc = makeService([THRESH_A, THRESH_FUTURE]);

  it('excludes future configs on DATE', () => {
    const ctx    = makeCtx();
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    const ids    = result.data?.map(c => c.id) ?? [];
    expect(ids).not.toContain('thresh-future');
  });
  it('includes future config when date is in 2025', () => {
    const ctx    = makeCtx({ currentDate: '2025-06-01' });
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    const ids    = result.data?.map(c => c.id) ?? [];
    expect(ids).toContain('thresh-future');
  });
  it('returns 1 config on DATE (only thresh-a)', () => {
    const ctx    = makeCtx();
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    expect(result.data).toHaveLength(1);
  });
});

// ─── CS-04: resolveConfiguration — ctx.effectiveDate override ────────────────

describe('CS-04 resolveConfiguration effectiveDate override', () => {
  const svc = makeService([THRESH_A]);

  it('excludes config when effectiveDate is before config effectiveDate', () => {
    const ctx    = makeCtx({ effectiveDate: '2023-01-01' });
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    expect(result.data).toHaveLength(0);
  });
  it('includes config when effectiveDate is on config effectiveDate', () => {
    const ctx    = makeCtx({ effectiveDate: '2024-01-01' });
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    expect(result.data).toHaveLength(1);
  });
  it('metadata.asOfDate reflects effectiveDate', () => {
    const ctx    = makeCtx({ effectiveDate: '2023-01-01' });
    const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    expect(result.metadata['asOfDate']).toBe('2023-01-01');
  });
});

// ─── CS-05: resolveConfiguration — result shape ──────────────────────────────

describe('CS-05 resolveConfiguration result shape', () => {
  const svc    = makeService([THRESH_A, THRESH_B]);
  const ctx    = makeCtx();
  const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);

  it('legalReferences contains config sources', () => {
    expect(result.legalReferences).toContain('nd-214-2025');
  });
  it('confidence is average of config confidences', () => {
    // THRESH_A conf=1.0, THRESH_B conf=0.95 → avg=0.975
    expect(result.confidence).toBeCloseTo(0.975);
  });
  it('metadata.count matches data length', () => {
    expect(result.metadata['count']).toBe(String(result.data?.length ?? 0));
  });
});

// ─── CS-06: resolveThreshold — returns PROCUREMENT_THRESHOLD ─────────────────

describe('CS-06 resolveThreshold returns threshold configs', () => {
  const svc    = makeService([THRESH_A, AUTH]);
  const ctx    = makeCtx();
  const result = svc.resolveThreshold(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('returns only PROCUREMENT_THRESHOLD', () => {
    expect(result.data?.every(c => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });
  it('does not return AUTH configs', () => {
    const ids = result.data?.map(c => c.id) ?? [];
    expect(ids).not.toContain('auth-001');
  });
});

// ─── CS-07: resolveThreshold — consistent with resolveConfiguration ───────────

describe('CS-07 resolveThreshold delegates correctly', () => {
  const svc = makeService([THRESH_A, THRESH_B]);
  const ctx = makeCtx();

  it('same result as resolveConfiguration PROCUREMENT_THRESHOLD', () => {
    const r1 = svc.resolveThreshold(ctx);
    const r2 = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    expect(r1.data?.map(c => c.id)).toEqual(r2.data?.map(c => c.id));
  });
  it('status is SUCCESS', () => {
    expect(svc.resolveThreshold(ctx).status).toBe('SUCCESS');
  });
  it('returns 2 threshold configs', () => {
    expect(svc.resolveThreshold(ctx).data).toHaveLength(2);
  });
});

// ─── CS-08: resolveThreshold — empty when no threshold ───────────────────────

describe('CS-08 resolveThreshold empty', () => {
  const svc    = makeService([AUTH]);
  const ctx    = makeCtx();
  const result = svc.resolveThreshold(ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty', () => {
    expect(result.data).toHaveLength(0);
  });
  it('confidence is 1.0 for empty', () => {
    expect(result.confidence).toBe(1.0);
  });
});

// ─── CS-09: generateGovernanceContext — creates valid context ─────────────────

describe('CS-09 generateGovernanceContext valid', () => {
  const svc = makeService();
  const ctx = svc.generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-cs',
  });

  it('currentDate is set', () => {
    expect(ctx.currentDate).toBe(DATE);
  });
  it('actor is set', () => {
    expect(ctx.actor.id).toBe('u-001');
  });
  it('requestId is set', () => {
    expect(ctx.requestId).toBe('req-cs');
  });
});

// ─── CS-10: generateGovernanceContext — required fields ──────────────────────

describe('CS-10 generateGovernanceContext required fields', () => {
  const svc = makeService();
  const ctx = svc.generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-cs-10',
    organization: 'Bộ Tài Chính', department: 'Kho bạc Nhà nước',
  });

  it('organization is set', () => {
    expect(ctx.organization).toBe('Bộ Tài Chính');
  });
  it('department is set', () => {
    expect(ctx.department).toBe('Kho bạc Nhà nước');
  });
  it('locale defaults to vi-VN', () => {
    expect(ctx.locale).toBe('vi-VN');
  });
});

// ─── CS-11: generateGovernanceContext — optional fields ──────────────────────

describe('CS-11 generateGovernanceContext optional fields', () => {
  const svc = makeService();
  const ctx = svc.generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-cs-11',
    packageValue: 50_000_000, fundingSource: 'AUTONOMY', locale: 'en-US',
  });

  it('packageValue is set', () => {
    expect(ctx.packageValue).toBe(50_000_000);
  });
  it('fundingSource is set', () => {
    expect(ctx.fundingSource).toBe('AUTONOMY');
  });
  it('locale override is respected', () => {
    expect(ctx.locale).toBe('en-US');
  });
});

// ─── CS-12: result shape — auditTrail and metadata ───────────────────────────

describe('CS-12 result shape auditTrail metadata', () => {
  const svc    = makeService([THRESH_A]);
  const ctx    = makeCtx();
  const result = svc.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);

  it('auditTrail has one entry', () => {
    expect(result.auditTrail).toHaveLength(1);
  });
  it('auditTrail action is resolveConfiguration', () => {
    expect(result.auditTrail[0]?.action).toBe('resolveConfiguration');
  });
  it('metadata.type is PROCUREMENT_THRESHOLD', () => {
    expect(result.metadata['type']).toBe('PROCUREMENT_THRESHOLD');
  });
});

// ─── CS-13: buildConfigurationService factory ────────────────────────────────

describe('CS-13 buildConfigurationService factory', () => {
  it('returns a ConfigurationService instance', () => {
    const svc = makeService();
    expect(svc).toBeInstanceOf(ConfigurationService);
  });
  it('has resolveConfiguration method', () => {
    const svc = makeService();
    expect(typeof svc.resolveConfiguration).toBe('function');
  });
  it('has generateGovernanceContext method', () => {
    const svc = makeService();
    expect(typeof svc.generateGovernanceContext).toBe('function');
  });
});
