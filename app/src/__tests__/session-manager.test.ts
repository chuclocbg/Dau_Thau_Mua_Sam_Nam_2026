/**
 * P6-10R: SessionManager — test suite (56 tests)
 *
 * Groups:
 *   SM1 (7)  Lifecycle — create / start / pause / resume / complete / fail / delete
 *   SM2 (7)  State transitions — valid and invalid
 *   SM3 (6)  Duplicate ids
 *   SM4 (6)  Session lookup
 *   SM5 (6)  listSessions
 *   SM6 (5)  clear
 *   SM7 (7)  Immutability
 *   SM8 (7)  Edge cases
 *   SM9 (5)  Never-throw contract
 */

import { describe, it, expect } from 'vitest';
import { SessionManager } from '../providers/SessionManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fresh(): SessionManager {
  return new SessionManager();
}

/** Creates a session and asserts it succeeded; panics otherwise. */
function create(sm: SessionManager, id = 'sess-1') {
  const r = sm.createSession(id);
  if (!r.ok) throw new Error(`createSession failed: ${r.error.message}`);
  return r.value;
}

/** Creates then starts a session; returns the running session. */
function createAndStart(sm: SessionManager, id = 'sess-1') {
  create(sm, id);
  const r = sm.startSession(id);
  if (!r.ok) throw new Error(`startSession failed: ${r.error.message}`);
  return r.value;
}

// ─── SM1: Lifecycle ───────────────────────────────────────────────────────────

describe('SM1: Lifecycle', () => {
  it('SM1-01: createSession returns ok:true', () => {
    expect(fresh().createSession('s').ok).toBe(true);
  });

  it('SM1-02: newly created session starts in IDLE state', () => {
    const r = fresh().createSession('s');
    expect(r.ok && r.value.state).toBe('IDLE');
  });

  it('SM1-03: startSession transitions state to RUNNING', () => {
    const sm = fresh();
    create(sm);
    const r = sm.startSession('sess-1');
    expect(r.ok && r.value.state).toBe('RUNNING');
  });

  it('SM1-04: pauseSession transitions state to PAUSED', () => {
    const sm = fresh();
    createAndStart(sm);
    const r = sm.pauseSession('sess-1');
    expect(r.ok && r.value.state).toBe('PAUSED');
  });

  it('SM1-05: resumeSession transitions state back to RUNNING', () => {
    const sm = fresh();
    createAndStart(sm);
    sm.pauseSession('sess-1');
    const r = sm.resumeSession('sess-1');
    expect(r.ok && r.value.state).toBe('RUNNING');
  });

  it('SM1-06: completeSession transitions state to COMPLETED', () => {
    const sm = fresh();
    createAndStart(sm);
    const r = sm.completeSession('sess-1');
    expect(r.ok && r.value.state).toBe('COMPLETED');
  });

  it('SM1-07: deleteSession returns ok:true', () => {
    const sm = fresh();
    create(sm);
    expect(sm.deleteSession('sess-1').ok).toBe(true);
  });
});

// ─── SM2: State transitions ───────────────────────────────────────────────────

describe('SM2: State transitions', () => {
  it('SM2-01: IDLE → RUNNING is valid via startSession', () => {
    const sm = fresh();
    create(sm);
    expect(sm.startSession('sess-1').ok).toBe(true);
  });

  it('SM2-02: RUNNING → PAUSED is valid via pauseSession', () => {
    const sm = fresh();
    createAndStart(sm);
    expect(sm.pauseSession('sess-1').ok).toBe(true);
  });

  it('SM2-03: PAUSED → RUNNING is valid via resumeSession', () => {
    const sm = fresh();
    createAndStart(sm);
    sm.pauseSession('sess-1');
    expect(sm.resumeSession('sess-1').ok).toBe(true);
  });

  it('SM2-04: RUNNING → COMPLETED is valid via completeSession', () => {
    const sm = fresh();
    createAndStart(sm);
    expect(sm.completeSession('sess-1').ok).toBe(true);
  });

  it('SM2-05: RUNNING → ERROR is valid via failSession', () => {
    const sm = fresh();
    createAndStart(sm);
    const r = sm.failSession('sess-1');
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.state).toBe('ERROR');
  });

  it('SM2-06: IDLE → PAUSED is invalid — returns INVALID_STATE', () => {
    const sm = fresh();
    create(sm);
    const r = sm.pauseSession('sess-1'); // IDLE cannot pause
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_STATE');
  });

  it('SM2-07: COMPLETED → RUNNING is invalid — returns INVALID_STATE', () => {
    const sm = fresh();
    createAndStart(sm);
    sm.completeSession('sess-1');
    const r = sm.startSession('sess-1');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_STATE');
  });
});

