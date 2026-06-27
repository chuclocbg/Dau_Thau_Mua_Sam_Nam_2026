/**
 * Phase 11.3 — Knowledge Graph Core tests
 *
 * Groups (13 × 3 = 39):
 *   KG-01  (3)  NODE_TYPES constants
 *   KG-02  (3)  EDGE_TYPES constants
 *   KG-03  (3)  isNodeType / isEdgeType / isNodeStatus guards
 *   KG-04  (3)  createNode — required fields and defaults
 *   KG-05  (3)  createNode — optional fields
 *   KG-06  (3)  createEdge — required fields and defaults
 *   KG-07  (3)  createEdge — optional fields
 *   KG-08  (3)  buildKnowledgeGraph — nodeIndex
 *   KG-09  (3)  buildKnowledgeGraph — edgeIndex
 *   KG-10  (3)  buildKnowledgeGraph — outEdges adjacency
 *   KG-11  (3)  buildKnowledgeGraph — inEdges adjacency
 *   KG-12  (3)  buildKnowledgeGraph — metadata (counts and type sets)
 *   KG-13  (3)  buildKnowledgeGraph — empty graph
 */

import { describe, it, expect } from 'vitest';
import {
  NODE_TYPES,
  EDGE_TYPES,
  NODE_STATUSES,
  isNodeType,
  isEdgeType,
  isNodeStatus,
  createNode,
  createEdge,
  buildKnowledgeGraph,
} from '../legal/knowledgeGraph';
import type { GraphNode, GraphEdge } from '../legal/knowledgeGraph';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW_NODE: GraphNode = createNode('law-01', 'LAW', 'Luật Đấu thầu 22/2023');
const DECREE_NODE: GraphNode = createNode('decree-01', 'DECREE', 'Nghị định 214/2025', {
  status: 'ACTIVE',
  sourceId: 'nd-214-2025',
  effectiveDate: '2025-07-01',
  metadata: { symbol: '214/2025/NĐ-CP' },
});
const THRESHOLD_NODE: GraphNode = createNode('threshold-01', 'PROCUREMENT_THRESHOLD', 'Ngưỡng 200M');

const EDGE_IMPL: GraphEdge  = createEdge('e-impl',  'decree-01', 'law-01',       'implements');
const EDGE_DEF:  GraphEdge  = createEdge('e-def',   'decree-01', 'threshold-01', 'defines');

// ── KG-01 NODE_TYPES constants ─────────────────────────────────────────────────

describe('KG-01 NODE_TYPES constants', () => {
  it('KG-01-01 NODE_TYPES contains 13 entries', () => {
    expect(NODE_TYPES).toHaveLength(13);
  });

  it('KG-01-02 NODE_TYPES contains all legal instrument types', () => {
    const legal = ['LAW', 'RESOLUTION', 'DECREE', 'CIRCULAR', 'DECISION', 'INTERNAL_REGULATION', 'GUIDELINE'];
    for (const t of legal) expect(NODE_TYPES).toContain(t);
  });

  it('KG-01-03 NODE_TYPES contains all operational artifact types', () => {
    const ops = ['PROCUREMENT_THRESHOLD', 'WORKFLOW', 'AUDIT_RULE', 'TEMPLATE', 'PROMPT_RULE', 'CHECKLIST'];
    for (const t of ops) expect(NODE_TYPES).toContain(t);
  });
});

// ── KG-02 EDGE_TYPES constants ─────────────────────────────────────────────────

describe('KG-02 EDGE_TYPES constants', () => {
  it('KG-02-01 EDGE_TYPES contains 8 entries', () => {
    expect(EDGE_TYPES).toHaveLength(8);
  });

  it('KG-02-02 EDGE_TYPES contains all dependency relationship types', () => {
    const types = ['implements', 'defines', 'supersedes', 'depends_on', 'used_by', 'requires', 'references', 'derived_from'];
    for (const t of types) expect(EDGE_TYPES).toContain(t);
  });

  it('KG-02-03 NODE_STATUSES contains exactly 4 values', () => {
    expect(NODE_STATUSES).toHaveLength(4);
    expect(NODE_STATUSES).toContain('ACTIVE');
    expect(NODE_STATUSES).toContain('DEPRECATED');
  });
});

// ── KG-03 type guards ─────────────────────────────────────────────────────────

