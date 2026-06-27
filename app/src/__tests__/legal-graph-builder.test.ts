/**
 * Phase 11.3 — Legal Graph Builder tests
 *
 * Groups (13 × 3 = 39):
 *   KGB-01  (3)  addNode accumulates nodes
 *   KGB-02  (3)  addEdge accumulates edges
 *   KGB-03  (3)  addNodes / addEdges bulk operations
 *   KGB-04  (3)  build() produces correct graph on valid input
 *   KGB-05  (3)  build() error: DUPLICATE_NODE_ID
 *   KGB-06  (3)  build() error: DUPLICATE_EDGE_ID
 *   KGB-07  (3)  build() error: BROKEN_EDGE_FROM
 *   KGB-08  (3)  build() error: BROKEN_EDGE_TO
 *   KGB-09  (3)  reset() clears accumulated state
 *   KGB-10  (3)  buildGraph() convenience factory
 *   KGB-11  (3)  nodeFromLegalDocument() mapping
 *   KGB-12  (3)  edgeFromSupersession() mapping
 *   KGB-13  (3)  edgeFromDefinition() mapping
 */

import { describe, it, expect } from 'vitest';
import {
  LegalGraphBuilder,
  buildGraph,
  nodeFromLegalDocument,
  edgeFromSupersession,
  edgeFromDefinition,
} from '../legal/legalGraphBuilder';
import { createNode, createEdge } from '../legal/knowledgeGraph';
import type { LegalDocument } from '../legal/legalRegistry';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const N_LAW      = createNode('law-01',       'LAW',                  'Luật Đấu thầu');
const N_DECREE   = createNode('decree-01',    'DECREE',               'Nghị định 214/2025');
const N_THRESH   = createNode('threshold-01', 'PROCUREMENT_THRESHOLD','Ngưỡng 200M');
const N_AUDIT    = createNode('audit-01',     'AUDIT_RULE',           'Quy tắc giá trị');

const E_IMPL     = createEdge('e-impl',    'decree-01',    'law-01',       'implements');
const E_DEF      = createEdge('e-def',     'decree-01',    'threshold-01', 'defines');
const E_DEPENDS  = createEdge('e-depends', 'audit-01',     'threshold-01', 'depends_on');

const LAW_DOC: LegalDocument = {
  id:            'luat-dau-thau-22-2023',
  symbol:        '22/2023/QH15',
  title:         'Luật Đấu thầu số 22/2023/QH15',
  type:          'LAW',
  issuer:        'Quốc hội',
  effectiveDate: '2024-01-01',
  status:        'ACTIVE',
  source:        'Công báo số 01/2024',
  priority:      1,
  tags:          ['đấu thầu'],
  summary:       'Luật quy định đấu thầu',
  confidence:    1.0,
};

const SUPERSEDED_DOC: LegalDocument = {
  id:            'nd-24-2024',
  symbol:        '24/2024/NĐ-CP',
  title:         'Nghị định 24/2024',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2024-03-15',
  expiredDate:   '2025-06-30',
  status:        'SUPERSEDED',
  supersededBy:  'nd-214-2025',
  source:        'Công báo',
  priority:      1,
  tags:          ['đấu thầu'],
  summary:       'Nghị định cũ',
  confidence:    0.9,
};

// ── KGB-01 addNode accumulates nodes ──────────────────────────────────────────

describe('KGB-01 addNode accumulates nodes', () => {
  it('KGB-01-01 build after addNode produces a graph with that node', () => {
    const result = new LegalGraphBuilder().addNode(N_LAW).build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.nodeIndex['law-01']).toBeDefined();
  });

  it('KGB-01-02 chained addNode calls accumulate all nodes', () => {
    const result = new LegalGraphBuilder()
      .addNode(N_LAW)
      .addNode(N_DECREE)
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.nodeCount).toBe(2);
  });

  it('KGB-01-03 addNode returns the builder for chaining', () => {
    const builder = new LegalGraphBuilder();
    expect(builder.addNode(N_LAW)).toBe(builder);
  });
});

