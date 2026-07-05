import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAmendment, approveAmendment, rejectAmendment,
  getAmendments, countApprovedAmendments,
} from '../contract/contractAmendment';
import {
  createContract, signContract, activateContract,
} from '../contract/contractService';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import { ContractError } from '../contract/contractTypes';
import type { CreateContractParams, CreateAmendmentParams } from '../contract/contractTypes';

// CTR-A-01
describe('createAmendment — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('creates a DRAFT amendment', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.status).toBe('DRAFT');
  });
  it('amendmentNumber starts at 1', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.amendmentNumber).toBe(1);
  });
  it('records AMENDMENT_CREATED history event', async () => {
    await createAmendment(contractId, aparams(), 'U', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'AMENDMENT_CREATED')).toBe(true);
  });
});

// CTR-A-02
describe('createAmendment — auto-numbering', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('second amendment gets number 2', async () => {
    await createAmendment(contractId, aparams(), 'U', repos);
    const a2 = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a2.amendmentNumber).toBe(2);
  });
  it('amendmentCode includes sequence', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.amendmentCode).toContain('01');
  });
  it('amendmentCode includes contract base number', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.amendmentCode).toContain('DTMS/2026/0001');
  });
});

// CTR-A-03
describe('createAmendment — validation', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('throws for unknown contractId', async () => {
    await expect(createAmendment('NONE', aparams(), 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when reason is empty', async () => {
    await expect(createAmendment(contractId, { ...aparams(), reason: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when changedFields is empty', async () => {
    await expect(createAmendment(contractId, { ...aparams(), changedFields: [] }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-A-04
describe('createAmendment — status guard', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('throws for DRAFT contract', async () => {
    const c = await createContract(cparams(), repos);
    await expect(createAmendment(c.id, aparams(), 'U', repos)).rejects.toThrow(ContractError);
  });
  it('allows amendment on SIGNED contract', async () => {
    const c = await createContract(cparams(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    const a = await createAmendment(c.id, aparams(), 'U', repos);
    expect(a.status).toBe('DRAFT');
  });
  it('allows amendment on EFFECTIVE contract', async () => {
    const contractId = (await makeEffective(repos)).id;
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.status).toBe('DRAFT');
  });
});

// CTR-A-05
describe('approveAmendment — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('transitions DRAFT → APPROVED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    const approved = await approveAmendment(a.id, 'DIR', repos);
    expect(approved.status).toBe('APPROVED');
  });
  it('stores approvedBy', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    const approved = await approveAmendment(a.id, 'DIR-01', repos);
    expect(approved.approvedBy).toBe('DIR-01');
  });
  it('records AMENDMENT_APPROVED event', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'AMENDMENT_APPROVED')).toBe(true);
  });
});

// CTR-A-06
describe('approveAmendment — valueChange applies to contract', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('increases contract value by valueChange', async () => {
    const a = await createAmendment(contractId, { ...aparams(), valueChange: 500_000_000 }, 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    const updated = await repos.contracts.findById(contractId);
    expect(updated?.contractValue).toBe(5_500_000_000);
  });
  it('decreases contract value by negative valueChange', async () => {
    const a = await createAmendment(contractId, { ...aparams(), valueChange: -500_000_000 }, 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    const updated = await repos.contracts.findById(contractId);
    expect(updated?.contractValue).toBe(4_500_000_000);
  });
  it('no valueChange does not modify contract value', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    const updated = await repos.contracts.findById(contractId);
    expect(updated?.contractValue).toBe(5_000_000_000);
  });
});

// CTR-A-07
describe('approveAmendment — guards', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('throws for unknown amendmentId', async () => {
    await expect(approveAmendment('NONE', 'DIR', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already APPROVED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    await expect(approveAmendment(a.id, 'DIR', repos)).rejects.toThrow(ContractError);
  });
  it('throws when REJECTED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await rejectAmendment(a.id, 'DIR', 'not needed', repos);
    await expect(approveAmendment(a.id, 'DIR', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-A-08
describe('rejectAmendment', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('transitions DRAFT → REJECTED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    const r = await rejectAmendment(a.id, 'DIR', 'Not justified', repos);
    expect(r.status).toBe('REJECTED');
  });
  it('records AMENDMENT_REJECTED event', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await rejectAmendment(a.id, 'DIR', 'reason', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'AMENDMENT_REJECTED')).toBe(true);
  });
  it('throws when already APPROVED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    await expect(rejectAmendment(a.id, 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-A-09
describe('getAmendments', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('returns empty initially', async () => {
    expect(await getAmendments(contractId, repos)).toHaveLength(0);
  });
  it('returns all amendments sorted by number', async () => {
    await createAmendment(contractId, aparams(), 'U', repos);
    await createAmendment(contractId, aparams(), 'U', repos);
    const all = await getAmendments(contractId, repos);
    expect(all[0]?.amendmentNumber).toBe(1);
  });
  it('does not return amendments for other contracts', async () => {
    const c2 = await createContract({ ...cparams(), contractNumber: 'HĐ/002' }, repos);
    await signContract(c2.id, 'DIR', '2026-07-01', repos);
    await activateContract(c2.id, 'DIR', '2026-07-15', repos);
    await createAmendment(contractId, aparams(), 'U', repos);
    expect(await getAmendments(c2.id, repos)).toHaveLength(0);
  });
});

// CTR-A-10
describe('countApprovedAmendments', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('returns 0 when none approved', async () => {
    await createAmendment(contractId, aparams(), 'U', repos);
    expect(await countApprovedAmendments(contractId, repos)).toBe(0);
  });
  it('returns 1 after approval', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    expect(await countApprovedAmendments(contractId, repos)).toBe(1);
  });
  it('does not count rejected', async () => {
    const a1 = await createAmendment(contractId, aparams(), 'U', repos);
    const a2 = await createAmendment(contractId, aparams(), 'U', repos);
    await approveAmendment(a1.id, 'DIR', repos);
    await rejectAmendment(a2.id, 'DIR', 'not needed', repos);
    expect(await countApprovedAmendments(contractId, repos)).toBe(1);
  });
});

// CTR-A-11
describe('amendment optional fields', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('stores timeExtensionDays', async () => {
    const a = await createAmendment(contractId, { ...aparams(), timeExtensionDays: 30 }, 'U', repos);
    expect(a.timeExtensionDays).toBe(30);
  });
  it('stores notes', async () => {
    const a = await createAmendment(contractId, { ...aparams(), notes: 'Forced by weather' }, 'U', repos);
    expect(a.notes).toBe('Forced by weather');
  });
  it('throws when timeExtensionDays is negative', async () => {
    await expect(createAmendment(contractId, { ...aparams(), timeExtensionDays: -1 }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-A-12
describe('amendment changedFields stored', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('stores changedFields array', async () => {
    const a = await createAmendment(contractId, { ...aparams(), changedFields: ['contractValue', 'expiryDate'] }, 'U', repos);
    expect(a.changedFields).toContain('contractValue');
    expect(a.changedFields).toContain('expiryDate');
  });
  it('stores reason', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.reason).toBe('Price escalation');
  });
  it('amendment has contractId set', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    expect(a.contractId).toBe(contractId);
  });
});

// CTR-A-13
describe('rejectAmendment — guards', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await makeEffective(repos)).id;
  });

  it('throws for unknown amendmentId', async () => {
    await expect(rejectAmendment('NONE', 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already REJECTED', async () => {
    const a = await createAmendment(contractId, aparams(), 'U', repos);
    await rejectAmendment(a.id, 'DIR', 'reason', repos);
    await expect(rejectAmendment(a.id, 'DIR', 'again', repos)).rejects.toThrow(ContractError);
  });
  it('error code NOT_FOUND for unknown id', async () => {
    try { await rejectAmendment('NONE', 'DIR', 'reason', repos); }
    catch (e) { expect((e as ContractError).code).toBe('NOT_FOUND'); }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cparams(): CreateContractParams {
  return { contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM', packageId: 'PKG-001', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 5_000_000_000 };
}
function aparams(o: Partial<CreateAmendmentParams> = {}): CreateAmendmentParams {
  return { reason: 'Price escalation', changedFields: ['contractValue'], ...o };
}
async function makeEffective(repos: ContractRepositories) {
  const c = await createContract(cparams(), repos);
  await signContract(c.id, 'DIR', '2026-07-01', repos);
  return activateContract(c.id, 'DIR', '2026-07-15', repos);
}
