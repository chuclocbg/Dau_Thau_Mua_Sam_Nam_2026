import { describe, it, expect, vi } from 'vitest';
import {
  OfficialSourceConnector,
  connectFromCrawl,
} from '../agents/OfficialSourceConnector';
import { GovernmentCrawler }  from '../agents/GovernmentCrawler';
import type { CrawlAction }   from '../agents/GovernmentCrawler';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ── helpers ────────────────────────────────────────────────────────────────────

type CrawlType = 'ALERT_OPERATOR' | 'INVALIDATE_CACHE' | 'WRITE_AUDIT' | 'RECRAWL_PRIORITY' | 'DEFER';
type CrawlPri  = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

function ca(type: CrawlType, priority: CrawlPri, target = 'x'): CrawlAction {
  return { type, target, priority };
}

function synCrawl(actions: CrawlAction[]) {
  return { crawlActions: actions };
}

function stubCrawler(actions: CrawlAction[], impactLevel: ImpactLevel = 'LOW') {
  return vi.fn().mockReturnValue({
    impactLevel,
    approvalNotifications: [],
    updateNotifications:   [],
    auditNotifications:    [],
    crawlActions:          actions,
  });
}

// Reusable action fixtures
const alertHigh   = ca('ALERT_OPERATOR',   'HIGH',     'approvalQueue');
const alertCrit   = ca('ALERT_OPERATOR',   'CRITICAL', 'approvalQueue');
const invalidLow  = ca('INVALIDATE_CACHE', 'LOW',      'procurementBands');
const auditLow    = ca('WRITE_AUDIT',      'LOW',      'SKIP procurementBands');
const auditHigh   = ca('WRITE_AUDIT',      'HIGH',     'ROLLBACK procurementBands');
const recrawlHigh = ca('RECRAWL_PRIORITY', 'HIGH',     'high-priority-regulations');
const recrawlCrit = ca('RECRAWL_PRIORITY', 'CRITICAL', 'critical-regulations');
const deferLow    = ca('DEFER',            'LOW',      'next-window');

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const BWD  = { last: '2026-01-01', cur: '2025-07-01' };

// ── OS-01 approval routing ────────────────────────────────────────────────────
describe('OS-01 approval routing', () => {
  it('OS-01-01: ALERT_OPERATOR → one approvalJob', () => {
    const r = connectFromCrawl(synCrawl([alertHigh, deferLow]));
    expect(r.approvalJobs).toHaveLength(1);
  });

  it('OS-01-02: approvalJob source = OPERATOR_QUEUE', () => {
    const r = connectFromCrawl(synCrawl([alertHigh, deferLow]));
    expect(r.approvalJobs[0].source).toBe('OPERATOR_QUEUE');
  });

  it('OS-01-03: approvalJob action = PUSH_APPROVAL', () => {
    const r = connectFromCrawl(synCrawl([alertHigh, deferLow]));
    expect(r.approvalJobs[0].action).toBe('PUSH_APPROVAL');
  });
});

// ── OS-02 cache routing ────────────────────────────────────────────────────────
describe('OS-02 cache routing', () => {
  it('OS-02-01: INVALIDATE_CACHE → one cacheJob', () => {
    const r = connectFromCrawl(synCrawl([invalidLow, deferLow]));
    expect(r.cacheJobs).toHaveLength(1);
  });

  it('OS-02-02: cacheJob source = CACHE_LAYER, action = INVALIDATE', () => {
    const r = connectFromCrawl(synCrawl([invalidLow, deferLow]));
    expect(r.cacheJobs[0].source).toBe('CACHE_LAYER');
    expect(r.cacheJobs[0].action).toBe('INVALIDATE');
  });

  it('OS-02-03: cacheJob priority always LOW', () => {
    const highInvalid = ca('INVALIDATE_CACHE', 'HIGH', 'fundSources');
    const r = connectFromCrawl(synCrawl([highInvalid, deferLow]));
    expect(r.cacheJobs[0].priority).toBe('LOW');
  });
});

// ── OS-03 audit routing ────────────────────────────────────────────────────────
describe('OS-03 audit routing', () => {
  it('OS-03-01: WRITE_AUDIT → one auditJob', () => {
    const r = connectFromCrawl(synCrawl([auditLow, deferLow]));
    expect(r.auditJobs).toHaveLength(1);
  });

  it('OS-03-02: auditJob source = AUDIT_WRITER, action = WRITE', () => {
    const r = connectFromCrawl(synCrawl([auditLow, deferLow]));
    expect(r.auditJobs[0].source).toBe('AUDIT_WRITER');
    expect(r.auditJobs[0].action).toBe('WRITE');
  });

  it('OS-03-03: auditJob priority forwarded from crawlAction', () => {
    const r = connectFromCrawl(synCrawl([auditHigh, auditLow, deferLow]));
    expect(r.auditJobs[0].priority).toBe('HIGH');
    expect(r.auditJobs[1].priority).toBe('LOW');
  });
});

