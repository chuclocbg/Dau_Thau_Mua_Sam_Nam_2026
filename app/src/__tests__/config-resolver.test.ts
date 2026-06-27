/**
 * Phase 11.5.3 — Configuration Resolver tests
 *
 * Groups (13 × 3 = 39):
 *   RS-01  (3)  resolveConfiguration returns active+effective configs
 *   RS-02  (3)  resolveConfiguration respects asOfDate
 *   RS-03  (3)  resolveConfiguration sorts by priority desc
 *   RS-04  (3)  resolveConfiguration filters out non-ACTIVE configs
 *   RS-05  (3)  resolveConfiguration respects minConfidence
 *   RS-06  (3)  resolveWorkflow() wraps WORKFLOW_DEFINITION
 *   RS-07  (3)  resolveThreshold() wraps PROCUREMENT_THRESHOLD
 *   RS-08  (3)  resolveAuthority() wraps AUTHORITY_MATRIX
 *   RS-09  (3)  resolveTemplate() and resolveAuditRule()
 *   RS-10  (3)  resolveConfiguration returns empty when no match
 *   RS-11  (3)  resolveConfiguration excludes expired configs
 *   RS-12  (3)  priority tie-break: newer effectiveDate wins
 *   RS-13  (3)  buildConfigResolver factory
 */

import { describe, it, expect } from 'vitest';
import { ConfigResolver, buildConfigResolver } from '../legal/configResolver';
import { createInMemoryRepository } from '../legal/configRepository';
import { createConfig } from '../legal/governanceConfig';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DATE = '2024-06-01';  // reference asOfDate for all tests

// PROCUREMENT_THRESHOLD configs
const T_HIGH_P = createConfig({
  id: 't-high', type: 'PROCUREMENT_THRESHOLD', version: '2.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 10, confidence: 1.0, tags: ['đấu thầu'],
});
const T_LOW_P = createConfig({
  id: 't-low', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['đấu thầu'],
});
const T_DRAFT = createConfig({
  id: 't-draft', type: 'PROCUREMENT_THRESHOLD', version: '3.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'DRAFT', priority: 20, confidence: 1.0,
});
const T_FUTURE = createConfig({
  id: 't-future', type: 'PROCUREMENT_THRESHOLD', version: '4.0.0',
  effectiveDate: '2025-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 5, confidence: 1.0,
});
const T_EXPIRED = createConfig({
  id: 't-expired', type: 'PROCUREMENT_THRESHOLD', version: '0.9.0',
  effectiveDate: '2023-01-01', expiredDate: '2024-01-01', source: 'nd-23-2023',
  status: 'ACTIVE', priority: 1, confidence: 1.0,
});
const T_LOW_CONF = createConfig({
  id: 't-lowconf', type: 'PROCUREMENT_THRESHOLD', version: '1.1.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 1, confidence: 0.5,
});

// Other domain configs
const WORKFLOW_C = createConfig({
  id: 'wf-001', type: 'WORKFLOW_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['workflow'],
});
const AUTHORITY_C = createConfig({
  id: 'auth-001', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['authority'],
});
const TEMPLATE_C = createConfig({
  id: 'tmpl-001', type: 'DOCUMENT_TEMPLATE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-tmpl',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['template'],
});
const AUDIT_C = createConfig({
  id: 'aud-001', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['audit'],
});

// Priority tie-break: same priority, different effectiveDates
const T_SAME_P_OLD = createConfig({
  id: 't-old', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2023-01-01', source: 'nd-23-2023',
  status: 'ACTIVE', priority: 5, confidence: 1.0,
});
const T_SAME_P_NEW = createConfig({
  id: 't-new', type: 'PROCUREMENT_THRESHOLD', version: '2.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 5, confidence: 1.0,
});

function makeResolver(...configs: ReturnType<typeof createConfig>[]) {
  const repo = createInMemoryRepository(configs);
  return new ConfigResolver(repo);
}

// ── RS-01 resolveConfiguration returns active+effective configs ───────────────

describe('RS-01 resolveConfiguration active+effective', () => {
  it('RS-01-01 returns the ACTIVE effective config', () => {
    const r = makeResolver(T_HIGH_P);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(1);
  });

  it('RS-01-02 result contains correct config id', () => {
    const r = makeResolver(T_HIGH_P);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE });
    expect(result[0]!.id).toBe('t-high');
  });

  it('RS-01-03 returns multiple matching configs (no single-result constraint)', () => {
    const r = makeResolver(T_HIGH_P, T_LOW_P);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(2);
  });
});

// ── RS-02 resolveConfiguration respects asOfDate ──────────────────────────────

describe('RS-02 asOfDate filter', () => {
  it('RS-02-01 future config is not returned when asOfDate is before effectiveDate', () => {
    const r = makeResolver(T_FUTURE);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(0);
  });

  it('RS-02-02 future config is returned when asOfDate >= its effectiveDate', () => {
    const r = makeResolver(T_FUTURE);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: '2025-01-01' })).toHaveLength(1);
  });

  it('RS-02-03 config is effective on its own effectiveDate', () => {
    const r = makeResolver(T_HIGH_P);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: '2024-01-01' })).toHaveLength(1);
  });
});

