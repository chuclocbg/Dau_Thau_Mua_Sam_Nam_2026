import { describe, it, expect } from 'vitest';
import { resolveAuthorityForValue, getAuthorityChain, validateAuthorityPermission } from '../approval/approvalAuthority';
import { ApprovalError } from '../approval/approvalTypes';
import type { ApprovalAuthority } from '../masterdata/masterdataTypes';
import type { IMasterDataRepository } from '../masterdata/masterdataRepository';

// ─── Minimal in-memory authority repo ────────────────────────────────────────

function makeRepo(authorities: ApprovalAuthority[]): IMasterDataRepository<ApprovalAuthority> {
  return {
    create: async () => { throw new Error('not needed'); },
    update: async () => { throw new Error('not needed'); },
    delete: async () => {},
    findById:   async (id: string)   => authorities.find(a => a.id === id)   ?? null,
    findByCode: async (code: string) => authorities.find(a => a.code === code) ?? null,
    findAll:    async ()     => authorities,
    findActive: async ()     => authorities.filter(a => a.isActive && !a.isArchived),
    count:      async ()     => authorities.length,
    search:     async ()     => ({ items: authorities, total: authorities.length, page: 1, pageSize: 100 }),
  } as unknown as IMasterDataRepository<ApprovalAuthority>;
}

const auth = (code: string, level: number, maxValue: number, active = true): ApprovalAuthority =>
  ({ id: code, code, name: code, level, maxValue, isActive: active, isArchived: false, createdAt: '', updatedAt: '' } as ApprovalAuthority);

// APR-A-01
describe('resolveAuthorityForValue — single qualified authority', () => {
  it('returns the authority when estimatedValue <= maxValue', async () => {
    const repo = makeRepo([auth('DIR', 3, 10_000_000_000)]);
    const a = await resolveAuthorityForValue(5_000_000_000, repo);
    expect(a?.code).toBe('DIR');
  });
  it('returns null when no authority can cover the value', async () => {
    const repo = makeRepo([auth('DIR', 3, 1_000_000)]);
    expect(await resolveAuthorityForValue(5_000_000_000, repo)).toBeNull();
  });
  it('returns null for empty repo', async () => {
    const repo = makeRepo([]);
    expect(await resolveAuthorityForValue(1_000_000, repo)).toBeNull();
  });
});

// APR-A-02
describe('resolveAuthorityForValue — picks most junior qualified', () => {
  it('picks highest level number (most junior) among qualified', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('MIN',  2, 100_000_000_000),
      auth('RECT', 3, 10_000_000_000),
    ]);
    const a = await resolveAuthorityForValue(5_000_000_000, repo);
    expect(a?.code).toBe('RECT');
  });
  it('escalates to VP when value exceeds RECT limit', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('VP',   2, 50_000_000_000),
      auth('RECT', 3, 10_000_000_000),
    ]);
    const a = await resolveAuthorityForValue(15_000_000_000, repo);
    expect(a?.code).toBe('VP');
  });
  it('escalates to PM for maximum value', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('VP',   2, 50_000_000_000),
      auth('RECT', 3, 10_000_000_000),
    ]);
    const a = await resolveAuthorityForValue(100_000_000_000, repo);
    expect(a?.code).toBe('PM');
  });
});

// APR-A-03
describe('resolveAuthorityForValue — inactive authorities excluded', () => {
  it('skips inactive authority', async () => {
    const repo = makeRepo([
      auth('RECT', 3, 10_000_000_000, false),
      auth('VP',   2, 50_000_000_000, true),
    ]);
    const a = await resolveAuthorityForValue(5_000_000_000, repo);
    expect(a?.code).toBe('VP');
  });
  it('returns null when only inactive authorities qualify', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000, false)]);
    expect(await resolveAuthorityForValue(1_000_000, repo)).toBeNull();
  });
  it('returns active authority even if inactive one with same level exists', async () => {
    const repo = makeRepo([
      auth('RECT-old', 3, 10_000_000_000, false),
      auth('RECT-new', 3, 10_000_000_000, true),
    ]);
    const a = await resolveAuthorityForValue(5_000_000_000, repo);
    expect(a?.code).toBe('RECT-new');
  });
});

