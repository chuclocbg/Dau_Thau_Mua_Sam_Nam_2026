import { describe, it, expect, vi } from 'vitest';
import {
  ImpactAnalyzer,
  analyzeFromGraph,
} from '../agents/ImpactAnalyzer';
import { KnowledgeGraphBuilder } from '../agents/KnowledgeGraphBuilder';
import type { SnapshotStatus }   from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

function domainNode(id: string) {
  return { id, type: 'DOMAIN' as const };
}
function regNode(url: string) {
  return { id: url, type: 'REGULATION' as const };
}

function synGraph(opts: {
  status?:     SnapshotStatus;
  domains?:    readonly string[];
  regUrls?:    readonly string[];
  nodeCount?:  number;
  edgeCount?:  number;
  targetDate?: string;
}) {
  const status     = opts.status     ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const domains    = status === 'READY' ? (opts.domains ?? []) : [];
  const regUrls    = status === 'READY' ? (opts.regUrls ?? []) : [];
  const nodes      = [
    ...domains.map(domainNode),
    ...regUrls.map(regNode),
  ];
  return {
    status,
    nodes,
    metadata: {
      nodeCount:   opts.nodeCount ?? nodes.length,
      edgeCount:   opts.edgeCount ?? regUrls.length,
      targetDate,
    },
  };
}

function stubGraph(opts: Parameters<typeof synGraph>[0]) {
  return vi.fn().mockReturnValue(synGraph(opts));
}

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── IA-01 READY path ───────────────────────────────────────────────────────────
describe('IA-01 READY path', () => {
  it('IA-01-01: forward real → status=READY, impactedDomains.length=4', () => {
    const r = new ImpactAnalyzer().analyze(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.impactedDomains).toHaveLength(4);
  });

  it('IA-01-02: synthetic READY with 1 domain → impactScope="NARROW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING'] }));
    expect(r.impactScope).toBe('NARROW');
  });

  it('IA-01-03: READY result has status, impactedDomains, impactScope, impactLevel, metadata', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR'] }));
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('impactedDomains');
    expect(r).toHaveProperty('impactScope');
    expect(r).toHaveProperty('impactLevel');
    expect(r).toHaveProperty('metadata');
  });
});

// ── IA-02 PENDING_APPROVAL ────────────────────────────────────────────────────
describe('IA-02 PENDING_APPROVAL', () => {
  it('IA-02-01: PENDING_APPROVAL → impactedDomains=[], impactScope="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ status: 'PENDING_APPROVAL', domains: ['BIDDING'] }));
    expect(r.impactedDomains).toHaveLength(0);
    expect(r.impactScope).toBe('NONE');
  });

  it('IA-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = analyzeFromGraph(synGraph({ status: 'PENDING_APPROVAL' }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('IA-02-03: PENDING_APPROVAL impactLevel="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ status: 'PENDING_APPROVAL' }));
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── IA-03 UNCHANGED ───────────────────────────────────────────────────────────
describe('IA-03 UNCHANGED', () => {
  it('IA-03-01: same25 real → impactedDomains=[], impactScope="NONE"', () => {
    const r = new ImpactAnalyzer().analyze(SAME.last, SAME.cur);
    expect(r.impactedDomains).toHaveLength(0);
    expect(r.impactScope).toBe('NONE');
  });

  it('IA-03-02: UNCHANGED status forwarded', () => {
    const r = new ImpactAnalyzer().analyze(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('IA-03-03: UNCHANGED impactLevel="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ status: 'UNCHANGED' }));
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── IA-04 domain extraction ───────────────────────────────────────────────────
describe('IA-04 domain extraction', () => {
  it('IA-04-01: impactedDomains = ids of DOMAIN-type nodes', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.impactedDomains).toEqual(['BIDDING', 'FINANCIAL']);
  });

  it('IA-04-02: REGULATION nodes not included in impactedDomains', () => {
    const g = synGraph({ domains: ['HR'], regUrls: ['https://moha.gov.vn'] });
    const r = analyzeFromGraph(g);
    expect(r.impactedDomains).not.toContain('https://moha.gov.vn');
    expect(r.impactedDomains).toEqual(['HR']);
  });

  it('IA-04-03: single DOMAIN node → impactedDomains=["BIDDING"]', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING'] }));
    expect(r.impactedDomains).toEqual(['BIDDING']);
  });
});

// ── IA-05 order preservation ──────────────────────────────────────────────────
describe('IA-05 order preservation', () => {
  it('IA-05-01: forward real → impactedDomains[0]="GENERAL"', () => {
    const r = new ImpactAnalyzer().analyze(FWD.last, FWD.cur);
    expect(r.impactedDomains[0]).toBe('GENERAL');
  });

  it('IA-05-02: synthetic [HR, BIDDING] order preserved → ["HR", "BIDDING"]', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR', 'BIDDING'] }));
    expect(r.impactedDomains).toEqual(['HR', 'BIDDING']);
  });

  it('IA-05-03: [BIDDING, GENERAL] order preserved — not sorted alphabetically', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING', 'GENERAL'] }));
    expect(r.impactedDomains[0]).toBe('BIDDING');
    expect(r.impactedDomains[1]).toBe('GENERAL');
  });
});

// ── IA-06 NONE scope ──────────────────────────────────────────────────────────
describe('IA-06 NONE scope', () => {
  it('IA-06-01: 0 domains → impactScope="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ domains: [] }));
    expect(r.impactScope).toBe('NONE');
  });

  it('IA-06-02: UNCHANGED status → impactScope="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ status: 'UNCHANGED' }));
    expect(r.impactScope).toBe('NONE');
  });

  it('IA-06-03: NONE scope → impactLevel="NONE"', () => {
    const r = analyzeFromGraph(synGraph({ domains: [] }));
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── IA-07 NARROW scope ───────────────────────────────────────────────────────
describe('IA-07 NARROW scope', () => {
  it('IA-07-01: exactly 1 non-GENERAL domain → impactScope="NARROW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING'] }));
    expect(r.impactScope).toBe('NARROW');
  });

  it('IA-07-02: 1 domain "FINANCIAL" → impactScope="NARROW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['FINANCIAL'] }));
    expect(r.impactScope).toBe('NARROW');
  });

  it('IA-07-03: 1 domain "HR" → impactScope="NARROW" not "BROAD"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR'] }));
    expect(r.impactScope).toBe('NARROW');
    expect(r.impactScope).not.toBe('BROAD');
  });
});