// ── RS-03 resolveConfiguration sorts by priority desc ────────────────────────

describe('RS-03 sort by priority desc', () => {
  it('RS-03-01 highest priority config is first', () => {
    const r = makeResolver(T_LOW_P, T_HIGH_P);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE });
    expect(result[0]!.id).toBe('t-high');
  });

  it('RS-03-02 lowest priority config is last', () => {
    const r = makeResolver(T_HIGH_P, T_LOW_P);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE });
    expect(result[result.length - 1]!.id).toBe('t-low');
  });

  it('RS-03-03 result is frozen', () => {
    const r = makeResolver(T_HIGH_P);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE });
    expect(() => { (result as ReturnType<typeof createConfig>[]).push(T_LOW_P); }).toThrow();
  });
});

// ── RS-04 resolveConfiguration filters non-ACTIVE configs ─────────────────────

describe('RS-04 status filter', () => {
  it('RS-04-01 DRAFT configs are excluded', () => {
    const r = makeResolver(T_HIGH_P, T_DRAFT);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE });
    expect(result.every(c => c.status === 'ACTIVE')).toBe(true);
  });

  it('RS-04-02 only ACTIVE configs in result', () => {
    const r = makeResolver(T_DRAFT);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(0);
  });

  it('RS-04-03 ACTIVE count matches result length', () => {
    const r = makeResolver(T_HIGH_P, T_LOW_P, T_DRAFT);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(2);
  });
});

// ── RS-05 resolveConfiguration respects minConfidence ─────────────────────────

describe('RS-05 minConfidence filter', () => {
  it('RS-05-01 excludes configs below minConfidence', () => {
    const r = makeResolver(T_HIGH_P, T_LOW_CONF);
    const result = r.resolveConfiguration('PROCUREMENT_THRESHOLD', {
      asOfDate: DATE, minConfidence: 0.8,
    });
    expect(result.every(c => c.confidence >= 0.8)).toBe(true);
  });

  it('RS-05-02 low-confidence config returned when minConfidence is 0', () => {
    const r = makeResolver(T_LOW_CONF);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE, minConfidence: 0 })).toHaveLength(1);
  });

  it('RS-05-03 all configs excluded when minConfidence is 1.0 and some are low', () => {
    const r = makeResolver(T_LOW_CONF);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE, minConfidence: 1.0 })).toHaveLength(0);
  });
});

// ── RS-06 resolveWorkflow ─────────────────────────────────────────────────────

describe('RS-06 resolveWorkflow', () => {
  it('RS-06-01 returns WORKFLOW_DEFINITION configs', () => {
    const r = makeResolver(WORKFLOW_C, T_HIGH_P);
    const result = r.resolveWorkflow({ asOfDate: DATE });
    expect(result.every(c => c.type === 'WORKFLOW_DEFINITION')).toBe(true);
  });

  it('RS-06-02 does not include other domain configs', () => {
    const r = makeResolver(WORKFLOW_C, T_HIGH_P);
    expect(r.resolveWorkflow({ asOfDate: DATE })).toHaveLength(1);
  });

  it('RS-06-03 returns empty when no workflow configs exist', () => {
    const r = makeResolver(T_HIGH_P);
    expect(r.resolveWorkflow({ asOfDate: DATE })).toHaveLength(0);
  });
});

// ── RS-07 resolveThreshold ────────────────────────────────────────────────────

