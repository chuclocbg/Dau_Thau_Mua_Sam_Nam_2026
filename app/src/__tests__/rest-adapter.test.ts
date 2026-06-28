/**
 * Phase 14 — REST Adapter tests (Fastify inject)
 *
 * Groups (13 × 3 = 39):
 *   RA-01  (3)  POST /procurement — missing definition → 400
 *   RA-02  (3)  POST /procurement — registered definition → 200
 *   RA-03  (3)  PUT  /procurement/:id — review procurement
 *   RA-04  (3)  GET  /procurement/:id — get status
 *   RA-05  (3)  GET  /legal/applicable — resolve applicable law
 *   RA-06  (3)  GET  /legal/search — keyword search
 *   RA-07  (3)  POST /workflow — start workflow
 *   RA-08  (3)  PUT  /workflow/:id — advance workflow
 *   RA-09  (3)  GET  /workflow/:id — workflow history
 *   RA-10  (3)  POST /audit/compliance — review compliance
 *   RA-11  (3)  GET  /audit/rules — audit rules
 *   RA-12  (3)  GET  /dashboard — governance dashboard
 *   RA-13  (3)  GET  /configuration — resolve configuration
 */

import { describe, it, expect } from 'vitest';
import { createConfig }              from '../legal/governanceConfig';
import { createInMemoryRepository }  from '../legal/configRepository';
import { buildConfigResolver }       from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import { createGovernanceEventBus }  from '../legal/governanceEvents';
import { buildWorkflowOrchestrator } from '../legal/workflowOrchestrator';
import type { WorkflowDefinition }   from '../legal/workflowOrchestrator';
import { createRegistry }            from '../legal/legalRegistry';
import { buildQueryEngine }          from '../legal/registryQueryEngine';
import { buildKnowledgeGraph }       from '../legal/knowledgeGraph';
import { buildGovernanceImpactEngine } from '../legal/governanceImpactEngine';
import { buildProcurementService }   from '../application/procurementService';
import { buildLegalService }         from '../application/legalService';
import { buildWorkflowService }      from '../application/workflowService';
import { buildAuditService }         from '../application/auditService';
import { buildDashboardService }     from '../application/dashboardService';
import { buildConfigurationService } from '../application/configurationService';
import { buildRestAdapter, AppServices } from '../interface/restAdapter';
import type { GovernanceConfig }     from '../legal/governanceConfig';
import type { LegalDocument }        from '../legal/legalRegistry';

// ─── Test date header ──────────────────────────────────────────────────────────

const DATE_HDR = { 'x-governance-date': '2024-06-01', 'x-actor-id': 'u-001', 'x-actor-role': 'UNIT_HEAD' };

// ─── Config fixtures ──────────────────────────────────────────────────────────

const AUDIT_CFG = createConfig({
  id: 'audit-ra', type: 'AUDIT_RULE', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-audit',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['audit'], metadata: {},
});

const THRESH_CFG = createConfig({
  id: 'thresh-ra', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '100000000' },
});

// ─── Document fixtures ────────────────────────────────────────────────────────

const DOC_A: LegalDocument = {
  id: 'doc-ra-1', symbol: '01/2024', title: 'Luật test A', type: 'LAW',
  issuer: 'Quốc hội', effectiveDate: '2024-01-01', status: 'ACTIVE',
  source: 'vbpl.vn', priority: 10, tags: ['luật', 'đấu thầu'],
  summary: 'Luật test for REST adapter', confidence: 1.0,
};

// ─── Workflow definitions ─────────────────────────────────────────────────────

const SIMPLE_DEF: WorkflowDefinition = {
  id: 'ra-workflow',
  name: 'REST Adapter Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT', name: 'Draft', type: 'INITIAL' },
    { id: 'DONE',  name: 'Done',  type: 'FINAL' },
  ],
  transitions: [
    { id: 't-done', from: 'DRAFT', to: 'DONE', trigger: 'complete' },
  ],
};

