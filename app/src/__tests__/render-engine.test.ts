import { describe, it, expect, vi } from 'vitest';
import {
  RenderEngine,
  renderFromRegeneration,
  type RenderResult,
} from '../agents/RenderEngine';
import { DocumentRegenerator } from '../agents/DocumentRegenerator';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type GenDocInput = { id: string; priority: number; required?: boolean };

function synRegen(opts: {
  status?:             SnapshotStatus;
  generatedDocuments?: readonly GenDocInput[];
  impactScope?:        ImpactScope;
  impactLevel?:        ImpactLevel;
  targetDate?:         string;
} = {}) {
  const status  = opts.status ?? 'READY';
  const rawDocs = status === 'READY' ? (opts.generatedDocuments ?? []) : [];
  const docs    = rawDocs.map(d => ({ id: d.id, priority: d.priority, required: d.required ?? true }));
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE',
    impactLevel: opts.impactLevel ?? 'NONE',
    generatedDocuments: docs,
    metadata: {
      generatedCount: docs.length,
      mandatoryCount: docs.filter(d => d.required).length,
      optionalCount:  docs.filter(d => !d.required).length,
      targetDate:     opts.targetDate ?? '2026-01-01',
    },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  RenderResult = new RenderEngine().render(FWD.last, FWD.cur);
const sameResult: RenderResult = new RenderEngine().render(SAME.last, SAME.cur);

// Synthetic mixed: HIGH mandatory (priority=2) + optional (priority=4)
const mixedResult = renderFromRegeneration(synRegen({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  generatedDocuments: [
    { id: 'KE_HOACH_LCNT',        priority: 2, required: true  },
    { id: 'HO_SO_YEU_CAU',        priority: 2, required: true  },
    { id: 'HO_SO_MOI_THAU',       priority: 4, required: false },
    { id: 'QUYET_DINH_PHE_DUYET', priority: 4, required: false },
  ],
}));

// ── RE-01 READY ───────────────────────────────────────────────────────────────

describe('RE-01 READY', () => {
  it('RE-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('RE-01-02 forward produces 10 renderQueue items', () => {
    expect(fwdResult.renderQueue).toHaveLength(10);
  });

  it('RE-01-03 forward has 10 highPriority items (all CRITICAL → priority 1)', () => {
    expect(fwdResult.highPriority).toHaveLength(10);
  });
});

// ── RE-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('RE-02 PENDING_APPROVAL', () => {
  const r = renderFromRegeneration(synRegen({ status: 'PENDING_APPROVAL' }));

  it('RE-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('RE-02-02 renderQueue is empty', () => {
    expect(r.renderQueue).toHaveLength(0);
  });

  it('RE-02-03 highPriority and normalPriority are empty', () => {
    expect(r.highPriority).toHaveLength(0);
    expect(r.normalPriority).toHaveLength(0);
  });
});

// ── RE-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('RE-03 UNCHANGED', () => {
  it('RE-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('RE-03-02 renderQueue is empty', () => {
    expect(sameResult.renderQueue).toHaveLength(0);
  });

  it('RE-03-03 highPriority is empty', () => {
    expect(sameResult.highPriority).toHaveLength(0);
  });
});

// ── RE-04 HIGH bucket ──────────────────────────────────────────────────────────

describe('RE-04 HIGH bucket', () => {
  it('RE-04-01 priority 1 task goes to highPriority', () => {
    const r = renderFromRegeneration(synRegen({
      generatedDocuments: [{ id: 'TO_TRINH_MUA_SAM', priority: 1 }],
    }));
    expect(r.highPriority).toHaveLength(1);
    expect(r.normalPriority).toHaveLength(0);
  });

  it('RE-04-02 priority 2 task goes to highPriority', () => {
    const r = renderFromRegeneration(synRegen({
      generatedDocuments: [{ id: 'KE_HOACH_LCNT', priority: 2 }],
    }));
    expect(r.highPriority).toHaveLength(1);
    expect(r.normalPriority).toHaveLength(0);
  });

  it('RE-04-03 all highPriority tasks have priority ≤ 2', () => {
    expect(mixedResult.highPriority.every(t => t.priority <= 2)).toBe(true);
  });
});

