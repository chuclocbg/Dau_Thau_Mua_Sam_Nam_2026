import { describe, it, expect, beforeEach } from 'vitest';
import {
  addGuarantee, returnGuarantee, forfeitGuarantee,
  getActiveGuarantees, getAllGuarantees,
} from '../contract/contractGuarantee';
import { createContract } from '../contract/contractService';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import { ContractError } from '../contract/contractTypes';
import type { AddGuaranteeParams, CreateContractParams } from '../contract/contractTypes';

// CTR-G-01
describe('addGuarantee — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('creates an ACTIVE guarantee', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.status).toBe('ACTIVE');
  });
  it('stores guaranteeType', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.guaranteeType).toBe('PERFORMANCE');
  });
  it('records GUARANTEE_ADDED history event', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'GUARANTEE_ADDED')).toBe(true);
  });
});

// CTR-G-02
describe('addGuarantee — validation', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('throws for unknown contractId', async () => {
    await expect(addGuarantee('NONE', gparams(), 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when amount is zero', async () => {
    await expect(addGuarantee(contractId, { ...gparams(), amount: 0 }, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when issuerCode is empty', async () => {
    await expect(addGuarantee(contractId, { ...gparams(), issuerCode: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-G-03
describe('addGuarantee — multiple types', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('stores ADVANCE_PAYMENT guarantee', async () => {
    const g = await addGuarantee(contractId, { ...gparams(), guaranteeType: 'ADVANCE_PAYMENT' }, 'U', repos);
    expect(g.guaranteeType).toBe('ADVANCE_PAYMENT');
  });
  it('stores WARRANTY guarantee', async () => {
    const g = await addGuarantee(contractId, { ...gparams(), guaranteeType: 'WARRANTY' }, 'U', repos);
    expect(g.guaranteeType).toBe('WARRANTY');
  });
  it('stores multiple guarantees for same contract', async () => {
    await addGuarantee(contractId, { ...gparams(), guaranteeType: 'PERFORMANCE' }, 'U', repos);
    await addGuarantee(contractId, { ...gparams(), guaranteeType: 'ADVANCE_PAYMENT', guaranteeNumber: 'G-002' }, 'U', repos);
    expect(await getAllGuarantees(contractId, repos)).toHaveLength(2);
  });
});

// CTR-G-04
describe('returnGuarantee — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('transitions ACTIVE → RETURNED', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    const r = await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    expect(r.status).toBe('RETURNED');
  });
  it('stores returnedDate', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    const r = await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    expect(r.returnedDate).toBe('2026-12-01');
  });
  it('records GUARANTEE_RETURNED event', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'GUARANTEE_RETURNED')).toBe(true);
  });
});

// CTR-G-05
describe('returnGuarantee — status guards', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('throws for unknown guaranteeId', async () => {
    await expect(returnGuarantee('NONE', 'U', '2026-12-01', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already RETURNED', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    await expect(returnGuarantee(g.id, 'U', '2026-12-02', repos)).rejects.toThrow(ContractError);
  });
  it('error code is INVALID_STATUS for re-return', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    try { await returnGuarantee(g.id, 'U', '2026-12-02', repos); }
    catch (e) { expect((e as ContractError).code).toBe('INVALID_STATUS'); }
  });
});

// CTR-G-06
describe('forfeitGuarantee — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('transitions ACTIVE → FORFEITED', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    const f = await forfeitGuarantee(g.id, 'U', 'Contractor breach', repos);
    expect(f.status).toBe('FORFEITED');
  });
  it('records GUARANTEE_FORFEITED event', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await forfeitGuarantee(g.id, 'U', 'breach', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'GUARANTEE_FORFEITED')).toBe(true);
  });
  it('throws when already RETURNED', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    await expect(forfeitGuarantee(g.id, 'U', 'breach', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-G-07
describe('forfeitGuarantee — guards', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('throws for unknown guaranteeId', async () => {
    await expect(forfeitGuarantee('NONE', 'U', 'reason', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already FORFEITED', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await forfeitGuarantee(g.id, 'U', 'reason', repos);
    await expect(forfeitGuarantee(g.id, 'U', 'again', repos)).rejects.toThrow(ContractError);
  });
  it('error code is NOT_FOUND for unknown id', async () => {
    try { await forfeitGuarantee('NONE', 'U', 'reason', repos); }
    catch (e) { expect((e as ContractError).code).toBe('NOT_FOUND'); }
  });
});

// CTR-G-08
describe('getActiveGuarantees', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('returns only ACTIVE guarantees', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    await addGuarantee(contractId, { ...gparams(), guaranteeNumber: 'G-002', guaranteeType: 'WARRANTY' }, 'U', repos);
    expect(await getActiveGuarantees(contractId, repos)).toHaveLength(1);
  });
  it('returns empty when no active', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await forfeitGuarantee(g.id, 'U', 'breach', repos);
    expect(await getActiveGuarantees(contractId, repos)).toHaveLength(0);
  });
  it('returns all when all active', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    await addGuarantee(contractId, { ...gparams(), guaranteeNumber: 'G-002', guaranteeType: 'WARRANTY' }, 'U', repos);
    expect(await getActiveGuarantees(contractId, repos)).toHaveLength(2);
  });
});

