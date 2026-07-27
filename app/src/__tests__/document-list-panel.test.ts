import { describe, it, expect, vi } from 'vitest';
import { DocumentListPanel, buildPanel }              from '../agents/DocumentListPanel';
import { UiIntegrationLayer }                         from '../agents/UiIntegrationLayer';
import { PipelineOrchestrator }                        from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                          from '../agents/ManifestSerializer';
import { DocumentManifest }                            from '../agents/DocumentManifest';
import { ResultFormatter }                             from '../agents/ResultFormatter';
import { QueryExecutor }                               from '../agents/QueryExecutor';
import { QueryPlanner }                                from '../agents/QueryPlanner';
import { SearchEngine }                                from '../agents/SearchEngine';
import type { UiViewModel }                            from '../agents/UiIntegrationLayer';
import type { QueryDescriptor }                        from '../agents/QueryPlanner';
import type { RegistryEntry }                          from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }               from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                         from '../agents/SnapshotBuilder';

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
    entries, requiredEntries, optionalEntries, index,
    metadata: {
      entryCount:    entries.length,
      requiredCount: requiredEntries.length,
      optionalCount: optionalEntries.length,
      targetDate,
    },
  };
}

function makeUiLayer(opts: Parameters<typeof synRegistry>[0]) {
  return new UiIntegrationLayer(
    new PipelineOrchestrator(
      new ManifestSerializer(
        new DocumentManifest(
          new ResultFormatter(
            new QueryExecutor(new QueryPlanner(new SearchEngine(synRegistry(opts)))),
          ),
        ),
      ),
    ),
  );
}

function synViewModel(opts: {
  statusLabel?:   string;
  targetDate?:    string;
  isEmpty?:       boolean;
  totalCount?:    number;
  requiredLines?: readonly string[];
  optionalLines?: readonly string[];
  namedLabel?:    string | null;
} = {}): UiViewModel {
  const totalCount   = opts.totalCount   ?? 0;
  const isEmpty      = opts.isEmpty      ?? totalCount === 0;
  const requiredLines = opts.requiredLines ?? [];
  const optionalLines = opts.optionalLines ?? [];
  const allLines      = [...requiredLines, ...optionalLines];
  return {
    json:         '{}',
    list:         allLines.join('\n'),
    requiredList: requiredLines.join('\n'),
    optionalList: optionalLines.join('\n'),
    targetDate:   opts.targetDate  ?? '2026-01-01',
    hasResults:   !isEmpty,
    totalCount,
    isEmpty,
    displayLines:  allLines,
    requiredLines,
    optionalLines,
    parsedJson: {
      targetDate:    opts.targetDate   ?? '2026-01-01',
      hasResults:    !isEmpty,
      totalCount,
      requiredCount: requiredLines.length,
      optionalCount: optionalLines.length,
      required:      [...requiredLines],
      optional:      [...optionalLines],
      named:         opts.namedLabel ?? null,
    },
    statusLabel:  opts.statusLabel ?? (isEmpty ? 'No documents' : `${totalCount} documents`),
  };
}

