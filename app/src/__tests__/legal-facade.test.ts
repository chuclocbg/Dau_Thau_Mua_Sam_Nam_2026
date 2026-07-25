import { describe, it, expect, vi } from 'vitest';
import { LegalFacade, legalFromAudit } from '../agents/LegalFacade';
import { AuditTrail, buildAuditTrail }                   from '../agents/AuditTrail';
import type { AuditRecord, AuditHistory }                from '../agents/AuditTrail';
import { RecommendationEngine }                          from '../agents/RecommendationEngine';
import { DocumentListPanel }                             from '../agents/DocumentListPanel';
import { UiIntegrationLayer }                            from '../agents/UiIntegrationLayer';
import { PipelineOrchestrator }                          from '../agents/PipelineOrchestrator';
import { ManifestSerializer }                            from '../agents/ManifestSerializer';
import { DocumentManifest }                              from '../agents/DocumentManifest';
import { ResultFormatter }                               from '../agents/ResultFormatter';
import { QueryExecutor }                                 from '../agents/QueryExecutor';
import { QueryPlanner }                                  from '../agents/QueryPlanner';
import { SearchEngine }                                  from '../agents/SearchEngine';
import type { RecommendationCode }                       from '../agents/RecommendationEngine';
import type { QueryDescriptor }                          from '../agents/QueryPlanner';
import type { RegistryEntry }                            from '../agents/DocumentRegistry';
import type { ImpactScope, ImpactLevel }                 from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }                           from '../agents/SnapshotBuilder';

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

function makeTrail(opts: Parameters<typeof synRegistry>[0]) {
  return new AuditTrail(
    new RecommendationEngine(
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
    ),
  );
}

function synRecord(opts: {
  sequence?:            number;
  descriptor?:          QueryDescriptor;
  primaryCode?:         RecommendationCode;
  hasActions?:          boolean;
  totalCount?:          number;
  targetDate?:          string;
  recommendationCount?: number;
} = {}): AuditRecord {
  const primaryCode = opts.primaryCode ?? 'NO_ACTION';
  return {
    sequence:            opts.sequence            ?? 0,
    descriptor:          opts.descriptor          ?? {},
    primaryCode,
    hasActions:          opts.hasActions          ?? primaryCode !== 'NO_ACTION',
    totalCount:          opts.totalCount          ?? 0,
    targetDate:          opts.targetDate          ?? '2026-01-01',
    recommendationCount: opts.recommendationCount ?? 1,
  };
}

function synHistory(opts: { records?: AuditRecord[] } = {}): AuditHistory {
  const records = opts.records ?? [];
  return {
    records,
    totalAudits:     records.length,
    actionableCount: records.filter(r => r.hasActions).length,
    latestRecord:    records[records.length - 1],
    firstRecord:     records[0],
    primaryCodes:    records.map(r => r.primaryCode),
  };
}

// Factory functions — fresh facade per call, stateless engines shared below.
// Fresh per test — avoids cross-test state leak.
function fwdFacade()   { return new LegalFacade(buildAuditTrail(FWD.last, FWD.cur));   }
function sameFacade()  { return new LegalFacade(buildAuditTrail(SAME.last, SAME.cur)); }
function mixedFacade() { return new LegalFacade(makeTrail({
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
})); }

// ── LF-01 READY single query ──────────────────────────────────────────────────

describe('LF-01 READY single query', () => {
  it('LF-01-01 forward — query({}).record.primaryCode is "PREPARE_ALL"', () => {
    expect(fwdFacade().query({}).record.primaryCode).toBe('PREPARE_ALL');
  });

  it('LF-01-02 forward — query({}).record.hasActions is true', () => {
    expect(fwdFacade().query({}).record.hasActions).toBe(true);
  });

  it('LF-01-03 forward — query({}).record.totalCount is 10', () => {
    expect(fwdFacade().query({}).record.totalCount).toBe(10);
  });
});

// ── LF-02 UNCHANGED single query ─────────────────────────────────────────────

describe('LF-02 UNCHANGED single query', () => {
  it('LF-02-01 same dates — query({}).record.primaryCode is "NO_ACTION"', () => {
    expect(sameFacade().query({}).record.primaryCode).toBe('NO_ACTION');
  });

  it('LF-02-02 same dates — query({}).record.hasActions is false', () => {
    expect(sameFacade().query({}).record.hasActions).toBe(false);
  });

  it('LF-02-03 same dates — query({}).history.actionableCount is 0', () => {
    expect(sameFacade().query({}).history.actionableCount).toBe(0);
  });
});

// ── LF-03 record.sequence ────────────────────────────────────────────────────

describe('LF-03 record.sequence', () => {
  it('LF-03-01 first query has record.sequence 0', () => {
    expect(fwdFacade().query({}).record.sequence).toBe(0);
  });

  it('LF-03-02 second query has record.sequence 1', () => {
    const f = fwdFacade();
    f.query({});
    expect(f.query({}).record.sequence).toBe(1);
  });

  it('LF-03-03 each successive query increments sequence by 1', () => {
    const f = fwdFacade();
    const r0 = f.query({}).record.sequence;
    const r1 = f.query({}).record.sequence;
    const r2 = f.query({}).record.sequence;
    expect([r0, r1, r2]).toEqual([0, 1, 2]);
  });
});

