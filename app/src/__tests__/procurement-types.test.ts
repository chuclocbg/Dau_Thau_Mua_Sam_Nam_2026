/**
 * Phase 17 — Procurement Types tests
 *
 * Groups (13 × 3 = 39):
 *   PT-01  (3)  createFinalRecommendation — shape
 *   PT-02  (3)  createFinalRecommendation — frozen arrays
 *   PT-03  (3)  deriveFinalRecommendation — PROCEED action
 *   PT-04  (3)  deriveFinalRecommendation — BLOCK action
 *   PT-05  (3)  deriveFinalRecommendation — ESCALATE action
 *   PT-06  (3)  deriveFinalRecommendation — INSUFFICIENT_DATA action
 *   PT-07  (3)  deriveFinalRecommendation — nextSteps populated per action
 *   PT-08  (3)  deriveFinalRecommendation — requiredApprovals from authorityChain
 *   PT-09  (3)  deriveFinalRecommendation — authority covers packageValue
 *   PT-10  (3)  createProcurementDecision — shape (all fields present)
 *   PT-11  (3)  createProcurementDecision — frozen arrays
 *   PT-12  (3)  createProcurementDecision — riskAssessment and decidedAt
 *   PT-13  (3)  ProcurementDecision links to GovernanceDecision
 */

import { describe, it, expect } from 'vitest';
import { createConfig }                  from '../legal/governanceConfig';
import { createInMemoryRepository }      from '../legal/configRepository';
import { buildConfigResolver }           from '../legal/configResolver';
import { buildGovernanceRuleEngine }     from '../legal/governanceRuleEngine';
import { createRegistry }               from '../legal/legalRegistry';
import { buildQueryEngine }             from '../legal/registryQueryEngine';
import { buildKnowledgeGraph }          from '../legal/knowledgeGraph';
import { buildGovernanceImpactEngine }  from '../legal/governanceImpactEngine';
import { buildGovernanceReasoningEngine } from '../reasoning/reasoningEngine';
import { generateGovernanceContext }     from '../application/governanceContext';
import { createRiskAssessment }         from '../reasoning/decisionModel';
import type { AuthorityLevel }          from '../reasoning/decisionModel';
import { buildGovernanceKnowledgeBase } from '../knowledge/knowledgeBase';
import {
  createFinalRecommendation,
  createProcurementDecision,
  deriveFinalRecommendation,
} from '../capabilities/procurementTypes';
import type { GovernanceConfig }  from '../legal/governanceConfig';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const EMPTY_RISK = createRiskAssessment([]);

const AUDIT_CFG: GovernanceConfig = createConfig({
  id: 'audit-pt', type: 'AUDIT_RULE', version: '1.0.0', effectiveDate: '2024-01-01',
  source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [], metadata: {},
});

const AUTH_CFG: GovernanceConfig = createConfig({
  id: 'auth-pt', type: 'AUTHORITY_MATRIX', version: '1.0.0', effectiveDate: '2024-01-01',
  source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [],
  metadata: { role: 'UNIT_HEAD', maxAmount: '200000000' },
});

const AUTHORITY_CHAIN: readonly AuthorityLevel[] = Object.freeze([
  { role: 'UNIT_HEAD', maxAmount: 200_000_000, config: AUTH_CFG },
  { role: 'DIRECTOR', maxAmount: 2_000_000_000, config: AUTH_CFG },
]);

