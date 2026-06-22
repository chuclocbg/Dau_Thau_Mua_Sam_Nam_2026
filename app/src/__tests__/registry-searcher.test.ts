import { describe, it, expect, vi } from 'vitest';
import { RegistrySearcher, buildSearcher } from '../agents/RegistrySearcher';
import { DocumentRegistry }               from '../agents/DocumentRegistry';
import type { RegistryEntry }             from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }  from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }            from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type EntryInput = { filename: string; priority: number; required?: boolean; extension?: string; payload?: string };

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
      extension:    e.extension ?? 'DOCX',
      payload:      e.payload   ?? `CONTENT:${e.filename}`,
      priority:     e.priority,
      required:     e.required  ?? true,
      registeredAt: targetDate,
    };
    if (entry.required) requiredEntries.push(entry);
    else                optionalEntries.push(entry);
    index[e.filename] = entry;
  }

  const entries = [...requiredEntries, ...optionalEntries];
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE',
    impactLevel: opts.impactLevel ?? 'NONE',
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

// Two real registry results — kept separate so reference tests can compare.
const fwdRegistry  = new DocumentRegistry().register(FWD.last, FWD.cur);
const sameRegistry = new DocumentRegistry().register(SAME.last, SAME.cur);
const fwdSearcher  = new RegistrySearcher(fwdRegistry);
const sameSearcher = new RegistrySearcher(sameRegistry);

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
const mixedSearcher = new RegistrySearcher(mixedRegistry);

// ── RS-01 READY ───────────────────────────────────────────────────────────────

describe('RS-01 READY', () => {
  it('RS-01-01 listAll() returns 10 entries for forward result', () => {
    expect(fwdSearcher.listAll()).toHaveLength(10);
  });

  it('RS-01-02 findRequired() returns 10 entries for forward result', () => {
    expect(fwdSearcher.findRequired()).toHaveLength(10);
  });

  it('RS-01-03 findOptional() returns 0 entries for forward result', () => {
    expect(fwdSearcher.findOptional()).toHaveLength(0);
  });
});

// ── RS-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('RS-02 PENDING_APPROVAL', () => {
  const s = new RegistrySearcher(synRegistry({ status: 'PENDING_APPROVAL' }));

  it('RS-02-01 listAll() returns empty array', () => {
    expect(s.listAll()).toHaveLength(0);
  });

  it('RS-02-02 findRequired() returns empty array', () => {
    expect(s.findRequired()).toHaveLength(0);
  });

  it('RS-02-03 findOptional() returns empty array', () => {
    expect(s.findOptional()).toHaveLength(0);
  });
});

// ── RS-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('RS-03 UNCHANGED', () => {
  it('RS-03-01 listAll() returns empty array', () => {
    expect(sameSearcher.listAll()).toHaveLength(0);
  });

  it('RS-03-02 findByFilename returns undefined for any filename', () => {
    expect(sameSearcher.findByFilename('TO_TRINH_MUA_SAM')).toBeUndefined();
  });

  it('RS-03-03 findByPriority returns empty array', () => {
    expect(sameSearcher.findByPriority(1)).toHaveLength(0);
  });
});

// ── RS-04 findByFilename ───────────────────────────────────────────────────────

describe('RS-04 findByFilename', () => {
  it('RS-04-01 returns defined entry for known filename from forward result', () => {
    expect(fwdSearcher.findByFilename('TO_TRINH_MUA_SAM')).toBeDefined();
  });

  it('RS-04-02 returns undefined for unknown filename', () => {
    expect(fwdSearcher.findByFilename('NONEXISTENT_DOC')).toBeUndefined();
  });

  it('RS-04-03 returned entry has correct filename', () => {
    const entry = fwdSearcher.findByFilename('TO_TRINH_MUA_SAM');
    expect(entry?.filename).toBe('TO_TRINH_MUA_SAM');
  });
});

// ── RS-05 findRequired ─────────────────────────────────────────────────────────

describe('RS-05 findRequired', () => {
  it('RS-05-01 all entries in findRequired() have required=true', () => {
    expect(mixedSearcher.findRequired().every(e => e.required === true)).toBe(true);
  });

  it('RS-05-02 mixed — findRequired() has 4 items', () => {
    expect(mixedSearcher.findRequired()).toHaveLength(4);
  });

  it('RS-05-03 empty registry — findRequired() returns empty array', () => {
    const s = new RegistrySearcher(synRegistry({ status: 'READY', entries: [] }));
    expect(s.findRequired()).toHaveLength(0);
  });
});

// ── RS-06 findOptional ─────────────────────────────────────────────────────────

describe('RS-06 findOptional', () => {
  it('RS-06-01 all entries in findOptional() have required=false', () => {
    expect(mixedSearcher.findOptional().every(e => e.required === false)).toBe(true);
  });

  it('RS-06-02 mixed — findOptional() has 6 items', () => {
    expect(mixedSearcher.findOptional()).toHaveLength(6);
  });

  it('RS-06-03 empty registry — findOptional() returns empty array', () => {
    const s = new RegistrySearcher(synRegistry({ status: 'READY', entries: [] }));
    expect(s.findOptional()).toHaveLength(0);
  });
});