// ── IA-08 BROAD scope ────────────────────────────────────────────────────────
describe('IA-08 BROAD scope', () => {
  it('IA-08-01: 2 domains → impactScope="BROAD"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.impactScope).toBe('BROAD');
  });

  it('IA-08-02: 3 domains → impactScope="BROAD"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    expect(r.impactScope).toBe('BROAD');
  });

  it('IA-08-03: forward real 4 domains → impactScope="BROAD"', () => {
    const r = new ImpactAnalyzer().analyze(FWD.last, FWD.cur);
    expect(r.impactScope).toBe('BROAD');
  });
});

// ── IA-09 LOW level ───────────────────────────────────────────────────────────
describe('IA-09 LOW level', () => {
  it('IA-09-01: NARROW scope, no GENERAL → impactLevel="LOW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING'] }));
    expect(r.impactLevel).toBe('LOW');
  });

  it('IA-09-02: 1 domain "FINANCIAL" → impactLevel="LOW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['FINANCIAL'] }));
    expect(r.impactLevel).toBe('LOW');
  });

  it('IA-09-03: 1 domain "HR" → impactLevel="LOW"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR'] }));
    expect(r.impactLevel).toBe('LOW');
  });
});

// ── IA-10 HIGH level ──────────────────────────────────────────────────────────
describe('IA-10 HIGH level', () => {
  it('IA-10-01: 2 non-GENERAL domains → impactLevel="HIGH"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.impactLevel).toBe('HIGH');
  });

  it('IA-10-02: BROAD scope without GENERAL → impactLevel="HIGH"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR', 'BIDDING', 'FINANCIAL'] }));
    expect(r.impactLevel).toBe('HIGH');
  });

  it('IA-10-03: domains=["HR","BIDDING"] → impactLevel="HIGH"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR', 'BIDDING'] }));
    expect(r.impactLevel).toBe('HIGH');
  });
});

// ── IA-11 GENERAL escalation ──────────────────────────────────────────────────
describe('IA-11 GENERAL escalation', () => {
  it('IA-11-01: GENERAL among BROAD domains → impactLevel="CRITICAL"', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['GENERAL', 'BIDDING', 'FINANCIAL'] }));
    expect(r.impactLevel).toBe('CRITICAL');
  });

  it('IA-11-02: forward real (GENERAL present) → impactLevel="CRITICAL"', () => {
    const r = new ImpactAnalyzer().analyze(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('CRITICAL');
  });

  it('IA-11-03: single "GENERAL" domain → CRITICAL (overrides NARROW→LOW)', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['GENERAL'] }));
    expect(r.impactScope).toBe('NARROW');
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── IA-12 metadata forwarding ─────────────────────────────────────────────────
describe('IA-12 metadata forwarding', () => {
  it('IA-12-01: metadata.domainCount = impactedDomains.length', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.metadata.domainCount).toBe(r.impactedDomains.length);
  });

  it('IA-12-02: metadata.nodeCount forwarded from graph.metadata.nodeCount', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['HR'], nodeCount: 7 }));
    expect(r.metadata.nodeCount).toBe(7);
  });

  it('IA-12-03: metadata.targetDate forwarded from graph.metadata.targetDate', () => {
    const r = analyzeFromGraph(synGraph({ domains: ['BIDDING'], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });
});

// ── IA-13 single graph call ───────────────────────────────────────────────────
describe('IA-13 single graph call', () => {
  it('IA-13-01: build() called exactly once per analyze() call', () => {
    const spy = stubGraph({ status: 'UNCHANGED', targetDate: SAME.cur });
    const analyzer = new ImpactAnalyzer({ build: spy } as unknown as KnowledgeGraphBuilder);
    analyzer.analyze(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('IA-13-02: build() called with correct date args', () => {
    const spy = stubGraph({ domains: ['GENERAL', 'HR', 'BIDDING', 'FINANCIAL'], targetDate: FWD.cur, nodeCount: 8, edgeCount: 4 });
    const analyzer = new ImpactAnalyzer({ build: spy } as unknown as KnowledgeGraphBuilder);
    analyzer.analyze(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('IA-13-03: two analyze() calls → build() called twice', () => {
    const spy = stubGraph({ status: 'UNCHANGED', targetDate: SAME.cur });
    const analyzer = new ImpactAnalyzer({ build: spy } as unknown as KnowledgeGraphBuilder);
    analyzer.analyze(SAME.last, SAME.cur);
    analyzer.analyze(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
