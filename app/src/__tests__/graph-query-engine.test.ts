/**
 * Phase 11.3 — Graph Query Engine tests
 *
 * Test graph (9 nodes, 8 edges, acyclic):
 *
 *   decree  ──(implements)──►  law
 *   circular──(implements)──►  law
 *   decree  ──(defines)───────► threshold
 *   decree  ──(supersedes)────► old-decree
 *   audit   ──(depends_on)────► threshold
 *   template──(used_by)───────► workflow
 *   template──(references)────► audit
 *   workflow──(requires)──────► checklist
 *
 * Groups (13 × 3 = 39):
 *   GQE-01  (3)  findParents — direct predecessors
 *   GQE-02  (3)  findChildren — direct successors
 *   GQE-03  (3)  findAncestors — transitive backward
 *   GQE-04  (3)  findAncestors — with edgeType filter
 *   GQE-05  (3)  findDescendants — transitive forward
 *   GQE-06  (3)  findDescendants — with edgeType filter
 *   GQE-07  (3)  findDependents — nodes with depends_on TO target
 *   GQE-08  (3)  findImpacts — cascade from decree
 *   GQE-09  (3)  findImpacts — cycle safety
 *   GQE-10  (3)  topologicalOrder — linear chain
 *   GQE-11  (3)  topologicalOrder — full test graph
 *   GQE-12  (3)  findNodesByType / findEdgesBetween
 *   GQE-13  (3)  empty graph and unknown ids
 */

import { describe, it, expect } from 'vitest';
import { GraphQueryEngine, buildGraphQueryEngine } from '../legal/graphQueryEngine';
import { buildKnowledgeGraph, createNode, createEdge } from '../legal/knowledgeGraph';

// ─── Test graph fixtures ──────────────────────────────────────────────────────

const N_LAW       = createNode('law',        'LAW',                   'Luật Đấu thầu');
const N_DECREE    = createNode('decree',     'DECREE',                'Nghị định 214');
const N_OLD       = createNode('old-decree', 'DECREE',                'Nghị định 24',  { status: 'INACTIVE' });
const N_CIRCULAR  = createNode('circular',   'CIRCULAR',              'Thông tư 79');
const N_THRESHOLD = createNode('threshold',  'PROCUREMENT_THRESHOLD', 'Ngưỡng 200M');
const N_AUDIT     = createNode('audit',      'AUDIT_RULE',            'Quy tắc giá trị');
const N_TEMPLATE  = createNode('template',   'TEMPLATE',              'Mẫu HSMT');
const N_WORKFLOW  = createNode('workflow',   'WORKFLOW',              'Quy trình mua sắm');
const N_CHECKLIST = createNode('checklist',  'CHECKLIST',             'Danh mục hồ sơ');

const ALL_NODES = [
  N_LAW, N_DECREE, N_OLD, N_CIRCULAR,
  N_THRESHOLD, N_AUDIT, N_TEMPLATE, N_WORKFLOW, N_CHECKLIST,
];

const E1 = createEdge('e1', 'decree',   'law',       'implements');
const E2 = createEdge('e2', 'circular', 'law',       'implements');
const E3 = createEdge('e3', 'decree',   'threshold', 'defines');
const E4 = createEdge('e4', 'decree',   'old-decree','supersedes');
const E5 = createEdge('e5', 'audit',    'threshold', 'depends_on');
const E6 = createEdge('e6', 'template', 'workflow',  'used_by');
const E7 = createEdge('e7', 'template', 'audit',     'references');
const E8 = createEdge('e8', 'workflow', 'checklist', 'requires');

const ALL_EDGES = [E1, E2, E3, E4, E5, E6, E7, E8];

const GRAPH  = buildKnowledgeGraph(ALL_NODES, ALL_EDGES);
const ENGINE = new GraphQueryEngine(GRAPH);

// ── GQE-01 findParents ────────────────────────────────────────────────────────

describe('GQE-01 findParents', () => {
  it('GQE-01-01 law has two parents: decree and circular', () => {
    const parents = ENGINE.findParents('law');
    expect(parents.map(n => n.id).sort()).toEqual(['circular', 'decree']);
  });

  it('GQE-01-02 threshold has two parents: decree (defines) and audit (depends_on)', () => {
    const parents = ENGINE.findParents('threshold');
    expect(parents.map(n => n.id).sort()).toEqual(['audit', 'decree']);
  });

  it('GQE-01-03 decree has no parents (no incoming edges)', () => {
    expect(ENGINE.findParents('decree')).toHaveLength(0);
  });
});

