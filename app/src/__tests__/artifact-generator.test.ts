import { describe, it, expect, vi } from 'vitest';
import {
  ArtifactGenerator,
  generateFromRender,
  type ArtifactGenerationResult,
} from '../agents/ArtifactGenerator';
import { RenderEngine } from '../agents/RenderEngine';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type RenderTaskInput = { documentId: string; priority: number; required?: boolean };

function synRender(opts: {
  status?:      SnapshotStatus;
  renderQueue?: readonly RenderTaskInput[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
} = {}) {
  const status = opts.status ?? 'READY';
  const raw    = status === 'READY' ? (opts.renderQueue ?? []) : [];
  const tasks  = raw.map(t => ({ documentId: t.documentId, priority: t.priority, required: t.required ?? true }));
  return {
    status,
    impactScope:    opts.impactScope ?? 'NONE',
    impactLevel:    opts.impactLevel ?? 'NONE',
    renderQueue:    tasks,
    highPriority:   tasks.filter(t => t.priority <= 2),
    normalPriority: tasks.filter(t => t.priority > 2),
    metadata: {
      renderCount: tasks.length,
      highCount:   tasks.filter(t => t.priority <= 2).length,
      normalCount: tasks.filter(t => t.priority > 2).length,
      targetDate:  opts.targetDate ?? '2026-01-01',
    },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  ArtifactGenerationResult = new ArtifactGenerator().generate(FWD.last, FWD.cur);
const sameResult: ArtifactGenerationResult = new ArtifactGenerator().generate(SAME.last, SAME.cur);

// Synthetic mixed: HIGH mandatory (required=true, priority=2) + optional (required=false, priority=4)
const mixedResult = generateFromRender(synRender({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  renderQueue: [
    { documentId: 'KE_HOACH_LCNT',           priority: 2, required: true  },
    { documentId: 'HO_SO_YEU_CAU',           priority: 2, required: true  },
    { documentId: 'HO_SO_MOI_THAU',          priority: 2, required: true  },
    { documentId: 'DU_TOAN_MUA_SAM',         priority: 2, required: true  },
    { documentId: 'TO_TRINH_MUA_SAM',        priority: 4, required: false },
    { documentId: 'QUYET_DINH_PHE_DUYET',    priority: 4, required: false },
    { documentId: 'BIEN_BAN_THAM_DINH',      priority: 4, required: false },
    { documentId: 'QUYET_DINH_PHAN_CONG',    priority: 4, required: false },
    { documentId: 'BAO_CAO_DANH_GIA_HSDT',   priority: 4, required: false },
    { documentId: 'CHUNG_THU_THAM_DINH_GIA', priority: 4, required: false },
  ],
}));

// ── AG-01 READY ───────────────────────────────────────────────────────────────

describe('AG-01 READY', () => {
  it('AG-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('AG-01-02 forward produces 10 artifacts', () => {
    expect(fwdResult.artifacts).toHaveLength(10);
  });

  it('AG-01-03 forward requiredArtifacts has 10 items', () => {
    expect(fwdResult.requiredArtifacts).toHaveLength(10);
  });
});

// ── AG-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('AG-02 PENDING_APPROVAL', () => {
  const r = generateFromRender(synRender({ status: 'PENDING_APPROVAL' }));

  it('AG-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('AG-02-02 artifacts is empty', () => {
    expect(r.artifacts).toHaveLength(0);
  });

  it('AG-02-03 required and optional are empty', () => {
    expect(r.requiredArtifacts).toHaveLength(0);
    expect(r.optionalArtifacts).toHaveLength(0);
  });
});

// ── AG-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('AG-03 UNCHANGED', () => {
  it('AG-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('AG-03-02 artifacts is empty', () => {
    expect(sameResult.artifacts).toHaveLength(0);
  });

  it('AG-03-03 requiredArtifacts is empty', () => {
    expect(sameResult.requiredArtifacts).toHaveLength(0);
  });
});

// ── AG-04 format DOCX ─────────────────────────────────────────────────────────

