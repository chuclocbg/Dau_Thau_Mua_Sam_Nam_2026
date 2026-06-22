import { describe, it, expect, vi } from 'vitest';
import { DocumentManifest, buildManifest, manifestFromFormatted } from '../agents/DocumentManifest';
import { ResultFormatter, buildFormatter }                        from '../agents/ResultFormatter';
import { QueryExecutor }                                          from '../agents/QueryExecutor';
import { QueryPlanner }                                           from '../agents/QueryPlanner';
import { SearchEngine }                                           from '../agents/SearchEngine';
import type { FormattedEntry }                                    from '../agents/ResultFormatter';
import type { QueryDescriptor }                                   from '../agents/QueryPlanner';
import type { RegistryEntry }                                     from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                          from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                                    from '../agents/SnapshotBuilder';

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

function makeEngine(opts: Parameters<typeof synRegistry>[0]) {
  return new SearchEngine(synRegistry(opts));
}

function synFormatted(opts: {
  entries?:      readonly FormattedEntry[];
  named?:        FormattedEntry;
  requiredCount?: number;
  optionalCount?: number;
  totalCount?:    number;
  targetDate?:   string;
  hasResults?:   boolean;
  descriptor?:   QueryDescriptor;
} = {}) {
  const entries      = opts.entries      ?? [];
  const requiredCount = opts.requiredCount ?? 0;
  const optionalCount = opts.optionalCount ?? 0;
  return {
    entries,
    named:        opts.named,
    filenames:    entries.map(e => e.filename),
    labels:       entries.map(e => e.label),
    requiredCount,
    optionalCount,
    totalCount:   opts.totalCount  ?? entries.length,
    targetDate:   opts.targetDate  ?? '2026-01-01',
    hasResults:   opts.hasResults  ?? entries.length > 0,
    descriptor:   opts.descriptor  ?? {},
  };
}

// Real pipeline.
const fwdFormatter   = buildFormatter(FWD.last, FWD.cur);
const sameFormatter  = buildFormatter(SAME.last, SAME.cur);
const fwdManifest    = new DocumentManifest(fwdFormatter);
const sameManifest   = new DocumentManifest(sameFormatter);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedFormatter = new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({
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
}))));
const mixedManifest = new DocumentManifest(mixedFormatter);

// ── DM-01 READY ───────────────────────────────────────────────────────────────

describe('DM-01 READY', () => {
  it('DM-01-01 forward — manifest({}).header.totalCount is 10', () => {
    expect(fwdManifest.manifest({}).header.totalCount).toBe(10);
  });

  it('DM-01-02 forward — manifest({}).all has 10 items', () => {
    expect(fwdManifest.manifest({}).all).toHaveLength(10);
  });

  it('DM-01-03 forward — manifest({}).header.hasResults is true', () => {
    expect(fwdManifest.manifest({}).header.hasResults).toBe(true);
  });
});

// ── DM-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('DM-02 PENDING_APPROVAL', () => {
  const m = new DocumentManifest(
    new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({ status: 'PENDING_APPROVAL' })))),
  );

  it('DM-02-01 all is empty', () => {
    expect(m.manifest({}).all).toHaveLength(0);
  });

  it('DM-02-02 required is empty', () => {
    expect(m.manifest({}).required).toHaveLength(0);
  });

  it('DM-02-03 header.hasResults is false', () => {
    expect(m.manifest({}).header.hasResults).toBe(false);
  });
});

// ── DM-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('DM-03 UNCHANGED', () => {
  it('DM-03-01 all is empty', () => {
    expect(sameManifest.manifest({}).all).toHaveLength(0);
  });

  it('DM-03-02 named is undefined', () => {
    expect(sameManifest.manifest({ filename: 'TO_TRINH_MUA_SAM' }).named).toBeUndefined();
  });

  it('DM-03-03 header.totalCount is 0', () => {
    expect(sameManifest.manifest({}).header.totalCount).toBe(0);
  });
});

// ── DM-04 header fields ───────────────────────────────────────────────────────

