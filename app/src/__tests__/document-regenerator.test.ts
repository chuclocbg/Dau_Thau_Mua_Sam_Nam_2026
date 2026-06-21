import { describe, it, expect, vi } from 'vitest';
import {
  DocumentRegenerator,
  regenerateFromPlan,
  type DocumentRegenerationResult,
} from '../agents/DocumentRegenerator';
import { RegenerationPlanner } from '../agents/RegenerationPlanner';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type DocInput = { id: string };

function synPlan(opts: {
  status?:             SnapshotStatus;
  mandatoryDocuments?: readonly DocInput[];
  optionalDocuments?:  readonly DocInput[];
  impactScope?:        ImpactScope;
  impactLevel?:        ImpactLevel;
  targetDate?:         string;
} = {}) {
  const status    = opts.status ?? 'READY';
  const isReady   = status === 'READY';
  const mandatory = isReady ? (opts.mandatoryDocuments ?? []) : [];
  const optional  = isReady ? (opts.optionalDocuments  ?? []) : [];
  return {
    status,
    impactScope:        opts.impactScope ?? 'NONE',
    impactLevel:        opts.impactLevel ?? 'NONE',
    mandatoryDocuments: mandatory,
    optionalDocuments:  optional,
    metadata: {
      documentCount:  mandatory.length + optional.length,
      mandatoryCount: mandatory.length,
      optionalCount:  optional.length,
      targetDate:     opts.targetDate ?? '2026-01-01',
    },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  DocumentRegenerationResult = new DocumentRegenerator().regenerate(FWD.last, FWD.cur);
const sameResult: DocumentRegenerationResult = new DocumentRegenerator().regenerate(SAME.last, SAME.cur);

// LOW: 2 mandatory (BIDDING core), 2 optional
const BIDDING_MANDATORY = [{ id: 'KE_HOACH_LCNT' }, { id: 'HO_SO_YEU_CAU' }] as const;
const BIDDING_OPTIONAL  = [{ id: 'HO_SO_MOI_THAU' }, { id: 'BAO_CAO_DANH_GIA_HSDT' }] as const;

const lowResult  = regenerateFromPlan(synPlan({
  status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',
  mandatoryDocuments: BIDDING_MANDATORY,
  optionalDocuments:  BIDDING_OPTIONAL,
}));

// HIGH: 4 mandatory, 6 optional
const highResult = regenerateFromPlan(synPlan({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  mandatoryDocuments: [
    { id: 'KE_HOACH_LCNT' },
    { id: 'HO_SO_YEU_CAU' },
    { id: 'HO_SO_MOI_THAU' },
    { id: 'DU_TOAN_MUA_SAM' },
  ],
  optionalDocuments: [
    { id: 'TO_TRINH_MUA_SAM' },
    { id: 'QUYET_DINH_PHE_DUYET' },
    { id: 'BIEN_BAN_THAM_DINH' },
    { id: 'QUYET_DINH_PHAN_CONG' },
    { id: 'BAO_CAO_DANH_GIA_HSDT' },
    { id: 'CHUNG_THU_THAM_DINH_GIA' },
  ],
}));

// ── DG-01 READY ───────────────────────────────────────────────────────────────

describe('DG-01 READY', () => {
  it('DG-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('DG-01-02 forward produces 10 generatedDocuments', () => {
    expect(fwdResult.generatedDocuments).toHaveLength(10);
  });

  it('DG-01-03 mandatoryGenerated has 10 documents', () => {
    expect(fwdResult.mandatoryGenerated).toHaveLength(10);
  });
});

// ── DG-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('DG-02 PENDING_APPROVAL', () => {
  const r = regenerateFromPlan(synPlan({ status: 'PENDING_APPROVAL' }));

  it('DG-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('DG-02-02 generatedDocuments is empty', () => {
    expect(r.generatedDocuments).toHaveLength(0);
  });

  it('DG-02-03 mandatory and optional generated are empty', () => {
    expect(r.mandatoryGenerated).toHaveLength(0);
    expect(r.optionalGenerated).toHaveLength(0);
  });
});

// ── DG-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('DG-03 UNCHANGED', () => {
  it('DG-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('DG-03-02 generatedDocuments is empty', () => {
    expect(sameResult.generatedDocuments).toHaveLength(0);
  });

  it('DG-03-03 mandatoryGenerated is empty', () => {
    expect(sameResult.mandatoryGenerated).toHaveLength(0);
  });
});

