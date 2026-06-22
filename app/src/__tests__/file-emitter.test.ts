import { describe, it, expect, vi } from 'vitest';
import {
  FileEmitter,
  emitFromRendered,
  type FileEmissionResult,
} from '../agents/FileEmitter';
import { TemplateRenderer } from '../agents/TemplateRenderer';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type RenderedInput = { documentId: string; priority: number; required?: boolean; templateId?: string };

function synRendered(opts: {
  status?:            SnapshotStatus;
  renderedArtifacts?: readonly RenderedInput[];
  impactScope?:       ImpactScope;
  impactLevel?:       ImpactLevel;
  targetDate?:        string;
} = {}) {
  const status = opts.status ?? 'READY';
  const raw    = status === 'READY' ? (opts.renderedArtifacts ?? []) : [];
  const arts   = raw.map(a => ({
    documentId: a.documentId,
    templateId: a.templateId ?? a.documentId,
    priority:   a.priority,
    required:   a.required ?? true,
  }));
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE',
    impactLevel: opts.impactLevel ?? 'NONE',
    renderedArtifacts: arts,
    metadata: { targetDate: opts.targetDate ?? '2026-01-01' },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  FileEmissionResult = new FileEmitter().emit(FWD.last, FWD.cur);
const sameResult: FileEmissionResult = new FileEmitter().emit(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4)
const mixedResult = emitFromRendered(synRendered({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  renderedArtifacts: [
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

// ── FE-01 READY ───────────────────────────────────────────────────────────────

describe('FE-01 READY', () => {
  it('FE-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('FE-01-02 forward produces 10 files', () => {
    expect(fwdResult.files).toHaveLength(10);
  });

  it('FE-01-03 forward requiredFiles has 10 items', () => {
    expect(fwdResult.requiredFiles).toHaveLength(10);
  });
});

// ── FE-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('FE-02 PENDING_APPROVAL', () => {
  const r = emitFromRendered(synRendered({ status: 'PENDING_APPROVAL' }));

  it('FE-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('FE-02-02 files is empty', () => {
    expect(r.files).toHaveLength(0);
  });

  it('FE-02-03 required and optional files are empty', () => {
    expect(r.requiredFiles).toHaveLength(0);
    expect(r.optionalFiles).toHaveLength(0);
  });
});

// ── FE-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('FE-03 UNCHANGED', () => {
  it('FE-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('FE-03-02 files is empty', () => {
    expect(sameResult.files).toHaveLength(0);
  });

  it('FE-03-03 requiredFiles is empty', () => {
    expect(sameResult.requiredFiles).toHaveLength(0);
  });
});

// ── FE-04 filename = documentId ───────────────────────────────────────────────

describe('FE-04 filename=documentId', () => {
  it('FE-04-01 forward first file has filename TO_TRINH_MUA_SAM', () => {
    expect(fwdResult.files[0].filename).toBe('TO_TRINH_MUA_SAM');
  });

  it('FE-04-02 synthetic single file filename equals documentId', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [{ documentId: 'KE_HOACH_LCNT', priority: 2 }],
    }));
    expect(r.files[0].filename).toBe('KE_HOACH_LCNT');
  });

  it('FE-04-03 mixed first requiredFile has filename KE_HOACH_LCNT', () => {
    expect(mixedResult.requiredFiles[0].filename).toBe('KE_HOACH_LCNT');
  });
});

// ── FE-05 extension = 'DOCX' ──────────────────────────────────────────────────

describe('FE-05 extension DOCX', () => {
  it('FE-05-01 all forward files have extension DOCX', () => {
    expect(fwdResult.files.every(f => f.extension === 'DOCX')).toBe(true);
  });

  it('FE-05-02 all mixed files have extension DOCX', () => {
    expect(mixedResult.files.every(f => f.extension === 'DOCX')).toBe(true);
  });

  it('FE-05-03 synthetic single file has extension DOCX', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [{ documentId: 'KE_HOACH_LCNT', priority: 1 }],
    }));
    expect(r.files[0].extension).toBe('DOCX');
  });
});

// ── FE-06 payload = CONTENT:templateId ────────────────────────────────────────

describe('FE-06 payload', () => {
  it('FE-06-01 all forward files have payload starting with CONTENT:', () => {
    expect(fwdResult.files.every(f => f.payload.startsWith('CONTENT:'))).toBe(true);
  });

  it('FE-06-02 forward first file payload is CONTENT:TO_TRINH_MUA_SAM', () => {
    expect(fwdResult.files[0].payload).toBe('CONTENT:TO_TRINH_MUA_SAM');
  });

  it('FE-06-03 custom templateId drives payload not documentId', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [{ documentId: 'DOC_A', templateId: 'TMPL_X', priority: 2 }],
    }));
    expect(r.files[0].payload).toBe('CONTENT:TMPL_X');
  });
});

// ── FE-07 required bucket ──────────────────────────────────────────────────────

describe('FE-07 required bucket', () => {
  it('FE-07-01 required=true artifacts go to requiredFiles', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [
        { documentId: 'KE_HOACH_LCNT',  priority: 1, required: true  },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.requiredFiles).toHaveLength(1);
    expect(r.requiredFiles[0].filename).toBe('KE_HOACH_LCNT');
  });

  it('FE-07-02 all requiredFiles have required=true', () => {
    expect(mixedResult.requiredFiles.every(f => f.required === true)).toBe(true);
  });

  it('FE-07-03 mixed HIGH — requiredFiles has 4 items', () => {
    expect(mixedResult.requiredFiles).toHaveLength(4);
  });
});

