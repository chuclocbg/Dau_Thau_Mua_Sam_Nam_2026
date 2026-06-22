import { describe, it, expect, vi } from 'vitest';
import { SearchIndexBuilder, buildIndexFromRegistry } from '../agents/SearchIndexBuilder';
import { DocumentRegistry }                           from '../agents/DocumentRegistry';
import type { RegistryEntry }                         from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }              from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                        from '../agents/SnapshotBuilder';

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
  }

  const entries = [...requiredEntries, ...optionalEntries];
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE' as ImpactScope,
    impactLevel: opts.impactLevel ?? 'NONE' as ImpactLevel,
    entries,
    requiredEntries,
    optionalEntries,
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
const fwdIndex     = buildIndexFromRegistry(fwdRegistry);
const sameIndex    = buildIndexFromRegistry(sameRegistry);

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
const mixedIndex = buildIndexFromRegistry(mixedRegistry);

// ── SI-01 READY ───────────────────────────────────────────────────────────────

describe('SI-01 READY', () => {
  it('SI-01-01 status is READY', () => {
    expect(fwdIndex.status).toBe('READY');
  });

  it('SI-01-02 forward — priorityIndex[1] has 10 items', () => {
    expect(fwdIndex.priorityIndex[1]).toHaveLength(10);
  });

  it('SI-01-03 forward — requiredIndex has 10 items', () => {
    expect(fwdIndex.requiredIndex).toHaveLength(10);
  });
});

// ── SI-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('SI-02 PENDING_APPROVAL', () => {
  const r = buildIndexFromRegistry(synRegistry({ status: 'PENDING_APPROVAL' }));

  it('SI-02-01 status forwarded as PENDING_APPROVAL', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('SI-02-02 priorityIndex is empty', () => {
    expect(Object.keys(r.priorityIndex)).toHaveLength(0);
  });

  it('SI-02-03 requiredIndex and optionalIndex are empty', () => {
    expect(r.requiredIndex).toHaveLength(0);
    expect(r.optionalIndex).toHaveLength(0);
  });
});

// ── SI-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('SI-03 UNCHANGED', () => {
  it('SI-03-01 status is UNCHANGED', () => {
    expect(sameIndex.status).toBe('UNCHANGED');
  });

  it('SI-03-02 priorityIndex is empty', () => {
    expect(Object.keys(sameIndex.priorityIndex)).toHaveLength(0);
  });

  it('SI-03-03 requiredIndex is empty', () => {
    expect(sameIndex.requiredIndex).toHaveLength(0);
  });
});

// ── SI-04 priorityIndex grouping ──────────────────────────────────────────────

describe('SI-04 priorityIndex grouping', () => {
  it('SI-04-01 mixed — priorityIndex[2] has 4 items', () => {
    expect(mixedIndex.priorityIndex[2]).toHaveLength(4);
  });

  it('SI-04-02 mixed — priorityIndex[4] has 6 items', () => {
    expect(mixedIndex.priorityIndex[4]).toHaveLength(6);
  });

  it('SI-04-03 forward — priorityIndex[1] has 10 items', () => {
    expect(fwdIndex.priorityIndex[1]).toHaveLength(10);
  });
});

// ── SI-05 priorityIndex key count ─────────────────────────────────────────────

describe('SI-05 priorityIndex key count', () => {
  it('SI-05-01 mixed — priorityIndex has exactly 2 keys', () => {
    expect(Object.keys(mixedIndex.priorityIndex)).toHaveLength(2);
  });

  it('SI-05-02 forward — priorityIndex has exactly 1 key', () => {
    expect(Object.keys(fwdIndex.priorityIndex)).toHaveLength(1);
  });

  it('SI-05-03 empty registry — priorityIndex has 0 keys', () => {
    const r = buildIndexFromRegistry(synRegistry({ status: 'READY', entries: [] }));
    expect(Object.keys(r.priorityIndex)).toHaveLength(0);
  });
});

// ── SI-06 requiredIndex ───────────────────────────────────────────────────────

describe('SI-06 requiredIndex', () => {
  it('SI-06-01 all requiredIndex entries have required=true', () => {
    expect(mixedIndex.requiredIndex.every(e => e.required === true)).toBe(true);
  });

  it('SI-06-02 mixed — requiredIndex has 4 items', () => {
    expect(mixedIndex.requiredIndex).toHaveLength(4);
  });

  it('SI-06-03 forward — requiredIndex has 10 items', () => {
    expect(fwdIndex.requiredIndex).toHaveLength(10);
  });
});

// ── SI-07 optionalIndex ───────────────────────────────────────────────────────