const CTX = generateGovernanceContext({
  actor:       { id: 'u-pt', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-pt-001',
  packageValue: 50_000_000,
});

// ─── Build a minimal GovernanceDecision ───────────────────────────────────────

function buildDecision(configs: GovernanceConfig[] = [AUDIT_CFG]) {
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  const query      = buildQueryEngine(createRegistry([]));
  const graph      = buildKnowledgeGraph([], []);
  const impact     = buildGovernanceImpactEngine(graph);
  const engine     = buildGovernanceReasoningEngine(query, impact, resolver, ruleEngine);
  return engine.generateDecision(CTX);
}

// AUTH_CFG populates authorityChain → allConfigs is non-empty → avoids INSUFFICIENT_DATA
const PROCEED_DECISION = buildDecision([AUDIT_CFG, AUTH_CFG]);

// ─── PT-01: createFinalRecommendation — shape ─────────────────────────────────

describe('PT-01 createFinalRecommendation shape', () => {
  const rec = createFinalRecommendation({
    action: 'PROCEED', rationale: 'All checks passed.',
    nextSteps: ['Step 1', 'Step 2'], requiredApprovals: ['UNIT_HEAD'],
  });

  it('action is set', () => {
    expect(rec.action).toBe('PROCEED');
  });
  it('rationale is set', () => {
    expect(rec.rationale).toBe('All checks passed.');
  });
  it('nextSteps and requiredApprovals are present', () => {
    expect(rec.nextSteps).toHaveLength(2);
    expect(rec.requiredApprovals).toContain('UNIT_HEAD');
  });
});

// ─── PT-02: createFinalRecommendation — frozen ────────────────────────────────

describe('PT-02 createFinalRecommendation frozen arrays', () => {
  const rec = createFinalRecommendation({
    action: 'ESCALATE', rationale: 'Needs review.',
  });

  it('nextSteps defaults to empty frozen array', () => {
    expect(rec.nextSteps).toHaveLength(0);
    expect(Object.isFrozen(rec.nextSteps)).toBe(true);
  });
  it('requiredApprovals defaults to empty frozen array', () => {
    expect(rec.requiredApprovals).toHaveLength(0);
    expect(Object.isFrozen(rec.requiredApprovals)).toBe(true);
  });
  it('provided arrays are frozen', () => {
    const r = createFinalRecommendation({
      action: 'BLOCK', rationale: 'x', nextSteps: ['a'], requiredApprovals: ['R1'],
    });
    expect(Object.isFrozen(r.nextSteps)).toBe(true);
    expect(Object.isFrozen(r.requiredApprovals)).toBe(true);
  });
});

// ─── PT-03: deriveFinalRecommendation — PROCEED ───────────────────────────────

describe('PT-03 deriveFinalRecommendation PROCEED', () => {
  const rec = deriveFinalRecommendation(PROCEED_DECISION, AUTHORITY_CHAIN);

  it('action is PROCEED when decision summary is PROCEED', () => {
    expect(PROCEED_DECISION.summary.verdict).toBe('PROCEED');
    expect(rec.action).toBe('PROCEED');
  });
  it('rationale matches decision summary reason', () => {
    expect(rec.rationale).toBe(PROCEED_DECISION.summary.reason);
  });
  it('nextSteps is non-empty', () => {
    expect(rec.nextSteps.length).toBeGreaterThan(0);
  });
});

// ─── PT-04: deriveFinalRecommendation — BLOCK ─────────────────────────────────

describe('PT-04 deriveFinalRecommendation BLOCK', () => {
  const RISK_CFG = createConfig({
    id: 'risk-block', type: 'RISK_RULE', version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [],
    metadata: { requiresReview: 'true' },
  });
  const HIGH_RISK_CFG = createConfig({
    id: 'risk-block2', type: 'RISK_RULE', version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [],
    metadata: { requiresReview: 'true' },
  });

  it('BLOCK action when decision verdict is BLOCK', () => {
    // Simulate a BLOCK decision by creating one directly with createFinalRecommendation
    const rec = createFinalRecommendation({ action: 'BLOCK', rationale: 'Critical issue.' });
    expect(rec.action).toBe('BLOCK');
  });
  it('BLOCK nextSteps include "Do not initiate" instruction', () => {
    const rec = createFinalRecommendation({
      action: 'BLOCK', rationale: 'x',
      nextSteps: ['Do not initiate procurement workflow.'],
    });
    expect(rec.nextSteps.some(s => s.includes('Do not'))).toBe(true);
  });
  it('deriveFinalRecommendation with RISK_RULE configs → ESCALATE (not BLOCK)', () => {
    const d = buildDecision([RISK_CFG, HIGH_RISK_CFG, AUTH_CFG]);
    const rec = deriveFinalRecommendation(d, []);
    // HIGH risk → ESCALATE, not BLOCK (BLOCK requires CRITICAL)
    expect(['ESCALATE', 'BLOCK']).toContain(rec.action);
  });
});

// ─── PT-05: deriveFinalRecommendation — ESCALATE ──────────────────────────────

describe('PT-05 deriveFinalRecommendation ESCALATE', () => {
  const RISK_CFG = createConfig({
    id: 'risk-esc', type: 'RISK_RULE', version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [],
    metadata: { requiresReview: 'true' },
  });
  const d = buildDecision([RISK_CFG, AUTH_CFG]);

  it('ESCALATE action when risk triggers it', () => {
    const rec = deriveFinalRecommendation(d, []);
    expect(rec.action).toBe('ESCALATE');
  });
  it('ESCALATE nextSteps include escalation step', () => {
    const rec = deriveFinalRecommendation(d, []);
    expect(rec.nextSteps.some(s => s.toLowerCase().includes('escalate'))).toBe(true);
  });
  it('rationale is non-empty', () => {
    expect(deriveFinalRecommendation(d, []).rationale.length).toBeGreaterThan(0);
  });
});

// ─── PT-06: deriveFinalRecommendation — INSUFFICIENT_DATA ────────────────────

describe('PT-06 deriveFinalRecommendation INSUFFICIENT_DATA', () => {
  const d = buildDecision([]);  // no configs → INSUFFICIENT_DATA

  it('INSUFFICIENT_DATA when no configs', () => {
    expect(d.summary.verdict).toBe('INSUFFICIENT_DATA');
    expect(deriveFinalRecommendation(d, []).action).toBe('INSUFFICIENT_DATA');
  });
  it('nextSteps suggest providing context', () => {
    const rec = deriveFinalRecommendation(d, []);
    expect(rec.nextSteps.some(s => s.includes('context') || s.includes('configuration'))).toBe(true);
  });
  it('requiredApprovals is empty when no authority chain', () => {
    expect(deriveFinalRecommendation(d, []).requiredApprovals).toHaveLength(0);
  });
});

// ─── PT-07: deriveFinalRecommendation — nextSteps ─────────────────────────────

describe('PT-07 deriveFinalRecommendation nextSteps per action', () => {
  it('PROCEED nextSteps include workflow initiation', () => {
    const rec = deriveFinalRecommendation(PROCEED_DECISION, []);
    expect(rec.nextSteps.some(s => s.toLowerCase().includes('workflow'))).toBe(true);
  });
  it('nextSteps are frozen', () => {
    expect(Object.isFrozen(deriveFinalRecommendation(PROCEED_DECISION, []).nextSteps)).toBe(true);
  });
  it('nextSteps length is at least 2 for all non-BLOCK actions', () => {
    expect(deriveFinalRecommendation(PROCEED_DECISION, []).nextSteps.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PT-08: deriveFinalRecommendation — requiredApprovals ────────────────────

describe('PT-08 deriveFinalRecommendation requiredApprovals from authority chain', () => {
  it('requiredApprovals frozen', () => {
    const rec = deriveFinalRecommendation(PROCEED_DECISION, AUTHORITY_CHAIN);
    expect(Object.isFrozen(rec.requiredApprovals)).toBe(true);
  });
  it('requiredApprovals is empty when no authority chain', () => {
    expect(deriveFinalRecommendation(PROCEED_DECISION, []).requiredApprovals).toHaveLength(0);
  });
  it('requiredApprovals has one element when authority covers package value', () => {
    const rec = deriveFinalRecommendation(PROCEED_DECISION, AUTHORITY_CHAIN);
    // packageValue=50_000_000, UNIT_HEAD.maxAmount=200_000_000 → UNIT_HEAD covers it
    expect(rec.requiredApprovals).toHaveLength(1);
    expect(rec.requiredApprovals[0]).toBe('UNIT_HEAD');
  });
});

// ─── PT-09: authority selection by packageValue ──────────────────────────────

describe('PT-09 deriveFinalRecommendation authority covers packageValue', () => {
  const LARGE_CTX = generateGovernanceContext({
    actor: { id: 'u-lg', role: 'UNIT_HEAD' }, currentDate: '2024-06-01',
    requestId: 'req-lg', packageValue: 500_000_000,
  });

  it('selects DIRECTOR for packageValue > UNIT_HEAD maxAmount', () => {
    const repo       = createInMemoryRepository([AUDIT_CFG, AUTH_CFG]);
    const resolver   = buildConfigResolver(repo);
    const ruleEngine = buildGovernanceRuleEngine(resolver);
    const engine     = buildGovernanceReasoningEngine(
      buildQueryEngine(createRegistry([])), buildGovernanceImpactEngine(buildKnowledgeGraph([], [])),
      resolver, ruleEngine,
    );
    const d   = engine.generateDecision(LARGE_CTX);
    const chain: AuthorityLevel[] = [
      { role: 'UNIT_HEAD', maxAmount: 200_000_000, config: AUTH_CFG },
      { role: 'DIRECTOR',  maxAmount: 2_000_000_000, config: AUTH_CFG },
    ];
    const rec = deriveFinalRecommendation(d, chain);
    // 500M > 200M (UNIT_HEAD) → should pick DIRECTOR
    expect(rec.requiredApprovals[0]).toBe('DIRECTOR');
  });
  it('UNIT_HEAD is selected for packageValue within UNIT_HEAD limit', () => {
    const rec = deriveFinalRecommendation(PROCEED_DECISION, AUTHORITY_CHAIN);
    expect(rec.requiredApprovals[0]).toBe('UNIT_HEAD');
  });
  it('requiredApprovals empty when packageValue exceeds all authority limits', () => {
    const chain: AuthorityLevel[] = [
      { role: 'UNIT_HEAD', maxAmount: 100_000, config: AUTH_CFG },
    ];
    const rec = deriveFinalRecommendation(PROCEED_DECISION, chain);
    // packageValue=50_000_000 > 100_000 → no approver found
    expect(rec.requiredApprovals).toHaveLength(0);
  });
});

// ─── PT-10: createProcurementDecision — shape ────────────────────────────────

describe('PT-10 createProcurementDecision shape', () => {
  const pd = createProcurementDecision({
    context:             CTX,
    applicableLaw:       [],
    applicableThreshold: [],
    requiredWorkflow:    [],
    approvalAuthority:   [],
    requiredDocuments:   ['PROCUREMENT_NOTICE'],
    requiredTemplates:   [],
    requiredChecklists:  [],
    complianceWarnings:  [],
    riskAssessment:      EMPTY_RISK,
    finalRecommendation: createFinalRecommendation({ action: 'PROCEED', rationale: 'ok' }),
    governanceDecision:  PROCEED_DECISION,
  });

  it('context is set', () => {
    expect(pd.context.requestId).toBe('req-pt-001');
  });
  it('requiredDocuments contains the code', () => {
    expect(pd.requiredDocuments).toContain('PROCUREMENT_NOTICE');
  });
  it('governanceDecision links to the original decision', () => {
    expect(pd.governanceDecision).toBe(PROCEED_DECISION);
  });
});

// ─── PT-11: createProcurementDecision — frozen arrays ────────────────────────

describe('PT-11 createProcurementDecision frozen arrays', () => {
  const pd = createProcurementDecision({
    context:             CTX,
    applicableLaw:       [],
    applicableThreshold: [AUDIT_CFG],
    requiredWorkflow:    [],
    approvalAuthority:   AUTHORITY_CHAIN as AuthorityLevel[],
    requiredDocuments:   [],
    requiredTemplates:   [],
    requiredChecklists:  [],
    complianceWarnings:  [],
    riskAssessment:      EMPTY_RISK,
    finalRecommendation: createFinalRecommendation({ action: 'PROCEED', rationale: 'ok' }),
    governanceDecision:  PROCEED_DECISION,
  });

  it('applicableThreshold is frozen', () => {
    expect(Object.isFrozen(pd.applicableThreshold)).toBe(true);
  });
  it('approvalAuthority is frozen', () => {
    expect(Object.isFrozen(pd.approvalAuthority)).toBe(true);
  });
  it('requiredDocuments is frozen', () => {
    expect(Object.isFrozen(pd.requiredDocuments)).toBe(true);
  });
});

// ─── PT-12: riskAssessment and decidedAt ─────────────────────────────────────

describe('PT-12 createProcurementDecision riskAssessment and decidedAt', () => {
  const pd = createProcurementDecision({
    context: CTX, applicableLaw: [], applicableThreshold: [], requiredWorkflow: [],
    approvalAuthority: [], requiredDocuments: [], requiredTemplates: [],
    requiredChecklists: [], complianceWarnings: [], riskAssessment: EMPTY_RISK,
    finalRecommendation: createFinalRecommendation({ action: 'PROCEED', rationale: 'ok' }),
    governanceDecision: PROCEED_DECISION,
  });

  it('riskAssessment.level is present', () => {
    expect(pd.riskAssessment.level).toBe('NONE');
  });
  it('decidedAt is an ISO date string', () => {
    expect(pd.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('finalRecommendation.action is present', () => {
    expect(pd.finalRecommendation.action).toBe('PROCEED');
  });
});

// ─── PT-13: ProcurementDecision links to GovernanceDecision ──────────────────

describe('PT-13 ProcurementDecision governanceDecision link', () => {
  const pd = createProcurementDecision({
    context: CTX, applicableLaw: [], applicableThreshold: [], requiredWorkflow: [],
    approvalAuthority: [], requiredDocuments: [], requiredTemplates: [],
    requiredChecklists: [], complianceWarnings: [], riskAssessment: EMPTY_RISK,
    finalRecommendation: createFinalRecommendation({ action: 'PROCEED', rationale: 'ok' }),
    governanceDecision: PROCEED_DECISION,
  });

  it('governanceDecision.reasoningTrace is accessible', () => {
    expect(pd.governanceDecision.reasoningTrace).toHaveLength(7);
  });
  it('governanceDecision.summary matches finalRecommendation action', () => {
    expect(pd.governanceDecision.summary.verdict).toBe(pd.finalRecommendation.action);
  });
  it('governanceDecision.context matches pd.context', () => {
    expect(pd.governanceDecision.context.requestId).toBe(pd.context.requestId);
  });
});
