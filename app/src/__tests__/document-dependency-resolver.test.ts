import { describe, it, expect, vi } from 'vitest';
import {
  DocumentDependencyResolver,
  resolveFromTemplate,
  type DocumentDependencyResult,
} from '../agents/DocumentDependencyResolver';
import { TemplateDependencyResolver } from '../agents/TemplateDependencyResolver';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

// Two real pipeline calls — shared across all groups that need real data.
const fwdResult:  DocumentDependencyResult =
  new DocumentDependencyResolver().resolve(FWD.last, FWD.cur);
const sameResult: DocumentDependencyResult =
  new DocumentDependencyResolver().resolve(SAME.last, SAME.cur);

type TI = { id: string; domain: string };

function synTmpl(opts: {
  status?:        SnapshotStatus;
  templates?:     readonly TI[];
  templateEdges?: readonly { from: string; to: string; type: string }[];
  impactScope?:   ImpactScope;
  impactLevel?:   ImpactLevel;
  targetDate?:    string;
} = {}) {
  const status        = opts.status ?? 'READY';
  const templates     = status === 'READY' ? (opts.templates     ?? []) : [];
  const templateEdges = status === 'READY' ? (opts.templateEdges ?? []) : [];
  return {
    status,
    impactScope:   opts.impactScope ?? 'NONE',
    impactLevel:   opts.impactLevel ?? 'NONE',
    templates:     templates.map(t => ({ ...t, type: 'TEMPLATE' as const })),
    templateEdges,
    metadata: {
      templateCount: templates.length,
      edgeCount:     templateEdges.length,
      targetDate:    opts.targetDate ?? '2026-01-01',
    },
  };
}

// ── DD-01 READY ────────────────────────────────────────────────────────────────

describe('DD-01 READY', () => {
  it('DD-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('DD-01-02 forward produces 10 documents', () => {
    expect(fwdResult.documents).toHaveLength(10);
  });

  it('DD-01-03 forward produces 90 document edges', () => {
    expect(fwdResult.documentEdges).toHaveLength(90);
  });
});

// ── DD-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('DD-02 PENDING_APPROVAL', () => {
  const r = resolveFromTemplate(synTmpl({ status: 'PENDING_APPROVAL' }));

  it('DD-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('DD-02-02 documents is empty', () => {
    expect(r.documents).toHaveLength(0);
  });

  it('DD-02-03 documentEdges is empty', () => {
    expect(r.documentEdges).toHaveLength(0);
  });
});

// ── DD-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('DD-03 UNCHANGED — same25', () => {
  it('DD-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('DD-03-02 documents is empty', () => {
    expect(sameResult.documents).toHaveLength(0);
  });

  it('DD-03-03 documentEdges is empty', () => {
    expect(sameResult.documentEdges).toHaveLength(0);
  });
});

// ── DD-04 registry mapping ─────────────────────────────────────────────────────

describe('DD-04 registry mapping', () => {
  it('DD-04-01 TO_TRINH → TO_TRINH_MUA_SAM', () => {
    expect(fwdResult.documents.find(d => d.template === 'TO_TRINH')?.id)
      .toBe('TO_TRINH_MUA_SAM');
  });

  it('DD-04-02 KHLCNT → KE_HOACH_LCNT', () => {
    expect(fwdResult.documents.find(d => d.template === 'KHLCNT')?.id)
      .toBe('KE_HOACH_LCNT');
  });

  it('DD-04-03 PHAN_CONG_NHIEM_VU → QUYET_DINH_PHAN_CONG', () => {
    expect(fwdResult.documents.find(d => d.template === 'PHAN_CONG_NHIEM_VU')?.id)
      .toBe('QUYET_DINH_PHAN_CONG');
  });
});

// ── DD-05 document node shape ──────────────────────────────────────────────────

describe('DD-05 document node shape', () => {
  it('DD-05-01 every document has type DOCUMENT', () => {
    expect(fwdResult.documents.every(d => d.type === 'DOCUMENT')).toBe(true);
  });

  it('DD-05-02 every document has id and template as strings', () => {
    expect(fwdResult.documents.every(
      d => typeof d.id === 'string' && typeof d.template === 'string',
    )).toBe(true);
  });

  it('DD-05-03 documents[0] is TO_TRINH_MUA_SAM', () => {
    expect(fwdResult.documents[0]).toMatchObject({
      id:       'TO_TRINH_MUA_SAM',
      template: 'TO_TRINH',
      type:     'DOCUMENT',
    });
  });
});

// ── DD-06 document ordering ────────────────────────────────────────────────────

