import { describe, it, expect, beforeEach } from 'vitest';
import {
  createContract, signContract, activateContract,
  suspendContract, resumeContract, completeContract, terminateContract,
} from '../contract/contractService';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import { ContractError } from '../contract/contractTypes';
import type { CreateContractParams } from '../contract/contractTypes';

// CTR-S-01
describe('createContract — happy path', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates a DRAFT contract', async () => {
    const c = await createContract(params(), repos);
    expect(c.status).toBe('DRAFT');
  });
  it('contractNumber is stored', async () => {
    const c = await createContract(params(), repos);
    expect(c.contractNumber).toBe('HĐ/DTMS/2026/0001');
  });
  it('records CREATED history event', async () => {
    const c = await createContract(params(), repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'CREATED')).toBe(true);
  });
});

// CTR-S-02
describe('createContract — validation', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('throws for duplicate contractNumber', async () => {
    await createContract(params(), repos);
    await expect(createContract(params(), repos)).rejects.toThrow(ContractError);
  });
  it('error is DUPLICATE_NUMBER for duplicate', async () => {
    await createContract(params(), repos);
    try { await createContract(params(), repos); }
    catch (e) { expect((e as ContractError).code).toBe('DUPLICATE_NUMBER'); }
  });
  it('throws for zero contractValue', async () => {
    await expect(createContract({ ...params(), contractValue: 0 }, repos)).rejects.toThrow(ContractError);
  });
});

// CTR-S-03
describe('createContract — optional fields', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('defaults currency to VND', async () => {
    const c = await createContract(params(), repos);
    expect(c.currency).toBe('VND');
  });
  it('stores approvalId when provided', async () => {
    const c = await createContract({ ...params(), approvalId: 'APR-1' }, repos);
    expect(c.approvalId).toBe('APR-1');
  });
  it('stores performanceSecurityAmount', async () => {
    const c = await createContract({ ...params(), performanceSecurityAmount: 50_000_000 }, repos);
    expect(c.performanceSecurityAmount).toBe(50_000_000);
  });
});

// CTR-S-04
describe('signContract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('transitions DRAFT → SIGNED', async () => {
    const c = await createContract(params(), repos);
    const signed = await signContract(c.id, 'DIR-01', '2026-07-01', repos);
    expect(signed.status).toBe('SIGNED');
  });
  it('stores signedDate', async () => {
    const c = await createContract(params(), repos);
    const signed = await signContract(c.id, 'DIR-01', '2026-07-01', repos);
    expect(signed.signedDate).toBe('2026-07-01');
  });
  it('records SIGNED history event', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR-01', '2026-07-01', repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'SIGNED')).toBe(true);
  });
});

// CTR-S-05
describe('signContract — status guard', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('throws for unknown contractId', async () => {
    await expect(signContract('NONE', 'DIR', '2026-07-01', repos)).rejects.toThrow(ContractError);
  });
  it('throws when already SIGNED', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await expect(signContract(c.id, 'DIR', '2026-07-02', repos)).rejects.toThrow(ContractError);
  });
  it('throws when EFFECTIVE', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await activateContract(c.id, 'DIR', '2026-07-15', repos);
    await expect(signContract(c.id, 'DIR', '2026-08-01', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-S-06
describe('activateContract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('transitions SIGNED → EFFECTIVE', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    const active = await activateContract(c.id, 'DIR', '2026-07-15', repos);
    expect(active.status).toBe('EFFECTIVE');
  });
  it('stores effectiveDate', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    const active = await activateContract(c.id, 'DIR', '2026-07-15', repos);
    expect(active.effectiveDate).toBe('2026-07-15');
  });
  it('records ACTIVATED event', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await activateContract(c.id, 'DIR', '2026-07-15', repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'ACTIVATED')).toBe(true);
  });
});

// CTR-S-07
describe('suspendContract + resumeContract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('transitions EFFECTIVE → SUSPENDED', async () => {
    const c = await makeEffective(repos);
    const suspended = await suspendContract(c.id, 'DIR', 'Force majeure', repos);
    expect(suspended.status).toBe('SUSPENDED');
  });
  it('transitions SUSPENDED → EFFECTIVE', async () => {
    const c = await makeEffective(repos);
    await suspendContract(c.id, 'DIR', 'Force majeure', repos);
    const resumed = await resumeContract(c.id, 'DIR', 'Issue resolved', repos);
    expect(resumed.status).toBe('EFFECTIVE');
  });
  it('suspendContract records SUSPENDED event', async () => {
    const c = await makeEffective(repos);
    await suspendContract(c.id, 'DIR', 'reason', repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'SUSPENDED')).toBe(true);
  });
});

