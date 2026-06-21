import { describe, it, expect, vi } from 'vitest';
import {
  TemplateDependencyResolver,
  resolveFromDependency,
} from '../agents/TemplateDependencyResolver';
import { DependencyGraphBuilder }       from '../agents/DependencyGraphBuilder';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

function scopeFor(n: number): ImpactScope {
  if (n === 0) return 'NONE';
  if (n === 1) return 'NARROW';
  return 'BROAD';
}

function levelFor(scope: ImpactScope, domains: readonly string[]): ImpactLevel {
  if (scope === 'NONE') return 'NONE';
  if (domains.includes('GENERAL')) return 'CRITICAL';
  if (scope === 'NARROW') return 'LOW';
  return 'HIGH';
}

function synDep(opts: {
  status?:      SnapshotStatus;
  domains?:     readonly string[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
}) {
  const status     = opts.status     ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const domains    = status === 'READY' ? (opts.domains ?? []) : [];
  const scope      = opts.impactScope ?? scopeFor(domains.length);
  const level      = opts.impactLevel ?? levelFor(scope, domains);

  const nodes = domains.map(d => ({ id: d, type: 'DOMAIN' as const }));

  const edges: { from: string; to: string; type: string }[] = [];
  if (scope === 'NARROW' && domains.length > 0) {
    edges.push({ from: domains[0], to: domains[0], type: 'SELF' });
  } else if (scope === 'BROAD') {
    for (const from of domains) {
      for (const to of domains) {
        if (from !== to) edges.push({ from, to, type: 'CROSS' });
      }
    }
  }

  return {
    status, impactScope: scope, impactLevel: level, nodes, edges,
    metadata: { domainCount: domains.length, edgeCount: edges.length, targetDate },
  };
}

function stubDepGraph(opts: Parameters<typeof synDep>[0]) {
  return vi.fn().mockReturnValue(synDep(opts));
}

// Known registry counts
const GEN_COUNT  = 3; // TO_TRINH, QUYET_DINH, BIEN_BAN
const HR_COUNT   = 1; // PHAN_CONG_NHIEM_VU
const BID_COUNT  = 4; // KHLCNT, HSYC, HSMT, BAO_CAO_DANH_GIA
const FIN_COUNT  = 2; // DU_TOAN, THAM_DINH_GIA
const ALL_COUNT  = GEN_COUNT + HR_COUNT + BID_COUNT + FIN_COUNT; // 10

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── TD-01 READY ───────────────────────────────────────────────────────────────
describe('TD-01 READY', () => {
  it('TD-01-01: forward real → status=READY, templates.length=10', () => {
    const r = new TemplateDependencyResolver().resolve(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.templates).toHaveLength(ALL_COUNT);
  });

  it('TD-01-02: synthetic READY with BIDDING only → 4 templates', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    expect(r.templates).toHaveLength(BID_COUNT);
  });

  it('TD-01-03: READY result has status, impactScope, impactLevel, templates, templateEdges, metadata', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('impactScope');
    expect(r).toHaveProperty('impactLevel');
    expect(r).toHaveProperty('templates');
    expect(r).toHaveProperty('templateEdges');
    expect(r).toHaveProperty('metadata');
  });
});

// ── TD-02 PENDING_APPROVAL ────────────────────────────────────────────────────
describe('TD-02 PENDING_APPROVAL', () => {
  it('TD-02-01: PENDING_APPROVAL → templates=[], templateEdges=[]', () => {
    const r = resolveFromDependency(synDep({ status: 'PENDING_APPROVAL', domains: ['BIDDING'] }));
    expect(r.templates).toHaveLength(0);
    expect(r.templateEdges).toHaveLength(0);
  });

  it('TD-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = resolveFromDependency(synDep({ status: 'PENDING_APPROVAL' }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('TD-02-03: impactScope and impactLevel forwarded from dep', () => {
    const r = resolveFromDependency(synDep({ status: 'PENDING_APPROVAL' }));
    expect(r.impactScope).toBe('NONE');
    expect(r.impactLevel).toBe('NONE');
  });
});

// ── TD-03 UNCHANGED ───────────────────────────────────────────────────────────
describe('TD-03 UNCHANGED', () => {
  it('TD-03-01: same25 real → templates=[], templateEdges=[]', () => {
    const r = new TemplateDependencyResolver().resolve(SAME.last, SAME.cur);
    expect(r.templates).toHaveLength(0);
    expect(r.templateEdges).toHaveLength(0);
  });

  it('TD-03-02: UNCHANGED status forwarded', () => {
    const r = new TemplateDependencyResolver().resolve(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('TD-03-03: synthetic UNCHANGED → templateCount=0, edgeCount=0', () => {
    const r = resolveFromDependency(synDep({ status: 'UNCHANGED' }));
    expect(r.metadata.templateCount).toBe(0);
    expect(r.metadata.edgeCount).toBe(0);
  });
});

// ── TD-04 GENERAL registry ────────────────────────────────────────────────────
describe('TD-04 GENERAL registry', () => {
  it('TD-04-01: GENERAL domain → 3 templates', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL'] }));
    expect(r.templates).toHaveLength(GEN_COUNT);
  });

  it('TD-04-02: first GENERAL template id = "TO_TRINH"', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL'] }));
    expect(r.templates[0].id).toBe('TO_TRINH');
  });

  it('TD-04-03: GENERAL templates include QUYET_DINH and BIEN_BAN', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL'] }));
    const ids = r.templates.map(t => t.id);
    expect(ids).toContain('QUYET_DINH');
    expect(ids).toContain('BIEN_BAN');
  });
});

