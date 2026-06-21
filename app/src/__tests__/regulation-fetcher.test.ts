import { describe, it, expect, vi } from 'vitest';
import {
  RegulationFetcher,
  fetchFromSnapshot,
} from '../agents/RegulationFetcher';
import { SnapshotBuilder }        from '../agents/SnapshotBuilder';
import type { SnapshotStatus }    from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FOUR_SOURCES = ['GOV_PORTAL', 'MOISA', 'MPI', 'MOF'] as const;

function synSnapshot(opts: {
  status?:     SnapshotStatus;
  sources?:    readonly string[];
  targetDate?: string;
  auditCount?: number;
}) {
  const status     = opts.status     ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const sources    = opts.sources    ?? [];
  return {
    status,
    targetDate,
    assembledSnapshot: { sources, targetDate },
    metadata: {
      fetchSources:  sources.length,
      auditCount:    opts.auditCount ?? 0,
      approvalCount: status === 'PENDING_APPROVAL' ? 1 : 0,
    },
    approvalRequired: status === 'PENDING_APPROVAL',
  };
}

function stubBuilder(opts: Parameters<typeof synSnapshot>[0]) {
  return vi.fn().mockReturnValue(synSnapshot(opts));
}

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── RF-01 READY path ───────────────────────────────────────────────────────────
describe('RF-01 READY path', () => {
  it('RF-01-01: forward real data → status=READY, records.length=4', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.records).toHaveLength(4);
  });

  it('RF-01-02: synthetic READY with 2 sources → 2 records', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL', 'MOISA'], auditCount: 3 }));
    expect(r.records).toHaveLength(2);
  });

  it('RF-01-03: READY records contain source, title, url, effectiveDate', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'], auditCount: 1 }));
    const rec = r.records[0];
    expect(rec).toHaveProperty('source');
    expect(rec).toHaveProperty('title');
    expect(rec).toHaveProperty('url');
    expect(rec).toHaveProperty('effectiveDate');
  });
});

// ── RF-02 PENDING_APPROVAL path ────────────────────────────────────────────────
describe('RF-02 PENDING_APPROVAL path', () => {
  it('RF-02-01: PENDING_APPROVAL → records=[]', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'PENDING_APPROVAL', sources: FOUR_SOURCES, auditCount: 3 }));
    expect(r.records).toHaveLength(0);
  });

  it('RF-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'PENDING_APPROVAL', sources: FOUR_SOURCES, auditCount: 3 }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('RF-02-03: metadata.sourceCount=0 when PENDING_APPROVAL', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'PENDING_APPROVAL', sources: FOUR_SOURCES, auditCount: 3 }));
    expect(r.metadata.sourceCount).toBe(0);
  });
});

// ── RF-03 UNCHANGED path ───────────────────────────────────────────────────────
describe('RF-03 UNCHANGED path', () => {
  it('RF-03-01: same25 real data → records=[]', () => {
    const r = new RegulationFetcher().fetch(SAME.last, SAME.cur);
    expect(r.records).toHaveLength(0);
  });

  it('RF-03-02: UNCHANGED status forwarded', () => {
    const r = new RegulationFetcher().fetch(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('RF-03-03: synthetic UNCHANGED → records=[]', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'UNCHANGED', sources: [], auditCount: 3 }));
    expect(r.records).toHaveLength(0);
    expect(r.metadata.sourceCount).toBe(0);
  });
});

// ── RF-04 GOV_PORTAL mapping ───────────────────────────────────────────────────
describe('RF-04 GOV_PORTAL mapping', () => {
  it('RF-04-01: GOV_PORTAL record.source = "GOV_PORTAL"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.records[0].source).toBe('GOV_PORTAL');
  });

  it('RF-04-02: GOV_PORTAL record.url = "https://chinhphu.vn"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.records[0].url).toBe('https://chinhphu.vn');
  });

  it('RF-04-03: GOV_PORTAL record.title = "Government regulations"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'] }));
    expect(r.records[0].title).toBe('Government regulations');
  });
});

// ── RF-05 MOISA mapping ────────────────────────────────────────────────────────
describe('RF-05 MOISA mapping', () => {
  it('RF-05-01: MOISA record.source = "MOISA"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOISA'] }));
    expect(r.records[0].source).toBe('MOISA');
  });

  it('RF-05-02: MOISA record.url = "https://moha.gov.vn"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOISA'] }));
    expect(r.records[0].url).toBe('https://moha.gov.vn');
  });

  it('RF-05-03: MOISA record.title = "MOISA regulations"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOISA'] }));
    expect(r.records[0].title).toBe('MOISA regulations');
  });
});

// ── RF-06 MPI mapping ─────────────────────────────────────────────────────────
describe('RF-06 MPI mapping', () => {
  it('RF-06-01: MPI record.source = "MPI"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MPI'] }));
    expect(r.records[0].source).toBe('MPI');
  });

  it('RF-06-02: MPI record.url = "https://mpi.gov.vn"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MPI'] }));
    expect(r.records[0].url).toBe('https://mpi.gov.vn');
  });

  it('RF-06-03: MPI record.title = "MPI regulations"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MPI'] }));
    expect(r.records[0].title).toBe('MPI regulations');
  });
});

