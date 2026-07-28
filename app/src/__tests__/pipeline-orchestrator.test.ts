import { describe, it, expect, vi } from 'vitest';
import { PipelineOrchestrator, buildOrchestrator, runPipeline } from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                                    from '../agents/ManifestSerializer';
import { DocumentManifest }                                      from '../agents/DocumentManifest';
import { ResultFormatter }                                       from '../agents/ResultFormatter';
import { QueryExecutor }                                         from '../agents/QueryExecutor';
import { QueryPlanner }                                          from '../agents/QueryPlanner';
import { SearchEngine }                                          from '../agents/SearchEngine';
import type { SerializedManifest }                               from '../agents/ManifestSerializer';
import type { ManifestJson }                                     from '../agents/ManifestSerializer';
import type { QueryDescriptor }                                  from '../agents/QueryPlanner';
import type { RegistryEntry }                                    from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                         from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                                   from '../agents/SnapshotBuilder';

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

function synSerialized(): SerializedManifest {
  return {
    json:         JSON.stringify({ targetDate: '2026-01-01', hasResults: false,
                                   totalCount: 0, requiredCount: 0, optionalCount: 0,
                                   required: [], optional: [], named: null }),
    list:         '',
    requiredList: '',
    optionalList: '',
    targetDate:   '2026-01-01',
    hasResults:   false,
    totalCount:   0,
  };
}

// Real pipeline.
const fwdOrchestrator  = buildOrchestrator(FWD.last, FWD.cur);
const sameOrchestrator = buildOrchestrator(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedOrchestrator = new PipelineOrchestrator(
  new ManifestSerializer(
    new DocumentManifest(
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
    ),
  ),
);

// ── PO-01 READY ───────────────────────────────────────────────────────────────

describe('PO-01 READY', () => {
  it('PO-01-01 forward — run({}).totalCount is 10', () => {
    expect(fwdOrchestrator.run({}).totalCount).toBe(10);
  });

  it('PO-01-02 forward — run({}).hasResults is true', () => {
    expect(fwdOrchestrator.run({}).hasResults).toBe(true);
  });

  it('PO-01-03 forward — run({}).list has 10 items', () => {
    expect(fwdOrchestrator.run({}).list.split('\n')).toHaveLength(10);
  });
});

// ── PO-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('PO-02 PENDING_APPROVAL', () => {
  const o = new PipelineOrchestrator(
    new ManifestSerializer(
      new DocumentManifest(
        new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({ status: 'PENDING_APPROVAL' })))),
      ),
    ),
  );

  it('PO-02-01 list is empty string', () => {
    expect(o.run({}).list).toBe('');
  });

  it('PO-02-02 hasResults is false', () => {
    expect(o.run({}).hasResults).toBe(false);
  });

  it('PO-02-03 totalCount is 0', () => {
    expect(o.run({}).totalCount).toBe(0);
  });
});

// ── PO-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('PO-03 UNCHANGED', () => {
  it('PO-03-01 list is empty string', () => {
    expect(sameOrchestrator.run({}).list).toBe('');
  });

  it('PO-03-02 requiredList is empty string', () => {
    expect(sameOrchestrator.run({}).requiredList).toBe('');
  });

  it('PO-03-03 json.named is null', () => {
    const parsed: ManifestJson = JSON.parse(
      sameOrchestrator.run({ filename: 'TO_TRINH_MUA_SAM' }).json,
    );
    expect(parsed.named).toBeNull();
  });
});

// ── PO-04 runPipeline() one-shot function ─────────────────────────────────────

describe('PO-04 runPipeline() one-shot function', () => {
  it('PO-04-01 forward — runPipeline totalCount is 10', () => {
    expect(runPipeline(FWD.last, FWD.cur).totalCount).toBe(10);
  });

  it('PO-04-02 forward — runPipeline hasResults is true', () => {
    expect(runPipeline(FWD.last, FWD.cur).hasResults).toBe(true);
  });

  it('PO-04-03 forward — runPipeline json.named is label when filename specified', () => {
    const parsed: ManifestJson = JSON.parse(
      runPipeline(FWD.last, FWD.cur, { filename: 'TO_TRINH_MUA_SAM' }).json,
    );
    expect(parsed.named).toBe('TO_TRINH_MUA_SAM.DOCX');
  });
});

// ── PO-05 JSON output ─────────────────────────────────────────────────────────

describe('PO-05 JSON output', () => {
  it('PO-05-01 forward — json is valid JSON', () => {
    expect(() => JSON.parse(fwdOrchestrator.run({}).json)).not.toThrow();
  });

  it('PO-05-02 forward — parsed JSON totalCount is 10', () => {
    const parsed: ManifestJson = JSON.parse(fwdOrchestrator.run({}).json);
    expect(parsed.totalCount).toBe(10);
  });

  it('PO-05-03 forward — parsed JSON required.length is 10', () => {
    const parsed: ManifestJson = JSON.parse(fwdOrchestrator.run({}).json);
    expect(parsed.required.length).toBe(10);
  });
});

// ── PO-06 list output ─────────────────────────────────────────────────────────

describe('PO-06 list output', () => {
  it('PO-06-01 forward — list starts with "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdOrchestrator.run({}).list.split('\n')[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('PO-06-02 mixed — list has 10 items', () => {
    expect(mixedOrchestrator.run({}).list.split('\n')).toHaveLength(10);
  });

  it('PO-06-03 all lines in forward list end with ".DOCX"', () => {
    const lines = fwdOrchestrator.run({}).list.split('\n');
    expect(lines.every(l => l.endsWith('.DOCX'))).toBe(true);
  });
});

