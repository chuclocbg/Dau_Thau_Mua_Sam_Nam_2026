import { describe, it, expect, vi } from 'vitest';
import { SearchEngine, buildEngine }  from '../agents/SearchEngine';
import { DocumentRegistry }           from '../agents/DocumentRegistry';
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

// Two real registry results — shared across groups that need real data.
const fwdRegistry  = new DocumentRegistry().register(FWD.last, FWD.cur);
const sameRegistry = new DocumentRegistry().register(SAME.last, SAME.cur);
const fwdEngine    = new SearchEngine(fwdRegistry);
const sameEngine   = new SearchEngine(sameRegistry);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4)
const mixedRegistry = synRegistry({
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
});
const mixedEngine = new SearchEngine(mixedRegistry);

// ── SE-01 READY ───────────────────────────────────────────────────────────────

describe('SE-01 READY', () => {
  it('SE-01-01 status is READY', () => {
    expect(fwdEngine.getMetadata().targetDate).toBe(fwdRegistry.metadata.targetDate);
  });

  it('SE-01-02 forward — listAll() has 10 items', () => {
    expect(fwdEngine.listAll()).toHaveLength(10);
  });

  it('SE-01-03 forward — findRequired() has 10 items', () => {
    expect(fwdEngine.findRequired()).toHaveLength(10);
  });
});

// ── SE-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('SE-02 PENDING_APPROVAL', () => {
  const e = new SearchEngine(synRegistry({ status: 'PENDING_APPROVAL' }));

  it('SE-02-01 listAll() returns empty array', () => {
    expect(e.listAll()).toHaveLength(0);
  });

  it('SE-02-02 findRequired() returns empty array', () => {
    expect(e.findRequired()).toHaveLength(0);
  });

  it('SE-02-03 findOptional() returns empty array', () => {
    expect(e.findOptional()).toHaveLength(0);
  });
});

// ── SE-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('SE-03 UNCHANGED', () => {
  it('SE-03-01 listAll() returns empty array', () => {
    expect(sameEngine.listAll()).toHaveLength(0);
  });

  it('SE-03-02 findByFilename returns undefined', () => {
    expect(sameEngine.findByFilename('TO_TRINH_MUA_SAM')).toBeUndefined();
  });

  it('SE-03-03 findByPriority returns empty array', () => {
    expect(sameEngine.findByPriority(1)).toHaveLength(0);
  });
});

// ── SE-04 findByFilename ──────────────────────────────────────────────────────

describe('SE-04 findByFilename', () => {
  it('SE-04-01 known filename returns defined entry', () => {
    expect(fwdEngine.findByFilename('TO_TRINH_MUA_SAM')).toBeDefined();
  });

  it('SE-04-02 unknown filename returns undefined', () => {
    expect(fwdEngine.findByFilename('NONEXISTENT_DOC')).toBeUndefined();
  });

  it('SE-04-03 returned entry has correct filename', () => {
    expect(fwdEngine.findByFilename('TO_TRINH_MUA_SAM')?.filename).toBe('TO_TRINH_MUA_SAM');
  });
});

// ── SE-05 findByPriority ──────────────────────────────────────────────────────

describe('SE-05 findByPriority', () => {
  it('SE-05-01 mixed — findByPriority(2) has 4 items', () => {
    expect(mixedEngine.findByPriority(2)).toHaveLength(4);
  });

  it('SE-05-02 mixed — findByPriority(4) has 6 items', () => {
    expect(mixedEngine.findByPriority(4)).toHaveLength(6);
  });

  it('SE-05-03 findByPriority(99) returns empty array for unknown priority', () => {
    expect(mixedEngine.findByPriority(99)).toHaveLength(0);
  });
});

// ── SE-06 findRequired ────────────────────────────────────────────────────────

describe('SE-06 findRequired', () => {
  it('SE-06-01 all findRequired() entries have required=true', () => {
    expect(mixedEngine.findRequired().every(e => e.required === true)).toBe(true);
  });

  it('SE-06-02 mixed — findRequired() has 4 items', () => {
    expect(mixedEngine.findRequired()).toHaveLength(4);
  });

  it('SE-06-03 empty registry — findRequired() returns empty array', () => {
    const e = new SearchEngine(synRegistry({ status: 'READY', entries: [] }));
    expect(e.findRequired()).toHaveLength(0);
  });
});

// ── SE-07 findOptional ────────────────────────────────────────────────────────

