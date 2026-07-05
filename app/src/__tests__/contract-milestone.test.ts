import { describe, it, expect, beforeEach } from 'vitest';
import {
  addMilestone, markMilestoneReached, markMilestoneDelayed,
  getMilestones, calculateCompletionPercent,
} from '../contract/contractMilestone';
import { createContract } from '../contract/contractService';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import { ContractError } from '../contract/contractTypes';
import type { AddMilestoneParams, CreateContractParams } from '../contract/contractTypes';

// CTR-M-01
describe('addMilestone — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('creates a PENDING milestone', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    expect(m.status).toBe('PENDING');
  });
  it('stores milestoneCode', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    expect(m.milestoneCode).toBe('MS-01');
  });
  it('records NOTE_ADDED history event', async () => {
    await addMilestone(contractId, milestone(), 'U', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'NOTE_ADDED')).toBe(true);
  });
});

// CTR-M-02
describe('addMilestone — validation', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('throws for unknown contractId', async () => {
    await expect(addMilestone('NONE', milestone(), 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when milestoneCode is empty', async () => {
    await expect(addMilestone(contractId, { ...milestone(), milestoneCode: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when plannedValue is zero', async () => {
    await expect(addMilestone(contractId, { ...milestone(), plannedValue: 0 }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-M-03
describe('addMilestone — multiple milestones', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('stores multiple milestones for same contract', async () => {
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-01' }, 'U', repos);
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-02' }, 'U', repos);
    expect(await getMilestones(contractId, repos)).toHaveLength(2);
  });
  it('milestone has contractId set', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    expect(m.contractId).toBe(contractId);
  });
  it('stores description when provided', async () => {
    const m = await addMilestone(contractId, { ...milestone(), description: 'Phase 1 delivery' }, 'U', repos);
    expect(m.description).toBe('Phase 1 delivery');
  });
});

// CTR-M-04
describe('markMilestoneReached — happy path', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('transitions PENDING → REACHED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    const r = await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'VER', repos);
    expect(r.status).toBe('REACHED');
  });
  it('stores actualDate', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    const r = await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'VER', repos);
    expect(r.actualDate).toBe('2026-06-30');
  });
  it('records MILESTONE_REACHED event', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'VER', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'MILESTONE_REACHED')).toBe(true);
  });
});

// CTR-M-05
describe('markMilestoneReached — edge cases', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('throws for unknown milestoneId', async () => {
    await expect(markMilestoneReached('NONE', '2026-06-30', 1, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already REACHED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'VER', repos);
    await expect(markMilestoneReached(m.id, '2026-07-01', 500_000_000, 'VER', repos)).rejects.toThrow(ContractError);
  });
  it('can reach a DELAYED milestone', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneDelayed(m.id, 'U', repos);
    const r = await markMilestoneReached(m.id, '2026-07-15', 500_000_000, 'VER', repos);
    expect(r.status).toBe('REACHED');
  });
});

// CTR-M-06
describe('markMilestoneDelayed', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('transitions PENDING → DELAYED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    const d = await markMilestoneDelayed(m.id, 'U', repos);
    expect(d.status).toBe('DELAYED');
  });
  it('records MILESTONE_DELAYED event', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneDelayed(m.id, 'U', repos);
    const events = await repos.history.findByContractId(contractId);
    expect(events.some(e => e.action === 'MILESTONE_DELAYED')).toBe(true);
  });
  it('throws for unknown milestoneId', async () => {
    await expect(markMilestoneDelayed('NONE', 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-M-07
describe('markMilestoneDelayed — cannot re-delay', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('throws when already DELAYED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneDelayed(m.id, 'U', repos);
    await expect(markMilestoneDelayed(m.id, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('throws when REACHED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 1, 'U', repos);
    await expect(markMilestoneDelayed(m.id, 'U', repos)).rejects.toThrow(ContractError);
  });
  it('error code is INVALID_STATUS', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneDelayed(m.id, 'U', repos);
    try { await markMilestoneDelayed(m.id, 'U', repos); }
    catch (e) { expect((e as ContractError).code).toBe('INVALID_STATUS'); }
  });
});

// CTR-M-08
describe('getMilestones', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('returns empty array initially', async () => {
    expect(await getMilestones(contractId, repos)).toHaveLength(0);
  });
  it('returns milestones sorted by plannedDate', async () => {
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-B', plannedDate: '2026-09-01' }, 'U', repos);
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-A', plannedDate: '2026-06-01' }, 'U', repos);
    const all = await getMilestones(contractId, repos);
    expect(all[0]?.milestoneCode).toBe('MS-A');
  });
  it('only returns milestones for that contract', async () => {
    const c2 = await createContract({ ...cparams(), contractNumber: 'HĐ/002' }, repos);
    await addMilestone(contractId, milestone(), 'U', repos);
    await addMilestone(c2.id, milestone(), 'U', repos);
    expect(await getMilestones(contractId, repos)).toHaveLength(1);
  });
});

// CTR-M-09
describe('calculateCompletionPercent — basic', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('returns 0 when no milestones', async () => {
    expect(await calculateCompletionPercent(contractId, repos)).toBe(0);
  });
  it('returns 0 when no milestones REACHED', async () => {
    await addMilestone(contractId, milestone(), 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBe(0);
  });
  it('returns 100 when all milestones REACHED', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBe(100);
  });
});

// CTR-M-10
describe('calculateCompletionPercent — partial', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('returns 50 for 1 of 2 equal milestones reached', async () => {
    const m1 = await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-1', plannedValue: 500_000_000 }, 'U', repos);
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'MS-2', plannedValue: 500_000_000 }, 'U', repos);
    await markMilestoneReached(m1.id, '2026-06-30', 500_000_000, 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBe(50);
  });
  it('capped at 100 even if actualValue > plannedValue', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 999_999_999_999, 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBeLessThanOrEqual(100);
  });
  it('uses actualValue when provided', async () => {
    const m = await addMilestone(contractId, { ...milestone(), plannedValue: 1_000_000_000 }, 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 800_000_000, 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBe(80);
  });
});