// ── OS-04 critical fetch jobs ─────────────────────────────────────────────────
describe('OS-04 critical fetch jobs', () => {
  it('OS-04-01: RECRAWL_PRIORITY CRITICAL → 4 fetchJobs', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    expect(r.fetchJobs).toHaveLength(4);
  });

  it('OS-04-02: all 4 fetchJobs have action=FETCH and priority=CRITICAL', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    r.fetchJobs.forEach(j => {
      expect(j.action).toBe('FETCH');
      expect(j.priority).toBe('CRITICAL');
    });
  });

  it('OS-04-03: fetch sources are GOV_PORTAL, MOISA, MPI, MOF in order', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    expect(r.fetchJobs.map(j => j.source)).toEqual(['GOV_PORTAL', 'MOISA', 'MPI', 'MOF']);
  });
});

// ── OS-05 high fetch jobs ─────────────────────────────────────────────────────
describe('OS-05 high fetch jobs', () => {
  it('OS-05-01: real forward data → 4 fetchJobs', () => {
    const r = new OfficialSourceConnector().connect(FWD.last, FWD.cur);
    expect(r.fetchJobs).toHaveLength(4);
  });

  it('OS-05-02: RECRAWL_PRIORITY HIGH → 4 fetchJobs all priority HIGH', () => {
    const r = connectFromCrawl(synCrawl([recrawlHigh]));
    r.fetchJobs.forEach(j => expect(j.priority).toBe('HIGH'));
  });

  it('OS-05-03: HIGH fetch source order is GOV_PORTAL, MOISA, MPI, MOF', () => {
    const r = connectFromCrawl(synCrawl([recrawlHigh]));
    expect(r.fetchJobs.map(j => j.source)).toEqual(['GOV_PORTAL', 'MOISA', 'MPI', 'MOF']);
  });
});

// ── OS-06 defer path ──────────────────────────────────────────────────────────
describe('OS-06 defer path', () => {
  it('OS-06-01: real same25 → exactly 1 fetchJob (WAIT)', () => {
    const r = new OfficialSourceConnector().connect(SAME.last, SAME.cur);
    expect(r.fetchJobs).toHaveLength(1);
    expect(r.fetchJobs[0].action).toBe('WAIT');
  });

  it('OS-06-02: DEFER → fetchJob source=GOV_PORTAL, action=WAIT', () => {
    const r = connectFromCrawl(synCrawl([deferLow]));
    expect(r.fetchJobs[0].source).toBe('GOV_PORTAL');
    expect(r.fetchJobs[0].action).toBe('WAIT');
  });

  it('OS-06-03: DEFER → fetchJob priority = LOW', () => {
    const r = connectFromCrawl(synCrawl([deferLow]));
    expect(r.fetchJobs[0].priority).toBe('LOW');
  });
});

// ── OS-07 source ordering ──────────────────────────────────────────────────────
describe('OS-07 source ordering', () => {
  it('OS-07-01: RECRAWL fetchJobs[0].source = GOV_PORTAL', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    expect(r.fetchJobs[0].source).toBe('GOV_PORTAL');
  });

  it('OS-07-02: fetchJobs[1].source = MOISA, fetchJobs[2].source = MPI', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    expect(r.fetchJobs[1].source).toBe('MOISA');
    expect(r.fetchJobs[2].source).toBe('MPI');
  });

  it('OS-07-03: fetchJobs[3].source = MOF (last)', () => {
    const r = connectFromCrawl(synCrawl([recrawlCrit]));
    expect(r.fetchJobs[3].source).toBe('MOF');
  });
});

// ── OS-08 priority propagation ────────────────────────────────────────────────
describe('OS-08 priority propagation', () => {
  it('OS-08-01: ALERT_OPERATOR HIGH → approvalJob.priority = HIGH', () => {
    const r = connectFromCrawl(synCrawl([alertHigh, deferLow]));
    expect(r.approvalJobs[0].priority).toBe('HIGH');
  });

  it('OS-08-02: ALERT_OPERATOR CRITICAL → approvalJob.priority = CRITICAL', () => {
    const r = connectFromCrawl(synCrawl([alertCrit, recrawlCrit]));
    expect(r.approvalJobs[0].priority).toBe('CRITICAL');
  });

  it('OS-08-03: WRITE_AUDIT priorities forwarded independently', () => {
    const r = connectFromCrawl(synCrawl([auditHigh, auditLow, deferLow]));
    expect(r.auditJobs[0].priority).toBe('HIGH');
    expect(r.auditJobs[1].priority).toBe('LOW');
  });
});

