import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAcceptanceRequest, withdrawRequest,
  completeAcceptance, rejectAcceptance, addLegalBasis,
} from '../acceptance/acceptanceService';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import { AcceptanceError } from '../acceptance/acceptanceTypes';
import type { CreateAcceptanceParams } from '../acceptance/acceptanceTypes';

// ACR-S-01
describe('createAcceptanceRequest — happy path', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a DRAFT request', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.status).toBe('DRAFT');
  });
  it('requestCode is stored', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.requestCode).toBe('NT/FINAL/2026/0001');
  });
  it('records CREATED history event', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'CREATED')).toBe(true);
  });
});

// ACR-S-02
describe('createAcceptanceRequest — legalBasis', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('includes the 5 default legal bases', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.legalBasis).toContain('Luật 22/2023/QH15');
    expect(r.legalBasis).toContain('NĐ 214/2025/NĐ-CP');
  });
  it('merges extra legal bases from caller', async () => {
    const r = await createAcceptanceRequest({ ...params(), legalBasis: ['NĐ 99/2022/NĐ-CP'] }, repos);
    expect(r.legalBasis).toContain('NĐ 99/2022/NĐ-CP');
    expect(r.legalBasis).toContain('Luật 22/2023/QH15');
  });
  it('deduplicates legal bases', async () => {
    const r = await createAcceptanceRequest({ ...params(), legalBasis: ['Luật 22/2023/QH15'] }, repos);
    const count = r.legalBasis.filter(b => b === 'Luật 22/2023/QH15').length;
    expect(count).toBe(1);
  });
});

// ACR-S-03
describe('createAcceptanceRequest — validation', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('throws for duplicate requestCode', async () => {
    await createAcceptanceRequest(params(), repos);
    await expect(createAcceptanceRequest(params(), repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when requestCode is empty', async () => {
    await expect(createAcceptanceRequest({ ...params(), requestCode: '' }, repos)).rejects.toThrow(AcceptanceError);
  });
  it('error code is DUPLICATE_CODE for duplicate', async () => {
    await createAcceptanceRequest(params(), repos);
    try { await createAcceptanceRequest(params(), repos); }
    catch (e) { expect((e as AcceptanceError).code).toBe('DUPLICATE_CODE'); }
  });
});

// ACR-S-04
describe('createAcceptanceRequest — optional fields', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('stores contractId', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.contractId).toBe('C-001');
  });
  it('stores packageId when provided', async () => {
    const r = await createAcceptanceRequest({ ...params(), packageId: 'PKG-001' }, repos);
    expect(r.packageId).toBe('PKG-001');
  });
  it('stores department', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.department).toBe('BLD-01');
  });
});

