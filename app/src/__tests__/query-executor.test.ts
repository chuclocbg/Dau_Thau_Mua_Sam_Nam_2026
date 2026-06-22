import { describe, it, expect, vi } from 'vitest';
import { QueryExecutor, buildExecutor }             from '../agents/QueryExecutor';
import { QueryPlanner, buildPlanner }               from '../agents/QueryPlanner';
import { SearchEngine, buildEngine }                from '../agents/SearchEngine';
import type { QueryDescriptor, QueryResult }        from '../agents/QueryPlanner';
import type { RegistryEntry }                       from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }            from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                      from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type EntryInput = { filename: string; priority: number; required?: boolean };

function synRegistry(opts: {
  status?:      SnapshotStatus;
  entries?:     readonly EntryInput[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
} = {}) {
  const status     = opts.status ?? 'READY';
  const targetDate = opts.targetDate ?? '2026-01-01';
  const raw        = status === 'READY' ? (opts.entries ?? []) : [];

  const requiredEntries: RegistryEntry[] = [];
  const optionalEntries: RegistryEntry[] = [];
  const index: Record<string, RegistryEntry> = {};

  for (const e of raw) {
    const entry: RegistryEntry = {
      filename:     e.filename,
      extension:    'DOCX',
      payload:      `CONTENT:${e.filename}`,
      priority:     e.priority,
      required:     e.required ?? true,
      registeredAt: targetDate,
    };
    if (entry.required) requiredEntries.push(entry);
    else                optionalEntries.push(entry);
    index[e.filename] = entry;
  }

  const entries = [...requiredEntries, ...optionalEntries];
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE' as ImpactScope,
    impactLevel: opts.impactLevel ?? 'NONE' as ImpactLevel,
    entries,
    requiredEntries,
    optionalEntries,
    index,
    metadata: {
      entryCount:    entries.length,
      requiredCount: requiredEntries.length,
      optionalCount: optionalEntries.length,
      targetDate,
    },
  };
}

function synQueryResult(opts: {
  entries?: readonly RegistryEntry[];
  named?:   RegistryEntry;
  descriptor?: QueryDescriptor;
} = {}): QueryResult {
  const entries = opts.entries ?? [];
  return {
    entries,
    named:      opts.named,
    descriptor: opts.descriptor ?? {},
    metadata: {
      entryCount:    entries.length,
      requiredCount: entries.filter(e => e.required).length,
      optionalCount: entries.filter(e => !e.required).length,
      targetDate:    '2026-01-01',
    },
  };
}

// Real pipeline.
const fwdPlanner    = buildPlanner(FWD.last, FWD.cur);
const samePlanner   = buildPlanner(SAME.last, SAME.cur);
const fwdExecutor   = new QueryExecutor(fwdPlanner);
const sameExecutor  = new QueryExecutor(samePlanner);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedEngine  = new SearchEngine(synRegistry({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  entries: [
    { filename: 'KE_HOACH_LCNT',           priority: 2, required: true  },
    { filename: 'HO_SO_YEU_CAU',           priority: 2, required: true  },
    { filename: 'HO_SO_MOI_THAU',          priority: 2, required: true  },
    { filename: 'DU_TOAN_MUA_SAM',         priority: 2, required: true  },
    { filename: 'TO_TRINH_MUA_SAM',        priority: 4, required: false },
    { filename: 'QUYET_DINH_PHE_DUYET',    priority: 4, required: false },
    { filename: 'BIEN_BAN_THAM_DINH',      priority: 4, required: false },
    { filename: 'QUYET_DINH_PHAN_CONG',    priority: 4, required: false },
    { filename: 'BAO_CAO_DANH_GIA_HSDT',   priority: 4, required: false },
    { filename: 'CHUNG_THU_THAM_DINH_GIA', priority: 4, required: false },
  ],
}));
const mixedPlanner  = new QueryPlanner(mixedEngine);
const mixedExecutor = new QueryExecutor(mixedPlanner);

// ── QX-01 READY ───────────────────────────────────────────────────────────────

describe('QX-01 READY', () => {
  it('QX-01-01 forward — execute({}).entries has 10 items', () => {
    expect(fwdExecutor.execute({}).entries).toHaveLength(10);
  });

  it('QX-01-02 forward — execute({}).named is undefined', () => {
    expect(fwdExecutor.execute({}).named).toBeUndefined();
  });

  it('QX-01-03 forward — execute({}).metadata is same reference as planner metadata', () => {
    expect(fwdExecutor.execute({}).metadata).toBe(fwdPlanner.plan({}).metadata);
  });
});