describe('DM-04 header fields', () => {
  it('DM-04-01 header.targetDate is a non-empty string', () => {
    const td = fwdManifest.manifest({}).header.targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('DM-04-02 mixed scope=all — requiredCount=4, optionalCount=6', () => {
    const h = mixedManifest.manifest({ scope: 'all' }).header;
    expect(h.requiredCount).toBe(4);
    expect(h.optionalCount).toBe(6);
  });

  it('DM-04-03 header.requiredCount + optionalCount equals totalCount', () => {
    const h = mixedManifest.manifest({}).header;
    expect(h.requiredCount + h.optionalCount).toBe(h.totalCount);
  });
});

// ── DM-05 header.hasResults ───────────────────────────────────────────────────

describe('DM-05 header.hasResults', () => {
  it('DM-05-01 true for forward result', () => {
    expect(fwdManifest.manifest({}).header.hasResults).toBe(true);
  });

  it('DM-05-02 false for UNCHANGED', () => {
    expect(sameManifest.manifest({}).header.hasResults).toBe(false);
  });

  it('DM-05-03 false when maxPriority filters everything out', () => {
    expect(mixedManifest.manifest({ maxPriority: 1 }).header.hasResults).toBe(false);
  });
});

// ── DM-06 required section ────────────────────────────────────────────────────

describe('DM-06 required section', () => {
  it('DM-06-01 mixed — required has 4 items', () => {
    expect(mixedManifest.manifest({}).required).toHaveLength(4);
  });

  it('DM-06-02 all items in required have required=true', () => {
    expect(mixedManifest.manifest({}).required.every(e => e.required)).toBe(true);
  });

  it('DM-06-03 required[0] is same reference as all[0]', () => {
    const m = mixedManifest.manifest({});
    expect(m.required[0]).toBe(m.all[0]);
  });
});

// ── DM-07 optional section ────────────────────────────────────────────────────

describe('DM-07 optional section', () => {
  it('DM-07-01 mixed — optional has 6 items', () => {
    expect(mixedManifest.manifest({}).optional).toHaveLength(6);
  });

  it('DM-07-02 all items in optional have required=false', () => {
    expect(mixedManifest.manifest({}).optional.every(e => !e.required)).toBe(true);
  });

  it('DM-07-03 forward — optional is empty (all forward docs are required)', () => {
    expect(fwdManifest.manifest({}).optional).toHaveLength(0);
  });
});

// ── DM-08 all section ─────────────────────────────────────────────────────────

describe('DM-08 all section', () => {
  it('DM-08-01 mixed — all has 10 items', () => {
    expect(mixedManifest.manifest({}).all).toHaveLength(10);
  });

  it('DM-08-02 required.length + optional.length equals all.length', () => {
    const m = mixedManifest.manifest({});
    expect(m.required.length + m.optional.length).toBe(m.all.length);
  });

  it('DM-08-03 all is same reference as input FormattedResult.entries', () => {
    const fmtResult = fwdFormatter.format({});
    expect(manifestFromFormatted(fmtResult).all).toBe(fmtResult.entries);
  });
});

// ── DM-09 named callout ───────────────────────────────────────────────────────

describe('DM-09 named callout', () => {
  it('DM-09-01 named is defined with correct filename when found', () => {
    expect(fwdManifest.manifest({ filename: 'TO_TRINH_MUA_SAM' }).named?.filename)
      .toBe('TO_TRINH_MUA_SAM');
  });

  it('DM-09-02 named.label is correctly formatted', () => {
    expect(fwdManifest.manifest({ filename: 'TO_TRINH_MUA_SAM' }).named?.label)
      .toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('DM-09-03 named is undefined when filename not in registry', () => {
    expect(fwdManifest.manifest({ filename: 'NONEXISTENT_DOC' }).named).toBeUndefined();
  });
});

// ── DM-10 scope interaction ───────────────────────────────────────────────────

describe('DM-10 scope interaction', () => {
  it('DM-10-01 scope=required — required.length equals header.totalCount', () => {
    const m = mixedManifest.manifest({ scope: 'required' });
    expect(m.required.length).toBe(m.header.totalCount);
  });

  it('DM-10-02 scope=required — optional is empty', () => {
    expect(mixedManifest.manifest({ scope: 'required' }).optional).toHaveLength(0);
  });

  it('DM-10-03 scope=optional — required is empty', () => {
    expect(mixedManifest.manifest({ scope: 'optional' }).required).toHaveLength(0);
  });
});

// ── DM-11 descriptor echo ─────────────────────────────────────────────────────

describe('DM-11 descriptor echo', () => {
  it('DM-11-01 header.descriptor is same reference as the input descriptor', () => {
    const d = { scope: 'required' as const, maxPriority: 2 };
    expect(fwdManifest.manifest(d).header.descriptor).toBe(d);
  });

  it('DM-11-02 header.descriptor.scope matches input', () => {
    const d = { scope: 'optional' as const };
    expect(mixedManifest.manifest(d).header.descriptor.scope).toBe('optional');
  });

  it('DM-11-03 header.descriptor.maxPriority matches input', () => {
    const d = { maxPriority: 3 };
    expect(mixedManifest.manifest(d).header.descriptor.maxPriority).toBe(3);
  });
});

// ── DM-12 deterministic output ────────────────────────────────────────────────

describe('DM-12 deterministic output', () => {
  it('DM-12-01 two manifest() calls with same descriptor produce same header.totalCount', () => {
    const d = { scope: 'required' as const };
    expect(mixedManifest.manifest(d).header.totalCount)
      .toBe(mixedManifest.manifest(d).header.totalCount);
  });

  it('DM-12-02 required[0].label equals filename + "." + extension invariant', () => {
    const e = mixedManifest.manifest({}).required[0];
    expect(e.label).toBe(`${e.filename}.${e.extension}`);
  });

  it('DM-12-03 header.hasResults equals header.totalCount > 0', () => {
    const h = mixedManifest.manifest({ maxPriority: 2 }).header;
    expect(h.hasResults).toBe(h.totalCount > 0);
  });
});

// ── DM-13 spy injection ───────────────────────────────────────────────────────

describe('DM-13 spy injection', () => {
  it('DM-13-01 manifest() calls formatter.format() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synFormatted());
    new DocumentManifest({ format: spy } as unknown as ResultFormatter)
      .manifest({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('DM-13-02 manifest() calls format() with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synFormatted());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new DocumentManifest({ format: spy } as unknown as ResultFormatter).manifest(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('DM-13-03 two manifest() calls cause formatter.format() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synFormatted());
    const dm = new DocumentManifest({ format: spy } as unknown as ResultFormatter);
    dm.manifest({ scope: 'required' });
    dm.manifest({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
