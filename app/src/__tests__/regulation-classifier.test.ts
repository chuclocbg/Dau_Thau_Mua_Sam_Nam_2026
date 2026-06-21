import { describe, it, expect, vi } from 'vitest';
import {
  RegulationClassifier,
  classifyFromParsed,
} from '../agents/RegulationClassifier';
import { RegulationParser }    from '../agents/RegulationParser';
import type { SnapshotStatus } from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const SRC_FOR: Record<string, string> = {
  GENERAL: 'GOV_PORTAL', PERSONNEL: 'MOISA', PROCUREMENT: 'MPI', FINANCE: 'MOF',
};
const AUTH_FOR: Record<string, string> = {
  GENERAL: 'Government', PERSONNEL: 'MOISA', PROCUREMENT: 'MPI', FINANCE: 'MOF',
};

function synReg(category: string, targetDate = '2026-01-01') {
  return {
    source:        SRC_FOR[category] ?? category,
    title:         `${category} title`,
    url:           `https://example.com/${category.toLowerCase()}`,
    effectiveDate: targetDate,
    authority:     AUTH_FOR[category] ?? category,
    category,
  };
}

function synParsed(opts: {
  status?:     SnapshotStatus;
  categories?: readonly string[];
  targetDate?: string;
}) {
  const status     = opts.status     ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const regulations =
    status === 'READY' ? (opts.categories ?? []).map(c => synReg(c, targetDate)) : [];
  return { status, regulations, metadata: { targetDate } };
}

function stubParser(opts: Parameters<typeof synParsed>[0]) {
  return vi.fn().mockReturnValue(synParsed(opts));
}

const ALL_CATS = ['GENERAL', 'PERSONNEL', 'PROCUREMENT', 'FINANCE'] as const;

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };

// ── RC-01 READY path ───────────────────────────────────────────────────────────
describe('RC-01 READY path', () => {
  it('RC-01-01: forward real data → status=READY, regulations.length=4', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.status).toBe('READY');
    expect(r.regulations).toHaveLength(4);
  });

  it('RC-01-02: synthetic READY with 2 categories → 2 classified', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL', 'FINANCE'] }));
    expect(r.regulations).toHaveLength(2);
  });

  it('RC-01-03: READY classified have source, title, url, effectiveDate, authority, category, domain', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PROCUREMENT'] }));
    const reg = r.regulations[0];
    expect(reg).toHaveProperty('source');
    expect(reg).toHaveProperty('title');
    expect(reg).toHaveProperty('url');
    expect(reg).toHaveProperty('effectiveDate');
    expect(reg).toHaveProperty('authority');
    expect(reg).toHaveProperty('category');
    expect(reg).toHaveProperty('domain');
  });
});

// ── RC-02 PENDING_APPROVAL path ────────────────────────────────────────────────
describe('RC-02 PENDING_APPROVAL path', () => {
  it('RC-02-01: PENDING_APPROVAL → regulations=[]', () => {
    const r = classifyFromParsed(synParsed({ status: 'PENDING_APPROVAL', categories: [...ALL_CATS] }));
    expect(r.regulations).toHaveLength(0);
  });

  it('RC-02-02: status forwarded as PENDING_APPROVAL', () => {
    const r = classifyFromParsed(synParsed({ status: 'PENDING_APPROVAL' }));
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('RC-02-03: metadata.count=0 when PENDING_APPROVAL', () => {
    const r = classifyFromParsed(synParsed({ status: 'PENDING_APPROVAL' }));
    expect(r.metadata.count).toBe(0);
  });
});

// ── RC-03 UNCHANGED path ───────────────────────────────────────────────────────
describe('RC-03 UNCHANGED path', () => {
  it('RC-03-01: same25 real data → regulations=[]', () => {
    const r = new RegulationClassifier().classify(SAME.last, SAME.cur);
    expect(r.regulations).toHaveLength(0);
  });

  it('RC-03-02: UNCHANGED status forwarded', () => {
    const r = new RegulationClassifier().classify(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
  });

  it('RC-03-03: synthetic UNCHANGED → regulations=[], count=0', () => {
    const r = classifyFromParsed(synParsed({ status: 'UNCHANGED' }));
    expect(r.regulations).toHaveLength(0);
    expect(r.metadata.count).toBe(0);
  });
});

// ── RC-04 PROCUREMENT→BIDDING ─────────────────────────────────────────────────
describe('RC-04 PROCUREMENT→BIDDING', () => {
  it('RC-04-01: PROCUREMENT regulation domain = "BIDDING"', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PROCUREMENT'] }));
    expect(r.regulations[0].domain).toBe('BIDDING');
  });

  it('RC-04-02: category="PROCUREMENT" preserved on ClassifiedRegulation', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PROCUREMENT'] }));
    expect(r.regulations[0].category).toBe('PROCUREMENT');
  });

  it('RC-04-03: MPI regulation authority and source preserved', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PROCUREMENT'] }));
    expect(r.regulations[0].authority).toBe('MPI');
    expect(r.regulations[0].source).toBe('MPI');
  });
});