// ─── Setup helper ─────────────────────────────────────────────────────────────

function buildTestApp(configs: GovernanceConfig[] = [], docs: LegalDocument[] = []) {
  const repo         = createInMemoryRepository(configs);
  const resolver     = buildConfigResolver(repo);
  const ruleEngine   = buildGovernanceRuleEngine(resolver);
  const eventBus     = createGovernanceEventBus();
  const orchestrator = buildWorkflowOrchestrator(ruleEngine, eventBus);
  const registry     = createRegistry(docs);
  const query        = buildQueryEngine(registry);
  const graph        = buildKnowledgeGraph([], []);
  const impact       = buildGovernanceImpactEngine(graph);

  const services: AppServices = {
    procurement:   buildProcurementService(ruleEngine, orchestrator),
    legal:         buildLegalService(query, impact),
    workflow:      buildWorkflowService(orchestrator),
    audit:         buildAuditService(ruleEngine, resolver),
    dashboard:     buildDashboardService(query, resolver, ruleEngine),
    configuration: buildConfigurationService(resolver),
  };

  return { app: buildRestAdapter(services), orchestrator };
}

// ─── RA-01: POST /procurement — missing definition ────────────────────────────

describe('RA-01 POST /procurement missing definition', () => {
  const { app } = buildTestApp();

  it('returns 400 when definition not registered', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'no-such-def', instanceId: 'inst-001' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('response body has status FAILED', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'no-such-def', instanceId: 'inst-002' },
    });
    expect(JSON.parse(res.body).status).toBe('FAILED');
  });
  it('response body has errors array', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'no-such-def', instanceId: 'inst-003' },
    });
    expect(JSON.parse(res.body).errors.length).toBeGreaterThan(0);
  });
});

// ─── RA-02: POST /procurement — registered definition ────────────────────────

describe('RA-02 POST /procurement registered definition', () => {
  const { app, orchestrator } = buildTestApp();
  orchestrator.createWorkflow(SIMPLE_DEF);

  it('returns 200 when definition registered', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'ra-workflow', instanceId: 'inst-reg-1' },
    });
    expect(res.statusCode).toBe(200);
  });
  it('response body has status SUCCESS', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'ra-workflow', instanceId: 'inst-reg-2' },
    });
    expect(JSON.parse(res.body).status).toBe('SUCCESS');
  });
  it('response body.workflowState is DRAFT', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR,
      payload: { definitionId: 'ra-workflow', instanceId: 'inst-reg-3' },
    });
    expect(JSON.parse(res.body).workflowState).toBe('DRAFT');
  });
});

// ─── RA-03: PUT /procurement/:id — review ────────────────────────────────────

describe('RA-03 PUT /procurement/:id review', () => {
  const { app, orchestrator } = buildTestApp();
  orchestrator.createWorkflow(SIMPLE_DEF);

  it('returns 200 when trigger valid', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'inst-rv-1' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/procurement/inst-rv-1',
      headers: DATE_HDR, payload: { trigger: 'complete' },
    });
    expect(res.statusCode).toBe(200);
  });
  it('returns 400 when unknown trigger', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'inst-rv-2' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/procurement/inst-rv-2',
      headers: DATE_HDR, payload: { trigger: 'no-such' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('response body has workflowState after advance', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'inst-rv-3' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/procurement/inst-rv-3',
      headers: DATE_HDR, payload: { trigger: 'complete' },
    });
    expect(JSON.parse(res.body).workflowState).toBe('DONE');
  });
});

// ─── RA-04: GET /procurement/:id — status ────────────────────────────────────

