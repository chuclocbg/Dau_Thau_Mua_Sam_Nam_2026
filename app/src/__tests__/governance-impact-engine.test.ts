/**
 * Phase 11.4 — Governance Impact Engine tests
 *
 * Test graph (8 nodes, 7 edges, acyclic):
 *
 *   decree  ──(implements)──────► law
 *   decree  ──(defines)──────────► thresh
 *   audit   ──(depends_on)───────► decree    ← direct dep on decree → Critical
 *   audit   ──(depends_on)───────► thresh
 *   template──(references)───────► audit
 *   template──(used_by)──────────► workflow
 *   workflow──(requires)─────────► checklist
 *
 * Impact of changing decree (BFS):
 *   thresh   depth 1  defines   → High
 *   audit    depth 1  depends_on→ Critical
 *   template depth 2  references→ Low
 *   workflow depth 3  used_by   → Informational
 *
 * Groups (13 × 3 = 39):
 *   GIE-01  (3)  classifyImpact — legal instrument types
 *   GIE-02  (3)  classifyImpact — operational artifact types
 *   GIE-03  (3)  calculateSeverity — depth-based base scoring
 *   GIE-04  (3)  calculateSeverity — edge type and confidence modifiers
 *   GIE-05  (3)  findAffectedNodes — all impacted nodes
 *   GIE-06  (3)  findAffectedNodes — maxDepth constraint
 *   GIE-07  (3)  findCriticalImpacts — severity filter
 *   GIE-08  (3)  analyzeImpact — depth values and severity
 *   GIE-09  (3)  analyzeImpact — dependency chain and relationship path
 *   GIE-10  (3)  analyzeImpact — BFS vs DFS traversal mode
 *   GIE-11  (3)  findPropagationPath — shortest impact path
 *   GIE-12  (3)  generateImpactReport — full report structure
 *   GIE-13  (3)  edge cases (empty, unknown id, cycle-safe)
 */

import { describe, it, expect } from 'vitest';
import {
  GovernanceImpactEngine,
  buildGovernanceImpactEngine,
  classifyImpact,
  calculateSeverity,
} from '../legal/governanceImpactEngine';
import { buildKnowledgeGraph, createNode, createEdge } from '../legal/knowledgeGraph';
import type { ImpactSeverity } from '../legal/governanceImpactEngine';

// ─── Test graph fixtures ──────────────────────────────────────────────────────

const N_DECREE    = createNode('decree',    'DECREE',                'Nghị định 214');
const N_LAW       = createNode('law',       'LAW',                   'Luật Đấu thầu');
const N_THRESH    = createNode('thresh',    'PROCUREMENT_THRESHOLD', 'Ngưỡng 200M');
const N_AUDIT     = createNode('audit',     'AUDIT_RULE',            'Quy tắc kiểm tra');
const N_TEMPLATE  = createNode('template',  'TEMPLATE',              'Mẫu HSMT');
const N_WORKFLOW  = createNode('workflow',  'WORKFLOW',              'Quy trình mua sắm');
const N_CHECKLIST = createNode('checklist', 'CHECKLIST',             'Danh mục hồ sơ');
const N_PROMPT    = createNode('prompt',    'PROMPT_RULE',           'Luật AI gợi ý');

const ALL_NODES = [N_DECREE, N_LAW, N_THRESH, N_AUDIT, N_TEMPLATE, N_WORKFLOW, N_CHECKLIST, N_PROMPT];

const E_IMPL       = createEdge('e-impl',       'decree',   'law',       'implements');
const E_DEF        = createEdge('e-def',        'decree',   'thresh',    'defines');
const E_AUD_DEC    = createEdge('e-aud-dec',    'audit',    'decree',    'depends_on'); // audit depends_on decree
const E_AUD_THR    = createEdge('e-aud-thr',    'audit',    'thresh',    'depends_on');
const E_TMPL_AUD   = createEdge('e-tmpl-aud',   'template', 'audit',     'references');
const E_TMPL_WF    = createEdge('e-tmpl-wf',    'template', 'workflow',  'used_by');
const E_WF_CHECK   = createEdge('e-wf-check',   'workflow', 'checklist', 'requires');

const ALL_EDGES = [E_IMPL, E_DEF, E_AUD_DEC, E_AUD_THR, E_TMPL_AUD, E_TMPL_WF, E_WF_CHECK];

const GRAPH  = buildKnowledgeGraph(ALL_NODES, ALL_EDGES);
const ENGINE = new GovernanceImpactEngine(GRAPH);

// ── GIE-01 classifyImpact — legal instrument types ───────────────────────────

