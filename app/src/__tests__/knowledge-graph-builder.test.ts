import { describe, it, expect, vi } from 'vitest';
import {
  KnowledgeGraphBuilder,
  buildFromClassified,
} from '../agents/KnowledgeGraphBuilder';
import { RegulationClassifier } from '../agents/RegulationClassifier';
import type { SnapshotStatus }  from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

function synReg(domain: string, index = 0) {
  return {
    url:    `https://example.com/${domain.toLowerCase()}-${index}`,
    title:  `${domain} regulation ${index}`,
    domain,
  };
}

function synClassified(opts: {
  status?:     SnapshotStatus;
  regs?:       readonly { url: string; title: string; domain: string }[];
  targetDate?: string;
}) {
  const status      = opts.status     ?? 'READY';
  const targetDate  = opts.targetDate ?? '2026-01-01';
  const regulations = status === 'READY' ? (opts.regs ?? []) : [];
  return { status, regulations, metadata: { targetDate } };
}

function stubClassifier(opts: Parameters<typeof synClassified>[0]) {
  return vi.fn().mockReturnValue(synClassified(opts));
}

// Real-stack domain order for forward data (GOV_PORTAL→GENERAL first)
const REAL_DOMAINS = ['GENERAL', 'HR', 'BIDDING', 'FINANCIAL'] as const;
const REAL_URLS    = [
  'https://chinhphu.vn',
  'https://moha.gov.vn',
  'https://mpi.gov.vn',
  'https://mof.gov.vn',
] as const;

// Synthetic 4-regulation fixture matching real domain order
const FOUR_REGS = [
  { url: REAL_URLS[0], title: 'Gov title',  domain: 'GENERAL'   },
  { url: REAL_URLS[1], title: 'MOISA title', domain: 'HR'        },
  { url: REAL_URLS[2], title: 'MPI title',   domain: 'BIDDING'   },
  { url: REAL_URLS[3], title: 'MOF title',   domain: 'FINANCIAL' },
] as const;

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── KG-01 READY path ──────────────────────────────────────────────────────────
describe('KG-01 READY path', () => {
  it('KG-01-01: forward real data → status=READY, nodes.length=8 (4 domain + 4 reg)', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.nodes).toHaveLength(8);
  });

  it('KG-01-02: synthetic READY with 2 regs, 2 domains → nodes.length=4', () => {
    const regs = [synReg('BIDDING', 0), synReg('FINANCIAL', 1)];
    const r = buildFromClassified(synClassified({ regs }));
    expect(r.nodes).toHaveLength(4);
  });

  it('KG-01-03: READY edges.length = regulations.length', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    expect(r.edges).toHaveLength(4);
  });
});

// ── KG-02 PENDING_APPROVAL path ───────────────────────────────────────────────
describe('KG-02 PENDING_APPROVAL path', () => {
  it('KG-02-01: PENDING_APPROVAL → nodes=[], edges=[]', () => {
    const r = buildFromClassified(synClassified({ status: 'PENDING_APPROVAL', regs: [...FOUR_REGS] }));
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });

  it('KG-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = buildFromClassified(synClassified({ status: 'PENDING_APPROVAL' }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('KG-02-03: metadata.nodeCount=0, edgeCount=0 when PENDING_APPROVAL', () => {
    const r = buildFromClassified(synClassified({ status: 'PENDING_APPROVAL' }));
    expect(r.metadata.nodeCount).toBe(0);
    expect(r.metadata.edgeCount).toBe(0);
  });
});

