/**
 * Phase 13 — GovernanceContext tests
 *
 * Groups (13 × 3 = 39):
 *   GX-01  (3)  generateGovernanceContext — required fields present
 *   GX-02  (3)  generateGovernanceContext — locale defaults to vi-VN
 *   GX-03  (3)  generateGovernanceContext — metadata copy is frozen
 *   GX-04  (3)  createResult — SUCCESS status, data present
 *   GX-05  (3)  createResult — FAILED status, errors present
 *   GX-06  (3)  createResult — defaults (confidence 1.0, empty arrays)
 *   GX-07  (3)  createResult — all arrays are frozen
 *   GX-08  (3)  createResult — REQUIRES_REVIEW status
 *   GX-09  (3)  toRuleContext — maps fields to RuleContext
 *   GX-10  (3)  toRuleContext — uses effectiveDate when present
 *   GX-11  (3)  toWorkflowContext — produces string Record
 *   GX-12  (3)  toWorkflowContext — omits undefined/absent fields
 *   GX-13  (3)  RESULT_STATUS_VALUES and createAuditEntry
 */

import { describe, it, expect } from 'vitest';
import {
  generateGovernanceContext,
  createResult,
  createAuditEntry,
  toRuleContext,
  toWorkflowContext,
  RESULT_STATUS_VALUES,
  type GovernanceContext,
} from '../application/governanceContext';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD', name: 'Test User' };

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── GX-01: generateGovernanceContext — required fields ───────────────────────

describe('GX-01 generateGovernanceContext required fields', () => {
  const ctx = makeCtx();

  it('currentDate is set', () => {
    expect(ctx.currentDate).toBe(DATE);
  });
  it('actor is set', () => {
    expect(ctx.actor.id).toBe('u-001');
  });
  it('requestId is set', () => {
    expect(ctx.requestId).toBe('req-001');
  });
});

// ─── GX-02: generateGovernanceContext — optional defaults ─────────────────────

describe('GX-02 generateGovernanceContext optional defaults', () => {
  const ctx = makeCtx();

  it('locale defaults to vi-VN', () => {
    expect(ctx.locale).toBe('vi-VN');
  });
  it('effectiveDate is undefined when not provided', () => {
    expect(ctx.effectiveDate).toBeUndefined();
  });
  it('custom locale is preserved', () => {
    const c = makeCtx({ locale: 'en-US' });
    expect(c.locale).toBe('en-US');
  });
});

// ─── GX-03: generateGovernanceContext — metadata frozen ───────────────────────

describe('GX-03 generateGovernanceContext metadata frozen', () => {
  it('metadata is frozen', () => {
    const ctx = makeCtx({ metadata: { key: 'val' } });
    expect(Object.isFrozen(ctx.metadata)).toBe(true);
  });
  it('original metadata object is not mutated by freeze', () => {
    const meta = { key: 'original' };
    makeCtx({ metadata: meta });
    meta['key'] = 'changed';
    expect(meta['key']).toBe('changed');
  });
  it('metadata values are accessible', () => {
    const ctx = makeCtx({ metadata: { dept: 'IT' } });
    expect(ctx.metadata?.['dept']).toBe('IT');
  });
});

// ─── GX-04: createResult — SUCCESS ───────────────────────────────────────────

describe('GX-04 createResult SUCCESS', () => {
  it('status is SUCCESS', () => {
    const r = createResult('SUCCESS', { data: 42 });
    expect(r.status).toBe('SUCCESS');
  });
  it('data is present', () => {
    const r = createResult('SUCCESS', { data: 'hello' });
    expect(r.data).toBe('hello');
  });
  it('messages are preserved', () => {
    const r = createResult('SUCCESS', { messages: ['done'] });
    expect(r.messages[0]).toBe('done');
  });
});

// ─── GX-05: createResult — FAILED ────────────────────────────────────────────

describe('GX-05 createResult FAILED', () => {
  it('status is FAILED', () => {
    const r = createResult('FAILED');
    expect(r.status).toBe('FAILED');
  });
  it('errors are preserved', () => {
    const r = createResult('FAILED', { errors: ['boom'] });
    expect(r.errors[0]).toBe('boom');
  });
  it('data is undefined when not provided', () => {
    const r = createResult('FAILED');
    expect(r.data).toBeUndefined();
  });
});

// ─── GX-06: createResult — defaults ──────────────────────────────────────────

describe('GX-06 createResult defaults', () => {
  const r = createResult('SUCCESS');

  it('confidence defaults to 1.0', () => {
    expect(r.confidence).toBe(1.0);
  });
  it('messages defaults to empty array', () => {
    expect(r.messages).toEqual([]);
  });
  it('generatedArtifacts defaults to empty array', () => {
    expect(r.generatedArtifacts).toEqual([]);
  });
});

// ─── GX-07: createResult — arrays are frozen ─────────────────────────────────