// ── KGB-02 addEdge accumulates edges ──────────────────────────────────────────

describe('KGB-02 addEdge accumulates edges', () => {
  it('KGB-02-01 build after addEdge (and required nodes) produces graph with that edge', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .addEdge(E_IMPL)
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.edgeIndex['e-impl']).toBeDefined();
  });

  it('KGB-02-02 edge appears in outEdges and inEdges', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .addEdge(E_IMPL)
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.outEdges['decree-01']).toContain(E_IMPL);
    expect(result.graph.inEdges['law-01']).toContain(E_IMPL);
  });

  it('KGB-02-03 addEdge returns the builder for chaining', () => {
    const builder = new LegalGraphBuilder().addNodes([N_LAW, N_DECREE]);
    expect(builder.addEdge(E_IMPL)).toBe(builder);
  });
});

// ── KGB-03 addNodes / addEdges bulk ──────────────────────────────────────────

describe('KGB-03 addNodes / addEdges bulk', () => {
  it('KGB-03-01 addNodes adds all nodes in the array', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE, N_THRESH])
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.nodeCount).toBe(3);
  });

  it('KGB-03-02 addEdges adds all edges in the array', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE, N_THRESH, N_AUDIT])
      .addEdges([E_IMPL, E_DEF, E_DEPENDS])
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.edgeCount).toBe(3);
  });

  it('KGB-03-03 addNodes returns the builder for chaining', () => {
    const builder = new LegalGraphBuilder();
    expect(builder.addNodes([N_LAW])).toBe(builder);
  });
});

// ── KGB-04 build() produces correct graph ────────────────────────────────────

describe('KGB-04 build produces correct graph', () => {
  it('KGB-04-01 returns ok:true for a valid graph', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE, N_THRESH, N_AUDIT])
      .addEdges([E_IMPL, E_DEF, E_DEPENDS])
      .build();
    expect(result.ok).toBe(true);
  });

  it('KGB-04-02 graph nodeIndex is correct', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.nodeIndex['law-01']).toBe(N_LAW);
    expect(result.graph.nodeIndex['decree-01']).toBe(N_DECREE);
  });

  it('KGB-04-03 build() accepts an optional version string', () => {
    const result = new LegalGraphBuilder().addNode(N_LAW).build('2.0.0');
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.version).toBe('2.0.0');
  });
});

// ── KGB-05 build() error: DUPLICATE_NODE_ID ───────────────────────────────────

describe('KGB-05 DUPLICATE_NODE_ID error', () => {
  it('KGB-05-01 returns ok:false when two nodes share the same id', () => {
    const result = new LegalGraphBuilder().addNodes([N_LAW, N_LAW]).build();
    expect(result.ok).toBe(false);
  });

  it('KGB-05-02 error code is DUPLICATE_NODE_ID', () => {
    const result = new LegalGraphBuilder().addNodes([N_LAW, N_LAW]).build();
    if (result.ok) throw new Error('Expected error');
    expect(result.errors.some(e => e.code === 'DUPLICATE_NODE_ID')).toBe(true);
  });

  it('KGB-05-03 error id is the duplicate node id', () => {
    const result = new LegalGraphBuilder().addNodes([N_LAW, N_LAW]).build();
    if (result.ok) throw new Error('Expected error');
    const err = result.errors.find(e => e.code === 'DUPLICATE_NODE_ID')!;
    expect(err.id).toBe('law-01');
  });
});

// ── KGB-06 build() error: DUPLICATE_EDGE_ID ───────────────────────────────────

