/**
 * Phase 17 — Procurement Capability tests
 *
 * Groups (13 × 3 = 39):
 *   PC-01  (3)  analyzeProcurement — returns GovernanceDecision
 *   PC-02  (3)  analyzeProcurement — reasoning trace has 7 steps
 *   PC-03  (3)  analyzeProcurement — INSUFFICIENT_DATA with no configs
 *   PC-04  (3)  resolveProcurementWorkflow — empty when no workflow configs
 *   PC-05  (3)  resolveProcurementWorkflow — returns configs when present
 *   PC-06  (3)  resolveProcurementAuthority — empty when no authority configs
 *   PC-07  (3)  resolveProcurementAuthority — sorted ascending by maxAmount
 *   PC-08  (3)  resolveRequiredDocuments — empty when no templates in KB
 *   PC-09  (3)  resolveRequiredDocuments — ResolvedTemplate returned when matched
 *   PC-10  (3)  resolveApplicableThreshold — empty without threshold config
 *   PC-11  (3)  resolveApplicableThreshold — returns threshold configs
 *   PC-12  (3)  generateProcurementDecision — full output shape
 *   PC-13  (3)  buildProcurementCapability — factory
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
import { buildGovernanceKnowledgeBase }  from '../knowledge/knowledgeBase';
import { createDocumentTemplate }        from '../knowledge/knowledgeTypes';
import {
  buildProcurementCapability,
  ProcurementCapability,
} from '../capabilities/procurementCapability';
import type { GovernanceConfig }  from '../legal/governanceConfig';

// ─── Config fixtures ──────────────────────────────────────────────────────────

function cfg(id: string, type: GovernanceConfig['type'], metadata: Record<string, string> = {}): GovernanceConfig {
  return createConfig({
    id, type, version: '1.0.0', effectiveDate: '2024-01-01',
    source: 'test', status: 'ACTIVE', priority: 1, confidence: 1.0, tags: [], metadata,
  });
}

const AUDIT_CFG   = cfg('audit-pc',  'AUDIT_RULE');
const THRESH_CFG  = cfg('thresh-pc', 'PROCUREMENT_THRESHOLD', { maxAmount: '100000000' });
const WF_CFG      = cfg('wf-pc',    'WORKFLOW_DEFINITION',    { workflowId: 'procurement-std' });
const AUTH_CFG    = cfg('auth-pc',  'AUTHORITY_MATRIX',       { role: 'UNIT_HEAD', maxAmount: '200000000' });
const TMPL_CFG    = cfg('tmpl-cfg', 'DOCUMENT_TEMPLATE',      { templateCode: 'PROCUREMENT_NOTICE' });

// ─── Knowledge Base fixture ───────────────────────────────────────────────────

const KB_TEMPLATE = createDocumentTemplate({
  id: 'PROCUREMENT_NOTICE', name: 'Thông báo mời thầu',
  documentType: 'PROCUREMENT_NOTICE', version: '1.0.0', effectiveDate: '2024-01-01',
});

// ─── GovernanceContext ────────────────────────────────────────────────────────

const CTX = generateGovernanceContext({
  actor:       { id: 'u-pc', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-pc-001',
  packageValue: 50_000_000,
});

// ─── Capability builder ───────────────────────────────────────────────────────

function buildCapability(
  configs:    GovernanceConfig[] = [],
  kbTemplates = [KB_TEMPLATE],
): ProcurementCapability {
  const repo       = createInMemoryRepository(configs);
  const resolver   = buildConfigResolver(repo);
  const ruleEngine = buildGovernanceRuleEngine(resolver);
  const registry   = createRegistry([]);
  const query      = buildQueryEngine(registry);
  const graph      = buildKnowledgeGraph([], []);
  const impact     = buildGovernanceImpactEngine(graph);
  const engine     = buildGovernanceReasoningEngine(query, impact, resolver, ruleEngine);
  const kb         = buildGovernanceKnowledgeBase(kbTemplates);
  return buildProcurementCapability(engine, kb, resolver);
}

// ─── PC-01: analyzeProcurement — returns GovernanceDecision ──────────────────

describe('PC-01 analyzeProcurement returns GovernanceDecision', () => {
  const cap = buildCapability([AUDIT_CFG, THRESH_CFG]);

  it('returns an object with summary.verdict', () => {
    const d = cap.analyzeProcurement(CTX);
    expect(d.summary.verdict).toBeDefined();
  });
  it('returns PROCEED with audit config present', () => {
    expect(cap.analyzeProcurement(CTX).summary.verdict).toBe('PROCEED');
  });
  it('governanceDecision has decidedAt ISO string', () => {
    expect(cap.analyzeProcurement(CTX).decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── PC-02: analyzeProcurement — reasoning trace ─────────────────────────────

describe('PC-02 analyzeProcurement reasoning trace has 7 steps', () => {
  const cap = buildCapability([AUDIT_CFG, THRESH_CFG]);

  it('reasoningTrace has exactly 7 steps', () => {
    expect(cap.analyzeProcurement(CTX).reasoningTrace).toHaveLength(7);
  });
  it('first step is resolveApplicableLaw', () => {
    expect(cap.analyzeProcurement(CTX).reasoningTrace[0]?.operation).toBe('resolveApplicableLaw');
  });
  it('last step is resolveRisk', () => {
    const trace = cap.analyzeProcurement(CTX).reasoningTrace;
    expect(trace[trace.length - 1]?.operation).toBe('resolveRisk');
  });
});

// ─── PC-03: analyzeProcurement — INSUFFICIENT_DATA ───────────────────────────

describe('PC-03 analyzeProcurement INSUFFICIENT_DATA with no configs', () => {
  const cap = buildCapability([]);

  it('verdict is INSUFFICIENT_DATA with no configs', () => {
    expect(cap.analyzeProcurement(CTX).summary.verdict).toBe('INSUFFICIENT_DATA');
  });
  it('applicableLaws is empty', () => {
    expect(cap.analyzeProcurement(CTX).applicableLaws).toHaveLength(0);
  });
  it('confidence is 1.0 when no laws or configs to average', () => {
    expect(cap.analyzeProcurement(CTX).confidence).toBe(1.0);
  });
});

// ─── PC-04: resolveProcurementWorkflow — empty ────────────────────────────────

describe('PC-04 resolveProcurementWorkflow empty without workflow configs', () => {
  it('returns empty array when no WORKFLOW_DEFINITION configs', () => {
    expect(buildCapability([]).resolveProcurementWorkflow(CTX)).toHaveLength(0);
  });
  it('does not include AUDIT_RULE as a workflow', () => {
    expect(buildCapability([AUDIT_CFG]).resolveProcurementWorkflow(CTX)).toHaveLength(0);
  });
  it('returns array type', () => {
    expect(Array.isArray(buildCapability([]).resolveProcurementWorkflow(CTX))).toBe(true);
  });
});

// ─── PC-05: resolveProcurementWorkflow — returns configs ─────────────────────

describe('PC-05 resolveProcurementWorkflow returns workflow configs', () => {
  const cap = buildCapability([WF_CFG]);

  it('returns one config when WORKFLOW_DEFINITION present', () => {
    expect(cap.resolveProcurementWorkflow(CTX)).toHaveLength(1);
  });
  it('returned config type is WORKFLOW_DEFINITION', () => {
    expect(cap.resolveProcurementWorkflow(CTX)[0]?.type).toBe('WORKFLOW_DEFINITION');
  });
  it('workflowId metadata accessible', () => {
    expect(cap.resolveProcurementWorkflow(CTX)[0]?.metadata['workflowId']).toBe('procurement-std');
  });
});

// ─── PC-06: resolveProcurementAuthority — empty ───────────────────────────────

describe('PC-06 resolveProcurementAuthority empty without authority configs', () => {
  it('returns empty array with no configs', () => {
    expect(buildCapability([]).resolveProcurementAuthority(CTX)).toHaveLength(0);
  });
  it('does not include AUDIT_RULE in authority chain', () => {
    expect(buildCapability([AUDIT_CFG]).resolveProcurementAuthority(CTX)).toHaveLength(0);
  });
  it('returns array type', () => {
    expect(Array.isArray(buildCapability([]).resolveProcurementAuthority(CTX))).toBe(true);
  });
});

// ─── PC-07: resolveProcurementAuthority — sorted ─────────────────────────────

describe('PC-07 resolveProcurementAuthority sorted by maxAmount', () => {
  const HIGH_AUTH = cfg('auth-dir', 'AUTHORITY_MATRIX', { role: 'DIRECTOR', maxAmount: '2000000000' });
  const cap = buildCapability([AUTH_CFG, HIGH_AUTH]);

  it('returns two authority levels', () => {
    expect(cap.resolveProcurementAuthority(CTX)).toHaveLength(2);
  });
  it('lower authority (UNIT_HEAD) comes first', () => {
    expect(cap.resolveProcurementAuthority(CTX)[0]?.role).toBe('UNIT_HEAD');
  });
  it('higher authority (DIRECTOR) comes second', () => {
    expect(cap.resolveProcurementAuthority(CTX)[1]?.role).toBe('DIRECTOR');
  });
});

// ─── PC-08: resolveRequiredDocuments — empty ──────────────────────────────────

describe('PC-08 resolveRequiredDocuments empty when no template config or KB match', () => {
  it('empty when no DOCUMENT_TEMPLATE configs', () => {
    expect(buildCapability([]).resolveRequiredDocuments(CTX)).toHaveLength(0);
  });
  it('empty when template config present but not in KB', () => {
    const cap = buildCapability([TMPL_CFG], []);  // KB has no templates
    expect(cap.resolveRequiredDocuments(CTX)).toHaveLength(0);
  });
  it('result is frozen', () => {
    expect(Object.isFrozen(buildCapability([]).resolveRequiredDocuments(CTX))).toBe(true);
  });
});

// ─── PC-09: resolveRequiredDocuments — returns ResolvedTemplate ──────────────

describe('PC-09 resolveRequiredDocuments returns ResolvedTemplate when matched', () => {
  const cap = buildCapability([TMPL_CFG]);  // KB has KB_TEMPLATE with id='PROCUREMENT_NOTICE'

  it('returns one ResolvedTemplate when code matches KB template id', () => {
    expect(cap.resolveRequiredDocuments(CTX)).toHaveLength(1);
  });
  it('resolved template has the correct documentType', () => {
    expect(cap.resolveRequiredDocuments(CTX)[0]?.template.documentType).toBe('PROCUREMENT_NOTICE');
  });
  it('resolved template clauses/citations are arrays', () => {
    const t = cap.resolveRequiredDocuments(CTX)[0]!;
    expect(Array.isArray(t.clauses)).toBe(true);
    expect(Array.isArray(t.citations)).toBe(true);
  });
});

// ─── PC-10: resolveApplicableThreshold — empty ────────────────────────────────

describe('PC-10 resolveApplicableThreshold empty without threshold config', () => {
  it('returns empty array with no PROCUREMENT_THRESHOLD', () => {
    expect(buildCapability([]).resolveApplicableThreshold(CTX)).toHaveLength(0);
  });
  it('does not return AUDIT_RULE as threshold', () => {
    expect(buildCapability([AUDIT_CFG]).resolveApplicableThreshold(CTX)).toHaveLength(0);
  });
  it('returns array type', () => {
    expect(Array.isArray(buildCapability([]).resolveApplicableThreshold(CTX))).toBe(true);
  });
});

// ─── PC-11: resolveApplicableThreshold — returns configs ─────────────────────

describe('PC-11 resolveApplicableThreshold returns threshold configs', () => {
  const cap = buildCapability([THRESH_CFG]);

  it('returns one config when PROCUREMENT_THRESHOLD present', () => {
    expect(cap.resolveApplicableThreshold(CTX)).toHaveLength(1);
  });
  it('type is PROCUREMENT_THRESHOLD', () => {
    expect(cap.resolveApplicableThreshold(CTX)[0]?.type).toBe('PROCUREMENT_THRESHOLD');
  });
  it('maxAmount metadata accessible', () => {
    expect(cap.resolveApplicableThreshold(CTX)[0]?.metadata['maxAmount']).toBe('100000000');
  });
});

// ─── PC-12: generateProcurementDecision — full shape ─────────────────────────

describe('PC-12 generateProcurementDecision full output shape', () => {
  const cap = buildCapability([AUDIT_CFG, THRESH_CFG, WF_CFG, AUTH_CFG, TMPL_CFG]);
  const pd  = cap.generateProcurementDecision(CTX);

  it('finalRecommendation.action is defined', () => {
    expect(pd.finalRecommendation.action).toBeDefined();
  });
  it('governanceDecision is embedded', () => {
    expect(pd.governanceDecision.reasoningTrace).toHaveLength(7);
  });
  it('decidedAt is an ISO date string', () => {
    expect(pd.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── PC-13: buildProcurementCapability factory ───────────────────────────────

describe('PC-13 buildProcurementCapability factory', () => {
  it('returns a ProcurementCapability instance', () => {
    expect(buildCapability()).toBeInstanceOf(ProcurementCapability);
  });
  it('factory with full config set produces non-empty threshold result', () => {
    expect(buildCapability([THRESH_CFG]).resolveApplicableThreshold(CTX)).toHaveLength(1);
  });
  it('empty capability still returns valid (empty) decision', () => {
    const pd = buildCapability([]).generateProcurementDecision(CTX);
    expect(pd.finalRecommendation.action).toBe('INSUFFICIENT_DATA');
  });
});