// CTR-S-08
describe('completeContract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('transitions EFFECTIVE → COMPLETED', async () => {
    const c = await makeEffective(repos);
    const completed = await completeContract(c.id, 'DIR', repos);
    expect(completed.status).toBe('COMPLETED');
  });
  it('records COMPLETED event', async () => {
    const c = await makeEffective(repos);
    await completeContract(c.id, 'DIR', repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'COMPLETED')).toBe(true);
  });
  it('throws when already COMPLETED', async () => {
    const c = await makeEffective(repos);
    await completeContract(c.id, 'DIR', repos);
    await expect(completeContract(c.id, 'DIR', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-S-09
describe('terminateContract', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('terminates a DRAFT contract', async () => {
    const c = await createContract(params(), repos);
    const t = await terminateContract(c.id, 'DIR', 'Wrong package', repos);
    expect(t.status).toBe('TERMINATED');
  });
  it('terminates an EFFECTIVE contract', async () => {
    const c = await makeEffective(repos);
    const t = await terminateContract(c.id, 'DIR', 'Contractor breach', repos);
    expect(t.status).toBe('TERMINATED');
  });
  it('records TERMINATED event with reason in notes', async () => {
    const c = await createContract(params(), repos);
    await terminateContract(c.id, 'DIR', 'Wrong award', repos);
    const events = await repos.history.findByContractId(c.id);
    const termEvent = events.find(e => e.action === 'TERMINATED');
    expect(termEvent?.notes).toBe('Wrong award');
  });
});

// CTR-S-10
describe('terminateContract — cannot terminate COMPLETED/TERMINATED', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('throws for COMPLETED contract', async () => {
    const c = await makeEffective(repos);
    await completeContract(c.id, 'DIR', repos);
    await expect(terminateContract(c.id, 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
  it('throws for already TERMINATED', async () => {
    const c = await createContract(params(), repos);
    await terminateContract(c.id, 'DIR', 'reason', repos);
    await expect(terminateContract(c.id, 'DIR', 'again', repos)).rejects.toThrow(ContractError);
  });
  it('throws for unknown id', async () => {
    await expect(terminateContract('NONE', 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
});

// CTR-S-11
describe('full lifecycle DRAFT → SIGNED → EFFECTIVE → COMPLETED', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('goes through full lifecycle without errors', async () => {
    const c   = await createContract(params(), repos);
    const s   = await signContract(c.id, 'DIR', '2026-07-01', repos);
    const a   = await activateContract(s.id, 'DIR', '2026-07-15', repos);
    const done = await completeContract(a.id, 'DIR', repos);
    expect(done.status).toBe('COMPLETED');
  });
  it('history has 4 events for full lifecycle', async () => {
    const c = await createContract(params(), repos);
    await signContract(c.id, 'DIR', '2026-07-01', repos);
    await activateContract(c.id, 'DIR', '2026-07-15', repos);
    await completeContract(c.id, 'DIR', repos);
    expect((await repos.history.findByContractId(c.id))).toHaveLength(4);
  });
  it('suspend-resume round trip keeps contract EFFECTIVE', async () => {
    const c = await makeEffective(repos);
    await suspendContract(c.id, 'DIR', 'reason', repos);
    const resumed = await resumeContract(c.id, 'DIR', 'resolved', repos);
    expect(resumed.status).toBe('EFFECTIVE');
  });
});

// CTR-S-12
describe('createContract — winnerName', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('stores winnerCode', async () => {
    const c = await createContract(params(), repos);
    expect(c.winnerCode).toBe('VND-01');
  });
  it('stores winnerName', async () => {
    const c = await createContract({ ...params(), winnerName: 'Công ty TNHH A' }, repos);
    expect(c.winnerName).toBe('Công ty TNHH A');
  });
  it('stores packageId', async () => {
    const c = await createContract(params(), repos);
    expect(c.packageId).toBe('PKG-001');
  });
});

// CTR-S-13
describe('resumeContract — status guard', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('throws when EFFECTIVE (not suspended)', async () => {
    const c = await makeEffective(repos);
    await expect(resumeContract(c.id, 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
  it('throws for unknown contractId', async () => {
    await expect(resumeContract('NONE', 'DIR', 'reason', repos)).rejects.toThrow(ContractError);
  });
  it('records RESUMED event', async () => {
    const c = await makeEffective(repos);
    await suspendContract(c.id, 'DIR', 'Force majeure', repos);
    await resumeContract(c.id, 'DIR', 'Resolved', repos);
    const events = await repos.history.findByContractId(c.id);
    expect(events.some(e => e.action === 'RESUMED')).toBe(true);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(override: Partial<CreateContractParams> = {}): CreateContractParams {
  return {
    contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM',
    packageId: 'PKG-001', winnerCode: 'VND-01', winnerName: 'Công ty A',
    contractValue: 5_000_000_000, ...override,
  };
}

async function makeEffective(repos: ContractRepositories) {
  const c = await createContract(params(), repos);
  await signContract(c.id, 'DIR', '2026-07-01', repos);
  return activateContract(c.id, 'DIR', '2026-07-15', repos);
}
