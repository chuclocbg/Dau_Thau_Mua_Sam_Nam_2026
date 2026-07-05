import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAcceptanceFromContract,
  buildAcceptanceSummary,
  validateContractForAcceptance,
} from '../acceptance/acceptanceIntegration';
import {
  createAcceptanceRequest, addLegalBasis,
} from '../acceptance/acceptanceService';
import { formCommittee } from '../acceptance/acceptanceCommittee';
import { createSession, startSession, closeSession } from '../acceptance/acceptanceSession';
import { recordItem } from '../acceptance/acceptanceItem';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import { generateAcceptanceCode, generateMinuteCode } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import type { CreateAcceptanceParams, FormCommitteeParams } from '../acceptance/acceptanceTypes';
import type { Contract } from '../contract/contractTypes';

// ACR-INT-01
describe('buildAcceptanceFromContract — basic', () => {
  it('builds CreateAcceptanceParams from contract', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP-01', 'BLD-01');
    expect(result.requestCode).toBe('NT/001');
  });
  it('sets contractId from contract id', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP-01', 'BLD-01');
    expect(result.contractId).toBe('CTR-TEST');
  });
  it('sets packageId from contract', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP-01', 'BLD-01');
    expect(result.packageId).toBe('PKG-TEST');
  });
});

// ACR-INT-02
describe('buildAcceptanceFromContract — defaults', () => {
  it('defaults acceptanceType to FINAL', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP', 'BLD');
    expect(result.acceptanceType).toBe('FINAL');
  });
  it('sets description with contract number', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP', 'BLD');
    expect(result.description).toContain('HĐ/DTMS/2026/0001');
  });
  it('extraLegalBasis is passed through', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP', 'BLD', ['QĐ 99/2026']);
    expect(result.legalBasis).toContain('QĐ 99/2026');
  });
});

// ACR-INT-03
describe('buildAcceptanceFromContract — workflowId', () => {
  it('sets workflowId from contract', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP', 'BLD');
    expect(result.workflowId).toBe('WF-TEST');
  });
  it('sets requestedBy', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'INSPECTOR-01', 'BLD');
    expect(result.requestedBy).toBe('INSPECTOR-01');
  });
  it('sets department', () => {
    const result = buildAcceptanceFromContract(contract(), 'NT/001', 'EMP', 'TECH-DEPT');
    expect(result.department).toBe('TECH-DEPT');
  });
});

// ACR-INT-04
describe('buildAcceptanceSummary — null for missing', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('returns null for unknown requestId', async () => {
    expect(await buildAcceptanceSummary('NONE', repos)).toBeNull();
  });
  it('returns non-null for existing request', async () => {
    const r = await createAcceptanceRequest(rparams(), repos);
    expect(await buildAcceptanceSummary(r.id, repos)).not.toBeNull();
  });
  it('summary has requestCode', async () => {
    const r = await createAcceptanceRequest(rparams(), repos);
    const s = await buildAcceptanceSummary(r.id, repos);
    expect(s?.requestCode).toBe('NT/FINAL/2026/0001');
  });
});

// ACR-INT-05
describe('buildAcceptanceSummary — counts', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('sessionCount is 0 initially', async () => {
    const s = await buildAcceptanceSummary(requestId, repos);
    expect(s?.sessionCount).toBe(0);
  });
  it('memberCount is 0 before committee', async () => {
    const s = await buildAcceptanceSummary(requestId, repos);
    expect(s?.memberCount).toBe(0);
  });
  it('legalBasisCount reflects default 5 laws', async () => {
    const s = await buildAcceptanceSummary(requestId, repos);
    expect(s?.legalBasisCount).toBeGreaterThanOrEqual(5);
  });
});

// ACR-INT-06
describe('buildAcceptanceSummary — after operations', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    await formCommittee(requestId, cparams(), 'DIR', repos);
  });

  it('sessionCount increases after session creation', async () => {
    const s = await createSession(requestId, { sessionType: 'FINAL', scheduledDate: '2026-08-01' }, 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.sessionCount).toBe(1);
  });
  it('completedSessionCount after close', async () => {
    const s = await createSession(requestId, { sessionType: 'FINAL', scheduledDate: '2026-08-01' }, 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.completedSessionCount).toBe(1);
  });
  it('attachmentCount is 0 initially', async () => {
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.attachmentCount).toBe(0);
  });
});

// ACR-INT-07
describe('buildAcceptanceSummary — items', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    await formCommittee(requestId, cparams(), 'DIR', repos);
    const s = await createSession(requestId, { sessionType: 'FINAL', scheduledDate: '2026-08-01' }, 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    sessionId = s.id;
  });

  it('itemCount reflects recorded items', async () => {
    await recordItem(sessionId, requestId, { itemCode: 'I1', description: 'D', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }, 'U', repos);
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.itemCount).toBe(1);
  });
  it('acceptedItemCount counts ACCEPTED items', async () => {
    await recordItem(sessionId, requestId, { itemCode: 'I1', description: 'D', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }, 'U', repos);
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.acceptedItemCount).toBe(1);
  });
  it('rejectedItemCount counts REJECTED items', async () => {
    await recordItem(sessionId, requestId, { itemCode: 'I1', description: 'D', contractedQuantity: 10, acceptedQuantity: 0, rejectedQuantity: 10 }, 'U', repos);
    const summary = await buildAcceptanceSummary(requestId, repos);
    expect(summary?.rejectedItemCount).toBe(1);
  });
});