// ── TD-05 BIDDING registry ────────────────────────────────────────────────────
describe('TD-05 BIDDING registry', () => {
  it('TD-05-01: BIDDING domain → 4 templates', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    expect(r.templates).toHaveLength(BID_COUNT);
  });

  it('TD-05-02: BIDDING templates include KHLCNT, HSYC, HSMT, BAO_CAO_DANH_GIA', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    const ids = r.templates.map(t => t.id);
    expect(ids).toContain('KHLCNT');
    expect(ids).toContain('HSYC');
    expect(ids).toContain('HSMT');
    expect(ids).toContain('BAO_CAO_DANH_GIA');
  });

  it('TD-05-03: first BIDDING template id = "KHLCNT"', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    expect(r.templates[0].id).toBe('KHLCNT');
  });
});

// ── TD-06 FINANCE registry (FINANCIAL domain) ─────────────────────────────────
describe('TD-06 FINANCE registry', () => {
  it('TD-06-01: FINANCIAL domain → 2 templates', () => {
    const r = resolveFromDependency(synDep({ domains: ['FINANCIAL'] }));
    expect(r.templates).toHaveLength(FIN_COUNT);
  });

  it('TD-06-02: FINANCIAL templates include DU_TOAN and THAM_DINH_GIA', () => {
    const r = resolveFromDependency(synDep({ domains: ['FINANCIAL'] }));
    const ids = r.templates.map(t => t.id);
    expect(ids).toContain('DU_TOAN');
    expect(ids).toContain('THAM_DINH_GIA');
  });

  it('TD-06-03: first FINANCIAL template id = "DU_TOAN"', () => {
    const r = resolveFromDependency(synDep({ domains: ['FINANCIAL'] }));
    expect(r.templates[0].id).toBe('DU_TOAN');
  });
});

// ── TD-07 node ordering ───────────────────────────────────────────────────────
describe('TD-07 node ordering', () => {
  it('TD-07-01: forward real → templates[0].domain="GENERAL" (first domain)', () => {
    const r = new TemplateDependencyResolver().resolve(FWD.last, FWD.cur);
    expect(r.templates[0].domain).toBe('GENERAL');
  });

  it('TD-07-02: GENERAL templates precede BIDDING templates in node list', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL', 'BIDDING'] }));
    const genIdx = r.templates.findIndex(t => t.domain === 'GENERAL');
    const bidIdx = r.templates.findIndex(t => t.domain === 'BIDDING');
    expect(genIdx).toBeLessThan(bidIdx);
  });

  it('TD-07-03: within BIDDING, "KHLCNT" precedes "HSMT"', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    const ids = r.templates.map(t => t.id);
    expect(ids.indexOf('KHLCNT')).toBeLessThan(ids.indexOf('HSMT'));
  });
});

// ── TD-08 SELF edges ──────────────────────────────────────────────────────────
describe('TD-08 SELF edges', () => {
  it('TD-08-01: SELF edges count = templates.length', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    const selfEdges = r.templateEdges.filter(e => e.type === 'SELF');
    expect(selfEdges).toHaveLength(r.templates.length);
  });

  it('TD-08-02: SELF edge from === to', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL'] }));
    r.templateEdges.filter(e => e.type === 'SELF').forEach(e => {
      expect(e.from).toBe(e.to);
    });
  });

  it('TD-08-03: every template has exactly one SELF edge', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    for (const t of r.templates) {
      const selfCount = r.templateEdges.filter(e => e.type === 'SELF' && e.from === t.id).length;
      expect(selfCount).toBe(1);
    }
  });
});

// ── TD-09 domain edges ────────────────────────────────────────────────────────
describe('TD-09 domain edges', () => {
  it('TD-09-01: DOMAIN template edges have type="DOMAIN"', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL', 'BIDDING'] }));
    r.templateEdges.filter(e => e.type === 'DOMAIN').forEach(e => {
      expect(e.type).toBe('DOMAIN');
    });
  });

  it('TD-09-02: NARROW scope (1 domain) → 0 DOMAIN template edges', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'] }));
    expect(r.templateEdges.filter(e => e.type === 'DOMAIN')).toHaveLength(0);
  });

  it('TD-09-03: DOMAIN edge from = template in source domain, to = template in target domain', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL', 'BIDDING'] }));
    const domEdges = r.templateEdges.filter(e => e.type === 'DOMAIN');
    const genIds = ['TO_TRINH', 'QUYET_DINH', 'BIEN_BAN'];
    const bidIds = ['KHLCNT', 'HSYC', 'HSMT', 'BAO_CAO_DANH_GIA'];
    // At least one edge goes from a GENERAL template to a BIDDING template
    expect(domEdges.some(e => genIds.includes(e.from) && bidIds.includes(e.to))).toBe(true);
  });
});