describe('AG-04 format DOCX', () => {
  it('AG-04-01 all forward artifacts have format DOCX', () => {
    expect(fwdResult.artifacts.every(a => a.format === 'DOCX')).toBe(true);
  });

  it('AG-04-02 all mixed artifacts have format DOCX', () => {
    expect(mixedResult.artifacts.every(a => a.format === 'DOCX')).toBe(true);
  });

  it('AG-04-03 synthetic single artifact has format DOCX', () => {
    const r = generateFromRender(synRender({
      renderQueue: [{ documentId: 'KE_HOACH_LCNT', priority: 1 }],
    }));
    expect(r.artifacts[0].format).toBe('DOCX');
  });
});

// ── AG-05 required bucket ──────────────────────────────────────────────────────

describe('AG-05 required bucket', () => {
  it('AG-05-01 required=true tasks go to requiredArtifacts', () => {
    const r = generateFromRender(synRender({
      renderQueue: [
        { documentId: 'KE_HOACH_LCNT', priority: 1, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.requiredArtifacts).toHaveLength(1);
    expect(r.requiredArtifacts[0].documentId).toBe('KE_HOACH_LCNT');
  });

  it('AG-05-02 all requiredArtifacts have required=true', () => {
    expect(mixedResult.requiredArtifacts.every(a => a.required === true)).toBe(true);
  });

  it('AG-05-03 mixed HIGH — requiredArtifacts has 4 items', () => {
    expect(mixedResult.requiredArtifacts).toHaveLength(4);
  });
});

// ── AG-06 optional bucket ──────────────────────────────────────────────────────

describe('AG-06 optional bucket', () => {
  it('AG-06-01 required=false tasks go to optionalArtifacts', () => {
    const r = generateFromRender(synRender({
      renderQueue: [
        { documentId: 'KE_HOACH_LCNT', priority: 2, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.optionalArtifacts).toHaveLength(1);
    expect(r.optionalArtifacts[0].documentId).toBe('HO_SO_MOI_THAU');
  });

  it('AG-06-02 all optionalArtifacts have required=false', () => {
    expect(mixedResult.optionalArtifacts.every(a => a.required === false)).toBe(true);
  });

  it('AG-06-03 mixed HIGH — optionalArtifacts has 6 items', () => {
    expect(mixedResult.optionalArtifacts).toHaveLength(6);
  });
});

// ── AG-07 ordering ─────────────────────────────────────────────────────────────

describe('AG-07 ordering', () => {
  it('AG-07-01 artifacts = [...requiredArtifacts, ...optionalArtifacts]', () => {
    const rLen = mixedResult.requiredArtifacts.length;
    expect(mixedResult.artifacts.slice(0, rLen)).toEqual([...mixedResult.requiredArtifacts]);
    expect(mixedResult.artifacts.slice(rLen)).toEqual([...mixedResult.optionalArtifacts]);
  });

  it('AG-07-02 source order preserved within requiredArtifacts', () => {
    expect(mixedResult.requiredArtifacts[0].documentId).toBe('KE_HOACH_LCNT');
    expect(mixedResult.requiredArtifacts[3].documentId).toBe('DU_TOAN_MUA_SAM');
  });

  it('AG-07-03 source order preserved within optionalArtifacts', () => {
    expect(mixedResult.optionalArtifacts[0].documentId).toBe('TO_TRINH_MUA_SAM');
    expect(mixedResult.optionalArtifacts[5].documentId).toBe('CHUNG_THU_THAM_DINH_GIA');
  });
});

// ── AG-08 metadata ─────────────────────────────────────────────────────────────

describe('AG-08 metadata', () => {
  it('AG-08-01 artifactCount equals artifacts.length', () => {
    expect(fwdResult.metadata.artifactCount).toBe(fwdResult.artifacts.length);
  });

  it('AG-08-02 requiredCount equals requiredArtifacts.length', () => {
    expect(mixedResult.metadata.requiredCount).toBe(mixedResult.requiredArtifacts.length);
  });

  it('AG-08-03 targetDate forwarded from render.metadata.targetDate', () => {
    const r = generateFromRender(synRender({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── AG-09 artifactCount ────────────────────────────────────────────────────────

describe('AG-09 artifactCount', () => {
  it('AG-09-01 requiredCount + optionalCount equals artifactCount', () => {
    expect(mixedResult.metadata.requiredCount + mixedResult.metadata.optionalCount)
      .toBe(mixedResult.metadata.artifactCount);
  });

  it('AG-09-02 mixed HIGH — artifactCount=10, requiredCount=4, optionalCount=6', () => {
    expect(mixedResult.metadata.artifactCount).toBe(10);
    expect(mixedResult.metadata.requiredCount).toBe(4);
    expect(mixedResult.metadata.optionalCount).toBe(6);
  });

  it('AG-09-03 CRITICAL + 10 — artifactCount=10, requiredCount=10, optionalCount=0', () => {
    expect(fwdResult.metadata.artifactCount).toBe(10);
    expect(fwdResult.metadata.requiredCount).toBe(10);
    expect(fwdResult.metadata.optionalCount).toBe(0);
  });
});

// ── AG-10 empty path ───────────────────────────────────────────────────────────

describe('AG-10 empty path', () => {
  const r = generateFromRender(synRender({
    status: 'READY', impactScope: 'NONE', impactLevel: 'NONE', renderQueue: [],
  }));

  it('AG-10-01 NONE scope — artifacts is empty', () => {
    expect(r.artifacts).toHaveLength(0);
  });

  it('AG-10-02 NONE scope — artifactCount is 0', () => {
    expect(r.metadata.artifactCount).toBe(0);
  });

  it('AG-10-03 NONE scope — required and optional are empty', () => {
    expect(r.requiredArtifacts).toHaveLength(0);
    expect(r.optionalArtifacts).toHaveLength(0);
  });
});

// ── AG-11 no dedup ─────────────────────────────────────────────────────────────

describe('AG-11 no dedup', () => {
  const dupResult = generateFromRender(synRender({
    renderQueue: [
      { documentId: 'KE_HOACH_LCNT', priority: 1, required: true },
      { documentId: 'KE_HOACH_LCNT', priority: 1, required: true }, // duplicate
      { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
    ],
  }));

  it('AG-11-01 duplicate documentIds both appear in artifacts', () => {
    expect(dupResult.artifacts).toHaveLength(3);
  });

  it('AG-11-02 both duplicates appear in requiredArtifacts', () => {
    expect(dupResult.requiredArtifacts).toHaveLength(2);
    expect(dupResult.requiredArtifacts.every(a => a.documentId === 'KE_HOACH_LCNT')).toBe(true);
  });

  it('AG-11-03 artifactCount equals input renderQueue length', () => {
    expect(dupResult.metadata.artifactCount).toBe(3);
  });
});

// ── AG-12 preserve priority ────────────────────────────────────────────────────

describe('AG-12 preserve priority', () => {
  it('AG-12-01 artifact.priority copied from renderTask.priority', () => {
    const r = generateFromRender(synRender({
      renderQueue: [
        { documentId: 'KE_HOACH_LCNT', priority: 2, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 3, required: true },
      ],
    }));
    expect(r.artifacts[0].priority).toBe(2);
    expect(r.artifacts[1].priority).toBe(3);
  });

  it('AG-12-02 requiredArtifacts preserve priority from renderTask', () => {
    expect(mixedResult.requiredArtifacts.every(a => a.priority === 2)).toBe(true);
  });

  it('AG-12-03 optionalArtifacts preserve priority from renderTask', () => {
    expect(mixedResult.optionalArtifacts.every(a => a.priority === 4)).toBe(true);
  });
});

// ── AG-13 single render call ───────────────────────────────────────────────────

describe('AG-13 single render call', () => {
  it('AG-13-01 generate() calls renderEngine.render() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRender({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const generator = new ArtifactGenerator({ render: spy } as unknown as RenderEngine);
    generator.generate(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('AG-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRender({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const generator = new ArtifactGenerator({ render: spy } as unknown as RenderEngine);
    generator.generate(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('AG-13-03 two generate() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synRender({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const generator = new ArtifactGenerator({ render: spy } as unknown as RenderEngine);
    generator.generate(SAME.last, SAME.cur);
    generator.generate(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