// Real pipeline.
const fwdPanel  = buildPanel(FWD.last, FWD.cur);
const samePanel = buildPanel(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4).
const mixedPanel = new DocumentListPanel(makeUiLayer({
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

// ── DL-01 READY ───────────────────────────────────────────────────────────────

describe('DL-01 READY', () => {
  it('DL-01-01 forward — render({}).totalCount is 10', () => {
    expect(fwdPanel.render({}).totalCount).toBe(10);
  });

  it('DL-01-02 forward — render({}).isEmpty is false', () => {
    expect(fwdPanel.render({}).isEmpty).toBe(false);
  });

  it('DL-01-03 forward — render({}).items has 10 items', () => {
    expect(fwdPanel.render({}).items).toHaveLength(10);
  });
});

// ── DL-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('DL-02 PENDING_APPROVAL', () => {
  const p = new DocumentListPanel(makeUiLayer({ status: 'PENDING_APPROVAL' }));

  it('DL-02-01 isEmpty is true', () => {
    expect(p.render({}).isEmpty).toBe(true);
  });

  it('DL-02-02 items is empty array', () => {
    expect(p.render({}).items).toHaveLength(0);
  });

  it('DL-02-03 title is "No documents"', () => {
    expect(p.render({}).title).toBe('No documents');
  });
});

// ── DL-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('DL-03 UNCHANGED', () => {
  it('DL-03-01 isEmpty is true', () => {
    expect(samePanel.render({}).isEmpty).toBe(true);
  });

  it('DL-03-02 items is empty array', () => {
    expect(samePanel.render({}).items).toHaveLength(0);
  });

  it('DL-03-03 namedLabel is null', () => {
    expect(samePanel.render({ filename: 'TO_TRINH_MUA_SAM' }).namedLabel).toBeNull();
  });
});

// ── DL-04 items array ─────────────────────────────────────────────────────────