// ── RE-05 NORMAL bucket ────────────────────────────────────────────────────────

describe('RE-05 NORMAL bucket', () => {
  it('RE-05-01 priority 3 task goes to normalPriority', () => {
    const r = renderFromRegeneration(synRegen({
      generatedDocuments: [{ id: 'KE_HOACH_LCNT', priority: 3 }],
    }));
    expect(r.normalPriority).toHaveLength(1);
    expect(r.highPriority).toHaveLength(0);
  });

  it('RE-05-02 priority 4 task goes to normalPriority', () => {
    const r = renderFromRegeneration(synRegen({
      generatedDocuments: [{ id: 'HO_SO_MOI_THAU', priority: 4, required: false }],
    }));
    expect(r.normalPriority).toHaveLength(1);
    expect(r.highPriority).toHaveLength(0);
  });

  it('RE-05-03 all normalPriority tasks have priority > 2', () => {
    expect(mixedResult.normalPriority.every(t => t.priority > 2)).toBe(true);
  });
});

// ── RE-06 priority 1 ──────────────────────────────────────────────────────────

describe('RE-06 priority 1', () => {
  it('RE-06-01 CRITICAL — all docs land in highPriority (priority=1)', () => {
    expect(fwdResult.highPriority.length).toBe(fwdResult.renderQueue.length);
  });

  it('RE-06-02 CRITICAL — normalPriority is empty', () => {
    expect(fwdResult.normalPriority).toHaveLength(0);
  });

  it('RE-06-03 forward highCount is 10', () => {
    expect(fwdResult.metadata.highCount).toBe(10);
  });
});

// ── RE-07 priority 4 ──────────────────────────────────────────────────────────

describe('RE-07 priority 4', () => {
  const r = renderFromRegeneration(synRegen({
    generatedDocuments: [
      { id: 'BIEN_BAN_THAM_DINH',   priority: 4, required: false },
      { id: 'QUYET_DINH_PHE_DUYET', priority: 4, required: false },
    ],
  }));

  it('RE-07-01 priority 4 tasks go to normalPriority', () => {
    expect(r.normalPriority).toHaveLength(2);
    expect(r.highPriority).toHaveLength(0);
  });

  it('RE-07-02 priority 4 tasks have required=false', () => {
    expect(r.normalPriority.every(t => t.required === false)).toBe(true);
  });

  it('RE-07-03 normalPriority preserves source order of priority-4 tasks', () => {
    expect(r.normalPriority[0].documentId).toBe('BIEN_BAN_THAM_DINH');
    expect(r.normalPriority[1].documentId).toBe('QUYET_DINH_PHE_DUYET');
  });
});

// ── RE-08 ordering ─────────────────────────────────────────────────────────────

describe('RE-08 ordering', () => {
  it('RE-08-01 renderQueue = [...highPriority, ...normalPriority]', () => {
    const hLen = mixedResult.highPriority.length;
    expect(mixedResult.renderQueue.slice(0, hLen)).toEqual([...mixedResult.highPriority]);
    expect(mixedResult.renderQueue.slice(hLen)).toEqual([...mixedResult.normalPriority]);
  });

  it('RE-08-02 source order preserved within highPriority', () => {
    expect(mixedResult.highPriority[0].documentId).toBe('KE_HOACH_LCNT');
    expect(mixedResult.highPriority[1].documentId).toBe('HO_SO_YEU_CAU');
  });

  it('RE-08-03 source order preserved within normalPriority', () => {
    expect(mixedResult.normalPriority[0].documentId).toBe('HO_SO_MOI_THAU');
    expect(mixedResult.normalPriority[1].documentId).toBe('QUYET_DINH_PHE_DUYET');
  });
});

