import { describe, it, expect, vi } from 'vitest';
import { UiIntegrationLayer, buildUiLayer, viewFromSerialized } from '../agents/UiIntegrationLayer';
import { PipelineOrchestrator, buildOrchestrator }              from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                                   from '../agents/ManifestSerializer';
import { DocumentManifest }                                     from '../agents/DocumentManifest';
import { ResultFormatter }                                      from '../agents/ResultFormatter';
import { QueryExecutor }                                        from '../agents/QueryExecutor';
import { QueryPlanner }                                         from '../agents/QueryPlanner';
import { SearchEngine }                                         from '../agents/SearchEngine';
import type { SerializedManifest }                              from '../agents/ManifestSerializer';
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

function synSerialized(opts: {
  json?:         string;
  list?:         string;
  requiredList?: string;
  optionalList?: string;
  targetDate?:   string;
  hasResults?:   boolean;
  totalCount?:   number;
} = {}): SerializedManifest {
  const totalCount  = opts.totalCount  ?? 0;
  const hasResults  = opts.hasResults  ?? totalCount > 0;
  return {
    json:         opts.json         ?? JSON.stringify({
      targetDate: '2026-01-01', hasResults, totalCount, requiredCount: 0,
      optionalCount: 0, required: [], optional: [], named: null,
    }),
    list:         opts.list         ?? '',
    requiredList: opts.requiredList ?? '',
    optionalList: opts.optionalList ?? '',
    targetDate:   opts.targetDate   ?? '2026-01-01',
    hasResults,
    totalCount,
  };
}

// Real pipeline.
const fwdUi  = buildUiLayer(FWD.last, FWD.cur);
const sameUi = buildUiLayer(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedUi = new UiIntegrationLayer(
  new PipelineOrchestrator(
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
  ),
);

// ── UI-01 READY ───────────────────────────────────────────────────────────────

describe('UI-01 READY', () => {
  it('UI-01-01 forward — prepare({}).totalCount is 10', () => {
    expect(fwdUi.prepare({}).totalCount).toBe(10);
  });

  it('UI-01-02 forward — prepare({}).hasResults is true', () => {
    expect(fwdUi.prepare({}).hasResults).toBe(true);
  });

  it('UI-01-03 forward — prepare({}).isEmpty is false', () => {
    expect(fwdUi.prepare({}).isEmpty).toBe(false);
  });
});

// ── UI-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('UI-02 PENDING_APPROVAL', () => {
  const u = new UiIntegrationLayer(
    new PipelineOrchestrator(
      new ManifestSerializer(
        new DocumentManifest(
          new ResultFormatter(new QueryExecutor(new QueryPlanner(makeEngine({ status: 'PENDING_APPROVAL' })))),
        ),
      ),
    ),
  );

  it('UI-02-01 isEmpty is true', () => {
    expect(u.prepare({}).isEmpty).toBe(true);
  });

  it('UI-02-02 hasResults is false', () => {
    expect(u.prepare({}).hasResults).toBe(false);
  });

  it('UI-02-03 totalCount is 0', () => {
    expect(u.prepare({}).totalCount).toBe(0);
  });
});

// ── UI-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('UI-03 UNCHANGED', () => {
  it('UI-03-01 isEmpty is true', () => {
    expect(sameUi.prepare({}).isEmpty).toBe(true);
  });

  it('UI-03-02 displayLines is empty array', () => {
    expect(sameUi.prepare({}).displayLines).toEqual([]);
  });

  it('UI-03-03 statusLabel is "No documents"', () => {
    expect(sameUi.prepare({}).statusLabel).toBe('No documents');
  });
});

// ── UI-04 displayLines ────────────────────────────────────────────────────────

describe('UI-04 displayLines', () => {
  it('UI-04-01 forward — displayLines has 10 items', () => {
    expect(fwdUi.prepare({}).displayLines).toHaveLength(10);
  });

  it('UI-04-02 forward — displayLines[0] is "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdUi.prepare({}).displayLines[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('UI-04-03 UNCHANGED — displayLines is [] not [""]', () => {
    expect(sameUi.prepare({}).displayLines).toHaveLength(0);
  });
});

// ── UI-05 requiredLines ───────────────────────────────────────────────────────

describe('UI-05 requiredLines', () => {
  it('UI-05-01 mixed — requiredLines has 4 items', () => {
    expect(mixedUi.prepare({}).requiredLines).toHaveLength(4);
  });

  it('UI-05-02 mixed scope=optional — requiredLines is empty array', () => {
    expect(mixedUi.prepare({ scope: 'optional' }).requiredLines).toHaveLength(0);
  });

  it('UI-05-03 forward — requiredLines[0] is "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdUi.prepare({}).requiredLines[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });
});

// ── UI-06 optionalLines ───────────────────────────────────────────────────────

describe('UI-06 optionalLines', () => {
  it('UI-06-01 mixed — optionalLines has 6 items', () => {
    expect(mixedUi.prepare({}).optionalLines).toHaveLength(6);
  });

  it('UI-06-02 forward — optionalLines is empty array', () => {
    expect(fwdUi.prepare({}).optionalLines).toHaveLength(0);
  });

  it('UI-06-03 mixed — optionalLines[0] is "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(mixedUi.prepare({}).optionalLines[0]).toBe('TO_TRINH_MUA_SAM.DOCX');
  });
});

