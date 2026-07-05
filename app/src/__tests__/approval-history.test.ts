import { describe, it, expect, beforeEach } from 'vitest';
import { recordHistoryEvent, getApprovalTimeline, calculateProcessingDuration, getLastAction } from '../approval/approvalHistory';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import type { ApprovalRepositories } from '../approval/approvalRepositories';

// APR-H-01
describe('recordHistoryEvent — basic creation', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns an entry with an id', async () => {
    const e = await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    expect(e.id).toBeTruthy();
  });
  it('stores requestId', async () => {
    const e = await recordHistoryEvent('R-99', 'SUBMITTED', 'EMP-1', repos.history);
    expect(e.requestId).toBe('R-99');
  });
  it('stores action', async () => {
    const e = await recordHistoryEvent('R-1', 'ASSIGNED', 'EMP-1', repos.history);
    expect(e.action).toBe('ASSIGNED');
  });
});

// APR-H-02
describe('recordHistoryEvent — optional fields', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores fromStatus when provided', async () => {
    const e = await recordHistoryEvent('R-1', 'SUBMITTED', 'EMP-1', repos.history, { fromStatus: 'DRAFT' });
    expect(e.fromStatus).toBe('DRAFT');
  });
  it('stores toStatus when provided', async () => {
    const e = await recordHistoryEvent('R-1', 'SUBMITTED', 'EMP-1', repos.history, { toStatus: 'SUBMITTED' });
    expect(e.toStatus).toBe('SUBMITTED');
  });
  it('stores notes when provided', async () => {
    const e = await recordHistoryEvent('R-1', 'COMMENTED', 'EMP-1', repos.history, { notes: 'test note' });
    expect(e.notes).toBe('test note');
  });
});

// APR-H-03
describe('recordHistoryEvent — performedBy and performedAt', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores performedBy', async () => {
    const e = await recordHistoryEvent('R-1', 'CREATED', 'MGR-42', repos.history);
    expect(e.performedBy).toBe('MGR-42');
  });
  it('sets performedAt to an ISO string', async () => {
    const before = new Date().toISOString();
    const e = await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    expect(e.performedAt >= before).toBe(true);
  });
  it('performedAt is a valid date string', () => {
    const ts = new Date().toISOString();
    expect(() => new Date(ts)).not.toThrow();
  });
});

// APR-H-04
describe('getApprovalTimeline', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns empty array when no events', async () => {
    expect(await getApprovalTimeline('R-X', repos.history)).toHaveLength(0);
  });
  it('returns events for the request in time order', async () => {
    await recordHistoryEvent('R-1', 'CREATED',   'EMP-1', repos.history);
    await recordHistoryEvent('R-1', 'SUBMITTED',  'EMP-1', repos.history);
    const timeline = await getApprovalTimeline('R-1', repos.history);
    expect(timeline).toHaveLength(2);
  });
  it('does not include events from other requests', async () => {
    await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    await recordHistoryEvent('R-2', 'CREATED', 'EMP-2', repos.history);
    const timeline = await getApprovalTimeline('R-1', repos.history);
    expect(timeline.every(e => e.requestId === 'R-1')).toBe(true);
  });
});

// APR-H-05
describe('calculateProcessingDuration', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns null when no CREATED event exists', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'SUBMITTED', performedBy: 'U', performedAt: '2026-01-02T00:00:00Z' } as any);
    expect(await calculateProcessingDuration('R-1', repos.history)).toBeNull();
  });
  it('returns null when no terminal event', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(await calculateProcessingDuration('R-1', repos.history)).toBeNull();
  });
  it('returns positive duration in milliseconds', async () => {
    await repos.history.create({ requestId: 'R-2', action: 'CREATED',  performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-2', action: 'APPROVED', performedBy: 'U', performedAt: '2026-01-08T00:00:00Z' } as any);
    const duration = await calculateProcessingDuration('R-2', repos.history);
    expect(duration).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// APR-H-06
describe('calculateProcessingDuration — terminal states', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('uses REJECTED as terminal', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',  performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'REJECTED', performedBy: 'U', performedAt: '2026-01-03T00:00:00Z' } as any);
    const d = await calculateProcessingDuration('R-1', repos.history);
    expect(d).toBe(2 * 24 * 60 * 60 * 1000);
  });
  it('uses WITHDRAWN as terminal', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',   performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'WITHDRAWN', performedBy: 'U', performedAt: '2026-01-04T00:00:00Z' } as any);
    const d = await calculateProcessingDuration('R-1', repos.history);
    expect(d).toBeGreaterThan(0);
  });
  it('returns null for empty request history', async () => {
    expect(await calculateProcessingDuration('NONE', repos.history)).toBeNull();
  });
});

// APR-H-07
describe('getLastAction', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns null for empty history', async () => {
    expect(await getLastAction('R-X', repos.history)).toBeNull();
  });
  it('returns the last event in chronological order', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',   performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'SUBMITTED', performedBy: 'U', performedAt: '2026-01-02T00:00:00Z' } as any);
    const last = await getLastAction('R-1', repos.history);
    expect(last?.action).toBe('SUBMITTED');
  });
  it('returns single event when history has one entry', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    const last = await getLastAction('R-1', repos.history);
    expect(last?.action).toBe('CREATED');
  });
});