// ── RE-09 metadata ─────────────────────────────────────────────────────────────

describe('RE-09 metadata', () => {
  it('RE-09-01 renderCount equals renderQueue.length', () => {
    expect(fwdResult.metadata.renderCount).toBe(fwdResult.renderQueue.length);
  });

  it('RE-09-02 highCount equals highPriority.length', () => {
    expect(mixedResult.metadata.highCount).toBe(mixedResult.highPriority.length);
  });

  it('RE-09-03 targetDate forwarded from regen.metadata.targetDate', () => {
    const r = renderFromRegeneration(synRegen({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── RE-10 renderCount ──────────────────────────────────────────────────────────

describe('RE-10 renderCount', () => {
  it('RE-10-01 highCount + normalCount equals renderCount', () => {
    expect(mixedResult.metadata.highCount + mixedResult.metadata.normalCount)
      .toBe(mixedResult.metadata.renderCount);
  });

  it('RE-10-02 mixed HIGH+optional — highCount=2, normalCount=2, renderCount=4', () => {
    expect(mixedResult.metadata.highCount).toBe(2);
    expect(mixedResult.metadata.normalCount).toBe(2);
    expect(mixedResult.metadata.renderCount).toBe(4);
  });

  it('RE-10-03 CRITICAL + 10 — renderCount=10, highCount=10, normalCount=0', () => {
    expect(fwdResult.metadata.renderCount).toBe(10);
    expect(fwdResult.metadata.highCount).toBe(10);
    expect(fwdResult.metadata.normalCount).toBe(0);
  });
});

// ── RE-11 empty path ───────────────────────────────────────────────────────────

describe('RE-11 empty path', () => {
  const r = renderFromRegeneration(synRegen({
    status: 'READY', impactScope: 'NONE', impactLevel: 'NONE',
    generatedDocuments: [],
  }));

  it('RE-11-01 NONE scope — renderQueue is empty', () => {
    expect(r.renderQueue).toHaveLength(0);
  });

  it('RE-11-02 NONE scope — renderCount is 0', () => {
    expect(r.metadata.renderCount).toBe(0);
  });

  it('RE-11-03 NONE scope — highPriority and normalPriority are empty', () => {
    expect(r.highPriority).toHaveLength(0);
    expect(r.normalPriority).toHaveLength(0);
  });
});

// ── RE-12 no dedup ─────────────────────────────────────────────────────────────

describe('RE-12 no dedup', () => {
  const dupResult = renderFromRegeneration(synRegen({
    generatedDocuments: [
      { id: 'KE_HOACH_LCNT', priority: 1 },
      { id: 'KE_HOACH_LCNT', priority: 1 }, // duplicate
      { id: 'HO_SO_MOI_THAU', priority: 4, required: false },
    ],
  }));

  it('RE-12-01 duplicate doc IDs both appear in renderQueue', () => {
    expect(dupResult.renderQueue).toHaveLength(3);
  });

  it('RE-12-02 duplicate high-priority docs both appear in highPriority', () => {
    expect(dupResult.highPriority).toHaveLength(2);
    expect(dupResult.highPriority.every(t => t.documentId === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('RE-12-03 renderCount equals input generatedDocuments count', () => {
    expect(dupResult.metadata.renderCount).toBe(3);
  });
});

// ── RE-13 single regenerate call ───────────────────────────────────────────────

describe('RE-13 single regenerate call', () => {
  it('RE-13-01 render() calls regenerator.regenerate() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRegen({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const engine = new RenderEngine({ regenerate: spy } as unknown as DocumentRegenerator);
    engine.render(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('RE-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRegen({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const engine = new RenderEngine({ regenerate: spy } as unknown as DocumentRegenerator);
    engine.render(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('RE-13-03 two render() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synRegen({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const engine = new RenderEngine({ regenerate: spy } as unknown as DocumentRegenerator);
    engine.render(SAME.last, SAME.cur);
    engine.render(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