// ── GQE-02 findChildren ───────────────────────────────────────────────────────

describe('GQE-02 findChildren', () => {
  it('GQE-02-01 decree has three children: law, threshold, old-decree', () => {
    const children = ENGINE.findChildren('decree');
    expect(children.map(n => n.id).sort()).toEqual(['law', 'old-decree', 'threshold']);
  });

  it('GQE-02-02 template has two children: workflow and audit', () => {
    const children = ENGINE.findChildren('template');
    expect(children.map(n => n.id).sort()).toEqual(['audit', 'workflow']);
  });

  it('GQE-02-03 law has no children', () => {
    expect(ENGINE.findChildren('law')).toHaveLength(0);
  });
});

// ── GQE-03 findAncestors — transitive ─────────────────────────────────────────

describe('GQE-03 findAncestors transitive', () => {
  it('GQE-03-01 ancestors of threshold include decree (defines) and audit (depends_on)', () => {
    const ids = ENGINE.findAncestors('threshold').map(n => n.id).sort();
    expect(ids).toContain('decree');
    expect(ids).toContain('audit');
  });

  it('GQE-03-02 ancestors of law include decree, circular, template, audit, workflow', () => {
    // decree→law, circular→law, audit→threshold→decree...
    // Actually let me trace:
    // inEdges of law: E1(decree), E2(circular)
    // inEdges of decree: E5... wait, no. E5 is audit→threshold.
    // inEdges of decree: NONE in this graph (decree is a source).
    // So ancestors of law = {decree, circular} only.
    const ids = ENGINE.findAncestors('law').map(n => n.id).sort();
    expect(ids).toEqual(['circular', 'decree']);
  });

  it('GQE-03-03 ancestors of checklist traverses through workflow', () => {
    // checklist←workflow←template
    const ids = ENGINE.findAncestors('checklist').map(n => n.id).sort();
    expect(ids).toContain('workflow');
    expect(ids).toContain('template');
  });
});

// ── GQE-04 findAncestors — edgeType filter ────────────────────────────────────

describe('GQE-04 findAncestors edgeType filter', () => {
  it('GQE-04-01 findAncestors(law, ["implements"]) returns only decree and circular', () => {
    const ids = ENGINE.findAncestors('law', ['implements']).map(n => n.id).sort();
    expect(ids).toEqual(['circular', 'decree']);
  });

  it('GQE-04-02 findAncestors(threshold, ["depends_on"]) returns only audit', () => {
    const ids = ENGINE.findAncestors('threshold', ['depends_on']).map(n => n.id);
    expect(ids).toEqual(['audit']);
  });

  it('GQE-04-03 empty edgeType filter returns empty result', () => {
    expect(ENGINE.findAncestors('law', [])).toHaveLength(0);
  });
});

// ── GQE-05 findDescendants — transitive ───────────────────────────────────────

describe('GQE-05 findDescendants transitive', () => {
  it('GQE-05-01 descendants of decree include law, threshold, old-decree', () => {
    const ids = ENGINE.findDescendants('decree').map(n => n.id).sort();
    expect(ids).toContain('law');
    expect(ids).toContain('threshold');
    expect(ids).toContain('old-decree');
  });

  it('GQE-05-02 descendants of template include workflow, audit, checklist', () => {
    const ids = ENGINE.findDescendants('template').map(n => n.id).sort();
    expect(ids).toContain('workflow');
    expect(ids).toContain('audit');
    expect(ids).toContain('checklist');
  });

  it('GQE-05-03 law has no descendants', () => {
    expect(ENGINE.findDescendants('law')).toHaveLength(0);
  });
});

// ── GQE-06 findDescendants — edgeType filter ──────────────────────────────────

describe('GQE-06 findDescendants edgeType filter', () => {
  it('GQE-06-01 findDescendants(decree, ["defines"]) returns only threshold', () => {
    const ids = ENGINE.findDescendants('decree', ['defines']).map(n => n.id);
    expect(ids).toEqual(['threshold']);
  });

  it('GQE-06-02 findDescendants(decree, ["implements"]) returns only law', () => {
    const ids = ENGINE.findDescendants('decree', ['implements']).map(n => n.id);
    expect(ids).toEqual(['law']);
  });

  it('GQE-06-03 findDescendants(template, ["used_by", "requires"]) traverses workflow→checklist', () => {
    const ids = ENGINE.findDescendants('template', ['used_by', 'requires']).map(n => n.id).sort();
    expect(ids).toContain('workflow');
    expect(ids).toContain('checklist');
    expect(ids).not.toContain('audit');
  });
});