describe('RA-04 GET /procurement/:id status', () => {
  const { app, orchestrator } = buildTestApp();
  orchestrator.createWorkflow(SIMPLE_DEF);

  it('returns 200 for known instance', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'inst-st-1' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/procurement/inst-st-1', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
  });
  it('returns 400 for unknown instance', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/procurement/ghost-instance', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(400);
  });
  it('data.state is present in response', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/procurement',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'inst-st-2' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/procurement/inst-st-2', headers: DATE_HDR,
    });
    expect(JSON.parse(res.body).data?.state).toBe('DRAFT');
  });
});

// ─── RA-05: GET /legal/applicable ────────────────────────────────────────────

describe('RA-05 GET /legal/applicable', () => {
  it('returns 200 with empty array when no docs', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/legal/applicable', headers: DATE_HDR });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toEqual([]);
  });
  it('returns active docs when present', async () => {
    const { app } = buildTestApp([], [DOC_A]);
    const res = await app.inject({ method: 'GET', url: '/api/v1/legal/applicable', headers: DATE_HDR });
    expect(JSON.parse(res.body).data.length).toBe(1);
  });
  it('response body has legalReferences', async () => {
    const { app } = buildTestApp([], [DOC_A]);
    const res = await app.inject({ method: 'GET', url: '/api/v1/legal/applicable', headers: DATE_HDR });
    expect(JSON.parse(res.body).legalReferences).toContain('doc-ra-1');
  });
});

// ─── RA-06: GET /legal/search ─────────────────────────────────────────────────

describe('RA-06 GET /legal/search', () => {
  it('returns 200 with results for matching keyword', async () => {
    const { app } = buildTestApp([], [DOC_A]);
    const res = await app.inject({
      method: 'GET', url: '/api/v1/legal/search?q=đấu thầu', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.length).toBeGreaterThan(0);
  });
  it('returns 400 when q is blank', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/legal/search?q=', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(400);
  });
  it('returns empty array for no-match keyword', async () => {
    const { app } = buildTestApp([], [DOC_A]);
    const res = await app.inject({
      method: 'GET', url: '/api/v1/legal/search?q=xyznotexist999', headers: DATE_HDR,
    });
    expect(JSON.parse(res.body).data).toHaveLength(0);
  });
});

// ─── RA-07: POST /workflow ────────────────────────────────────────────────────

describe('RA-07 POST /workflow', () => {
  it('returns 400 for unknown definition', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'no-def', instanceId: 'wf-001' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('returns 200 for registered definition', async () => {
    const { app, orchestrator } = buildTestApp();
    orchestrator.createWorkflow(SIMPLE_DEF);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'wf-ok-1' },
    });
    expect(res.statusCode).toBe(200);
  });
  it('response workflowState is initial state', async () => {
    const { app, orchestrator } = buildTestApp();
    orchestrator.createWorkflow(SIMPLE_DEF);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'wf-ok-2' },
    });
    expect(JSON.parse(res.body).workflowState).toBe('DRAFT');
  });
});

// ─── RA-08: PUT /workflow/:id ─────────────────────────────────────────────────

describe('RA-08 PUT /workflow/:id advance', () => {
  const { app, orchestrator } = buildTestApp();
  orchestrator.createWorkflow(SIMPLE_DEF);

  it('returns 200 for valid trigger', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'adv-1' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/workflow/adv-1',
      headers: DATE_HDR, payload: { trigger: 'complete' },
    });
    expect(res.statusCode).toBe(200);
  });
  it('returns 400 for invalid trigger', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'adv-2' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/workflow/adv-2',
      headers: DATE_HDR, payload: { trigger: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('workflowState transitions to DONE', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'adv-3' },
    });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/workflow/adv-3',
      headers: DATE_HDR, payload: { trigger: 'complete' },
    });
    expect(JSON.parse(res.body).workflowState).toBe('DONE');
  });
});

// ─── RA-09: GET /workflow/:id — history ───────────────────────────────────────