// ── RF-07 MOF mapping ─────────────────────────────────────────────────────────
describe('RF-07 MOF mapping', () => {
  it('RF-07-01: MOF record.source = "MOF"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOF'] }));
    expect(r.records[0].source).toBe('MOF');
  });

  it('RF-07-02: MOF record.url = "https://mof.gov.vn"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOF'] }));
    expect(r.records[0].url).toBe('https://mof.gov.vn');
  });

  it('RF-07-03: MOF record.title = "MOF regulations"', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOF'] }));
    expect(r.records[0].title).toBe('MOF regulations');
  });
});

// ── RF-08 source ordering ─────────────────────────────────────────────────────
describe('RF-08 source ordering', () => {
  it('RF-08-01: forward real data — records[0].source = "GOV_PORTAL"', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    expect(r.records[0].source).toBe('GOV_PORTAL');
  });

  it('RF-08-02: records[1].source = "MOISA", records[2].source = "MPI"', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    expect(r.records[1].source).toBe('MOISA');
    expect(r.records[2].source).toBe('MPI');
  });

  it('RF-08-03: records[3].source = "MOF" (last)', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    expect(r.records[3].source).toBe('MOF');
  });
});

// ── RF-09 metadata generation ─────────────────────────────────────────────────
describe('RF-09 metadata generation', () => {
  it('RF-09-01: metadata.sourceCount = records.length', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: FOUR_SOURCES, auditCount: 3 }));
    expect(r.metadata.sourceCount).toBe(r.records.length);
  });

  it('RF-09-02: metadata.auditCount forwarded from snapshot.metadata.auditCount', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: FOUR_SOURCES, auditCount: 7 }));
    expect(r.metadata.auditCount).toBe(7);
  });

  it('RF-09-03: metadata.targetDate forwarded from snapshot.targetDate', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'], targetDate: '2025-07-01', auditCount: 3 }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });
});

// ── RF-10 targetDate propagation ──────────────────────────────────────────────
describe('RF-10 targetDate propagation', () => {
  it('RF-10-01: record.effectiveDate = snapshot.targetDate', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'], targetDate: '2026-01-01' }));
    expect(r.records[0].effectiveDate).toBe('2026-01-01');
  });

  it('RF-10-02: metadata.targetDate = snapshot.targetDate', () => {
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['MOISA'], targetDate: '2026-01-01', auditCount: 3 }));
    expect(r.metadata.targetDate).toBe('2026-01-01');
  });

  it('RF-10-03: different targetDate → different effectiveDate on each call', () => {
    const r1 = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'], targetDate: '2025-07-01' }));
    const r2 = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: ['GOV_PORTAL'], targetDate: '2026-01-01' }));
    expect(r1.records[0].effectiveDate).not.toBe(r2.records[0].effectiveDate);
  });
});

// ── RF-11 single SnapshotBuilder call ─────────────────────────────────────────
describe('RF-11 single SnapshotBuilder call', () => {
  it('RF-11-01: build() called exactly once per fetch() call', () => {
    const spy = stubBuilder({ status: 'UNCHANGED', sources: [], auditCount: 3 });
    const fetcher = new RegulationFetcher({ build: spy } as unknown as SnapshotBuilder);
    fetcher.fetch(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RF-11-02: build() called with correct date args', () => {
    const spy = stubBuilder({ status: 'READY', sources: FOUR_SOURCES, auditCount: 3 });
    const fetcher = new RegulationFetcher({ build: spy } as unknown as SnapshotBuilder);
    fetcher.fetch(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('RF-11-03: two fetch() calls → build() called twice', () => {
    const spy = stubBuilder({ status: 'UNCHANGED', sources: [], auditCount: 3 });
    const fetcher = new RegulationFetcher({ build: spy } as unknown as SnapshotBuilder);
    fetcher.fetch(SAME.last, SAME.cur);
    fetcher.fetch(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── RF-12 deterministic output ────────────────────────────────────────────────
describe('RF-12 deterministic output', () => {
  it('RF-12-01: same real input → same records length on repeated calls', () => {
    const fetcher = new RegulationFetcher();
    expect(fetcher.fetch(FWD.last, FWD.cur).records).toHaveLength(
      fetcher.fetch(FWD.last, FWD.cur).records.length,
    );
  });

  it('RF-12-02: same synthetic snapshot → identical result', () => {
    const s = synSnapshot({ status: 'READY', sources: FOUR_SOURCES, auditCount: 3 });
    expect(fetchFromSnapshot(s)).toEqual(fetchFromSnapshot(s));
  });

  it('RF-12-03: READY always produces one record per source, in order', () => {
    const sources = ['GOV_PORTAL', 'MOF'] as const;
    const r = fetchFromSnapshot(synSnapshot({ status: 'READY', sources: [...sources], auditCount: 2 }));
    expect(r.records.map(rec => rec.source)).toEqual(['GOV_PORTAL', 'MOF']);
  });
});

// ── RF-13 real stack integration ───────────────────────────────────────────────
describe('RF-13 real stack integration', () => {
  it('RF-13-01: forward — records[0].url = "https://chinhphu.vn"', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    expect(r.records[0].url).toBe('https://chinhphu.vn');
  });

  it('RF-13-02: forward — all records have effectiveDate = "2026-01-01"', () => {
    const r = new RegulationFetcher().fetch(FWD.last, FWD.cur);
    r.records.forEach(rec => expect(rec.effectiveDate).toBe('2026-01-01'));
  });

  it('RF-13-03: same25 — metadata.sourceCount=0, status=UNCHANGED', () => {
    const r = new RegulationFetcher().fetch(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
    expect(r.metadata.sourceCount).toBe(0);
  });
});