describe('GIE-01 classifyImpact legal instruments', () => {
  it('GIE-01-01 LAW, RESOLUTION, DECREE, CIRCULAR, DECISION → Legal', () => {
    for (const type of ['LAW', 'RESOLUTION', 'DECREE', 'CIRCULAR', 'DECISION'] as const) {
      expect(classifyImpact(createNode('x', type, 'L'))).toBe('Legal');
    }
  });

  it('GIE-01-02 INTERNAL_REGULATION and GUIDELINE → Legal', () => {
    expect(classifyImpact(createNode('x', 'INTERNAL_REGULATION', 'L'))).toBe('Legal');
    expect(classifyImpact(createNode('x', 'GUIDELINE', 'L'))).toBe('Legal');
  });

  it('GIE-01-03 classifyImpact on an active DECREE node returns Legal', () => {
    expect(classifyImpact(N_DECREE)).toBe('Legal');
  });
});

// ── GIE-02 classifyImpact — operational artifact types ───────────────────────

describe('GIE-02 classifyImpact operational artifacts', () => {
  it('GIE-02-01 PROCUREMENT_THRESHOLD → Threshold', () => {
    expect(classifyImpact(N_THRESH)).toBe('Threshold');
  });

  it('GIE-02-02 WORKFLOW → Workflow, AUDIT_RULE → Audit, CHECKLIST → Checklist', () => {
    expect(classifyImpact(N_WORKFLOW)).toBe('Workflow');
    expect(classifyImpact(N_AUDIT)).toBe('Audit');
    expect(classifyImpact(N_CHECKLIST)).toBe('Checklist');
  });

  it('GIE-02-03 TEMPLATE → Template, PROMPT_RULE → Prompt', () => {
    expect(classifyImpact(N_TEMPLATE)).toBe('Template');
    expect(classifyImpact(N_PROMPT)).toBe('Prompt');
  });
});

// ── GIE-03 calculateSeverity — depth-based base scoring ──────────────────────

describe('GIE-03 calculateSeverity depth-based scoring', () => {
  it('GIE-03-01 depth 1 defines → High (base 3, no modifier)', () => {
    expect(calculateSeverity(1, 'defines')).toBe<ImpactSeverity>('High');
  });

  it('GIE-03-02 depth 2 defines → Medium (base 2, no modifier)', () => {
    expect(calculateSeverity(2, 'defines')).toBe<ImpactSeverity>('Medium');
  });

  it('GIE-03-03 depth 4 defines → Informational (base 0, no modifier)', () => {
    expect(calculateSeverity(4, 'defines')).toBe<ImpactSeverity>('Informational');
  });
});

// ── GIE-04 calculateSeverity — edge type and confidence modifiers ─────────────

describe('GIE-04 calculateSeverity modifiers', () => {
  it('GIE-04-01 depth 1 depends_on → Critical (base 3 +1 = 4)', () => {
    expect(calculateSeverity(1, 'depends_on')).toBe<ImpactSeverity>('Critical');
  });

  it('GIE-04-02 depth 1 references → Medium (base 3 −1 = 2)', () => {
    expect(calculateSeverity(1, 'references')).toBe<ImpactSeverity>('Medium');
  });

  it('GIE-04-03 depth 1 defines with confidence 0.5 → Medium (base 3 −1 = 2)', () => {
    expect(calculateSeverity(1, 'defines', 0.5)).toBe<ImpactSeverity>('Medium');
  });
});

// ── GIE-05 findAffectedNodes ──────────────────────────────────────────────────

describe('GIE-05 findAffectedNodes', () => {
  it('GIE-05-01 changing decree affects thresh, audit, template, workflow (4 nodes)', () => {
    const ids = ENGINE.findAffectedNodes('decree').map(n => n.id).sort();
    expect(ids).toEqual(['audit', 'template', 'thresh', 'workflow']);
  });

  it('GIE-05-02 decree itself is not in the affected set', () => {
    const ids = ENGINE.findAffectedNodes('decree').map(n => n.id);
    expect(ids).not.toContain('decree');
  });

  it('GIE-05-03 law and checklist are not impacted by changing decree', () => {
    // law: decree implements law, implements NOT FORWARD → not reached
    // checklist: workflow→checklist via requires, NOT FORWARD → not reached
    const ids = ENGINE.findAffectedNodes('decree').map(n => n.id);
    expect(ids).not.toContain('law');
    expect(ids).not.toContain('checklist');
  });
});

// ── GIE-06 findAffectedNodes — maxDepth constraint ───────────────────────────

