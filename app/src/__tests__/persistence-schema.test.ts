/**
 * P6-08A: Persistence schema tests
 *
 * Validates constants, type guards, serializers, and migration helpers.
 * No I/O is exercised — all tests are pure / in-memory.
 *
 * Groups:
 *   PS-01..PS-04  — PERSISTENCE_SCHEMA_VERSION constant
 *   PS-05..PS-09  — serializeMessage
 *   PS-10..PS-15  — serializeSession
 *   PS-16..PS-19  — serializeTrace
 *   PS-20..PS-23  — createExportSnapshot
 *   PS-24..PS-27  — isPersistedSession type guard
 *   PS-28..PS-30  — isPersistedTrace type guard
 *   PS-31..PS-33  — isExportSnapshot type guard
 *   PS-34..PS-37  — needsMigration / isNewerSchema
 */

import { describe, it, expect } from 'vitest';

import {
  PERSISTENCE_SCHEMA_VERSION,
  serializeMessage,
  serializeSession,
  serializeTrace,
  createExportSnapshot,
  isPersistedSession,
  isPersistedTrace,
  isExportSnapshot,
  needsMigration,
  isNewerSchema,
} from '../persistence/schema';

import type { AgentMessage }   from '../agents/types';
import type { AgentSession }   from '../agents/AutonomousAgent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    traceId:   'test-trace-001',
    from:      'autonomous',
    to:        'planner',
    type:      'request',
    payload:   { action: 'run', goal: 'test' },
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'sess-001',
    state:       'ready-for-export',
    goal:        'mua sắm văn phòng phẩm',
    messageLog:  [makeMsg({ from: 'autonomous', to: 'planner',       type: 'request'  }),
                  makeMsg({ from: 'planner',    to: 'autonomous',    type: 'response' })],
    startedAt:   1_700_000_000_000,
    completedAt: 1_700_000_001_000,
    specRetries: 0,
    totalBudget: 200_000_000,
    budgetYear:  2026,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PERSISTENCE_SCHEMA_VERSION
// ═════════════════════════════════════════════════════════════════════════════

