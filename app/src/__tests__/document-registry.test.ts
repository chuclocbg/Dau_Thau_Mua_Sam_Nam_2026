import { describe, it, expect, vi } from 'vitest';
import {
  DocumentRegistry,
  registerFromEmission,
  type RegistryResult,
} from '../agents/DocumentRegistry';
import { FileEmitter } from '../agents/FileEmitter';
import type { ImpactScope, ImpactLevel } from '../agents/ImpactAnalyzer';
import type { SnapshotStatus }           from '../agents/SnapshotBuilder';

// ── helpers ────────────────────────────────────────────────────────────────────

const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const SAME = { last: '2025-07-01', cur: '2025-07-01' };

type EmittedInput = { filename: string; priority: number; required?: boolean; extension?: string; payload?: string };

function synEmitted(opts: {
  status?:      SnapshotStatus;
  files?:       readonly EmittedInput[];
  impactScope?: ImpactScope;
  impactLevel?: ImpactLevel;
  targetDate?:  string;
} = {}) {
  const status = opts.status ?? 'READY';
  const raw    = status === 'READY' ? (opts.files ?? []) : [];
  const files  = raw.map(f => ({
    filename:  f.filename,
    extension: f.extension ?? 'DOCX',
    payload:   f.payload   ?? `CONTENT:${f.filename}`,
    priority:  f.priority,
    required:  f.required  ?? true,
  }));
  return {
    status,
    impactScope: opts.impactScope ?? 'NONE',
    impactLevel: opts.impactLevel ?? 'NONE',
    files,
    metadata: { targetDate: opts.targetDate ?? '2026-01-01' },
  };
}

// Two real pipeline calls — shared across groups that need real data.
const fwdResult:  RegistryResult = new DocumentRegistry().register(FWD.last, FWD.cur);
const sameResult: RegistryResult = new DocumentRegistry().register(SAME.last, SAME.cur);