describe('GIE-06 findAffectedNodes maxDepth', () => {
  it('GIE-06-01 maxDepth 1 returns only depth-1 nodes: thresh and audit', () => {
    const ids = ENGINE.findAffectedNodes('decree', { maxDepth: 1 }).map(n => n.id).sort();
    expect(ids).toEqual(['audit', 'thresh']);
  });

  it('GIE-06-02 maxDepth 2 adds template (depth 2) to the result', () => {
    const ids = ENGINE.findAffectedNodes('decree', { maxDepth: 2 }).map(n => n.id).sort();
    expect(ids).toEqual(['audit', 'template', 'thresh']);
  });

  it('GIE-06-03 maxDepth 0 returns no impacted nodes', () => {
    expect(ENGINE.findAffectedNodes('decree', { maxDepth: 0 })).toHaveLength(0);
  });
});

// ── GIE-07 findCriticalImpacts ────────────────────────────────────────────────

describe('GIE-07 findCriticalImpacts', () => {
  it('GIE-07-01 returns the Critical record for audit (depth 1 depends_on)', () => {
    const criticals = ENGINE.findCriticalImpacts('decree');
    expect(criticals.some(r => r.node.id === 'audit' && r.severity === 'Critical')).toBe(true);
  });

  it('GIE-07-02 includes High severity records: thresh (depth 1 defines)', () => {
    const criticals = ENGINE.findCriticalImpacts('decree');
    expect(criticals.some(r => r.node.id === 'thresh' && r.severity === 'High')).toBe(true);
  });

  it('GIE-07-03 excludes Low and Informational records: template and workflow', () => {
    const criticals = ENGINE.findCriticalImpacts('decree');
    expect(criticals.some(r => r.node.id === 'template')).toBe(false);
    expect(criticals.some(r => r.node.id === 'workflow')).toBe(false);
  });
});

// ── GIE-08 analyzeImpact — depth and severity ────────────────────────────────

describe('GIE-08 analyzeImpact depth and severity', () => {
  it('GIE-08-01 thresh and audit are at depth 1', () => {
    const records = ENGINE.analyzeImpact('decree');
    const depths  = Object.fromEntries(records.map(r => [r.node.id, r.depth]));
    expect(depths['thresh']).toBe(1);
    expect(depths['audit']).toBe(1);
  });

  it('GIE-08-02 template is at depth 2, workflow at depth 3', () => {
    const records = ENGINE.analyzeImpact('decree');
    const depths  = Object.fromEntries(records.map(r => [r.node.id, r.depth]));
    expect(depths['template']).toBe(2);
    expect(depths['workflow']).toBe(3);
  });

  it('GIE-08-03 ImpactRecord category and severity are consistent with depth and edge type', () => {
    const records  = ENGINE.analyzeImpact('decree');
    const byId     = Object.fromEntries(records.map(r => [r.node.id, r]));
    expect(byId['audit']!.severity).toBe('Critical');
    expect(byId['thresh']!.severity).toBe('High');
    expect(byId['template']!.severity).toBe('Low');
    expect(byId['workflow']!.severity).toBe('Informational');
  });
});

// ── GIE-09 analyzeImpact — dependency chain and path ─────────────────────────

describe('GIE-09 analyzeImpact dependency chain and path', () => {
  it('GIE-09-01 thresh.dependencyChain is [decree, thresh]', () => {
    const records = ENGINE.analyzeImpact('decree');
    const thresh  = records.find(r => r.node.id === 'thresh')!;
    expect(thresh.dependencyChain).toEqual(['decree', 'thresh']);
  });

  it('GIE-09-02 template.dependencyChain is [decree, audit, template]', () => {
    const records  = ENGINE.analyzeImpact('decree');
    const template = records.find(r => r.node.id === 'template')!;
    expect(template.dependencyChain).toEqual(['decree', 'audit', 'template']);
  });

  it('GIE-09-03 template.relationshipPath has length 2 (two edges traversed)', () => {
    const records  = ENGINE.analyzeImpact('decree');
    const template = records.find(r => r.node.id === 'template')!;
    expect(template.relationshipPath).toHaveLength(2);
    expect(template.relationshipPath[0]!.type).toBe('depends_on');
    expect(template.relationshipPath[1]!.type).toBe('references');
  });
});

// ── GIE-10 analyzeImpact — BFS vs DFS mode ───────────────────────────────────