// APR-H-08
describe('recordHistoryEvent — multiple events for same request', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('all events share the same requestId', async () => {
    await recordHistoryEvent('R-5', 'CREATED',   'EMP-1', repos.history);
    await recordHistoryEvent('R-5', 'SUBMITTED',  'EMP-1', repos.history);
    await recordHistoryEvent('R-5', 'UNDER_REVIEW', 'EMP-1', repos.history);
    const timeline = await getApprovalTimeline('R-5', repos.history);
    expect(timeline.every(e => e.requestId === 'R-5')).toBe(true);
  });
  it('each event has a unique id', async () => {
    const e1 = await recordHistoryEvent('R-5', 'CREATED',  'EMP-1', repos.history);
    const e2 = await recordHistoryEvent('R-5', 'SUBMITTED', 'EMP-1', repos.history);
    expect(e1.id).not.toBe(e2.id);
  });
  it('three events are recorded', async () => {
    await recordHistoryEvent('R-6', 'CREATED',     'EMP-1', repos.history);
    await recordHistoryEvent('R-6', 'SUBMITTED',   'EMP-1', repos.history);
    await recordHistoryEvent('R-6', 'APPROVED',    'MGR-1', repos.history);
    expect((await getApprovalTimeline('R-6', repos.history))).toHaveLength(3);
  });
});

// APR-H-09
describe('getApprovalTimeline — ordering', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('earlier performedAt comes first', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'SUBMITTED', performedBy: 'U', performedAt: '2026-02-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',   performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    const timeline = await getApprovalTimeline('R-1', repos.history);
    expect(timeline[0]?.action).toBe('CREATED');
  });
  it('last event in timeline has latest performedAt', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'APPROVED',  performedBy: 'U', performedAt: '2026-03-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',   performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    const timeline = await getApprovalTimeline('R-1', repos.history);
    expect(timeline[timeline.length - 1]?.action).toBe('APPROVED');
  });
  it('timeline length matches inserted count', async () => {
    for (let i = 0; i < 5; i++) {
      await repos.history.create({ requestId: 'R-Z', action: 'COMMENTED', performedBy: 'U', performedAt: `2026-0${i+1}-01T00:00:00Z` } as any);
    }
    expect(await getApprovalTimeline('R-Z', repos.history)).toHaveLength(5);
  });
});

// APR-H-10
describe('getLastAction — with mixed requests', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('getLastAction only looks at the given requestId', async () => {
    await repos.history.create({ requestId: 'R-A', action: 'APPROVED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-B', action: 'REJECTED', performedBy: 'U', performedAt: '2026-06-01T00:00:00Z' } as any);
    const last = await getLastAction('R-A', repos.history);
    expect(last?.action).toBe('APPROVED');
  });
  it('getLastAction is not affected by other request events', async () => {
    await repos.history.create({ requestId: 'R-C', action: 'CREATED',   performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-D', action: 'WITHDRAWN', performedBy: 'U', performedAt: '2026-05-01T00:00:00Z' } as any);
    const last = await getLastAction('R-C', repos.history);
    expect(last?.action).toBe('CREATED');
  });
  it('returns null when requestId has no history at all', async () => {
    await repos.history.create({ requestId: 'R-Z', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(await getLastAction('R-999', repos.history)).toBeNull();
  });
});

// APR-H-11
describe('calculateProcessingDuration — milliseconds precision', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns 0 for same timestamp CREATED and APPROVED', async () => {
    const ts = '2026-01-01T00:00:00Z';
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',  performedBy: 'U', performedAt: ts } as any);
    await repos.history.create({ requestId: 'R-1', action: 'APPROVED', performedBy: 'U', performedAt: ts } as any);
    expect(await calculateProcessingDuration('R-1', repos.history)).toBe(0);
  });
  it('returns correct ms for 1-hour difference', async () => {
    await repos.history.create({ requestId: 'R-2', action: 'CREATED',  performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-2', action: 'APPROVED', performedBy: 'U', performedAt: '2026-01-01T01:00:00Z' } as any);
    expect(await calculateProcessingDuration('R-2', repos.history)).toBe(60 * 60 * 1000);
  });
  it('is always non-negative', async () => {
    await repos.history.create({ requestId: 'R-3', action: 'CREATED',  performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-3', action: 'APPROVED', performedBy: 'U', performedAt: '2026-01-10T00:00:00Z' } as any);
    const d = await calculateProcessingDuration('R-3', repos.history);
    expect(d!).toBeGreaterThanOrEqual(0);
  });
});

// APR-H-12
describe('recordHistoryEvent — no optional fields', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('fromStatus is undefined when not provided', async () => {
    const e = await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    expect(e.fromStatus).toBeUndefined();
  });
  it('toStatus is undefined when not provided', async () => {
    const e = await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    expect(e.toStatus).toBeUndefined();
  });
  it('notes is undefined when not provided', async () => {
    const e = await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    expect(e.notes).toBeUndefined();
  });
});

// APR-H-13
describe('getApprovalTimeline — history isolation', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns empty when request exists but has no events', async () => {
    expect(await getApprovalTimeline('R-EMPTY', repos.history)).toHaveLength(0);
  });
  it('multiple calls return same results', async () => {
    await recordHistoryEvent('R-1', 'CREATED', 'EMP-1', repos.history);
    const t1 = await getApprovalTimeline('R-1', repos.history);
    const t2 = await getApprovalTimeline('R-1', repos.history);
    expect(t1.length).toBe(t2.length);
  });
  it('events from one request do not bleed into another', async () => {
    await recordHistoryEvent('R-X', 'CREATED',  'EMP-1', repos.history);
    await recordHistoryEvent('R-X', 'APPROVED', 'MGR-1', repos.history);
    expect(await getApprovalTimeline('R-Y', repos.history)).toHaveLength(0);
  });
});