// ── QX-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('QX-02 PENDING_APPROVAL', () => {
  const e = new QueryExecutor(new QueryPlanner(new SearchEngine(synRegistry({ status: 'PENDING_APPROVAL' }))));

  it('QX-02-01 entries is empty', () => {
    expect(e.execute({}).entries).toHaveLength(0);
  });

  it('QX-02-02 summary.hasResults is false', () => {
    expect(e.execute({}).summary.hasResults).toBe(false);
  });

  it('QX-02-03 summary.namedFound is false', () => {
    expect(e.execute({ filename: 'TO_TRINH_MUA_SAM' }).summary.namedFound).toBe(false);
  });
});

// ── QX-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('QX-03 UNCHANGED', () => {
  it('QX-03-01 entries is empty', () => {
    expect(sameExecutor.execute({}).entries).toHaveLength(0);
  });

  it('QX-03-02 named is undefined even with filename specified', () => {
    expect(sameExecutor.execute({ filename: 'TO_TRINH_MUA_SAM' }).named).toBeUndefined();
  });

  it('QX-03-03 summary.entryCount is 0', () => {
    expect(sameExecutor.execute({}).summary.entryCount).toBe(0);
  });
});

// ── QX-04 summary.entryCount ──────────────────────────────────────────────────

describe('QX-04 summary.entryCount', () => {
  it('QX-04-01 entryCount equals entries.length for forward result', () => {
    const r = fwdExecutor.execute({});
    expect(r.summary.entryCount).toBe(r.entries.length);
  });

  it('QX-04-02 mixed scope=all — entryCount is 10', () => {
    expect(mixedExecutor.execute({ scope: 'all' }).summary.entryCount).toBe(10);
  });

  it('QX-04-03 mixed scope=required — entryCount is 4', () => {
    expect(mixedExecutor.execute({ scope: 'required' }).summary.entryCount).toBe(4);
  });
});

// ── QX-05 summary.namedFound ──────────────────────────────────────────────────

describe('QX-05 summary.namedFound', () => {
  it('QX-05-01 namedFound=true when filename exists in registry', () => {
    expect(fwdExecutor.execute({ filename: 'TO_TRINH_MUA_SAM' }).summary.namedFound).toBe(true);
  });

  it('QX-05-02 namedFound=false when filename not in registry', () => {
    expect(fwdExecutor.execute({ filename: 'NONEXISTENT_DOC' }).summary.namedFound).toBe(false);
  });

  it('QX-05-03 namedFound=false when no filename in descriptor', () => {
    expect(fwdExecutor.execute({}).summary.namedFound).toBe(false);
  });
});

// ── QX-06 summary.hasResults ──────────────────────────────────────────────────

describe('QX-06 summary.hasResults', () => {
  it('QX-06-01 hasResults=true for forward result (10 entries)', () => {
    expect(fwdExecutor.execute({}).summary.hasResults).toBe(true);
  });

  it('QX-06-02 hasResults=false for UNCHANGED result', () => {
    expect(sameExecutor.execute({}).summary.hasResults).toBe(false);
  });

  it('QX-06-03 hasResults=false when maxPriority filters everything out', () => {
    expect(mixedExecutor.execute({ maxPriority: 1 }).summary.hasResults).toBe(false);
  });
});

// ── QX-07 scope dispatch ──────────────────────────────────────────────────────

describe('QX-07 scope dispatch', () => {
  it('QX-07-01 scope=required — mixed returns 4 entries', () => {
    expect(mixedExecutor.execute({ scope: 'required' }).entries).toHaveLength(4);
  });

  it('QX-07-02 scope=optional — mixed returns 6 entries', () => {
    expect(mixedExecutor.execute({ scope: 'optional' }).entries).toHaveLength(6);
  });

  it('QX-07-03 scope=all — mixed returns 10 entries', () => {
    expect(mixedExecutor.execute({ scope: 'all' }).entries).toHaveLength(10);
  });
});

// ── QX-08 maxPriority filter ──────────────────────────────────────────────────

describe('QX-08 maxPriority filter', () => {
  it('QX-08-01 maxPriority=2 — mixed returns 4 entries', () => {
    expect(mixedExecutor.execute({ maxPriority: 2 }).entries).toHaveLength(4);
  });

  it('QX-08-02 maxPriority=1 — mixed returns 0 entries', () => {
    expect(mixedExecutor.execute({ maxPriority: 1 }).entries).toHaveLength(0);
  });

  it('QX-08-03 all returned entries satisfy the maxPriority constraint', () => {
    const max = 2;
    const r = mixedExecutor.execute({ maxPriority: max });
    expect(r.entries.every(e => e.priority <= max)).toBe(true);
  });
});