describe('GX-07 createResult arrays frozen', () => {
  const r = createResult('SUCCESS', { messages: ['a'], errors: ['b'], warnings: ['c'] });

  it('messages is frozen', () => {
    expect(Object.isFrozen(r.messages)).toBe(true);
  });
  it('errors is frozen', () => {
    expect(Object.isFrozen(r.errors)).toBe(true);
  });
  it('metadata is frozen', () => {
    expect(Object.isFrozen(r.metadata)).toBe(true);
  });
});

// ─── GX-08: createResult — REQUIRES_REVIEW ───────────────────────────────────

describe('GX-08 createResult REQUIRES_REVIEW', () => {
  it('status is REQUIRES_REVIEW', () => {
    const r = createResult('REQUIRES_REVIEW');
    expect(r.status).toBe('REQUIRES_REVIEW');
  });
  it('warnings are preserved', () => {
    const r = createResult('REQUIRES_REVIEW', { warnings: ['check this'] });
    expect(r.warnings[0]).toBe('check this');
  });
  it('workflowState is preserved', () => {
    const r = createResult('REQUIRES_REVIEW', { workflowState: 'REVIEW' });
    expect(r.workflowState).toBe('REVIEW');
  });
});

// ─── GX-09: toRuleContext — field mapping ─────────────────────────────────────

describe('GX-09 toRuleContext field mapping', () => {
  it('asOfDate is currentDate when effectiveDate absent', () => {
    const ctx = makeCtx();
    expect(toRuleContext(ctx).asOfDate).toBe(DATE);
  });
  it('actorRole maps from actor.role', () => {
    const ctx = makeCtx();
    expect(toRuleContext(ctx).actorRole).toBe('UNIT_HEAD');
  });
  it('amount maps from packageValue', () => {
    const ctx = makeCtx({ packageValue: 5_000_000 });
    expect(toRuleContext(ctx).amount).toBe(5_000_000);
  });
});

// ─── GX-10: toRuleContext — effectiveDate override ───────────────────────────

describe('GX-10 toRuleContext effectiveDate override', () => {
  it('asOfDate uses effectiveDate when present', () => {
    const ctx = makeCtx({ effectiveDate: '2023-01-01' });
    expect(toRuleContext(ctx).asOfDate).toBe('2023-01-01');
  });
  it('fundingCode maps from fundingSource', () => {
    const ctx = makeCtx({ fundingSource: 'AUTONOMY' });
    expect(toRuleContext(ctx).fundingCode).toBe('AUTONOMY');
  });
  it('amount is undefined when packageValue absent', () => {
    const ctx = makeCtx();
    expect(toRuleContext(ctx).amount).toBeUndefined();
  });
});

// ─── GX-11: toWorkflowContext — produces string Record ───────────────────────

describe('GX-11 toWorkflowContext string Record', () => {
  it('asOfDate is always present', () => {
    const ctx = makeCtx();
    expect(toWorkflowContext(ctx)['asOfDate']).toBe(DATE);
  });
  it('actorRole is always present', () => {
    const ctx = makeCtx();
    expect(toWorkflowContext(ctx)['actorRole']).toBe('UNIT_HEAD');
  });
  it('amount is stringified from packageValue', () => {
    const ctx = makeCtx({ packageValue: 100_000_000 });
    expect(toWorkflowContext(ctx)['amount']).toBe('100000000');
  });
});

// ─── GX-12: toWorkflowContext — omits absent fields ──────────────────────────

describe('GX-12 toWorkflowContext omits absent fields', () => {
  it('amount absent when packageValue not set', () => {
    const ctx = makeCtx();
    expect(toWorkflowContext(ctx)['amount']).toBeUndefined();
  });
  it('fundingCode absent when fundingSource not set', () => {
    const ctx = makeCtx();
    expect(toWorkflowContext(ctx)['fundingCode']).toBeUndefined();
  });
  it('department present when set', () => {
    const ctx = makeCtx({ department: 'FINANCE' });
    expect(toWorkflowContext(ctx)['department']).toBe('FINANCE');
  });
});

// ─── GX-13: RESULT_STATUS_VALUES and createAuditEntry ────────────────────────

describe('GX-13 RESULT_STATUS_VALUES and createAuditEntry', () => {
  it('RESULT_STATUS_VALUES contains 4 statuses', () => {
    expect(RESULT_STATUS_VALUES).toHaveLength(4);
    expect(RESULT_STATUS_VALUES).toContain('SUCCESS');
    expect(RESULT_STATUS_VALUES).toContain('FAILED');
  });
  it('createAuditEntry has required fields', () => {
    const entry = createAuditEntry('test-action', ACTOR, 'detail text');
    expect(entry.action).toBe('test-action');
    expect(entry.actor).toBe('u-001');
    expect(entry.detail).toBe('detail text');
  });
  it('createAuditEntry timestamp is ISO-8601', () => {
    const entry = createAuditEntry('ping');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
