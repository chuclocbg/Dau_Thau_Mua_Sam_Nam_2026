import { describe, it, expect, vi } from 'vitest';
import {
  TemplateRenderer,
  renderFromArtifacts,
  type RenderedArtifactResult,
} from '../agents/TemplateRenderer';
import { ArtifactGenerator } from '../agents/ArtifactGenerator';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type ArtifactInput = { documentId: string; priority: number; required?: boolean; format?: string };

function synArtifacts(opts: {
  status?:      SnapshotStatus;
  artifacts?:   readonly ArtifactInput[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
} = {}) {
  const status = opts.status ?? 'READY';
  const raw    = status === 'READY' ? (opts.artifacts ?? []) : [];
  const arts   = raw.map(a => ({
    documentId: a.documentId,
    priority:   a.priority,
    required:   a.required ?? true,
    format:     a.format   ?? 'DOCX',
  }));
  return {
    status,
    impactScope:       opts.impactScope ?? 'NONE',
    impactLevel:       opts.impactLevel ?? 'NONE',
    artifacts:         arts,
    requiredArtifacts: arts.filter(a => a.required),
    optionalArtifacts: arts.filter(a => !a.required),
    metadata: {
      artifactCount: arts.length,
      requiredCount: arts.filter(a => a.required).length,
      optionalCount: arts.filter(a => !a.required).length,
      targetDate:    opts.targetDate ?? '2026-01-01',
    },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  RenderedArtifactResult = new TemplateRenderer().render(FWD.last, FWD.cur);
const sameResult: RenderedArtifactResult = new TemplateRenderer().render(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4)
const mixedResult = renderFromArtifacts(synArtifacts({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  artifacts: [
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

// ── TR-01 READY ───────────────────────────────────────────────────────────────

describe('TR-01 READY', () => {
  it('TR-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('TR-01-02 forward produces 10 renderedArtifacts', () => {
    expect(fwdResult.renderedArtifacts).toHaveLength(10);
  });

  it('TR-01-03 forward requiredRendered has 10 items', () => {
    expect(fwdResult.requiredRendered).toHaveLength(10);
  });
});

// ── TR-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('TR-02 PENDING_APPROVAL', () => {
  const r = renderFromArtifacts(synArtifacts({ status: 'PENDING_APPROVAL' }));

  it('TR-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('TR-02-02 renderedArtifacts is empty', () => {
    expect(r.renderedArtifacts).toHaveLength(0);
  });

  it('TR-02-03 required and optional rendered are empty', () => {
    expect(r.requiredRendered).toHaveLength(0);
    expect(r.optionalRendered).toHaveLength(0);
  });
});

// ── TR-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('TR-03 UNCHANGED', () => {
  it('TR-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('TR-03-02 renderedArtifacts is empty', () => {
    expect(sameResult.renderedArtifacts).toHaveLength(0);
  });

  it('TR-03-03 requiredRendered is empty', () => {
    expect(sameResult.requiredRendered).toHaveLength(0);
  });
});

// ── TR-04 templateId = documentId ─────────────────────────────────────────────

describe('TR-04 templateId=documentId', () => {
  it('TR-04-01 forward first artifact has templateId equal to documentId', () => {
    const first = fwdResult.renderedArtifacts[0];
    expect(first.templateId).toBe(first.documentId);
  });

  it('TR-04-02 all forward artifacts have templateId equal to documentId', () => {
    expect(fwdResult.renderedArtifacts.every(a => a.templateId === a.documentId)).toBe(true);
  });

  it('TR-04-03 KE_HOACH_LCNT artifact has templateId KE_HOACH_LCNT', () => {
    const a = mixedResult.renderedArtifacts.find(r => r.documentId === 'KE_HOACH_LCNT');
    expect(a?.templateId).toBe('KE_HOACH_LCNT');
  });
});

// ── TR-05 content generation ──────────────────────────────────────────────────

describe('TR-05 content generation', () => {
  it('TR-05-01 content = TEMPLATE: + templateId', () => {
    expect(fwdResult.renderedArtifacts.every(a => a.content === `TEMPLATE:${a.templateId}`)).toBe(true);
  });

  it('TR-05-02 forward first artifact content is TEMPLATE:TO_TRINH_MUA_SAM', () => {
    expect(fwdResult.renderedArtifacts[0].content).toBe('TEMPLATE:TO_TRINH_MUA_SAM');
  });

  it('TR-05-03 KE_HOACH_LCNT artifact has content TEMPLATE:KE_HOACH_LCNT', () => {
    const a = mixedResult.renderedArtifacts.find(r => r.documentId === 'KE_HOACH_LCNT');
    expect(a?.content).toBe('TEMPLATE:KE_HOACH_LCNT');
  });
});

// ── TR-06 required bucket ──────────────────────────────────────────────────────