// APR-A-04
describe('getAuthorityChain', () => {
  it('returns all qualifying authorities sorted by level asc (most senior first)', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('VP',   2, 50_000_000_000),
      auth('RECT', 3, 10_000_000_000),
    ]);
    const chain = await getAuthorityChain(5_000_000_000, repo);
    expect(chain[0]?.code).toBe('PM');
    expect(chain[chain.length - 1]?.code).toBe('RECT');
  });
  it('excludes authorities whose maxValue is below estimatedValue', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('RECT', 3, 10_000_000_000),
    ]);
    const chain = await getAuthorityChain(15_000_000_000, repo);
    expect(chain.some(a => a.code === 'RECT')).toBe(false);
    expect(chain.some(a => a.code === 'PM')).toBe(true);
  });
  it('returns empty array when no authority qualifies', async () => {
    const repo = makeRepo([auth('RECT', 3, 1_000)]);
    expect(await getAuthorityChain(1_000_000_000, repo)).toHaveLength(0);
  });
});

// APR-A-05
describe('validateAuthorityPermission — valid', () => {
  it('does not throw when authority can cover the value', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000)]);
    await expect(validateAuthorityPermission('RECT', 5_000_000_000, repo)).resolves.not.toThrow();
  });
  it('does not throw at exact maxValue boundary', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000)]);
    await expect(validateAuthorityPermission('RECT', 10_000_000_000, repo)).resolves.not.toThrow();
  });
  it('resolves for value=1 with large-limit authority', async () => {
    const repo = makeRepo([auth('PM', 1, 999_999_999_999)]);
    await expect(validateAuthorityPermission('PM', 1, repo)).resolves.not.toThrow();
  });
});

// APR-A-06
describe('validateAuthorityPermission — invalid', () => {
  it('throws AUTHORITY_INSUFFICIENT when value exceeds limit', async () => {
    const repo = makeRepo([auth('RECT', 3, 1_000_000)]);
    const err = await validateAuthorityPermission('RECT', 5_000_000_000, repo).catch(e => e);
    expect((err as ApprovalError).code).toBe('AUTHORITY_INSUFFICIENT');
  });
  it('throws UNKNOWN_AUTHORITY for unknown code', async () => {
    const repo = makeRepo([]);
    const err = await validateAuthorityPermission('NOBODY', 1_000, repo).catch(e => e);
    expect((err as ApprovalError).code).toBe('UNKNOWN_AUTHORITY');
  });
  it('throws UNKNOWN_AUTHORITY for inactive authority', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000, false)]);
    const err = await validateAuthorityPermission('RECT', 1_000_000, repo).catch(e => e);
    expect((err as ApprovalError).code).toBe('UNKNOWN_AUTHORITY');
  });
});

// APR-A-07
describe('getAuthorityChain — length', () => {
  it('chain length equals number of qualifying active authorities', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('VP',   2, 50_000_000_000),
      auth('RECT', 3, 10_000_000_000),
    ]);
    expect(await getAuthorityChain(1_000_000_000, repo)).toHaveLength(3);
  });
  it('chain is 1 when only the most senior qualifies', async () => {
    const repo = makeRepo([
      auth('PM',   1, 999_999_999_999),
      auth('RECT', 3, 10_000_000_000),
    ]);
    expect(await getAuthorityChain(50_000_000_000, repo)).toHaveLength(1);
  });
  it('chain is empty when value exceeds all maxValues', async () => {
    const repo = makeRepo([auth('PM', 1, 1_000_000_000)]);
    expect(await getAuthorityChain(9_999_999_999_999, repo)).toHaveLength(0);
  });
});

// APR-A-08
describe('resolveAuthorityForValue — exact boundary', () => {
  it('qualifies authority when estimatedValue equals maxValue exactly', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000)]);
    const a = await resolveAuthorityForValue(10_000_000_000, repo);
    expect(a?.code).toBe('RECT');
  });
  it('does NOT qualify when estimatedValue is 1 above maxValue', async () => {
    const repo = makeRepo([auth('RECT', 3, 10_000_000_000), auth('PM', 1, 999_999_999_999)]);
    const a = await resolveAuthorityForValue(10_000_000_001, repo);
    expect(a?.code).toBe('PM');
  });
  it('does not include archived authorities', async () => {
    const archived = { ...auth('RECT', 3, 10_000_000_000), isArchived: true };
    const repo = makeRepo([archived]);
    expect(await resolveAuthorityForValue(1_000, repo)).toBeNull();
  });
});

