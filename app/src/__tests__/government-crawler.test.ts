import { describe, it, expect, vi } from 'vitest';
import {
  GovernmentCrawler,
  crawlFromNotify,
} from '../agents/GovernmentCrawler';
import { NotificationCenter } from '../agents/NotificationCenter';
import type { Notification }  from '../agents/NotificationCenter';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ── helpers ────────────────────────────────────────────────────────────────────

type NotifSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

function notif(severity: NotifSeverity, title: string, message: string): Notification {
  return { severity, title, message };
}

function synNotify(opts: {
  impactLevel?:           ImpactLevel;
  approvalNotifications?: readonly Notification[];
  updateNotifications?:   readonly Notification[];
  auditNotifications?:    readonly Notification[];
}) {
  return {
    impactLevel:           (opts.impactLevel ?? 'LOW') as ImpactLevel,
    approvalNotifications: opts.approvalNotifications ?? [],
    updateNotifications:   opts.updateNotifications   ?? [],
    auditNotifications:    opts.auditNotifications    ?? [],
  };
}

function stubNotifyCenter(opts: Parameters<typeof synNotify>[0]) {
  return vi.fn().mockReturnValue({
    ...synNotify(opts),
    requiresHumanReview: false,
  });
}

// Reusable notification fixtures
const approvalHigh    = notif('HIGH', 'Approval Required', '1 task(s) waiting for review');
const approvalCrit    = notif('CRITICAL', 'Approval Required', '2 task(s) waiting for review');
const updateProc      = notif('INFO', 'Template Updated', 'procurementBands');
const updateCon       = notif('INFO', 'Template Updated', 'contractTypes');
const auditSkipProc   = notif('LOW',  'SKIP',     'SKIP procurementBands');
const auditRollback   = notif('HIGH', 'ROLLBACK', 'ROLLBACK procurementBands');
const auditApply      = notif('INFO', 'APPLY',    'APPLY contractTypes');

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const BWD  = { last: '2026-01-01', cur: '2025-07-01' };

// ── GC-01 no approval notifications ───────────────────────────────────────────
describe('GC-01 no approval notifications', () => {
  it('GC-01-01: forward real data — no ALERT_OPERATOR in crawlActions', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
  });

  it('GC-01-02: same25 real data — no ALERT_OPERATOR', () => {
    const r = new GovernmentCrawler().crawl(SAME.last, SAME.cur);
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
  });

  it('GC-01-03: approvalNotifications=[] → no ALERT_OPERATOR', () => {
    const r = crawlFromNotify(synNotify({ approvalNotifications: [], impactLevel: 'HIGH' }));
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
  });
});

// ── GC-02 approval notifications ──────────────────────────────────────────────
describe('GC-02 approval notifications', () => {
  it('GC-02-01: approvalNotifications=[1] → exactly one ALERT_OPERATOR', () => {
    const r = crawlFromNotify(synNotify({ approvalNotifications: [approvalHigh], impactLevel: 'HIGH' }));
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(1);
  });

  it('GC-02-02: approvalNotifications=[2] → still exactly one ALERT_OPERATOR', () => {
    const r = crawlFromNotify(synNotify({ approvalNotifications: [approvalHigh, approvalCrit], impactLevel: 'HIGH' }));
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(1);
  });

  it('GC-02-03: ALERT_OPERATOR target is "approvalQueue"', () => {
    const r = crawlFromNotify(synNotify({ approvalNotifications: [approvalHigh], impactLevel: 'HIGH' }));
    const alert = r.crawlActions.find(a => a.type === 'ALERT_OPERATOR')!;
    expect(alert.target).toBe('approvalQueue');
  });
});

// ── GC-03 cache invalidation ───────────────────────────────────────────────────
describe('GC-03 cache invalidation', () => {
  it('GC-03-01: one updateNotification → one INVALIDATE_CACHE', () => {
    const r = crawlFromNotify(synNotify({ updateNotifications: [updateProc] }));
    expect(r.crawlActions.filter(a => a.type === 'INVALIDATE_CACHE')).toHaveLength(1);
  });

  it('GC-03-02: two updateNotifications → two INVALIDATE_CACHE', () => {
    const r = crawlFromNotify(synNotify({ updateNotifications: [updateProc, updateCon] }));
    expect(r.crawlActions.filter(a => a.type === 'INVALIDATE_CACHE')).toHaveLength(2);
  });

  it('GC-03-03: INVALIDATE_CACHE target = notification message, priority = LOW', () => {
    const r = crawlFromNotify(synNotify({ updateNotifications: [updateProc] }));
    const inv = r.crawlActions.find(a => a.type === 'INVALIDATE_CACHE')!;
    expect(inv.target).toBe('procurementBands');
    expect(inv.priority).toBe('LOW');
  });
});

