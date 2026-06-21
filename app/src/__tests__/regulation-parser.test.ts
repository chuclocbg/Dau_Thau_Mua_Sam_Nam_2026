import { describe, it, expect, vi } from 'vitest';
import {
  RegulationParser,
  parseFromFetch,
} from '../agents/RegulationParser';
import { RegulationFetcher } from '../agents/RegulationFetcher';
import type { SnapshotStatus } from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

function synRecord(source: string, targetDate = '2026-01-01') {
  return {
    source,
    title:         `${source} regulations`,
    url:           `https://example.com/${source.toLowerCase()}`,
    effectiveDate: targetDate,
  };
}

function synFetch(opts: {
  status?:      SnapshotStatus;
  sources?:     readonly string[];
  sourceCount?: number;
  targetDate?:  string;
}) {
  const status     = opts.status     ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const sources    = opts.sources    ?? [];
  const records    = status === 'READY' ? sources.map(s => synRecord(s, targetDate)) : [];
  return {
    status,
    records,
    metadata: {
      sourceCount: opts.sourceCount ?? records.length,
      auditCount:  3,
      targetDate,
    },
  };
}

function stubFetcher(opts: Parameters<typeof synFetch>[0]) {
  return vi.fn().mockReturnValue(synFetch(opts));
}

const ALL_FOUR = ['GOV_PORTAL', 'MOISA', 'MPI', 'MOF'] as const;

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── RP-01 READY path ───────────────────────────────────────────────────────────
describe('RP-01 READY path', () => {
  it('RP-01-01: forward real data → status=READY, regulations.length=4', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.regulations).toHaveLength(4);
  });

  it('RP-01-02: synthetic READY with 2 sources → 2 regulations', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL', 'MOISA'] }));
    expect(r.regulations).toHaveLength(2);
  });

  it('RP-01-03: READY regulations have source, title, url, effectiveDate, authority, category', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'] }));
    const reg = r.regulations[0];
    expect(reg).toHaveProperty('source');
    expect(reg).toHaveProperty('title');
    expect(reg).toHaveProperty('url');
    expect(reg).toHaveProperty('effectiveDate');
    expect(reg).toHaveProperty('authority');
    expect(reg).toHaveProperty('category');
  });
});

// ── RP-02 PENDING_APPROVAL path ────────────────────────────────────────────────
describe('RP-02 PENDING_APPROVAL path', () => {
  it('RP-02-01: PENDING_APPROVAL → regulations=[]', () => {
    const r = parseFromFetch(synFetch({ status: 'PENDING_APPROVAL', sourceCount: 4 }));
    expect(r.regulations).toHaveLength(0);
  });

  it('RP-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = parseFromFetch(synFetch({ status: 'PENDING_APPROVAL', sourceCount: 4 }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('RP-02-03: metadata.count=0 when PENDING_APPROVAL', () => {
    const r = parseFromFetch(synFetch({ status: 'PENDING_APPROVAL', sourceCount: 4 }));
    expect(r.metadata.count).toBe(0);
  });
});

// ── RP-03 UNCHANGED path ───────────────────────────────────────────────────────
describe('RP-03 UNCHANGED path', () => {
  it('RP-03-01: same25 real data → regulations=[]', () => {
    const r = new RegulationParser().parse(SAME.last, SAME.cur);
    expect(r.regulations).toHaveLength(0);
  });

  it('RP-03-02: UNCHANGED status forwarded', () => {
    const r = new RegulationParser().parse(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('RP-03-03: synthetic UNCHANGED → regulations=[], count=0', () => {
    const r = parseFromFetch(synFetch({ status: 'UNCHANGED', sourceCount: 0 }));
    expect(r.regulations).toHaveLength(0);
    expect(r.metadata.count).toBe(0);
  });
});

// ── RP-04 GOV_PORTAL authority mapping ────────────────────────────────────────
describe('RP-04 GOV_PORTAL authority mapping', () => {
  it('RP-04-01: GOV_PORTAL authority = "Government"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.regulations[0].authority).toBe('Government');
  });

  it('RP-04-02: GOV_PORTAL source preserved', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.regulations[0].source).toBe('GOV_PORTAL');
  });

  it('RP-04-03: GOV_PORTAL title and url preserved from record', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'] }));
    const reg = r.regulations[0];
    expect(reg.title).toBeTruthy();
    expect(reg.url).toBeTruthy();
  });
});

// ── RP-05 MOISA authority mapping ─────────────────────────────────────────────
describe('RP-05 MOISA authority mapping', () => {
  it('RP-05-01: MOISA authority = "MOISA"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOISA'] }));
    expect(r.regulations[0].authority).toBe('MOISA');
  });

  it('RP-05-02: MOISA source preserved', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOISA'] }));
    expect(r.regulations[0].source).toBe('MOISA');
  });

  it('RP-05-03: MOISA effectiveDate preserved from record', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOISA'], targetDate: '2026-01-01' }));
    expect(r.regulations[0].effectiveDate).toBe('2026-01-01');
  });
});

// ── RP-06 MPI authority mapping ───────────────────────────────────────────────
describe('RP-06 MPI authority mapping', () => {
  it('RP-06-01: MPI authority = "MPI"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MPI'] }));
    expect(r.regulations[0].authority).toBe('MPI');
  });

  it('RP-06-02: MPI source preserved', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MPI'] }));
    expect(r.regulations[0].source).toBe('MPI');
  });

  it('RP-06-03: MPI url preserved from record', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MPI'] }));
    expect(r.regulations[0].url).toBeTruthy();
  });
});