describe('DL-04 items array', () => {
  it('DL-04-01 forward — items has 10 items', () => {
    expect(fwdPanel.render({}).items).toHaveLength(10);
  });

  it('DL-04-02 forward — items[0].label is "TO_TRINH_MUA_SAM.DOCX"', () => {
    expect(fwdPanel.render({}).items[0].label).toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('DL-04-03 all items have non-empty label', () => {
    expect(fwdPanel.render({}).items.every(i => i.label.length > 0)).toBe(true);
  });
});

// ── DL-05 item.section field ──────────────────────────────────────────────────

describe('DL-05 item.section field', () => {
  it('DL-05-01 mixed — first 4 items have section="required"', () => {
    const items = mixedPanel.render({}).items;
    expect(items.slice(0, 4).every(i => i.section === 'required')).toBe(true);
  });

  it('DL-05-02 mixed — last 6 items have section="optional"', () => {
    const items = mixedPanel.render({}).items;
    expect(items.slice(4).every(i => i.section === 'optional')).toBe(true);
  });

  it('DL-05-03 forward — all items have section="required"', () => {
    expect(fwdPanel.render({}).items.every(i => i.section === 'required')).toBe(true);
  });
});

// ── DL-06 item.index field ────────────────────────────────────────────────────

describe('DL-06 item.index field', () => {
  it('DL-06-01 mixed — requiredItems indices run 0..3', () => {
    const ri = mixedPanel.render({}).requiredItems;
    expect(ri.every((item, pos) => item.index === pos)).toBe(true);
  });

  it('DL-06-02 mixed — optionalItems[0].index is 0 (not its global position 4)', () => {
    expect(mixedPanel.render({}).optionalItems[0].index).toBe(0);
  });

  it('DL-06-03 mixed — items[4].index is 0 (first optional resets to 0)', () => {
    expect(mixedPanel.render({}).items[4].index).toBe(0);
  });
});

// ── DL-07 requiredItems ───────────────────────────────────────────────────────

describe('DL-07 requiredItems', () => {
  it('DL-07-01 mixed — requiredItems has 4 items', () => {
    expect(mixedPanel.render({}).requiredItems).toHaveLength(4);
  });

  it('DL-07-02 mixed — all requiredItems have required=true', () => {
    expect(mixedPanel.render({}).requiredItems.every(i => i.required)).toBe(true);
  });

  it('DL-07-03 mixed scope=optional — requiredItems is empty array', () => {
    expect(mixedPanel.render({ scope: 'optional' }).requiredItems).toHaveLength(0);
  });
});

// ── DL-08 optionalItems ───────────────────────────────────────────────────────

describe('DL-08 optionalItems', () => {
  it('DL-08-01 mixed — optionalItems has 6 items', () => {
    expect(mixedPanel.render({}).optionalItems).toHaveLength(6);
  });

  it('DL-08-02 mixed — all optionalItems have required=false', () => {
    expect(mixedPanel.render({}).optionalItems.every(i => !i.required)).toBe(true);
  });

  it('DL-08-03 forward — optionalItems is empty array', () => {
    expect(fwdPanel.render({}).optionalItems).toHaveLength(0);
  });
});

// ── DL-09 namedLabel ──────────────────────────────────────────────────────────

describe('DL-09 namedLabel', () => {
  it('DL-09-01 forward — namedLabel is "TO_TRINH_MUA_SAM.DOCX" when filename specified', () => {
    expect(fwdPanel.render({ filename: 'TO_TRINH_MUA_SAM' }).namedLabel)
      .toBe('TO_TRINH_MUA_SAM.DOCX');
  });

  it('DL-09-02 forward — namedLabel is null when no filename in descriptor', () => {
    expect(fwdPanel.render({}).namedLabel).toBeNull();
  });

  it('DL-09-03 forward — namedLabel is null when unknown filename', () => {
    expect(fwdPanel.render({ filename: 'NONEXISTENT_DOC' }).namedLabel).toBeNull();
  });
});

// ── DL-10 title and targetDate ────────────────────────────────────────────────

describe('DL-10 title and targetDate', () => {
  it('DL-10-01 forward — title is "10 documents"', () => {
    expect(fwdPanel.render({}).title).toBe('10 documents');
  });

  it('DL-10-02 UNCHANGED — title is "No documents"', () => {
    expect(samePanel.render({}).title).toBe('No documents');
  });

  it('DL-10-03 forward — targetDate is a non-empty string', () => {
    const td = fwdPanel.render({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });
});

// ── DL-11 scope interaction ───────────────────────────────────────────────────

describe('DL-11 scope interaction', () => {
  it('DL-11-01 mixed scope=required — requiredItems 4, optionalItems empty', () => {
    const p = mixedPanel.render({ scope: 'required' });
    expect(p.requiredItems).toHaveLength(4);
    expect(p.optionalItems).toHaveLength(0);
  });

  it('DL-11-02 mixed scope=optional — optionalItems 6, requiredItems empty', () => {
    const p = mixedPanel.render({ scope: 'optional' });
    expect(p.optionalItems).toHaveLength(6);
    expect(p.requiredItems).toHaveLength(0);
  });

  it('DL-11-03 mixed scope=required — items.length equals totalCount', () => {
    const p = mixedPanel.render({ scope: 'required' });
    expect(p.items.length).toBe(p.totalCount);
  });
});

// ── DL-12 deterministic output ────────────────────────────────────────────────

describe('DL-12 deterministic output', () => {
  it('DL-12-01 two render() calls same descriptor produce same title', () => {
    const d = { scope: 'all' as const };
    expect(mixedPanel.render(d).title).toBe(mixedPanel.render(d).title);
  });

  it('DL-12-02 requiredItems.length + optionalItems.length equals items.length', () => {
    const p = mixedPanel.render({});
    expect(p.requiredItems.length + p.optionalItems.length).toBe(p.items.length);
  });

  it('DL-12-03 items[0] is same reference as requiredItems[0]', () => {
    const p = mixedPanel.render({});
    expect(p.items[0]).toBe(p.requiredItems[0]);
  });
});

// ── DL-13 spy injection ───────────────────────────────────────────────────────

describe('DL-13 spy injection', () => {
  it('DL-13-01 render() calls uiLayer.prepare() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synViewModel());
    new DocumentListPanel({ prepare: spy } as unknown as UiIntegrationLayer)
      .render({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('DL-13-02 uiLayer.prepare() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synViewModel());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new DocumentListPanel({ prepare: spy } as unknown as UiIntegrationLayer).render(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('DL-13-03 two render() calls cause uiLayer.prepare() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synViewModel());
    const p = new DocumentListPanel({ prepare: spy } as unknown as UiIntegrationLayer);
    p.render({ scope: 'required' });
    p.render({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
