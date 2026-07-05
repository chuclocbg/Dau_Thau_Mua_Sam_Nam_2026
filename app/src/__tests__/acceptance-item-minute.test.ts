import { describe, it, expect, beforeEach } from 'vitest';
import { recordItem, getItems, getItemsBySession, calculateAcceptanceRate } from '../acceptance/acceptanceItem';
import { createMinute, signMinute, getMinutes } from '../acceptance/acceptanceMinute';
import { createAcceptanceRequest } from '../acceptance/acceptanceService';
import { formCommittee } from '../acceptance/acceptanceCommittee';
import { createSession, startSession } from '../acceptance/acceptanceSession';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import { AcceptanceError } from '../acceptance/acceptanceTypes';
import type { CreateAcceptanceParams, FormCommitteeParams, RecordItemParams, CreateMinuteParams } from '../acceptance/acceptanceTypes';

// ACR-I-01
describe('recordItem — happy path', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('creates an item', async () => {
    const i = await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(i.itemCode).toBe('ITEM-01');
  });
  it('status is ACCEPTED when no rejections', async () => {
    const i = await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(i.status).toBe('ACCEPTED');
  });
  it('records ITEM_RECORDED history event', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'ITEM_RECORDED')).toBe(true);
  });
});

// ACR-I-02
describe('recordItem — status determination', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('status is REJECTED when all rejected and none accepted', async () => {
    const i = await recordItem(sessionId, requestId, { ...iparams(), acceptedQuantity: 0, rejectedQuantity: 10 }, 'U', repos);
    expect(i.status).toBe('REJECTED');
  });
  it('status is PENDING when partial accepted/rejected', async () => {
    const i = await recordItem(sessionId, requestId, { ...iparams(), acceptedQuantity: 7, rejectedQuantity: 3 }, 'U', repos);
    expect(i.status).toBe('PENDING');
  });
  it('stores contractedQuantity', async () => {
    const i = await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(i.contractedQuantity).toBe(10);
  });
});

// ACR-I-03
describe('recordItem — validation', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('throws for unknown sessionId', async () => {
    await expect(recordItem('NONE', requestId, iparams(), 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when sum exceeds contracted', async () => {
    await expect(recordItem(sessionId, requestId, { ...iparams(), acceptedQuantity: 8, rejectedQuantity: 5 }, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when contractedQuantity is zero', async () => {
    await expect(recordItem(sessionId, requestId, { ...iparams(), contractedQuantity: 0 }, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-I-04
describe('recordItem — session status guard', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    const r = await createAcceptanceRequest(rparams(), repos);
    requestId = r.id;
    await formCommittee(requestId, cparams(), 'DIR', repos);
  });

  it('throws when session is PENDING', async () => {
    const s = await createSession(requestId, { sessionType: 'FINAL', scheduledDate: '2026-08-01' }, 'U', repos);
    await expect(recordItem(s.id, requestId, iparams(), 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('stores rejectReason', async () => {
    const { sessionId, repos: r2, requestId: rid } = await makeActiveSession();
    const i = await recordItem(sessionId, rid, { ...iparams(), acceptedQuantity: 0, rejectedQuantity: 10, rejectReason: 'Sai quy cách' }, 'U', r2);
    expect(i.rejectReason).toBe('Sai quy cách');
  });
  it('stores verifiedBy', async () => {
    const { sessionId, repos: r2, requestId: rid } = await makeActiveSession();
    const i = await recordItem(sessionId, rid, { ...iparams(), verifiedBy: 'ENG-01' }, 'U', r2);
    expect(i.verifiedBy).toBe('ENG-01');
  });
});

// ACR-I-05
describe('getItems', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('returns empty initially', async () => {
    expect(await getItems(requestId, repos)).toHaveLength(0);
  });
  it('returns items for request', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(await getItems(requestId, repos)).toHaveLength(1);
  });
  it('getItemsBySession returns items for session', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(await getItemsBySession(sessionId, repos)).toHaveLength(1);
  });
});

// ACR-I-06
describe('calculateAcceptanceRate', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('returns 0 when no items', async () => {
    expect(await calculateAcceptanceRate(requestId, repos)).toBe(0);
  });
  it('returns 100 when all accepted', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(await calculateAcceptanceRate(requestId, repos)).toBe(100);
  });
  it('returns 50 when half accepted', async () => {
    await recordItem(sessionId, requestId, { ...iparams(), acceptedQuantity: 5, rejectedQuantity: 5 }, 'U', repos);
    expect(await calculateAcceptanceRate(requestId, repos)).toBe(50);
  });
});

// ACR-I-07
describe('calculateAcceptanceRate — multiple items', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('aggregates across multiple items', async () => {
    await recordItem(sessionId, requestId, { ...iparams(), itemCode: 'A', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }, 'U', repos);
    await recordItem(sessionId, requestId, { ...iparams(), itemCode: 'B', contractedQuantity: 10, acceptedQuantity: 0,  rejectedQuantity: 10 }, 'U', repos);
    expect(await calculateAcceptanceRate(requestId, repos)).toBe(50);
  });
  it('capped at 100', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(await calculateAcceptanceRate(requestId, repos)).toBeLessThanOrEqual(100);
  });
  it('is an integer', async () => {
    await recordItem(sessionId, requestId, { ...iparams(), contractedQuantity: 3, acceptedQuantity: 2, rejectedQuantity: 0 }, 'U', repos);
    expect(Number.isInteger(await calculateAcceptanceRate(requestId, repos))).toBe(true);
  });
});

// ACR-I-08
describe('createMinute — happy path', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('creates a DRAFT minute', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    expect(m.status).toBe('DRAFT');
  });
  it('stores minuteCode', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    expect(m.minuteCode).toBe('BB/NT/001');
  });
  it('records MINUTE_CREATED event', async () => {
    await createMinute(requestId, sessionId, mparams(), 'U', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'MINUTE_CREATED')).toBe(true);
  });
});