describe('PERSISTENCE_SCHEMA_VERSION constant', () => {
  it('PS-01: is a positive integer', () => {
    expect(Number.isInteger(PERSISTENCE_SCHEMA_VERSION)).toBe(true);
    expect(PERSISTENCE_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('PS-02: is currently 1 (initial schema)', () => {
    expect(PERSISTENCE_SCHEMA_VERSION).toBe(1);
  });

  it('PS-03: is the literal type 1 (TypeScript inference check via equality)', () => {
    const v: 1 = PERSISTENCE_SCHEMA_VERSION; // TypeScript compile-time assertion
    expect(v).toBe(1);
  });

  it('PS-04: is exported from the persistence barrel (index.ts re-exports it)', async () => {
    const mod = await import('../persistence/index');
    expect(mod.PERSISTENCE_SCHEMA_VERSION).toBe(PERSISTENCE_SCHEMA_VERSION);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// serializeMessage
// ═════════════════════════════════════════════════════════════════════════════

describe('serializeMessage()', () => {
  it('PS-05: preserves traceId', () => {
    const m = makeMsg({ traceId: 'trace-xyz' });
    expect(serializeMessage(m).traceId).toBe('trace-xyz');
  });

  it('PS-06: preserves from, to, type fields', () => {
    const m = makeMsg({ from: 'planner', to: 'autonomous', type: 'response' });
    const s = serializeMessage(m);
    expect(s.from).toBe('planner');
    expect(s.to).toBe('autonomous');
    expect(s.type).toBe('response');
  });

  it('PS-07: preserves timestamp', () => {
    const m = makeMsg({ timestamp: 9_999_999 });
    expect(serializeMessage(m).timestamp).toBe(9_999_999);
  });

  it('PS-08: preserves legalBasis when present', () => {
    const m = makeMsg({ legalBasis: ['Điều 44 Luật Đấu thầu'] });
    expect(serializeMessage(m).legalBasis).toEqual(['Điều 44 Luật Đấu thầu']);
  });

  it('PS-09: legalBasis is undefined when absent from source message', () => {
    const m = makeMsg(); // no legalBasis
    expect(serializeMessage(m).legalBasis).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// serializeSession
// ═════════════════════════════════════════════════════════════════════════════

describe('serializeSession()', () => {
  it('PS-10: produced record carries PERSISTENCE_SCHEMA_VERSION', () => {
    const s = serializeSession(makeSession());
    expect(s.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('PS-11: preserves sessionId, goal, state', () => {
    const sess = makeSession({ sessionId: 's-999', goal: 'test goal', state: 'error' });
    const s    = serializeSession(sess);
    expect(s.sessionId).toBe('s-999');
    expect(s.goal).toBe('test goal');
    expect(s.state).toBe('error');
  });

  it('PS-12: preserves startedAt and completedAt', () => {
    const sess = makeSession({ startedAt: 100, completedAt: 200 });
    const s    = serializeSession(sess);
    expect(s.startedAt).toBe(100);
    expect(s.completedAt).toBe(200);
  });

  it('PS-13: completedAt is undefined when absent from source session', () => {
    const sess = makeSession({ completedAt: undefined });
    expect(serializeSession(sess).completedAt).toBeUndefined();
  });

  it('PS-14: savedAt is a recent timestamp (set at serialization time)', () => {
    const before = Date.now();
    const s      = serializeSession(makeSession());
    const after  = Date.now();
    expect(s.savedAt).toBeGreaterThanOrEqual(before);
    expect(s.savedAt).toBeLessThanOrEqual(after);
  });

  it('PS-15: messageLog is serialized — length matches source session', () => {
    const sess = makeSession(); // has 2 messages in messageLog
    expect(serializeSession(sess).messageLog).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// serializeTrace
// ═════════════════════════════════════════════════════════════════════════════

describe('serializeTrace()', () => {
  it('PS-16: produced record carries PERSISTENCE_SCHEMA_VERSION', () => {
    const t = serializeTrace('tid-1', [makeMsg()]);
    expect(t.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('PS-17: traceId is preserved', () => {
    const t = serializeTrace('tid-abc', [makeMsg()]);
    expect(t.traceId).toBe('tid-abc');
  });

  it('PS-18: createdAt is the minimum message timestamp, updatedAt is the maximum', () => {
    const msgs = [
      makeMsg({ timestamp: 300 }),
      makeMsg({ timestamp: 100 }),
      makeMsg({ timestamp: 200 }),
    ];
    const t = serializeTrace('t', msgs);
    expect(t.createdAt).toBe(100);
    expect(t.updatedAt).toBe(300);
  });

  it('PS-19: messages array length matches input', () => {
    const msgs = [makeMsg(), makeMsg(), makeMsg()];
    expect(serializeTrace('t', msgs).messages).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createExportSnapshot
// ═════════════════════════════════════════════════════════════════════════════

describe('createExportSnapshot()', () => {
  const baseOpts = () => ({
    snapshotId: 'snap-001',
    session:    makeSession(),
    traces:     [{ traceId: 'trace-a', messages: [makeMsg()] }],
    legalBasis: ['Điều 38 Luật Đấu thầu', 'Điều 38 Luật Đấu thầu'], // intentional dup
    summary:    'Hồ sơ đã hoàn tất.',
  });

  it('PS-20: produced snapshot carries PERSISTENCE_SCHEMA_VERSION', () => {
    expect(createExportSnapshot(baseOpts()).schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('PS-21: snapshotId is preserved', () => {
    expect(createExportSnapshot(baseOpts()).snapshotId).toBe('snap-001');
  });

  it('PS-22: legalBasis is deduplicated in the snapshot', () => {
    const snap = createExportSnapshot(baseOpts());
    expect(snap.legalBasis).toHaveLength(1); // duplicate removed
    expect(snap.legalBasis[0]).toBe('Điều 38 Luật Đấu thầu');
  });

  it('PS-23: exportedAt is a recent timestamp', () => {
    const before = Date.now();
    const snap   = createExportSnapshot(baseOpts());
    const after  = Date.now();
    expect(snap.exportedAt).toBeGreaterThanOrEqual(before);
    expect(snap.exportedAt).toBeLessThanOrEqual(after);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// isPersistedSession type guard
// ═════════════════════════════════════════════════════════════════════════════

describe('isPersistedSession()', () => {
  it('PS-24: returns true for a round-tripped serializeSession result', () => {
    const persisted = serializeSession(makeSession());
    expect(isPersistedSession(persisted)).toBe(true);
  });

  it('PS-25: returns false for null', () => {
    expect(isPersistedSession(null)).toBe(false);
  });

  it('PS-26: returns false when sessionId is missing', () => {
    const obj = { ...serializeSession(makeSession()), sessionId: undefined };
    expect(isPersistedSession(obj)).toBe(false);
  });

  it('PS-27: returns false when messageLog is not an array', () => {
    const obj = { ...serializeSession(makeSession()), messageLog: 'not-an-array' };
    expect(isPersistedSession(obj)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// isPersistedTrace type guard
// ═════════════════════════════════════════════════════════════════════════════

describe('isPersistedTrace()', () => {
  it('PS-28: returns true for a round-tripped serializeTrace result', () => {
    const t = serializeTrace('tid', [makeMsg()]);
    expect(isPersistedTrace(t)).toBe(true);
  });

  it('PS-29: returns false for an object missing traceId', () => {
    const obj = { schemaVersion: 1, messages: [], createdAt: 1, updatedAt: 1 };
    expect(isPersistedTrace(obj)).toBe(false);
  });

  it('PS-30: returns false when messages is not an array', () => {
    const obj = { schemaVersion: 1, traceId: 'x', messages: null, createdAt: 1, updatedAt: 1 };
    expect(isPersistedTrace(obj)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// isExportSnapshot type guard
// ═════════════════════════════════════════════════════════════════════════════

describe('isExportSnapshot()', () => {
  it('PS-31: returns true for a createExportSnapshot result', () => {
    const snap = createExportSnapshot({
      snapshotId: 's1',
      session:    makeSession(),
      traces:     [],
      legalBasis: [],
      summary:    'test',
    });
    expect(isExportSnapshot(snap)).toBe(true);
  });

  it('PS-32: returns false when session fails isPersistedSession check', () => {
    const snap = createExportSnapshot({
      snapshotId: 's2',
      session:    makeSession(),
      traces:     [],
      legalBasis: [],
      summary:    'test',
    });
    const bad = { ...snap, session: { incomplete: true } };
    expect(isExportSnapshot(bad)).toBe(false);
  });

  it('PS-33: returns false for a primitive value', () => {
    expect(isExportSnapshot(42)).toBe(false);
    expect(isExportSnapshot('string')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// needsMigration / isNewerSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('needsMigration() and isNewerSchema()', () => {
  it('PS-34: needsMigration returns false for schemaVersion === CURRENT', () => {
    expect(needsMigration({ schemaVersion: PERSISTENCE_SCHEMA_VERSION })).toBe(false);
  });

  it('PS-35: needsMigration returns true for schemaVersion < CURRENT', () => {
    expect(needsMigration({ schemaVersion: 0 })).toBe(true);
  });

  it('PS-36: isNewerSchema returns false for schemaVersion === CURRENT', () => {
    expect(isNewerSchema({ schemaVersion: PERSISTENCE_SCHEMA_VERSION })).toBe(false);
  });

  it('PS-37: isNewerSchema returns true for schemaVersion > CURRENT', () => {
    expect(isNewerSchema({ schemaVersion: PERSISTENCE_SCHEMA_VERSION + 1 })).toBe(true);
  });
});