// CTR-M-11
describe('getMilestones — pending filter', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('findPendingByContractId returns 0 after reaching', async () => {
    const m = await addMilestone(contractId, milestone(), 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 500_000_000, 'U', repos);
    expect(await repos.milestones.findPendingByContractId(contractId)).toHaveLength(0);
  });
  it('findPendingByContractId includes PENDING only', async () => {
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'P1' }, 'U', repos);
    const m2 = await addMilestone(contractId, { ...milestone(), milestoneCode: 'P2' }, 'U', repos);
    await markMilestoneReached(m2.id, '2026-06-30', 500_000_000, 'U', repos);
    expect(await repos.milestones.findPendingByContractId(contractId)).toHaveLength(1);
  });
  it('returns 0 for unknown contractId', async () => {
    expect(await repos.milestones.findPendingByContractId('NONE')).toHaveLength(0);
  });
});

// CTR-M-12
describe('addMilestone — plannedDate', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('stores plannedDate', async () => {
    const m = await addMilestone(contractId, { ...milestone(), plannedDate: '2026-08-15' }, 'U', repos);
    expect(m.plannedDate).toBe('2026-08-15');
  });
  it('stores plannedValue', async () => {
    const m = await addMilestone(contractId, { ...milestone(), plannedValue: 750_000_000 }, 'U', repos);
    expect(m.plannedValue).toBe(750_000_000);
  });
  it('throws when title is empty', async () => {
    await expect(addMilestone(contractId, { ...milestone(), title: '' }, 'U', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-M-13
describe('calculateCompletionPercent — DELAYED milestones excluded', () => {
  let repos: ContractRepositories;
  let contractId: string;
  beforeEach(async () => {
    repos = createMemoryContractRepositories();
    const c = await createContract(cparams(), repos);
    contractId = c.id;
  });

  it('DELAYED milestone does not count toward completion', async () => {
    const m1 = await addMilestone(contractId, { ...milestone(), milestoneCode: 'M1', plannedValue: 500_000_000 }, 'U', repos);
    await addMilestone(contractId, { ...milestone(), milestoneCode: 'M2', plannedValue: 500_000_000 }, 'U', repos);
    await markMilestoneReached(m1.id, '2026-06-30', 500_000_000, 'U', repos);
    expect(await calculateCompletionPercent(contractId, repos)).toBe(50);
  });
  it('percent is integer (rounded)', async () => {
    const m = await addMilestone(contractId, { ...milestone(), plannedValue: 3_000_000 }, 'U', repos);
    await markMilestoneReached(m.id, '2026-06-30', 2_000_000, 'U', repos);
    expect(Number.isInteger(await calculateCompletionPercent(contractId, repos))).toBe(true);
  });
  it('percent is 0 when totalPlanned is 0', async () => {
    expect(await calculateCompletionPercent(contractId, repos)).toBe(0);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cparams(): CreateContractParams {
  return { contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM', packageId: 'PKG-001', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 5_000_000_000 };
}
function milestone(o: Partial<AddMilestoneParams> = {}): AddMilestoneParams {
  return { milestoneCode: 'MS-01', title: 'Giao hàng đợt 1', plannedDate: '2026-06-30', plannedValue: 500_000_000, ...o };
}