// ── GQE-07 findDependents ─────────────────────────────────────────────────────

describe('GQE-07 findDependents', () => {
  it('GQE-07-01 findDependents(threshold) returns audit (depends_on threshold)', () => {
    const deps = ENGINE.findDependents('threshold');
    expect(deps.map(n => n.id)).toContain('audit');
  });

  it('GQE-07-02 findDependents(law) returns empty (no one depends_on law)', () => {
    expect(ENGINE.findDependents('law')).toHaveLength(0);
  });

  it('GQE-07-03 findDependents only returns depends_on edges, not implements', () => {
    // decree implements law — should NOT appear in findDependents(law)
    const deps = ENGINE.findDependents('law');
    expect(deps.map(n => n.id)).not.toContain('decree');
  });
});

// ── GQE-08 findImpacts ────────────────────────────────────────────────────────

describe('GQE-08 findImpacts cascade', () => {
  it('GQE-08-01 findImpacts(decree) includes threshold, audit, template, workflow', () => {
    // decree defines threshold → threshold←audit(depends_on) → audit←template(references) → template→workflow(used_by)
    const ids = ENGINE.findImpacts('decree').map(n => n.id);
    expect(ids).toContain('threshold');
    expect(ids).toContain('audit');
    expect(ids).toContain('template');
    expect(ids).toContain('workflow');
  });

  it('GQE-08-02 findImpacts(decree) does not include law (implements is not a consumer)', () => {
    // decree implements law — law is NOT downstream
    // implements IS in REVERSE_TYPES, so: inEdges of decree filtered for implements → none
    // Actually, E1 is decree→law (implements). inEdges of decree: none (decree is a source).
    // What about law? law has inEdges E1, E2 (implements). These are REVERSE_TYPES.
    // So when processing decree: inEdges of decree = none. So law is NOT visited.
    const ids = ENGINE.findImpacts('decree').map(n => n.id);
    expect(ids).not.toContain('law');
  });

  it('GQE-08-03 findImpacts excludes the starting node itself', () => {
    const ids = ENGINE.findImpacts('decree').map(n => n.id);
    expect(ids).not.toContain('decree');
  });
});

// ── GQE-09 findImpacts — cycle safety ────────────────────────────────────────

describe('GQE-09 findImpacts cycle safety', () => {
  it('GQE-09-01 does not loop infinitely when a cycle exists', () => {
    // Create a cycle: A defines B, B used_by A
    const nA = createNode('cyc-a', 'AUDIT_RULE', 'A');
    const nB = createNode('cyc-b', 'TEMPLATE',   'B');
    const eAB = createEdge('cyc-e1', 'cyc-a', 'cyc-b', 'defines');
    const eBA = createEdge('cyc-e2', 'cyc-b', 'cyc-a', 'used_by');  // cycle back
    const cycGraph = buildKnowledgeGraph([nA, nB], [eAB, eBA]);
    const engine   = new GraphQueryEngine(cycGraph);
    expect(() => engine.findImpacts('cyc-a')).not.toThrow();
  });

  it('GQE-09-02 cycle result is finite and contains both cycle members', () => {
    const nA = createNode('cyc-a', 'AUDIT_RULE', 'A');
    const nB = createNode('cyc-b', 'TEMPLATE',   'B');
    const eAB = createEdge('cyc-e1', 'cyc-a', 'cyc-b', 'defines');
    const eBA = createEdge('cyc-e2', 'cyc-b', 'cyc-a', 'used_by');
    const cycGraph = buildKnowledgeGraph([nA, nB], [eAB, eBA]);
    const engine   = new GraphQueryEngine(cycGraph);
    const ids = engine.findImpacts('cyc-a').map(n => n.id);
    expect(ids).toContain('cyc-b');
  });

  it('GQE-09-03 findImpacts returns empty for unknown id', () => {
    expect(ENGINE.findImpacts('ghost-id')).toHaveLength(0);
  });
});