describe('RA-09 GET /workflow/:id history', () => {
  const { app, orchestrator } = buildTestApp();
  orchestrator.createWorkflow(SIMPLE_DEF);

  it('returns 200 for known instance', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'hist-1' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/workflow/hist-1', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
  });
  it('returns 200 with empty array for unknown instance', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/workflow/unknown-wf', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toHaveLength(0);
  });
  it('history grows after transition', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/workflow',
      headers: DATE_HDR, payload: { definitionId: 'ra-workflow', instanceId: 'hist-2' },
    });
    await app.inject({
      method: 'PUT', url: '/api/v1/workflow/hist-2',
      headers: DATE_HDR, payload: { trigger: 'complete' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/workflow/hist-2', headers: DATE_HDR,
    });
    expect(JSON.parse(res.body).data.length).toBe(2);
  });
});

// ─── RA-10: POST /audit/compliance ───────────────────────────────────────────

describe('RA-10 POST /audit/compliance', () => {
  it('returns 400 when no audit config (INSUFFICIENT_DATA)', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/audit/compliance', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(400);
  });
  it('returns 200 when audit config present', async () => {
    const { app } = buildTestApp([AUDIT_CFG]);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/audit/compliance', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
  });
  it('response body.data has verdict field', async () => {
    const { app } = buildTestApp([AUDIT_CFG]);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/audit/compliance', headers: DATE_HDR,
    });
    expect(JSON.parse(res.body).data?.verdict).toBe('APPROVED');
  });
});

// ─── RA-11: GET /audit/rules ─────────────────────────────────────────────────

describe('RA-11 GET /audit/rules', () => {
  it('returns 200 always', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit/rules', headers: DATE_HDR });
    expect(res.statusCode).toBe(200);
  });
  it('returns empty data when no audit configs', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit/rules', headers: DATE_HDR });
    expect(JSON.parse(res.body).data).toHaveLength(0);
  });
  it('returns audit configs when present', async () => {
    const { app } = buildTestApp([AUDIT_CFG]);
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit/rules', headers: DATE_HDR });
    expect(JSON.parse(res.body).data.length).toBe(1);
  });
});

// ─── RA-12: GET /dashboard ───────────────────────────────────────────────────

describe('RA-12 GET /dashboard', () => {
  it('returns 200', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: DATE_HDR });
    expect(res.statusCode).toBe(200);
  });
  it('data.activeLegalDocuments is present', async () => {
    const { app } = buildTestApp([], [DOC_A]);
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: DATE_HDR });
    expect(JSON.parse(res.body).data?.activeLegalDocuments).toBe(1);
  });
  it('data.asOfDate matches request date', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: DATE_HDR });
    expect(JSON.parse(res.body).data?.asOfDate).toBe('2024-06-01');
  });
});

// ─── RA-13: GET /configuration ───────────────────────────────────────────────

describe('RA-13 GET /configuration', () => {
  it('returns 200', async () => {
    const { app } = buildTestApp([THRESH_CFG]);
    const res = await app.inject({
      method: 'GET', url: '/api/v1/configuration?type=PROCUREMENT_THRESHOLD', headers: DATE_HDR,
    });
    expect(res.statusCode).toBe(200);
  });
  it('type param filters configs correctly', async () => {
    const { app } = buildTestApp([THRESH_CFG, AUDIT_CFG]);
    const res = await app.inject({
      method: 'GET', url: '/api/v1/configuration?type=PROCUREMENT_THRESHOLD', headers: DATE_HDR,
    });
    const body = JSON.parse(res.body);
    expect(body.data.every((c: { type: string }) => c.type === 'PROCUREMENT_THRESHOLD')).toBe(true);
  });
  it('metadata.type in response matches requested type', async () => {
    const { app } = buildTestApp([THRESH_CFG]);
    const res = await app.inject({
      method: 'GET', url: '/api/v1/configuration?type=PROCUREMENT_THRESHOLD', headers: DATE_HDR,
    });
    expect(JSON.parse(res.body).metadata?.type).toBe('PROCUREMENT_THRESHOLD');
  });
});