describe('SI-07 optionalIndex', () => {
  it('SI-07-01 all optionalIndex entries have required=false', () => {
    expect(mixedIndex.optionalIndex.every(e => e.required === false)).toBe(true);
  });

  it('SI-07-02 mixed — optionalIndex has 6 items', () => {
    expect(mixedIndex.optionalIndex).toHaveLength(6);
  });

  it('SI-07-03 forward — optionalIndex has 0 items', () => {
    expect(fwdIndex.optionalIndex).toHaveLength(0);
  });
});

// ── SI-08 metadata forwarding ─────────────────────────────────────────────────

describe('SI-08 metadata forwarding', () => {
  it('SI-08-01 metadata.entryCount equals requiredIndex.length + optionalIndex.length', () => {
    expect(fwdIndex.metadata.entryCount)
      .toBe(fwdIndex.requiredIndex.length + fwdIndex.optionalIndex.length);
  });

  it('SI-08-02 metadata.targetDate is a non-empty string', () => {
    const td = fwdIndex.metadata.targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('SI-08-03 metadata is same reference as fwdRegistry.metadata', () => {
    expect(fwdIndex.metadata).toBe(fwdRegistry.metadata);
  });
});

// ── SI-09 reference sharing ───────────────────────────────────────────────────

describe('SI-09 reference sharing', () => {
  it('SI-09-01 priorityIndex[2][0] is same reference as mixedRegistry.requiredEntries[0]', () => {
    expect(mixedIndex.priorityIndex[2][0]).toBe(mixedRegistry.requiredEntries[0]);
  });

  it('SI-09-02 priorityIndex[4][0] is same reference as mixedRegistry.optionalEntries[0]', () => {
    expect(mixedIndex.priorityIndex[4][0]).toBe(mixedRegistry.optionalEntries[0]);
  });

  it('SI-09-03 requiredIndex is same reference as fwdRegistry.requiredEntries', () => {
    expect(fwdIndex.requiredIndex).toBe(fwdRegistry.requiredEntries);
  });
});

// ── SI-10 ordering within priority buckets ────────────────────────────────────

describe('SI-10 ordering', () => {
  it('SI-10-01 priorityIndex[2] preserves source order — first item is KE_HOACH_LCNT', () => {
    expect(mixedIndex.priorityIndex[2][0].filename).toBe('KE_HOACH_LCNT');
  });

  it('SI-10-02 priorityIndex[4] preserves source order — first item is TO_TRINH_MUA_SAM', () => {
    expect(mixedIndex.priorityIndex[4][0].filename).toBe('TO_TRINH_MUA_SAM');
  });

  it('SI-10-03 forward — priorityIndex[1][0] is the first entry', () => {
    expect(fwdIndex.priorityIndex[1][0]).toBe(fwdRegistry.entries[0]);
  });
});

// ── SI-11 unknown priority ────────────────────────────────────────────────────

describe('SI-11 unknown priority', () => {
  it('SI-11-01 mixed — priorityIndex[99] is undefined', () => {
    expect(mixedIndex.priorityIndex[99]).toBeUndefined();
  });

  it('SI-11-02 forward — priorityIndex[4] is undefined (no optional entries)', () => {
    expect(fwdIndex.priorityIndex[4]).toBeUndefined();
  });

  it('SI-11-03 mixed — priorityIndex[1] is undefined (no priority-1 entries)', () => {
    expect(mixedIndex.priorityIndex[1]).toBeUndefined();
  });
});

// ── SI-12 bucket sum ──────────────────────────────────────────────────────────

describe('SI-12 bucket sum', () => {
  it('SI-12-01 sum of all priorityIndex bucket lengths equals entries.length', () => {
    const sum = Object.values(mixedIndex.priorityIndex)
      .reduce((acc, arr) => acc + arr.length, 0);
    expect(sum).toBe(mixedRegistry.entries.length);
  });

  it('SI-12-02 forward — priorityIndex[1].length equals metadata.entryCount', () => {
    expect(fwdIndex.priorityIndex[1].length).toBe(fwdIndex.metadata.entryCount);
  });

  it('SI-12-03 every entry appears exactly once across all priorityIndex buckets', () => {
    const allFromBuckets = Object.values(mixedIndex.priorityIndex).flat();
    expect(allFromBuckets).toHaveLength(mixedRegistry.entries.length);
  });
});

// ── SI-13 single build call ───────────────────────────────────────────────────

describe('SI-13 single build call', () => {
  it('SI-13-01 build() calls registry.register() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const builder = new SearchIndexBuilder({ register: spy } as unknown as DocumentRegistry);
    builder.build(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('SI-13-02 build() calls register() with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const builder = new SearchIndexBuilder({ register: spy } as unknown as DocumentRegistry);
    builder.build(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('SI-13-03 two build() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synRegistry({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const builder = new SearchIndexBuilder({ register: spy } as unknown as DocumentRegistry);
    builder.build(SAME.last, SAME.cur);
    builder.build(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