// ── RP-07 MOF authority mapping ───────────────────────────────────────────────
describe('RP-07 MOF authority mapping', () => {
  it('RP-07-01: MOF authority = "MOF"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOF'] }));
    expect(r.regulations[0].authority).toBe('MOF');
  });

  it('RP-07-02: MOF source preserved', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOF'] }));
    expect(r.regulations[0].source).toBe('MOF');
  });

  it('RP-07-03: MOF title preserved from record', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOF'] }));
    expect(r.regulations[0].title).toBeTruthy();
  });
});

// ── RP-08 category mapping ────────────────────────────────────────────────────
describe('RP-08 category mapping', () => {
  it('RP-08-01: GOV_PORTAL → category = "GENERAL"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.regulations[0].category).toBe('GENERAL');
  });

  it('RP-08-02: MOISA → PERSONNEL, MPI → PROCUREMENT', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOISA', 'MPI'] }));
    expect(r.regulations[0].category).toBe('PERSONNEL');
    expect(r.regulations[1].category).toBe('PROCUREMENT');
  });

  it('RP-08-03: MOF → category = "FINANCE"', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['MOF'] }));
    expect(r.regulations[0].category).toBe('FINANCE');
  });
});

// ── RP-09 source ordering ─────────────────────────────────────────────────────
describe('RP-09 source ordering', () => {
  it('RP-09-01: forward real data → regulations[0].source = "GOV_PORTAL"', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.regulations[0].source).toBe('GOV_PORTAL');
  });

  it('RP-09-02: regulations[1].source = "MOISA", [2].source = "MPI"', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.regulations[1].source).toBe('MOISA');
    expect(r.regulations[2].source).toBe('MPI');
  });

  it('RP-09-03: regulations[3].source = "MOF" (last)', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.regulations[3].source).toBe('MOF');
  });
});

// ── RP-10 metadata generation ─────────────────────────────────────────────────
describe('RP-10 metadata generation', () => {
  it('RP-10-01: metadata.count = regulations.length', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: [...ALL_FOUR] }));
    expect(r.metadata.count).toBe(r.regulations.length);
  });

  it('RP-10-02: metadata.sourceCount forwarded from fetch.metadata.sourceCount', () => {
    const r = parseFromFetch(synFetch({ status: 'UNCHANGED', sourceCount: 7, targetDate: '2026-01-01' }));
    expect(r.metadata.sourceCount).toBe(7);
  });

  it('RP-10-03: metadata.targetDate forwarded from fetch.metadata.targetDate', () => {
    const r = parseFromFetch(synFetch({ status: 'READY', sources: ['GOV_PORTAL'], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });
});

// ── RP-11 single fetcher call ─────────────────────────────────────────────────
describe('RP-11 single fetcher call', () => {
  it('RP-11-01: fetch() called exactly once per parse() call', () => {
    const spy = stubFetcher({ status: 'UNCHANGED', sourceCount: 0, targetDate: SAME.cur });
    const parser = new RegulationParser({ fetch: spy } as unknown as RegulationFetcher);
    parser.parse(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RP-11-02: fetch() called with correct date args', () => {
    const spy = stubFetcher({ status: 'READY', sources: [...ALL_FOUR], targetDate: FWD.cur });
    const parser = new RegulationParser({ fetch: spy } as unknown as RegulationFetcher);
    parser.parse(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('RP-11-03: two parse() calls → fetch() called twice', () => {
    const spy = stubFetcher({ status: 'UNCHANGED', sourceCount: 0, targetDate: SAME.cur });
    const parser = new RegulationParser({ fetch: spy } as unknown as RegulationFetcher);
    parser.parse(SAME.last, SAME.cur);
    parser.parse(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── RP-12 deterministic output ────────────────────────────────────────────────
describe('RP-12 deterministic output', () => {
  it('RP-12-01: same real input → same regulations.length on repeated calls', () => {
    const parser = new RegulationParser();
    expect(parser.parse(FWD.last, FWD.cur).regulations).toHaveLength(
      parser.parse(FWD.last, FWD.cur).regulations.length,
    );
  });

  it('RP-12-02: same synthetic fetch → identical result', () => {
    const f = synFetch({ status: 'READY', sources: [...ALL_FOUR] });
    expect(parseFromFetch(f)).toEqual(parseFromFetch(f));
  });

  it('RP-12-03: READY always produces one regulation per record, in order', () => {
    const sources = ['GOV_PORTAL', 'MOF'] as const;
    const r = parseFromFetch(synFetch({ status: 'READY', sources: [...sources] }));
    expect(r.regulations.map(reg => reg.source)).toEqual(['GOV_PORTAL', 'MOF']);
  });
});

// ── RP-13 real stack integration ──────────────────────────────────────────────
describe('RP-13 real stack integration', () => {
  it('RP-13-01: forward — regulations[0].authority = "Government"', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.regulations[0].authority).toBe('Government');
  });

  it('RP-13-02: forward — regulations[0].category = "GENERAL"', () => {
    const r = new RegulationParser().parse(FWD.last, FWD.cur);
    expect(r.regulations[0].category).toBe('GENERAL');
  });

  it('RP-13-03: same25 — metadata.count=0, status=UNCHANGED', () => {
    const r = new RegulationParser().parse(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
    expect(r.metadata.count).toBe(0);
  });
});