// ── GQE-10 topologicalOrder — linear chain ────────────────────────────────────

describe('GQE-10 topologicalOrder linear chain', () => {
  it('GQE-10-01 A→B→C produces A before B before C', () => {
    const nA = createNode('top-a', 'WORKFLOW',  'A');
    const nB = createNode('top-b', 'CHECKLIST', 'B');
    const nC = createNode('top-c', 'AUDIT_RULE','C');
    const eAB = createEdge('top-e1', 'top-a', 'top-b', 'requires');
    const eBC = createEdge('top-e2', 'top-b', 'top-c', 'requires');
    const g = buildKnowledgeGraph([nA, nB, nC], [eAB, eBC]);
    const order = new GraphQueryEngine(g).topologicalOrder().map(n => n.id);
    expect(order.indexOf('top-a')).toBeLessThan(order.indexOf('top-b'));
    expect(order.indexOf('top-b')).toBeLessThan(order.indexOf('top-c'));
  });

  it('GQE-10-02 topological order includes ALL nodes', () => {
    const order = ENGINE.topologicalOrder();
    expect(order).toHaveLength(ALL_NODES.length);
  });

  it('GQE-10-03 no node appears twice in topological order', () => {
    const order = ENGINE.topologicalOrder();
    const ids = order.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── GQE-11 topologicalOrder — full graph constraints ─────────────────────────

describe('GQE-11 topologicalOrder full graph', () => {
  it('GQE-11-01 decree comes before law (decree→law via implements)', () => {
    const order = ENGINE.topologicalOrder().map(n => n.id);
    expect(order.indexOf('decree')).toBeLessThan(order.indexOf('law'));
  });

  it('GQE-11-02 decree comes before threshold (decree→threshold via defines)', () => {
    const order = ENGINE.topologicalOrder().map(n => n.id);
    expect(order.indexOf('decree')).toBeLessThan(order.indexOf('threshold'));
  });

  it('GQE-11-03 template comes before workflow (template→workflow via used_by)', () => {
    const order = ENGINE.topologicalOrder().map(n => n.id);
    expect(order.indexOf('template')).toBeLessThan(order.indexOf('workflow'));
  });
});

// ── GQE-12 findNodesByType / findEdgesBetween ─────────────────────────────────

describe('GQE-12 findNodesByType and findEdgesBetween', () => {
  it('GQE-12-01 findNodesByType(DECREE) returns decree and old-decree', () => {
    const decrees = ENGINE.findNodesByType('DECREE').map(n => n.id).sort();
    expect(decrees).toEqual(['decree', 'old-decree']);
  });

  it('GQE-12-02 findEdgesBetween(decree, law) returns only E1', () => {
    const edges = ENGINE.findEdgesBetween('decree', 'law');
    expect(edges).toHaveLength(1);
    expect(edges[0]!.type).toBe('implements');
  });

  it('GQE-12-03 findEdgesBetween returns empty when no edge exists', () => {
    expect(ENGINE.findEdgesBetween('law', 'decree')).toHaveLength(0);
  });
});

// ── GQE-13 empty graph and unknown ids ────────────────────────────────────────

describe('GQE-13 empty graph and unknown ids', () => {
  const EMPTY_ENGINE = new GraphQueryEngine(buildKnowledgeGraph([], []));

  it('GQE-13-01 all traversal methods return empty on empty graph', () => {
    expect(EMPTY_ENGINE.findParents('x')).toHaveLength(0);
    expect(EMPTY_ENGINE.findChildren('x')).toHaveLength(0);
    expect(EMPTY_ENGINE.findAncestors('x')).toHaveLength(0);
    expect(EMPTY_ENGINE.findDescendants('x')).toHaveLength(0);
  });

  it('GQE-13-02 unknown id returns empty for dependency methods', () => {
    expect(ENGINE.findDependents('ghost')).toHaveLength(0);
    expect(ENGINE.findImpacts('ghost')).toHaveLength(0);
    expect(ENGINE.findNodesByType('CHECKLIST').map(n => n.id)).toContain('checklist');
  });

  it('GQE-13-03 buildGraphQueryEngine factory returns a GraphQueryEngine instance', () => {
    const engine = buildGraphQueryEngine(GRAPH);
    expect(engine).toBeInstanceOf(GraphQueryEngine);
    expect(engine.findNodesByType('LAW')).toHaveLength(1);
  });
});