// ── LF-04 history growth ──────────────────────────────────────────────────────

describe('LF-04 history growth', () => {
  it('LF-04-01 after first query — history.totalAudits is 1', () => {
    expect(fwdFacade().query({}).history.totalAudits).toBe(1);
  });

  it('LF-04-02 after 2 queries — history.totalAudits is 2', () => {
    const f = fwdFacade();
    f.query({});
    expect(f.query({}).history.totalAudits).toBe(2);
  });

  it('LF-04-03 history.totalAudits equals history.records.length', () => {
    const f = fwdFacade();
    f.query({}); f.query({});
    const { history } = f.query({});
    expect(history.totalAudits).toBe(history.records.length);
  });
});

// ── LF-05 record identity with latestRecord ───────────────────────────────────

describe('LF-05 record identity with latestRecord', () => {
  it('LF-05-01 result.record is the same reference as history.latestRecord', () => {
    const { record, history } = fwdFacade().query({});
    expect(record).toBe(history.latestRecord);
  });

  it('LF-05-02 record.sequence equals history.latestRecord.sequence', () => {
    const { record, history } = fwdFacade().query({});
    expect(record.sequence).toBe(history.latestRecord!.sequence);
  });

  it('LF-05-03 record.primaryCode equals history.latestRecord.primaryCode', () => {
    const { record, history } = fwdFacade().query({});
    expect(record.primaryCode).toBe(history.latestRecord!.primaryCode);
  });
});

// ── LF-06 history.actionableCount ────────────────────────────────────────────

describe('LF-06 history.actionableCount', () => {
  it('LF-06-01 3 forward queries — actionableCount is 3', () => {
    const f = fwdFacade();
    f.query({}); f.query({});
    expect(f.query({}).history.actionableCount).toBe(3);
  });

  it('LF-06-02 2 UNCHANGED queries — actionableCount is 0', () => {
    const f = sameFacade();
    f.query({});
    expect(f.query({}).history.actionableCount).toBe(0);
  });

  it('LF-06-03 1 actionable + 1 non-actionable — actionableCount is 1', () => {
    const rec0 = synRecord({ primaryCode: 'PREPARE_ALL', hasActions: true  });
    const rec1 = synRecord({ primaryCode: 'NO_ACTION',   hasActions: false, sequence: 1 });
    const auditSpy = vi.fn()
      .mockReturnValueOnce(rec0)
      .mockReturnValueOnce(rec1);
    const reportSpy = vi.fn()
      .mockReturnValueOnce(synHistory({ records: [rec0] }))
      .mockReturnValueOnce(synHistory({ records: [rec0, rec1] }));
    const f = new LegalFacade({ audit: auditSpy, report: reportSpy } as unknown as AuditTrail);
    f.query({});
    expect(f.query({}).history.actionableCount).toBe(1);
  });
});

// ── LF-07 history.primaryCodes ────────────────────────────────────────────────

describe('LF-07 history.primaryCodes', () => {
  it('LF-07-01 first query — primaryCodes has exactly 1 item', () => {
    expect(fwdFacade().query({}).history.primaryCodes).toHaveLength(1);
  });

  it('LF-07-02 2 forward queries — primaryCodes is ["PREPARE_ALL", "PREPARE_ALL"]', () => {
    const f = fwdFacade();
    f.query({});
    expect(f.query({}).history.primaryCodes).toEqual(['PREPARE_ALL', 'PREPARE_ALL']);
  });

  it('LF-07-03 primaryCodes preserves call order', () => {
    const rec0 = synRecord({ primaryCode: 'PREPARE_ALL', hasActions: true  });
    const rec1 = synRecord({ primaryCode: 'NO_ACTION',   hasActions: false, sequence: 1 });
    const auditSpy = vi.fn()
      .mockReturnValueOnce(rec0)
      .mockReturnValueOnce(rec1);
    const reportSpy = vi.fn()
      .mockReturnValueOnce(synHistory({ records: [rec0] }))
      .mockReturnValueOnce(synHistory({ records: [rec0, rec1] }));
    const f = new LegalFacade({ audit: auditSpy, report: reportSpy } as unknown as AuditTrail);
    f.query({});
    expect(f.query({}).history.primaryCodes).toEqual(['PREPARE_ALL', 'NO_ACTION']);
  });
});

// ── LF-08 LegalResult.record fields ──────────────────────────────────────────

describe('LF-08 LegalResult.record fields', () => {
  it('LF-08-01 record.targetDate is a non-empty string', () => {
    const { record } = fwdFacade().query({});
    expect(typeof record.targetDate).toBe('string');
    expect(record.targetDate.length).toBeGreaterThan(0);
  });

  it('LF-08-02 record.descriptor is the same reference as the passed descriptor', () => {
    const d: QueryDescriptor = { scope: 'required' };
    expect(fwdFacade().query(d).record.descriptor).toBe(d);
  });

  it('LF-08-03 forward — record.recommendationCount is at least 1', () => {
    expect(fwdFacade().query({}).record.recommendationCount).toBeGreaterThanOrEqual(1);
  });
});

