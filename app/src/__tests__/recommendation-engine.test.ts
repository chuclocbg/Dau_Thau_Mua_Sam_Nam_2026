import { describe, it, expect, vi } from 'vitest';
import { RecommendationEngine, buildRecommendationEngine } from '../agents/RecommendationEngine';
import type { RecommendationCode }                                              from '../agents/RecommendationEngine';
import { DocumentListPanel, buildPanel }                                        from '../agents/DocumentListPanel';
import { UiIntegrationLayer }                                                   from '../agents/UiIntegrationLayer';
import { PipelineOrchestrator }                                                 from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                                                   from '../agents/ManifestSerializer';
import { DocumentManifest }                                                     from '../agents/DocumentManifest';
import { ResultFormatter }                                                      from '../agents/ResultFormatter';
import { QueryExecutor }                                                        from '../agents/QueryExecutor';
import { QueryPlanner }                                                         from '../agents/QueryPlanner';
import { SearchEngine }                                                         from '../agents/SearchEngine';
import type { PanelOutput, PanelItem }                                         from '../agents/DocumentListPanel';
import type { QueryDescriptor }                                                 from '../agents/QueryPlanner';
import type { RegistryEntry }                                                   from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                                        from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                                                  from '../agents/SnapshotBuilder';

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
    metadata: { entryCount: entries.length, requiredCount: requiredEntries.length,
                optionalCount: optionalEntries.length, targetDate },
  };
}

function makePanel(opts: Parameters<typeof synRegistry>[0]) {
  return new DocumentListPanel(
    new UiIntegrationLayer(
      new PipelineOrchestrator(
        new ManifestSerializer(
          new DocumentManifest(
            new ResultFormatter(
              new QueryExecutor(new QueryPlanner(new SearchEngine(synRegistry(opts)))),
            ),
          ),
        ),
      ),
    ),
  );
}

function synPanelOutput(opts: {
  isEmpty?:       boolean;
  namedLabel?:    string | null;
  requiredItems?: readonly { label: string }[];
  optionalItems?: readonly { label: string }[];
  targetDate?:    string;
  totalCount?:    number;
} = {}): PanelOutput {
  const requiredItems = (opts.requiredItems ?? []) as PanelItem[];
  const optionalItems = (opts.optionalItems ?? []) as PanelItem[];
  const totalCount    = opts.totalCount ?? requiredItems.length + optionalItems.length;
  const isEmpty       = opts.isEmpty    ?? totalCount === 0;
  return {
    title:         isEmpty ? 'No documents' : `${totalCount} documents`,
    targetDate:    opts.targetDate  ?? '2026-01-01',
    isEmpty,
    namedLabel:    opts.namedLabel  ?? null,
    items:         [...requiredItems, ...optionalItems],
    requiredItems,
    optionalItems,
    totalCount,
  };
}

// Real pipeline.
const fwdEngine  = buildRecommendationEngine(FWD.last, FWD.cur);
const sameEngine = buildRecommendationEngine(SAME.last, SAME.cur);