describe('KGB-06 DUPLICATE_EDGE_ID error', () => {
  it('KGB-06-01 returns ok:false when two edges share the same id', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .addEdges([E_IMPL, E_IMPL])
      .build();
    expect(result.ok).toBe(false);
  });

  it('KGB-06-02 error code is DUPLICATE_EDGE_ID', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .addEdges([E_IMPL, E_IMPL])
      .build();
    if (result.ok) throw new Error('Expected error');
    expect(result.errors.some(e => e.code === 'DUPLICATE_EDGE_ID')).toBe(true);
  });

  it('KGB-06-03 error id is the duplicate edge id', () => {
    const result = new LegalGraphBuilder()
      .addNodes([N_LAW, N_DECREE])
      .addEdges([E_IMPL, E_IMPL])
      .build();
    if (result.ok) throw new Error('Expected error');
    const err = result.errors.find(e => e.code === 'DUPLICATE_EDGE_ID')!;
    expect(err.id).toBe('e-impl');
  });
});

// ── KGB-07 build() error: BROKEN_EDGE_FROM ────────────────────────────────────

describe('KGB-07 BROKEN_EDGE_FROM error', () => {
  it('KGB-07-01 returns ok:false when edge.from references unknown node', () => {
    const bad = createEdge('bad-e', 'ghost-node', 'law-01', 'implements');
    const result = new LegalGraphBuilder().addNode(N_LAW).addEdge(bad).build();
    expect(result.ok).toBe(false);
  });

  it('KGB-07-02 error code is BROKEN_EDGE_FROM', () => {
    const bad = createEdge('bad-e', 'ghost-node', 'law-01', 'implements');
    const result = new LegalGraphBuilder().addNode(N_LAW).addEdge(bad).build();
    if (result.ok) throw new Error('Expected error');
    expect(result.errors.some(e => e.code === 'BROKEN_EDGE_FROM')).toBe(true);
  });

  it('KGB-07-03 error message contains the unknown node id', () => {
    const bad = createEdge('bad-e', 'ghost-node', 'law-01', 'implements');
    const result = new LegalGraphBuilder().addNode(N_LAW).addEdge(bad).build();
    if (result.ok) throw new Error('Expected error');
    const err = result.errors.find(e => e.code === 'BROKEN_EDGE_FROM')!;
    expect(err.message).toContain('ghost-node');
  });
});

// ── KGB-08 build() error: BROKEN_EDGE_TO ─────────────────────────────────────

describe('KGB-08 BROKEN_EDGE_TO error', () => {
  it('KGB-08-01 returns ok:false when edge.to references unknown node', () => {
    const bad = createEdge('bad-e', 'decree-01', 'ghost-target', 'defines');
    const result = new LegalGraphBuilder().addNode(N_DECREE).addEdge(bad).build();
    expect(result.ok).toBe(false);
  });

  it('KGB-08-02 error code is BROKEN_EDGE_TO', () => {
    const bad = createEdge('bad-e', 'decree-01', 'ghost-target', 'defines');
    const result = new LegalGraphBuilder().addNode(N_DECREE).addEdge(bad).build();
    if (result.ok) throw new Error('Expected error');
    expect(result.errors.some(e => e.code === 'BROKEN_EDGE_TO')).toBe(true);
  });

  it('KGB-08-03 error message contains the unknown target id', () => {
    const bad = createEdge('bad-e', 'decree-01', 'ghost-target', 'defines');
    const result = new LegalGraphBuilder().addNode(N_DECREE).addEdge(bad).build();
    if (result.ok) throw new Error('Expected error');
    const err = result.errors.find(e => e.code === 'BROKEN_EDGE_TO')!;
    expect(err.message).toContain('ghost-target');
  });
});

// ── KGB-09 reset() ────────────────────────────────────────────────────────────

describe('KGB-09 reset', () => {
  it('KGB-09-01 reset clears accumulated nodes', () => {
    const builder = new LegalGraphBuilder().addNode(N_LAW);
    builder.reset();
    const result = builder.build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.nodeCount).toBe(0);
  });

  it('KGB-09-02 reset returns the builder for chaining', () => {
    const builder = new LegalGraphBuilder();
    expect(builder.reset()).toBe(builder);
  });

  it('KGB-09-03 builder can be reused after reset', () => {
    const builder = new LegalGraphBuilder().addNode(N_LAW);
    builder.reset().addNode(N_DECREE);
    const result = builder.build();
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.nodeIndex['decree-01']).toBeDefined();
    expect(result.graph.nodeIndex['law-01']).toBeUndefined();
  });
});