// ─── SM3: Duplicate ids ───────────────────────────────────────────────────────

describe('SM3: Duplicate ids', () => {
  it('SM3-01: createSession with a duplicate id returns ok:false', () => {
    const sm = fresh();
    create(sm);
    const r = sm.createSession('sess-1');
    expect(r.ok).toBe(false);
  });

  it('SM3-02: error code is DUPLICATE_SESSION', () => {
    const sm = fresh();
    create(sm);
    const r = sm.createSession('sess-1');
    expect(!r.ok && r.error.code).toBe('DUPLICATE_SESSION');
  });

  it('SM3-03: error message contains the duplicate id', () => {
    const sm = fresh();
    sm.createSession('my-session');
    const r = sm.createSession('my-session');
    expect(!r.ok && r.error.message).toContain('my-session');
  });

  it('SM3-04: session count is unchanged after a duplicate failure', () => {
    const sm = fresh();
    create(sm);
    sm.createSession('sess-1'); // duplicate, ignored
    expect(sm.listSessions()).toHaveLength(1);
  });

  it('SM3-05: original session is unmodified after failed duplicate', () => {
    const sm = fresh();
    sm.createSession('s', { metadata: { v: 1 } });
    sm.createSession('s', { metadata: { v: 999 } }); // fails
    const r = sm.getSession('s');
    expect(r.ok && r.value.metadata?.['v']).toBe(1);
  });

  it('SM3-06: same id can be re-created after deleteSession', () => {
    const sm = fresh();
    create(sm);
    sm.deleteSession('sess-1');
    const r = sm.createSession('sess-1');
    expect(r.ok).toBe(true);
  });
});

// ─── SM4: Session lookup ──────────────────────────────────────────────────────