// Synthetic mixed: 4 required (priority=2) + 6 optional (priority=4)
const mixedResult = registerFromEmission(synEmitted({
  status: 'READY', impactScope: 'BROAD', impactLevel: 'HIGH',
  files: [
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

// ── DR-01 READY ───────────────────────────────────────────────────────────────

describe('DR-01 READY', () => {
  it('DR-01-01 status is READY', () => {
    expect(fwdResult.status).toBe('READY');
  });

  it('DR-01-02 forward produces 10 entries', () => {
    expect(fwdResult.entries).toHaveLength(10);
  });

  it('DR-01-03 forward requiredEntries has 10 items', () => {
    expect(fwdResult.requiredEntries).toHaveLength(10);
  });
});

// ── DR-02 PENDING_APPROVAL ─────────────────────────────────────────────────────

describe('DR-02 PENDING_APPROVAL', () => {
  const r = registerFromEmission(synEmitted({ status: 'PENDING_APPROVAL' }));

  it('DR-02-01 status forwarded', () => {
    expect(r.status).toBe('PENDING_APPROVAL');
  });

  it('DR-02-02 entries is empty', () => {
    expect(r.entries).toHaveLength(0);
  });

  it('DR-02-03 index is empty and required/optional entries are empty', () => {
    expect(Object.keys(r.index).length).toBe(0);
    expect(r.requiredEntries).toHaveLength(0);
    expect(r.optionalEntries).toHaveLength(0);
  });
});

// ── DR-03 UNCHANGED ────────────────────────────────────────────────────────────

describe('DR-03 UNCHANGED', () => {
  it('DR-03-01 status is UNCHANGED', () => {
    expect(sameResult.status).toBe('UNCHANGED');
  });

  it('DR-03-02 entries is empty', () => {
    expect(sameResult.entries).toHaveLength(0);
  });

  it('DR-03-03 index is empty', () => {
    expect(Object.keys(sameResult.index).length).toBe(0);
  });
});

// ── DR-04 registeredAt ─────────────────────────────────────────────────────────

describe('DR-04 registeredAt', () => {
  it('DR-04-01 all forward entries have registeredAt equal to targetDate', () => {
    expect(fwdResult.entries.every(e => e.registeredAt === fwdResult.metadata.targetDate)).toBe(true);
  });

  it('DR-04-02 mixed entries have registeredAt equal to targetDate', () => {
    expect(mixedResult.entries.every(e => e.registeredAt === mixedResult.metadata.targetDate)).toBe(true);
  });

  it('DR-04-03 custom targetDate sets registeredAt on all entries', () => {
    const r = registerFromEmission(synEmitted({
      files: [{ filename: 'KE_HOACH_LCNT', priority: 2 }],
      targetDate: '2099-12-31',
    }));
    expect(r.entries[0].registeredAt).toBe('2099-12-31');
  });
});

// ── DR-05 index lookup ─────────────────────────────────────────────────────────

describe('DR-05 index lookup', () => {
  it('DR-05-01 index contains an entry for TO_TRINH_MUA_SAM from forward result', () => {
    expect(fwdResult.index['TO_TRINH_MUA_SAM']).toBeDefined();
  });

  it('DR-05-02 index entry for KE_HOACH_LCNT matches requiredEntries[0]', () => {
    expect(mixedResult.index['KE_HOACH_LCNT']).toEqual(mixedResult.requiredEntries[0]);
  });

  it('DR-05-03 index entry for TO_TRINH_MUA_SAM matches optionalEntries[0]', () => {
    expect(mixedResult.index['TO_TRINH_MUA_SAM']).toEqual(mixedResult.optionalEntries[0]);
  });
});

// ── DR-06 index completeness ───────────────────────────────────────────────────

describe('DR-06 index completeness', () => {
  it('DR-06-01 index key count equals entries.length for forward result', () => {
    expect(Object.keys(fwdResult.index).length).toBe(fwdResult.entries.length);
  });

  it('DR-06-02 mixed result index has 10 keys', () => {
    expect(Object.keys(mixedResult.index).length).toBe(10);
  });

  it('DR-06-03 empty emission produces empty index', () => {
    const r = registerFromEmission(synEmitted({
      status: 'READY', impactScope: 'NONE', impactLevel: 'NONE', files: [],
    }));
    expect(Object.keys(r.index).length).toBe(0);
  });
});

// ── DR-07 required bucket ──────────────────────────────────────────────────────

describe('DR-07 required bucket', () => {
  it('DR-07-01 required=true files go to requiredEntries', () => {
    const r = registerFromEmission(synEmitted({
      files: [
        { filename: 'KE_HOACH_LCNT',  priority: 1, required: true  },
        { filename: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.requiredEntries).toHaveLength(1);
    expect(r.requiredEntries[0].filename).toBe('KE_HOACH_LCNT');
  });

  it('DR-07-02 all requiredEntries have required=true', () => {
    expect(mixedResult.requiredEntries.every(e => e.required === true)).toBe(true);
  });

  it('DR-07-03 mixed HIGH — requiredEntries has 4 items', () => {
    expect(mixedResult.requiredEntries).toHaveLength(4);
  });
});

// ── DR-08 optional bucket ──────────────────────────────────────────────────────

describe('DR-08 optional bucket', () => {
  it('DR-08-01 required=false files go to optionalEntries', () => {
    const r = registerFromEmission(synEmitted({
      files: [
        { filename: 'KE_HOACH_LCNT',  priority: 2, required: true  },
        { filename: 'HO_SO_MOI_THAU', priority: 4, required: false },
      ],
    }));
    expect(r.optionalEntries).toHaveLength(1);
    expect(r.optionalEntries[0].filename).toBe('HO_SO_MOI_THAU');
  });

  it('DR-08-02 all optionalEntries have required=false', () => {
    expect(mixedResult.optionalEntries.every(e => e.required === false)).toBe(true);
  });

  it('DR-08-03 mixed HIGH — optionalEntries has 6 items', () => {
    expect(mixedResult.optionalEntries).toHaveLength(6);
  });
});

// ── DR-09 ordering ─────────────────────────────────────────────────────────────

describe('DR-09 ordering', () => {
  it('DR-09-01 entries = [...requiredEntries, ...optionalEntries]', () => {
    const rLen = mixedResult.requiredEntries.length;
    expect(mixedResult.entries.slice(0, rLen)).toEqual([...mixedResult.requiredEntries]);
    expect(mixedResult.entries.slice(rLen)).toEqual([...mixedResult.optionalEntries]);
  });

  it('DR-09-02 source order preserved within requiredEntries', () => {
    expect(mixedResult.requiredEntries[0].filename).toBe('KE_HOACH_LCNT');
    expect(mixedResult.requiredEntries[3].filename).toBe('DU_TOAN_MUA_SAM');
  });

  it('DR-09-03 source order preserved within optionalEntries', () => {
    expect(mixedResult.optionalEntries[0].filename).toBe('TO_TRINH_MUA_SAM');
    expect(mixedResult.optionalEntries[5].filename).toBe('CHUNG_THU_THAM_DINH_GIA');
  });
});

// ── DR-10 metadata ─────────────────────────────────────────────────────────────

describe('DR-10 metadata', () => {
  it('DR-10-01 entryCount equals entries.length', () => {
    expect(fwdResult.metadata.entryCount).toBe(fwdResult.entries.length);
  });

  it('DR-10-02 requiredCount equals requiredEntries.length', () => {
    expect(mixedResult.metadata.requiredCount).toBe(mixedResult.requiredEntries.length);
  });

  it('DR-10-03 targetDate forwarded from emission.metadata.targetDate', () => {
    const r = registerFromEmission(synEmitted({ targetDate: '2099-12-31' }));
    expect(r.metadata.targetDate).toBe('2099-12-31');
  });
});

// ── DR-11 entryCount ───────────────────────────────────────────────────────────

describe('DR-11 entryCount', () => {
  it('DR-11-01 requiredCount + optionalCount equals entryCount', () => {
    expect(mixedResult.metadata.requiredCount + mixedResult.metadata.optionalCount)
      .toBe(mixedResult.metadata.entryCount);
  });

  it('DR-11-02 mixed HIGH — entryCount=10, requiredCount=4, optionalCount=6', () => {
    expect(mixedResult.metadata.entryCount).toBe(10);
    expect(mixedResult.metadata.requiredCount).toBe(4);
    expect(mixedResult.metadata.optionalCount).toBe(6);
  });

  it('DR-11-03 forward — entryCount=10, requiredCount=10, optionalCount=0', () => {
    expect(fwdResult.metadata.entryCount).toBe(10);
    expect(fwdResult.metadata.requiredCount).toBe(10);
    expect(fwdResult.metadata.optionalCount).toBe(0);
  });
});

// ── DR-12 preserve fields ──────────────────────────────────────────────────────

describe('DR-12 preserve fields', () => {
  it('DR-12-01 extension and payload preserved in entries', () => {
    const r = registerFromEmission(synEmitted({
      files: [{ filename: 'KE_HOACH_LCNT', priority: 2, extension: 'DOCX', payload: 'CONTENT:KE_HOACH_LCNT' }],
    }));
    expect(r.entries[0].extension).toBe('DOCX');
    expect(r.entries[0].payload).toBe('CONTENT:KE_HOACH_LCNT');
  });

  it('DR-12-02 requiredEntries preserve priority from EmittedFile', () => {
    expect(mixedResult.requiredEntries.every(e => e.priority === 2)).toBe(true);
  });

  it('DR-12-03 optionalEntries preserve priority from EmittedFile', () => {
    expect(mixedResult.optionalEntries.every(e => e.priority === 4)).toBe(true);
  });
});

// ── DR-13 single register call ─────────────────────────────────────────────────

describe('DR-13 single register call', () => {
  it('DR-13-01 register() calls fileEmitter.emit() exactly once', () => {
    const spy = vi.fn().mockReturnValue(synEmitted({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const registry = new DocumentRegistry({ emit: spy } as unknown as FileEmitter);
    registry.register(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('DR-13-02 spy called with correct date arguments', () => {
    const spy = vi.fn().mockReturnValue(synEmitted({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const registry = new DocumentRegistry({ emit: spy } as unknown as FileEmitter);
    registry.register(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledWith(SAME.last, SAME.cur);
  });

  it('DR-13-03 two register() calls cause spy to be called twice', () => {
    const spy = vi.fn().mockReturnValue(synEmitted({ status: 'UNCHANGED', targetDate: SAME.cur }));
    const registry = new DocumentRegistry({ emit: spy } as unknown as FileEmitter);
    registry.register(SAME.last, SAME.cur);
    registry.register(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
