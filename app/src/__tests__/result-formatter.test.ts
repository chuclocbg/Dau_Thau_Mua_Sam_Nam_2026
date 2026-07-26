import { describe, it, expect, vi } from 'vitest';
import { ResultFormatter } from '../agents/ResultFormatter';
import { QueryExecutor, buildExecutor }                         from '../agents/QueryExecutor';
import { QueryPlanner }                                         from '../agents/QueryPlanner';
import { SearchEngine }                                         from '../agents/SearchEngine';
import type { QueryDescriptor }                                 from '../agents/QueryPlanner';
import type { RegistryEntry }                                   from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                        from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                                  from '../agents/SnapshotBuilder';

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

function synExecution(opts: {
  entries?:    readonly RegistryEntry[];
  named?:      RegistryEntry;
  descriptor?: QueryDescriptor;
  targetDate?: string;
} = {}) {
  const entries = opts.entries ?? [];
  return {
    entries,
    named:      opts.named,
    descriptor: opts.descriptor ?? {},
    metadata: {
      entryCount:    entries.length,
      requiredCount: entries.filter(e => e.required).length,
      optionalCount: entries.filter(e => !e.required).length,
      targetDate:    opts.targetDate ?? '2026-01-01',
    },
    summary: {
      entryCount: entries.length,
      namedFound: opts.named !== undefined,
      hasResults: entries.length > 0,
    },
  };
}

// Real pipeline.
const fwdExecutor    = buildExecutor(FWD.last, FWD.cur);
const sameExecutor   = buildExecutor(SAME.last, SAME.cur);
const fwdFormatter   = new ResultFormatter(fwdExecutor);
const sameFormatter  = new ResultFormatter(sameExecutor);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedExecutor = new QueryExecutor(new QueryPlanner(makeEngine({
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
})));
const mixedFormatter = new ResultFormatter(mixedExecutor);

// ── RF-01 READY ───────────────────────────────────────────────────────────────

describe('RF-01 READY', () => {
  it('RF-01-01 forward — format({}).entries has 10 items', () => {
    expect(fwdFormatter.format({}).entries).toHaveLength(10);
  });

  it('RF-01-02 forward — format({}).filenames has 10 items', () => {
    expect(fwdFormatter.format({}).filenames).toHaveLength(10);
  });

  it('RF-01-03 forward — format({}).totalCount is 10', () => {
    expect(fwdFormatter.format({}).totalCount).toBe(10);
  });
});

// ── RF-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('RF-02 PENDING_APPROVAL', () => {
  const f = new ResultFormatter(
    new QueryExecutor(new QueryPlanner(makeEngine({ status: 'PENDING_APPROVAL' }))),
  );

  it('RF-02-01 entries is empty', () => {
    expect(f.format({}).entries).toHaveLength(0);
  });

  it('RF-02-02 hasResults is false', () => {
    expect(f.format({}).hasResults).toBe(false);
  });

  it('RF-02-03 totalCount is 0', () => {
    expect(f.format({}).totalCount).toBe(0);
  });
});

// ── RF-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('RF-03 UNCHANGED', () => {
  it('RF-03-01 entries is empty', () => {
    expect(sameFormatter.format({}).entries).toHaveLength(0);
  });

  it('RF-03-02 named is undefined', () => {
    expect(sameFormatter.format({ filename: 'TO_TRINH_MUA_SAM' }).named).toBeUndefined();
  });

  it('RF-03-03 filenames is empty', () => {
    expect(sameFormatter.format({}).filenames).toHaveLength(0);
  });
});

// ── RF-04 label field ─────────────────────────────────────────────────────────

describe('RF-04 label field', () => {
  it('RF-04-01 each entry has label equal to filename + "." + extension', () => {
    const r = fwdFormatter.format({});
    expect(r.entries.every(e => e.label === `${e.filename}.${e.extension}`)).toBe(true);
  });

  it('RF-04-02 forward first entry label is "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdFormatter.format({}).entries[0].label).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('RF-04-03 all entries have labels ending with ".DOCX"', () => {
    expect(fwdFormatter.format({}).entries.every(e => e.label.endsWith('.DOCX'))).toBe(true);
  });
});

// ── RF-05 filenames list ──────────────────────────────────────────────────────

describe('RF-05 filenames list', () => {
  it('RF-05-01 filenames[0] matches entries[0].filename', () => {
    const r = fwdFormatter.format({});
    expect(r.filenames[0]).toBe(r.entries[0].filename);
  });

  it('RF-05-02 filenames.length equals entries.length', () => {
    const r = mixedFormatter.format({});
    expect(r.filenames.length).toBe(r.entries.length);
  });

  it('RF-05-03 forward filenames includes "TO_TRINH_MUA_SAM"', () => {
    expect(fwdFormatter.format({}).filenames).toContain('TO_TRINH_MUA_SAM');
  });
});

// ── RF-06 labels list ─────────────────────────────────────────────────────────

describe('RF-06 labels list', () => {
  it('RF-06-01 labels[0] equals entries[0].label', () => {
    const r = fwdFormatter.format({});
    expect(r.labels[0]).toBe(r.entries[0].label);
  });

  it('RF-06-02 labels.length equals entries.length', () => {
    const r = mixedFormatter.format({});
    expect(r.labels.length).toBe(r.entries.length);
  });

  it('RF-06-03 all labels are non-empty strings', () => {
    const r = fwdFormatter.format({});
    expect(r.labels.every(l => typeof l === 'string' && l.length > 0)).toBe(true);
  });
});