// ACR-INT-08
describe('validateContractForAcceptance', () => {
  it('returns contract when EFFECTIVE', async () => {
    const fakeRepo = { findById: async () => contract() };
    const result = await validateContractForAcceptance('CTR-TEST', fakeRepo);
    expect(result.id).toBe('CTR-TEST');
  });
  it('throws when contract not found', async () => {
    const fakeRepo = { findById: async () => null };
    await expect(validateContractForAcceptance('NONE', fakeRepo)).rejects.toThrow();
  });
  it('throws when contract is DRAFT', async () => {
    const fakeRepo = { findById: async () => ({ ...contract(), status: 'DRAFT' as const }) };
    await expect(validateContractForAcceptance('CTR-TEST', fakeRepo)).rejects.toThrow();
  });
});

// ACR-INT-09
describe('validateContractForAcceptance — COMPLETED', () => {
  it('allows COMPLETED contract', async () => {
    const fakeRepo = { findById: async () => ({ ...contract(), status: 'COMPLETED' as const }) };
    const result = await validateContractForAcceptance('CTR-TEST', fakeRepo);
    expect(result.status).toBe('COMPLETED');
  });
  it('throws when SIGNED', async () => {
    const fakeRepo = { findById: async () => ({ ...contract(), status: 'SIGNED' as const }) };
    await expect(validateContractForAcceptance('CTR-TEST', fakeRepo)).rejects.toThrow();
  });
  it('error message includes contractId', async () => {
    const fakeRepo = { findById: async () => null };
    try { await validateContractForAcceptance('MISSING-ID', fakeRepo); }
    catch (e) { expect((e as Error).message).toContain('MISSING-ID'); }
  });
});

// ACR-INT-10
describe('generateAcceptanceCode', () => {
  it('generates FINAL code', () => {
    expect(generateAcceptanceCode('FINAL', 2026, 1)).toBe('NT/NTH/2026/0001');
  });
  it('generates PARTIAL code', () => {
    expect(generateAcceptanceCode('PARTIAL', 2026, 5)).toBe('NT/NT/2026/0005');
  });
  it('generates WARRANTY code', () => {
    expect(generateAcceptanceCode('WARRANTY', 2026, 99)).toBe('NT/NTB/2026/0099');
  });
});

// ACR-INT-11
describe('generateMinuteCode', () => {
  it('generates minute code from acceptance code', () => {
    expect(generateMinuteCode('NT/NTH/2026/0001', 1)).toBe('BB/NTH/2026/0001/01');
  });
  it('pads session number to 2 digits', () => {
    expect(generateMinuteCode('NT/NTH/2026/0001', 3)).toBe('BB/NTH/2026/0001/03');
  });
  it('double-digit session number is not padded', () => {
    expect(generateMinuteCode('NT/NT/2026/0002', 12)).toBe('BB/NT/2026/0002/12');
  });
});

// ACR-INT-12
describe('buildAcceptanceSummary — legalBasisCount after addLegalBasis', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('legalBasisCount increases after adding new basis', async () => {
    const before = (await buildAcceptanceSummary(requestId, repos))!.legalBasisCount;
    await addLegalBasis(requestId, ['QĐ 99/BXD-2026'], 'U', repos);
    const after = (await buildAcceptanceSummary(requestId, repos))!.legalBasisCount;
    expect(after).toBe(before + 1);
  });
  it('deduplication does not increase count for existing basis', async () => {
    const before = (await buildAcceptanceSummary(requestId, repos))!.legalBasisCount;
    await addLegalBasis(requestId, ['Luật 22/2023/QH15'], 'U', repos);
    const after = (await buildAcceptanceSummary(requestId, repos))!.legalBasisCount;
    expect(after).toBe(before);
  });
  it('summary status reflects request status', async () => {
    const s = await buildAcceptanceSummary(requestId, repos);
    expect(s?.status).toBe('DRAFT');
  });
});

// ACR-INT-13
describe('full round-trip: buildFromContract → createRequest → buildSummary', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('builds params, creates request, and finds in summary', async () => {
    const p = buildAcceptanceFromContract(contract(), 'NT/FINAL/2026/0001', 'EMP', 'BLD');
    const r = await createAcceptanceRequest(p, repos);
    const s = await buildAcceptanceSummary(r.id, repos);
    expect(s?.contractId).toBe('CTR-TEST');
  });
  it('created request includes all 5 default laws', async () => {
    const p = buildAcceptanceFromContract(contract(), 'NT/FINAL/2026/0001', 'EMP', 'BLD');
    const r = await createAcceptanceRequest(p, repos);
    expect(r.legalBasis).toContain('NĐ 104/2026/NĐ-CP');
    expect(r.legalBasis).toContain('TT 13/2026/TT-BCT');
  });
  it('summary contractId matches', async () => {
    const p = buildAcceptanceFromContract(contract(), 'NT/FINAL/2026/0001', 'EMP', 'BLD');
    const r = await createAcceptanceRequest(p, repos);
    const s = await buildAcceptanceSummary(r.id, repos);
    expect(s?.contractId).toBe('CTR-TEST');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rparams(): CreateAcceptanceParams {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-001', requestedBy: 'EMP-01', department: 'BLD-01' };
}
function cparams(): FormCommitteeParams { return { committeeCode: 'HDNT-01', establishedBy: 'DIR-01' }; }
function contract(): Contract {
  return { id: 'CTR-TEST', contractNumber: 'HĐ/DTMS/2026/0001', contractType: 'LUMP_SUM', packageId: 'PKG-TEST', workflowId: 'WF-TEST', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 2_000_000_000, currency: 'VND', status: 'EFFECTIVE', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as unknown as Contract;
}