describe('GIE-10 BFS vs DFS traversal mode', () => {
  it('GIE-10-01 BFS and DFS produce the same set of affected node IDs', () => {
    const bfsIds = ENGINE.analyzeImpact('decree', { traversalMode: 'bfs' })
      .map(r => r.node.id).sort();
    const dfsIds = ENGINE.analyzeImpact('decree', { traversalMode: 'dfs' })
      .map(r => r.node.id).sort();
    expect(bfsIds).toEqual(dfsIds);
  });

  it('GIE-10-02 BFS mode: first record is thresh (forward FORWARD edge, added before audit)', () => {
    const records = ENGINE.analyzeImpact('decree', { traversalMode: 'bfs' });
    expect(records[0]!.node.id).toBe('thresh');
  });

  it('GIE-10-03 DFS mode: first record is audit (stack LIFO pops reverse-edge last, processed first)', () => {
    const records = ENGINE.analyzeImpact('decree', { traversalMode: 'dfs' });
    expect(records[0]!.node.id).toBe('audit');
  });
});

// ── GIE-11 findPropagationPath ────────────────────────────────────────────────

describe('GIE-11 findPropagationPath', () => {
  it('GIE-11-01 decree → audit path is [decree, audit] (direct depends_on reverse)', () => {
    expect(ENGINE.findPropagationPath('decree', 'audit')).toEqual(['decree', 'audit']);
  });

  it('GIE-11-02 decree → workflow path is [decree, audit, template, workflow]', () => {
    expect(ENGINE.findPropagationPath('decree', 'workflow'))
      .toEqual(['decree', 'audit', 'template', 'workflow']);
  });

  it('GIE-11-03 decree → law returns [] (implements not in FORWARD_TYPES)', () => {
    expect(ENGINE.findPropagationPath('decree', 'law')).toEqual([]);
  });
});

// ── GIE-12 generateImpactReport ───────────────────────────────────────────────

describe('GIE-12 generateImpactReport', () => {
  it('GIE-12-01 report has correct counts: 4 impacts, 1 critical, 1 high', () => {
    const report = ENGINE.generateImpactReport('decree');
    expect(report.impacts).toHaveLength(4);
    expect(report.criticalCount).toBe(1);
    expect(report.highCount).toBe(1);
  });

  it('GIE-12-02 reviewOrder starts with audit (Critical) then thresh (High)', () => {
    const report = ENGINE.generateImpactReport('decree');
    expect(report.reviewOrder[0]).toBe('audit');
    expect(report.reviewOrder[1]).toBe('thresh');
  });

  it('GIE-12-03 report metadata is correct', () => {
    const report = ENGINE.generateImpactReport('decree');
    expect(report.sourceNodeId).toBe('decree');
    expect(report.sourceNode).toBe(N_DECREE);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── GIE-13 edge cases ─────────────────────────────────────────────────────────

describe('GIE-13 edge cases', () => {
  it('GIE-13-01 unknown nodeId returns empty impacts and empty affected list', () => {
    expect(ENGINE.analyzeImpact('ghost-id')).toHaveLength(0);
    expect(ENGINE.findAffectedNodes('ghost-id')).toHaveLength(0);
    expect(ENGINE.findPropagationPath('ghost-id', 'decree')).toEqual([]);
  });

  it('GIE-13-02 cycle-safe: does not throw or loop on a graph with circular impact edges', () => {
    // A defines B (FORWARD), B used_by A (FORWARD back — creates a cycle through both FORWARD edges)
    const nA = createNode('cyc-a', 'DECREE',   'A');
    const nB = createNode('cyc-b', 'TEMPLATE', 'B');
    // A→B (defines, FORWARD): A changes → B affected
    // B→A (used_by, FORWARD): B changes → A affected — forms a forward cycle
    // Wait: used_by is FORWARD which means we follow outEdge.to
    // So when B changes, we follow B→A (used_by), reaching A again — visited set stops it
    const eAB = createEdge('cyc-e1', 'cyc-a', 'cyc-b', 'defines');
    const eBA = createEdge('cyc-e2', 'cyc-b', 'cyc-a', 'used_by');
    const cycGraph  = buildKnowledgeGraph([nA, nB], [eAB, eBA]);
    const cycEngine = new GovernanceImpactEngine(cycGraph);
    expect(() => cycEngine.analyzeImpact('cyc-a')).not.toThrow();
    expect(cycEngine.findAffectedNodes('cyc-a').map(n => n.id)).toContain('cyc-b');
  });

  it('GIE-13-03 buildGovernanceImpactEngine factory returns a working engine', () => {
    const engine = buildGovernanceImpactEngine(GRAPH);
    expect(engine).toBeInstanceOf(GovernanceImpactEngine);
    expect(engine.findAffectedNodes('decree')).toHaveLength(4);
  });
});