describe('SE-07 findOptional', () => {
  it('SE-07-01 all findOptional() entries have required=false', () => {
    expect(mixedEngine.findOptional().every(e => e.required === false)).toBe(true);
  });

  it('SE-07-02 mixed — findOptional() has 6 items', () => {
    expect(mixedEngine.findOptional()).toHaveLength(6);
  });

  it('SE-07-03 forward — findOptional() returns empty array', () => {
    expect(fwdEngine.findOptional()).toHaveLength(0);
  });
});

// ── SE-08 listAll ─────────────────────────────────────────────────────────────

describe('SE-08 listAll', () => {
  it('SE-08-01 listAll().length equals findRequired().length + findOptional().length', () => {
    expect(mixedEngine.listAll().length)
      .toBe(mixedEngine.findRequired().length + mixedEngine.findOptional().length);
  });

  it('SE-08-02 listAll() first item equals findRequired()[0]', () => {
    expect(mixedEngine.listAll()[0]).toEqual(mixedEngine.findRequired()[0]);
  });

  it('SE-08-03 listAll() last item equals last findOptional() item', () => {
    const all = mixedEngine.listAll();
    const opt = mixedEngine.findOptional();
    expect(all[all.length - 1]).toEqual(opt[opt.length - 1]);
  });
});

// ── SE-09 getMetadata ─────────────────────────────────────────────────────────

describe('SE-09 getMetadata', () => {
  it('SE-09-01 getMetadata().entryCount equals listAll().length', () => {
    expect(fwdEngine.getMetadata().entryCount).toBe(fwdEngine.listAll().length);
  });

  it('SE-09-02 getMetadata().targetDate is a non-empty string', () => {
    const td = fwdEngine.getMetadata().targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('SE-09-03 getMetadata() returns same reference as fwdRegistry.metadata', () => {
    expect(fwdEngine.getMetadata()).toBe(fwdRegistry.metadata);
  });
});

// ── SE-10 reference sharing ───────────────────────────────────────────────────

describe('SE-10 reference sharing', () => {
  it('SE-10-01 listAll() returns same reference as fwdRegistry.entries', () => {
    expect(fwdEngine.listAll()).toBe(fwdRegistry.entries);
  });

  it('SE-10-02 findRequired() returns same reference as fwdRegistry.requiredEntries', () => {
    expect(fwdEngine.findRequired()).toBe(fwdRegistry.requiredEntries);
  });

  it('SE-10-03 findOptional() returns same reference as fwdRegistry.optionalEntries', () => {
    expect(fwdEngine.findOptional()).toBe(fwdRegistry.optionalEntries);
  });
});

// ── SE-11 priority delegation via SearchIndex ─────────────────────────────────

describe('SE-11 priority delegation', () => {
  it('SE-11-01 findByPriority(2) called twice returns the same reference', () => {
    expect(mixedEngine.findByPriority(2)).toBe(mixedEngine.findByPriority(2));
  });

  it('SE-11-02 findByPriority(99) returns empty array', () => {
    expect(mixedEngine.findByPriority(99)).toHaveLength(0);
  });

  it('SE-11-03 findByPriority(2) items all have priority 2', () => {
    expect(mixedEngine.findByPriority(2).every(e => e.priority === 2)).toBe(true);
  });
});

// ── SE-12 deterministic output ────────────────────────────────────────────────

describe('SE-12 deterministic output', () => {
  it('SE-12-01 findByFilename called twice for same key returns same reference', () => {
    const a = mixedEngine.findByFilename('KE_HOACH_LCNT');
    const b = mixedEngine.findByFilename('KE_HOACH_LCNT');
    expect(a).toBe(b);
  });

  it('SE-12-02 listAll() called twice returns same reference', () => {
    expect(mixedEngine.listAll()).toBe(mixedEngine.listAll());
  });

  it('SE-12-03 getMetadata() called twice returns same reference', () => {
    expect(fwdEngine.getMetadata()).toBe(fwdEngine.getMetadata());
  });
});

// ── SE-13 pipeline factory ────────────────────────────────────────────────────

describe('SE-13 pipeline factory', () => {
  it('SE-13-01 buildEngine() calls registry.register() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    buildEngine(SAME.last, SAME.cur, { register: spy } as unknown as DocumentRegistry);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('SE-13-02 buildEngine() calls register() with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    buildEngine(SAME.last, SAME.cur, { register: spy } as unknown as DocumentRegistry);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('SE-13-03 two buildEngine() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const mock = { register: spy } as unknown as DocumentRegistry;
    buildEngine(SAME.last, SAME.cur, mock);
    buildEngine(FWD.last, FWD.cur, mock);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
