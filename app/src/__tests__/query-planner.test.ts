import { describe, it, expect, vi } from 'vitest';
import { QueryPlanner }               from '../agents/QueryPlanner';
import { SearchEngine, buildEngine }  from '../agents/SearchEngine';
import type { RegistryEntry }         from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }        from '../agents/SnapshotBuilder';

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

function makeMock() {
  return {
    findRequired:   vi.fn().mockReturnValue([]),
    findOptional:   vi.fn().mockReturnValue([]),
    listAll:        vi.fn().mockReturnValue([]),
    findByFilename: vi.fn().mockReturnValue(undefined),
    getMetadata:    vi.fn().mockReturnValue({
      entryCount: 0, requiredCount: 0, optionalCount: 0, targetDate: '2026-01-01',
    }),
  };
}

// Real engines.
const fwdEngine    = buildEngine(FWD.last, FWD.cur);
const sameEngine   = buildEngine(SAME.last, SAME.cur);
const fwdPlanner   = new QueryPlanner(fwdEngine);
const samePlanner  = new QueryPlanner(sameEngine);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedEngine = new SearchEngine(synRegistry({
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
const mixedPlanner = new QueryPlanner(mixedEngine);

// ── QP-01 READY ───────────────────────────────────────────────────────────────

describe('QP-01 READY', () => {
  it('QP-01-01 forward — plan({}).entries has 10 items', () => {
    expect(fwdPlanner.plan({}).entries).toHaveLength(10);
  });

  it('QP-01-02 forward — plan({}).named is undefined', () => {
    expect(fwdPlanner.plan({}).named).toBeUndefined();
  });

  it('QP-01-03 forward — plan({}).metadata is same reference as engine.getMetadata()', () => {
    expect(fwdPlanner.plan({}).metadata).toBe(fwdEngine.getMetadata());
  });
});

// ── QP-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('QP-02 PENDING_APPROVAL', () => {
  const pendingEngine  = new SearchEngine(synRegistry({ status: 'PENDING_APPROVAL' }));
  const pendingPlanner = new QueryPlanner(pendingEngine);

  it('QP-02-01 entries is empty', () => {
    expect(pendingPlanner.plan({}).entries).toHaveLength(0);
  });

  it('QP-02-02 named is undefined', () => {
    expect(pendingPlanner.plan({ filename: 'TO_TRINH_MUA_SAM' }).named).toBeUndefined();
  });

  it('QP-02-03 descriptor is echoed', () => {
    const d = { scope: 'all' as const, filename: 'X' };
    expect(pendingPlanner.plan(d).descriptor).toBe(d);
  });
});

// ── QP-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('QP-03 UNCHANGED', () => {
  it('QP-03-01 entries is empty', () => {
    expect(samePlanner.plan({}).entries).toHaveLength(0);
  });

  it('QP-03-02 named is undefined even with filename specified', () => {
    expect(samePlanner.plan({ filename: 'TO_TRINH_MUA_SAM' }).named).toBeUndefined();
  });

  it('QP-03-03 entries is empty even with maxPriority specified', () => {
    expect(samePlanner.plan({ maxPriority: 9 }).entries).toHaveLength(0);
  });
});

// ── QP-04 scope=required ──────────────────────────────────────────────────────

describe('QP-04 scope=required', () => {
  it('QP-04-01 mixed — entries has 4 items', () => {
    expect(mixedPlanner.plan({ scope: 'required' }).entries).toHaveLength(4);
  });

  it('QP-04-02 all returned entries have required=true', () => {
    expect(
      mixedPlanner.plan({ scope: 'required' }).entries.every(e => e.required === true),
    ).toBe(true);
  });

  it('QP-04-03 forward — entries has 10 items', () => {
    expect(fwdPlanner.plan({ scope: 'required' }).entries).toHaveLength(10);
  });
});

// ── QP-05 scope=optional ──────────────────────────────────────────────────────