// CTR-G-09
describe('getAllGuarantees', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('includes RETURNED guarantees', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    expect(await getAllGuarantees(contractId, repos)).toHaveLength(1);
  });
  it('includes FORFEITED guarantees', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await forfeitGuarantee(g.id, 'U', 'breach', repos);
    expect(await getAllGuarantees(contractId, repos)).toHaveLength(1);
  });
  it('returns empty for unknown contractId', async () => {
    expect(await getAllGuarantees('NONE', repos)).toHaveLength(0);
  });
});

// CTR-G-10
describe('guarantee data fields', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('stores amount', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.amount).toBe(100_000_000);
  });
  it('stores guaranteeNumber', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.guaranteeNumber).toBe('G-001');
  });
  it('stores expiryDate', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.expiryDate).toBe('2027-01-01');
  });
});

// CTR-G-11
describe('findByType repo method', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('finds guarantee by type', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    const found = await repos.guarantees.findByType(contractId, 'PERFORMANCE');
    expect(found?.guaranteeType).toBe('PERFORMANCE');
  });
  it('returns null when type not found', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    expect(await repos.guarantees.findByType(contractId, 'WARRANTY')).toBeNull();
  });
  it('returns guarantee of correct contractId only', async () => {
    const c2 = await createContract({ ...cparams(), contractNumber: 'HĐ/002' }, repos);
    await addGuarantee(contractId, gparams(), 'U', repos);
    expect(await repos.guarantees.findByType(c2.id, 'PERFORMANCE')).toBeNull();
  });
});

// CTR-G-12
describe('addGuarantee — expiryDate validation', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('throws when expiryDate before issuedDate', async () => {
    const p = { ...gparams(), issuedDate: '2026-12-01', expiryDate: '2026-01-01' };
    await expect(addGuarantee(contractId, p, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when guaranteeNumber is empty', async () => {
    await expect(addGuarantee(contractId, { ...gparams(), guaranteeNumber: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when expiryDate is empty', async () => {
    await expect(addGuarantee(contractId, { ...gparams(), expiryDate: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-G-13
describe('guarantee — issuer fields', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('stores issuerCode', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.issuerCode).toBe('BANK-01');
  });
  it('stores issuerName', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    expect(g.issuerName).toBe('VietcomBank');
  });
  it('stores optional percent', async () => {
    const g = await addGuarantee(contractId, { ...gparams(), percent: 5 }, 'U', repos);
    expect(g.percent).toBe(5);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cparams(): CreateContractParams {
  return { contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM', packageId: 'PKG-001', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 5_000_000_000 };
}
function gparams(o: Partial<AddGuaranteeParams> = {}): AddGuaranteeParams {
  return { guaranteeType: 'PERFORMANCE', amount: 100_000_000, issuerCode: 'BANK-01', issuerName: 'VietcomBank', guaranteeNumber: 'G-001', issuedDate: '2026-01-01', expiryDate: '2027-01-01', ...o };
}