describe('RS-07 resolveThreshold', () => {
  it('RS-07-01 returns PROCUREMENT_THRESHOLD configs', () => {
    const r = makeResolver(T_HIGH_P, WORKFLOW_C);
    expect(r.resolveThreshold({ asOfDate: DATE }).every(c => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });

  it('RS-07-02 returns both active thresholds when both are effective', () => {
    const r = makeResolver(T_HIGH_P, T_LOW_P);
    expect(r.resolveThreshold({ asOfDate: DATE })).toHaveLength(2);
  });

  it('RS-07-03 returns empty when no thresholds are effective', () => {
    const r = makeResolver(T_FUTURE);
    expect(r.resolveThreshold({ asOfDate: DATE })).toHaveLength(0);
  });
});

// ── RS-08 resolveAuthority ────────────────────────────────────────────────────

describe('RS-08 resolveAuthority', () => {
  it('RS-08-01 returns AUTHORITY_MATRIX configs', () => {
    const r = makeResolver(AUTHORITY_C, T_HIGH_P);
    expect(r.resolveAuthority({ asOfDate: DATE }).every(c => c.type === 'AUTHORITY_MATRIX')).toBe(true);
  });

  it('RS-08-02 returns empty when no authority configs are effective', () => {
    const r = makeResolver(T_HIGH_P);
    expect(r.resolveAuthority({ asOfDate: DATE })).toHaveLength(0);
  });

  it('RS-08-03 authority config appears in resolveAuthority but not resolveThreshold', () => {
    const r = makeResolver(AUTHORITY_C);
    expect(r.resolveAuthority({ asOfDate: DATE })).toHaveLength(1);
    expect(r.resolveThreshold({ asOfDate: DATE })).toHaveLength(0);
  });
});

// ── RS-09 resolveTemplate and resolveAuditRule ────────────────────────────────

describe('RS-09 resolveTemplate and resolveAuditRule', () => {
  it('RS-09-01 resolveTemplate returns DOCUMENT_TEMPLATE configs', () => {
    const r = makeResolver(TEMPLATE_C, AUDIT_C);
    expect(r.resolveTemplate({ asOfDate: DATE }).every(c => c.type === 'DOCUMENT_TEMPLATE')).toBe(true);
  });

  it('RS-09-02 resolveAuditRule returns AUDIT_RULE configs', () => {
    const r = makeResolver(TEMPLATE_C, AUDIT_C);
    expect(r.resolveAuditRule({ asOfDate: DATE }).every(c => c.type === 'AUDIT_RULE')).toBe(true);
  });

  it('RS-09-03 resolveTemplate and resolveAuditRule are mutually exclusive in results', () => {
    const r = makeResolver(TEMPLATE_C, AUDIT_C);
    const tmplIds  = r.resolveTemplate({ asOfDate: DATE }).map(c => c.id);
    const auditIds = r.resolveAuditRule({ asOfDate: DATE }).map(c => c.id);
    expect(tmplIds.some(id => auditIds.includes(id))).toBe(false);
  });
});

// ── RS-10 resolveConfiguration returns empty when no match ────────────────────

describe('RS-10 empty result cases', () => {
  it('RS-10-01 empty repository → empty result', () => {
    const r = new ConfigResolver(createInMemoryRepository());
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(0);
  });

  it('RS-10-02 wrong type → empty result', () => {
    const r = makeResolver(WORKFLOW_C);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(0);
  });

  it('RS-10-03 all inactive → empty result', () => {
    const r = makeResolver(T_DRAFT);
    expect(r.resolveConfiguration('PROCUREMENT_THRESHOLD', { asOfDate: DATE })).toHaveLength(0);
  });
});

// ── RS-11 expired configs excluded ───────────────────────────────────────────

describe('RS-11 expired configs', () => {
  it('RS-11-01 expired config is excluded when asOfDate >= expiredDate', () => {
    const r = makeResolver(T_EXPIRED);
    expect(r.resolveThreshold({ asOfDate: '2024-01-01' })).toHaveLength(0);
  });

  it('RS-11-02 expired config is included one day before expiredDate', () => {
    const r = makeResolver(T_EXPIRED);
    expect(r.resolveThreshold({ asOfDate: '2023-12-31' })).toHaveLength(1);
  });

  it('RS-11-03 active and expired mix: only active returned', () => {
    const r = makeResolver(T_HIGH_P, T_EXPIRED);
    const result = r.resolveThreshold({ asOfDate: '2024-06-01' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('t-high');
  });
});

// ── RS-12 priority tie-break: newer effectiveDate wins ────────────────────────

describe('RS-12 priority tie-break by effectiveDate', () => {
  it('RS-12-01 newer effectiveDate at same priority comes first', () => {
    const r = makeResolver(T_SAME_P_OLD, T_SAME_P_NEW);
    const result = r.resolveThreshold({ asOfDate: DATE });
    expect(result[0]!.id).toBe('t-new');
  });

  it('RS-12-02 older effectiveDate at same priority comes second', () => {
    const r = makeResolver(T_SAME_P_OLD, T_SAME_P_NEW);
    const result = r.resolveThreshold({ asOfDate: DATE });
    expect(result[1]!.id).toBe('t-old');
  });

  it('RS-12-03 different priorities respect priority order regardless of date', () => {
    const r = makeResolver(T_HIGH_P, T_SAME_P_OLD, T_SAME_P_NEW);
    const result = r.resolveThreshold({ asOfDate: DATE });
    expect(result[0]!.id).toBe('t-high');  // priority 10 beats 5
  });
});

// ── RS-13 buildConfigResolver factory ─────────────────────────────────────────

describe('RS-13 buildConfigResolver factory', () => {
  it('RS-13-01 returns a ConfigResolver instance', () => {
    const resolver = buildConfigResolver(createInMemoryRepository([T_HIGH_P]));
    expect(resolver).toBeInstanceOf(ConfigResolver);
  });

  it('RS-13-02 factory-created resolver works correctly', () => {
    const resolver = buildConfigResolver(createInMemoryRepository([T_HIGH_P]));
    expect(resolver.resolveThreshold({ asOfDate: DATE })).toHaveLength(1);
  });

  it('RS-13-03 factory accepts an empty repository', () => {
    const resolver = buildConfigResolver(createInMemoryRepository());
    expect(resolver.resolveThreshold({ asOfDate: DATE })).toHaveLength(0);
  });
});
