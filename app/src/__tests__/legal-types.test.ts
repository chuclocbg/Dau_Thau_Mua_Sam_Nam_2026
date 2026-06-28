/**
 * Phase 20 — Legal Advisory Capability: Types tests
 *
 * Groups (13 × 3 = 39):
 *   LT-01  (3)  createGovernanceExplanation — shape and generatedAt
 *   LT-02  (3)  createGovernanceExplanation — frozen arrays
 *   LT-03  (3)  createExplanationDecision   — verdict, summary, authority, basis
 *   LT-04  (3)  createExplanationEvidence   — type, reference, excerpt, weight
 *   LT-05  (3)  createExplanationRecommendation — action, rationale, urgency
 *   LT-06  (3)  ExplanationAction includes SEEK_ADVICE and INSUFFICIENT_DATA
 *   LT-07  (3)  deriveExplanationAction — PROCEED without warnings → PROCEED
 *   LT-08  (3)  deriveExplanationAction — PROCEED with warnings → SEEK_ADVICE
 *   LT-09  (3)  deriveExplanationAction — BLOCK → BLOCK; ESCALATE → ESCALATE
 *   LT-10  (3)  deriveExplanationUrgency — BLOCK → IMMEDIATE; INSUFFICIENT_DATA → LOW
 *   LT-11  (3)  buildNextActions — PROCEED contains 'workflow'
 *   LT-12  (3)  buildNextActions — SEEK_ADVICE contains compliance warning count
 *   LT-13  (3)  buildEvidence — evidence from laws, compliance warnings, risk factors
 */

