import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildContractFromPackage,
  buildContractSummary,
  validatePackageForContract,
} from '../contract/contractIntegration';
import { createContract, signContract, activateContract } from '../contract/contractService';
import { addMilestone, markMilestoneReached } from '../contract/contractMilestone';
import { addGuarantee, returnGuarantee } from '../contract/contractGuarantee';
import { createAmendment, approveAmendment } from '../contract/contractAmendment';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import type { CreateContractParams } from '../contract/contractTypes';
import type { ProcurementPackage } from '../procurement/package/packageTypes';

// CTR-I-01
describe('buildContractFromPackage — basic', () => {
  it('builds CreateContractParams from package', () => {
    const result = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 1);
    expect(result.contractNumber).toBe('HĐ/DTMS/2026/0001');
  });
  it('sets contractValue from package estimatedValue', () => {
    const result = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 1);
    expect(result.contractValue).toBe(2_000_000_000);
  });
  it('sets packageId from package id', () => {
    const result = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 1);
    expect(result.packageId).toBe('PKG-TEST');
  });
});

// CTR-I-02
describe('buildContractFromPackage — sequence formatting', () => {
  it('pads sequence to 4 digits', () => {
    const r = buildContractFromPackage(pkg(), 'W', 'N', 2026, 3);
    expect(r.contractNumber).toBe('HĐ/DTMS/2026/0003');
  });
  it('handles sequence >= 1000 without padding', () => {
    const r = buildContractFromPackage(pkg(), 'W', 'N', 2026, 1000);
    expect(r.contractNumber).toBe('HĐ/DTMS/2026/1000');
  });
  it('sets winnerCode and winnerName', () => {
    const r = buildContractFromPackage(pkg(), 'CTY-01', 'Công ty XYZ', 2026, 5);
    expect(r.winnerCode).toBe('CTY-01');
    expect(r.winnerName).toBe('Công ty XYZ');
  });
});

// CTR-I-03
describe('buildContractFromPackage — currency', () => {
  it('defaults to VND', () => {
    const r = buildContractFromPackage(pkg(), 'W', 'N', 2026, 1);
    expect(r.currency).toBe('VND');
  });
  it('stores workflowId from package', () => {
    const r = buildContractFromPackage(pkg(), 'W', 'N', 2026, 1);
    expect(r.workflowId).toBe('WF-TEST');
  });
  it('contractType defaults to LUMP_SUM', () => {
    const r = buildContractFromPackage(pkg(), 'W', 'N', 2026, 1);
    expect(r.contractType).toBe('LUMP_SUM');
  });
});

// CTR-I-04
describe('buildContractSummary — null for missing contract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('returns null for unknown contractId', async () => {
    expect(await buildContractSummary('NONE', repos)).toBeNull();
  });
  it('returns non-null for existing contract', async () => {
    const c = await createContract(cparams(), repos);
    expect(await buildContractSummary(c.id, repos)).not.toBeNull();
  });
  it('summary has contractNumber', async () => {
    const c = await createContract(cparams(), repos);
    const s = await buildContractSummary(c.id, repos);
    expect(s?.contractNumber).toBe('HĐ/DTMS/2026/0001');
  });
});

// CTR-I-05
describe('buildContractSummary — counts', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('milestoneCount is 0 initially', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.milestoneCount).toBe(0);
  });
  it('milestoneCount reflects added milestones', async () => {
    await addMilestone(contractId, { milestoneCode: 'M1', title: 'D', plannedDate: '2026-09-01', plannedValue: 100 }, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.milestoneCount).toBe(1);
  });
  it('guaranteeCount reflects added guarantees', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.guaranteeCount).toBe(1);
  });
});

// CTR-I-06
describe('buildContractSummary — active counts', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('activeGuaranteeCount is 0 after return', async () => {
    const g = await addGuarantee(contractId, gparams(), 'U', repos);
    await returnGuarantee(g.id, 'U', '2026-12-01', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.activeGuaranteeCount).toBe(0);
  });
  it('activeGuaranteeCount counts only ACTIVE', async () => {
    await addGuarantee(contractId, gparams(), 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.activeGuaranteeCount).toBe(1);
  });
  it('reachedMilestoneCount counts REACHED milestones', async () => {
    const m = await addMilestone(contractId, { milestoneCode: 'M1', title: 'D', plannedDate: '2026-09-01', plannedValue: 100 }, 'U', repos);
    await markMilestoneReached(m.id, '2026-09-01', 100, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.reachedMilestoneCount).toBe(1);
  });
});

// CTR-I-07
describe('buildContractSummary — amendmentCount', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await activateContract(c.id, 'DIR', '2026-07-15', repos);
    contractId = c.id;
  });

  it('amendmentCount is 0 initially', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.amendmentCount).toBe(0);
  });
  it('amendmentCount reflects created amendments', async () => {
    await createAmendment(contractId, { reason: 'Ext', changedFields: ['expiryDate'] }, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.amendmentCount).toBe(1);
  });
  it('completionPercent is a number', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(typeof s?.completionPercent).toBe('number');
  });
});