// ── DG-04 LOW priority ─────────────────────────────────────────────────────────

describe('DG-04 LOW priority', () => {
  it('DG-04-01 LOW mandatory docs have priority 3', () => {
    expect(lowResult.mandatoryGenerated.every(d => d.priority === 3)).toBe(true);
  });

  it('DG-04-02 LOW optional docs have priority 4', () => {
    expect(lowResult.optionalGenerated.every(d => d.priority === 4)).toBe(true);
  });

  it('DG-04-03 LOW mandatory docs have required=true', () => {
    expect(lowResult.mandatoryGenerated.every(d => d.required === true)).toBe(true);
  });
});

// ── DG-05 HIGH priority ────────────────────────────────────────────────────────

describe('DG-05 HIGH priority', () => {
  it('DG-05-01 HIGH mandatory docs have priority 2', () => {
    expect(highResult.mandatoryGenerated.every(d => d.priority === 2)).toBe(true);
  });

  it('DG-05-02 HIGH optional docs have priority 4', () => {
    expect(highResult.optionalGenerated.every(d => d.priority === 4)).toBe(true);
  });

  it('DG-05-03 HIGH mandatory docs have required=true', () => {
    expect(highResult.mandatoryGenerated.every(d => d.required === true)).toBe(true);
  });
});

// ── DG-06 CRITICAL priority ────────────────────────────────────────────────────

describe('DG-06 CRITICAL priority', () => {
  it('DG-06-01 CRITICAL — all generated docs have priority 1', () => {
    expect(fwdResult.generatedDocuments.every(d => d.priority === 1)).toBe(true);
  });

  it('DG-06-02 CRITICAL — optionalGenerated is empty', () => {
    expect(fwdResult.optionalGenerated).toHaveLength(0);
  });

  it('DG-06-03 CRITICAL — mandatoryGenerated all have priority 1', () => {
    expect(fwdResult.mandatoryGenerated.every(d => d.priority === 1)).toBe(true);
  });
});

// ── DG-07 optional docs ────────────────────────────────────────────────────────

describe('DG-07 optional docs', () => {
  it('DG-07-01 optional docs have required=false', () => {
    expect(lowResult.optionalGenerated.every(d => d.required === false)).toBe(true);
  });

  it('DG-07-02 optional docs have priority 4', () => {
    expect(lowResult.optionalGenerated.every(d => d.priority === 4)).toBe(true);
  });

  it('DG-07-03 optionalGenerated ids match optionalDocuments source order', () => {
    const ids = lowResult.optionalGenerated.map(d => d.id);
    expect(ids).toEqual(['HO_SO_MOI_THAU', 'BAO_CAO_DANH_GIA_HSDT']);
  });
});

// ── DG-08 ordering ─────────────────────────────────────────────────────────────

describe('DG-08 ordering', () => {
  it('DG-08-01 all mandatory docs appear before any optional doc', () => {
    const mCount = lowResult.mandatoryGenerated.length;
    expect(lowResult.generatedDocuments.slice(0, mCount).every(d => d.required)).toBe(true);
    expect(lowResult.generatedDocuments.slice(mCount).every(d => !d.required)).toBe(true);
  });

  it('DG-08-02 source order preserved in mandatory bucket', () => {
    expect(lowResult.generatedDocuments[0].id).toBe('KE_HOACH_LCNT');
    expect(lowResult.generatedDocuments[1].id).toBe('HO_SO_YEU_CAU');
  });

  it('DG-08-03 source order preserved in optional bucket', () => {
    expect(lowResult.generatedDocuments[2].id).toBe('HO_SO_MOI_THAU');
    expect(lowResult.generatedDocuments[3].id).toBe('BAO_CAO_DANH_GIA_HSDT');
  });
});

// ── DG-09 metadata ─────────────────────────────────────────────────────────────