// ── RF-07 named entry ─────────────────────────────────────────────────────────

describe('RF-07 named entry', () => {
  it('RF-07-01 named is defined and has correct filename when found', () => {
    expect(fwdFormatter.format({ filename: 'TO_TRINH_MUA_SAM' }).named?.filename)
      .toBe('TO_TRINH_MUA_SAM');
  });

  it('RF-07-02 named.label is correctly formatted', () => {
    expect(fwdFormatter.format({ filename: 'TO_TRINH_MUA_SAM' }).named?.label)
      .toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('RF-07-03 named is undefined when filename not in registry', () => {
    expect(fwdFormatter.format({ filename: 'NONEXISTENT_DOC' }).named).toBeUndefined();
  });
});

// ── RF-08 counts ──────────────────────────────────────────────────────────────

describe('RF-08 counts', () => {
  it('RF-08-01 mixed scope=all — requiredCount=4, optionalCount=6', () => {
    const r = mixedFormatter.format({ scope: 'all' });
    expect(r.requiredCount).toBe(4);
    expect(r.optionalCount).toBe(6);
  });

  it('RF-08-02 mixed scope=required — requiredCount=4, optionalCount=0', () => {
    const r = mixedFormatter.format({ scope: 'required' });
    expect(r.requiredCount).toBe(4);
    expect(r.optionalCount).toBe(0);
  });

  it('RF-08-03 requiredCount + optionalCount equals totalCount', () => {
    const r = mixedFormatter.format({});
    expect(r.requiredCount + r.optionalCount).toBe(r.totalCount);
  });
});

// ── RF-09 targetDate ──────────────────────────────────────────────────────────

describe('RF-09 targetDate', () => {
  it('RF-09-01 targetDate is a non-empty string', () => {
    const td = fwdFormatter.format({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('RF-09-02 targetDate matches metadata.targetDate from the execution', () => {
    expect(fwdFormatter.format({}).targetDate)
      .toBe(fwdExecutor.execute({}).metadata.targetDate);
  });

  it('RF-09-03 custom targetDate forwarded correctly', () => {
    const f = new ResultFormatter(
      new QueryExecutor(new QueryPlanner(makeEngine({ targetDate: '2099-12-31' }))),
    );
    expect(f.format({}).targetDate).toBe('2099-12-31');
  });
});

// ── RF-10 ordering ────────────────────────────────────────────────────────────

describe('RF-10 ordering', () => {
  it('RF-10-01 entries preserve source order — first is KE_HOACH_LCNT for mixed', () => {
    expect(mixedFormatter.format({ scope: 'all' }).entries[0].filename).toBe('KE_HOACH_LCNT');
  });

  it('RF-10-02 filenames preserve source order — same positions as entries', () => {
    const r = mixedFormatter.format({});
    expect(r.filenames.every((fn, i) => fn === r.entries[i].filename)).toBe(true);
  });

  it('RF-10-03 labels preserve source order — same positions as entries', () => {
    const r = fwdFormatter.format({});
    expect(r.labels.every((lbl, i) => lbl === r.entries[i].label)).toBe(true);
  });
});

// ── RF-11 descriptor echo ─────────────────────────────────────────────────────

describe('RF-11 descriptor echo', () => {
  it('RF-11-01 result.descriptor is same reference as the input descriptor', () => {
    const d = { scope: 'required' as const, maxPriority: 2 };
    expect(fwdFormatter.format(d).descriptor).toBe(d);
  });

  it('RF-11-02 result.descriptor.scope matches input', () => {
    const d = { scope: 'optional' as const };
    expect(mixedFormatter.format(d).descriptor.scope).toBe('optional');
  });

  it('RF-11-03 result.descriptor.maxPriority matches input', () => {
    const d = { maxPriority: 3 };
    expect(mixedFormatter.format(d).descriptor.maxPriority).toBe(3);
  });
});

// ── RF-12 deterministic output ────────────────────────────────────────────────

describe('RF-12 deterministic output', () => {
  it('RF-12-01 two format() calls with same descriptor produce same entries length', () => {
    const d = { scope: 'required' as const };
    expect(mixedFormatter.format(d).entries.length)
      .toBe(mixedFormatter.format(d).entries.length);
  });

  it('RF-12-02 entries[0].label equals entries[0].filename + "." + entries[0].extension', () => {
    const e = fwdFormatter.format({}).entries[0];
    expect(e.label).toBe(`${e.filename}.${e.extension}`);
  });

  it('RF-12-03 hasResults is consistent with totalCount > 0', () => {
    const r = mixedFormatter.format({ maxPriority: 2 });
    expect(r.hasResults).toBe(r.totalCount > 0);
  });
});

// ── RF-13 spy injection ───────────────────────────────────────────────────────

describe('RF-13 spy injection', () => {
  it('RF-13-01 format() calls executor.execute() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synExecution());
    new ResultFormatter({ execute: spy } as unknown as QueryExecutor)
      .format({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('RF-13-02 format() calls execute() with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synExecution());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new ResultFormatter({ execute: spy } as unknown as QueryExecutor).format(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('RF-13-03 two format() calls cause executor.execute() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synExecution());
    const formatter = new ResultFormatter({ execute: spy } as unknown as QueryExecutor);
    formatter.format({ scope: 'required' });
    formatter.format({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
