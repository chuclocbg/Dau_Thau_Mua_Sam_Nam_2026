/**
 * Phase 11.5.2 — Configuration Repository tests
 *
 * Groups (13 × 3 = 39):
 *   CR-01  (3)  createInMemoryRepository with no initial data
 *   CR-02  (3)  createInMemoryRepository with initial data
 *   CR-03  (3)  add() stores a config and returns void
 *   CR-04  (3)  getById() — present and absent
 *   CR-05  (3)  getByType() — matching and non-matching
 *   CR-06  (3)  getAll() — returns all stored configs
 *   CR-07  (3)  getActive() — filters by status ACTIVE only
 *   CR-08  (3)  getEffectiveOn() — basic date filtering
 *   CR-09  (3)  getEffectiveOn() — expiredDate exclusive bound
 *   CR-10  (3)  remove() — found and not found
 *   CR-11  (3)  add() throws on duplicate id
 *   CR-12  (3)  createInMemoryRepository throws on duplicate in initial array
 *   CR-13  (3)  getByType returns frozen arrays
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryRepository } from '../legal/configRepository';
import { createConfig } from '../legal/governanceConfig';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const THRESH_A = createConfig({
  id: 'thresh-a', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023', status: 'ACTIVE', priority: 1,
  tags: ['đấu thầu'],
});
const THRESH_B = createConfig({
  id: 'thresh-b', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2025-01-01', source: 'nd-214-2025', status: 'ACTIVE', priority: 1,
});
const WORKFLOW = createConfig({
  id: 'wf-001', type: 'WORKFLOW_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-03-01', source: 'qc-001', status: 'ACTIVE', priority: 5,
});
const DRAFT = createConfig({
  id: 'audit-draft', type: 'AUDIT_RULE', version: '0.1.0',
  effectiveDate: '2024-01-01', source: 'tt-79-2025', status: 'DRAFT', priority: 1,
});
const EXPIRED = createConfig({
  id: 'thresh-old', type: 'PROCUREMENT_THRESHOLD', version: '0.9.0',
  effectiveDate: '2023-01-01', expiredDate: '2024-01-01', source: 'nd-23-2023',
  status: 'ACTIVE', priority: 1,
});

// ── CR-01 createInMemoryRepository with no initial data ───────────────────────

describe('CR-01 empty repository', () => {
  it('CR-01-01 getAll() on empty repository returns empty array', () => {
    expect(createInMemoryRepository().getAll()).toHaveLength(0);
  });

  it('CR-01-02 getActive() on empty repository returns empty array', () => {
    expect(createInMemoryRepository().getActive()).toHaveLength(0);
  });

  it('CR-01-03 getById() on empty repository returns undefined', () => {
    expect(createInMemoryRepository().getById('missing')).toBeUndefined();
  });
});

// ── CR-02 createInMemoryRepository with initial data ──────────────────────────

describe('CR-02 createInMemoryRepository with initial data', () => {
  it('CR-02-01 initial configs are accessible via getAll()', () => {
    const repo = createInMemoryRepository([THRESH_A, WORKFLOW]);
    expect(repo.getAll()).toHaveLength(2);
  });

  it('CR-02-02 initial configs are accessible via getById()', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.getById('thresh-a')).toBe(THRESH_A);
  });

  it('CR-02-03 initial configs of a type are accessible via getByType()', () => {
    const repo = createInMemoryRepository([THRESH_A, WORKFLOW]);
    expect(repo.getByType('PROCUREMENT_THRESHOLD')).toHaveLength(1);
  });
});

// ── CR-03 add() ───────────────────────────────────────────────────────────────

describe('CR-03 add', () => {
  it('CR-03-01 add() increases getAll() count by 1', () => {
    const repo = createInMemoryRepository();
    repo.add(THRESH_A);
    expect(repo.getAll()).toHaveLength(1);
  });

  it('CR-03-02 added config is retrievable by id', () => {
    const repo = createInMemoryRepository();
    repo.add(WORKFLOW);
    expect(repo.getById('wf-001')).toBe(WORKFLOW);
  });

  it('CR-03-03 multiple add() calls accumulate correctly', () => {
    const repo = createInMemoryRepository();
    repo.add(THRESH_A);
    repo.add(WORKFLOW);
    repo.add(DRAFT);
    expect(repo.getAll()).toHaveLength(3);
  });
});

// ── CR-04 getById() ───────────────────────────────────────────────────────────

describe('CR-04 getById', () => {
  it('CR-04-01 returns the correct config for a known id', () => {
    const repo = createInMemoryRepository([THRESH_A, WORKFLOW]);
    expect(repo.getById('wf-001')).toBe(WORKFLOW);
  });

  it('CR-04-02 returns undefined for an unknown id', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.getById('ghost')).toBeUndefined();
  });

  it('CR-04-03 returns the config after it was added', () => {
    const repo = createInMemoryRepository();
    repo.add(DRAFT);
    expect(repo.getById('audit-draft')).toBe(DRAFT);
  });
});

// ── CR-05 getByType() ─────────────────────────────────────────────────────────

describe('CR-05 getByType', () => {
  it('CR-05-01 returns only configs of the requested type', () => {
    const repo = createInMemoryRepository([THRESH_A, THRESH_B, WORKFLOW]);
    const thresholds = repo.getByType('PROCUREMENT_THRESHOLD');
    expect(thresholds).toHaveLength(2);
    expect(thresholds.every(c => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });

  it('CR-05-02 returns empty array for a type with no configs', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.getByType('AUTHORITY_MATRIX')).toHaveLength(0);
  });

  it('CR-05-03 does not return configs of other types', () => {
    const repo = createInMemoryRepository([THRESH_A, WORKFLOW]);
    expect(repo.getByType('WORKFLOW_DEFINITION').every(c => c.id === 'wf-001')).toBe(true);
  });
});

// ── CR-06 getAll() ────────────────────────────────────────────────────────────

describe('CR-06 getAll', () => {
  it('CR-06-01 returns all stored configs regardless of type or status', () => {
    const repo = createInMemoryRepository([THRESH_A, WORKFLOW, DRAFT]);
    expect(repo.getAll()).toHaveLength(3);
  });

  it('CR-06-02 includes both ACTIVE and DRAFT configs', () => {
    const repo = createInMemoryRepository([THRESH_A, DRAFT]);
    const statuses = repo.getAll().map(c => c.status);
    expect(statuses).toContain('ACTIVE');
    expect(statuses).toContain('DRAFT');
  });

  it('CR-06-03 returns an empty array when no configs have been added', () => {
    expect(createInMemoryRepository().getAll()).toHaveLength(0);
  });
});

// ── CR-07 getActive() ─────────────────────────────────────────────────────────

describe('CR-07 getActive', () => {
  it('CR-07-01 returns only ACTIVE configs', () => {
    const repo = createInMemoryRepository([THRESH_A, DRAFT, WORKFLOW]);
    const active = repo.getActive();
    expect(active.every(c => c.status === 'ACTIVE')).toBe(true);
  });

  it('CR-07-02 excludes DRAFT configs', () => {
    const repo = createInMemoryRepository([THRESH_A, DRAFT]);
    expect(repo.getActive().some(c => c.status === 'DRAFT')).toBe(false);
  });

  it('CR-07-03 ACTIVE count is correct', () => {
    const repo = createInMemoryRepository([THRESH_A, THRESH_B, DRAFT]);
    expect(repo.getActive()).toHaveLength(2);
  });
});

// ── CR-08 getEffectiveOn() — basic ────────────────────────────────────────────

describe('CR-08 getEffectiveOn basic', () => {
  it('CR-08-01 returns configs where effectiveDate <= date', () => {
    const repo = createInMemoryRepository([THRESH_A, THRESH_B]);
    // THRESH_A: effectiveDate=2024-01-01, THRESH_B: 2025-01-01
    // On 2024-06-01: only THRESH_A qualifies
    expect(repo.getEffectiveOn('2024-06-01')).toHaveLength(1);
    expect(repo.getEffectiveOn('2024-06-01')[0]!.id).toBe('thresh-a');
  });

  it('CR-08-02 returns configs effective on exacty their effectiveDate', () => {
    const repo = createInMemoryRepository([THRESH_B]);
    expect(repo.getEffectiveOn('2025-01-01')).toHaveLength(1);
  });

  it('CR-08-03 on date before all effectiveDates returns empty', () => {
    const repo = createInMemoryRepository([THRESH_A, THRESH_B]);
    expect(repo.getEffectiveOn('2023-01-01')).toHaveLength(0);
  });
});

// ── CR-09 getEffectiveOn() — expiredDate exclusive bound ──────────────────────

describe('CR-09 getEffectiveOn expiredDate', () => {
  it('CR-09-01 excludes a config on its expiredDate (exclusive upper bound)', () => {
    const repo = createInMemoryRepository([EXPIRED]);
    // EXPIRED: effectiveDate=2023-01-01, expiredDate=2024-01-01
    expect(repo.getEffectiveOn('2024-01-01')).toHaveLength(0);
  });

  it('CR-09-02 includes the config one day before expiredDate', () => {
    const repo = createInMemoryRepository([EXPIRED]);
    expect(repo.getEffectiveOn('2023-12-31')).toHaveLength(1);
  });

  it('CR-09-03 open-ended config (no expiredDate) is effective indefinitely', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.getEffectiveOn('2099-01-01')).toHaveLength(1);
  });
});

// ── CR-10 remove() ────────────────────────────────────────────────────────────

describe('CR-10 remove', () => {
  it('CR-10-01 remove() returns true when the config existed', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.remove('thresh-a')).toBe(true);
  });

  it('CR-10-02 removed config is no longer accessible via getById()', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    repo.remove('thresh-a');
    expect(repo.getById('thresh-a')).toBeUndefined();
  });

  it('CR-10-03 remove() returns false when the config did not exist', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(repo.remove('ghost-id')).toBe(false);
  });
});

// ── CR-11 add() throws on duplicate id ────────────────────────────────────────

describe('CR-11 add duplicate throws', () => {
  it('CR-11-01 add() throws when a config with the same id already exists', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    expect(() => repo.add(THRESH_A)).toThrow();
  });

  it('CR-11-02 throws even if the config content differs (same id)', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    const different = createConfig({ ...THRESH_A, version: '2.0.0' });
    expect(() => repo.add(different)).toThrow();
  });

  it('CR-11-03 after a failed add, the original config is still intact', () => {
    const repo = createInMemoryRepository([THRESH_A]);
    try { repo.add(THRESH_A); } catch { /* expected */ }
    expect(repo.getById('thresh-a')).toBe(THRESH_A);
  });
});