// Synthetic mixed: 4 required + 6 optional.
const mixedEngine = new RecommendationEngine(makePanel({
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

function find(engine: RecommendationEngine, code: RecommendationCode, descriptor: QueryDescriptor = {}) {
  return engine.recommend(descriptor).recommendations.find(r => r.code === code);
}

// ── RE-01 READY ───────────────────────────────────────────────────────────────

describe('RE-01 READY', () => {
  it('RE-01-01 forward — recommend({}).hasActions is true', () => {
    expect(fwdEngine.recommend({}).hasActions).toBe(true);
  });

  it('RE-01-02 forward — recommendations is non-empty', () => {
    expect(fwdEngine.recommend({}).recommendations.length).toBeGreaterThan(0);
  });

  it('RE-01-03 forward — primaryCode is not "NO_ACTION"', () => {
    expect(fwdEngine.recommend({}).primaryCode).not.toBe('NO_ACTION');
  });
});

// ── RE-02 PENDING_APPROVAL ────────────────────────────────────────────────────

describe('RE-02 PENDING_APPROVAL', () => {
  const e = new RecommendationEngine(makePanel({ status: 'PENDING_APPROVAL' }));

  it('RE-02-01 hasActions is false', () => {
    expect(e.recommend({}).hasActions).toBe(false);
  });

  it('RE-02-02 recommendations has exactly 1 item', () => {
    expect(e.recommend({}).recommendations).toHaveLength(1);
  });

  it('RE-02-03 primaryCode is "NO_ACTION"', () => {
    expect(e.recommend({}).primaryCode).toBe('NO_ACTION');
  });
});

// ── RE-03 UNCHANGED ───────────────────────────────────────────────────────────

describe('RE-03 UNCHANGED', () => {
  it('RE-03-01 hasActions is false', () => {
    expect(sameEngine.recommend({}).hasActions).toBe(false);
  });

  it('RE-03-02 primaryCode is "NO_ACTION"', () => {
    expect(sameEngine.recommend({}).primaryCode).toBe('NO_ACTION');
  });

  it('RE-03-03 NO_ACTION recommendation has empty labels array', () => {
    expect(sameEngine.recommend({}).recommendations[0].labels).toHaveLength(0);
  });
});

// ── RE-04 PREPARE_ALL recommendation ─────────────────────────────────────────

describe('RE-04 PREPARE_ALL recommendation', () => {
  it('RE-04-01 forward — recommendations includes PREPARE_ALL', () => {
    expect(find(fwdEngine, 'PREPARE_ALL')).toBeDefined();
  });

  it('RE-04-02 PREPARE_ALL message contains totalCount', () => {
    const result = fwdEngine.recommend({});
    const rec    = find(fwdEngine, 'PREPARE_ALL')!;
    expect(rec.message).toContain(String(result.totalCount));
  });

  it('RE-04-03 PREPARE_ALL message contains targetDate', () => {
    const result = fwdEngine.recommend({});
    const rec    = find(fwdEngine, 'PREPARE_ALL')!;
    expect(rec.message).toContain(result.targetDate);
  });
});

// ── RE-05 FOCUS_REQUIRED recommendation ──────────────────────────────────────

describe('RE-05 FOCUS_REQUIRED recommendation', () => {
  it('RE-05-01 mixed — recommendations includes FOCUS_REQUIRED', () => {
    expect(find(mixedEngine, 'FOCUS_REQUIRED')).toBeDefined();
  });

  it('RE-05-02 mixed — FOCUS_REQUIRED.labels contains required document labels', () => {
    const rec = find(mixedEngine, 'FOCUS_REQUIRED')!;
    expect(rec.labels).toContain('KE_HOACH_LCNT.DOCX');
  });

  it('RE-05-03 forward — FOCUS_REQUIRED.labels has 10 items', () => {
    expect(find(fwdEngine, 'FOCUS_REQUIRED')!.labels).toHaveLength(10);
  });
});

// ── RE-06 CONSIDER_OPTIONAL recommendation ────────────────────────────────────

describe('RE-06 CONSIDER_OPTIONAL recommendation', () => {
  it('RE-06-01 mixed — recommendations includes CONSIDER_OPTIONAL', () => {
    expect(find(mixedEngine, 'CONSIDER_OPTIONAL')).toBeDefined();
  });

  it('RE-06-02 mixed — CONSIDER_OPTIONAL.labels contains optional document labels', () => {
    const rec = find(mixedEngine, 'CONSIDER_OPTIONAL')!;
    expect(rec.labels).toContain('TO_TRINH_MUA_SAM.DOCX');
  });

  it('RE-06-03 forward — no CONSIDER_OPTIONAL (no optional docs)', () => {
    expect(find(fwdEngine, 'CONSIDER_OPTIONAL')).toBeUndefined();
  });
});

// ── RE-07 NAMED_FOCUS recommendation ─────────────────────────────────────────

describe('RE-07 NAMED_FOCUS recommendation', () => {
  it('RE-07-01 forward with filename — recommendations includes NAMED_FOCUS', () => {
    expect(find(fwdEngine, 'NAMED_FOCUS', { filename: 'TO_TRINH_MUA_SAM' })).toBeDefined();
  });

  it('RE-07-02 NAMED_FOCUS.labels is ["TO_TRINH_MUA_SAM.DOCX"]', () => {
    const rec = find(fwdEngine, 'NAMED_FOCUS', { filename: 'TO_TRINH_MUA_SAM' })!;
    expect(rec.labels).toEqual(['TO_TRINH_MUA_SAM.DOCX']);
  });

  it('RE-07-03 forward without filename — no NAMED_FOCUS recommendation', () => {
    expect(find(fwdEngine, 'NAMED_FOCUS')).toBeUndefined();
  });
});

// ── RE-08 priority ordering ───────────────────────────────────────────────────

describe('RE-08 priority ordering', () => {
  it('RE-08-01 recommendations are sorted by priority ascending', () => {
    const recs = mixedEngine.recommend({}).recommendations;
    expect(recs.every((r, i) => i === 0 || recs[i - 1].priority <= r.priority)).toBe(true);
  });

  it('RE-08-02 mixed — FOCUS_REQUIRED priority is less than CONSIDER_OPTIONAL priority', () => {
    const recs   = mixedEngine.recommend({}).recommendations;
    const focPri = recs.find(r => r.code === 'FOCUS_REQUIRED')!.priority;
    const conPri = recs.find(r => r.code === 'CONSIDER_OPTIONAL')!.priority;
    expect(focPri).toBeLessThan(conPri);
  });

  it('RE-08-03 forward with filename — NAMED_FOCUS has priority 1', () => {
    const rec = find(fwdEngine, 'NAMED_FOCUS', { filename: 'TO_TRINH_MUA_SAM' })!;
    expect(rec.priority).toBe(1);
  });
});

// ── RE-09 primaryCode ─────────────────────────────────────────────────────────

describe('RE-09 primaryCode', () => {
  it('RE-09-01 forward — primaryCode is "PREPARE_ALL" (no named focus)', () => {
    expect(fwdEngine.recommend({}).primaryCode).toBe('PREPARE_ALL');
  });

  it('RE-09-02 forward with filename — primaryCode is "NAMED_FOCUS"', () => {
    expect(fwdEngine.recommend({ filename: 'TO_TRINH_MUA_SAM' }).primaryCode).toBe('NAMED_FOCUS');
  });

  it('RE-09-03 UNCHANGED — primaryCode is "NO_ACTION"', () => {
    expect(sameEngine.recommend({}).primaryCode).toBe('NO_ACTION');
  });
});

// ── RE-10 targetDate ──────────────────────────────────────────────────────────

describe('RE-10 targetDate', () => {
  it('RE-10-01 forward — targetDate is a non-empty string', () => {
    const td = fwdEngine.recommend({}).targetDate;
    expect(typeof td).toBe('string');
    expect(td.length).toBeGreaterThan(0);
  });

  it('RE-10-02 targetDate matches the panel targetDate', () => {
    const panelOut  = buildPanel(FWD.last, FWD.cur).render({});
    const engineOut = fwdEngine.recommend({});
    expect(engineOut.targetDate).toBe(panelOut.targetDate);
  });

  it('RE-10-03 custom targetDate forwarded correctly', () => {
    const e = new RecommendationEngine(makePanel({ targetDate: '2099-12-31' }));
    expect(e.recommend({}).targetDate).toBe('2099-12-31');
  });
});

// ── RE-11 scope interaction ───────────────────────────────────────────────────

describe('RE-11 scope interaction', () => {
  it('RE-11-01 mixed scope=required — no CONSIDER_OPTIONAL', () => {
    expect(find(mixedEngine, 'CONSIDER_OPTIONAL', { scope: 'required' })).toBeUndefined();
  });

  it('RE-11-02 mixed scope=optional — no FOCUS_REQUIRED', () => {
    expect(find(mixedEngine, 'FOCUS_REQUIRED', { scope: 'optional' })).toBeUndefined();
  });

  it('RE-11-03 mixed scope=required — FOCUS_REQUIRED is present', () => {
    expect(find(mixedEngine, 'FOCUS_REQUIRED', { scope: 'required' })).toBeDefined();
  });
});

// ── RE-12 deterministic output ────────────────────────────────────────────────

describe('RE-12 deterministic output', () => {
  it('RE-12-01 two recommend() calls same descriptor produce same primaryCode', () => {
    const d = { scope: 'all' as const };
    expect(mixedEngine.recommend(d).primaryCode).toBe(mixedEngine.recommend(d).primaryCode);
  });

  it('RE-12-02 PREPARE_ALL message is the same across two calls', () => {
    expect(find(fwdEngine, 'PREPARE_ALL')!.message)
      .toBe(find(fwdEngine, 'PREPARE_ALL')!.message);
  });

  it('RE-12-03 recommendations are sorted by priority on every call', () => {
    for (let call = 0; call < 2; call++) {
      const recs = mixedEngine.recommend({}).recommendations;
      expect(recs.every((r, i) => i === 0 || recs[i - 1].priority <= r.priority)).toBe(true);
    }
  });
});

// ── RE-13 spy injection ───────────────────────────────────────────────────────

describe('RE-13 spy injection', () => {
  it('RE-13-01 recommend() calls panel.render() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synPanelOutput());
    new RecommendationEngine({ render: spy } as unknown as DocumentListPanel)
      .recommend({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('RE-13-02 panel.render() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synPanelOutput());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new RecommendationEngine({ render: spy } as unknown as DocumentListPanel).recommend(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('RE-13-03 two recommend() calls cause panel.render() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synPanelOutput());
    const e = new RecommendationEngine({ render: spy } as unknown as DocumentListPanel);
    e.recommend({ scope: 'required' });
    e.recommend({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
