/**
 * Phase 15 — Decision Model tests
 *
 * Groups (13 × 3 = 39):
 *   DM-01  (3)  createComplianceWarning — factory output
 *   DM-02  (3)  createRiskAssessment — empty factors
 *   DM-03  (3)  createRiskAssessment — non-empty factors (HIGH level)
 *   DM-04  (3)  DECISION_VERDICTS constant
 *   DM-05  (3)  computeConfidence — empty inputs
 *   DM-06  (3)  computeConfidence — mixed laws and configs
 *   DM-07  (3)  deriveVerdict — PROCEED when no issues
 *   DM-08  (3)  deriveVerdict — BLOCK on CRITICAL warning
 *   DM-09  (3)  deriveVerdict — BLOCK on CRITICAL risk level
 *   DM-10  (3)  deriveVerdict — ESCALATE on HIGH warning
 *   DM-11  (3)  deriveVerdict — ESCALATE on ruleVerdict REQUIRES_REVIEW
 *   DM-12  (3)  deriveVerdict — INSUFFICIENT_DATA when no laws and no configs
 *   DM-13  (3)  createDecision — full factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }          from '../legal/governanceConfig';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  DECISION_VERDICTS,
  createComplianceWarning,
  createRiskAssessment,
  computeConfidence,
  deriveVerdict,
  createDecision,
  type RiskFactor,
  type ComplianceWarning,
} from '../reasoning/decisionModel';
import type { LegalDocument } from '../legal/legalRegistry';
import type { GovernanceConfig } from '../legal/governanceConfig';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeConfig(id: string, confidence = 1.0): GovernanceConfig {
  return createConfig({
    id, type: 'AUDIT_RULE', version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence, tags: [], metadata: {},
  });
}

const DOC_A: LegalDocument = {
  id: 'doc-dm-1', symbol: '01/2024', title: 'Luật test', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2024-01-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 10, tags: [], summary: '', confidence: 0.9,
};

const EMPTY_RISK = createRiskAssessment([]);

const ctx = generateGovernanceContext({
  actor:       { id: 'u-1', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-dm-001',
});

// ─── DM-01: createComplianceWarning ──────────────────────────────────────────

describe('DM-01 createComplianceWarning factory', () => {
  it('code and message are set', () => {
    const w = createComplianceWarning('CODE_A', 'Something triggered.', 'HIGH');
    expect(w.code).toBe('CODE_A');
    expect(w.message).toBe('Something triggered.');
  });
  it('severity is set correctly', () => {
    const w = createComplianceWarning('CODE_B', 'msg', 'CRITICAL');
    expect(w.severity).toBe('CRITICAL');
  });
  it('sourceConfig is optional and can be undefined', () => {
    const w = createComplianceWarning('CODE_C', 'msg', 'LOW');
    expect(w.sourceConfig).toBeUndefined();
  });
});

// ─── DM-02: createRiskAssessment — empty ────────────────────────────────────

describe('DM-02 createRiskAssessment empty factors', () => {
  it('level is NONE for empty factors', () => {
    expect(createRiskAssessment([]).level).toBe('NONE');
  });
  it('score is 0 for empty factors', () => {
    expect(createRiskAssessment([]).score).toBe(0);
  });
  it('factors array is empty and frozen', () => {
    const r = createRiskAssessment([]);
    expect(r.factors).toHaveLength(0);
    expect(Object.isFrozen(r.factors)).toBe(true);
  });
});

// ─── DM-03: createRiskAssessment — non-empty ────────────────────────────────

describe('DM-03 createRiskAssessment non-empty HIGH level', () => {
  const factors: RiskFactor[] = [
    { code: 'R1', reason: 'Risk one',   weight: 0.7 },
    { code: 'R2', reason: 'Risk two',   weight: 0.7 },
  ];
  const risk = createRiskAssessment(factors);

  it('level is HIGH for average weight 0.7', () => {
    expect(risk.level).toBe('HIGH');
  });
  it('score equals average of weights', () => {
    expect(risk.score).toBeCloseTo(0.7);
  });
  it('factors are frozen and contain input', () => {
    expect(risk.factors).toHaveLength(2);
    expect(Object.isFrozen(risk.factors)).toBe(true);
  });
});

// ─── DM-04: DECISION_VERDICTS ────────────────────────────────────────────────

describe('DM-04 DECISION_VERDICTS constant', () => {
  it('has exactly 4 values', () => {
    expect(DECISION_VERDICTS).toHaveLength(4);
  });
  it('contains all four verdict strings', () => {
    expect(DECISION_VERDICTS).toContain('PROCEED');
    expect(DECISION_VERDICTS).toContain('ESCALATE');
    expect(DECISION_VERDICTS).toContain('BLOCK');
    expect(DECISION_VERDICTS).toContain('INSUFFICIENT_DATA');
  });
  it('is frozen', () => {
    expect(Object.isFrozen(DECISION_VERDICTS)).toBe(true);
  });
});

// ─── DM-05: computeConfidence — empty inputs ────────────────────────────────

describe('DM-05 computeConfidence empty inputs', () => {
  it('returns 1.0 for both empty arrays', () => {
    expect(computeConfidence([], [])).toBe(1.0);
  });
  it('returns 1.0 for empty laws with empty configs', () => {
    expect(computeConfidence([], [])).toBe(1.0);
  });
  it('returns number type', () => {
    expect(typeof computeConfidence([], [])).toBe('number');
  });
});

// ─── DM-06: computeConfidence — mixed inputs ────────────────────────────────

describe('DM-06 computeConfidence averages correctly', () => {
  it('returns law confidence when only laws present', () => {
    expect(computeConfidence([DOC_A], [])).toBeCloseTo(0.9);
  });
  it('returns config confidence when only configs present', () => {
    expect(computeConfidence([], [makeConfig('c1', 0.8)])).toBeCloseTo(0.8);
  });
  it('averages across laws and configs', () => {
    const result = computeConfidence([DOC_A], [makeConfig('c2', 0.7)]);
    expect(result).toBeCloseTo((0.9 + 0.7) / 2);
  });
});

// ─── DM-07: deriveVerdict — PROCEED ─────────────────────────────────────────

describe('DM-07 deriveVerdict PROCEED when no issues', () => {
  it('PROCEED with one law, no warnings, NONE risk', () => {
    expect(deriveVerdict([DOC_A], [], [], EMPTY_RISK)).toBe('PROCEED');
  });
  it('PROCEED with configs only, no warnings, NONE risk', () => {
    expect(deriveVerdict([], [makeConfig('c3')], [], EMPTY_RISK)).toBe('PROCEED');
  });
  it('PROCEED with ruleVerdict APPROVED', () => {
    expect(deriveVerdict([DOC_A], [], [], EMPTY_RISK, 'APPROVED')).toBe('PROCEED');
  });
});

// ─── DM-08: deriveVerdict — BLOCK on CRITICAL warning ───────────────────────

describe('DM-08 deriveVerdict BLOCK on CRITICAL warning', () => {
  const criticalWarning: ComplianceWarning = createComplianceWarning('C', 'msg', 'CRITICAL');

  it('BLOCK when CRITICAL warning present', () => {
    expect(deriveVerdict([DOC_A], [], [criticalWarning], EMPTY_RISK)).toBe('BLOCK');
  });
  it('BLOCK even when ruleVerdict is APPROVED', () => {
    expect(deriveVerdict([DOC_A], [], [criticalWarning], EMPTY_RISK, 'APPROVED')).toBe('BLOCK');
  });
  it('BLOCK takes priority over ESCALATE conditions', () => {
    const highWarning = createComplianceWarning('H', 'msg', 'HIGH');
    expect(deriveVerdict([DOC_A], [], [criticalWarning, highWarning], EMPTY_RISK)).toBe('BLOCK');
  });
});

// ─── DM-09: deriveVerdict — BLOCK on CRITICAL risk ───────────────────────────

describe('DM-09 deriveVerdict BLOCK on CRITICAL risk level', () => {
  const criticalRisk = createRiskAssessment([
    { code: 'R_CRIT', reason: 'Critical risk', weight: 0.9 },
    { code: 'R_CRIT2', reason: 'Also critical', weight: 0.9 },
  ]);

  it('BLOCK when risk level is CRITICAL', () => {
    expect(criticalRisk.level).toBe('CRITICAL');
    expect(deriveVerdict([DOC_A], [], [], criticalRisk)).toBe('BLOCK');
  });
  it('BLOCK when critical risk and no warnings', () => {
    expect(deriveVerdict([DOC_A], [], [], criticalRisk)).toBe('BLOCK');
  });
  it('BLOCK when critical risk overrides REQUIRES_REVIEW rule', () => {
    expect(deriveVerdict([DOC_A], [], [], criticalRisk, 'REQUIRES_REVIEW')).toBe('BLOCK');
  });
});

// ─── DM-10: deriveVerdict — ESCALATE on HIGH warning ────────────────────────

describe('DM-10 deriveVerdict ESCALATE on HIGH warning', () => {
  const highWarning: ComplianceWarning = createComplianceWarning('H', 'High risk.', 'HIGH');

  it('ESCALATE on HIGH warning, NONE risk', () => {
    expect(deriveVerdict([DOC_A], [], [highWarning], EMPTY_RISK)).toBe('ESCALATE');
  });
  it('ESCALATE on HIGH risk level, no warnings', () => {
    const highRisk = createRiskAssessment([{ code: 'R_HIGH', reason: 'High', weight: 0.7 }]);
    expect(deriveVerdict([DOC_A], [], [], highRisk)).toBe('ESCALATE');
  });
  it('ESCALATE from LOW+HIGH warning mix resolves to ESCALATE not BLOCK', () => {
    const lowWarning = createComplianceWarning('L', 'Low.', 'LOW');
    expect(deriveVerdict([DOC_A], [], [lowWarning, highWarning], EMPTY_RISK)).toBe('ESCALATE');
  });
});

// ─── DM-11: deriveVerdict — ESCALATE on ruleVerdict REQUIRES_REVIEW ─────────

describe('DM-11 deriveVerdict ESCALATE on ruleVerdict REQUIRES_REVIEW', () => {
  it('ESCALATE when ruleVerdict is REQUIRES_REVIEW', () => {
    expect(deriveVerdict([DOC_A], [], [], EMPTY_RISK, 'REQUIRES_REVIEW')).toBe('ESCALATE');
  });
  it('ESCALATE with no warnings but REQUIRES_REVIEW verdict', () => {
    expect(deriveVerdict([], [makeConfig('c4')], [], EMPTY_RISK, 'REQUIRES_REVIEW')).toBe('ESCALATE');
  });
  it('REJECTED ruleVerdict does not by itself cause BLOCK (warnings needed)', () => {
    // REJECTED rule verdict has no special mapping in deriveVerdict; PROCEED unless warnings/risk trigger it
    expect(deriveVerdict([DOC_A], [], [], EMPTY_RISK, 'REJECTED')).toBe('PROCEED');
  });
});

// ─── DM-12: deriveVerdict — INSUFFICIENT_DATA ───────────────────────────────

describe('DM-12 deriveVerdict INSUFFICIENT_DATA', () => {
  it('INSUFFICIENT_DATA when both laws and configs are empty', () => {
    expect(deriveVerdict([], [], [], EMPTY_RISK)).toBe('INSUFFICIENT_DATA');
  });
  it('not INSUFFICIENT_DATA when laws are present', () => {
    expect(deriveVerdict([DOC_A], [], [], EMPTY_RISK)).not.toBe('INSUFFICIENT_DATA');
  });
  it('not INSUFFICIENT_DATA when configs are present', () => {
    expect(deriveVerdict([], [makeConfig('c5')], [], EMPTY_RISK)).not.toBe('INSUFFICIENT_DATA');
  });
});

// ─── DM-13: createDecision ───────────────────────────────────────────────────

describe('DM-13 createDecision full factory', () => {
  const decision = createDecision({
    context:              ctx,
    applicableLaws:       [DOC_A],
    applicableThresholds: [makeConfig('thresh-dm')],
    applicableWorkflows:  [],
    authorityChain:       [],
    requiredDocuments:    ['PROCUREMENT_NOTICE'],
    complianceWarnings:   [],
    riskAssessment:       EMPTY_RISK,
    reasoningTrace:       [{ step: 1, operation: 'test', input: 'x', output: 'y' }],
  });

  it('summary.verdict is PROCEED when no issues', () => {
    expect(decision.summary.verdict).toBe('PROCEED');
  });
  it('applicableLaws is frozen and contains the doc', () => {
    expect(Object.isFrozen(decision.applicableLaws)).toBe(true);
    expect(decision.applicableLaws[0]?.id).toBe('doc-dm-1');
  });
  it('decidedAt is an ISO string and confidence is a number', () => {
    expect(decision.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof decision.confidence).toBe('number');
  });
});