import { describe, it, expect } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  createCase,
  createCaseMetadata,
  createCaseTimeline,
} from '../cases/caseModel';
import { createComplianceWarning, createRiskAssessment } from '../reasoning/decisionModel';
import {
  createExplanationDecision,
  createExplanationEvidence,
  createExplanationRecommendation,
  createGovernanceExplanation,
  deriveExplanationAction,
  deriveExplanationUrgency,
  buildNextActions,
  buildEvidence,
  type ExplanationAction,
} from '../capabilities/legalTypes';
import type { GovernanceDecision } from '../reasoning/decisionModel';
import type { GovernanceCase }     from '../cases/caseModel';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CTX = generateGovernanceContext({
  actor:       { id: 'u-lt', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-lt-001',
});

const CASE: GovernanceCase = createCase({
  id:       'case-lt-001',
  title:    'Legal Advisory Test',
  context:  CTX,
  metadata: createCaseMetadata({ domain: 'LEGAL', category: 'CONTRACT' }),
  timeline: createCaseTimeline({ createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-06-01T08:00:00Z' }),
});

const DECISION_STUB = createExplanationDecision({
  verdict:   'PROCEED',
  summary:   'All checks passed.',
  authority: 'UNIT_HEAD',
  basis:     '1 applicable law(s) identified.',
});

const REC_STUB = createExplanationRecommendation({
  action:    'PROCEED',
  rationale: 'All checks passed.',
  urgency:   'STANDARD',
});

/** Minimal fake GovernanceDecision for pure-function tests. */
function makeDecision(overrides: Partial<{
  verdict:          GovernanceDecision['summary']['verdict'];
  warnings:         GovernanceDecision['complianceWarnings'];
  laws:             GovernanceDecision['applicableLaws'];
  thresholds:       GovernanceDecision['applicableThresholds'];
  riskFactors:      Parameters<typeof createRiskAssessment>[0];
}>): GovernanceDecision {
  const warnings   = overrides.warnings   ?? [];
  const laws       = overrides.laws       ?? [];
  const thresholds = overrides.thresholds ?? [];
  const risk       = createRiskAssessment(overrides.riskFactors ?? []);
  const verdict    = overrides.verdict    ?? 'PROCEED';

  return {
    context:              CTX,
    summary:              {
      verdict,
      reason:                 verdict === 'PROCEED' ? 'All checks passed.' : verdict,
      applicableLawCount:     laws.length,
      complianceWarningCount: warnings.length,
      riskLevel:              risk.level,
      requiredActionCount:    warnings.filter(w => w.severity !== 'LOW').length,
    },
    applicableLaws:       Object.freeze([...laws]),
    applicableThresholds: Object.freeze([...thresholds]),
    applicableWorkflows:  Object.freeze([]),
    authorityChain:       Object.freeze([]),
    requiredDocuments:    Object.freeze([]),
    complianceWarnings:   Object.freeze([...warnings]),
    riskAssessment:       risk,
    confidence:           1.0,
    reasoningTrace:       Object.freeze([]),
    decidedAt:            '2024-06-01T08:00:00.000Z',
  } satisfies GovernanceDecision;
}

// Empty explanation fixture built via createGovernanceExplanation
const EMPTY_EXPLANATION = createGovernanceExplanation({
  governanceCase:     CASE,
  governanceDecision: makeDecision({}),
  decision:           DECISION_STUB,
  evidence:           [],
  legalCitations:     [],
  reasoningTrace:     [],
  confidence:         1.0,
  riskAssessment:     createRiskAssessment([]),
  recommendation:     REC_STUB,
  nextActions:        ['Proceed with governance workflow.'],
});

// ─── LT-01: createGovernanceExplanation — shape ──────────────────────────────

describe('LT-01 createGovernanceExplanation shape and generatedAt', () => {
  it('governanceCase is preserved', () => {
    expect(EMPTY_EXPLANATION.governanceCase.id).toBe('case-lt-001');
  });
  it('confidence is preserved', () => {
    expect(EMPTY_EXPLANATION.confidence).toBe(1.0);
  });
  it('generatedAt is an ISO string', () => {
    expect(EMPTY_EXPLANATION.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── LT-02: createGovernanceExplanation — frozen arrays ──────────────────────

describe('LT-02 createGovernanceExplanation frozen arrays', () => {
  it('evidence is frozen', () => {
    expect(Object.isFrozen(EMPTY_EXPLANATION.evidence)).toBe(true);
  });
  it('legalCitations is frozen', () => {
    expect(Object.isFrozen(EMPTY_EXPLANATION.legalCitations)).toBe(true);
  });
  it('nextActions is frozen', () => {
    expect(Object.isFrozen(EMPTY_EXPLANATION.nextActions)).toBe(true);
  });
});

// ─── LT-03: createExplanationDecision ────────────────────────────────────────

describe('LT-03 createExplanationDecision verdict, summary, authority, basis', () => {
  it('verdict is set', () => {
    expect(DECISION_STUB.verdict).toBe('PROCEED');
  });
  it('authority is set', () => {
    expect(DECISION_STUB.authority).toBe('UNIT_HEAD');
  });
  it('basis is set', () => {
    expect(DECISION_STUB.basis).toContain('applicable law');
  });
});

// ─── LT-04: createExplanationEvidence ────────────────────────────────────────

describe('LT-04 createExplanationEvidence type, reference, excerpt, weight', () => {
  const ev = createExplanationEvidence({
    type: 'LEGAL', reference: '22/2023/QH15', excerpt: 'Law on public procurement.', weight: 0.9,
  });
  it('type is LEGAL', () => {
    expect(ev.type).toBe('LEGAL');
  });
  it('reference is set', () => {
    expect(ev.reference).toBe('22/2023/QH15');
  });
  it('weight is 0.9', () => {
    expect(ev.weight).toBe(0.9);
  });
});

// ─── LT-05: createExplanationRecommendation ──────────────────────────────────

describe('LT-05 createExplanationRecommendation action, rationale, urgency', () => {
  it('action is set', () => {
    expect(REC_STUB.action).toBe('PROCEED');
  });
  it('urgency is STANDARD', () => {
    expect(REC_STUB.urgency).toBe('STANDARD');
  });
  it('rationale is set', () => {
    expect(REC_STUB.rationale).toBeDefined();
  });
});

// ─── LT-06: ExplanationAction includes SEEK_ADVICE ───────────────────────────

describe('LT-06 ExplanationAction includes SEEK_ADVICE and INSUFFICIENT_DATA', () => {
  const ALL_ACTIONS: ExplanationAction[] = [
    'PROCEED', 'ESCALATE', 'BLOCK', 'SEEK_ADVICE', 'INSUFFICIENT_DATA',
  ];
  it('SEEK_ADVICE is a valid ExplanationAction', () => {
    expect(ALL_ACTIONS).toContain('SEEK_ADVICE');
  });
  it('INSUFFICIENT_DATA is a valid ExplanationAction', () => {
    expect(ALL_ACTIONS).toContain('INSUFFICIENT_DATA');
  });
  it('5 distinct actions in total', () => {
    expect(new Set(ALL_ACTIONS).size).toBe(5);
  });
});

// ─── LT-07: deriveExplanationAction — PROCEED without warnings ───────────────

describe('LT-07 deriveExplanationAction PROCEED without warnings → PROCEED', () => {
  const d = makeDecision({ verdict: 'PROCEED', warnings: [] });
  it('returns PROCEED', () => {
    expect(deriveExplanationAction(d)).toBe('PROCEED');
  });
  it('returns ExplanationAction type', () => {
    const action = deriveExplanationAction(d);
    expect(typeof action).toBe('string');
  });
  it('INSUFFICIENT_DATA without warnings → INSUFFICIENT_DATA', () => {
    expect(deriveExplanationAction(makeDecision({ verdict: 'INSUFFICIENT_DATA' }))).toBe('INSUFFICIENT_DATA');
  });
});

// ─── LT-08: deriveExplanationAction — PROCEED with warnings → SEEK_ADVICE ────

describe('LT-08 deriveExplanationAction PROCEED with warnings → SEEK_ADVICE', () => {
  const warning = createComplianceWarning('COMP-001', 'Requires review.', 'HIGH');
  const d = makeDecision({ verdict: 'PROCEED', warnings: [warning] });
  it('returns SEEK_ADVICE', () => {
    expect(deriveExplanationAction(d)).toBe('SEEK_ADVICE');
  });
  it('ESCALATE is unaffected by warnings', () => {
    const esc = makeDecision({ verdict: 'ESCALATE', warnings: [warning] });
    expect(deriveExplanationAction(esc)).toBe('ESCALATE');
  });
  it('BLOCK is unaffected by warnings', () => {
    const blk = makeDecision({ verdict: 'BLOCK', warnings: [warning] });
    expect(deriveExplanationAction(blk)).toBe('BLOCK');
  });
});

// ─── LT-09: deriveExplanationAction — BLOCK and ESCALATE pass through ────────

describe('LT-09 deriveExplanationAction BLOCK → BLOCK; ESCALATE → ESCALATE', () => {
  it('BLOCK maps to BLOCK', () => {
    expect(deriveExplanationAction(makeDecision({ verdict: 'BLOCK' }))).toBe('BLOCK');
  });
  it('ESCALATE maps to ESCALATE', () => {
    expect(deriveExplanationAction(makeDecision({ verdict: 'ESCALATE' }))).toBe('ESCALATE');
  });
  it('verdict is not mutated', () => {
    const d = makeDecision({ verdict: 'BLOCK' });
    deriveExplanationAction(d);
    expect(d.summary.verdict).toBe('BLOCK');
  });
});

// ─── LT-10: deriveExplanationUrgency ─────────────────────────────────────────

describe('LT-10 deriveExplanationUrgency BLOCK → IMMEDIATE; INSUFFICIENT_DATA → LOW', () => {
  it('BLOCK urgency is IMMEDIATE', () => {
    expect(deriveExplanationUrgency('BLOCK')).toBe('IMMEDIATE');
  });
  it('INSUFFICIENT_DATA urgency is LOW', () => {
    expect(deriveExplanationUrgency('INSUFFICIENT_DATA')).toBe('LOW');
  });
  it('PROCEED urgency is STANDARD', () => {
    expect(deriveExplanationUrgency('PROCEED')).toBe('STANDARD');
  });
});

// ─── LT-11: buildNextActions — PROCEED ───────────────────────────────────────

describe('LT-11 buildNextActions PROCEED contains workflow reference', () => {
  const actions = buildNextActions('PROCEED', 0);
  it('returns a non-empty array', () => {
    expect(actions.length).toBeGreaterThan(0);
  });
  it('contains workflow reference', () => {
    expect(actions.some(a => a.toLowerCase().includes('workflow'))).toBe(true);
  });
  it('result is frozen', () => {
    expect(Object.isFrozen(actions)).toBe(true);
  });
});

// ─── LT-12: buildNextActions — SEEK_ADVICE ───────────────────────────────────

describe('LT-12 buildNextActions SEEK_ADVICE contains compliance warning count', () => {
  const actions = buildNextActions('SEEK_ADVICE', 3);
  it('contains compliance count', () => {
    expect(actions.some(a => a.includes('3'))).toBe(true);
  });
  it('mentions consulting legal advisory', () => {
    expect(actions.some(a => a.toLowerCase().includes('consult'))).toBe(true);
  });
  it('INSUFFICIENT_DATA returns fallback', () => {
    const fallback = buildNextActions('INSUFFICIENT_DATA', 0);
    expect(fallback.some(a => a.toLowerCase().includes('context'))).toBe(true);
  });
});

// ─── LT-13: buildEvidence ────────────────────────────────────────────────────

describe('LT-13 buildEvidence from laws, compliance warnings, risk factors', () => {
  it('empty decision produces empty evidence', () => {
    expect(buildEvidence(makeDecision({}))).toHaveLength(0);
  });
  it('compliance warning produces COMPLIANCE evidence', () => {
    const w = createComplianceWarning('COMP-001', 'Requires review.', 'HIGH');
    const ev = buildEvidence(makeDecision({ verdict: 'PROCEED', warnings: [w] }));
    expect(ev.some(e => e.type === 'COMPLIANCE')).toBe(true);
  });
  it('evidence array is frozen', () => {
    expect(Object.isFrozen(buildEvidence(makeDecision({})))).toBe(true);
  });
});