describe('DG-09 metadata', () => {
  it('DG-09-01 generatedCount equals generatedDocuments.length', () => {
    expect(fwdResult.metadata.generatedCount).toBe(fwdResult.generatedDocuments.length);
  });

  it('DG-09-02 mandatoryCount equals mandatoryGenerated.length', () => {
    expect(lowResult.metadata.mandatoryCount).toBe(lowResult.mandatoryGenerated.length);
  });

  it('DG-09-03 targetDate forwarded from plan.metadata.targetDate', () => {
    const r = regenerateFromPlan(synPlan({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── DG-10 empty path ───────────────────────────────────────────────────────────

describe('DG-10 empty path', () => {
  const r = regenerateFromPlan(synPlan({
    status: 'READY', impactScope: 'NONE', impactLevel: 'NONE',
    mandatoryDocuments: [], optionalDocuments: [],
  }));

  it('DG-10-01 NONE scope — generatedDocuments is empty', () => {
    expect(r.generatedDocuments).toHaveLength(0);
  });

  it('DG-10-02 NONE scope — generatedCount is 0', () => {
    expect(r.metadata.generatedCount).toBe(0);
  });

  it('DG-10-03 NONE scope — mandatory and optional generated are empty', () => {
    expect(r.mandatoryGenerated).toHaveLength(0);
    expect(r.optionalGenerated).toHaveLength(0);
  });
});

// ── DG-11 generatedCount ───────────────────────────────────────────────────────

describe('DG-11 generatedCount', () => {
  it('DG-11-01 mandatoryCount + optionalCount equals generatedCount', () => {
    expect(lowResult.metadata.mandatoryCount + lowResult.metadata.optionalCount)
      .toBe(lowResult.metadata.generatedCount);
  });

  it('DG-11-02 LOW + 2+2 — generatedCount=4, mandatoryCount=2, optionalCount=2', () => {
    expect(lowResult.metadata.generatedCount).toBe(4);
    expect(lowResult.metadata.mandatoryCount).toBe(2);
    expect(lowResult.metadata.optionalCount).toBe(2);
  });

  it('DG-11-03 CRITICAL + 10 — generatedCount=10, mandatoryCount=10, optionalCount=0', () => {
    expect(fwdResult.metadata.generatedCount).toBe(10);
    expect(fwdResult.metadata.mandatoryCount).toBe(10);
    expect(fwdResult.metadata.optionalCount).toBe(0);
  });
});

// ── DG-12 no dedup ─────────────────────────────────────────────────────────────

describe('DG-12 no dedup', () => {
  const dupMand = regenerateFromPlan(synPlan({
    status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',
    mandatoryDocuments: [{ id: 'KE_HOACH_LCNT' }, { id: 'KE_HOACH_LCNT' }],
    optionalDocuments:  [{ id: 'HO_SO_MOI_THAU' }],
  }));
  const dupOpt = regenerateFromPlan(synPlan({
    status: 'READY', impactScope: 'NARROW', impactLevel: 'LOW',
    mandatoryDocuments: [{ id: 'KE_HOACH_LCNT' }],
    optionalDocuments:  [{ id: 'HO_SO_MOI_THAU' }, { id: 'HO_SO_MOI_THAU' }],
  }));

  it('DG-12-01 duplicate mandatory IDs both appear in mandatoryGenerated', () => {
    expect(dupMand.mandatoryGenerated).toHaveLength(2);
    expect(dupMand.mandatoryGenerated.every(d => d.id === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('DG-12-02 generatedDocuments.length = mandatoryGenerated.length + optionalGenerated.length', () => {
    expect(dupMand.generatedDocuments.length)
      .toBe(dupMand.mandatoryGenerated.length + dupMand.optionalGenerated.length);
  });

  it('DG-12-03 duplicate optional IDs both appear in optionalGenerated', () => {
    expect(dupOpt.optionalGenerated).toHaveLength(2);
    expect(dupOpt.optionalGenerated.every(d => d.id === 'HO_SO_MOI_THAU')).toBe(true);
  });
});

// ── DG-13 single plan call ─────────────────────────────────────────────────────

describe('DG-13 single plan call', () => {
  it('DG-13-01 regenerate() calls planner.plan() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synPlan({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const regenerator = new DocumentRegenerator({ plan: spy } as unknown as RegenerationPlanner);
    regenerator.regenerate(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('DG-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synPlan({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const regenerator = new DocumentRegenerator({ plan: spy } as unknown as RegenerationPlanner);
    regenerator.regenerate(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('DG-13-03 two regenerate() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synPlan({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const regenerator = new DocumentRegenerator({ plan: spy } as unknown as RegenerationPlanner);
    regenerator.regenerate(SAME.last, SAME.cur);
    regenerator.regenerate(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
