/**
 * Phase 11.6 — Governance Rule Engine tests
 *
 * Groups (13 × 3 = 39):
 *   RE-01  (3)  evaluateRule — APPROVED with explicit configType
 *   RE-02  (3)  evaluateRule — INSUFFICIENT_DATA cases
 *   RE-03  (3)  evaluateThreshold — amount within limit
 *   RE-04  (3)  evaluateThreshold — amount exceeds limit (REQUIRES_REVIEW)
 *   RE-05  (3)  evaluateThreshold — no applicable config
 *   RE-06  (3)  evaluateAuthority — actor within limit
 *   RE-07  (3)  evaluateAuthority — actor exceeds limit (REJECTED)
 *   RE-08  (3)  evaluateWorkflow — workflow found
 *   RE-09  (3)  evaluateWorkflow — workflow not found
 *   RE-10  (3)  evaluateFunding — funding source active and within budget
 *   RE-11  (3)  evaluateFunding — budget exceeded or source missing
 *   RE-12  (3)  evaluateCompliance — audit + risk rule outcomes
 *   RE-13  (3)  factory + priority ordering
 */

import { describe, it, expect } from 'vitest';
import { createConfig } from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver } from '../legal/configResolver';
import { buildGovernanceRuleEngine, GovernanceRuleEngine } from '../legal/governanceRuleEngine';
import type { GovernanceConfig } from '../legal/governanceConfig';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE = '2024-06-01';

// ─── Config fixtures ──────────────────────────────────────────────────────────