// ── KG-03 UNCHANGED path ──────────────────────────────────────────────────────
describe('KG-03 UNCHANGED path', () => {
  it('KG-03-01: same25 real data → nodes=[], edges=[]', () => {
    const r = new KnowledgeGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });

  it('KG-03-02: UNCHANGED status forwarded', () => {
    const r = new KnowledgeGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('KG-03-03: synthetic UNCHANGED → domainCount=0', () => {
    const r = buildFromClassified(synClassified({ status: 'UNCHANGED' }));
    expect(r.metadata.domainCount).toBe(0);
    expect(r.nodes).toHaveLength(0);
  });
});

// ── KG-04 domain nodes ────────────────────────────────────────────────────────
describe('KG-04 domain nodes', () => {
  it('KG-04-01: domain node type = "DOMAIN"', () => {
    const r = buildFromClassified(synClassified({ regs: [synReg('BIDDING')] }));
    const domainNode = r.nodes.find(n => n.type === 'DOMAIN');
    expect(domainNode?.type).toBe('DOMAIN');
  });

  it('KG-04-02: domain node id = domain string', () => {
    const r = buildFromClassified(synClassified({ regs: [synReg('BIDDING')] }));
    const domainNode = r.nodes.find(n => n.type === 'DOMAIN');
    expect(domainNode?.id).toBe('BIDDING');
  });

  it('KG-04-03: domain node label = domain string', () => {
    const r = buildFromClassified(synClassified({ regs: [synReg('FINANCIAL')] }));
    const domainNode = r.nodes.find(n => n.type === 'DOMAIN');
    expect(domainNode?.label).toBe('FINANCIAL');
  });
});

// ── KG-05 regulation nodes ────────────────────────────────────────────────────
describe('KG-05 regulation nodes', () => {
  it('KG-05-01: regulation node type = "REGULATION"', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    const regNode = r.nodes.find(n => n.type === 'REGULATION');
    expect(regNode?.type).toBe('REGULATION');
  });

  it('KG-05-02: regulation node id = url', () => {
    const reg = { url: 'https://mof.gov.vn', title: 'MOF regs', domain: 'FINANCIAL' };
    const r = buildFromClassified(synClassified({ regs: [reg] }));
    const regNode = r.nodes.find(n => n.type === 'REGULATION');
    expect(regNode?.id).toBe('https://mof.gov.vn');
  });

  it('KG-05-03: regulation node label = title', () => {
    const reg = { url: 'https://mof.gov.vn', title: 'MOF Financial Circular', domain: 'FINANCIAL' };
    const r = buildFromClassified(synClassified({ regs: [reg] }));
    const regNode = r.nodes.find(n => n.type === 'REGULATION');
    expect(regNode?.label).toBe('MOF Financial Circular');
  });
});

// ── KG-06 BELONGS_TO edges ────────────────────────────────────────────────────
describe('KG-06 BELONGS_TO edges', () => {
  it('KG-06-01: edge relation = "BELONGS_TO"', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    expect(r.edges[0].relation).toBe('BELONGS_TO');
  });

  it('KG-06-02: edge from = regulation url', () => {
    const reg = { url: 'https://mpi.gov.vn', title: 'MPI regs', domain: 'BIDDING' };
    const r = buildFromClassified(synClassified({ regs: [reg] }));
    expect(r.edges[0].from).toBe('https://mpi.gov.vn');
  });

  it('KG-06-03: edge to = domain string', () => {
    const reg = { url: 'https://mpi.gov.vn', title: 'MPI regs', domain: 'BIDDING' };
    const r = buildFromClassified(synClassified({ regs: [reg] }));
    expect(r.edges[0].to).toBe('BIDDING');
  });
});

// ── KG-07 domain ordering ─────────────────────────────────────────────────────
describe('KG-07 domain ordering', () => {
  it('KG-07-01: forward real — nodes[0].type = "DOMAIN" (domain nodes precede reg nodes)', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.nodes[0].type).toBe('DOMAIN');
  });

  it('KG-07-02: forward real — nodes[0].id = "GENERAL" (first domain by appearance)', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.nodes[0].id).toBe('GENERAL');
  });

  it('KG-07-03: two regs with same domain → exactly 1 domain node', () => {
    const regs = [synReg('BIDDING', 0), synReg('BIDDING', 1)];
    const r = buildFromClassified(synClassified({ regs }));
    expect(r.nodes.filter(n => n.type === 'DOMAIN')).toHaveLength(1);
  });
});

// ── KG-08 metadata generation ─────────────────────────────────────────────────
describe('KG-08 metadata generation', () => {
  it('KG-08-01: domainCount = nodes.filter(n=>n.type==="DOMAIN").length', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    expect(r.metadata.domainCount).toBe(r.nodes.filter(n => n.type === 'DOMAIN').length);
  });

  it('KG-08-02: metadata.targetDate forwarded from classified.metadata.targetDate', () => {
    const r = buildFromClassified(synClassified({ regs: [synReg('HR')], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });

  it('KG-08-03: forward real → domainCount=4', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.metadata.domainCount).toBe(4);
  });
});