// ── LF-09 history.firstRecord and latestRecord ────────────────────────────────

describe('LF-09 history.firstRecord and latestRecord', () => {
  it('LF-09-01 first query — history.firstRecord.sequence is 0', () => {
    expect(fwdFacade().query({}).history.firstRecord?.sequence).toBe(0);
  });

  it('LF-09-02 after 2 queries — history.latestRecord.sequence is 1', () => {
    const f = fwdFacade();
    f.query({});
    expect(f.query({}).history.latestRecord?.sequence).toBe(1);
  });

  it('LF-09-03 firstRecord.sequence is always 0 regardless of total query count', () => {
    const f = fwdFacade();
    f.query({}); f.query({});
    expect(f.query({}).history.firstRecord?.sequence).toBe(0);
  });
});

// ── LF-10 descriptor passthrough ─────────────────────────────────────────────

describe('LF-10 descriptor passthrough', () => {
  it('LF-10-01 scope="required" descriptor preserved in record.descriptor', () => {
    const d: QueryDescriptor = { scope: 'required' };
    expect(fwdFacade().query(d).record.descriptor).toEqual(d);
  });

  it('LF-10-02 filename descriptor preserved', () => {
    const d: QueryDescriptor = { filename: 'TO_TRINH_MUA_SAM' };
    expect(fwdFacade().query(d).record.descriptor).toEqual(d);
  });

  it('LF-10-03 scope="optional" descriptor preserved', () => {
    const d: QueryDescriptor = { scope: 'optional' };
    expect(mixedFacade().query(d).record.descriptor).toEqual(d);
  });
});

// ── LF-11 deterministic output ───────────────────────────────────────────────

describe('LF-11 deterministic output', () => {
  it('LF-11-01 two separate facades with same dates produce same primaryCode', () => {
    expect(fwdFacade().query({}).record.primaryCode)
      .toBe(fwdFacade().query({}).record.primaryCode);
  });

  it('LF-11-02 two queries on same facade produce same primaryCode', () => {
    const f = fwdFacade();
    expect(f.query({}).record.primaryCode).toBe(f.query({}).record.primaryCode);
  });

  it('LF-11-03 history.totalAudits always equals number of queries called', () => {
    const f = fwdFacade();
    f.query({}); f.query({});
    expect(f.query({}).history.totalAudits).toBe(3);
  });
});

// ── LF-12 legalFromAudit helper ───────────────────────────────────────────────

describe('LF-12 legalFromAudit helper', () => {
  it('LF-12-01 legalFromAudit returns an object with record and history', () => {
    const r = synRecord();
    const h = synHistory({ records: [r] });
    const result = legalFromAudit(r, h);
    expect(result.record).toBeDefined();
    expect(result.history).toBeDefined();
  });

  it('LF-12-02 legalFromAudit.record is the same reference as the input record', () => {
    const r = synRecord();
    expect(legalFromAudit(r, synHistory()).record).toBe(r);
  });

  it('LF-12-03 legalFromAudit.history is the same reference as the input history', () => {
    const h = synHistory();
    expect(legalFromAudit(synRecord(), h).history).toBe(h);
  });
});

// ── LF-13 spy injection ───────────────────────────────────────────────────────

describe('LF-13 spy injection', () => {
  it('LF-13-01 query() calls trail.audit() exactly once', () => {
    const rec  = synRecord();
    const auditSpy  = vi.fn().mockReturnValue(rec);
    const reportSpy = vi.fn().mockReturnValue(synHistory({ records: [rec] }));
    new LegalFacade({ audit: auditSpy, report: reportSpy } as unknown as AuditTrail)
      .query({ scope: 'required' });
    expect(auditSpy).toHaveBeenCalledOnce();
  });

  it('LF-13-02 query() calls trail.report() exactly once', () => {
    const rec  = synRecord();
    const auditSpy  = vi.fn().mockReturnValue(rec);
    const reportSpy = vi.fn().mockReturnValue(synHistory({ records: [rec] }));
    new LegalFacade({ audit: auditSpy, report: reportSpy } as unknown as AuditTrail)
      .query({ scope: 'required' });
    expect(reportSpy).toHaveBeenCalledOnce();
  });

  it('LF-13-03 trail.audit() is called with the correct descriptor', () => {
    const rec  = synRecord();
    const auditSpy  = vi.fn().mockReturnValue(rec);
    const reportSpy = vi.fn().mockReturnValue(synHistory({ records: [rec] }));
    const d: QueryDescriptor = { scope: 'required', maxPriority: 2 };
    new LegalFacade({ audit: auditSpy, report: reportSpy } as unknown as AuditTrail).query(d);
    expect(auditSpy).toHaveBeenCalledWith(d);
  });
});
