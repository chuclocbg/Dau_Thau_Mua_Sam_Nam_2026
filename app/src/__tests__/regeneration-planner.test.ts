import { describe, it, expect, vi } from 'vitest';
import {
  RegenerationPlanner,
  planFromDocument,
  type RegenerationPlan,
} from '../agents/RegenerationPlanner';
import { DocumentDependencyResolver } from '../agents/DocumentDependencyResolver';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

// All 10 documents from the registry in pipeline order (GENERAL→HR→BIDDING→FINANCIAL)
const ALL_DOCS = [
  { id: 'TO_TRINH_MUA_SAM',        template: 'TO_TRINH' },
  { id: 'QUYET_DINH_PHE_DUYET',    template: 'QUYET_DINH' },
  { id: 'BIEN_BAN_THAM_DINH',      template: 'BIEN_BAN' },
  { id: 'QUYET_DINH_PHAN_CONG',    template: 'PHAN_CONG_NHIEM_VU' },
  { id: 'KE_HOACH_LCNT',           template: 'KHLCNT' },
  { id: 'HO_SO_YEU_CAU',           template: 'HSYC' },
  { id: 'HO_SO_MOI_THAU',          template: 'HSMT' },
  { id: 'BAO_CAO_DANH_GIA_HSDT',   template: 'BAO_CAO_DANH_GIA' },
  { id: 'DU_TOAN_MUA_SAM',         template: 'DU_TOAN' },
  { id: 'CHUNG_THU_THAM_DINH_GIA', template: 'THAM_DINH_GIA' },
] as const;

const BIDDING_DOCS = [
  { id: 'KE_HOACH_LCNT',          template: 'KHLCNT' },
  { id: 'HO_SO_YEU_CAU',          template: 'HSYC' },
  { id: 'HO_SO_MOI_THAU',         template: 'HSMT' },
  { id: 'BAO_CAO_DANH_GIA_HSDT',  template: 'BAO_CAO_DANH_GIA' },
] as const;

function synDoc(opts: {
  status?:      SnapshotStatus;
  documents?:   readonly { id: string; template: string; type?: string }[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
} = {}) {
  const status    = opts.status ?? 'READY';
  const rawDocs   = status === 'READY' ? (opts.documents ?? []) : [];
  const documents = rawDocs.map(d => ({ ...d, type: d.type ?? 'DOCUMENT' }));
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE',
    impactLevel: opts.impactLevel ?? 'NONE',
    documents,
    metadata: { documentCount: documents.length, edgeCount: 0, targetDate: opts.targetDate ?? '2026-01-01' },
  };
}

// Two real pipeline calls — shared across all groups that need real data.
const fwdPlan:  RegenerationPlan = new RegenerationPlanner().plan(FWD.last, FWD.cur);
const samePlan: RegenerationPlan = new RegenerationPlanner().plan(SAME.last, SAME.cur);

// Pre-computed synthetic plans for LOW and HIGH
const lowPlan  = planFromDocument(synDoc({ status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',  documents: BIDDING_DOCS }));
const highPlan = planFromDocument(synDoc({ status: 'READY', impactScope: 'BROAD',  impactLevel: 'HIGH', documents: ALL_DOCS }));

// ── RP-01 READY ───────────────────────────────────────────────────────────────

describe('RP-01 READY', () => {
  it('RP-01-01 status is READY', () => {
    expect(fwdPlan.status).toBe('READY');
  });

  it('RP-01-02 forward produces 10 documentsToRegenerate', () => {
    expect(fwdPlan.documentsToRegenerate).toHaveLength(10);
  });

  it('RP-01-03 result has all required fields', () => {
    expect(fwdPlan).toMatchObject({
      status:                expect.any(String),
      impactScope:           expect.any(String),
      impactLevel:           expect.any(String),
      documentsToRegenerate: expect.any(Array),
      mandatoryDocuments:    expect.any(Array),
      optionalDocuments:     expect.any(Array),
      metadata:              expect.objectContaining({ documentCount: expect.any(Number) }),
    });
  });
});

// ── RP-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('RP-02 PENDING_APPROVAL', () => {
  const r = planFromDocument(synDoc({ status: 'PENDING_APPROVAL' }));

  it('RP-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('RP-02-02 documentsToRegenerate is empty', () => {
    expect(r.documentsToRegenerate).toHaveLength(0);
  });

  it('RP-02-03 mandatory and optional are empty', () => {
    expect(r.mandatoryDocuments).toHaveLength(0);
    expect(r.optionalDocuments).toHaveLength(0);
  });
});