// ACR-S-05
describe('withdrawRequest', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('transitions DRAFT → WITHDRAWN', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const w = await withdrawRequest(r.id, 'EMP', 'Wrong contract', repos);
    expect(w.status).toBe('WITHDRAWN');
  });
  it('records WITHDRAWN event with reason', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await withdrawRequest(r.id, 'EMP', 'Wrong contract', repos);
    const events = await repos.history.findByRequestId(r.id);
    const ev = events.find(e => e.action === 'WITHDRAWN');
    expect(ev?.notes).toBe('Wrong contract');
  });
  it('throws for unknown requestId', async () => {
    await expect(withdrawRequest('NONE', 'EMP', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-S-06
describe('withdrawRequest — status guard', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('throws when already COMPLETED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'COMPLETED' });
    await expect(withdrawRequest(r.id, 'EMP', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when REJECTED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'REJECTED' });
    await expect(withdrawRequest(r.id, 'EMP', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
  it('allows withdraw from IN_PROGRESS', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    const w = await withdrawRequest(r.id, 'EMP', 'reason', repos);
    expect(w.status).toBe('WITHDRAWN');
  });
});

// ACR-S-07
describe('completeAcceptance', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('transitions IN_PROGRESS → COMPLETED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    const c = await completeAcceptance(r.id, 'DIR', repos);
    expect(c.status).toBe('COMPLETED');
  });
  it('transitions PARTIAL_ACCEPTED → COMPLETED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'PARTIAL_ACCEPTED' });
    const c = await completeAcceptance(r.id, 'DIR', repos);
    expect(c.status).toBe('COMPLETED');
  });
  it('stores completedAt timestamp', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    const c = await completeAcceptance(r.id, 'DIR', repos);
    expect(c.completedAt).toBeTruthy();
  });
});

// ACR-S-08
describe('completeAcceptance — status guard', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('throws for DRAFT', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await expect(completeAcceptance(r.id, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws for unknown id', async () => {
    await expect(completeAcceptance('NONE', 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('records COMPLETED event', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    await completeAcceptance(r.id, 'DIR', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'COMPLETED')).toBe(true);
  });
});

// ACR-S-09
describe('rejectAcceptance', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('transitions IN_PROGRESS → REJECTED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    const rejected = await rejectAcceptance(r.id, 'DIR', 'Does not meet spec', repos);
    expect(rejected.status).toBe('REJECTED');
  });
  it('records REJECTED event with reason', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'IN_PROGRESS' });
    await rejectAcceptance(r.id, 'DIR', 'Spec failure', repos);
    const events = await repos.history.findByRequestId(r.id);
    const ev = events.find(e => e.action === 'REJECTED');
    expect(ev?.notes).toBe('Spec failure');
  });
  it('throws for unknown id', async () => {
    await expect(rejectAcceptance('NONE', 'DIR', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-S-10
describe('rejectAcceptance — from PARTIAL_ACCEPTED', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('allows reject from PARTIAL_ACCEPTED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'PARTIAL_ACCEPTED' });
    const rejected = await rejectAcceptance(r.id, 'DIR', 'Critical failure', repos);
    expect(rejected.status).toBe('REJECTED');
  });
  it('throws when already COMPLETED', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'COMPLETED' });
    await expect(rejectAcceptance(r.id, 'DIR', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when DRAFT (not yet started)', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await expect(rejectAcceptance(r.id, 'DIR', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-S-11
describe('addLegalBasis', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('adds new law code to legalBasis', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const updated = await addLegalBasis(r.id, ['QĐ 123/BXD-2026'], 'EMP', repos);
    expect(updated.legalBasis).toContain('QĐ 123/BXD-2026');
  });
  it('preserves existing legal bases', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const updated = await addLegalBasis(r.id, ['TT 10/2026/TT-BTC'], 'EMP', repos);
    expect(updated.legalBasis).toContain('Luật 22/2023/QH15');
  });
  it('throws for unknown requestId', async () => {
    await expect(addLegalBasis('NONE', ['X'], 'EMP', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-S-12
describe('addLegalBasis — deduplication', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('deduplicates when adding existing code', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const updated = await addLegalBasis(r.id, ['Luật 22/2023/QH15'], 'EMP', repos);
    expect(updated.legalBasis.filter(b => b === 'Luật 22/2023/QH15')).toHaveLength(1);
  });
  it('returns same request when empty array', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    const updated = await addLegalBasis(r.id, [], 'EMP', repos);
    expect(updated.id).toBe(r.id);
  });
  it('records NOTE_ADDED event', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    await addLegalBasis(r.id, ['TT 10/2026/TT-BTC'], 'EMP', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'NOTE_ADDED')).toBe(true);
  });
});

// ACR-S-13
describe('acceptanceType stored correctly', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('stores FINAL type', async () => {
    const r = await createAcceptanceRequest(params(), repos);
    expect(r.acceptanceType).toBe('FINAL');
  });
  it('stores PARTIAL type', async () => {
    const r = await createAcceptanceRequest({ ...params(), acceptanceType: 'PARTIAL' }, repos);
    expect(r.acceptanceType).toBe('PARTIAL');
  });
  it('stores WARRANTY type', async () => {
    const r = await createAcceptanceRequest({ ...params(), acceptanceType: 'WARRANTY' }, repos);
    expect(r.acceptanceType).toBe('WARRANTY');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(o: Partial<CreateAcceptanceParams> = {}): CreateAcceptanceParams {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-001', requestedBy: 'EMP-01', department: 'BLD-01', ...o };
}