// ── PO-07 requiredList and optionalList ───────────────────────────────────────

describe('PO-07 requiredList and optionalList', () => {
  it('PO-07-01 mixed — requiredList has 4 lines', () => {
    expect(mixedOrchestrator.run({}).requiredList.split('\n')).toHaveLength(4);
  });

  it('PO-07-02 mixed — optionalList has 6 lines', () => {
    expect(mixedOrchestrator.run({}).optionalList.split('\n')).toHaveLength(6);
  });

  it('PO-07-03 forward — optionalList is empty string', () => {
    expect(fwdOrchestrator.run({}).optionalList).toBe('');
  });
});

// ── PO-08 scope interaction ───────────────────────────────────────────────────

describe('PO-08 scope interaction', () => {
  it('PO-08-01 mixed scope=required — requiredList has 4 lines', () => {
    expect(mixedOrchestrator.run({ scope: 'required' }).requiredList.split('\n')).toHaveLength(4);
  });

  it('PO-08-02 mixed scope=required — optionalList is empty string', () => {
    expect(mixedOrchestrator.run({ scope: 'required' }).optionalList).toBe('');
  });

  it('PO-08-03 mixed scope=optional — requiredList is empty string', () => {
    expect(mixedOrchestrator.run({ scope: 'optional' }).requiredList).toBe('');
  });
});

// ── PO-09 named lookup ────────────────────────────────────────────────────────

describe('PO-09 named lookup', () => {
  it('PO-09-01 json.named is correct label when filename found', () => {
    const parsed: ManifestJson = JSON.parse(
      fwdOrchestrator.run({ filename: 'TO_TRINH_MUA_SAM' }).json,
    );
    expect(parsed.named).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('PO-09-02 json.named is null when unknown filename', () => {
    const parsed: ManifestJson = JSON.parse(
      fwdOrchestrator.run({ filename: 'NONEXISTENT_DOC' }).json,
    );
    expect(parsed.named).toBeNull();
  });

  it('PO-09-03 named lookup is independent of scope', () => {
    // scope=optional filters list entries; named still resolves a required doc
    const parsed: ManifestJson = JSON.parse(
      mixedOrchestrator.run({ scope: 'optional', filename: 'KE_HOACH_LCNT' }).json,
    );
    expect(parsed.named).toBe('KE_HOACH_LCNT.DOCX');
    expect(mixedOrchestrator.run({ scope: 'optional' }).list.split('\n')).toHaveLength(6);
  });
});

// ── PO-10 targetDate ──────────────────────────────────────────────────────────

describe('PO-10 targetDate', () => {
  it('PO-10-01 forward — targetDate is a non-empty string', () => {
    const td = fwdOrchestrator.run({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('PO-10-02 targetDate appears in json output', () => {
    const s = fwdOrchestrator.run({});
    expect(s.json).toContain(s.targetDate);
  });

  it('PO-10-03 custom targetDate forwarded correctly', () => {
    const custom = new PipelineOrchestrator(
      new ManifestSerializer(
        new DocumentManifest(
          new ResultFormatter(
            new QueryExecutor(new QueryPlanner(makeEngine({ targetDate: '2099-12-31' }))),
          ),
        ),
      ),
    );
    expect(custom.run({}).targetDate).toBe('2099-12-31');
  });
});

// ── PO-11 deterministic output ────────────────────────────────────────────────

describe('PO-11 deterministic output', () => {
  it('PO-11-01 two run() calls with same descriptor produce identical json', () => {
    const d = { scope: 'all' as const };
    expect(mixedOrchestrator.run(d).json).toBe(mixedOrchestrator.run(d).json);
  });

  it('PO-11-02 forward — list line count equals totalCount', () => {
    const s = fwdOrchestrator.run({});
    expect(s.list.split('\n').length).toBe(s.totalCount);
  });

  it('PO-11-03 mixed — requiredList + optionalList line counts equal list line count', () => {
    const s = mixedOrchestrator.run({});
    expect(s.requiredList.split('\n').length + s.optionalList.split('\n').length)
      .toBe(s.list.split('\n').length);
  });
});

// ── PO-12 runPipeline vs buildOrchestrator equivalence ───────────────────────

describe('PO-12 runPipeline vs buildOrchestrator equivalence', () => {
  it('PO-12-01 runPipeline json equals buildOrchestrator().run() json for same inputs', () => {
    expect(runPipeline(FWD.last, FWD.cur).json)
      .toBe(buildOrchestrator(FWD.last, FWD.cur).run().json);
  });

  it('PO-12-02 FWD list is non-empty; SAME list is empty (dates drive output)', () => {
    expect(runPipeline(FWD.last,  FWD.cur).list.length).toBeGreaterThan(0);
    expect(runPipeline(SAME.last, SAME.cur).list).toBe('');
  });

  it('PO-12-03 FWD and SAME json strings are not equal', () => {
    expect(runPipeline(FWD.last, FWD.cur).json)
      .not.toBe(runPipeline(SAME.last, SAME.cur).json);
  });
});

// ── PO-13 spy injection ───────────────────────────────────────────────────────

describe('PO-13 spy injection', () => {
  it('PO-13-01 run() calls serializer.serialize() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    new PipelineOrchestrator({ serialize: spy } as unknown as ManifestSerializer)
      .run({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('PO-13-02 serializer.serialize() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new PipelineOrchestrator({ serialize: spy } as unknown as ManifestSerializer).run(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('PO-13-03 two run() calls cause serializer.serialize() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    const o = new PipelineOrchestrator({ serialize: spy } as unknown as ManifestSerializer);
    o.run({ scope: 'required' });
    o.run({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