// ── QX-09 filename lookup ─────────────────────────────────────────────────────

describe('QX-09 filename lookup', () => {
  it('QX-09-01 known filename — named entry has correct filename', () => {
    expect(fwdExecutor.execute({ filename: 'TO_TRINH_MUA_SAM' }).named?.filename)
      .toBe('TO_TRINH_MUA_SAM');
  });

  it('QX-09-02 unknown filename — named is undefined', () => {
    expect(fwdExecutor.execute({ filename: 'NONEXISTENT_DOC' }).named).toBeUndefined();
  });

  it('QX-09-03 named lookup is independent of scope', () => {
    // scope=optional filters entries; named still resolves a required doc
    const r = mixedExecutor.execute({ scope: 'optional', filename: 'KE_HOACH_LCNT' });
    expect(r.entries).toHaveLength(6);
    expect(r.named?.filename).toBe('KE_HOACH_LCNT');
    expect(r.named?.required).toBe(true);
  });
});

// ── QX-10 reference sharing ───────────────────────────────────────────────────

describe('QX-10 reference sharing', () => {
  it('QX-10-01 entries is same reference as planner.plan({}).entries', () => {
    expect(fwdExecutor.execute({}).entries).toBe(fwdPlanner.plan({}).entries);
  });

  it('QX-10-02 metadata is same reference as planner.plan({}).metadata', () => {
    expect(fwdExecutor.execute({}).metadata).toBe(fwdPlanner.plan({}).metadata);
  });

  it('QX-10-03 named is same reference as returned by direct plan lookup', () => {
    const r   = fwdExecutor.execute({ filename: 'TO_TRINH_MUA_SAM' });
    const ref = fwdPlanner.plan({ filename: 'TO_TRINH_MUA_SAM' }).named;
    expect(r.named).toBe(ref);
  });
});

// ── QX-11 descriptor echo ─────────────────────────────────────────────────────

describe('QX-11 descriptor echo', () => {
  it('QX-11-01 result.descriptor is same reference as the input descriptor', () => {
    const d = { scope: 'required' as const, maxPriority: 2 };
    expect(fwdExecutor.execute(d).descriptor).toBe(d);
  });

  it('QX-11-02 result.descriptor.scope matches input', () => {
    const d = { scope: 'optional' as const };
    expect(mixedExecutor.execute(d).descriptor.scope).toBe('optional');
  });

  it('QX-11-03 result.descriptor.maxPriority matches input', () => {
    const d = { maxPriority: 3 };
    expect(mixedExecutor.execute(d).descriptor.maxPriority).toBe(3);
  });
});

// ── QX-12 deterministic output ────────────────────────────────────────────────

describe('QX-12 deterministic output', () => {
  it('QX-12-01 two execute() calls with same descriptor produce same entries length', () => {
    const d = { scope: 'required' as const };
    expect(mixedExecutor.execute(d).entries.length)
      .toBe(mixedExecutor.execute(d).entries.length);
  });

  it('QX-12-02 summary.entryCount always equals entries.length', () => {
    const r = mixedExecutor.execute({ scope: 'all', maxPriority: 2 });
    expect(r.summary.entryCount).toBe(r.entries.length);
  });

  it('QX-12-03 summary.hasResults is consistent with entryCount > 0', () => {
    const r = mixedExecutor.execute({ maxPriority: 2 });
    expect(r.summary.hasResults).toBe(r.summary.entryCount > 0);
  });
});

// ── QX-13 spy injection ───────────────────────────────────────────────────────

describe('QX-13 spy injection', () => {
  it('QX-13-01 execute() calls planner.plan() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synQueryResult());
    new QueryExecutor({ plan: spy } as unknown as QueryPlanner).execute({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('QX-13-02 execute() calls plan() with the exact descriptor object passed in', () => {
    const spy = vi.fn().mockReturnValue(synQueryResult());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new QueryExecutor({ plan: spy } as unknown as QueryPlanner).execute(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('QX-13-03 two execute() calls cause planner.plan() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synQueryResult());
    const executor = new QueryExecutor({ plan: spy } as unknown as QueryPlanner);
    executor.execute({ scope: 'required' });
    executor.execute({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