// ── UI-07 parsedJson ──────────────────────────────────────────────────────────

describe('UI-07 parsedJson', () => {
  it('UI-07-01 parsedJson is an object (not a string)', () => {
    expect(typeof fwdUi.prepare({}).parsedJson).toBe('object');
  });

  it('UI-07-02 forward — parsedJson.totalCount is 10', () => {
    expect(fwdUi.prepare({}).parsedJson.totalCount).toBe(10);
  });

  it('UI-07-03 forward — parsedJson.required.length is 10', () => {
    expect(fwdUi.prepare({}).parsedJson.required.length).toBe(10);
  });
});

// ── UI-08 statusLabel ─────────────────────────────────────────────────────────

describe('UI-08 statusLabel', () => {
  it('UI-08-01 forward — statusLabel is "10 documents"', () => {
    expect(fwdUi.prepare({}).statusLabel).toBe('10 documents');
  });

  it('UI-08-02 UNCHANGED — statusLabel is "No documents"', () => {
    expect(sameUi.prepare({}).statusLabel).toBe('No documents');
  });

  it('UI-08-03 mixed — statusLabel is "10 documents"', () => {
    expect(mixedUi.prepare({}).statusLabel).toBe('10 documents');
  });
});

// ── UI-09 scalar passthrough ──────────────────────────────────────────────────

describe('UI-09 scalar passthrough', () => {
  it('UI-09-01 forward — json is valid JSON string', () => {
    expect(() => JSON.parse(fwdUi.prepare({}).json)).not.toThrow();
  });

  it('UI-09-02 forward — list.split("\\n").length equals displayLines.length', () => {
    const vm = fwdUi.prepare({});
    expect(vm.list.split('\n').length).toBe(vm.displayLines.length);
  });

  it('UI-09-03 forward — json contains targetDate substring', () => {
    const vm = fwdUi.prepare({});
    expect(vm.json).toContain(vm.targetDate);
  });
});

// ── UI-10 targetDate ──────────────────────────────────────────────────────────

describe('UI-10 targetDate', () => {
  it('UI-10-01 forward — targetDate is a non-empty string', () => {
    const td = fwdUi.prepare({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('UI-10-02 targetDate equals parsedJson.targetDate', () => {
    const vm = fwdUi.prepare({});
    expect(vm.targetDate).toBe(vm.parsedJson.targetDate);
  });

  it('UI-10-03 custom targetDate forwarded correctly', () => {
    const u = new UiIntegrationLayer(
      new PipelineOrchestrator(
        new ManifestSerializer(
          new DocumentManifest(
            new ResultFormatter(
              new QueryExecutor(new QueryPlanner(makeEngine({ targetDate: '2099-12-31' }))),
            ),
          ),
        ),
      ),
    );
    expect(u.prepare({}).targetDate).toBe('2099-12-31');
  });
});

// ── UI-11 scope interaction ───────────────────────────────────────────────────

describe('UI-11 scope interaction', () => {
  it('UI-11-01 mixed scope=required — requiredLines has 4 items, optionalLines empty', () => {
    const vm = mixedUi.prepare({ scope: 'required' });
    expect(vm.requiredLines).toHaveLength(4);
    expect(vm.optionalLines).toHaveLength(0);
  });

  it('UI-11-02 mixed scope=optional — optionalLines has 6 items, requiredLines empty', () => {
    const vm = mixedUi.prepare({ scope: 'optional' });
    expect(vm.optionalLines).toHaveLength(6);
    expect(vm.requiredLines).toHaveLength(0);
  });

  it('UI-11-03 mixed scope=required — isEmpty is false and hasResults is true', () => {
    const vm = mixedUi.prepare({ scope: 'required' });
    expect(vm.isEmpty).toBe(false);
    expect(vm.hasResults).toBe(true);
  });
});

// ── UI-12 deterministic output ────────────────────────────────────────────────

describe('UI-12 deterministic output', () => {
  it('UI-12-01 two prepare() calls with same descriptor produce same statusLabel', () => {
    const d = { scope: 'all' as const };
    expect(mixedUi.prepare(d).statusLabel).toBe(mixedUi.prepare(d).statusLabel);
  });

  it('UI-12-02 forward — displayLines.length equals totalCount', () => {
    const vm = fwdUi.prepare({});
    expect(vm.displayLines.length).toBe(vm.totalCount);
  });

  it('UI-12-03 mixed — requiredLines.length + optionalLines.length equals displayLines.length', () => {
    const vm = mixedUi.prepare({});
    expect(vm.requiredLines.length + vm.optionalLines.length).toBe(vm.displayLines.length);
  });
});

// ── UI-13 spy injection ───────────────────────────────────────────────────────

describe('UI-13 spy injection', () => {
  it('UI-13-01 prepare() calls orchestrator.run() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    new UiIntegrationLayer({ run: spy } as unknown as PipelineOrchestrator)
      .prepare({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('UI-13-02 orchestrator.run() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new UiIntegrationLayer({ run: spy } as unknown as PipelineOrchestrator).prepare(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('UI-13-03 two prepare() calls cause orchestrator.run() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synSerialized());
    const u = new UiIntegrationLayer({ run: spy } as unknown as PipelineOrchestrator);
    u.prepare({ scope: 'required' });
    u.prepare({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