describe('QP-05 scope=optional', () => {
  it('QP-05-01 mixed — entries has 6 items', () => {
    expect(mixedPlanner.plan({ scope: 'optional' }).entries).toHaveLength(6);
  });

  it('QP-05-02 all returned entries have required=false', () => {
    expect(
      mixedPlanner.plan({ scope: 'optional' }).entries.every(e => e.required === false),
    ).toBe(true);
  });

  it('QP-05-03 forward — entries is empty (no optional documents)', () => {
    expect(fwdPlanner.plan({ scope: 'optional' }).entries).toHaveLength(0);
  });
});

// ── QP-06 scope=all ───────────────────────────────────────────────────────────

describe('QP-06 scope=all', () => {
  it('QP-06-01 explicit scope=all — mixed has 10 items', () => {
    expect(mixedPlanner.plan({ scope: 'all' }).entries).toHaveLength(10);
  });

  it('QP-06-02 no scope (undefined) produces same count as scope=all', () => {
    expect(mixedPlanner.plan({}).entries).toHaveLength(
      mixedPlanner.plan({ scope: 'all' }).entries.length,
    );
  });

  it('QP-06-03 first entry is required, last entry is optional', () => {
    const r = mixedPlanner.plan({ scope: 'all' });
    expect(r.entries[0].required).toBe(true);
    expect(r.entries[r.entries.length - 1].required).toBe(false);
  });
});

// ── QP-07 maxPriority filter ──────────────────────────────────────────────────

describe('QP-07 maxPriority filter', () => {
  it('QP-07-01 maxPriority=2 — mixed returns 4 items (priority=2 only)', () => {
    expect(mixedPlanner.plan({ maxPriority: 2 }).entries).toHaveLength(4);
  });

  it('QP-07-02 maxPriority=4 — mixed returns 10 items (all pass)', () => {
    expect(mixedPlanner.plan({ maxPriority: 4 }).entries).toHaveLength(10);
  });

  it('QP-07-03 maxPriority=1 — mixed returns 0 items (no priority=1 entries)', () => {
    expect(mixedPlanner.plan({ maxPriority: 1 }).entries).toHaveLength(0);
  });
});

// ── QP-08 filename lookup ─────────────────────────────────────────────────────

describe('QP-08 filename lookup', () => {
  it('QP-08-01 known filename — named entry has correct filename', () => {
    expect(fwdPlanner.plan({ filename: 'TO_TRINH_MUA_SAM' }).named?.filename)
      .toBe('TO_TRINH_MUA_SAM');
  });

  it('QP-08-02 unknown filename — named is undefined', () => {
    expect(fwdPlanner.plan({ filename: 'NONEXISTENT_DOC' }).named).toBeUndefined();
  });

  it('QP-08-03 named lookup is independent of scope', () => {
    // scope='optional' filters entries to optional docs, but named still resolves a required doc
    const r = mixedPlanner.plan({ scope: 'optional', filename: 'KE_HOACH_LCNT' });
    expect(r.entries).toHaveLength(6);
    expect(r.named?.filename).toBe('KE_HOACH_LCNT');
    expect(r.named?.required).toBe(true);
  });
});

// ── QP-09 combined scope + maxPriority ────────────────────────────────────────

describe('QP-09 combined scope + maxPriority', () => {
  it('QP-09-01 scope=required + maxPriority=2 — mixed returns 4 items', () => {
    expect(
      mixedPlanner.plan({ scope: 'required', maxPriority: 2 }).entries,
    ).toHaveLength(4);
  });

  it('QP-09-02 scope=all + maxPriority=2 — mixed returns 4 items (optionals filtered out)', () => {
    expect(
      mixedPlanner.plan({ scope: 'all', maxPriority: 2 }).entries,
    ).toHaveLength(4);
  });

  it('QP-09-03 scope=optional + maxPriority=2 — mixed returns 0 items (optionals have priority=4)', () => {
    expect(
      mixedPlanner.plan({ scope: 'optional', maxPriority: 2 }).entries,
    ).toHaveLength(0);
  });
});