// ── RS-07 findByPriority ───────────────────────────────────────────────────────

describe('RS-07 findByPriority', () => {
  it('RS-07-01 mixed — findByPriority(2) returns 4 items', () => {
    expect(mixedSearcher.findByPriority(2)).toHaveLength(4);
  });

  it('RS-07-02 mixed — findByPriority(4) returns 6 items', () => {
    expect(mixedSearcher.findByPriority(4)).toHaveLength(6);
  });

  it('RS-07-03 findByPriority(99) returns empty array for unknown priority', () => {
    expect(mixedSearcher.findByPriority(99)).toHaveLength(0);
  });
});

// ── RS-08 listAll ──────────────────────────────────────────────────────────────

describe('RS-08 listAll', () => {
  it('RS-08-01 listAll() first item matches findRequired()[0]', () => {
    expect(mixedSearcher.listAll()[0]).toEqual(mixedSearcher.findRequired()[0]);
  });

  it('RS-08-02 listAll() length equals findRequired().length + findOptional().length', () => {
    expect(mixedSearcher.listAll().length)
      .toBe(mixedSearcher.findRequired().length + mixedSearcher.findOptional().length);
  });

  it('RS-08-03 listAll() last item matches last optionalEntry', () => {
    const all = mixedSearcher.listAll();
    const opt = mixedSearcher.findOptional();
    expect(all[all.length - 1]).toEqual(opt[opt.length - 1]);
  });
});

// ── RS-09 reference sharing ────────────────────────────────────────────────────

describe('RS-09 reference sharing', () => {
  it('RS-09-01 listAll() returns same reference as fwdRegistry.entries', () => {
    expect(fwdSearcher.listAll()).toBe(fwdRegistry.entries);
  });

  it('RS-09-02 findRequired() returns same reference as fwdRegistry.requiredEntries', () => {
    expect(fwdSearcher.findRequired()).toBe(fwdRegistry.requiredEntries);
  });

  it('RS-09-03 findOptional() returns same reference as fwdRegistry.optionalEntries', () => {
    expect(fwdSearcher.findOptional()).toBe(fwdRegistry.optionalEntries);
  });
});

// ── RS-10 metadata ─────────────────────────────────────────────────────────────

describe('RS-10 metadata', () => {
  it('RS-10-01 getMetadata().entryCount equals listAll().length', () => {
    expect(fwdSearcher.getMetadata().entryCount).toBe(fwdSearcher.listAll().length);
  });

  it('RS-10-02 getMetadata().targetDate is a non-empty string', () => {
    const td = fwdSearcher.getMetadata().targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('RS-10-03 getMetadata() returns same reference as fwdRegistry.metadata', () => {
    expect(fwdSearcher.getMetadata()).toBe(fwdRegistry.metadata);
  });
});

// ── RS-11 idempotency ──────────────────────────────────────────────────────────

describe('RS-11 idempotency', () => {
  it('RS-11-01 calling findRequired() twice returns the same reference', () => {
    expect(mixedSearcher.findRequired()).toBe(mixedSearcher.findRequired());
  });

  it('RS-11-02 calling listAll() twice returns the same reference', () => {
    expect(mixedSearcher.listAll()).toBe(mixedSearcher.listAll());
  });

  it('RS-11-03 calling findByFilename() twice for the same key returns the same reference', () => {
    const a = mixedSearcher.findByFilename('KE_HOACH_LCNT');
    const b = mixedSearcher.findByFilename('KE_HOACH_LCNT');
    expect(a).toBe(b);
  });
});

// ── RS-12 deterministic output ─────────────────────────────────────────────────

describe('RS-12 deterministic output', () => {
  it('RS-12-01 findByPriority(2) called twice returns equal arrays', () => {
    expect(mixedSearcher.findByPriority(2)).toEqual(mixedSearcher.findByPriority(2));
  });

  it('RS-12-02 findByFilename result is consistent with index entry', () => {
    const entry = mixedSearcher.findByFilename('KE_HOACH_LCNT');
    expect(entry?.filename).toBe('KE_HOACH_LCNT');
    expect(entry?.priority).toBe(2);
  });

  it('RS-12-03 findByPriority(2) items all have priority 2', () => {
    expect(mixedSearcher.findByPriority(2).every(e => e.priority === 2)).toBe(true);
  });
});

// ── RS-13 pipeline factory ─────────────────────────────────────────────────────

describe('RS-13 pipeline factory', () => {
  it('RS-13-01 buildSearcher() calls registry.register() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    buildSearcher(SAME.last, SAME.cur, { register: spy } as unknown as DocumentRegistry);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('RS-13-02 buildSearcher() calls register() with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    buildSearcher(SAME.last, SAME.cur, { register: spy } as unknown as DocumentRegistry);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('RS-13-03 two buildSearcher() calls use register() twice', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const mock = { register: spy } as unknown as DocumentRegistry;
    buildSearcher(SAME.last, SAME.cur, mock);
    buildSearcher(FWD.last, FWD.cur, mock);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
