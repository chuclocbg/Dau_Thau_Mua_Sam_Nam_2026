/**
 * Phase 11.5.4 — Configuration Validator tests
 *
 * Groups (13 × 3 = 39):
 *   CV-01  (3)  valid configs → ok:true, no errors
 *   CV-02  (3)  DUPLICATE_ID error
 *   CV-03  (3)  MISSING_SOURCE error
 *   CV-04  (3)  OVERLAPPING_DATES error (same type, same priority)
 *   CV-05  (3)  OVERLAPPING_DATES NOT triggered for different priorities
 *   CV-06  (3)  ORPHAN_CONFIG error (graph provided)
 *   CV-07  (3)  INVALID_AUTHORITY_CHAIN error
 *   CV-08  (3)  LOW_CONFIDENCE warning
 *   CV-09  (3)  MISSING_TAGS warning
 *   CV-10  (3)  validation stats
 *   CV-11  (3)  mixed errors and warnings
 *   CV-12  (3)  empty config set
 *   CV-13  (3)  multiple errors simultaneously
 */

import { describe, it, expect } from 'vitest';
import { validateConfigs } from '../legal/configValidator';
import { createConfig } from '../legal/governanceConfig';
import { buildKnowledgeGraph, createNode } from '../legal/knowledgeGraph';

// ─── Graph fixture (for ORPHAN_CONFIG tests) ──────────────────────────────────

const N_DECREE = createNode('nd-214-2025', 'DECREE', 'Nghị định 214');
const GRAPH     = buildKnowledgeGraph([N_DECREE], []);

// ─── Config fixtures ──────────────────────────────────────────────────────────

const VALID_A = createConfig({
  id: 'thresh-a', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 1, confidence: 0.9, tags: ['đấu thầu'],
});
const VALID_B = createConfig({
  id: 'wf-001', type: 'WORKFLOW_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 0.8, tags: ['workflow'],
});
// Two ACTIVE, same type, same priority, overlapping date ranges
const OVERLAP_A = createConfig({
  id: 'thresh-ov-a', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', expiredDate: '2024-12-31', source: 'src-a',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['x'],
});
const OVERLAP_B = createConfig({
  id: 'thresh-ov-b', type: 'PROCUREMENT_THRESHOLD', version: '2.0.0',
  effectiveDate: '2024-06-01', source: 'src-b',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['x'],
});
// Same type, same dates, DIFFERENT priorities (no overlap error)
const PRIO_HIGH = createConfig({
  id: 'thresh-ph', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'luat-22-2023',
  status: 'ACTIVE', priority: 10, confidence: 1.0, tags: ['x'],
});
const PRIO_LOW = createConfig({
  id: 'thresh-pl', type: 'PROCUREMENT_THRESHOLD', version: '2.0.0',
  effectiveDate: '2024-06-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['x'],
});
// Missing source
const NO_SOURCE = createConfig({
  id: 'no-src', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: '',
  status: 'ACTIVE', priority: 1, tags: ['x'],
});
// Orphan: source references graph node that doesn't exist
const ORPHAN = createConfig({
  id: 'orphan-001', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'ghost-node-id',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['x'],
});
// Known graph node source
const KNOWN_SRC = createConfig({
  id: 'known-src-001', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',  // matches N_DECREE.id
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['x'],
});
// Authority chain
const PARENT_AUTH = createConfig({
  id: 'auth-parent', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
});
const CHILD_AUTH = createConfig({
  id: 'auth-child', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { parentId: 'auth-parent' },
});
const BROKEN_CHILD = createConfig({
  id: 'auth-broken', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { parentId: 'ghost-parent' },
});
// Low confidence
const LOW_CONF = createConfig({
  id: 'lc-001', type: 'CHECKLIST_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 0.5, tags: ['check'],
});
// No tags
const NO_TAGS = createConfig({
  id: 'nt-001', type: 'APPROVAL_POLICY', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 1.0,
});