// ACR-I-09
describe('createMinute — validation', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('throws for unknown sessionId', async () => {
    await expect(createMinute(requestId, 'NONE', mparams(), 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when minute already exists for session', async () => {
    await createMinute(requestId, sessionId, mparams(), 'U', repos);
    await expect(createMinute(requestId, sessionId, { ...mparams(), minuteCode: 'BB/002' }, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when conclusion is empty', async () => {
    await expect(createMinute(requestId, sessionId, { ...mparams(), conclusion: '' }, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-I-10
describe('signMinute', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('transitions DRAFT → SIGNED', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    const signed = await signMinute(m.id, 'DIR', repos);
    expect(signed.status).toBe('SIGNED');
  });
  it('stores signedBy', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    const signed = await signMinute(m.id, 'DIR-01', repos);
    expect(signed.signedBy).toBe('DIR-01');
  });
  it('records MINUTE_SIGNED event', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    await signMinute(m.id, 'DIR', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'MINUTE_SIGNED')).toBe(true);
  });
});

// ACR-I-11
describe('signMinute — guards', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('throws for unknown minuteId', async () => {
    await expect(signMinute('NONE', 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when already SIGNED', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    await signMinute(m.id, 'DIR', repos);
    await expect(signMinute(m.id, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('stores signedAt timestamp', async () => {
    const m = await createMinute(requestId, sessionId, mparams(), 'U', repos);
    const signed = await signMinute(m.id, 'DIR', repos);
    expect(signed.signedAt).toBeTruthy();
  });
});

// ACR-I-12
describe('getMinutes', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('returns empty initially', async () => {
    expect(await getMinutes(requestId, repos)).toHaveLength(0);
  });
  it('returns minute after creation', async () => {
    await createMinute(requestId, sessionId, mparams(), 'U', repos);
    expect(await getMinutes(requestId, repos)).toHaveLength(1);
  });
  it('findBySessionId returns correct minute', async () => {
    await createMinute(requestId, sessionId, mparams(), 'U', repos);
    const m = await repos.minutes.findBySessionId(sessionId);
    expect(m?.minuteCode).toBe('BB/NT/001');
  });
});

// ACR-I-13
describe('countAccepted + countRejected', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let sessionId: string;
  beforeEach(async () => { ({ repos, requestId, sessionId } = await makeActiveSession()); });

  it('countAcceptedByRequestId returns correct count', async () => {
    await recordItem(sessionId, requestId, iparams(), 'U', repos);
    expect(await repos.items.countAcceptedByRequestId(requestId)).toBe(1);
  });
  it('countRejectedByRequestId returns correct count', async () => {
    await recordItem(sessionId, requestId, { ...iparams(), acceptedQuantity: 0, rejectedQuantity: 10 }, 'U', repos);
    expect(await repos.items.countRejectedByRequestId(requestId)).toBe(1);
  });
  it('stores unit when provided', async () => {
    const i = await recordItem(sessionId, requestId, { ...iparams(), unit: 'm²' }, 'U', repos);
    expect(i.unit).toBe('m²');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rparams(): CreateAcceptanceParams {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-001', requestedBy: 'EMP-01', department: 'BLD-01' };
}
function cparams(): FormCommitteeParams { return { committeeCode: 'HDNT-01', establishedBy: 'DIR-01' }; }
function iparams(o: Partial<RecordItemParams> = {}): RecordItemParams {
  return { itemCode: 'ITEM-01', description: 'Hạng mục A', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0, ...o };
}
function mparams(o: Partial<CreateMinuteParams> = {}): CreateMinuteParams {
  return { minuteCode: 'BB/NT/001', conclusion: 'Nghiệm thu đạt yêu cầu kỹ thuật', ...o };
}

async function makeActiveSession() {
  const repos = createMemoryAcceptanceRepositories();
  const r = await createAcceptanceRequest(rparams(), repos);
  await formCommittee(r.id, cparams(), 'DIR', repos);
  const s = await createSession(r.id, { sessionType: 'FINAL', scheduledDate: '2026-08-01' }, 'U', repos);
  await startSession(s.id, 'U', '2026-08-01', repos);
  return { repos, requestId: r.id, sessionId: s.id };
}