// ── GC-04 audit actions ────────────────────────────────────────────────────────
describe('GC-04 audit actions', () => {
  it('GC-04-01: one auditNotification → one WRITE_AUDIT', () => {
    const r = crawlFromNotify(synNotify({ auditNotifications: [auditSkipProc] }));
    expect(r.crawlActions.filter(a => a.type === 'WRITE_AUDIT')).toHaveLength(1);
  });

  it('GC-04-02: 3 real SKIPs from forward data → 3 WRITE_AUDIT', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.crawlActions.filter(a => a.type === 'WRITE_AUDIT')).toHaveLength(3);
  });

  it('GC-04-03: WRITE_AUDIT target = auditNotification message', () => {
    const r = crawlFromNotify(synNotify({ auditNotifications: [auditSkipProc] }));
    const audit = r.crawlActions.find(a => a.type === 'WRITE_AUDIT')!;
    expect(audit.target).toBe('SKIP procurementBands');
  });
});

// ── GC-05 critical recrawl ─────────────────────────────────────────────────────
describe('GC-05 critical recrawl', () => {
  it('GC-05-01: impactLevel=CRITICAL → RECRAWL_PRIORITY action', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'CRITICAL' }));
    expect(r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY')).toHaveLength(1);
  });

  it('GC-05-02: RECRAWL_PRIORITY target = "critical-regulations"', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'CRITICAL' }));
    const recrawl = r.crawlActions.find(a => a.type === 'RECRAWL_PRIORITY')!;
    expect(recrawl.target).toBe('critical-regulations');
  });

  it('GC-05-03: RECRAWL_PRIORITY priority = CRITICAL', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'CRITICAL' }));
    const recrawl = r.crawlActions.find(a => a.type === 'RECRAWL_PRIORITY')!;
    expect(recrawl.priority).toBe('CRITICAL');
  });
});

// ── GC-06 high recrawl ────────────────────────────────────────────────────────
describe('GC-06 high recrawl', () => {
  it('GC-06-01: forward real data (HIGH) → RECRAWL_PRIORITY in crawlActions', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY')).toHaveLength(1);
  });

  it('GC-06-02: impactLevel=HIGH → target = "high-priority-regulations"', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'HIGH' }));
    const recrawl = r.crawlActions.find(a => a.type === 'RECRAWL_PRIORITY')!;
    expect(recrawl.target).toBe('high-priority-regulations');
  });

  it('GC-06-03: impactLevel=HIGH → priority = HIGH', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'HIGH' }));
    const recrawl = r.crawlActions.find(a => a.type === 'RECRAWL_PRIORITY')!;
    expect(recrawl.priority).toBe('HIGH');
  });
});

// ── GC-07 defer path ──────────────────────────────────────────────────────────
describe('GC-07 defer path', () => {
  it('GC-07-01: same25 real data (LOW) → DEFER in crawlActions', () => {
    const r = new GovernmentCrawler().crawl(SAME.last, SAME.cur);
    expect(r.crawlActions.filter(a => a.type === 'DEFER')).toHaveLength(1);
  });

  it('GC-07-02: impactLevel=LOW → DEFER target = "next-window"', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'LOW' }));
    const defer = r.crawlActions.find(a => a.type === 'DEFER')!;
    expect(defer.target).toBe('next-window');
  });

  it('GC-07-03: impactLevel=MEDIUM → DEFER (not RECRAWL_PRIORITY)', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'MEDIUM' }));
    expect(r.crawlActions.filter(a => a.type === 'DEFER')).toHaveLength(1);
    expect(r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY')).toHaveLength(0);
  });
});

// ── GC-08 ordering ────────────────────────────────────────────────────────────
describe('GC-08 ordering', () => {
  it('GC-08-01: full plan — ALERT before INVALIDATE before WRITE_AUDIT before RECRAWL', () => {
    const r = crawlFromNotify(synNotify({
      impactLevel:           'HIGH',
      approvalNotifications: [approvalHigh],
      updateNotifications:   [updateProc],
      auditNotifications:    [auditSkipProc],
    }));
    expect(r.crawlActions[0].type).toBe('ALERT_OPERATOR');
    expect(r.crawlActions[1].type).toBe('INVALIDATE_CACHE');
    expect(r.crawlActions[2].type).toBe('WRITE_AUDIT');
    expect(r.crawlActions[3].type).toBe('RECRAWL_PRIORITY');
  });

  it('GC-08-02: real forward — WRITE_AUDIT[0..2] then RECRAWL_PRIORITY last', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.crawlActions[0].type).toBe('WRITE_AUDIT');
    expect(r.crawlActions[r.crawlActions.length - 1].type).toBe('RECRAWL_PRIORITY');
  });

  it('GC-08-03: DEFER is always last action', () => {
    const r = crawlFromNotify(synNotify({
      impactLevel:        'LOW',
      auditNotifications: [auditSkipProc],
    }));
    const last = r.crawlActions[r.crawlActions.length - 1];
    expect(last.type).toBe('DEFER');
  });
});

