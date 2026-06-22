import { describe, it, expect, vi } from 'vitest';
import { AuditTrail, buildAuditTrail, auditFromResult, historyFromRecords } from '../agents/AuditTrail';
import { RecommendationEngine, buildRecommendationEngine }                  from '../agents/RecommendationEngine';
import type { RecommendationCode, RecommendationResult }                    from '../agents/RecommendationEngine';
import { DocumentListPanel }                                                from '../agents/DocumentListPanel';
import { UiIntegrationLayer }                                               from '../agents/UiIntegrationLayer';
import { PipelineOrchestrator }                                             from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                                               from '../agents/ManifestSerializer';
import { DocumentManifest }                                                 from '../agents/DocumentManifest';
import { ResultFormatter }                                                  from '../agents/ResultFormatter';
import { QueryExecutor }                                                    from '../agents/QueryExecutor';
import { QueryPlanner }                                                     from '../agents/QueryPlanner';
import { SearchEngine }                                                     from '../agents/SearchEngine';
import type { QueryDescriptor }                                             from '../agents/QueryPlanner';
import type { RegistryEntry }                                               from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                                    from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                                              from '../agents/SnapshotBuilder';

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

function makeEngine(opts: Parameters<typeof synRegistry>[0]) {
  return new RecommendationEngine(
    new DocumentListPanel(
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
    ),
  );
}

function synResult(opts: {
  primaryCode?:        RecommendationCode;
  hasActions?:         boolean;
  totalCount?:         number;
  targetDate?:         string;
  recommendationCount?: number;
} = {}): RecommendationResult {
  const primaryCode = opts.primaryCode ?? 'NO_ACTION';
  const hasActions  = opts.hasActions  ?? primaryCode !== 'NO_ACTION';
  const n           = opts.recommendationCount ?? 1;
  return {
    primaryCode,
    hasActions,
    totalCount:      opts.totalCount ?? 0,
    targetDate:      opts.targetDate  ?? '2026-01-01',
    recommendations: Array.from({ length: n }, (_, i) => ({
      code: primaryCode, message: 'test', priority: i + 1, labels: [],
    })),
  };
}