describe('TR-06 required bucket', () => {
  it('TR-06-01 required=true artifacts go to requiredRendered', () => {
    const r = renderFromArtifacts(synArtifacts({
      artifacts: [
        { documentId: 'KE_HOACH_LCNT', priority: 1, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.requiredRendered).toHaveLength(1);
    expect(r.requiredRendered[0].documentId).toBe('KE_HOACH_LCNT');
  });

  it('TR-06-02 all requiredRendered have required=true', () => {
    expect(mixedResult.requiredRendered.every(a => a.required === true)).toBe(true);
  });

  it('TR-06-03 mixed HIGH — requiredRendered has 4 items', () => {
    expect(mixedResult.requiredRendered).toHaveLength(4);
  });
});

// ── TR-07 optional bucket ──────────────────────────────────────────────────────

describe('TR-07 optional bucket', () => {
  it('TR-07-01 required=false artifacts go to optionalRendered', () => {
    const r = renderFromArtifacts(synArtifacts({
      artifacts: [
        { documentId: 'KE_HOACH_LCNT', priority: 2, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.optionalRendered).toHaveLength(1);
    expect(r.optionalRendered[0].documentId).toBe('HO_SO_MOI_THAU');
  });

  it('TR-07-02 all optionalRendered have required=false', () => {
    expect(mixedResult.optionalRendered.every(a => a.required === false)).toBe(true);
  });

  it('TR-07-03 mixed HIGH — optionalRendered has 6 items', () => {
    expect(mixedResult.optionalRendered).toHaveLength(6);
  });
});

// ── TR-08 ordering ─────────────────────────────────────────────────────────────

describe('TR-08 ordering', () => {
  it('TR-08-01 renderedArtifacts = [...requiredRendered, ...optionalRendered]', () => {
    const rLen = mixedResult.requiredRendered.length;
    expect(mixedResult.renderedArtifacts.slice(0, rLen)).toEqual([...mixedResult.requiredRendered]);
    expect(mixedResult.renderedArtifacts.slice(rLen)).toEqual([...mixedResult.optionalRendered]);
  });

  it('TR-08-02 source order preserved within requiredRendered', () => {
    expect(mixedResult.requiredRendered[0].documentId).toBe('KE_HOACH_LCNT');
    expect(mixedResult.requiredRendered[3].documentId).toBe('DU_TOAN_MUA_SAM');
  });

  it('TR-08-03 source order preserved within optionalRendered', () => {
    expect(mixedResult.optionalRendered[0].documentId).toBe('TO_TRINH_MUA_SAM');
    expect(mixedResult.optionalRendered[5].documentId).toBe('CHUNG_THU_THAM_DINH_GIA');
  });
});

// ── TR-09 metadata ─────────────────────────────────────────────────────────────

describe('TR-09 metadata', () => {
  it('TR-09-01 renderedCount equals renderedArtifacts.length', () => {
    expect(fwdResult.metadata.renderedCount).toBe(fwdResult.renderedArtifacts.length);
  });

  it('TR-09-02 requiredCount equals requiredRendered.length', () => {
    expect(mixedResult.metadata.requiredCount).toBe(mixedResult.requiredRendered.length);
  });

  it('TR-09-03 targetDate forwarded from artifact.metadata.targetDate', () => {
    const r = renderFromArtifacts(synArtifacts({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── TR-10 renderedCount ────────────────────────────────────────────────────────

describe('TR-10 renderedCount', () => {
  it('TR-10-01 requiredCount + optionalCount equals renderedCount', () => {
    expect(mixedResult.metadata.requiredCount + mixedResult.metadata.optionalCount)
      .toBe(mixedResult.metadata.renderedCount);
  });

  it('TR-10-02 mixed HIGH — renderedCount=10, requiredCount=4, optionalCount=6', () => {
    expect(mixedResult.metadata.renderedCount).toBe(10);
    expect(mixedResult.metadata.requiredCount).toBe(4);
    expect(mixedResult.metadata.optionalCount).toBe(6);
  });

  it('TR-10-03 CRITICAL + 10 — renderedCount=10, requiredCount=10, optionalCount=0', () => {
    expect(fwdResult.metadata.renderedCount).toBe(10);
    expect(fwdResult.metadata.requiredCount).toBe(10);
    expect(fwdResult.metadata.optionalCount).toBe(0);
  });
});

// ── TR-11 empty path ───────────────────────────────────────────────────────────

describe('TR-11 empty path', () => {
  const r = renderFromArtifacts(synArtifacts({
    status: 'READY', impactScope: 'NONE', impactLevel: 'NONE', artifacts: [],
  }));

  it('TR-11-01 NONE scope — renderedArtifacts is empty', () => {
    expect(r.renderedArtifacts).toHaveLength(0);
  });

  it('TR-11-02 NONE scope — renderedCount is 0', () => {
    expect(r.metadata.renderedCount).toBe(0);
  });

  it('TR-11-03 NONE scope — required and optional rendered are empty', () => {
    expect(r.requiredRendered).toHaveLength(0);
    expect(r.optionalRendered).toHaveLength(0);
  });
});

// ── TR-12 preserve priority ────────────────────────────────────────────────────

describe('TR-12 preserve priority', () => {
  it('TR-12-01 priority copied from Artifact', () => {
    const r = renderFromArtifacts(synArtifacts({
      artifacts: [
        { documentId: 'KE_HOACH_LCNT', priority: 2 },
        { documentId: 'HO_SO_MOI_THAU', priority: 3 },
      ],
    }));
    expect(r.renderedArtifacts[0].priority).toBe(2);
    expect(r.renderedArtifacts[1].priority).toBe(3);
  });

  it('TR-12-02 requiredRendered preserve priority from Artifact', () => {
    expect(mixedResult.requiredRendered.every(a => a.priority === 2)).toBe(true);
  });

  it('TR-12-03 optionalRendered preserve priority from Artifact', () => {
    expect(mixedResult.optionalRendered.every(a => a.priority === 4)).toBe(true);
  });
});

// ── TR-13 single generate call ─────────────────────────────────────────────────

describe('TR-13 single generate call', () => {
  it('TR-13-01 render() calls artifactGenerator.generate() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synArtifacts({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const renderer = new TemplateRenderer({ generate: spy } as unknown as ArtifactGenerator);
    renderer.render(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('TR-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synArtifacts({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const renderer = new TemplateRenderer({ generate: spy } as unknown as ArtifactGenerator);
    renderer.render(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('TR-13-03 two render() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synArtifacts({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const renderer = new TemplateRenderer({ generate: spy } as unknown as ArtifactGenerator);
    renderer.render(SAME.last, SAME.cur);
    renderer.render(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
