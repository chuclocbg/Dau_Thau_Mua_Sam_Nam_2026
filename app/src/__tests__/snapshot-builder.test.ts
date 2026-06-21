import { describe, it, expect, vi } from 'vitest';
import {
  SnapshotBuilder,
  buildFromConnect,
} from '../agents/SnapshotBuilder';
import { OfficialSourceConnector } from '../agents/OfficialSourceConnector';
import type { ConnectorJob }       from '../agents/OfficialSourceConnector';

// ── helpers ────────────────────────────────────────────────────────────────────

type Src  = 'OPERATOR_QUEUE' | 'CACHE_LAYER' | 'AUDIT_WRITER' | 'MOISA' | 'MPI' | 'MOF' | 'GOV_PORTAL';
type Act  = 'PUSH_APPROVAL' | 'INVALIDATE' | 'WRITE' | 'FETCH' | 'WAIT';
type Pri  = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

function job(source: Src, action: Act, priority: Pri = 'LOW'): ConnectorJob {
  return { source, action, priority };
}

function synConnect(opts: {
  approvalJobs?: readonly ConnectorJob[];
  cacheJobs?:    readonly ConnectorJob[];
  auditJobs?:    readonly ConnectorJob[];
  fetchJobs?:    readonly ConnectorJob[];
}) {
  return {
    approvalJobs: opts.approvalJobs ?? [],
    cacheJobs:    opts.cacheJobs   ?? [],
    auditJobs:    opts.auditJobs   ?? [],
    fetchJobs:    opts.fetchJobs   ?? [],
  };
}

function stubConnector(opts: Parameters<typeof synConnect>[0]) {
  return vi.fn().mockReturnValue(synConnect(opts));
}

// Reusable fixtures matching real connector output shapes
const FETCH_FOUR: readonly ConnectorJob[] = [
  job('GOV_PORTAL', 'FETCH', 'HIGH'),
  job('MOISA',      'FETCH', 'HIGH'),
  job('MPI',        'FETCH', 'HIGH'),
  job('MOF',        'FETCH', 'HIGH'),
];
const WAIT_ONE:    readonly ConnectorJob[] = [job('GOV_PORTAL', 'WAIT', 'LOW')];
const AUDIT_THREE: readonly ConnectorJob[] = [
  job('AUDIT_WRITER', 'WRITE', 'LOW'),
  job('AUDIT_WRITER', 'WRITE', 'LOW'),
  job('AUDIT_WRITER', 'WRITE', 'LOW'),
];
const APPROVAL_ONE: readonly ConnectorJob[] = [job('OPERATOR_QUEUE', 'PUSH_APPROVAL', 'HIGH')];

const DATE = '2026-01-01';
const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const BWD  = { last: '2026-01-01', cur: '2025-07-01' };

// ── SB-01 READY path ──────────────────────────────────────────────────────────
describe('SB-01 READY path', () => {
  it('SB-01-01: forward real data → status = READY', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
  });

  it('SB-01-02: FETCH jobs + no approvals → READY', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('READY');
  });

  it('SB-01-03: READY when any fetchJob has action=FETCH and approvalJobs=[]', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: [job('GOV_PORTAL', 'FETCH', 'HIGH')] }), DATE);
    expect(r.status).toBe('READY');
  });
});

// ── SB-02 PENDING_APPROVAL path ───────────────────────────────────────────────
describe('SB-02 PENDING_APPROVAL path', () => {
  it('SB-02-01: approvalJobs > 0 → PENDING_APPROVAL', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SB-02-02: PENDING_APPROVAL even when fetchJobs contain FETCH actions', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SB-02-03: approvalRequired = true when PENDING_APPROVAL', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: WAIT_ONE }), DATE);
    expect(r.approvalRequired).toBe(true);
  });
});

