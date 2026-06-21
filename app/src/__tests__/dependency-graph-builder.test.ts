import { describe, it, expect, vi } from 'vitest';
import {
  DependencyGraphBuilder,
  buildFromImpact,
} from '../agents/DependencyGraphBuilder';
import { ImpactAnalyzer }    from '../agents/ImpactAnalyzer';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

function computeScope(n: number): ImpactScope {
  if (n === 0) return 'NONE';
  if (n === 1) return 'NARROW';
  return 'BROAD';
}

function computeLevel(scope: ImpactScope, domains: readonly string[]): ImpactLevel {
  if (scope === 'NONE') return 'NONE';
  if (domains.includes('GENERAL')) return 'CRITICAL';
  if (scope === 'NARROW') return 'LOW';
  return 'HIGH';
}

function synImpact(opts: {
  status?:      SnapshotStatus;
  domains?:     readonly string[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
}) {
  const status      = opts.status     ?? 'READY';
  const domains     = status === 'READY' ? (opts.domains ?? []) : [];
  const scope       = opts.impactScope ?? computeScope(domains.length);
  const level       = opts.impactLevel ?? computeLevel(scope, domains);
  const targetDate  = opts.targetDate  ?? '2026-01-01';
  return {
    status,
    impactedDomains: domains,
    impactScope:     scope,
    impactLevel:     level,
    metadata:        { domainCount: domains.length, nodeCount: 0, edgeCount: 0, targetDate },
  };
}

function stubAnalyzer(opts: Parameters<typeof synImpact>[0]) {
  return vi.fn().mockReturnValue(synImpact(opts));
}

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── DG-01 READY ───────────────────────────────────────────────────────────────
describe('DG-01 READY', () => {
  it('DG-01-01: forward real → status=READY, nodes.length=4', () => {
    const r = new DependencyGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.nodes).toHaveLength(4);
  });

  it('DG-01-02: READY result has status, impactScope, impactLevel, nodes, edges, metadata', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING'] }));
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('impactScope');
    expect(r).toHaveProperty('impactLevel');
    expect(r).toHaveProperty('nodes');
    expect(r).toHaveProperty('edges');
    expect(r).toHaveProperty('metadata');
  });

  it('DG-01-03: forward real → impactScope="BROAD", impactLevel="CRITICAL"', () => {
    const r = new DependencyGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.impactScope).toBe('BROAD');
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── DG-02 PENDING_APPROVAL ────────────────────────────────────────────────────
describe('DG-02 PENDING_APPROVAL', () => {
  it('DG-02-01: PENDING_APPROVAL → nodes=[], edges=[]', () => {
    const r = buildFromImpact(synImpact({ status: 'PENDING_APPROVAL', domains: ['BIDDING'] }));
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });

  it('DG-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = buildFromImpact(synImpact({ status: 'PENDING_APPROVAL' }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('DG-02-03: PENDING_APPROVAL → impactScope="NONE", impactLevel="NONE"', () => {
    const r = buildFromImpact(synImpact({ status: 'PENDING_APPROVAL' }));
    expect(r.impactScope).toBe('NONE');
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── DG-03 UNCHANGED ───────────────────────────────────────────────────────────
describe('DG-03 UNCHANGED', () => {
  it('DG-03-01: same25 real → nodes=[], edges=[]', () => {
    const r = new DependencyGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });

  it('DG-03-02: UNCHANGED status forwarded', () => {
    const r = new DependencyGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('DG-03-03: UNCHANGED → impactScope="NONE", impactLevel="NONE"', () => {
    const r = buildFromImpact(synImpact({ status: 'UNCHANGED' }));
    expect(r.impactScope).toBe('NONE');
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── DG-04 node order ──────────────────────────────────────────────────────────
describe('DG-04 node order', () => {
  it('DG-04-01: forward real → nodes[0].id="GENERAL" (impactedDomains order)', () => {
    const r = new DependencyGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.nodes[0].id).toBe('GENERAL');
  });

  it('DG-04-02: synthetic ["HR","BIDDING"] → nodes[0].id="HR", nodes[1].id="BIDDING"', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING'] }));
    expect(r.nodes[0].id).toBe('HR');
    expect(r.nodes[1].id).toBe('BIDDING');
  });

  it('DG-04-03: all nodes have type="DOMAIN"', () => {
    const r = buildFromImpact(synImpact({ domains: ['GENERAL', 'HR', 'BIDDING'] }));
    r.nodes.forEach(n => expect(n.type).toBe('DOMAIN'));
  });
});

// ── DG-05 NONE scope ──────────────────────────────────────────────────────────
describe('DG-05 NONE scope', () => {
  it('DG-05-01: 0 domains → nodes=[]', () => {
    const r = buildFromImpact(synImpact({ domains: [] }));
    expect(r.nodes).toHaveLength(0);
  });

  it('DG-05-02: 0 domains → edges=[]', () => {
    const r = buildFromImpact(synImpact({ domains: [] }));
    expect(r.edges).toHaveLength(0);
  });

  it('DG-05-03: NONE scope → edgeCount=0', () => {
    const r = buildFromImpact(synImpact({ domains: [] }));
    expect(r.metadata.edgeCount).toBe(0);
  });
});

// ── DG-06 NARROW scope ────────────────────────────────────────────────────────
describe('DG-06 NARROW scope', () => {
  it('DG-06-01: 1 domain → nodes.length=1', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING'] }));
    expect(r.nodes).toHaveLength(1);
  });

  it('DG-06-02: 1 domain → edges.length=1', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING'] }));
    expect(r.edges).toHaveLength(1);
  });

  it('DG-06-03: NARROW → single edge from=id, to=id (self-loop)', () => {
    const r = buildFromImpact(synImpact({ domains: ['FINANCIAL'] }));
    const edge = r.edges[0];
    expect(edge.from).toBe('FINANCIAL');
    expect(edge.to).toBe('FINANCIAL');
  });
});

// ── DG-07 SELF edge ───────────────────────────────────────────────────────────
describe('DG-07 SELF edge', () => {
  it('DG-07-01: NARROW scope edge type="SELF"', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING'] }));
    expect(r.edges[0].type).toBe('SELF');
  });

  it('DG-07-02: SELF edge from = domain id', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR'] }));
    expect(r.edges[0].from).toBe('HR');
  });

  it('DG-07-03: SELF edge from === to', () => {
    const r = buildFromImpact(synImpact({ domains: ['FINANCIAL'] }));
    expect(r.edges[0].from).toBe(r.edges[0].to);
  });
});

// ── DG-08 BROAD graph ─────────────────────────────────────────────────────────
describe('DG-08 BROAD graph', () => {
  it('DG-08-01: 2 domains → 2 CROSS edges (A→B, B→A)', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.edges).toHaveLength(2);
    expect(r.edges.every(e => e.type === 'CROSS')).toBe(true);
  });

  it('DG-08-02: 3 domains → 6 CROSS edges (n*(n-1))', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    expect(r.edges).toHaveLength(6);
  });

  it('DG-08-03: forward real 4 domains → 12 CROSS edges', () => {
    const r = new DependencyGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.edges).toHaveLength(12);
    expect(r.edges.every(e => e.type === 'CROSS')).toBe(true);
  });
});

// ── DG-09 edge count ──────────────────────────────────────────────────────────
describe('DG-09 edge count', () => {
  it('DG-09-01: metadata.edgeCount = edges.length', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING'] }));
    expect(r.metadata.edgeCount).toBe(r.edges.length);
  });

  it('DG-09-02: NARROW → edgeCount=1', () => {
    const r = buildFromImpact(synImpact({ domains: ['FINANCIAL'] }));
    expect(r.metadata.edgeCount).toBe(1);
  });

  it('DG-09-03: BROAD with 3 domains → edgeCount=6 (n*(n-1))', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    expect(r.metadata.edgeCount).toBe(6);
  });
});