// Stateless engines — safe to share across tests.
const fwdEngine  = buildRecommendationEngine(FWD.last, FWD.cur);
const sameEngine = buildRecommendationEngine(SAME.last, SAME.cur);
const mixedEngine = makeEngine({
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

// Fresh AuditTrail per call — avoids state leak between tests.
function fwdTrail()   { return new AuditTrail(fwdEngine);   }
function sameTrail()  { return new AuditTrail(sameEngine);  }
function mixedTrail() { return new AuditTrail(mixedEngine); }

// ── AT-01 READY single audit ──────────────────────────────────────────────────

describe('AT-01 READY single audit', () => {
  it('AT-01-01 forward — audit({}).primaryCode is "PREPARE_ALL"', () => {
    expect(fwdTrail().audit({}).primaryCode).toBe('PREPARE_ALL');
  });

  it('AT-01-02 forward — audit({}).hasActions is true', () => {
    expect(fwdTrail().audit({}).hasActions).toBe(true);
  });

  it('AT-01-03 forward — audit({}).totalCount is 10', () => {
    expect(fwdTrail().audit({}).totalCount).toBe(10);
  });
});

// ── AT-02 UNCHANGED single audit ─────────────────────────────────────────────

describe('AT-02 UNCHANGED single audit', () => {
  it('AT-02-01 same dates — audit({}).primaryCode is "NO_ACTION"', () => {
    expect(sameTrail().audit({}).primaryCode).toBe('NO_ACTION');
  });

  it('AT-02-02 same dates — audit({}).hasActions is false', () => {
    expect(sameTrail().audit({}).hasActions).toBe(false);
  });

  it('AT-02-03 same dates — audit({}).sequence is 0', () => {
    expect(sameTrail().audit({}).sequence).toBe(0);
  });
});

// ── AT-03 sequence numbering ──────────────────────────────────────────────────

describe('AT-03 sequence numbering', () => {
  it('AT-03-01 first audit has sequence 0', () => {
    const t = fwdTrail();
    expect(t.audit({}).sequence).toBe(0);
  });

  it('AT-03-02 second audit has sequence 1', () => {
    const t = fwdTrail();
    t.audit({});
    expect(t.audit({}).sequence).toBe(1);
  });

  it('AT-03-03 third audit has sequence 2', () => {
    const t = fwdTrail();
    t.audit({});
    t.audit({});
    expect(t.audit({}).sequence).toBe(2);
  });
});

// ── AT-04 AuditRecord.descriptor ─────────────────────────────────────────────

describe('AT-04 AuditRecord.descriptor', () => {
  it('AT-04-01 empty descriptor is the same reference as passed', () => {
    const d: QueryDescriptor = {};
    expect(fwdTrail().audit(d).descriptor).toBe(d);
  });

  it('AT-04-02 descriptor { scope: "required" } is preserved', () => {
    const d: QueryDescriptor = { scope: 'required' };
    expect(fwdTrail().audit(d).descriptor).toEqual(d);
  });

  it('AT-04-03 descriptor with maxPriority is preserved', () => {
    const d: QueryDescriptor = { scope: 'all', maxPriority: 2 };
    expect(fwdTrail().audit(d).descriptor.maxPriority).toBe(2);
  });
});

// ── AT-05 AuditRecord.recommendationCount ────────────────────────────────────

describe('AT-05 AuditRecord.recommendationCount', () => {
  it('AT-05-01 forward — recommendationCount is at least 1', () => {
    expect(fwdTrail().audit({}).recommendationCount).toBeGreaterThanOrEqual(1);
  });

  it('AT-05-02 UNCHANGED — recommendationCount is 1 (NO_ACTION only)', () => {
    expect(sameTrail().audit({}).recommendationCount).toBe(1);
  });

  it('AT-05-03 mixed — recommendationCount is 3 (PREPARE_ALL + FOCUS_REQUIRED + CONSIDER_OPTIONAL)', () => {
    expect(mixedTrail().audit({}).recommendationCount).toBe(3);
  });
});

// ── AT-06 AuditHistory.records growth ────────────────────────────────────────

describe('AT-06 AuditHistory.records growth', () => {
  it('AT-06-01 fresh trail — records is empty', () => {
    expect(fwdTrail().report().records).toHaveLength(0);
  });

  it('AT-06-02 after 1 audit — records has 1 item', () => {
    const t = fwdTrail();
    t.audit({});
    expect(t.report().records).toHaveLength(1);
  });

  it('AT-06-03 after 3 audits — records has 3 items', () => {
    const t = fwdTrail();
    t.audit({});
    t.audit({});
    t.audit({});
    expect(t.report().records).toHaveLength(3);
  });
});

// ── AT-07 AuditHistory.totalAudits ───────────────────────────────────────────

describe('AT-07 AuditHistory.totalAudits', () => {
  it('AT-07-01 empty — totalAudits is 0', () => {
    expect(fwdTrail().report().totalAudits).toBe(0);
  });

  it('AT-07-02 after 2 audits — totalAudits is 2', () => {
    const t = fwdTrail();
    t.audit({});
    t.audit({});
    expect(t.report().totalAudits).toBe(2);
  });

  it('AT-07-03 totalAudits equals records.length', () => {
    const t = fwdTrail();
    t.audit({});
    t.audit({});
    const h = t.report();
    expect(h.totalAudits).toBe(h.records.length);
  });
});

// ── AT-08 AuditHistory.actionableCount ───────────────────────────────────────

describe('AT-08 AuditHistory.actionableCount', () => {
  it('AT-08-01 3 forward audits — actionableCount is 3', () => {
    const t = fwdTrail();
    t.audit({}); t.audit({}); t.audit({});
    expect(t.report().actionableCount).toBe(3);
  });

  it('AT-08-02 2 UNCHANGED audits — actionableCount is 0', () => {
    const t = sameTrail();
    t.audit({}); t.audit({});
    expect(t.report().actionableCount).toBe(0);
  });

  it('AT-08-03 1 actionable + 1 non-actionable — actionableCount is 1', () => {
    const spy = vi.fn()
      .mockReturnValueOnce(synResult({ primaryCode: 'PREPARE_ALL', hasActions: true,  totalCount: 10 }))
      .mockReturnValueOnce(synResult({ primaryCode: 'NO_ACTION',   hasActions: false, totalCount: 0  }));
    const t = new AuditTrail({ recommend: spy } as unknown as RecommendationEngine);
    t.audit({}); t.audit({});
    expect(t.report().actionableCount).toBe(1);
  });
});

// ── AT-09 latestRecord and firstRecord ───────────────────────────────────────

describe('AT-09 latestRecord and firstRecord', () => {
  it('AT-09-01 empty — latestRecord is undefined', () => {
    expect(fwdTrail().report().latestRecord).toBeUndefined();
  });

  it('AT-09-02 after 2 audits — latestRecord.sequence is 1', () => {
    const t = fwdTrail();
    t.audit({}); t.audit({});
    expect(t.report().latestRecord?.sequence).toBe(1);
  });

  it('AT-09-03 after 2 audits — firstRecord.sequence is 0', () => {
    const t = fwdTrail();
    t.audit({}); t.audit({});
    expect(t.report().firstRecord?.sequence).toBe(0);
  });
});

// ── AT-10 AuditHistory.primaryCodes ──────────────────────────────────────────

describe('AT-10 AuditHistory.primaryCodes', () => {
  it('AT-10-01 empty — primaryCodes is []', () => {
    expect(fwdTrail().report().primaryCodes).toHaveLength(0);
  });

  it('AT-10-02 2 forward audits — primaryCodes is ["PREPARE_ALL", "PREPARE_ALL"]', () => {
    const t = fwdTrail();
    t.audit({}); t.audit({});
    expect(t.report().primaryCodes).toEqual(['PREPARE_ALL', 'PREPARE_ALL']);
  });

  it('AT-10-03 1 READY + 1 UNCHANGED — primaryCodes preserves source order', () => {
    const spy = vi.fn()
      .mockReturnValueOnce(synResult({ primaryCode: 'PREPARE_ALL', hasActions: true  }))
      .mockReturnValueOnce(synResult({ primaryCode: 'NO_ACTION',   hasActions: false }));
    const t = new AuditTrail({ recommend: spy } as unknown as RecommendationEngine);
    t.audit({}); t.audit({});
    expect(t.report().primaryCodes).toEqual(['PREPARE_ALL', 'NO_ACTION']);
  });
});

// ── AT-11 audit() return value identity ──────────────────────────────────────

describe('AT-11 audit() return value identity', () => {
  it('AT-11-01 audit() return is same reference as records[0]', () => {
    const t = fwdTrail();
    const r = t.audit({});
    expect(r).toBe(t.report().records[0]);
  });

  it('AT-11-02 first return is same reference as records[0] after two audits', () => {
    const t = fwdTrail();
    const r0 = t.audit({});
    t.audit({});
    expect(r0).toBe(t.report().records[0]);
  });

  it('AT-11-03 records[0] and records[1] are distinct objects', () => {
    const t = fwdTrail();
    t.audit({}); t.audit({});
    const h = t.report();
    expect(h.records[0]).not.toBe(h.records[1]);
  });
});

// ── AT-12 auditFromResult and historyFromRecords helpers ─────────────────────

describe('AT-12 auditFromResult and historyFromRecords helpers', () => {
  it('AT-12-01 auditFromResult with sequence=5 → record.sequence is 5', () => {
    const r = auditFromResult(synResult(), {}, 5);
    expect(r.sequence).toBe(5);
  });

  it('AT-12-02 historyFromRecords([]) → totalAudits=0, firstRecord undefined', () => {
    const h = historyFromRecords([]);
    expect(h.totalAudits).toBe(0);
    expect(h.firstRecord).toBeUndefined();
  });

  it('AT-12-03 historyFromRecords two records → actionableCount counts hasActions', () => {
    const r0 = auditFromResult(synResult({ primaryCode: 'PREPARE_ALL', hasActions: true  }), {}, 0);
    const r1 = auditFromResult(synResult({ primaryCode: 'NO_ACTION',   hasActions: false }), {}, 1);
    expect(historyFromRecords([r0, r1]).actionableCount).toBe(1);
  });
});

// ── AT-13 spy injection ───────────────────────────────────────────────────────

describe('AT-13 spy injection', () => {
  it('AT-13-01 audit() calls engine.recommend() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synResult());
    new AuditTrail({ recommend: spy } as unknown as RecommendationEngine)
      .audit({ scope: 'required' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('AT-13-02 engine.recommend() called with the correct descriptor', () => {
    const spy = vi.fn().mockReturnValue(synResult());
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new AuditTrail({ recommend: spy } as unknown as RecommendationEngine).audit(d);
    expect(spy).toHaveBeenCalledWith(d);
  });

  it('AT-13-03 two audit() calls cause engine.recommend() to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synResult());
    const t = new AuditTrail({ recommend: spy } as unknown as RecommendationEngine);
    t.audit({ scope: 'required' });
    t.audit({ scope: 'optional' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