describe('KG-03 type guards', () => {
  it('KG-03-01 isNodeType accepts valid values and rejects unknown strings', () => {
    expect(isNodeType('LAW')).toBe(true);
    expect(isNodeType('CHECKLIST')).toBe(true);
    expect(isNodeType('ORDINANCE')).toBe(false);
    expect(isNodeType(null)).toBe(false);
  });

  it('KG-03-02 isEdgeType accepts valid values and rejects unknown strings', () => {
    expect(isEdgeType('implements')).toBe(true);
    expect(isEdgeType('derived_from')).toBe(true);
    expect(isEdgeType('IMPLEMENTS')).toBe(false); // case-sensitive
    expect(isEdgeType(42)).toBe(false);
  });

  it('KG-03-03 isNodeStatus accepts valid values and rejects unknown strings', () => {
    expect(isNodeStatus('ACTIVE')).toBe(true);
    expect(isNodeStatus('DEPRECATED')).toBe(true);
    expect(isNodeStatus('PENDING')).toBe(false);
    expect(isNodeStatus(undefined)).toBe(false);
  });
});

// ── KG-04 createNode — required fields and defaults ───────────────────────────

describe('KG-04 createNode required fields', () => {
  it('KG-04-01 creates a node with the provided id, type, and label', () => {
    const n = createNode('n1', 'WORKFLOW', 'Quy trình A');
    expect(n.id).toBe('n1');
    expect(n.type).toBe('WORKFLOW');
    expect(n.label).toBe('Quy trình A');
  });

  it('KG-04-02 default status is ACTIVE', () => {
    expect(createNode('n1', 'LAW', 'Test').status).toBe('ACTIVE');
  });

  it('KG-04-03 default metadata is an empty frozen object', () => {
    const n = createNode('n1', 'CHECKLIST', 'Test');
    expect(Object.keys(n.metadata)).toHaveLength(0);
    expect(() => { (n.metadata as Record<string, string>)['x'] = 'y'; }).toThrow();
  });
});

// ── KG-05 createNode — optional fields ───────────────────────────────────────

describe('KG-05 createNode optional fields', () => {
  it('KG-05-01 accepts custom status', () => {
    expect(createNode('n', 'DECREE', 'L', { status: 'DRAFT' }).status).toBe('DRAFT');
  });

  it('KG-05-02 accepts sourceId, effectiveDate, version', () => {
    const n = createNode('n', 'CIRCULAR', 'C', {
      sourceId: 'tt-79-2025',
      effectiveDate: '2025-07-01',
      version: '1.0.0',
    });
    expect(n.sourceId).toBe('tt-79-2025');
    expect(n.effectiveDate).toBe('2025-07-01');
    expect(n.version).toBe('1.0.0');
  });

  it('KG-05-03 accepts metadata key-value pairs', () => {
    const n = createNode('n', 'LAW', 'L', { metadata: { symbol: '22/2023/QH15' } });
    expect(n.metadata['symbol']).toBe('22/2023/QH15');
  });
});

// ── KG-06 createEdge — required fields and defaults ──────────────────────────

describe('KG-06 createEdge required fields', () => {
  it('KG-06-01 creates an edge with id, from, to, type', () => {
    const e = createEdge('e1', 'a', 'b', 'depends_on');
    expect(e.id).toBe('e1');
    expect(e.from).toBe('a');
    expect(e.to).toBe('b');
    expect(e.type).toBe('depends_on');
  });

  it('KG-06-02 weight is undefined by default', () => {
    expect(createEdge('e', 'a', 'b', 'references').weight).toBeUndefined();
  });

  it('KG-06-03 default metadata is an empty frozen object', () => {
    const e = createEdge('e', 'a', 'b', 'requires');
    expect(Object.keys(e.metadata)).toHaveLength(0);
  });
});

// ── KG-07 createEdge — optional fields ───────────────────────────────────────

describe('KG-07 createEdge optional fields', () => {
  it('KG-07-01 accepts weight', () => {
    expect(createEdge('e', 'a', 'b', 'implements', { weight: 0.9 }).weight).toBe(0.9);
  });

  it('KG-07-02 accepts metadata', () => {
    const e = createEdge('e', 'a', 'b', 'supersedes', { metadata: { reason: 'amendment' } });
    expect(e.metadata['reason']).toBe('amendment');
  });

  it('KG-07-03 metadata is frozen', () => {
    const e = createEdge('e', 'a', 'b', 'defines', { metadata: { k: 'v' } });
    expect(() => { (e.metadata as Record<string, string>)['x'] = 'y'; }).toThrow();
  });
});

// ── KG-08 buildKnowledgeGraph — nodeIndex ─────────────────────────────────────

describe('KG-08 buildKnowledgeGraph nodeIndex', () => {
  it('KG-08-01 nodeIndex[id] returns the correct node', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE], []);
    expect(g.nodeIndex['law-01']).toBe(LAW_NODE);
    expect(g.nodeIndex['decree-01']).toBe(DECREE_NODE);
  });

  it('KG-08-02 nodeIndex does not contain unknown ids', () => {
    const g = buildKnowledgeGraph([LAW_NODE], []);
    expect(g.nodeIndex['ghost']).toBeUndefined();
  });

  it('KG-08-03 nodeIndex is frozen', () => {
    const g = buildKnowledgeGraph([LAW_NODE], []);
    expect(() => { (g.nodeIndex as Record<string, GraphNode>)['x'] = LAW_NODE; }).toThrow();
  });
});