describe('DD-06 document ordering', () => {
  it('DD-06-01 GENERAL first — documents[0].template is TO_TRINH', () => {
    expect(fwdResult.documents[0].template).toBe('TO_TRINH');
  });

  it('DD-06-02 HR at index 3 — documents[3].template is PHAN_CONG_NHIEM_VU', () => {
    expect(fwdResult.documents[3].template).toBe('PHAN_CONG_NHIEM_VU');
  });

  it('DD-06-03 BIDDING starts at index 4 — documents[4].template is KHLCNT', () => {
    expect(fwdResult.documents[4].template).toBe('KHLCNT');
  });
});

// ── DD-07 SELF edges ───────────────────────────────────────────────────────────

describe('DD-07 SELF edges', () => {
  it('DD-07-01 SELF edge count equals document count', () => {
    const selfCount = fwdResult.documentEdges.filter(e => e.type === 'SELF').length;
    expect(selfCount).toBe(fwdResult.documents.length);
  });

  it('DD-07-02 every SELF edge has from === to', () => {
    const selfEdges = fwdResult.documentEdges.filter(e => e.type === 'SELF');
    expect(selfEdges.every(e => e.from === e.to)).toBe(true);
  });

  it('DD-07-03 SELF edges appear before TEMPLATE edges', () => {
    const firstTemplate = fwdResult.documentEdges.findIndex(e => e.type === 'TEMPLATE');
    const lastSelf      = fwdResult.documentEdges.reduce(
      (acc, e, i) => (e.type === 'SELF' ? i : acc), -1,
    );
    expect(lastSelf).toBeLessThan(firstTemplate);
  });
});

// ── DD-08 TEMPLATE doc edges from template SELF edges ─────────────────────────

describe('DD-08 TEMPLATE edges from template SELF edges', () => {
  it('DD-08-01 SELF template edge T→T yields TEMPLATE doc edge docT→docT', () => {
    const r = resolveFromTemplate(synTmpl({
      status:        'READY',
      impactScope:   'NARROW',
      impactLevel:   'LOW',
      templates:     [{ id: 'TO_TRINH', domain: 'GENERAL' }],
      templateEdges: [{ from: 'TO_TRINH', to: 'TO_TRINH', type: 'SELF' }],
    }));
    const te = r.documentEdges.find(e => e.type === 'TEMPLATE');
    expect(te).toMatchObject({ from: 'TO_TRINH_MUA_SAM', to: 'TO_TRINH_MUA_SAM', type: 'TEMPLATE' });
  });

  it('DD-08-02 forward has 10 TEMPLATE doc edges where from === to', () => {
    const selfLoop = fwdResult.documentEdges.filter(e => e.type === 'TEMPLATE' && e.from === e.to);
    expect(selfLoop).toHaveLength(10);
  });

  it('DD-08-03 TEMPLATE doc edge from SELF template edge carries type TEMPLATE not SELF', () => {
    const r = resolveFromTemplate(synTmpl({
      status:        'READY',
      impactScope:   'NARROW',
      impactLevel:   'LOW',
      templates:     [{ id: 'KHLCNT', domain: 'BIDDING' }],
      templateEdges: [{ from: 'KHLCNT', to: 'KHLCNT', type: 'SELF' }],
    }));
    const pairs = r.documentEdges.filter(e => e.from === 'KE_HOACH_LCNT' && e.to === 'KE_HOACH_LCNT');
    expect(pairs.map(e => e.type)).toEqual(['SELF', 'TEMPLATE']);
  });
});

// ── DD-09 TEMPLATE doc edges from template DOMAIN edges ───────────────────────