const THRESH_100M = createConfig({
  id: 'thresh-100m', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '100000000' },
});
const THRESH_DRAFT = createConfig({
  id: 'thresh-draft', type: 'PROCUREMENT_THRESHOLD', version: '0.1.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'DRAFT', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '500000000' },
});
const THRESH_FUTURE = createConfig({
  id: 'thresh-future', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2025-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '999000000' },
});
const AUTH_UNIT = createConfig({
  id: 'auth-unit', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { role: 'UNIT_HEAD', maxAmount: '50000000' },
});
const AUTH_DIR = createConfig({
  id: 'auth-dir', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 2, confidence: 1.0, tags: ['auth'],
  metadata: { role: 'DIRECTOR', maxAmount: '500000000' },
});
const WF_PROC = createConfig({
  id: 'wf-proc', type: 'WORKFLOW_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['workflow'],
  metadata: { workflowId: 'procurement-review' },
});
const WF_ASSET = createConfig({
  id: 'wf-asset', type: 'WORKFLOW_DEFINITION', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-001',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['workflow'],
  metadata: { workflowId: 'asset-disposal' },
});
const FUND_AUTONOMY = createConfig({
  id: 'fund-auto', type: 'FUNDING_SOURCE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'tt-79-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['funding'],
  metadata: { code: 'AUTONOMY_FUND', maxBudget: '1000000000' },
});
const AUDIT_MONTHLY = createConfig({
  id: 'audit-monthly', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['audit'],
});
const RISK_SAFE = createConfig({
  id: 'risk-safe', type: 'RISK_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-risk',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['risk'],
});
const RISK_REVIEW = createConfig({
  id: 'risk-review', type: 'RISK_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-risk',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['risk'],
  metadata: { requiresReview: 'true' },
});
const APPROVAL_LOW = createConfig({
  id: 'approval-low', type: 'APPROVAL_POLICY', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-approval',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['approval'],
});
const APPROVAL_HIGH = createConfig({
  id: 'approval-high', type: 'APPROVAL_POLICY', version: '2.0.0',
  effectiveDate: '2024-01-01', source: 'qc-approval',
  status: 'ACTIVE', priority: 10, confidence: 1.0, tags: ['approval'],
});
const APPROVAL_REVIEW = createConfig({
  id: 'approval-review', type: 'APPROVAL_POLICY', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-approval',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['approval'],
  metadata: { requiresReview: 'true' },
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeEngine(...configs: GovernanceConfig[]): GovernanceRuleEngine {
  const repo = createInMemoryRepository(configs);
  return buildGovernanceRuleEngine(buildConfigResolver(repo));
}

// ── RE-01 evaluateRule APPROVED ───────────────────────────────────────────────

describe('RE-01 evaluateRule APPROVED', () => {
  it('RE-01-01 evaluateRule with an active APPROVAL_POLICY → APPROVED', () => {
    const engine = makeEngine(APPROVAL_LOW);
    expect(engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' }).verdict).toBe('APPROVED');
  });

  it('RE-01-02 appliedConfig matches the highest-priority config', () => {
    const engine = makeEngine(APPROVAL_LOW);
    const result = engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' });
    expect(result.appliedConfig?.id).toBe('approval-low');
  });

  it('RE-01-03 config with requiresReview=true → REQUIRES_REVIEW', () => {
    const engine = makeEngine(APPROVAL_REVIEW);
    expect(engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' }).verdict).toBe('REQUIRES_REVIEW');
  });
});

// ── RE-02 evaluateRule INSUFFICIENT_DATA ──────────────────────────────────────

describe('RE-02 evaluateRule INSUFFICIENT_DATA', () => {
  it('RE-02-01 no matching config → INSUFFICIENT_DATA', () => {
    const engine = makeEngine();  // empty repo
    expect(engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-02-02 future-dated config excluded → INSUFFICIENT_DATA', () => {
    const future = createConfig({ ...APPROVAL_LOW, id: 'app-future', effectiveDate: '2025-01-01' });
    const engine = makeEngine(future);
    expect(engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-02-03 no configType in context → INSUFFICIENT_DATA', () => {
    const engine = makeEngine(APPROVAL_LOW);
    expect(engine.evaluateRule({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });
});

// ── RE-03 evaluateThreshold within limit ─────────────────────────────────────

describe('RE-03 evaluateThreshold within limit', () => {
  it('RE-03-01 amount below maxAmount → APPROVED', () => {
    const engine = makeEngine(THRESH_100M);
    expect(engine.evaluateThreshold({ asOfDate: DATE, amount: 50_000_000 }).verdict).toBe('APPROVED');
  });

  it('RE-03-02 amount exactly at maxAmount → APPROVED', () => {
    const engine = makeEngine(THRESH_100M);
    expect(engine.evaluateThreshold({ asOfDate: DATE, amount: 100_000_000 }).verdict).toBe('APPROVED');
  });

  it('RE-03-03 no amount specified → APPROVED (pass-through)', () => {
    const engine = makeEngine(THRESH_100M);
    expect(engine.evaluateThreshold({ asOfDate: DATE }).verdict).toBe('APPROVED');
  });
});

// ── RE-04 evaluateThreshold exceeds limit ─────────────────────────────────────

describe('RE-04 evaluateThreshold exceeds limit', () => {
  it('RE-04-01 amount above maxAmount → REQUIRES_REVIEW', () => {
    const engine = makeEngine(THRESH_100M);
    expect(engine.evaluateThreshold({ asOfDate: DATE, amount: 150_000_000 }).verdict).toBe('REQUIRES_REVIEW');
  });

  it('RE-04-02 verdict is REQUIRES_REVIEW, not REJECTED', () => {
    const engine  = makeEngine(THRESH_100M);
    const verdict = engine.evaluateThreshold({ asOfDate: DATE, amount: 999_000_000 }).verdict;
    expect(verdict).not.toBe('REJECTED');
    expect(verdict).toBe('REQUIRES_REVIEW');
  });

  it('RE-04-03 appliedConfig is returned even when threshold is exceeded', () => {
    const engine = makeEngine(THRESH_100M);
    const result = engine.evaluateThreshold({ asOfDate: DATE, amount: 200_000_000 });
    expect(result.appliedConfig?.id).toBe('thresh-100m');
  });
});

// ── RE-05 evaluateThreshold no config ────────────────────────────────────────

describe('RE-05 evaluateThreshold no config', () => {
  it('RE-05-01 empty repo → INSUFFICIENT_DATA', () => {
    expect(makeEngine().evaluateThreshold({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-05-02 future-dated threshold → INSUFFICIENT_DATA', () => {
    expect(makeEngine(THRESH_FUTURE).evaluateThreshold({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-05-03 DRAFT threshold excluded → INSUFFICIENT_DATA', () => {
    expect(makeEngine(THRESH_DRAFT).evaluateThreshold({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });
});

// ── RE-06 evaluateAuthority within limit ──────────────────────────────────────

describe('RE-06 evaluateAuthority within limit', () => {
  it('RE-06-01 UNIT_HEAD with 30M (within 50M limit) → APPROVED', () => {
    const engine = makeEngine(AUTH_UNIT);
    expect(engine.evaluateAuthority({ asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: 30_000_000 }).verdict).toBe('APPROVED');
  });

  it('RE-06-02 DIRECTOR with 300M (within 500M limit) → APPROVED', () => {
    const engine = makeEngine(AUTH_DIR);
    expect(engine.evaluateAuthority({ asOfDate: DATE, actorRole: 'DIRECTOR', amount: 300_000_000 }).verdict).toBe('APPROVED');
  });

  it('RE-06-03 no actorRole uses all authority configs → APPROVED', () => {
    const engine = makeEngine(AUTH_UNIT, AUTH_DIR);
    expect(engine.evaluateAuthority({ asOfDate: DATE }).verdict).toBe('APPROVED');
  });
});

// ── RE-07 evaluateAuthority exceeds limit ─────────────────────────────────────

describe('RE-07 evaluateAuthority exceeds limit', () => {
  it('RE-07-01 UNIT_HEAD with 100M (> 50M limit) → REJECTED', () => {
    const engine = makeEngine(AUTH_UNIT);
    expect(engine.evaluateAuthority({ asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: 100_000_000 }).verdict).toBe('REJECTED');
  });

  it('RE-07-02 verdict is specifically REJECTED, not REQUIRES_REVIEW', () => {
    const engine  = makeEngine(AUTH_UNIT);
    const verdict = engine.evaluateAuthority({ asOfDate: DATE, actorRole: 'UNIT_HEAD', amount: 999_999_999 }).verdict;
    expect(verdict).not.toBe('REQUIRES_REVIEW');
    expect(verdict).toBe('REJECTED');
  });

  it('RE-07-03 actorRole with no matching config → REJECTED', () => {
    const engine = makeEngine(AUTH_DIR);  // only DIRECTOR config
    expect(engine.evaluateAuthority({ asOfDate: DATE, actorRole: 'MINISTER', amount: 10_000 }).verdict).toBe('REJECTED');
  });
});

// ── RE-08 evaluateWorkflow found ──────────────────────────────────────────────

describe('RE-08 evaluateWorkflow found', () => {
  it('RE-08-01 workflowId matches a config → APPROVED', () => {
    const engine = makeEngine(WF_PROC);
    expect(engine.evaluateWorkflow({ asOfDate: DATE, workflowId: 'procurement-review' }).verdict).toBe('APPROVED');
  });

  it('RE-08-02 no workflowId → returns first active workflow config', () => {
    const engine = makeEngine(WF_PROC);
    const result = engine.evaluateWorkflow({ asOfDate: DATE });
    expect(result.verdict).toBe('APPROVED');
    expect(result.appliedConfig?.id).toBe('wf-proc');
  });

  it('RE-08-03 appliedConfig matches the workflow config', () => {
    const engine = makeEngine(WF_PROC, WF_ASSET);
    const result = engine.evaluateWorkflow({ asOfDate: DATE, workflowId: 'asset-disposal' });
    expect(result.appliedConfig?.id).toBe('wf-asset');
  });
});

// ── RE-09 evaluateWorkflow not found ─────────────────────────────────────────

describe('RE-09 evaluateWorkflow not found', () => {
  it('RE-09-01 unknown workflowId → INSUFFICIENT_DATA', () => {
    const engine = makeEngine(WF_PROC);
    expect(engine.evaluateWorkflow({ asOfDate: DATE, workflowId: 'ghost-workflow' }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-09-02 empty repo → INSUFFICIENT_DATA', () => {
    expect(makeEngine().evaluateWorkflow({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-09-03 future-dated workflow excluded → INSUFFICIENT_DATA', () => {
    const future = createConfig({ ...WF_PROC, id: 'wf-future', effectiveDate: '2025-01-01' });
    expect(makeEngine(future).evaluateWorkflow({ asOfDate: DATE, workflowId: 'procurement-review' }).verdict).toBe('INSUFFICIENT_DATA');
  });
});

// ── RE-10 evaluateFunding approved ────────────────────────────────────────────

describe('RE-10 evaluateFunding approved', () => {
  it('RE-10-01 fundingCode matches and amount within budget → APPROVED', () => {
    const engine = makeEngine(FUND_AUTONOMY);
    expect(engine.evaluateFunding({ asOfDate: DATE, fundingCode: 'AUTONOMY_FUND', amount: 500_000_000 }).verdict).toBe('APPROVED');
  });

  it('RE-10-02 no fundingCode → returns first active funding config', () => {
    const engine = makeEngine(FUND_AUTONOMY);
    expect(engine.evaluateFunding({ asOfDate: DATE }).verdict).toBe('APPROVED');
  });

  it('RE-10-03 no amount specified → APPROVED (pass-through)', () => {
    const engine = makeEngine(FUND_AUTONOMY);
    expect(engine.evaluateFunding({ asOfDate: DATE, fundingCode: 'AUTONOMY_FUND' }).verdict).toBe('APPROVED');
  });
});

// ── RE-11 evaluateFunding problems ────────────────────────────────────────────

describe('RE-11 evaluateFunding problems', () => {
  it('RE-11-01 amount exceeds maxBudget → REQUIRES_REVIEW', () => {
    const engine = makeEngine(FUND_AUTONOMY);
    expect(engine.evaluateFunding({ asOfDate: DATE, fundingCode: 'AUTONOMY_FUND', amount: 2_000_000_000 }).verdict).toBe('REQUIRES_REVIEW');
  });

  it('RE-11-02 unknown fundingCode → INSUFFICIENT_DATA', () => {
    const engine = makeEngine(FUND_AUTONOMY);
    expect(engine.evaluateFunding({ asOfDate: DATE, fundingCode: 'STATE_BUDGET' }).verdict).toBe('INSUFFICIENT_DATA');
  });

  it('RE-11-03 empty repo → INSUFFICIENT_DATA', () => {
    expect(makeEngine().evaluateFunding({ asOfDate: DATE, fundingCode: 'AUTONOMY_FUND' }).verdict).toBe('INSUFFICIENT_DATA');
  });
});

// ── RE-12 evaluateCompliance ──────────────────────────────────────────────────

describe('RE-12 evaluateCompliance', () => {
  it('RE-12-01 audit rule only, no risk triggers → APPROVED', () => {
    const engine = makeEngine(AUDIT_MONTHLY, RISK_SAFE);
    expect(engine.evaluateCompliance({ asOfDate: DATE }).verdict).toBe('APPROVED');
  });

  it('RE-12-02 risk rule with requiresReview=true → REQUIRES_REVIEW', () => {
    const engine = makeEngine(AUDIT_MONTHLY, RISK_REVIEW);
    expect(engine.evaluateCompliance({ asOfDate: DATE }).verdict).toBe('REQUIRES_REVIEW');
  });

  it('RE-12-03 no compliance configs at all → INSUFFICIENT_DATA', () => {
    expect(makeEngine().evaluateCompliance({ asOfDate: DATE }).verdict).toBe('INSUFFICIENT_DATA');
  });
});

// ── RE-13 factory + priority ordering ─────────────────────────────────────────

describe('RE-13 factory and priority', () => {
  it('RE-13-01 buildGovernanceRuleEngine returns a GovernanceRuleEngine', () => {
    const engine = makeEngine(APPROVAL_LOW);
    expect(engine).toBeInstanceOf(GovernanceRuleEngine);
  });

  it('RE-13-02 higher priority config wins in evaluateRule', () => {
    const engine = makeEngine(APPROVAL_LOW, APPROVAL_HIGH);
    const result = engine.evaluateRule({ asOfDate: DATE, configType: 'APPROVAL_POLICY' });
    // APPROVAL_HIGH has priority=10, APPROVAL_LOW has priority=1
    expect(result.appliedConfig?.id).toBe('approval-high');
  });

  it('RE-13-03 evaluateAuthority uses priority ordering — DIRECTOR (prio=2) wins over UNIT_HEAD (prio=1)', () => {
    const engine = makeEngine(AUTH_UNIT, AUTH_DIR);
    // No actorRole filter — highest priority (DIRECTOR, prio=2) is used
    const result = engine.evaluateAuthority({ asOfDate: DATE, amount: 100_000_000 });
    // DIRECTOR limit is 500M, so 100M is APPROVED
    expect(result.verdict).toBe('APPROVED');
    expect(result.appliedConfig?.id).toBe('auth-dir');
  });
});
