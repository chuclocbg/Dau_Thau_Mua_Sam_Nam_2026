import { describe, it, expect, vi } from 'vitest';
import { ManifestSerializer, buildSerializer }                    from '../agents/ManifestSerializer';
import type { ManifestJson }                                       from '../agents/ManifestSerializer';
import { DocumentManifest }                                       from '../agents/DocumentManifest';
import { ResultFormatter }                                        from '../agents/ResultFormatter';
import { QueryExecutor }                                          from '../agents/QueryExecutor';
import { QueryPlanner }                                           from '../agents/QueryPlanner';
import { SearchEngine }                                           from '../agents/SearchEngine';
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

function synManifestResult(opts: {
  required?: readonly { label: string }[];
  optional?: readonly { label: string }[];
  named?:    { label: string };
  targetDate?:   string;
  hasResults?:   boolean;
  requiredCount?: number;
  optionalCount?: number;
  totalCount?:   number;
} = {}) {
  const required = opts.required ?? [];
  const optional = opts.optional ?? [];
  const all      = [...required, ...optional];
  const totalCount = opts.totalCount ?? all.length;
  return {
    header: {
      targetDate:    opts.targetDate   ?? '2026-01-01',
      requiredCount: opts.requiredCount ?? required.length,
      optionalCount: opts.optionalCount ?? optional.length,
      totalCount,
      hasResults:    opts.hasResults   ?? totalCount > 0,
    },
    required,
    optional,
    all,
    named: opts.named,
  };
}

// Real pipeline.
const fwdSerializer  = buildSerializer(FWD.last, FWD.cur);
const sameSerializer = buildSerializer(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedDm = new DocumentManifest(
  new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({
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
  })))),
);
const mixedSerializer = new ManifestSerializer(mixedDm);

// ── MS-01 READY ───────────────────────────────────────────────────────────────

describe('MS-01 READY', () => {
  it('MS-01-01 forward — serialize({}).totalCount is 10', () => {
    expect(fwdSerializer.serialize({}).totalCount).toBe(10);
  });

  it('MS-01-02 forward — serialize({}).hasResults is true', () => {
    expect(fwdSerializer.serialize({}).hasResults).toBe(true);
  });

  it('MS-01-03 forward — serialize({}).list has 10 newline-separated items', () => {
    expect(fwdSerializer.serialize({}).list.split('\n')).toHaveLength(10);
  });
});

// ── MS-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('MS-02 PENDING_APPROVAL', () => {
  const s = new ManifestSerializer(
    new DocumentManifest(
      new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({ status: 'PENDING_APPROVAL' })))),
    ),
  );

  it('MS-02-01 list is empty string', () => {
    expect(s.serialize({}).list).toBe('');
  });

  it('MS-02-02 hasResults is false', () => {
    expect(s.serialize({}).hasResults).toBe(false);
  });

  it('MS-02-03 totalCount is 0', () => {
    expect(s.serialize({}).totalCount).toBe(0);
  });
});

// ── MS-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('MS-03 UNCHANGED', () => {
  it('MS-03-01 list is empty string', () => {
    expect(sameSerializer.serialize({}).list).toBe('');
  });

  it('MS-03-02 requiredList is empty string', () => {
    expect(sameSerializer.serialize({}).requiredList).toBe('');
  });

  it('MS-03-03 optionalList is empty string', () => {
    expect(sameSerializer.serialize({}).optionalList).toBe('');
  });
});

// ── MS-04 JSON output ─────────────────────────────────────────────────────────

describe('MS-04 JSON output', () => {
  it('MS-04-01 json is valid JSON — JSON.parse does not throw', () => {
    expect(() => JSON.parse(fwdSerializer.serialize({}).json)).not.toThrow();
  });

  it('MS-04-02 forward — parsed JSON.totalCount is 10', () => {
    const parsed: ManifestJson = JSON.parse(fwdSerializer.serialize({}).json);
    expect(parsed.totalCount).toBe(10);
  });

  it('MS-04-03 forward — parsed JSON.required.length is 10', () => {
    const parsed: ManifestJson = JSON.parse(fwdSerializer.serialize({}).json);
    expect(parsed.required.length).toBe(10);
  });
});

// ── MS-05 list (all labels) ───────────────────────────────────────────────────

describe('MS-05 list (all labels)', () => {
  it('MS-05-01 forward — list starts with "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdSerializer.serialize({}).list.split('\n')[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('MS-05-02 mixed — list has 10 items', () => {
    expect(mixedSerializer.serialize({}).list.split('\n')).toHaveLength(10);
  });

  it('MS-05-03 all lines in forward list end with ".DOCX"', () => {
    const lines = fwdSerializer.serialize({}).list.split('\n');
    expect(lines.every(l => l.endsWith('.DOCX'))).toBe(true);
  });
});

// ── MS-06 requiredList ────────────────────────────────────────────────────────

describe('MS-06 requiredList', () => {
  it('MS-06-01 mixed — requiredList has 4 lines', () => {
    expect(mixedSerializer.serialize({}).requiredList.split('\n')).toHaveLength(4);
  });

  it('MS-06-02 mixed — requiredList starts with "KE_HOACH_LCNT.DOCX"', () => {
    expect(mixedSerializer.serialize({}).requiredList.split('\n')[0]).toBe('KE_HOACH_LCNT.DOCX');
  });

  it('MS-06-03 all lines in mixed requiredList end with ".DOCX"', () => {
    const lines = mixedSerializer.serialize({}).requiredList.split('\n');
    expect(lines.every(l => l.endsWith('.DOCX'))).toBe(true);
  });
});