// ── RC-05 FINANCE→FINANCIAL ───────────────────────────────────────────────────
describe('RC-05 FINANCE→FINANCIAL', () => {
  it('RC-05-01: FINANCE regulation domain = "FINANCIAL"', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['FINANCE'] }));
    expect(r.regulations[0].domain).toBe('FINANCIAL');
  });

  it('RC-05-02: category="FINANCE" preserved on ClassifiedRegulation', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['FINANCE'] }));
    expect(r.regulations[0].category).toBe('FINANCE');
  });

  it('RC-05-03: MOF authority preserved', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['FINANCE'] }));
    expect(r.regulations[0].authority).toBe('MOF');
  });
});

// ── RC-06 PERSONNEL→HR ────────────────────────────────────────────────────────
describe('RC-06 PERSONNEL→HR', () => {
  it('RC-06-01: PERSONNEL regulation domain = "HR"', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PERSONNEL'] }));
    expect(r.regulations[0].domain).toBe('HR');
  });

  it('RC-06-02: category="PERSONNEL" preserved on ClassifiedRegulation', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PERSONNEL'] }));
    expect(r.regulations[0].category).toBe('PERSONNEL');
  });

  it('RC-06-03: MOISA effectiveDate preserved', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PERSONNEL'], targetDate: '2026-01-01' }));
    expect(r.regulations[0].effectiveDate).toBe('2026-01-01');
  });
});

// ── RC-07 GENERAL→GENERAL ─────────────────────────────────────────────────────
describe('RC-07 GENERAL→GENERAL', () => {
  it('RC-07-01: GENERAL regulation domain = "GENERAL"', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL'] }));
    expect(r.regulations[0].domain).toBe('GENERAL');
  });

  it('RC-07-02: category="GENERAL" preserved on ClassifiedRegulation', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL'] }));
    expect(r.regulations[0].category).toBe('GENERAL');
  });

  it('RC-07-03: GOV_PORTAL title preserved from parsed regulation', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL'] }));
    expect(r.regulations[0].title).toBeTruthy();
  });
});

// ── RC-08 domainCount ─────────────────────────────────────────────────────────
describe('RC-08 domainCount', () => {
  it('RC-08-01: forward real data → domainCount=4 (all four unique domains)', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.metadata.domainCount).toBe(4);
  });

  it('RC-08-02: two GENERAL-category regulations → domainCount=1', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL', 'GENERAL'] }));
    expect(r.metadata.domainCount).toBe(1);
  });

  it('RC-08-03: UNCHANGED → domainCount=0', () => {
    const r = new RegulationClassifier().classify(SAME.last, SAME.cur);
    expect(r.metadata.domainCount).toBe(0);
  });
});