// ── GC-09 impactLevel propagation ─────────────────────────────────────────────
describe('GC-09 impactLevel propagation', () => {
  it('GC-09-01: LOW forwarded from same25', () => {
    const r = new GovernmentCrawler().crawl(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
  });

  it('GC-09-02: HIGH forwarded from forward real data', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
  });

  it('GC-09-03: CRITICAL forwarded from synthetic input', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'CRITICAL' }));
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── GC-10 deterministic output ────────────────────────────────────────────────
describe('GC-10 deterministic output', () => {
  it('GC-10-01: same real input → same crawlActions length', () => {
    const crawler = new GovernmentCrawler();
    expect(crawler.crawl(FWD.last, FWD.cur).crawlActions).toHaveLength(
      crawler.crawl(FWD.last, FWD.cur).crawlActions.length,
    );
  });

  it('GC-10-02: same synthetic input → identical crawlActions', () => {
    const s = synNotify({ impactLevel: 'HIGH', auditNotifications: [auditSkipProc] });
    expect(crawlFromNotify(s).crawlActions).toEqual(crawlFromNotify(s).crawlActions);
  });

  it('GC-10-03: RECRAWL/DEFER count is always exactly 1', () => {
    const r = crawlFromNotify(synNotify({ impactLevel: 'CRITICAL' }));
    const terminal = r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY' || a.type === 'DEFER');
    expect(terminal).toHaveLength(1);
  });
});

// ── GC-11 action priorities ───────────────────────────────────────────────────
describe('GC-11 action priorities', () => {
  it('GC-11-01: ALERT_OPERATOR priority = impactLevel', () => {
    const r = crawlFromNotify(synNotify({ approvalNotifications: [approvalHigh], impactLevel: 'HIGH' }));
    const alert = r.crawlActions.find(a => a.type === 'ALERT_OPERATOR')!;
    expect(alert.priority).toBe('HIGH');
  });

  it('GC-11-02: INVALIDATE_CACHE priority is always LOW', () => {
    const r = crawlFromNotify(synNotify({
      impactLevel:        'CRITICAL',
      updateNotifications: [updateProc, updateCon],
    }));
    r.crawlActions.filter(a => a.type === 'INVALIDATE_CACHE').forEach(a => {
      expect(a.priority).toBe('LOW');
    });
  });

  it('GC-11-03: WRITE_AUDIT priority HIGH when severity=HIGH, LOW otherwise', () => {
    const r = crawlFromNotify(synNotify({
      auditNotifications: [auditRollback, auditSkipProc, auditApply],
    }));
    const audits = r.crawlActions.filter(a => a.type === 'WRITE_AUDIT');
    expect(audits[0].priority).toBe('HIGH');  // ROLLBACK → HIGH
    expect(audits[1].priority).toBe('LOW');   // SKIP → LOW
    expect(audits[2].priority).toBe('LOW');   // APPLY (INFO) → LOW
  });
});

// ── GC-12 single NotificationCenter call ──────────────────────────────────────
describe('GC-12 single NotificationCenter call', () => {
  it('GC-12-01: notify() called exactly once per crawl() call', () => {
    const spy = stubNotifyCenter({});
    const crawler = new GovernmentCrawler({ notify: spy } as unknown as NotificationCenter);
    crawler.crawl(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GC-12-02: notify() called with correct date args', () => {
    const spy = stubNotifyCenter({});
    const crawler = new GovernmentCrawler({ notify: spy } as unknown as NotificationCenter);
    crawler.crawl(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('GC-12-03: two crawl() calls → notify() called twice', () => {
    const spy = stubNotifyCenter({});
    const crawler = new GovernmentCrawler({ notify: spy } as unknown as NotificationCenter);
    crawler.crawl(SAME.last, SAME.cur);
    crawler.crawl(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── GC-13 backward compatibility ──────────────────────────────────────────────
describe('GC-13 backward compatibility', () => {
  it('GC-13-01: same25 — LOW, no alert, no cache, 3 WRITE_AUDIT, 1 DEFER', () => {
    const r = new GovernmentCrawler().crawl(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
    expect(r.crawlActions.filter(a => a.type === 'INVALIDATE_CACHE')).toHaveLength(0);
    expect(r.crawlActions.filter(a => a.type === 'WRITE_AUDIT')).toHaveLength(3);
    expect(r.crawlActions.filter(a => a.type === 'DEFER')).toHaveLength(1);
  });

  it('GC-13-02: forward — HIGH, no alert, 3 WRITE_AUDIT, 1 RECRAWL_PRIORITY', () => {
    const r = new GovernmentCrawler().crawl(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
    expect(r.crawlActions.filter(a => a.type === 'WRITE_AUDIT')).toHaveLength(3);
    expect(r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY')).toHaveLength(1);
  });

  it('GC-13-03: backward — HIGH + humanReview=true, waitingTasks=[], same as forward', () => {
    const r = new GovernmentCrawler().crawl(BWD.last, BWD.cur);
    expect(r.crawlActions.filter(a => a.type === 'ALERT_OPERATOR')).toHaveLength(0);
    expect(r.crawlActions.filter(a => a.type === 'WRITE_AUDIT')).toHaveLength(3);
    expect(r.crawlActions.filter(a => a.type === 'RECRAWL_PRIORITY')).toHaveLength(1);
  });
});