// ── KG-09 nodeCount ───────────────────────────────────────────────────────────
describe('KG-09 nodeCount', () => {
  it('KG-09-01: nodeCount = nodes.length', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    expect(r.metadata.nodeCount).toBe(r.nodes.length);
  });

  it('KG-09-02: forward real → nodeCount=8 (4 domain + 4 regulation)', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.metadata.nodeCount).toBe(8);
  });

  it('KG-09-03: two regs same domain → nodeCount = 1 domain + 2 regs = 3', () => {
    const regs = [synReg('BIDDING', 0), synReg('BIDDING', 1)];
    const r = buildFromClassified(synClassified({ regs }));
    expect(r.metadata.nodeCount).toBe(3);
  });
});

// ── KG-10 edgeCount ───────────────────────────────────────────────────────────
describe('KG-10 edgeCount', () => {
  it('KG-10-01: edgeCount = edges.length', () => {
    const r = buildFromClassified(synClassified({ regs: [...FOUR_REGS] }));
    expect(r.metadata.edgeCount).toBe(r.edges.length);
  });

  it('KG-10-02: edgeCount = regulations.length (one edge per regulation)', () => {
    const regs = [synReg('BIDDING', 0), synReg('BIDDING', 1), synReg('FINANCIAL', 2)];
    const r = buildFromClassified(synClassified({ regs }));
    expect(r.metadata.edgeCount).toBe(3);
  });

  it('KG-10-03: same25 real → edgeCount=0', () => {
    const r = new KnowledgeGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.metadata.edgeCount).toBe(0);
  });
});

// ── KG-11 single classifier call ──────────────────────────────────────────────
describe('KG-11 single classifier call', () => {
  it('KG-11-01: classify() called exactly once per build() call', () => {
    const spy = stubClassifier({ status: 'UNCHANGED', targetDate: SAME.cur });
    const builder = new KnowledgeGraphBuilder({ classify: spy } as unknown as RegulationClassifier);
    builder.build(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('KG-11-02: classify() called with correct date args', () => {
    const spy = stubClassifier({ regs: [...FOUR_REGS], targetDate: FWD.cur });
    const builder = new KnowledgeGraphBuilder({ classify: spy } as unknown as RegulationClassifier);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('KG-11-03: two build() calls → classify() called twice', () => {
    const spy = stubClassifier({ status: 'UNCHANGED', targetDate: SAME.cur });
    const builder = new KnowledgeGraphBuilder({ classify: spy } as unknown as RegulationClassifier);
    builder.build(SAME.last, SAME.cur);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── KG-12 deterministic output ────────────────────────────────────────────────
describe('KG-12 deterministic output', () => {
  it('KG-12-01: same real input → same nodeCount on repeated calls', () => {
    const builder = new KnowledgeGraphBuilder();
    expect(builder.build(FWD.last, FWD.cur).metadata.nodeCount).toBe(
      builder.build(FWD.last, FWD.cur).metadata.nodeCount,
    );
  });

  it('KG-12-02: same synthetic classified → identical KnowledgeGraphResult', () => {
    const c = synClassified({ regs: [...FOUR_REGS] });
    expect(buildFromClassified(c)).toEqual(buildFromClassified(c));
  });

  it('KG-12-03: regulation node order preserved — first reg node id = first regulation url', () => {
    const regs = [synReg('GENERAL', 0), synReg('HR', 1)];
    const r = buildFromClassified(synClassified({ regs }));
    const firstRegNode = r.nodes.find(n => n.type === 'REGULATION');
    expect(firstRegNode?.id).toBe(regs[0].url);
  });
});

// ── KG-13 real stack integration ──────────────────────────────────────────────
describe('KG-13 real stack integration', () => {
  it('KG-13-01: forward — nodes[0].id = "GENERAL" (first domain node)', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.nodes[0].id).toBe('GENERAL');
  });

  it('KG-13-02: forward — edges[0].from = "https://chinhphu.vn", edges[0].to = "GENERAL"', () => {
    const r = new KnowledgeGraphBuilder().build(FWD.last, FWD.cur);
    expect(r.edges[0].from).toBe('https://chinhphu.vn');
    expect(r.edges[0].to).toBe('GENERAL');
  });

  it('KG-13-03: same25 → nodeCount=0, edgeCount=0, status=UNCHANGED', () => {
    const r = new KnowledgeGraphBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
    expect(r.metadata.nodeCount).toBe(0);
    expect(r.metadata.edgeCount).toBe(0);
  });
});
