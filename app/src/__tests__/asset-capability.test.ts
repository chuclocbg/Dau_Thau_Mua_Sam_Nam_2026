/**
 * Phase 19 — Asset Capability tests
 *
 * Groups (13 × 3 = 39):
 *   AC-01  (3)  analyzeAsset — returns GovernanceDecision
 *   AC-02  (3)  analyzeAsset — INSUFFICIENT_DATA with no configs
 *   AC-03  (3)  analyzeAsset — reasoning trace has 7 steps
 *   AC-04  (3)  resolveAssetAuthority — empty without AUTHORITY_MATRIX configs
 *   AC-05  (3)  resolveAssetAuthority — sorted ascending by maxAmount
 *   AC-06  (3)  resolveAssetCompliance — empty without compliance-triggering configs
 *   AC-07  (3)  resolveAssetCompliance — returns warnings with RISK_RULE requiresReview
 *   AC-08  (3)  resolveAssetWorkflow — empty without WORKFLOW_DEFINITION configs
 *   AC-09  (3)  resolveAssetWorkflow — returns workflow configs when present
 *   AC-10  (3)  generateAssetDecision — PROCEED recommendation
 *   AC-11  (3)  generateAssetDecision — INSUFFICIENT_DATA recommendation
 *   AC-12  (3)  generateAssetDecision — governanceCase embedded in output
 *   AC-13  (3)  buildAssetCapability factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }                   from '../legal/governanceConfig';
import { createInMemoryRepository }       from '../legal/configRepository';
import { buildConfigResolver }            from '../legal/configResolver';
import { buildGovernanceRuleEngine }      from '../legal/governanceRuleEngine';
import { createRegistry }                from '../legal/legalRegistry';
import { buildQueryEngine }              from '../legal/registryQueryEngine';
import { buildKnowledgeGraph }           from '../legal/knowledgeGraph';
import { buildGovernanceImpactEngine }   from '../legal/governanceImpactEngine';
import { buildGovernanceReasoningEngine }from '../reasoning/reasoningEngine';
import { generateGovernanceContext }      from '../application/governanceContext';
import {
  createCase,
  createCaseMetadata,
  createCaseTimeline,
} from '../cases/caseModel';
import {
  AssetCapability,
  buildAssetCapability,
} from '../capabilities/assetCapability';
import type { GovernanceConfig }  from '../legal/governanceConfig';
import type { GovernanceCase }    from '../cases/caseModel';

// ─── Config helpers ───────────────────────────────────────────────────────────

function cfg(
  id:       string,
  type:     GovernanceConfig['type'],
  metadata: Record<string, string> = {},
): GovernanceConfig {
  return createConfig({
    id, type, version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [], metadata,
  });
}

const AUDIT_CFG  = cfg('audit-ac',  'AUDIT_RULE');
const THRESH_CFG = cfg('thresh-ac', 'PROCUREMENT_THRESHOLD', { maxAmount: '200000000' });
const WF_CFG     = cfg('wf-ac',     'WORKFLOW_DEFINITION', { workflowId: 'asset-std' });
const AUTH_CFG   = cfg('auth-ac',   'AUTHORITY_MATRIX',    { role: 'UNIT_HEAD',  maxAmount: '200000000' });
const HIGH_AUTH  = cfg('auth-dir',  'AUTHORITY_MATRIX',    { role: 'DIRECTOR',   maxAmount: '2000000000' });
const RISK_CFG   = cfg('risk-ac',   'RISK_RULE',           { requiresReview: 'true' });

// ─── Case builder ─────────────────────────────────────────────────────────────

const BASE_CTX = generateGovernanceContext({
  actor:        { id: 'u-ac', role: 'UNIT_HEAD' },
  currentDate:  '2024-06-01',
  requestId:    'req-ac-001',
  packageValue: 80_000_000,
  assetCategory: 'EQUIPMENT',
});

function makeCase(ctx = BASE_CTX): GovernanceCase {
  return createCase({
    id:       'case-ac-001',
    title:    'Asset Governance: Server Equipment',
    context:  ctx,
    metadata: createCaseMetadata({ domain: 'ASSETS', category: 'EQUIPMENT', priority: 'HIGH' }),
    timeline: createCaseTimeline({ createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-06-01T08:00:00Z' }),
  });
}

// ─── Capability builder ───────────────────────────────────────────────────────

function buildCapability(configs: GovernanceConfig[] = []): AssetCapability {
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  const registry   = createRegistry([]);
  const query      = buildQueryEngine(registry);
  const graph      = buildKnowledgeGraph([], []);
  const impact     = buildGovernanceImpactEngine(graph);
  const engine     = buildGovernanceReasoningEngine(query, impact, resolver, ruleEngine);
  return buildAssetCapability(engine);
}

const PROCEED_CASE = makeCase();

// ─── AC-01: analyzeAsset — returns GovernanceDecision ────────────────────────

describe('AC-01 analyzeAsset returns GovernanceDecision', () => {
  const cap = buildCapability([AUDIT_CFG, THRESH_CFG]);

  it('returns an object with summary.verdict', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).summary.verdict).toBeDefined();
  });
  it('returns PROCEED with threshold config present', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).summary.verdict).toBe('PROCEED');
  });
  it('decidedAt is an ISO string', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── AC-02: analyzeAsset — INSUFFICIENT_DATA ─────────────────────────────────

describe('AC-02 analyzeAsset INSUFFICIENT_DATA with no configs', () => {
  const cap = buildCapability([]);

  it('verdict is INSUFFICIENT_DATA', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).summary.verdict).toBe('INSUFFICIENT_DATA');
  });
  it('applicableLaws is empty', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).applicableLaws).toHaveLength(0);
  });
  it('confidence is 1.0', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).confidence).toBe(1.0);
  });
});

// ─── AC-03: analyzeAsset — reasoning trace ────────────────────────────────────

describe('AC-03 analyzeAsset reasoning trace has 7 steps', () => {
  const cap = buildCapability([THRESH_CFG]);

  it('reasoningTrace has exactly 7 steps', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).reasoningTrace).toHaveLength(7);
  });
  it('first step is resolveApplicableLaw', () => {
    expect(cap.analyzeAsset(PROCEED_CASE).reasoningTrace[0]?.operation).toBe('resolveApplicableLaw');
  });
  it('last step is resolveRisk', () => {
    const trace = cap.analyzeAsset(PROCEED_CASE).reasoningTrace;
    expect(trace[trace.length - 1]?.operation).toBe('resolveRisk');
  });
});

// ─── AC-04: resolveAssetAuthority — empty ─────────────────────────────────────

describe('AC-04 resolveAssetAuthority empty without AUTHORITY_MATRIX', () => {
  it('returns empty array with no configs', () => {
    expect(buildCapability([]).resolveAssetAuthority(PROCEED_CASE)).toHaveLength(0);
  });
  it('does not include AUDIT_RULE as authority', () => {
    expect(buildCapability([AUDIT_CFG]).resolveAssetAuthority(PROCEED_CASE)).toHaveLength(0);
  });
  it('result is an array', () => {
    expect(Array.isArray(buildCapability([]).resolveAssetAuthority(PROCEED_CASE))).toBe(true);
  });
});

// ─── AC-05: resolveAssetAuthority — sorted ────────────────────────────────────

describe('AC-05 resolveAssetAuthority sorted ascending by maxAmount', () => {
  const cap = buildCapability([HIGH_AUTH, AUTH_CFG]);   // intentionally out of order

  it('returns two authority levels', () => {
    expect(cap.resolveAssetAuthority(PROCEED_CASE)).toHaveLength(2);
  });
  it('lower authority (UNIT_HEAD) comes first', () => {
    expect(cap.resolveAssetAuthority(PROCEED_CASE)[0]?.role).toBe('UNIT_HEAD');
  });
  it('higher authority (DIRECTOR) comes second', () => {
    expect(cap.resolveAssetAuthority(PROCEED_CASE)[1]?.role).toBe('DIRECTOR');
  });
});

// ─── AC-06: resolveAssetCompliance — empty ────────────────────────────────────

describe('AC-06 resolveAssetCompliance empty without compliance triggers', () => {
  it('returns empty array with no configs', () => {
    expect(buildCapability([]).resolveAssetCompliance(PROCEED_CASE)).toHaveLength(0);
  });
  it('returns empty with only THRESH_CFG (no compliance issues)', () => {
    expect(buildCapability([THRESH_CFG]).resolveAssetCompliance(PROCEED_CASE)).toHaveLength(0);
  });
  it('returns an array', () => {
    expect(Array.isArray(buildCapability([]).resolveAssetCompliance(PROCEED_CASE))).toBe(true);
  });
});

// ─── AC-07: resolveAssetCompliance — returns warnings ────────────────────────

describe('AC-07 resolveAssetCompliance returns warnings with RISK_RULE requiresReview', () => {
  const cap = buildCapability([RISK_CFG]);

  it('returns at least one compliance warning', () => {
    expect(cap.resolveAssetCompliance(PROCEED_CASE).length).toBeGreaterThan(0);
  });
  it('warning severity is HIGH (REQUIRES_REVIEW)', () => {
    const warnings = cap.resolveAssetCompliance(PROCEED_CASE);
    expect(warnings.some(w => w.severity === 'HIGH')).toBe(true);
  });
  it('warning has a code and message', () => {
    const w = cap.resolveAssetCompliance(PROCEED_CASE)[0]!;
    expect(w.code).toBeDefined();
    expect(w.message).toBeDefined();
  });
});

// ─── AC-08: resolveAssetWorkflow — empty ──────────────────────────────────────

describe('AC-08 resolveAssetWorkflow empty without WORKFLOW_DEFINITION', () => {
  it('returns empty array with no configs', () => {
    expect(buildCapability([]).resolveAssetWorkflow(PROCEED_CASE)).toHaveLength(0);
  });
  it('does not include AUTHORITY_MATRIX as workflow', () => {
    expect(buildCapability([AUTH_CFG]).resolveAssetWorkflow(PROCEED_CASE)).toHaveLength(0);
  });
  it('returns an array', () => {
    expect(Array.isArray(buildCapability([]).resolveAssetWorkflow(PROCEED_CASE))).toBe(true);
  });
});

// ─── AC-09: resolveAssetWorkflow — returns configs ────────────────────────────

describe('AC-09 resolveAssetWorkflow returns WORKFLOW_DEFINITION configs', () => {
  const cap = buildCapability([WF_CFG]);

  it('returns one config when WORKFLOW_DEFINITION present', () => {
    expect(cap.resolveAssetWorkflow(PROCEED_CASE)).toHaveLength(1);
  });
  it('returned type is WORKFLOW_DEFINITION', () => {
    expect(cap.resolveAssetWorkflow(PROCEED_CASE)[0]?.type).toBe('WORKFLOW_DEFINITION');
  });
  it('workflowId metadata is accessible', () => {
    expect(cap.resolveAssetWorkflow(PROCEED_CASE)[0]?.metadata['workflowId']).toBe('asset-std');
  });
});

// ─── AC-10: generateAssetDecision — PROCEED ──────────────────────────────────

describe('AC-10 generateAssetDecision PROCEED recommendation', () => {
  const cap = buildCapability([AUDIT_CFG, THRESH_CFG, AUTH_CFG]);
  const d   = cap.generateAssetDecision(PROCEED_CASE);

  it('recommendation is PROCEED', () => {
    expect(d.recommendation).toBe('PROCEED');
  });
  it('nextSteps include workflow initiation', () => {
    expect(d.nextSteps.some(s => s.toLowerCase().includes('workflow'))).toBe(true);
  });
  it('decidedAt is an ISO string', () => {
    expect(d.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── AC-11: generateAssetDecision — INSUFFICIENT_DATA ────────────────────────

describe('AC-11 generateAssetDecision INSUFFICIENT_DATA', () => {
  const cap = buildCapability([]);
  const d   = cap.generateAssetDecision(PROCEED_CASE);

  it('recommendation is INSUFFICIENT_DATA', () => {
    expect(d.recommendation).toBe('INSUFFICIENT_DATA');
  });
  it('nextSteps suggest providing context', () => {
    expect(d.nextSteps[0]).toContain('context');
  });
  it('requiredApprovals is empty', () => {
    expect(d.requiredApprovals).toHaveLength(0);
  });
});

// ─── AC-12: generateAssetDecision — embedded case ────────────────────────────

describe('AC-12 generateAssetDecision governanceCase embedded in output', () => {
  const cap = buildCapability([THRESH_CFG]);
  const d   = cap.generateAssetDecision(PROCEED_CASE);

  it('governanceCase is the same object passed in', () => {
    expect(d.governanceCase).toBe(PROCEED_CASE);
  });
  it('governanceCase.id matches', () => {
    expect(d.governanceCase.id).toBe('case-ac-001');
  });
  it('governanceDecision reasoningTrace has 7 steps', () => {
    expect(d.governanceDecision.reasoningTrace).toHaveLength(7);
  });
});

// ─── AC-13: buildAssetCapability factory ─────────────────────────────────────

describe('AC-13 buildAssetCapability factory', () => {
  it('returns an AssetCapability instance', () => {
    expect(buildCapability()).toBeInstanceOf(AssetCapability);
  });
  it('factory with workflow config returns workflow result', () => {
    expect(buildCapability([WF_CFG]).resolveAssetWorkflow(PROCEED_CASE)).toHaveLength(1);
  });
  it('factory with no configs produces INSUFFICIENT_DATA decision', () => {
    expect(buildCapability([]).generateAssetDecision(PROCEED_CASE).recommendation).toBe('INSUFFICIENT_DATA');
  });
});