// ── SB-03 UNCHANGED path ──────────────────────────────────────────────────────
describe('SB-03 UNCHANGED path', () => {
  it('SB-03-01: same25 real data → status = UNCHANGED', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('SB-03-02: fetchJobs all WAIT → UNCHANGED', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('UNCHANGED');
  });

  it('SB-03-03: fetchJobs=[] → UNCHANGED (vacuously no FETCH actions)', () => {
    const r = buildFromConnect(synConnect({}), DATE);
    expect(r.status).toBe('UNCHANGED');
  });
});

// ── SB-04 metadata counts ─────────────────────────────────────────────────────
describe('SB-04 metadata counts', () => {
  it('SB-04-01: forward — fetchSources=4, auditCount=3, approvalCount=0', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.metadata.fetchSources).toBe(4);
    expect(r.metadata.auditCount).toBe(3);
    expect(r.metadata.approvalCount).toBe(0);
  });

  it('SB-04-02: same25 — fetchSources=1 (1 WAIT), auditCount=3, approvalCount=0', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.metadata.fetchSources).toBe(1);
    expect(r.metadata.auditCount).toBe(3);
    expect(r.metadata.approvalCount).toBe(0);
  });

  it('SB-04-03: synthetic with approval — approvalCount=1', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE }), DATE);
    expect(r.metadata.approvalCount).toBe(1);
    expect(r.metadata.auditCount).toBe(3);
    expect(r.metadata.fetchSources).toBe(1);
  });
});

// ── SB-05 source ordering ─────────────────────────────────────────────────────
describe('SB-05 source ordering', () => {
  it('SB-05-01: forward — sources[0] = GOV_PORTAL', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.assembledSnapshot.sources[0]).toBe('GOV_PORTAL');
  });

  it('SB-05-02: sources in connector order [GOV_PORTAL, MOISA, MPI, MOF]', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: FETCH_FOUR }), DATE);
    expect(r.assembledSnapshot.sources).toEqual(['GOV_PORTAL', 'MOISA', 'MPI', 'MOF']);
  });

  it('SB-05-03: sources.length=4 for FETCH branch, sources.length=0 for WAIT branch', () => {
    const rFetch = buildFromConnect(synConnect({ fetchJobs: FETCH_FOUR }), DATE);
    const rWait  = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE  }), DATE);
    expect(rFetch.assembledSnapshot.sources).toHaveLength(4);
    expect(rWait.assembledSnapshot.sources).toHaveLength(0);
  });
});

// ── SB-06 targetDate propagation ─────────────────────────────────────────────
describe('SB-06 targetDate propagation', () => {
  it('SB-06-01: targetDate in result equals currentDate', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: FETCH_FOUR }), '2026-01-01');
    expect(r.targetDate).toBe('2026-01-01');
  });

  it('SB-06-02: assembledSnapshot.targetDate equals currentDate', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE }), '2025-07-01');
    expect(r.assembledSnapshot.targetDate).toBe('2025-07-01');
  });

  it('SB-06-03: different currentDate → different targetDate', () => {
    const r1 = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE }), '2025-07-01');
    const r2 = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE }), '2026-01-01');
    expect(r1.targetDate).not.toBe(r2.targetDate);
  });
});