// ── DG-10 duplicate protection ────────────────────────────────────────────────
describe('DG-10 duplicate protection', () => {
  it('DG-10-01: BROAD graph has no duplicate edges', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    const keys = r.edges.map(e => `${e.from}→${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('DG-10-02: BROAD+CRITICAL+GENERAL — escalation adds 0 duplicate edges', () => {
    const r = buildFromImpact(synImpact({ domains: ['GENERAL', 'BIDDING', 'FINANCIAL'] }));
    // BROAD normal: 6 edges; escalation tries GENERAL→BIDDING & GENERAL→FINANCIAL (already exist)
    expect(r.edges).toHaveLength(6);
  });

  it('DG-10-03: NARROW+GENERAL (CRITICAL) → only 1 SELF edge, escalation adds 0', () => {
    const r = buildFromImpact(synImpact({ domains: ['GENERAL'] }));
    // 1 domain → NARROW → 1 SELF edge; escalation: no other nodes → 0 extra
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].type).toBe('SELF');
  });
});

// ── DG-11 GENERAL escalation ──────────────────────────────────────────────────
describe('DG-11 GENERAL escalation', () => {
  it('DG-11-01: CRITICAL+[GENERAL,BIDDING] → GENERAL→BIDDING edge present', () => {
    const r = buildFromImpact(synImpact({ domains: ['GENERAL', 'BIDDING'] }));
    const edge = r.edges.find(e => e.from === 'GENERAL' && e.to === 'BIDDING');
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('CROSS');
  });

  it('DG-11-02: HIGH level (no GENERAL) — no GENERAL-sourced escalation edges', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING'], impactLevel: 'HIGH' }));
    expect(r.edges.some(e => e.from === 'GENERAL')).toBe(false);
  });

  it('DG-11-03: CRITICAL+[GENERAL,HR,BIDDING] → total edges = 6 (no extras)', () => {
    const r = buildFromImpact(synImpact({ domains: ['GENERAL', 'HR', 'BIDDING'] }));
    expect(r.impactLevel).toBe('CRITICAL');
    expect(r.edges).toHaveLength(6);
  });
});

// ── DG-12 metadata forwarding ─────────────────────────────────────────────────
describe('DG-12 metadata forwarding', () => {
  it('DG-12-01: metadata.domainCount = nodes.length', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING'] }));
    expect(r.metadata.domainCount).toBe(r.nodes.length);
  });

  it('DG-12-02: metadata.edgeCount = edges.length', () => {
    const r = buildFromImpact(synImpact({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    expect(r.metadata.edgeCount).toBe(r.edges.length);
  });

  it('DG-12-03: metadata.targetDate forwarded from impact.metadata.targetDate', () => {
    const r = buildFromImpact(synImpact({ domains: ['BIDDING'], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });
});

// ── DG-13 single analyze call ─────────────────────────────────────────────────
describe('DG-13 single analyze call', () => {
  it('DG-13-01: analyze() called exactly once per build() call', () => {
    const spy = stubAnalyzer({ status: 'UNCHANGED', targetDate: SAME.cur });
    const builder = new DependencyGraphBuilder({ analyze: spy } as unknown as ImpactAnalyzer);
    builder.build(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('DG-13-02: analyze() called with correct date args', () => {
    const spy = stubAnalyzer({ domains: ['GENERAL', 'HR', 'BIDDING', 'FINANCIAL'], targetDate: FWD.cur });
    const builder = new DependencyGraphBuilder({ analyze: spy } as unknown as ImpactAnalyzer);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('DG-13-03: two build() calls → analyze() called twice', () => {
    const spy = stubAnalyzer({ status: 'UNCHANGED', targetDate: SAME.cur });
    const builder = new DependencyGraphBuilder({ analyze: spy } as unknown as ImpactAnalyzer);
    builder.build(SAME.last, SAME.cur);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