// ── CR-12 initial data duplicate throws ───────────────────────────────────────

describe('CR-12 initial data duplicate throws', () => {
  it('CR-12-01 throws when initial array contains duplicate ids', () => {
    expect(() => createInMemoryRepository([THRESH_A, THRESH_A])).toThrow();
  });

  it('CR-12-02 error message contains the duplicate id', () => {
    let message = '';
    try { createInMemoryRepository([THRESH_A, THRESH_A]); }
    catch (e) { message = (e as Error).message; }
    expect(message).toContain('thresh-a');
  });

  it('CR-12-03 no duplicate → repository created successfully', () => {
    expect(() => createInMemoryRepository([THRESH_A, WORKFLOW])).not.toThrow();
  });
});

// ── CR-13 getByType returns frozen arrays ─────────────────────────────────────

describe('CR-13 frozen results', () => {
  it('CR-13-01 getByType returns a frozen array', () => {
    const repo   = createInMemoryRepository([THRESH_A]);
    const result = repo.getByType('PROCUREMENT_THRESHOLD');
    expect(() => { (result as GovernanceConfig[]).push(THRESH_B); }).toThrow();
  });

  it('CR-13-02 getAll returns a frozen array', () => {
    const repo   = createInMemoryRepository([THRESH_A]);
    const result = repo.getAll();
    expect(() => { (result as GovernanceConfig[]).push(THRESH_B); }).toThrow();
  });

  it('CR-13-03 getEffectiveOn returns a frozen array', () => {
    const repo   = createInMemoryRepository([THRESH_A]);
    const result = repo.getEffectiveOn('2024-06-01');
    expect(() => { (result as GovernanceConfig[]).push(THRESH_B); }).toThrow();
  });
});

// Declare GovernanceConfig here to keep import-usage lean
import type { GovernanceConfig } from '../legal/governanceConfig';