// ── KG-09 buildKnowledgeGraph — edgeIndex ─────────────────────────────────────

describe('KG-09 buildKnowledgeGraph edgeIndex', () => {
  it('KG-09-01 edgeIndex[id] returns the correct edge', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.edgeIndex['e-impl']).toBe(EDGE_IMPL);
    expect(g.edgeIndex['e-def']).toBe(EDGE_DEF);
  });

  it('KG-09-02 edgeIndex does not contain unknown edge ids', () => {
    const g = buildKnowledgeGraph([LAW_NODE], []);
    expect(g.edgeIndex['ghost-edge']).toBeUndefined();
  });

  it('KG-09-03 edgeIndex length equals edge count', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(Object.keys(g.edgeIndex)).toHaveLength(2);
  });
});

// ── KG-10 buildKnowledgeGraph — outEdges ──────────────────────────────────────

describe('KG-10 buildKnowledgeGraph outEdges', () => {
  it('KG-10-01 outEdges[decree-01] contains EDGE_IMPL and EDGE_DEF', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.outEdges['decree-01']).toHaveLength(2);
    expect(g.outEdges['decree-01']).toContain(EDGE_IMPL);
    expect(g.outEdges['decree-01']).toContain(EDGE_DEF);
  });

  it('KG-10-02 outEdges[law-01] is empty (law has no outgoing edges)', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE], [EDGE_IMPL]);
    expect(g.outEdges['law-01']).toHaveLength(0);
  });

  it('KG-10-03 outEdges array is frozen', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE], [EDGE_IMPL]);
    expect(() => { (g.outEdges['decree-01'] as GraphEdge[]).push(EDGE_DEF); }).toThrow();
  });
});

// ── KG-11 buildKnowledgeGraph — inEdges ───────────────────────────────────────

describe('KG-11 buildKnowledgeGraph inEdges', () => {
  it('KG-11-01 inEdges[law-01] contains EDGE_IMPL', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.inEdges['law-01']).toContain(EDGE_IMPL);
  });

  it('KG-11-02 inEdges[threshold-01] contains EDGE_DEF', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.inEdges['threshold-01']).toContain(EDGE_DEF);
  });

  it('KG-11-03 inEdges[decree-01] is empty (decree has no incoming edges)', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE], [EDGE_IMPL]);
    expect(g.inEdges['decree-01']).toHaveLength(0);
  });
});

// ── KG-12 buildKnowledgeGraph — metadata ──────────────────────────────────────

describe('KG-12 buildKnowledgeGraph metadata', () => {
  it('KG-12-01 metadata.nodeCount and edgeCount are correct', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.metadata.nodeCount).toBe(3);
    expect(g.metadata.edgeCount).toBe(2);
  });

  it('KG-12-02 metadata.nodeTypes lists unique types present', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], []);
    expect(g.metadata.nodeTypes).toContain('LAW');
    expect(g.metadata.nodeTypes).toContain('DECREE');
    expect(g.metadata.nodeTypes).toContain('PROCUREMENT_THRESHOLD');
    expect(g.metadata.nodeTypes).not.toContain('WORKFLOW');
  });

  it('KG-12-03 metadata.edgeTypes lists unique edge types present', () => {
    const g = buildKnowledgeGraph([LAW_NODE, DECREE_NODE, THRESHOLD_NODE], [EDGE_IMPL, EDGE_DEF]);
    expect(g.metadata.edgeTypes).toContain('implements');
    expect(g.metadata.edgeTypes).toContain('defines');
    expect(g.metadata.edgeTypes).not.toContain('supersedes');
  });
});

// ── KG-13 buildKnowledgeGraph — empty graph ───────────────────────────────────

describe('KG-13 buildKnowledgeGraph empty graph', () => {
  it('KG-13-01 empty graph has zero nodeCount and edgeCount', () => {
    const g = buildKnowledgeGraph([], []);
    expect(g.metadata.nodeCount).toBe(0);
    expect(g.metadata.edgeCount).toBe(0);
  });

  it('KG-13-02 empty graph has empty nodeIndex', () => {
    expect(Object.keys(buildKnowledgeGraph([], []).nodeIndex)).toHaveLength(0);
  });

  it('KG-13-03 empty graph default version is "1.0.0"', () => {
    expect(buildKnowledgeGraph([], []).metadata.version).toBe('1.0.0');
  });
});