// ── RC-09 ordering ────────────────────────────────────────────────────────────
describe('RC-09 ordering', () => {
  it('RC-09-01: forward real → regulations[0].source = "GOV_PORTAL"', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.regulations[0].source).toBe('GOV_PORTAL');
  });

  it('RC-09-02: regulations[1].source = "MOISA", [2].source = "MPI"', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.regulations[1].source).toBe('MOISA');
    expect(r.regulations[2].source).toBe('MPI');
  });

  it('RC-09-03: regulations[3].source = "MOF" (last)', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.regulations[3].source).toBe('MOF');
  });
});

// ── RC-10 metadata generation ─────────────────────────────────────────────────
describe('RC-10 metadata generation', () => {
  it('RC-10-01: metadata.count = regulations.length', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: [...ALL_CATS] }));
    expect(r.metadata.count).toBe(r.regulations.length);
  });

  it('RC-10-02: metadata.targetDate forwarded from parsed.metadata.targetDate', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL'], targetDate: '2025-07-01' }));
    expect(r.metadata.targetDate).toBe('2025-07-01');
  });

  it('RC-10-03: domainCount = number of distinct domain values', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['PROCUREMENT', 'PROCUREMENT', 'FINANCE'] }));
    expect(r.metadata.domainCount).toBe(2);
  });
});

// ── RC-11 single parser call ──────────────────────────────────────────────────
describe('RC-11 single parser call', () => {
  it('RC-11-01: parse() called exactly once per classify() call', () => {
    const spy = stubParser({ status: 'UNCHANGED', targetDate: SAME.cur });
    const classifier = new RegulationClassifier({ parse: spy } as unknown as RegulationParser);
    classifier.classify(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RC-11-02: parse() called with correct date args', () => {
    const spy = stubParser({ status: 'READY', categories: [...ALL_CATS], targetDate: FWD.cur });
    const classifier = new RegulationClassifier({ parse: spy } as unknown as RegulationParser);
    classifier.classify(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('RC-11-03: two classify() calls → parse() called twice', () => {
    const spy = stubParser({ status: 'UNCHANGED', targetDate: SAME.cur });
    const classifier = new RegulationClassifier({ parse: spy } as unknown as RegulationParser);
    classifier.classify(SAME.last, SAME.cur);
    classifier.classify(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── RC-12 deterministic output ────────────────────────────────────────────────
describe('RC-12 deterministic output', () => {
  it('RC-12-01: same real input → same regulations.length on repeated calls', () => {
    const classifier = new RegulationClassifier();
    expect(classifier.classify(FWD.last, FWD.cur).regulations).toHaveLength(
      classifier.classify(FWD.last, FWD.cur).regulations.length,
    );
  });

  it('RC-12-02: same synthetic parsed → identical ClassifyResult', () => {
    const p = synParsed({ status: 'READY', categories: [...ALL_CATS] });
    expect(classifyFromParsed(p)).toEqual(classifyFromParsed(p));
  });

  it('RC-12-03: order preserved — synthetic [GENERAL, MOF] → domains [GENERAL, FINANCIAL]', () => {
    const r = classifyFromParsed(synParsed({ status: 'READY', categories: ['GENERAL', 'FINANCE'] }));
    expect(r.regulations.map(reg => reg.domain)).toEqual(['GENERAL', 'FINANCIAL']);
  });
});

// ── RC-13 real stack integration ──────────────────────────────────────────────
describe('RC-13 real stack integration', () => {
  it('RC-13-01: forward — regulations[2].domain = "BIDDING" (MPI/PROCUREMENT)', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.regulations[2].domain).toBe('BIDDING');
  });

  it('RC-13-02: forward — regulations[3].domain = "FINANCIAL" (MOF/FINANCE)', () => {
    const r = new RegulationClassifier().classify(FWD.last, FWD.cur);
    expect(r.regulations[3].domain).toBe('FINANCIAL');
  });

  it('RC-13-03: same25 — metadata.count=0, domainCount=0, status=UNCHANGED', () => {
    const r = new RegulationClassifier().classify(SAME.last, SAME.cur);
    expect(r.status).toBe('UNCHANGED');
    expect(r.metadata.count).toBe(0);
    expect(r.metadata.domainCount).toBe(0);
  });
});