// ── TD-10 cross-domain multiplication ────────────────────────────────────────
describe('TD-10 cross-domain multiplication', () => {
  it('TD-10-01: [GENERAL, BIDDING] BROAD → 24 DOMAIN edges (3×4 + 4×3)', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL', 'BIDDING'] }));
    const domEdges = r.templateEdges.filter(e => e.type === 'DOMAIN');
    expect(domEdges).toHaveLength(GEN_COUNT * BID_COUNT + BID_COUNT * GEN_COUNT);
  });

  it('TD-10-02: [BIDDING, FINANCIAL] BROAD → 16 DOMAIN edges (4×2 + 2×4)', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING', 'FINANCIAL'] }));
    const domEdges = r.templateEdges.filter(e => e.type === 'DOMAIN');
    expect(domEdges).toHaveLength(BID_COUNT * FIN_COUNT + FIN_COUNT * BID_COUNT);
  });

  it('TD-10-03: forward real 4 domains → 70 DOMAIN template edges', () => {
    const r = new TemplateDependencyResolver().resolve(FWD.last, FWD.cur);
    const domEdges = r.templateEdges.filter(e => e.type === 'DOMAIN');
    // 12 CROSS domain edges × |src| × |dst| summed:
    // G→HR:3×1 + G→B:3×4 + G→F:3×2 = 3+12+6=21
    // HR→G:1×3 + HR→B:1×4 + HR→F:1×2 = 3+4+2=9
    // B→G:4×3 + B→HR:4×1 + B→F:4×2  = 12+4+8=24
    // F→G:2×3 + F→HR:2×1 + F→B:2×4  = 6+2+8=16
    // total = 21+9+24+16 = 70
    expect(domEdges).toHaveLength(70);
  });
});

// ── TD-11 NONE scope ──────────────────────────────────────────────────────────
describe('TD-11 NONE scope', () => {
  it('TD-11-01: 0 domains → templates=[]', () => {
    const r = resolveFromDependency(synDep({ domains: [] }));
    expect(r.templates).toHaveLength(0);
  });

  it('TD-11-02: 0 domains → templateEdges=[]', () => {
    const r = resolveFromDependency(synDep({ domains: [] }));
    expect(r.templateEdges).toHaveLength(0);
  });

  it('TD-11-03: NONE scope → templateCount=0, edgeCount=0', () => {
    const r = resolveFromDependency(synDep({ domains: [] }));
    expect(r.metadata.templateCount).toBe(0);
    expect(r.metadata.edgeCount).toBe(0);
  });
});

// ── TD-12 metadata forwarding ─────────────────────────────────────────────────
describe('TD-12 metadata forwarding', () => {
  it('TD-12-01: metadata.templateCount = templates.length', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING', 'FINANCIAL'] }));
    expect(r.metadata.templateCount).toBe(r.templates.length);
  });

  it('TD-12-02: metadata.edgeCount = templateEdges.length', () => {
    const r = resolveFromDependency(synDep({ domains: ['GENERAL', 'BIDDING'] }));
    expect(r.metadata.edgeCount).toBe(r.templateEdges.length);
  });

  it('TD-12-03: metadata.targetDate forwarded from dep.metadata.targetDate', () => {
    const r = resolveFromDependency(synDep({ domains: ['BIDDING'], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });
});

// ── TD-13 single build call ───────────────────────────────────────────────────
describe('TD-13 single build call', () => {
  it('TD-13-01: build() called exactly once per resolve() call', () => {
    const spy = stubDepGraph({ status: 'UNCHANGED', targetDate: SAME.cur });
    const resolver = new TemplateDependencyResolver({ build: spy } as unknown as DependencyGraphBuilder);
    resolver.resolve(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('TD-13-02: build() called with correct date args', () => {
    const spy = stubDepGraph({ domains: ['GENERAL', 'HR', 'BIDDING', 'FINANCIAL'], targetDate: FWD.cur });
    const resolver = new TemplateDependencyResolver({ build: spy } as unknown as DependencyGraphBuilder);
    resolver.resolve(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('TD-13-03: two resolve() calls → build() called twice', () => {
    const spy = stubDepGraph({ status: 'UNCHANGED', targetDate: SAME.cur });
    const resolver = new TemplateDependencyResolver({ build: spy } as unknown as DependencyGraphBuilder);
    resolver.resolve(SAME.last, SAME.cur);
    resolver.resolve(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