// ── FE-08 optional bucket ──────────────────────────────────────────────────────

describe('FE-08 optional bucket', () => {
  it('FE-08-01 required=false artifacts go to optionalFiles', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [
        { documentId: 'KE_HOACH_LCNT',  priority: 2, required: true  },
        { documentId: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.optionalFiles).toHaveLength(1);
    expect(r.optionalFiles[0].filename).toBe('HO_SO_MOI_THAU');
  });

  it('FE-08-02 all optionalFiles have required=false', () => {
    expect(mixedResult.optionalFiles.every(f => f.required === false)).toBe(true);
  });

  it('FE-08-03 mixed HIGH — optionalFiles has 6 items', () => {
    expect(mixedResult.optionalFiles).toHaveLength(6);
  });
});

// ── FE-09 ordering ─────────────────────────────────────────────────────────────

describe('FE-09 ordering', () => {
  it('FE-09-01 files = [...requiredFiles, ...optionalFiles]', () => {
    const rLen = mixedResult.requiredFiles.length;
    expect(mixedResult.files.slice(0, rLen)).toEqual([...mixedResult.requiredFiles]);
    expect(mixedResult.files.slice(rLen)).toEqual([...mixedResult.optionalFiles]);
  });

  it('FE-09-02 source order preserved within requiredFiles', () => {
    expect(mixedResult.requiredFiles[0].filename).toBe('KE_HOACH_LCNT');
    expect(mixedResult.requiredFiles[3].filename).toBe('DU_TOAN_MUA_SAM');
  });

  it('FE-09-03 source order preserved within optionalFiles', () => {
    expect(mixedResult.optionalFiles[0].filename).toBe('TO_TRINH_MUA_SAM');
    expect(mixedResult.optionalFiles[5].filename).toBe('CHUNG_THU_THAM_DINH_GIA');
  });
});

// ── FE-10 metadata ─────────────────────────────────────────────────────────────

describe('FE-10 metadata', () => {
  it('FE-10-01 fileCount equals files.length', () => {
    expect(fwdResult.metadata.fileCount).toBe(fwdResult.files.length);
  });

  it('FE-10-02 requiredCount equals requiredFiles.length', () => {
    expect(mixedResult.metadata.requiredCount).toBe(mixedResult.requiredFiles.length);
  });

  it('FE-10-03 targetDate forwarded from rendered.metadata.targetDate', () => {
    const r = emitFromRendered(synRendered({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── FE-11 fileCount ────────────────────────────────────────────────────────────

describe('FE-11 fileCount', () => {
  it('FE-11-01 requiredCount + optionalCount equals fileCount', () => {
    expect(mixedResult.metadata.requiredCount + mixedResult.metadata.optionalCount)
      .toBe(mixedResult.metadata.fileCount);
  });

  it('FE-11-02 mixed HIGH — fileCount=10, requiredCount=4, optionalCount=6', () => {
    expect(mixedResult.metadata.fileCount).toBe(10);
    expect(mixedResult.metadata.requiredCount).toBe(4);
    expect(mixedResult.metadata.optionalCount).toBe(6);
  });

  it('FE-11-03 forward — fileCount=10, requiredCount=10, optionalCount=0', () => {
    expect(fwdResult.metadata.fileCount).toBe(10);
    expect(fwdResult.metadata.requiredCount).toBe(10);
    expect(fwdResult.metadata.optionalCount).toBe(0);
  });
});

// ── FE-12 preserve priority ────────────────────────────────────────────────────

describe('FE-12 preserve priority', () => {
  it('FE-12-01 priority copied from RenderedArtifact', () => {
    const r = emitFromRendered(synRendered({
      renderedArtifacts: [
        { documentId: 'KE_HOACH_LCNT',  priority: 2, required: true },
        { documentId: 'HO_SO_MOI_THAU', priority: 3, required: true },
      ],
    }));
    expect(r.files[0].priority).toBe(2);
    expect(r.files[1].priority).toBe(3);
  });

  it('FE-12-02 requiredFiles preserve priority from RenderedArtifact', () => {
    expect(mixedResult.requiredFiles.every(f => f.priority === 2)).toBe(true);
  });

  it('FE-12-03 optionalFiles preserve priority from RenderedArtifact', () => {
    expect(mixedResult.optionalFiles.every(f => f.priority === 4)).toBe(true);
  });
});

// ── FE-13 single emit call ─────────────────────────────────────────────────────

describe('FE-13 single emit call', () => {
  it('FE-13-01 emit() calls templateRenderer.render() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synRendered({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const emitter = new FileEmitter({ render: spy } as unknown as TemplateRenderer);
    emitter.emit(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('FE-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synRendered({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const emitter = new FileEmitter({ render: spy } as unknown as TemplateRenderer);
    emitter.emit(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('FE-13-03 two emit() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synRendered({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const emitter = new FileEmitter({ render: spy } as unknown as TemplateRenderer);
    emitter.emit(SAME.last, SAME.cur);
    emitter.emit(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