// ── OS-09 single crawler call ─────────────────────────────────────────────────
describe('OS-09 single crawler call', () => {
  it('OS-09-01: crawl() called exactly once per connect() call', () => {
    const spy = stubCrawler([deferLow]);
    const connector = new OfficialSourceConnector({ crawl: spy } as unknown as GovernmentCrawler);
    connector.connect(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('OS-09-02: crawl() called with correct date args', () => {
    const spy = stubCrawler([deferLow]);
    const connector = new OfficialSourceConnector({ crawl: spy } as unknown as GovernmentCrawler);
    connector.connect(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('OS-09-03: two connect() calls → crawl() called twice', () => {
    const spy = stubCrawler([deferLow]);
    const connector = new OfficialSourceConnector({ crawl: spy } as unknown as GovernmentCrawler);
    connector.connect(SAME.last, SAME.cur);
    connector.connect(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── OS-10 deterministic output ────────────────────────────────────────────────
describe('OS-10 deterministic output', () => {
  it('OS-10-01: same real input → same fetchJobs length', () => {
    const conn = new OfficialSourceConnector();
    expect(conn.connect(FWD.last, FWD.cur).fetchJobs).toHaveLength(
      conn.connect(FWD.last, FWD.cur).fetchJobs.length,
    );
  });

  it('OS-10-02: same synthetic input → identical result', () => {
    const s = synCrawl([auditLow, recrawlHigh]);
    expect(connectFromCrawl(s).fetchJobs).toEqual(connectFromCrawl(s).fetchJobs);
  });

  it('OS-10-03: RECRAWL always 4 fetchJobs, DEFER always 1 fetchJob', () => {
    expect(connectFromCrawl(synCrawl([recrawlHigh])).fetchJobs).toHaveLength(4);
    expect(connectFromCrawl(synCrawl([deferLow])).fetchJobs).toHaveLength(1);
  });
});

// ── OS-11 no duplicates ────────────────────────────────────────────────────────
describe('OS-11 no duplicates', () => {
  it('OS-11-01: 2 ALERT_OPERATOR → exactly 2 approvalJobs (1:1 map)', () => {
    const r = connectFromCrawl(synCrawl([alertHigh, alertCrit, deferLow]));
    expect(r.approvalJobs).toHaveLength(2);
  });

  it('OS-11-02: 2 WRITE_AUDIT → exactly 2 auditJobs (1:1 map)', () => {
    const r = connectFromCrawl(synCrawl([auditHigh, auditLow, deferLow]));
    expect(r.auditJobs).toHaveLength(2);
  });

  it('OS-11-03: DEFER and RECRAWL never both produce fetchJobs in same call', () => {
    const rDefer    = connectFromCrawl(synCrawl([deferLow]));
    const rRecrawl  = connectFromCrawl(synCrawl([recrawlHigh]));
    expect(rDefer.fetchJobs.every(j => j.action === 'WAIT')).toBe(true);
    expect(rRecrawl.fetchJobs.every(j => j.action === 'FETCH')).toBe(true);
  });
});

// ── OS-12 backward compatibility ──────────────────────────────────────────────
describe('OS-12 backward compatibility', () => {
  it('OS-12-01: same25 — approvalJobs=0, cacheJobs=0, auditJobs=3, fetchJobs=1', () => {
    const r = new OfficialSourceConnector().connect(SAME.last, SAME.cur);
    expect(r.approvalJobs).toHaveLength(0);
    expect(r.cacheJobs).toHaveLength(0);
    expect(r.auditJobs).toHaveLength(3);
    expect(r.fetchJobs).toHaveLength(1);
  });

  it('OS-12-02: forward — approvalJobs=0, cacheJobs=0, auditJobs=3, fetchJobs=4', () => {
    const r = new OfficialSourceConnector().connect(FWD.last, FWD.cur);
    expect(r.approvalJobs).toHaveLength(0);
    expect(r.cacheJobs).toHaveLength(0);
    expect(r.auditJobs).toHaveLength(3);
    expect(r.fetchJobs).toHaveLength(4);
  });

  it('OS-12-03: backward — same as forward (HIGH recrawl, no alerts)', () => {
    const r = new OfficialSourceConnector().connect(BWD.last, BWD.cur);
    expect(r.approvalJobs).toHaveLength(0);
    expect(r.auditJobs).toHaveLength(3);
    expect(r.fetchJobs).toHaveLength(4);
  });
});

// ── OS-13 real stack integration ──────────────────────────────────────────────
describe('OS-13 real stack integration', () => {
  it('OS-13-01: same25 total job count = 4 (3 audit + 1 wait)', () => {
    const r = new OfficialSourceConnector().connect(SAME.last, SAME.cur);
    const total = r.approvalJobs.length + r.cacheJobs.length + r.auditJobs.length + r.fetchJobs.length;
    expect(total).toBe(4);
  });

  it('OS-13-02: forward total job count = 7 (3 audit + 4 fetch)', () => {
    const r = new OfficialSourceConnector().connect(FWD.last, FWD.cur);
    const total = r.approvalJobs.length + r.cacheJobs.length + r.auditJobs.length + r.fetchJobs.length;
    expect(total).toBe(7);
  });

  it('OS-13-03: forward fetchJobs[3].source = MOF (last source)', () => {
    const r = new OfficialSourceConnector().connect(FWD.last, FWD.cur);
    expect(r.fetchJobs[3].source).toBe('MOF');
  });
});