// ── QP-10 reference sharing ───────────────────────────────────────────────────

describe('QP-10 reference sharing', () => {
  it('QP-10-01 scope=required, no maxPriority — entries is same reference as engine.findRequired()', () => {
    expect(mixedPlanner.plan({ scope: 'required' }).entries).toBe(mixedEngine.findRequired());
  });

  it('QP-10-02 scope=optional, no maxPriority — entries is same reference as engine.findOptional()', () => {
    expect(mixedPlanner.plan({ scope: 'optional' }).entries).toBe(mixedEngine.findOptional());
  });

  it('QP-10-03 scope=required with maxPriority — entries is a new filtered array, not the engine reference', () => {
    const r = mixedPlanner.plan({ scope: 'required', maxPriority: 2 });
    expect(r.entries).not.toBe(mixedEngine.findRequired());
  });
});

// ── QP-11 descriptor echo ─────────────────────────────────────────────────────

describe('QP-11 descriptor echo', () => {
  it('QP-11-01 result.descriptor is same reference as the input descriptor', () => {
    const d = { scope: 'required' as const, maxPriority: 2 };
    expect(fwdPlanner.plan(d).descriptor).toBe(d);
  });

  it('QP-11-02 result.descriptor.scope matches input', () => {
    const d = { scope: 'optional' as const };
    expect(mixedPlanner.plan(d).descriptor.scope).toBe('optional');
  });

  it('QP-11-03 result.descriptor.maxPriority matches input', () => {
    const d = { maxPriority: 3 };
    expect(mixedPlanner.plan(d).descriptor.maxPriority).toBe(3);
  });
});

// ── QP-12 deterministic output ────────────────────────────────────────────────

describe('QP-12 deterministic output', () => {
  it('QP-12-01 two plan() calls with the same descriptor produce entries of same length', () => {
    const d = { scope: 'required' as const, maxPriority: 2 };
    expect(mixedPlanner.plan(d).entries.length)
      .toBe(mixedPlanner.plan(d).entries.length);
  });

  it('QP-12-02 undefined scope and explicit scope=all produce same entries', () => {
    expect(mixedPlanner.plan({}).entries).toBe(mixedPlanner.plan({ scope: 'all' }).entries);
  });

  it('QP-12-03 filtered entries all satisfy the maxPriority constraint', () => {
    const max = 2;
    const r = mixedPlanner.plan({ maxPriority: max });
    expect(r.entries.every(e => e.priority <= max)).toBe(true);
  });
});

// ── QP-13 spy injection ───────────────────────────────────────────────────────

describe('QP-13 spy injection', () => {
  it('QP-13-01 scope=required calls findRequired() once and never findOptional()', () => {
    const mock = makeMock();
    new QueryPlanner(mock as unknown as SearchEngine).plan({ scope: 'required' });
    expect(mock.findRequired).toHaveBeenCalledOnce();
    expect(mock.findOptional).not.toHaveBeenCalled();
  });

  it('QP-13-02 scope=optional calls findOptional() once and never findRequired()', () => {
    const mock = makeMock();
    new QueryPlanner(mock as unknown as SearchEngine).plan({ scope: 'optional' });
    expect(mock.findOptional).toHaveBeenCalledOnce();
    expect(mock.findRequired).not.toHaveBeenCalled();
  });

  it('QP-13-03 filename calls findByFilename() with the correct argument', () => {
    const mock = makeMock();
    new QueryPlanner(mock as unknown as SearchEngine).plan({ filename: 'KE_HOACH_LCNT' });
    expect(mock.findByFilename).toHaveBeenCalledWith('KE_HOACH_LCNT');
    expect(mock.findByFilename).toHaveBeenCalledOnce();
  });
});
