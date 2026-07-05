/**
 * MemoryLegalDocumentRepository tests — repository interface contract
 *
 * Groups (13 × 3 = 39):
 *   LRD-01  save / findById — basic CRUD
 *   LRD-02  findBySymbol — lookup by document symbol
 *   LRD-03  findAll — returns all saved documents
 *   LRD-04  findByDomain — tag-based domain filter
 *   LRD-05  delete — removes document from store
 *   LRD-06  save overwrites existing document
 *   LRD-07  findById / findBySymbol return null for missing
 *   LRD-08  findAll — empty store returns empty array
 *   LRD-09  findByDomain — no matching tag returns empty
 *   LRD-10  findByDomain — multiple docs, some matching
 *   LRD-11  delete — idempotent (no error for missing id)
 *   LRD-12  PrismaLegalDocumentRepository (Phase M1, real impl) — throws without DATABASE_URL
 *   LRD-13  PrismaNotReadyError — error name and message shape (class still exists, unused by this repo)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLegalDocumentRepository } from '../legal/memoryRepositories';
import { PrismaLegalDocumentRepository } from '../legal/prismaRepositories';
import { PrismaNotReadyError } from '../legal/legalRepositories';
import type { ILegalDocumentRepository } from '../legal/legalRepositories';
import type { LegalDocument } from '../legal/legalSchema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW: LegalDocument = {
  id: 'luat-22-2023', symbol: '22/2023/QH15', title: 'Luật Đấu thầu',
  type: 'LAW', issuer: 'Quốc hội', effectiveDate: '2024-01-01',
  status: 'ACTIVE', source: 'Công báo', priority: 1,
  tags: ['đấu thầu', 'mua sắm công'], summary: 'Luật đấu thầu', confidence: 1.0,
};
const DECREE: LegalDocument = {
  id: 'nd-214-2025', symbol: '214/2025/NĐ-CP', title: 'Nghị định đấu thầu',
  type: 'DECREE', issuer: 'Chính phủ', effectiveDate: '2025-07-01',
  status: 'ACTIVE', source: 'Công báo', priority: 2,
  tags: ['đấu thầu'], summary: 'NĐ hướng dẫn Luật 22', confidence: 0.9,
};
const CIRCULAR: LegalDocument = {
  id: 'tt-79-2025', symbol: '79/2025/TT-BTC', title: 'Thông tư tài chính',
  type: 'CIRCULAR', issuer: 'Bộ Tài chính', effectiveDate: '2025-08-01',
  status: 'ACTIVE', source: 'Công báo', priority: 3,
  tags: ['tài chính', 'thanh toán'], summary: 'TT tài chính đấu thầu', confidence: 0.8,
};

// ─── LRD-01: save / findById ──────────────────────────────────────────────────

describe('LRD-01 save/findById basic CRUD', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(() => { repo = new MemoryLegalDocumentRepository(); });

  it('findById returns null before any saves', async () => {
    expect(await repo.findById('unknown')).toBeNull();
  });
  it('findById returns doc after save', async () => {
    await repo.save(LAW);
    expect(await repo.findById(LAW.id)).toEqual(LAW);
  });
  it('returned doc has correct symbol', async () => {
    await repo.save(LAW);
    expect((await repo.findById(LAW.id))!.symbol).toBe('22/2023/QH15');
  });
});

// ─── LRD-02: findBySymbol ─────────────────────────────────────────────────────

describe('LRD-02 findBySymbol lookup by document symbol', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);
    await repo.save(DECREE);
  });

  it('finds LAW by its symbol', async () => {
    expect(await repo.findBySymbol('22/2023/QH15')).toEqual(LAW);
  });
  it('finds DECREE by its symbol', async () => {
    expect((await repo.findBySymbol('214/2025/NĐ-CP'))!.id).toBe('nd-214-2025');
  });
  it('returns null for unknown symbol', async () => {
    expect(await repo.findBySymbol('99/9999/XX')).toBeNull();
  });
});

// ─── LRD-03: findAll ──────────────────────────────────────────────────────────

describe('LRD-03 findAll returns all saved documents', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);
    await repo.save(DECREE);
    await repo.save(CIRCULAR);
  });

  it('findAll returns 3 documents', async () => {
    expect(await repo.findAll()).toHaveLength(3);
  });
  it('findAll contains the CIRCULAR doc', async () => {
    const all = await repo.findAll();
    expect(all.some(d => d.symbol === '79/2025/TT-BTC')).toBe(true);
  });
  it('findAll result is readonly array', async () => {
    const all = await repo.findAll();
    expect(Array.isArray(all)).toBe(true);
  });
});

// ─── LRD-04: findByDomain ────────────────────────────────────────────────────

describe('LRD-04 findByDomain filters by tag', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);     // tags: ['đấu thầu', 'mua sắm công']
    await repo.save(DECREE);  // tags: ['đấu thầu']
    await repo.save(CIRCULAR); // tags: ['tài chính', 'thanh toán']
  });

  it('findByDomain("đấu thầu") returns LAW and DECREE', async () => {
    expect(await repo.findByDomain('đấu thầu')).toHaveLength(2);
  });
  it('findByDomain("tài chính") returns only CIRCULAR', async () => {
    const result = await repo.findByDomain('tài chính');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('tt-79-2025');
  });
  it('findByDomain("mua sắm công") returns only LAW', async () => {
    expect(await repo.findByDomain('mua sắm công')).toHaveLength(1);
  });
});

// ─── LRD-05: delete ───────────────────────────────────────────────────────────

describe('LRD-05 delete removes document', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);
    await repo.save(DECREE);
  });

  it('findById returns null after delete', async () => {
    await repo.delete(LAW.id);
    expect(await repo.findById(LAW.id)).toBeNull();
  });
  it('findAll has 1 doc after deleting one', async () => {
    await repo.delete(LAW.id);
    expect(await repo.findAll()).toHaveLength(1);
  });
  it('remaining doc is DECREE', async () => {
    await repo.delete(LAW.id);
    expect((await repo.findAll())[0]!.id).toBe('nd-214-2025');
  });
});

// ─── LRD-06: save overwrites existing ────────────────────────────────────────

describe('LRD-06 save overwrites existing document', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => { repo = new MemoryLegalDocumentRepository(); });

  it('status can be updated via save', async () => {
    await repo.save(LAW);
    await repo.save({ ...LAW, status: 'SUPERSEDED' });
    expect((await repo.findById(LAW.id))!.status).toBe('SUPERSEDED');
  });
  it('findAll still has 1 document after overwrite', async () => {
    await repo.save(LAW);
    await repo.save({ ...LAW, title: 'Updated' });
    expect(await repo.findAll()).toHaveLength(1);
  });
  it('title reflects the overwrite', async () => {
    await repo.save(LAW);
    await repo.save({ ...LAW, title: 'Luật Đấu thầu sửa đổi' });
    expect((await repo.findById(LAW.id))!.title).toContain('sửa đổi');
  });
});

// ─── LRD-07: findById / findBySymbol null for missing ────────────────────────

describe('LRD-07 findById/findBySymbol return null for missing', () => {
  const repo: ILegalDocumentRepository = new MemoryLegalDocumentRepository();

  it('findById("nonexistent") returns null', async () => {
    expect(await repo.findById('nonexistent')).toBeNull();
  });
  it('findBySymbol("00/0000/XX") returns null', async () => {
    expect(await repo.findBySymbol('00/0000/XX')).toBeNull();
  });
  it('returns null not undefined', async () => {
    const result = await repo.findById('x');
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });
});

// ─── LRD-08: findAll empty store ─────────────────────────────────────────────

describe('LRD-08 findAll returns empty array for empty store', () => {
  const repo: ILegalDocumentRepository = new MemoryLegalDocumentRepository();

  it('findAll returns [] before any saves', async () => {
    expect(await repo.findAll()).toHaveLength(0);
  });
  it('findAll result is an array', async () => {
    expect(Array.isArray(await repo.findAll())).toBe(true);
  });
  it('findByDomain returns [] on empty store', async () => {
    expect(await repo.findByDomain('đấu thầu')).toHaveLength(0);
  });
});

// ─── LRD-09: findByDomain no matching tag ────────────────────────────────────

describe('LRD-09 findByDomain returns empty when no tag matches', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);
  });

  it('domain "xây dựng" not in any tag → empty', async () => {
    expect(await repo.findByDomain('xây dựng')).toHaveLength(0);
  });
  it('empty string domain returns empty', async () => {
    expect(await repo.findByDomain('')).toHaveLength(0);
  });
  it('case-sensitive tag match ("Đấu Thầu" != "đấu thầu")', async () => {
    expect(await repo.findByDomain('Đấu Thầu')).toHaveLength(0);
  });
});

// ─── LRD-10: findByDomain multiple docs, some matching ───────────────────────

describe('LRD-10 findByDomain partial match across multiple docs', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    for (let i = 1; i <= 5; i++) {
      await repo.save({
        ...LAW, id: `doc-${i}`,
        tags: i % 2 === 0 ? ['đấu thầu'] : ['tài chính'],
      });
    }
  });

  it('2 of 5 docs have "đấu thầu" tag', async () => {
    expect(await repo.findByDomain('đấu thầu')).toHaveLength(2);
  });
  it('3 of 5 docs have "tài chính" tag', async () => {
    expect(await repo.findByDomain('tài chính')).toHaveLength(3);
  });
  it('total docs is 5', async () => {
    expect(await repo.findAll()).toHaveLength(5);
  });
});

// ─── LRD-11: delete idempotent ────────────────────────────────────────────────

describe('LRD-11 delete is idempotent', () => {
  let repo: ILegalDocumentRepository;
  beforeEach(async () => {
    repo = new MemoryLegalDocumentRepository();
    await repo.save(LAW);
  });

  it('delete same id twice does not throw', async () => {
    await repo.delete(LAW.id);
    await expect(repo.delete(LAW.id)).resolves.toBeUndefined();
  });
  it('delete nonexistent id does not throw', async () => {
    await expect(repo.delete('nonexistent-id')).resolves.toBeUndefined();
  });
  it('store is empty after double delete', async () => {
    await repo.delete(LAW.id);
    await repo.delete(LAW.id);
    expect(await repo.findAll()).toHaveLength(0);
  });
});

// ─── LRD-12: PrismaLegalDocumentRepository (Phase M1 real impl) ──────────────
// No DATABASE_URL is configured in this environment (Docker unavailable — see
// docs/infrastructure.md) — every call surfaces getPrismaClient()'s guard error
// rather than the old stub-era PrismaNotReadyError, which this class no longer throws.

describe('LRD-12 PrismaLegalDocumentRepository throws without DATABASE_URL', () => {
  const repo: ILegalDocumentRepository = new PrismaLegalDocumentRepository();

  it('save throws a DATABASE_URL configuration error', async () => {
    await expect(repo.save(LAW)).rejects.toThrow(/DATABASE_URL/);
  });
  it('findById throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findById('x')).rejects.toThrow(/DATABASE_URL/);
  });
  it('findAll throws a DATABASE_URL configuration error', async () => {
    await expect(repo.findAll()).rejects.toThrow(/DATABASE_URL/);
  });
});

// ─── LRD-13: PrismaNotReadyError shape ───────────────────────────────────────

describe('LRD-13 PrismaNotReadyError has correct name and message', () => {
  it('name is "PrismaNotReadyError"', () => {
    expect(new PrismaNotReadyError('save').name).toBe('PrismaNotReadyError');
  });
  it('message contains method name', () => {
    expect(new PrismaNotReadyError('findById').message).toContain('findById');
  });
  it('is an instance of Error', () => {
    expect(new PrismaNotReadyError('x')).toBeInstanceOf(Error);
  });
});