// ── CV-01 valid configs → ok:true ─────────────────────────────────────────────

describe('CV-01 valid configs', () => {
  it('CV-01-01 valid config set returns ok:true', () => {
    expect(validateConfigs([VALID_A, VALID_B]).ok).toBe(true);
  });

  it('CV-01-02 no errors for a valid set', () => {
    expect(validateConfigs([VALID_A, VALID_B]).errors).toHaveLength(0);
  });

  it('CV-01-03 single valid config passes', () => {
    expect(validateConfigs([VALID_A]).ok).toBe(true);
  });
});

// ── CV-02 DUPLICATE_ID ────────────────────────────────────────────────────────

describe('CV-02 DUPLICATE_ID', () => {
  it('CV-02-01 returns ok:false when two configs share the same id', () => {
    expect(validateConfigs([VALID_A, VALID_A]).ok).toBe(false);
  });

  it('CV-02-02 error code is DUPLICATE_ID', () => {
    const report = validateConfigs([VALID_A, VALID_A]);
    expect(report.errors.some(e => e.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('CV-02-03 DUPLICATE_ID error identifies the duplicate id', () => {
    const report = validateConfigs([VALID_A, VALID_A]);
    const err    = report.errors.find(e => e.code === 'DUPLICATE_ID')!;
    expect(err.id).toBe('thresh-a');
  });
});

// ── CV-03 MISSING_SOURCE ──────────────────────────────────────────────────────

describe('CV-03 MISSING_SOURCE', () => {
  it('CV-03-01 returns ok:false for a config with empty source', () => {
    expect(validateConfigs([NO_SOURCE]).ok).toBe(false);
  });

  it('CV-03-02 error code is MISSING_SOURCE', () => {
    const report = validateConfigs([NO_SOURCE]);
    expect(report.errors.some(e => e.code === 'MISSING_SOURCE')).toBe(true);
  });

  it('CV-03-03 non-empty source does not trigger MISSING_SOURCE', () => {
    expect(validateConfigs([VALID_A]).errors.some(e => e.code === 'MISSING_SOURCE')).toBe(false);
  });
});

// ── CV-04 OVERLAPPING_DATES ───────────────────────────────────────────────────

describe('CV-04 OVERLAPPING_DATES', () => {
  it('CV-04-01 returns ok:false when two ACTIVE configs of same type and priority overlap', () => {
    expect(validateConfigs([OVERLAP_A, OVERLAP_B]).ok).toBe(false);
  });

  it('CV-04-02 error code is OVERLAPPING_DATES', () => {
    const report = validateConfigs([OVERLAP_A, OVERLAP_B]);
    expect(report.errors.some(e => e.code === 'OVERLAPPING_DATES')).toBe(true);
  });

  it('CV-04-03 OVERLAPPING_DATES error names one of the conflicting ids', () => {
    const report = validateConfigs([OVERLAP_A, OVERLAP_B]);
    const err    = report.errors.find(e => e.code === 'OVERLAPPING_DATES')!;
    expect(['thresh-ov-a', 'thresh-ov-b']).toContain(err.id);
  });
});

// ── CV-05 no OVERLAPPING_DATES for different priorities ──────────────────────

describe('CV-05 OVERLAPPING_DATES not triggered for different priorities', () => {
  it('CV-05-01 different priorities → no OVERLAPPING_DATES error', () => {
    const report = validateConfigs([PRIO_HIGH, PRIO_LOW]);
    expect(report.errors.some(e => e.code === 'OVERLAPPING_DATES')).toBe(false);
  });

  it('CV-05-02 different types → no OVERLAPPING_DATES even with same priority and overlap', () => {
    const report = validateConfigs([OVERLAP_A, VALID_B]);  // VALID_B is WORKFLOW, different type
    expect(report.errors.some(e => e.code === 'OVERLAPPING_DATES')).toBe(false);
  });

  it('CV-05-03 INACTIVE configs do not participate in overlap detection', () => {
    const inactive = createConfig({ ...OVERLAP_B, id: 'overlap-inactive', status: 'INACTIVE' });
    const report   = validateConfigs([OVERLAP_A, inactive]);
    expect(report.errors.some(e => e.code === 'OVERLAPPING_DATES')).toBe(false);
  });
});

// ── CV-06 ORPHAN_CONFIG (graph provided) ─────────────────────────────────────

describe('CV-06 ORPHAN_CONFIG', () => {
  it('CV-06-01 returns ok:false when source not in graph', () => {
    expect(validateConfigs([ORPHAN], GRAPH).ok).toBe(false);
  });

  it('CV-06-02 error code is ORPHAN_CONFIG', () => {
    const report = validateConfigs([ORPHAN], GRAPH);
    expect(report.errors.some(e => e.code === 'ORPHAN_CONFIG')).toBe(true);
  });

  it('CV-06-03 no ORPHAN_CONFIG when source matches a graph node id', () => {
    const report = validateConfigs([KNOWN_SRC], GRAPH);
    expect(report.errors.some(e => e.code === 'ORPHAN_CONFIG')).toBe(false);
  });
});

// ── CV-07 INVALID_AUTHORITY_CHAIN ─────────────────────────────────────────────

describe('CV-07 INVALID_AUTHORITY_CHAIN', () => {
  it('CV-07-01 returns ok:false when parentId references unknown config', () => {
    expect(validateConfigs([BROKEN_CHILD]).ok).toBe(false);
  });

  it('CV-07-02 error code is INVALID_AUTHORITY_CHAIN', () => {
    const report = validateConfigs([BROKEN_CHILD]);
    expect(report.errors.some(e => e.code === 'INVALID_AUTHORITY_CHAIN')).toBe(true);
  });

  it('CV-07-03 valid parent-child chain does not trigger error', () => {
    const report = validateConfigs([PARENT_AUTH, CHILD_AUTH]);
    expect(report.errors.some(e => e.code === 'INVALID_AUTHORITY_CHAIN')).toBe(false);
  });
});

// ── CV-08 LOW_CONFIDENCE warning ──────────────────────────────────────────────

describe('CV-08 LOW_CONFIDENCE warning', () => {
  it('CV-08-01 LOW_CONFIDENCE warning is emitted for confidence < 0.7', () => {
    const report = validateConfigs([LOW_CONF]);
    expect(report.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
  });

  it('CV-08-02 warning alone does not set ok:false', () => {
    const report = validateConfigs([LOW_CONF]);
    expect(report.ok).toBe(true);
  });

  it('CV-08-03 confidence >= 0.7 does not trigger LOW_CONFIDENCE', () => {
    const report = validateConfigs([VALID_A]);  // confidence 0.9
    expect(report.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(false);
  });
});

// ── CV-09 MISSING_TAGS warning ────────────────────────────────────────────────

describe('CV-09 MISSING_TAGS warning', () => {
  it('CV-09-01 MISSING_TAGS warning for empty tags array', () => {
    const report = validateConfigs([NO_TAGS]);
    expect(report.warnings.some(w => w.code === 'MISSING_TAGS')).toBe(true);
  });

  it('CV-09-02 MISSING_TAGS warning does not set ok:false', () => {
    expect(validateConfigs([NO_TAGS]).ok).toBe(true);
  });

  it('CV-09-03 non-empty tags array does not trigger MISSING_TAGS', () => {
    const report = validateConfigs([VALID_A]);
    expect(report.warnings.some(w => w.code === 'MISSING_TAGS')).toBe(false);
  });
});

// ── CV-10 validation stats ────────────────────────────────────────────────────

describe('CV-10 validation stats', () => {
  it('CV-10-01 stats.total equals configs.length', () => {
    const report = validateConfigs([VALID_A, VALID_B]);
    expect(report.stats.total).toBe(2);
  });

  it('CV-10-02 stats.active counts ACTIVE configs', () => {
    const draft  = createConfig({ ...VALID_A, id: 'draft-x', status: 'DRAFT' });
    const report = validateConfigs([VALID_A, draft]);
    expect(report.stats.active).toBe(1);
    expect(report.stats.draft).toBe(1);
  });

  it('CV-10-03 stats.byType counts by ConfigType', () => {
    const report = validateConfigs([VALID_A, VALID_B]);
    expect(report.stats.byType['PROCUREMENT_THRESHOLD']).toBe(1);
    expect(report.stats.byType['WORKFLOW_DEFINITION']).toBe(1);
    expect(report.stats.byType['AUDIT_RULE']).toBeUndefined();
  });
});

// ── CV-11 mixed errors and warnings ──────────────────────────────────────────

describe('CV-11 mixed errors and warnings', () => {
  it('CV-11-01 a config can have both an error and a warning', () => {
    const problem = createConfig({
      id: 'prob', type: 'AUDIT_RULE', version: '1.0.0',
      effectiveDate: '2024-01-01', source: '',  // MISSING_SOURCE
      status: 'ACTIVE', priority: 1, confidence: 0.5,  // LOW_CONFIDENCE
      // no tags → MISSING_TAGS
    });
    const report = validateConfigs([problem]);
    expect(report.ok).toBe(false);
    expect(report.errors.some(e => e.code === 'MISSING_SOURCE')).toBe(true);
    expect(report.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
  });

  it('CV-11-02 multiple independent errors are all reported', () => {
    const report = validateConfigs([VALID_A, VALID_A, NO_SOURCE]);
    const codes  = report.errors.map(e => e.code);
    expect(codes).toContain('DUPLICATE_ID');
    expect(codes).toContain('MISSING_SOURCE');
  });

  it('CV-11-03 ok is false when any error is present, even with no warnings', () => {
    const report = validateConfigs([NO_SOURCE]);
    expect(report.ok).toBe(false);
  });
});

// ── CV-12 empty config set ────────────────────────────────────────────────────

describe('CV-12 empty config set', () => {
  it('CV-12-01 empty array returns ok:true', () => {
    expect(validateConfigs([]).ok).toBe(true);
  });

  it('CV-12-02 empty array has no errors or warnings', () => {
    const report = validateConfigs([]);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
  });

  it('CV-12-03 empty array stats.total is 0', () => {
    expect(validateConfigs([]).stats.total).toBe(0);
  });
});

// ── CV-13 multiple errors simultaneously ──────────────────────────────────────

describe('CV-13 multiple simultaneous errors', () => {
  it('CV-13-01 both DUPLICATE_ID and MISSING_SOURCE can appear in same report', () => {
    const report = validateConfigs([NO_SOURCE, NO_SOURCE]);
    const codes  = report.errors.map(e => e.code);
    expect(codes).toContain('DUPLICATE_ID');
    expect(codes).toContain('MISSING_SOURCE');
  });

  it('CV-13-02 OVERLAPPING_DATES and MISSING_SOURCE can appear together', () => {
    const ov_no_src_b = createConfig({
      ...OVERLAP_B, id: 'thresh-ov-ns', source: '',
    });
    const report = validateConfigs([OVERLAP_A, ov_no_src_b]);
    const codes  = report.errors.map(e => e.code);
    expect(codes).toContain('OVERLAPPING_DATES');
    expect(codes).toContain('MISSING_SOURCE');
  });

  it('CV-13-03 validateConfigs without graph skips ORPHAN_CONFIG check', () => {
    // ORPHAN has a source that's not in any graph, but no graph is passed
    const report = validateConfigs([ORPHAN]);
    expect(report.errors.some(e => e.code === 'ORPHAN_CONFIG')).toBe(false);
  });
});