// ── MS-07 optionalList ────────────────────────────────────────────────────────

describe('MS-07 optionalList', () => {
  it('MS-07-01 mixed — optionalList has 6 lines', () => {
    expect(mixedSerializer.serialize({}).optionalList.split('\n')).toHaveLength(6);
  });

  it('MS-07-02 forward — optionalList is empty string', () => {
    expect(fwdSerializer.serialize({}).optionalList).toBe('');
  });

  it('MS-07-03 mixed — optionalList starts with "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(mixedSerializer.serialize({}).optionalList.split('\n')[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });
});

// ── MS-08 JSON structure ──────────────────────────────────────────────────────

describe('MS-08 JSON structure', () => {
  it('MS-08-01 mixed — json.required.length equals header.requiredCount (4)', () => {
    const parsed: ManifestJson = JSON.parse(mixedSerializer.serialize({}).json);
    expect(parsed.required.length).toBe(4);
  });

  it('MS-08-02 mixed — json.optional.length equals header.optionalCount (6)', () => {
    const parsed: ManifestJson = JSON.parse(mixedSerializer.serialize({}).json);
    expect(parsed.optional.length).toBe(6);
  });

  it('MS-08-03 json.named is null when no filename specified in descriptor', () => {
    const parsed: ManifestJson = JSON.parse(fwdSerializer.serialize({}).json);
    expect(parsed.named).toBeNull();
  });
});

// ── MS-09 JSON named field ────────────────────────────────────────────────────

describe('MS-09 JSON named field', () => {
  it('MS-09-01 forward — json.named is "TO_TRINH_MUA_SAM.DOCX" when filename specified', () => {
    const parsed: ManifestJson = JSON.parse(
      fwdSerializer.serialize({ filename: 'TO_TRINH_MUA_SAM' }).json,
    );
    expect(parsed.named).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('MS-09-02 forward — json.named is null when unknown filename specified', () => {
    const parsed: ManifestJson = JSON.parse(
      fwdSerializer.serialize({ filename: 'NONEXISTENT_DOC' }).json,
    );
    expect(parsed.named).toBeNull();
  });

  it('MS-09-03 UNCHANGED — json.named is null', () => {
    const parsed: ManifestJson = JSON.parse(
      sameSerializer.serialize({ filename: 'TO_TRINH_MUA_SAM' }).json,
    );
    expect(parsed.named).toBeNull();
  });
});

// ── MS-10 targetDate ──────────────────────────────────────────────────────────

describe('MS-10 targetDate', () => {
  it('MS-10-01 forward — targetDate is a non-empty string', () => {
    const td = fwdSerializer.serialize({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('MS-10-02 targetDate appears in json output', () => {
    const s = fwdSerializer.serialize({});
    expect(s.json).toContain(s.targetDate);
  });

  it('MS-10-03 custom targetDate forwarded correctly', () => {
    const custom = new ManifestSerializer(
      new DocumentManifest(
        new ResultFormatter(
          new QueryExecutor(new QueryPlanner(makeEngine({ targetDate: '2099-12-31' }))),
        ),
      ),
    );
    expect(custom.serialize({}).targetDate).toBe('2099-12-31');
  });
});

// ── MS-11 scope interaction ───────────────────────────────────────────────────

describe('MS-11 scope interaction', () => {
  it('MS-11-01 mixed scope=required — requiredList has 4 lines', () => {
    expect(mixedSerializer.serialize({ scope: 'required' }).requiredList.split('\n')).toHaveLength(4);
  });

  it('MS-11-02 mixed scope=required — optionalList is empty string', () => {
    expect(mixedSerializer.serialize({ scope: 'required' }).optionalList).toBe('');
  });

  it('MS-11-03 mixed scope=optional — requiredList is empty string', () => {
    expect(mixedSerializer.serialize({ scope: 'optional' }).requiredList).toBe('');
  });
});

// ── MS-12 deterministic output ────────────────────────────────────────────────

describe('MS-12 deterministic output', () => {
  it('MS-12-01 two serialize() calls with same descriptor produce identical json', () => {
    const d = { scope: 'all' as const };
    expect(mixedSerializer.serialize(d).json).toBe(mixedSerializer.serialize(d).json);
  });

  it('MS-12-02 forward — list line count equals totalCount', () => {
    const s = fwdSerializer.serialize({});
    expect(s.list.split('\n').length).toBe(s.totalCount);
  });

  it('MS-12-03 mixed — requiredList + optionalList line counts equal list line count', () => {
    const s = mixedSerializer.serialize({});
    expect(s.requiredList.split('\n').length + s.optionalList.split('\n').length)
      .toBe(s.list.split('\n').length);
  });
});

// ── MS-13 spy injection ───────────────────────────────────────────────────────

describe('MS-13 spy injection', () => {
  it('MS-13-01 serialize() calls dm.manifest() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synManifestResult());
    new ManifestSerializer({ manifest: spy } as unknown as DocumentManifest)
      .serialize({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('MS-13-02 dm.manifest() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synManifestResult());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new ManifestSerializer({ manifest: spy } as unknown as DocumentManifest).serialize(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('MS-13-03 two serialize() calls cause dm.manifest() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synManifestResult());
    const ms = new ManifestSerializer({ manifest: spy } as unknown as DocumentManifest);
    ms.serialize({ scope: 'required' });
    ms.serialize({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