// ── RP-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('RP-03 UNCHANGED', () => {
  it('RP-03-01 status is UNCHANGED', () => {
    expect(samePlan.status).toBe('UNCHANGED');
  });

  it('RP-03-02 documentsToRegenerate is empty', () => {
    expect(samePlan.documentsToRegenerate).toHaveLength(0);
  });

  it('RP-03-03 mandatoryDocuments is empty', () => {
    expect(samePlan.mandatoryDocuments).toHaveLength(0);
  });
});

// ── RP-04 LOW level mandatory ──────────────────────────────────────────────────

describe('RP-04 LOW level mandatory', () => {
  it('RP-04-01 LOW mandatory includes KE_HOACH_LCNT', () => {
    expect(lowPlan.mandatoryDocuments.some(d => d.id === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('RP-04-02 LOW mandatory includes HO_SO_YEU_CAU', () => {
    expect(lowPlan.mandatoryDocuments.some(d => d.id === 'HO_SO_YEU_CAU')).toBe(true);
  });

  it('RP-04-03 LOW mandatory has exactly 2 documents', () => {
    expect(lowPlan.mandatoryDocuments).toHaveLength(2);
  });
});

// ── RP-05 HIGH level mandatory ─────────────────────────────────────────────────

describe('RP-05 HIGH level mandatory', () => {
  it('RP-05-01 HIGH mandatory includes KE_HOACH_LCNT', () => {
    expect(highPlan.mandatoryDocuments.some(d => d.id === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('RP-05-02 HIGH mandatory includes HO_SO_MOI_THAU', () => {
    expect(highPlan.mandatoryDocuments.some(d => d.id === 'HO_SO_MOI_THAU')).toBe(true);
  });

  it('RP-05-03 HIGH mandatory includes DU_TOAN_MUA_SAM', () => {
    expect(highPlan.mandatoryDocuments.some(d => d.id === 'DU_TOAN_MUA_SAM')).toBe(true);
  });
});

// ── RP-06 CRITICAL mandatory ───────────────────────────────────────────────────

describe('RP-06 CRITICAL mandatory', () => {
  it('RP-06-01 CRITICAL produces no optional documents', () => {
    expect(fwdPlan.optionalDocuments).toHaveLength(0);
  });

  it('RP-06-02 CRITICAL mandatoryDocuments.length equals documentsToRegenerate.length', () => {
    expect(fwdPlan.mandatoryDocuments.length).toBe(fwdPlan.documentsToRegenerate.length);
  });

  it('RP-06-03 every document ID appears in mandatoryDocuments', () => {
    const mandatoryIds = new Set(fwdPlan.mandatoryDocuments.map(d => d.id));
    expect(fwdPlan.documentsToRegenerate.every(d => mandatoryIds.has(d.id))).toBe(true);
  });
});

// ── RP-07 optional documents ───────────────────────────────────────────────────

describe('RP-07 optional documents', () => {
  it('RP-07-01 LOW + BIDDING — optional includes HO_SO_MOI_THAU', () => {
    expect(lowPlan.optionalDocuments.some(d => d.id === 'HO_SO_MOI_THAU')).toBe(true);
  });

  it('RP-07-02 HIGH + all 10 docs — optional count is 6', () => {
    expect(highPlan.optionalDocuments).toHaveLength(6);
  });

  it('RP-07-03 CRITICAL — optional count is 0', () => {
    expect(fwdPlan.optionalDocuments).toHaveLength(0);
  });
});

// ── RP-08 ordering ─────────────────────────────────────────────────────────────

describe('RP-08 ordering', () => {
  it('RP-08-01 documentsToRegenerate[0] matches first source document', () => {
    expect(fwdPlan.documentsToRegenerate[0].id).toBe('TO_TRINH_MUA_SAM');
  });

  it('RP-08-02 LOW mandatory preserves source order, not mandatory-list order', () => {
    // Source with HO_SO_YEU_CAU before KE_HOACH_LCNT (reversed from mandatory list)
    const r = planFromDocument(synDoc({
      status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',
      documents: [
        { id: 'HO_SO_YEU_CAU', template: 'HSYC' },
        { id: 'KE_HOACH_LCNT', template: 'KHLCNT' },
        { id: 'HO_SO_MOI_THAU', template: 'HSMT' },
      ],
    }));
    expect(r.mandatoryDocuments[0].id).toBe('HO_SO_YEU_CAU');
    expect(r.mandatoryDocuments[1].id).toBe('KE_HOACH_LCNT');
  });

  it('RP-08-03 optionalDocuments preserves source order', () => {
    // Source: mandatory, optional-A, mandatory, optional-B, mandatory, mandatory
    const r = planFromDocument(synDoc({
      status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
      documents: [
        { id: 'KE_HOACH_LCNT',        template: 'KHLCNT' },
        { id: 'TO_TRINH_MUA_SAM',     template: 'TO_TRINH' },      // optional
        { id: 'HO_SO_YEU_CAU',        template: 'HSYC' },
        { id: 'HO_SO_MOI_THAU',       template: 'HSMT' },
        { id: 'BIEN_BAN_THAM_DINH',   template: 'BIEN_BAN' },       // optional
        { id: 'DU_TOAN_MUA_SAM',      template: 'DU_TOAN' },
      ],
    }));
    expect(r.optionalDocuments[0].id).toBe('TO_TRINH_MUA_SAM');
    expect(r.optionalDocuments[1].id).toBe('BIEN_BAN_THAM_DINH');
  });
});

// ── RP-09 metadata forwarding ──────────────────────────────────────────────────

describe('RP-09 metadata forwarding', () => {
  it('RP-09-01 metadata.documentCount equals documentsToRegenerate.length', () => {
    expect(fwdPlan.metadata.documentCount).toBe(fwdPlan.documentsToRegenerate.length);
  });

  it('RP-09-02 metadata.mandatoryCount equals mandatoryDocuments.length', () => {
    expect(fwdPlan.metadata.mandatoryCount).toBe(fwdPlan.mandatoryDocuments.length);
  });

  it('RP-09-03 metadata.targetDate forwarded from DocumentDependencyResolver', () => {
    const r = planFromDocument(synDoc({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── RP-10 empty path ───────────────────────────────────────────────────────────

describe('RP-10 empty path', () => {
  const r = planFromDocument(synDoc({ status: 'READY', impactScope: 'NONE', impactLevel: 'NONE', documents: [] }));

  it('RP-10-01 NONE scope — documentsToRegenerate is empty', () => {
    expect(r.documentsToRegenerate).toHaveLength(0);
  });

  it('RP-10-02 NONE scope — metadata.documentCount is 0', () => {
    expect(r.metadata.documentCount).toBe(0);
  });

  it('RP-10-03 NONE scope — mandatory and optional are empty', () => {
    expect(r.mandatoryDocuments).toHaveLength(0);
    expect(r.optionalDocuments).toHaveLength(0);
  });
});

// ── RP-11 count computation ────────────────────────────────────────────────────

describe('RP-11 count computation', () => {
  it('RP-11-01 mandatoryCount + optionalCount equals documentCount', () => {
    expect(lowPlan.metadata.mandatoryCount + lowPlan.metadata.optionalCount)
      .toBe(lowPlan.metadata.documentCount);
  });

  it('RP-11-02 HIGH + 10 docs → mandatoryCount=4, optionalCount=6', () => {
    expect(highPlan.metadata.mandatoryCount).toBe(4);
    expect(highPlan.metadata.optionalCount).toBe(6);
  });

  it('RP-11-03 LOW + 4 BIDDING docs → mandatoryCount=2, optionalCount=2', () => {
    expect(lowPlan.metadata.mandatoryCount).toBe(2);
    expect(lowPlan.metadata.optionalCount).toBe(2);
  });
});

// ── RP-12 no dedup ─────────────────────────────────────────────────────────────

describe('RP-12 no dedup', () => {
  const dupDoc = synDoc({
    status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',
    documents: [
      { id: 'KE_HOACH_LCNT', template: 'KHLCNT' },
      { id: 'KE_HOACH_LCNT', template: 'KHLCNT' }, // duplicate
      { id: 'HO_SO_MOI_THAU', template: 'HSMT' },
    ],
  });
  const r = planFromDocument(dupDoc);

  it('RP-12-01 duplicate doc IDs preserved in documentsToRegenerate', () => {
    expect(r.documentsToRegenerate).toHaveLength(3);
  });

  it('RP-12-02 both duplicate mandatory docs appear in mandatoryDocuments', () => {
    expect(r.mandatoryDocuments).toHaveLength(2);
    expect(r.mandatoryDocuments.every(d => d.id === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('RP-12-03 metadata.documentCount reflects raw source length without dedup', () => {
    expect(r.metadata.documentCount).toBe(3);
  });
});

// ── RP-13 single resolve call ──────────────────────────────────────────────────

describe('RP-13 single resolve call', () => {
  it('RP-13-01 plan() calls documentResolver.resolve() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synDoc({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const planner = new RegenerationPlanner({ resolve: spy } as unknown as DocumentDependencyResolver);
    planner.plan(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('RP-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synDoc({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const planner = new RegenerationPlanner({ resolve: spy } as unknown as DocumentDependencyResolver);
    planner.plan(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('RP-13-03 two plan() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synDoc({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const planner = new RegenerationPlanner({ resolve: spy } as unknown as DocumentDependencyResolver);
    planner.plan(SAME.last, SAME.cur);
    planner.plan(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
