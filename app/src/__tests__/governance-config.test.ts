/**
 * Phase 11.5.1 — Governance Configuration Domain tests
 *
 * Groups (13 × 3 = 39):
 *   GC-01  (3)  CONFIG_TYPES constant — 11 entries
 *   GC-02  (3)  CONFIG_STATUSES constant — 5 entries
 *   GC-03  (3)  isConfigType / isConfigStatus type guards
 *   GC-04  (3)  createConfig required fields
 *   GC-05  (3)  createConfig default status and priority
 *   GC-06  (3)  createConfig default confidence, metadata, tags
 *   GC-07  (3)  createConfig custom status and priority
 *   GC-08  (3)  createConfig optional expiredDate
 *   GC-09  (3)  createConfig metadata is frozen
 *   GC-10  (3)  createConfig tags are frozen
 *   GC-11  (3)  CONFIG_TYPES covers all 11 domains
 *   GC-12  (3)  createConfig source field
 *   GC-13  (3)  GovernanceConfig interface field types
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIG_TYPES,
  CONFIG_STATUSES,
  isConfigType,
  isConfigStatus,
  createConfig,
} from '../legal/governanceConfig';
import type { GovernanceConfig } from '../legal/governanceConfig';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE = {
  id: 'thresh-001', type: 'PROCUREMENT_THRESHOLD' as const,
  version: '1.0.0', effectiveDate: '2024-01-01', source: 'luat-22-2023',
};

// ── GC-01 CONFIG_TYPES constant ───────────────────────────────────────────────

describe('GC-01 CONFIG_TYPES constant', () => {
  it('GC-01-01 CONFIG_TYPES has 11 entries', () => {
    expect(CONFIG_TYPES).toHaveLength(11);
  });

  it('GC-01-02 CONFIG_TYPES contains PROCUREMENT_THRESHOLD and AUTHORITY_MATRIX', () => {
    expect(CONFIG_TYPES).toContain('PROCUREMENT_THRESHOLD');
    expect(CONFIG_TYPES).toContain('AUTHORITY_MATRIX');
  });

  it('GC-01-03 CONFIG_TYPES contains WORKFLOW_DEFINITION and DASHBOARD_WIDGET', () => {
    expect(CONFIG_TYPES).toContain('WORKFLOW_DEFINITION');
    expect(CONFIG_TYPES).toContain('DASHBOARD_WIDGET');
  });
});

// ── GC-02 CONFIG_STATUSES constant ───────────────────────────────────────────

describe('GC-02 CONFIG_STATUSES constant', () => {
  it('GC-02-01 CONFIG_STATUSES has 5 entries', () => {
    expect(CONFIG_STATUSES).toHaveLength(5);
  });

  it('GC-02-02 CONFIG_STATUSES contains ACTIVE, INACTIVE, DRAFT', () => {
    expect(CONFIG_STATUSES).toContain('ACTIVE');
    expect(CONFIG_STATUSES).toContain('INACTIVE');
    expect(CONFIG_STATUSES).toContain('DRAFT');
  });

  it('GC-02-03 CONFIG_STATUSES contains SUPERSEDED and EXPIRED', () => {
    expect(CONFIG_STATUSES).toContain('SUPERSEDED');
    expect(CONFIG_STATUSES).toContain('EXPIRED');
  });
});

// ── GC-03 type guards ─────────────────────────────────────────────────────────

describe('GC-03 type guards', () => {
  it('GC-03-01 isConfigType accepts valid types and rejects unknowns', () => {
    expect(isConfigType('PROCUREMENT_THRESHOLD')).toBe(true);
    expect(isConfigType('DASHBOARD_WIDGET')).toBe(true);
    expect(isConfigType('ORDINANCE')).toBe(false);
    expect(isConfigType(null)).toBe(false);
  });

  it('GC-03-02 isConfigStatus accepts valid statuses and rejects unknowns', () => {
    expect(isConfigStatus('ACTIVE')).toBe(true);
    expect(isConfigStatus('SUPERSEDED')).toBe(true);
    expect(isConfigStatus('PENDING')).toBe(false);
    expect(isConfigStatus(undefined)).toBe(false);
  });

  it('GC-03-03 type guards are case-sensitive', () => {
    expect(isConfigType('procurement_threshold')).toBe(false);
    expect(isConfigStatus('active')).toBe(false);
  });
});

// ── GC-04 createConfig required fields ───────────────────────────────────────

describe('GC-04 createConfig required fields', () => {
  it('GC-04-01 id, type, version, effectiveDate are stored correctly', () => {
    const c = createConfig(BASE);
    expect(c.id).toBe('thresh-001');
    expect(c.type).toBe('PROCUREMENT_THRESHOLD');
    expect(c.version).toBe('1.0.0');
    expect(c.effectiveDate).toBe('2024-01-01');
  });

  it('GC-04-02 source is stored correctly', () => {
    expect(createConfig(BASE).source).toBe('luat-22-2023');
  });

  it('GC-04-03 different types produce correct GovernanceConfig', () => {
    const c = createConfig({ ...BASE, id: 'auth-001', type: 'AUTHORITY_MATRIX' });
    expect(c.type).toBe('AUTHORITY_MATRIX');
  });
});

// ── GC-05 createConfig default status and priority ────────────────────────────

describe('GC-05 defaults: status and priority', () => {
  it('GC-05-01 default status is DRAFT', () => {
    expect(createConfig(BASE).status).toBe('DRAFT');
  });

  it('GC-05-02 default priority is 1', () => {
    expect(createConfig(BASE).priority).toBe(1);
  });

  it('GC-05-03 omitting status and priority still produces a valid GovernanceConfig', () => {
    const c = createConfig(BASE);
    expect(c.status).toBe('DRAFT');
    expect(c.priority).toBe(1);
  });
});

// ── GC-06 createConfig default confidence, metadata, tags ─────────────────────

describe('GC-06 defaults: confidence, metadata, tags', () => {
  it('GC-06-01 default confidence is 1.0', () => {
    expect(createConfig(BASE).confidence).toBe(1.0);
  });

  it('GC-06-02 default metadata is an empty frozen object', () => {
    const c = createConfig(BASE);
    expect(Object.keys(c.metadata)).toHaveLength(0);
    expect(() => { (c.metadata as Record<string, string>)['x'] = 'y'; }).toThrow();
  });

  it('GC-06-03 default tags is an empty frozen array', () => {
    const c = createConfig(BASE);
    expect(c.tags).toHaveLength(0);
    expect(() => { (c.tags as string[]).push('x'); }).toThrow();
  });
});

// ── GC-07 createConfig custom status and priority ─────────────────────────────

describe('GC-07 custom status and priority', () => {
  it('GC-07-01 accepts custom status ACTIVE', () => {
    expect(createConfig({ ...BASE, status: 'ACTIVE' }).status).toBe('ACTIVE');
  });

  it('GC-07-02 accepts custom priority', () => {
    expect(createConfig({ ...BASE, priority: 10 }).priority).toBe(10);
  });

  it('GC-07-03 accepts SUPERSEDED status', () => {
    expect(createConfig({ ...BASE, status: 'SUPERSEDED' }).status).toBe('SUPERSEDED');
  });
});

// ── GC-08 createConfig optional expiredDate ───────────────────────────────────

describe('GC-08 optional expiredDate', () => {
  it('GC-08-01 expiredDate is undefined by default', () => {
    expect(createConfig(BASE).expiredDate).toBeUndefined();
  });

  it('GC-08-02 accepts an explicit expiredDate', () => {
    const c = createConfig({ ...BASE, expiredDate: '2024-12-31' });
    expect(c.expiredDate).toBe('2024-12-31');
  });

  it('GC-08-03 expiredDate is stored verbatim as ISO string', () => {
    expect(createConfig({ ...BASE, expiredDate: '2025-07-01' }).expiredDate).toBe('2025-07-01');
  });
});

// ── GC-09 metadata is frozen ──────────────────────────────────────────────────

describe('GC-09 metadata immutability', () => {
  it('GC-09-01 custom metadata is stored', () => {
    const c = createConfig({ ...BASE, metadata: { code: 'TT-200M' } });
    expect(c.metadata['code']).toBe('TT-200M');
  });

  it('GC-09-02 metadata is frozen (cannot mutate)', () => {
    const c = createConfig({ ...BASE, metadata: { a: '1' } });
    expect(() => { (c.metadata as Record<string, string>)['b'] = '2'; }).toThrow();
  });

  it('GC-09-03 mutating the original object after createConfig does not affect the config', () => {
    const meta: Record<string, string> = { x: '1' };
    const c = createConfig({ ...BASE, metadata: meta });
    meta['x'] = 'changed';
    expect(c.metadata['x']).toBe('1');
  });
});

// ── GC-10 tags are frozen ─────────────────────────────────────────────────────

describe('GC-10 tags immutability', () => {
  it('GC-10-01 custom tags are stored', () => {
    const c = createConfig({ ...BASE, tags: ['đấu thầu', 'ngưỡng'] });
    expect(c.tags).toContain('đấu thầu');
  });

  it('GC-10-02 tags are frozen (cannot push)', () => {
    const c = createConfig({ ...BASE, tags: ['x'] });
    expect(() => { (c.tags as string[]).push('y'); }).toThrow();
  });

  it('GC-10-03 mutating source array after createConfig does not affect the config', () => {
    const src = ['original'];
    const c   = createConfig({ ...BASE, tags: src });
    src.push('extra');
    expect(c.tags).toHaveLength(1);
  });
});

// ── GC-11 CONFIG_TYPES covers all 11 domains ──────────────────────────────────

describe('GC-11 CONFIG_TYPES coverage', () => {
  it('GC-11-01 contains FUNDING_SOURCE, ASSET_CATEGORY, RISK_RULE', () => {
    expect(CONFIG_TYPES).toContain('FUNDING_SOURCE');
    expect(CONFIG_TYPES).toContain('ASSET_CATEGORY');
    expect(CONFIG_TYPES).toContain('RISK_RULE');
  });

  it('GC-11-02 contains APPROVAL_POLICY, CHECKLIST_DEFINITION, DOCUMENT_TEMPLATE', () => {
    expect(CONFIG_TYPES).toContain('APPROVAL_POLICY');
    expect(CONFIG_TYPES).toContain('CHECKLIST_DEFINITION');
    expect(CONFIG_TYPES).toContain('DOCUMENT_TEMPLATE');
  });

  it('GC-11-03 contains AUDIT_RULE', () => {
    expect(CONFIG_TYPES).toContain('AUDIT_RULE');
  });
});

// ── GC-12 source field ────────────────────────────────────────────────────────

describe('GC-12 source field', () => {
  it('GC-12-01 source is stored verbatim', () => {
    expect(createConfig({ ...BASE, source: 'nd-214-2025' }).source).toBe('nd-214-2025');
  });

  it('GC-12-02 source can be an empty string (validation rejects it, factory allows it)', () => {
    expect(createConfig({ ...BASE, source: '' }).source).toBe('');
  });

  it('GC-12-03 source accepts admin reference strings', () => {
    expect(createConfig({ ...BASE, source: 'INTERNAL-POLICY-001' }).source).toBe('INTERNAL-POLICY-001');
  });
});

// ── GC-13 GovernanceConfig type coverage ─────────────────────────────────────

describe('GC-13 GovernanceConfig type coverage', () => {
  it('GC-13-01 GovernanceConfig has all required fields', () => {
    const c: GovernanceConfig = createConfig(BASE);
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('type');
    expect(c).toHaveProperty('version');
    expect(c).toHaveProperty('effectiveDate');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('priority');
    expect(c).toHaveProperty('source');
    expect(c).toHaveProperty('metadata');
    expect(c).toHaveProperty('confidence');
    expect(c).toHaveProperty('tags');
  });

  it('GC-13-02 confidence accepts 0.0 and 1.0 extremes', () => {
    expect(createConfig({ ...BASE, confidence: 0.0 }).confidence).toBe(0.0);
    expect(createConfig({ ...BASE, confidence: 1.0 }).confidence).toBe(1.0);
  });

  it('GC-13-03 version accepts semantic version strings', () => {
    expect(createConfig({ ...BASE, version: '2.3.1' }).version).toBe('2.3.1');
  });
});