// APR-A-09
describe('validateAuthorityPermission — error message', () => {
  it('error message contains authority code', async () => {
    const repo = makeRepo([auth('RECT', 3, 1_000_000)]);
    const err = await validateAuthorityPermission('RECT', 5_000_000_000, repo).catch(e => e);
    expect((err as ApprovalError).message).toContain('RECT');
  });
  it('error message contains estimated value', async () => {
    const repo = makeRepo([auth('RECT', 3, 1_000_000)]);
    const err = await validateAuthorityPermission('RECT', 5_000_000_000, repo).catch(e => e);
    expect((err as ApprovalError).message).toContain('5000000000');
  });
  it('UNKNOWN_AUTHORITY error includes the unknown code', async () => {
    const repo = makeRepo([]);
    const err = await validateAuthorityPermission('GHOST', 1, repo).catch(e => e);
    expect((err as ApprovalError).message).toContain('GHOST');
  });
});

// APR-A-10
describe('getAuthorityChain — ordering', () => {
  it('first element has lowest level number (most senior)', async () => {
    const repo = makeRepo([
      auth('RECT', 3, 50_000_000_000),
      auth('VP',   2, 50_000_000_000),
      auth('PM',   1, 50_000_000_000),
    ]);
    const chain = await getAuthorityChain(1_000_000, repo);
    expect(chain[0]?.level).toBe(1);
  });
  it('last element has highest level number (most junior)', async () => {
    const repo = makeRepo([
      auth('PM',   1, 50_000_000_000),
      auth('VP',   2, 50_000_000_000),
      auth('RECT', 3, 50_000_000_000),
    ]);
    const chain = await getAuthorityChain(1_000_000, repo);
    expect(chain[chain.length - 1]?.level).toBe(3);
  });
  it('single item chain: first == last', async () => {
    const repo = makeRepo([auth('RECTOR', 3, 10_000_000_000)]);
    const chain = await getAuthorityChain(1_000_000, repo);
    expect(chain[0]).toEqual(chain[chain.length - 1]);
  });
});

// APR-A-11
describe('resolveAuthorityForValue — multiple same-level', () => {
  it('returns one of the equal-level authorities', async () => {
    const repo = makeRepo([
      auth('A1', 3, 10_000_000_000),
      auth('A2', 3, 10_000_000_000),
    ]);
    const a = await resolveAuthorityForValue(5_000_000_000, repo);
    expect(['A1', 'A2']).toContain(a?.code);
  });
  it('returns null for zero value when no authorities are set', async () => {
    const repo = makeRepo([]);
    expect(await resolveAuthorityForValue(0, repo)).toBeNull();
  });
  it('returns the only authority in single-authority setup', async () => {
    const repo = makeRepo([auth('ONLY', 1, 999_999_999_999)]);
    const a = await resolveAuthorityForValue(1_000_000, repo);
    expect(a?.code).toBe('ONLY');
  });
});

// APR-A-12
describe('validateAuthorityPermission — is async', () => {
  it('returns a Promise', async () => {
    const repo = makeRepo([auth('AUTH', 3, 10_000_000_000)]);
    const result = validateAuthorityPermission('AUTH', 1_000_000, repo);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
  it('resolves without value on success', async () => {
    const repo = makeRepo([auth('AUTH', 3, 10_000_000_000)]);
    expect(await validateAuthorityPermission('AUTH', 1_000_000, repo)).toBeUndefined();
  });
  it('rejects with ApprovalError on failure', async () => {
    const repo = makeRepo([auth('AUTH', 3, 1_000)]);
    await expect(validateAuthorityPermission('AUTH', 1_000_000, repo)).rejects.toBeInstanceOf(ApprovalError);
  });
});

// APR-A-13
describe('getAuthorityChain — excludes inactive', () => {
  it('only returns active non-archived authorities', async () => {
    const repo = makeRepo([
      auth('ACTIVE',   3, 10_000_000_000, true),
      auth('INACTIVE', 2, 10_000_000_000, false),
    ]);
    const chain = await getAuthorityChain(1_000_000, repo);
    expect(chain).toHaveLength(1);
    expect(chain[0]?.code).toBe('ACTIVE');
  });
  it('returns empty chain when all are inactive', async () => {
    const repo = makeRepo([
      auth('A1', 1, 99_999, false),
      auth('A2', 2, 99_999, false),
    ]);
    expect(await getAuthorityChain(1_000, repo)).toHaveLength(0);
  });
  it('handles mix of active, inactive, and non-qualifying', async () => {
    const repo = makeRepo([
      auth('PM',     1, 999_999_999, true),
      auth('RECTOR', 3, 5_000_000, true),
      auth('VP',     2, 50_000_000, false),
    ]);
    const chain = await getAuthorityChain(10_000_000, repo);
    expect(chain).toHaveLength(1);
    expect(chain[0]?.code).toBe('PM');
  });
});