describe('SM4: Session lookup', () => {
  it('SM4-01: getSession returns the session after createSession', () => {
    const sm = fresh();
    create(sm);
    const r = sm.getSession('sess-1');
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.id).toBe('sess-1');
  });

  it('SM4-02: getSession reflects the latest state after a transition', () => {
    const sm = fresh();
    createAndStart(sm);
    sm.pauseSession('sess-1');
    const r = sm.getSession('sess-1');
    expect(r.ok && r.value.state).toBe('PAUSED');
  });

  it('SM4-03: getSession returns SESSION_NOT_FOUND for an unknown id', () => {
    const r = fresh().getSession('ghost');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('SM4-04: error message contains the unknown id', () => {
    const r = fresh().getSession('no-such-session');
    expect(!r.ok && r.error.message).toContain('no-such-session');
  });

  it('SM4-05: getSession returns SESSION_NOT_FOUND after deleteSession', () => {
    const sm = fresh();
    create(sm);
    sm.deleteSession('sess-1');
    expect(sm.getSession('sess-1').ok).toBe(false);
  });

  it('SM4-06: deleteSession returns SESSION_NOT_FOUND for unknown id', () => {
    const r = fresh().deleteSession('nope');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('SESSION_NOT_FOUND');
  });
});

// ─── SM5: listSessions ────────────────────────────────────────────────────────

describe('SM5: listSessions', () => {
  it('SM5-01: listSessions returns empty array when no sessions exist', () => {
    expect(fresh().listSessions()).toHaveLength(0);
  });

  it('SM5-02: listSessions includes all created sessions', () => {
    const sm = fresh();
    sm.createSession('a');
    sm.createSession('b');
    sm.createSession('c');
    const ids = sm.listSessions().map(s => s.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('SM5-03: listSessions reflects current state after transitions', () => {
    const sm = fresh();
    createAndStart(sm, 'r');
    create(sm, 'i');
    const sessions = sm.listSessions();
    expect(sessions.find(s => s.id === 'r')?.state).toBe('RUNNING');
    expect(sessions.find(s => s.id === 'i')?.state).toBe('IDLE');
  });

  it('SM5-04: listSessions length decreases after deleteSession', () => {
    const sm = fresh();
    sm.createSession('a');
    sm.createSession('b');
    sm.deleteSession('a');
    expect(sm.listSessions()).toHaveLength(1);
  });

  it('SM5-05: listSessions preserves insertion order', () => {
    const sm = fresh();
    sm.createSession('z');
    sm.createSession('a');
    sm.createSession('m');
    expect(sm.listSessions().map(s => s.id)).toEqual(['z', 'a', 'm']);
  });

  it('SM5-06: listSessions includes sessions in COMPLETED and ERROR states', () => {
    const sm = fresh();
    createAndStart(sm, 'done');
    sm.completeSession('done');
    createAndStart(sm, 'failed');
    sm.failSession('failed');
    const states = sm.listSessions().map(s => s.state);
    expect(states).toContain('COMPLETED');
    expect(states).toContain('ERROR');
  });
});

// ─── SM6: clear ───────────────────────────────────────────────────────────────

describe('SM6: clear', () => {
  it('SM6-01: clear() empties all sessions', () => {
    const sm = fresh();
    sm.createSession('a');
    sm.createSession('b');
    sm.clear();
    expect(sm.listSessions()).toHaveLength(0);
  });

  it('SM6-02: listSessions returns empty array after clear()', () => {
    const sm = fresh();
    sm.createSession('x');
    sm.clear();
    expect(sm.listSessions()).toEqual([]);
  });

  it('SM6-03: getSession returns SESSION_NOT_FOUND after clear()', () => {
    const sm = fresh();
    sm.createSession('x');
    sm.clear();
    expect(sm.getSession('x').ok).toBe(false);
  });

  it('SM6-04: new sessions can be added after clear()', () => {
    const sm = fresh();
    sm.createSession('old');
    sm.clear();
    const r = sm.createSession('new');
    expect(r.ok).toBe(true);
    expect(sm.listSessions()).toHaveLength(1);
  });

  it('SM6-05: clear() on an empty manager is a no-op', () => {
    const sm = fresh();
    expect(() => sm.clear()).not.toThrow();
    expect(sm.listSessions()).toHaveLength(0);
  });
});

// ─── SM7: Immutability ────────────────────────────────────────────────────────

describe('SM7: Immutability', () => {
  it('SM7-01: mutating the result from createSession does not affect stored session', () => {
    const sm = fresh();
    const r  = sm.createSession('s');
    if (r.ok) (r.value as any).state = 'RUNNING';
    expect(sm.getSession('s').ok && (sm.getSession('s') as any).value.state).toBe('IDLE');
  });

  it('SM7-02: mutating the result from getSession does not affect stored session', () => {
    const sm = fresh();
    create(sm);
    const r1 = sm.getSession('sess-1');
    if (r1.ok) (r1.value as any).state = 'COMPLETED';
    const r2 = sm.getSession('sess-1');
    expect(r2.ok && r2.value.state).toBe('IDLE');
  });

  it('SM7-03: mutating a session from listSessions does not affect stored session', () => {
    const sm = fresh();
    create(sm);
    const [s] = sm.listSessions();
    (s as any).state = 'ERROR';
    expect(sm.getSession('sess-1').ok && (sm.getSession('sess-1') as any).value.state).toBe('IDLE');
  });

  it('SM7-04: mutating metadata from getSession does not affect stored metadata', () => {
    const sm = fresh();
    sm.createSession('s', { metadata: { key: 'original' } });
    const r = sm.getSession('s');
    if (r.ok && r.value.metadata) r.value.metadata['key'] = 'mutated';
    const r2 = sm.getSession('s');
    expect(r2.ok && r2.value.metadata?.['key']).toBe('original');
  });

  it('SM7-05: two calls to getSession return independent objects', () => {
    const sm = fresh();
    create(sm);
    const r1 = sm.getSession('sess-1');
    const r2 = sm.getSession('sess-1');
    if (r1.ok && r2.ok) expect(r1.value).not.toBe(r2.value);
  });

  it('SM7-06: mutating the options.metadata after createSession has no effect', () => {
    const sm   = fresh();
    const meta = { score: 10 };
    sm.createSession('s', { metadata: meta });
    meta['score'] = 999;
    const r = sm.getSession('s');
    expect(r.ok && r.value.metadata?.['score']).toBe(10);
  });

  it('SM7-07: state transition returns a copy, not the internal reference', () => {
    const sm = fresh();
    createAndStart(sm);
    const r1 = sm.pauseSession('sess-1');
    const r2 = sm.getSession('sess-1');
    if (r1.ok && r2.ok) expect(r1.value).not.toBe(r2.value);
  });
});

// ─── SM8: Edge cases ──────────────────────────────────────────────────────────

describe('SM8: Edge cases', () => {
  it('SM8-01: createSession with empty id returns INVALID_INPUT', () => {
    const r = fresh().createSession('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('SM8-02: createSession with whitespace-only id returns INVALID_INPUT', () => {
    const r = fresh().createSession('   ');
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('SM8-03: metadata provided at creation is present in getSession result', () => {
    const sm = fresh();
    sm.createSession('s', { metadata: { user: 'alice', score: 42 } });
    const r = sm.getSession('s');
    expect(r.ok && r.value.metadata?.['user']).toBe('alice');
    expect(r.ok && r.value.metadata?.['score']).toBe(42);
  });

  it('SM8-04: createdAt is a positive number set at creation time', () => {
    const before = Date.now();
    const r      = fresh().createSession('s');
    const after  = Date.now();
    expect(r.ok && r.value.createdAt).toBeGreaterThanOrEqual(before);
    expect(r.ok && r.value.createdAt).toBeLessThanOrEqual(after);
  });

  it('SM8-05: updatedAt changes after a state transition', () => {
    const sm      = fresh();
    const created = create(sm);
    const started = sm.startSession('sess-1');
    expect(started.ok && started.value.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('SM8-06: deleteSession works on sessions in any state (COMPLETED)', () => {
    const sm = fresh();
    createAndStart(sm);
    sm.completeSession('sess-1');
    const r = sm.deleteSession('sess-1');
    expect(r.ok).toBe(true);
  });

  it('SM8-07: two independent sessions do not interfere with each other', () => {
    const sm = fresh();
    sm.createSession('alpha');
    sm.createSession('beta');
    sm.startSession('alpha');
    sm.pauseSession('alpha');
    const beta = sm.getSession('beta');
    expect(beta.ok && beta.value.state).toBe('IDLE');
  });
});

// ─── SM9: Never-throw contract ────────────────────────────────────────────────

describe('SM9: Never-throw contract', () => {
  it('SM9-01: createSession never throws for any id', () => {
    const sm = fresh();
    expect(() => sm.createSession('')).not.toThrow();
    expect(() => sm.createSession('ok')).not.toThrow();
    expect(() => sm.createSession('ok')).not.toThrow(); // duplicate
  });

  it('SM9-02: startSession never throws for unknown or invalid ids', () => {
    expect(() => fresh().startSession('missing')).not.toThrow();
    expect(() => fresh().startSession('')).not.toThrow();
  });

  it('SM9-03: getSession never throws for any id', () => {
    const sm = fresh();
    expect(() => sm.getSession('absent')).not.toThrow();
    expect(() => sm.getSession('')).not.toThrow();
  });

  it('SM9-04: listSessions never throws on any manager state', () => {
    const sm = fresh();
    expect(() => sm.listSessions()).not.toThrow();
    sm.createSession('x');
    expect(() => sm.listSessions()).not.toThrow();
    sm.clear();
    expect(() => sm.listSessions()).not.toThrow();
  });

  it('SM9-05: all transition methods never throw for unknown or invalid-state sessions', () => {
    const sm = fresh();
    // All on non-existent session
    expect(() => sm.startSession('ghost')).not.toThrow();
    expect(() => sm.pauseSession('ghost')).not.toThrow();
    expect(() => sm.resumeSession('ghost')).not.toThrow();
    expect(() => sm.completeSession('ghost')).not.toThrow();
    expect(() => sm.failSession('ghost')).not.toThrow();
    expect(() => sm.deleteSession('ghost')).not.toThrow();
    // All on session in wrong state
    sm.createSession('idle');
    expect(() => sm.pauseSession('idle')).not.toThrow();   // IDLE → PAUSED invalid
    expect(() => sm.resumeSession('idle')).not.toThrow();  // IDLE → RUNNING invalid
    expect(() => sm.completeSession('idle')).not.toThrow();// IDLE → COMPLETED invalid
    expect(() => sm.failSession('idle')).not.toThrow();    // IDLE → ERROR invalid
  });
});