describe('DD-09 TEMPLATE edges from template DOMAIN edges', () => {
  it('DD-09-01 DOMAIN template edge A→B yields TEMPLATE doc edge docA→docB', () => {
    const r = resolveFromTemplate(synTmpl({
      status:        'READY',
      impactScope:   'BROAD',
      impactLevel:   'LOW',
      templates:     [
        { id: 'TO_TRINH', domain: 'GENERAL' },
        { id: 'KHLCNT',   domain: 'BIDDING' },
      ],
      templateEdges: [
        { from: 'TO_TRINH', to: 'TO_TRINH', type: 'SELF' },
        { from: 'KHLCNT',   to: 'KHLCNT',   type: 'SELF' },
        { from: 'TO_TRINH', to: 'KHLCNT',   type: 'DOMAIN' },
      ],
    }));
    const te = r.documentEdges.find(e => e.type === 'TEMPLATE' && e.from !== e.to);
    expect(te).toMatchObject({ from: 'TO_TRINH_MUA_SAM', to: 'KE_HOACH_LCNT', type: 'TEMPLATE' });
  });

  it('DD-09-02 forward has 70 TEMPLATE doc edges where from !== to', () => {
    const cross = fwdResult.documentEdges.filter(e => e.type === 'TEMPLATE' && e.from !== e.to);
    expect(cross).toHaveLength(70);
  });

  it('DD-09-03 TEMPLATE doc edges from DOMAIN template edges have from !== to', () => {
    const r = resolveFromTemplate(synTmpl({
      status:        'READY',
      impactScope:   'BROAD',
      impactLevel:   'LOW',
      templates:     [
        { id: 'DU_TOAN', domain: 'FINANCIAL' },
        { id: 'HSMT',    domain: 'BIDDING' },
      ],
      templateEdges: [{ from: 'DU_TOAN', to: 'HSMT', type: 'DOMAIN' }],
    }));
    const te = r.documentEdges.filter(e => e.type === 'TEMPLATE');
    expect(te.every(e => e.from !== e.to)).toBe(true);
  });
});

// ── DD-10 metadata ─────────────────────────────────────────────────────────────

describe('DD-10 metadata fields', () => {
  it('DD-10-01 metadata.documentCount equals documents.length', () => {
    expect(fwdResult.metadata.documentCount).toBe(fwdResult.documents.length);
  });

  it('DD-10-02 metadata.edgeCount equals documentEdges.length', () => {
    expect(fwdResult.metadata.edgeCount).toBe(fwdResult.documentEdges.length);
  });

  it('DD-10-03 metadata.targetDate forwarded from MinTemplate', () => {
    const r = resolveFromTemplate(synTmpl({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── DD-11 impactScope / impactLevel forwarding ─────────────────────────────────

describe('DD-11 impactScope and impactLevel forwarding', () => {
  it('DD-11-01 impactScope forwarded', () => {
    const r = resolveFromTemplate(synTmpl({ impactScope: 'BROAD', impactLevel: 'HIGH' }));
    expect(r.impactScope).toBe('BROAD');
  });

  it('DD-11-02 impactLevel forwarded', () => {
    const r = resolveFromTemplate(synTmpl({ impactScope: 'BROAD', impactLevel: 'HIGH' }));
    expect(r.impactLevel).toBe('HIGH');
  });

  it('DD-11-03 BROAD/CRITICAL forwarded unchanged', () => {
    const r = resolveFromTemplate(synTmpl({ impactScope: 'BROAD', impactLevel: 'CRITICAL' }));
    expect(r.impactScope).toBe('BROAD');
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── DD-12 single resolve call ──────────────────────────────────────────────────

describe('DD-12 single resolve call', () => {
  it('DD-12-01 resolve() calls templateResolver.resolve() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synTmpl({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const resolver = new DocumentDependencyResolver({ resolve: spy } as unknown as TemplateDependencyResolver);
    resolver.resolve(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('DD-12-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synTmpl({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const resolver = new DocumentDependencyResolver({ resolve: spy } as unknown as TemplateDependencyResolver);
    resolver.resolve(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('DD-12-03 two resolve() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synTmpl({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const resolver = new DocumentDependencyResolver({ resolve: spy } as unknown as TemplateDependencyResolver);
    resolver.resolve(SAME.last, SAME.cur);
    resolver.resolve(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── DD-13 edge count formula ───────────────────────────────────────────────────

describe('DD-13 edge count formula', () => {
  it('DD-13-01 NONE scope produces empty documentEdges', () => {
    const r = resolveFromTemplate(synTmpl({
      status:      'READY',
      impactScope: 'NONE',
      impactLevel: 'NONE',
    }));
    expect(r.documentEdges).toHaveLength(0);
  });

  it('DD-13-02 BIDDING NARROW — 4 docs, 8 edges (4 SELF + 4 TEMPLATE)', () => {
    const BIDDING_IDS = ['KHLCNT', 'HSYC', 'HSMT', 'BAO_CAO_DANH_GIA'];
    const r = resolveFromTemplate(synTmpl({
      status:        'READY',
      impactScope:   'NARROW',
      impactLevel:   'LOW',
      templates:     BIDDING_IDS.map(id => ({ id, domain: 'BIDDING' })),
      templateEdges: BIDDING_IDS.map(id => ({ from: id, to: id, type: 'SELF' })),
    }));
    expect(r.documents).toHaveLength(4);
    expect(r.documentEdges).toHaveLength(8);
  });

  it('DD-13-03 forward metadata.edgeCount is 90', () => {
    expect(fwdResult.metadata.edgeCount).toBe(90);
  });
});
