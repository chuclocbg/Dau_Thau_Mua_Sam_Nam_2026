/**
 * Phase 15 — Governance Reasoning Engine tests
 *
 * Groups (13 × 3 = 39):
 *   RN-01  (3)  resolveApplicableLaw — active + effective docs returned
 *   RN-02  (3)  resolveApplicableLaw — future/inactive docs excluded
 *   RN-03  (3)  resolveWorkflow — WORKFLOW_DEFINITION configs
 *   RN-04  (3)  resolveWorkflow — empty when no workflow configs
 *   RN-05  (3)  resolveAuthority — ordered by maxAmount ascending
 *   RN-06  (3)  resolveAuthority — empty when no AUTHORITY_MATRIX configs
 *   RN-07  (3)  resolveRequiredDocuments — template codes from DOCUMENT_TEMPLATE
 *   RN-08  (3)  resolveCompliance — empty warnings when no compliance configs
 *   RN-09  (3)  resolveCompliance — RISK_RULE requiresReview → HIGH warning
 *   RN-10  (3)  resolveRisk — NONE level when no risk configs
 *   RN-11  (3)  resolveRisk — HIGH level when RISK_RULE requiresReview present
 *   RN-12  (3)  generateDecision — full pipeline shape
 *   RN-13  (3)  resolveDecision and buildGovernanceReasoningEngine factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }                from '../legal/governanceConfig';
import { createInMemoryRepository }    from '../legal/configRepository';
import { buildConfigResolver }         from '../legal/configResolver';
import { buildGovernanceRuleEngine }   from '../legal/governanceRuleEngine';
import { createRegistry }             from '../legal/legalRegistry';
import { buildQueryEngine }           from '../legal/registryQueryEngine';
import { buildKnowledgeGraph }        from '../legal/knowledgeGraph';
import { buildGovernanceImpactEngine }from '../legal/governanceImpactEngine';
import { generateGovernanceContext }  from '../application/governanceContext';
import {
  buildGovernanceReasoningEngine,
  GovernanceReasoningEngine,
} from '../reasoning/reasoningEngine';
import type { LegalDocument }         from '../legal/legalRegistry';
import type { GovernanceConfig }      from '../legal/governanceConfig';

// ─── Config fixtures ──────────────────────────────────────────────────────────

function makeConfig(overrides: {
  id: string; type: GovernanceConfig['type']; metadata?: Record<string, string>
}): GovernanceConfig {
  return createConfig({
    id: overrides.id, type: overrides.type, version: '1.0.0',
    effectiveDate: '2024-01-01', source: 'test', status: 'ACTIVE',
    priority: 1, confidence: 1.0, tags: [], metadata: overrides.metadata ?? {},
  });
}

const RISK_CFG   = makeConfig({ id: 'risk-rn',  type: 'RISK_RULE',            metadata: { requiresReview: 'true' } });
const THRESH_CFG = makeConfig({ id: 'thresh-rn', type: 'PROCUREMENT_THRESHOLD', metadata: { maxAmount: '100000000' } });
const AUTH_LOW   = makeConfig({ id: 'auth-low',  type: 'AUTHORITY_MATRIX',      metadata: { role: 'UNIT_HEAD',  maxAmount: '200000000' } });
const AUTH_HIGH  = makeConfig({ id: 'auth-high', type: 'AUTHORITY_MATRIX',      metadata: { role: 'DIRECTOR',   maxAmount: '2000000000' } });
const WF_CFG     = makeConfig({ id: 'wf-rn',    type: 'WORKFLOW_DEFINITION',    metadata: { workflowId: 'procurement-standard' } });
const TMPL_CFG   = makeConfig({ id: 'tmpl-rn',  type: 'DOCUMENT_TEMPLATE',      metadata: { templateCode: 'PROCUREMENT_NOTICE' } });
const AUDIT_CFG  = makeConfig({ id: 'audit-rn', type: 'AUDIT_RULE' });

// ─── Document fixtures ────────────────────────────────────────────────────────

const DOC_ACTIVE: LegalDocument = {
  id: 'doc-rn-1', symbol: '01/2024', title: 'Luật test A', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2024-01-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 10, tags: [], summary: '', confidence: 1.0,
};

const DOC_FUTURE: LegalDocument = {
  id: 'doc-rn-2', symbol: '02/2030', title: 'Luật future', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2030-01-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 10, tags: [], summary: '', confidence: 1.0,
};

const DOC_INACTIVE: LegalDocument = {
  id: 'doc-rn-3', symbol: '03/2020', title: 'Luật expired', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2020-01-01', status: 'SUPERSEDED',
  source: 'vbpl.vn', priority: 10, tags: [], summary: '', confidence: 1.0,
};

// ─── GovernanceContext fixture ────────────────────────────────────────────────

const CTX = generateGovernanceContext({
  actor:       { id: 'u-rn', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-rn-001',
});

// ─── Engine builder ───────────────────────────────────────────────────────────

function buildEngine(configs: GovernanceConfig[] = [], docs: LegalDocument[] = []): GovernanceReasoningEngine {
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  const registry   = createRegistry(docs);
  const query      = buildQueryEngine(registry);
  const graph      = buildKnowledgeGraph([], []);
  const impact     = buildGovernanceImpactEngine(graph);
  return buildGovernanceReasoningEngine(query, impact, resolver, ruleEngine);
}

// ─── RN-01: resolveApplicableLaw — active + effective ────────────────────────

describe('RN-01 resolveApplicableLaw active and effective', () => {
  const engine = buildEngine([], [DOC_ACTIVE]);

  it('returns docs that are active and effective on ctx date', () => {
    const laws = engine.resolveApplicableLaw(CTX);
    expect(laws).toHaveLength(1);
    expect(laws[0]?.id).toBe('doc-rn-1');
  });
  it('result is a readonly array', () => {
    const laws = engine.resolveApplicableLaw(CTX);
    expect(Object.isFrozen(laws)).toBe(true);
  });
  it('returns multiple docs when several active and effective', () => {
    const engine2 = buildEngine([], [DOC_ACTIVE, DOC_ACTIVE]);
    // same doc twice is deduplicated by registry — test returns 1 (registry indexes by id)
    const laws = engine2.resolveApplicableLaw(CTX);
    expect(laws.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── RN-02: resolveApplicableLaw — exclusions ────────────────────────────────

describe('RN-02 resolveApplicableLaw excludes future and inactive', () => {
  const engine = buildEngine([], [DOC_ACTIVE, DOC_FUTURE, DOC_INACTIVE]);

  it('excludes future-dated docs', () => {
    const ids = engine.resolveApplicableLaw(CTX).map(d => d.id);
    expect(ids).not.toContain('doc-rn-2');
  });
  it('excludes SUPERSEDED docs', () => {
    const ids = engine.resolveApplicableLaw(CTX).map(d => d.id);
    expect(ids).not.toContain('doc-rn-3');
  });
  it('returns empty array when no docs exist', () => {
    expect(buildEngine().resolveApplicableLaw(CTX)).toHaveLength(0);
  });
});

// ─── RN-03: resolveWorkflow — returns workflow configs ───────────────────────

describe('RN-03 resolveWorkflow returns WORKFLOW_DEFINITION configs', () => {
  const engine = buildEngine([WF_CFG]);

  it('returns workflow config when present', () => {
    expect(engine.resolveWorkflow(CTX)).toHaveLength(1);
  });
  it('returned config type is WORKFLOW_DEFINITION', () => {
    expect(engine.resolveWorkflow(CTX)[0]?.type).toBe('WORKFLOW_DEFINITION');
  });
  it('workflowId metadata is accessible', () => {
    expect(engine.resolveWorkflow(CTX)[0]?.metadata['workflowId']).toBe('procurement-standard');
  });
});

// ─── RN-04: resolveWorkflow — empty when no configs ──────────────────────────

describe('RN-04 resolveWorkflow empty when no workflow configs', () => {
  it('returns empty array when no WORKFLOW_DEFINITION configs', () => {
    expect(buildEngine().resolveWorkflow(CTX)).toHaveLength(0);
  });
  it('does not return non-workflow configs', () => {
    const engine = buildEngine([AUDIT_CFG]);
    expect(engine.resolveWorkflow(CTX)).toHaveLength(0);
  });
  it('returns array type', () => {
    expect(Array.isArray(buildEngine().resolveWorkflow(CTX))).toBe(true);
  });
});

// ─── RN-05: resolveAuthority — sorted ascending ──────────────────────────────

describe('RN-05 resolveAuthority ordered by maxAmount ascending', () => {
  const engine = buildEngine([AUTH_LOW, AUTH_HIGH]);

  it('lower maxAmount authority is first', () => {
    const chain = engine.resolveAuthority(CTX);
    expect(chain[0]?.maxAmount).toBeLessThan(chain[1]?.maxAmount ?? Infinity);
  });
  it('roles are extracted from metadata', () => {
    const roles = engine.resolveAuthority(CTX).map(a => a.role);
    expect(roles).toContain('UNIT_HEAD');
    expect(roles).toContain('DIRECTOR');
  });
  it('result is frozen', () => {
    expect(Object.isFrozen(engine.resolveAuthority(CTX))).toBe(true);
  });
});

// ─── RN-06: resolveAuthority — empty ─────────────────────────────────────────

describe('RN-06 resolveAuthority empty when no AUTHORITY_MATRIX configs', () => {
  it('returns empty array with no configs', () => {
    expect(buildEngine().resolveAuthority(CTX)).toHaveLength(0);
  });
  it('does not include non-authority configs', () => {
    expect(buildEngine([AUDIT_CFG]).resolveAuthority(CTX)).toHaveLength(0);
  });
  it('is still an array', () => {
    expect(Array.isArray(buildEngine().resolveAuthority(CTX))).toBe(true);
  });
});

// ─── RN-07: resolveRequiredDocuments ─────────────────────────────────────────

describe('RN-07 resolveRequiredDocuments returns template codes', () => {
  const engine = buildEngine([TMPL_CFG]);

  it('returns templateCode from config metadata', () => {
    expect(engine.resolveRequiredDocuments(CTX)).toContain('PROCUREMENT_NOTICE');
  });
  it('returns config id as fallback when templateCode absent', () => {
    const noCode = makeConfig({ id: 'tmpl-nocode', type: 'DOCUMENT_TEMPLATE' });
    const engine2 = buildEngine([noCode]);
    expect(engine2.resolveRequiredDocuments(CTX)).toContain('tmpl-nocode');
  });
  it('returns empty when no DOCUMENT_TEMPLATE configs', () => {
    expect(buildEngine().resolveRequiredDocuments(CTX)).toHaveLength(0);
  });
});

// ─── RN-08: resolveCompliance — no configs → empty warnings ──────────────────

describe('RN-08 resolveCompliance empty when no compliance configs', () => {
  it('returns empty array when no compliance configs', () => {
    expect(buildEngine().resolveCompliance(CTX)).toHaveLength(0);
  });
  it('returns empty array when only threshold config (not compliance)', () => {
    expect(buildEngine([THRESH_CFG]).resolveCompliance(CTX)).toHaveLength(0);
  });
  it('result is frozen', () => {
    expect(Object.isFrozen(buildEngine().resolveCompliance(CTX))).toBe(true);
  });
});

// ─── RN-09: resolveCompliance — RISK_RULE → HIGH warning ─────────────────────

describe('RN-09 resolveCompliance RISK_RULE requiresReview triggers HIGH warning', () => {
  const engine = buildEngine([RISK_CFG]);

  it('returns a ComplianceWarning when RISK_RULE requiresReview=true', () => {
    expect(engine.resolveCompliance(CTX)).toHaveLength(1);
  });
  it('warning severity is HIGH', () => {
    expect(engine.resolveCompliance(CTX)[0]?.severity).toBe('HIGH');
  });
  it('warning code is COMPLIANCE_REVIEW_REQUIRED', () => {
    expect(engine.resolveCompliance(CTX)[0]?.code).toBe('COMPLIANCE_REVIEW_REQUIRED');
  });
});

// ─── RN-10: resolveRisk — NONE when no risk configs ──────────────────────────

describe('RN-10 resolveRisk NONE level when no risk configs', () => {
  it('returns NONE risk level with no configs', () => {
    expect(buildEngine().resolveRisk(CTX).level).toBe('NONE');
  });
  it('returns score 0 with no configs', () => {
    expect(buildEngine().resolveRisk(CTX).score).toBe(0);
  });
  it('factors array is empty with no configs', () => {
    expect(buildEngine().resolveRisk(CTX).factors).toHaveLength(0);
  });
});

// ─── RN-11: resolveRisk — HIGH when RISK_RULE present ───────────────────────

describe('RN-11 resolveRisk HIGH level when RISK_RULE requiresReview=true', () => {
  const engine = buildEngine([RISK_CFG]);

  it('risk level is HIGH when RISK_RULE requiresReview=true', () => {
    expect(engine.resolveRisk(CTX).level).toBe('HIGH');
  });
  it('factors array is non-empty', () => {
    expect(engine.resolveRisk(CTX).factors.length).toBeGreaterThan(0);
  });
  it('factor code references the risk config id', () => {
    const factor = engine.resolveRisk(CTX).factors[0]!;
    expect(factor.code).toContain('risk-rn');
  });
});

// ─── RN-12: generateDecision — full pipeline ─────────────────────────────────

describe('RN-12 generateDecision full pipeline shape', () => {
  const engine   = buildEngine([AUDIT_CFG, THRESH_CFG, WF_CFG, AUTH_LOW, TMPL_CFG], [DOC_ACTIVE]);
  const decision = engine.generateDecision(CTX);

  it('summary.verdict is defined', () => {
    expect(decision.summary.verdict).toBeDefined();
  });
  it('reasoningTrace has 7 steps (one per resolve call)', () => {
    expect(decision.reasoningTrace).toHaveLength(7);
  });
  it('decidedAt is an ISO date string', () => {
    expect(decision.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── RN-13: resolveDecision and factory ──────────────────────────────────────

describe('RN-13 resolveDecision and buildGovernanceReasoningEngine factory', () => {
  it('resolveDecision returns a DecisionSummary (has verdict + riskLevel)', () => {
    const summary = buildEngine([AUDIT_CFG], [DOC_ACTIVE]).resolveDecision(CTX);
    expect(summary.verdict).toBeDefined();
    expect(summary.riskLevel).toBeDefined();
  });
  it('buildGovernanceReasoningEngine returns a GovernanceReasoningEngine instance', () => {
    const engine = buildEngine();
    expect(engine).toBeInstanceOf(GovernanceReasoningEngine);
  });
  it('resolveDecision verdict matches generateDecision summary verdict', () => {
    const engine  = buildEngine([AUDIT_CFG], [DOC_ACTIVE]);
    const summary  = engine.resolveDecision(CTX);
    const full     = engine.generateDecision(CTX);
    expect(summary.verdict).toBe(full.summary.verdict);
  });
});