// CTR-I-08
describe('buildContractSummary — status and value', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('status matches contract status', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.status).toBe('DRAFT');
  });
  it('contractValue matches', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.contractValue).toBe(5_000_000_000);
  });
  it('winnerCode and winnerName present', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.winnerCode).toBe('VND-01');
    expect(s?.winnerName).toBe('Công ty A');
  });
});

// CTR-I-09
describe('buildContractSummary — attachmentCount', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('attachmentCount is 0 initially', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.attachmentCount).toBe(0);
  });
  it('attachmentCount increases after add', async () => {
    await repos.attachments.create({ contractId, fileName: 'a.pdf', fileType: 'pdf', fileSize: 100, uploadedBy: 'U', documentType: 'CONTRACT_DOCUMENT' } as any);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.attachmentCount).toBe(1);
  });
  it('completionPercent is 0 with no milestones', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.completionPercent).toBe(0);
  });
});

// CTR-I-10
describe('validatePackageForContract', () => {
  it('returns package when found', async () => {
    const fakeRepo = { findById: async () => pkg() };
    const result = await validatePackageForContract('PKG-TEST', fakeRepo);
    expect(result.id).toBe('PKG-TEST');
  });
  it('throws when not found', async () => {
    const fakeRepo = { findById: async () => null };
    await expect(validatePackageForContract('NONE', fakeRepo)).rejects.toThrow();
  });
  it('error message includes packageId', async () => {
    const fakeRepo = { findById: async () => null };
    try { await validatePackageForContract('MISSING-ID', fakeRepo); }
    catch (e) { expect((e as Error).message).toContain('MISSING-ID'); }
  });
});

// CTR-I-11
describe('integration — createContract from package params', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('full round trip: build params → create → findById', async () => {
    const p = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 1);
    const c = await createContract(p, repos);
    const found = await repos.contracts.findById(c.id);
    expect(found?.contractNumber).toBe('HĐ/DTMS/2026/0001');
  });
  it('created contract has packageId from package', async () => {
    const p = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 1);
    const c = await createContract(p, repos);
    expect(c.packageId).toBe('PKG-TEST');
  });
  it('created contract has DRAFT status', async () => {
    const p = buildContractFromPackage(pkg(), 'VND-01', 'Công ty A', 2026, 2);
    const c = await createContract(p, repos);
    expect(c.status).toBe('DRAFT');
  });
});

// CTR-I-12
describe('buildContractSummary — after amendment approval changes value', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await activateContract(c.id, 'DIR', '2026-07-15', repos);
    contractId = c.id;
  });

  it('contractValue in summary is updated after approved amendment', async () => {
    const a = await createAmendment(contractId, { reason: 'Price', changedFields: ['contractValue'], valueChange: 500_000_000 }, 'U', repos);
    await approveAmendment(a.id, 'DIR', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.contractValue).toBe(5_500_000_000);
  });
  it('summary contractType matches', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.contractType).toBe('LUMP_SUM');
  });
  it('summary updates after status change', async () => {
    const s = await buildContractSummary(contractId, repos);
    expect(s?.status).toBe('EFFECTIVE');
  });
});

// CTR-I-13
describe('buildContractSummary — completionPercent computation', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    contractId = (await createContract(cparams(), repos)).id;
  });

  it('completionPercent is 50 when half milestones reached', async () => {
    const m1 = await addMilestone(contractId, { milestoneCode: 'M1', title: 'P1', plannedDate: '2026-07-01', plannedValue: 500_000_000 }, 'U', repos);
    await addMilestone(contractId, { milestoneCode: 'M2', title: 'P2', plannedDate: '2026-08-01', plannedValue: 500_000_000 }, 'U', repos);
    await markMilestoneReached(m1.id, '2026-07-01', 500_000_000, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.completionPercent).toBe(50);
  });
  it('completionPercent is 100 when all reached', async () => {
    const m = await addMilestone(contractId, { milestoneCode: 'M1', title: 'P1', plannedDate: '2026-07-01', plannedValue: 1_000_000_000 }, 'U', repos);
    await markMilestoneReached(m.id, '2026-07-01', 1_000_000_000, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.completionPercent).toBe(100);
  });
  it('completionPercent capped at 100', async () => {
    const m = await addMilestone(contractId, { milestoneCode: 'M1', title: 'P1', plannedDate: '2026-07-01', plannedValue: 100 }, 'U', repos);
    await markMilestoneReached(m.id, '2026-07-01', 999_999, 'U', repos);
    const s = await buildContractSummary(contractId, repos);
    expect(s?.completionPercent).toBeLessThanOrEqual(100);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cparams(): CreateContractParams {
  return { contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM', packageId: 'PKG-001', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 5_000_000_000 };
}
function pkg(): ProcurementPackage {
  return { id: 'PKG-TEST', estimatedValue: 2_000_000_000, workflowId: 'WF-TEST' } as unknown as ProcurementPackage;
}
function gparams() {
  return { guaranteeType: 'PERFORMANCE' as const, amount: 100_000_000, issuerCode: 'BANK-01', issuerName: 'VCB', guaranteeNumber: 'G-001', issuedDate: '2026-01-01', expiryDate: '2027-01-01' };
}