// ── KGB-10 buildGraph() factory ───────────────────────────────────────────────

describe('KGB-10 buildGraph factory', () => {
  it('KGB-10-01 buildGraph returns ok:true for valid input', () => {
    expect(buildGraph([N_LAW, N_DECREE], [E_IMPL]).ok).toBe(true);
  });

  it('KGB-10-02 buildGraph returns ok:false for duplicate node id', () => {
    expect(buildGraph([N_LAW, N_LAW], []).ok).toBe(false);
  });

  it('KGB-10-03 buildGraph result graph has correct nodeCount', () => {
    const result = buildGraph([N_LAW, N_DECREE, N_THRESH], []);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.graph.metadata.nodeCount).toBe(3);
  });
});

// ── KGB-11 nodeFromLegalDocument() ────────────────────────────────────────────

describe('KGB-11 nodeFromLegalDocument', () => {
  it('KGB-11-01 id, type, and label are mapped correctly', () => {
    const node = nodeFromLegalDocument(LAW_DOC);
    expect(node.id).toBe('luat-dau-thau-22-2023');
    expect(node.type).toBe('LAW');
    expect(node.label).toBe('Luật Đấu thầu số 22/2023/QH15');
  });

  it('KGB-11-02 ACTIVE status maps to ACTIVE', () => {
    expect(nodeFromLegalDocument(LAW_DOC).status).toBe('ACTIVE');
  });

  it('KGB-11-03 SUPERSEDED status maps to INACTIVE, symbol stored in metadata', () => {
    const node = nodeFromLegalDocument(SUPERSEDED_DOC);
    expect(node.status).toBe('INACTIVE');
    expect(node.metadata['symbol']).toBe('24/2024/NĐ-CP');
  });
});

// ── KGB-12 edgeFromSupersession() ─────────────────────────────────────────────

describe('KGB-12 edgeFromSupersession', () => {
  it('KGB-12-01 returns a supersedes edge with from=doc.id and to=doc.supersededBy', () => {
    const edge = edgeFromSupersession(SUPERSEDED_DOC);
    expect(edge).toBeDefined();
    expect(edge!.from).toBe('nd-24-2024');
    expect(edge!.to).toBe('nd-214-2025');
    expect(edge!.type).toBe('supersedes');
  });

  it('KGB-12-02 returns undefined for a doc without supersededBy', () => {
    expect(edgeFromSupersession(LAW_DOC)).toBeUndefined();
  });

  it('KGB-12-03 edge id encodes both document ids', () => {
    const edge = edgeFromSupersession(SUPERSEDED_DOC)!;
    expect(edge.id).toContain('nd-24-2024');
    expect(edge.id).toContain('nd-214-2025');
  });
});

// ── KGB-13 edgeFromDefinition() ───────────────────────────────────────────────

describe('KGB-13 edgeFromDefinition', () => {
  it('KGB-13-01 creates a defines edge by default', () => {
    const edge = edgeFromDefinition('decree-01', 'threshold-01');
    expect(edge.type).toBe('defines');
    expect(edge.from).toBe('decree-01');
    expect(edge.to).toBe('threshold-01');
  });

  it('KGB-13-02 accepts a custom edge type', () => {
    const edge = edgeFromDefinition('decree-01', 'threshold-01', 'derived_from');
    expect(edge.type).toBe('derived_from');
  });

  it('KGB-13-03 edge id encodes both node ids and the type', () => {
    const edge = edgeFromDefinition('decree-01', 'threshold-01');
    expect(edge.id).toContain('decree-01');
    expect(edge.id).toContain('threshold-01');
  });
});