// ── SB-07 single connector call ───────────────────────────────────────────────
describe('SB-07 single connector call', () => {
  it('SB-07-01: connect() called exactly once per build() call', () => {
    const spy = stubConnector({ fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE });
    const builder = new SnapshotBuilder({ connect: spy } as unknown as OfficialSourceConnector);
    builder.build(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('SB-07-02: connect() called with correct date args', () => {
    const spy = stubConnector({ fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE });
    const builder = new SnapshotBuilder({ connect: spy } as unknown as OfficialSourceConnector);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('SB-07-03: two build() calls → connect() called twice', () => {
    const spy = stubConnector({ fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE });
    const builder = new SnapshotBuilder({ connect: spy } as unknown as OfficialSourceConnector);
    builder.build(SAME.last, SAME.cur);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── SB-08 deterministic output ────────────────────────────────────────────────
describe('SB-08 deterministic output', () => {
  it('SB-08-01: same real input → same status on repeated calls', () => {
    const builder = new SnapshotBuilder();
    expect(builder.build(FWD.last, FWD.cur).status).toBe(builder.build(FWD.last, FWD.cur).status);
  });

  it('SB-08-02: same synthetic input → identical result', () => {
    const s = synConnect({ fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE });
    expect(buildFromConnect(s, DATE)).toEqual(buildFromConnect(s, DATE));
  });

  it('SB-08-03: result shape is stable — same keys every call', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(Object.keys(r).sort()).toEqual(
      ['approvalRequired', 'assembledSnapshot', 'metadata', 'status', 'targetDate'],
    );
  });
});

// ── SB-09 empty source list on WAIT ──────────────────────────────────────────
describe('SB-09 empty source list on WAIT', () => {
  it('SB-09-01: same25 → assembledSnapshot.sources = []', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.assembledSnapshot.sources).toHaveLength(0);
  });

  it('SB-09-02: DEFER/WAIT synthetic → sources = []', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE }), DATE);
    expect(r.assembledSnapshot.sources).toEqual([]);
  });

  it('SB-09-03: WAIT job does not appear in sources list', () => {
    const r = buildFromConnect(synConnect({ fetchJobs: WAIT_ONE }), DATE);
    expect(r.assembledSnapshot.sources.includes('GOV_PORTAL' as never)).toBe(false);
  });
});

// ── SB-10 approval precedence ─────────────────────────────────────────────────
describe('SB-10 approval precedence', () => {
  it('SB-10-01: FETCH + approval → PENDING_APPROVAL (not READY)', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SB-10-02: WAIT + approval → PENDING_APPROVAL (not UNCHANGED)', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: WAIT_ONE, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SB-10-03: approvalJobs=[], FETCH → READY (not PENDING_APPROVAL)', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: [], fetchJobs: FETCH_FOUR, auditJobs: AUDIT_THREE }), DATE);
    expect(r.status).toBe('READY');
  });
});

// ── SB-11 backward compatibility ─────────────────────────────────────────────
describe('SB-11 backward compatibility', () => {
  it('SB-11-01: same25 — UNCHANGED, approvalRequired=false, 1 fetchSource', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
    expect(r.approvalRequired).toBe(false);
    expect(r.metadata.fetchSources).toBe(1);
  });

  it('SB-11-02: forward — READY, sources=[4], approvalRequired=false', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.assembledSnapshot.sources).toHaveLength(4);
    expect(r.approvalRequired).toBe(false);
  });

  it('SB-11-03: backward — READY, same as forward (humanReview=true does not block)', () => {
    const r = new SnapshotBuilder().build(BWD.last, BWD.cur);
    expect(r.status).toBe('READY');
    expect(r.approvalRequired).toBe(false);
  });
});

// ── SB-12 real stack integration ──────────────────────────────────────────────
describe('SB-12 real stack integration', () => {
  it('SB-12-01: same25 — metadata.fetchSources=1, auditCount=3', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.metadata.fetchSources).toBe(1);
    expect(r.metadata.auditCount).toBe(3);
  });

  it('SB-12-02: forward — metadata.fetchSources=4, auditCount=3', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.metadata.fetchSources).toBe(4);
    expect(r.metadata.auditCount).toBe(3);
  });

  it('SB-12-03: backward — approvalRequired=false despite upstream humanReview=true', () => {
    const r = new SnapshotBuilder().build(BWD.last, BWD.cur);
    expect(r.approvalRequired).toBe(false);
    expect(r.metadata.approvalCount).toBe(0);
  });
});

// ── SB-13 all statuses covered ────────────────────────────────────────────────
describe('SB-13 all statuses covered', () => {
  it('SB-13-01: READY is reachable via forward real data', () => {
    const r = new SnapshotBuilder().build(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
  });

  it('SB-13-02: PENDING_APPROVAL is reachable via synthetic approval job', () => {
    const r = buildFromConnect(synConnect({ approvalJobs: APPROVAL_ONE, fetchJobs: FETCH_FOUR }), DATE);
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SB-13-03: UNCHANGED is reachable via same25 real data', () => {
    const r = new SnapshotBuilder().build(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });
});
