/**
 * P6-10Q: Planner — test suite (56 tests)
 *
 * Groups:
 *   PL1 (8)  CRUD lifecycle
 *   PL2 (7)  Dependency graph
 *   PL3 (7)  Completion
 *   PL4 (7)  Duplicate ids
 *   PL5 (7)  Invalid dependency
 *   PL6 (7)  Immutability
 *   PL7 (7)  Edge cases
 *   PL8 (6)  Never-throw contract
 */

import { describe, it, expect } from 'vitest';
import { Planner } from '../providers/Planner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fresh(): Planner {
  return new Planner();
}

function addOne(
  p: Planner,
  id    = 'step-1',
  title = 'First step',
): ReturnType<Planner['addStep']> {
  return p.addStep({ id, title });
}

// ─── PL1: CRUD lifecycle ──────────────────────────────────────────────────────

describe('PL1: CRUD lifecycle', () => {
  it('PL1-01: addStep returns ok:true', () => {
    const p = fresh();
    expect(addOne(p).ok).toBe(true);
  });

  it('PL1-02: getStep returns the stored step after addStep', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'Alpha' });
    const r = p.getStep('a');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.id).toBe('a');
      expect(r.value.title).toBe('Alpha');
    }
  });

  it('PL1-03: listSteps includes all added steps', () => {
    const p = fresh();
    p.addStep({ id: 'x', title: 'X' });
    p.addStep({ id: 'y', title: 'Y' });
    const ids = p.listSteps().map(s => s.id);
    expect(ids).toContain('x');
    expect(ids).toContain('y');
  });

  it('PL1-04: removeStep returns ok:true', () => {
    const p = fresh();
    p.addStep({ id: 'r', title: 'Remove me' });
    expect(p.removeStep('r').ok).toBe(true);
  });

  it('PL1-05: step is absent from listSteps after removeStep', () => {
    const p = fresh();
    p.addStep({ id: 'del', title: 'Delete' });
    p.removeStep('del');
    expect(p.listSteps().some(s => s.id === 'del')).toBe(false);
  });

  it('PL1-06: clear() empties all steps', () => {
    const p = fresh();
    p.addStep({ id: 'c1', title: 'One' });
    p.addStep({ id: 'c2', title: 'Two' });
    p.clear();
    expect(p.listSteps()).toHaveLength(0);
  });

  it('PL1-07: listSteps returns empty array on a new Planner', () => {
    expect(fresh().listSteps()).toHaveLength(0);
  });

  it('PL1-08: createPlan() clears all existing steps', () => {
    const p = fresh();
    p.addStep({ id: 's1', title: 'Existing' });
    p.createPlan('New plan');
    expect(p.listSteps()).toHaveLength(0);
  });
});

// ─── PL2: Dependency graph ────────────────────────────────────────────────────

describe('PL2: Dependency graph', () => {
  it('PL2-01: step added without dependsOn has an empty dependsOn array', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    const r = p.getStep('a');
    expect(r.ok && r.value.dependsOn).toEqual([]);
  });

  it('PL2-02: step with valid dependsOn is accepted', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    expect(r.ok).toBe(true);
  });

  it('PL2-03: dependsOn ids are preserved in the stored step', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    const r = p.getStep('b');
    expect(r.ok && r.value.dependsOn).toEqual(['a']);
  });

  it('PL2-04: step may depend on multiple existing steps', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B' });
    const r = p.addStep({ id: 'c', title: 'C', dependsOn: ['a', 'b'] });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.dependsOn).toEqual(['a', 'b']);
  });

  it('PL2-05: chain A → B → C (each depends on the previous) is valid', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    const r = p.addStep({ id: 'c', title: 'C', dependsOn: ['b'] });
    expect(r.ok).toBe(true);
  });

  it('PL2-06: listSteps preserves dependsOn for every step', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    const steps = p.listSteps();
    const bStep = steps.find(s => s.id === 'b');
    expect(bStep?.dependsOn).toEqual(['a']);
  });

  it('PL2-07: referencing a removed step id in a new dependsOn fails with INVALID_DEPENDENCY', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.removeStep('a');
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_DEPENDENCY');
  });
});

// ─── PL3: Completion ──────────────────────────────────────────────────────────

describe('PL3: Completion', () => {
  it('PL3-01: completeStep returns ok:true', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    expect(p.completeStep('a').ok).toBe(true);
  });

  it('PL3-02: returned step from completeStep has completed:true', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    const r = p.completeStep('a');
    expect(r.ok && r.value.completed).toBe(true);
  });

  it('PL3-03: getStep reflects completion after completeStep', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.completeStep('a');
    const r = p.getStep('a');
    expect(r.ok && r.value.completed).toBe(true);
  });

  it('PL3-04: newly added step has completed:false', () => {
    const p = fresh();
    const r = p.addStep({ id: 'a', title: 'A' });
    expect(r.ok && r.value.completed).toBe(false);
  });

  it('PL3-05: listSteps reflects completion status', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B' });
    p.completeStep('a');
    const steps = p.listSteps();
    expect(steps.find(s => s.id === 'a')?.completed).toBe(true);
    expect(steps.find(s => s.id === 'b')?.completed).toBe(false);
  });

  it('PL3-06: completing an already-completed step is idempotent (ok:true)', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.completeStep('a');
    const r = p.completeStep('a');
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.completed).toBe(true);
  });

  it('PL3-07: completing one step does not change the completion status of others', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B' });
    p.completeStep('a');
    const r = p.getStep('b');
    expect(r.ok && r.value.completed).toBe(false);
  });
});

// ─── PL4: Duplicate ids ───────────────────────────────────────────────────────

describe('PL4: Duplicate ids', () => {
  it('PL4-01: addStep with a duplicate id returns ok:false', () => {
    const p = fresh();
    p.addStep({ id: 'dup', title: 'First' });
    const r = p.addStep({ id: 'dup', title: 'Second' });
    expect(r.ok).toBe(false);
  });

  it('PL4-02: error code is DUPLICATE_STEP', () => {
    const p = fresh();
    p.addStep({ id: 'dup', title: 'First' });
    const r = p.addStep({ id: 'dup', title: 'Second' });
    expect(!r.ok && r.error.code).toBe('DUPLICATE_STEP');
  });

  it('PL4-03: error message contains the duplicate id', () => {
    const p = fresh();
    p.addStep({ id: 'dup-id', title: 'First' });
    const r = p.addStep({ id: 'dup-id', title: 'Second' });
    expect(!r.ok && r.error.message).toContain('dup-id');
  });

  it('PL4-04: plan step count is unchanged after a duplicate failure', () => {
    const p = fresh();
    p.addStep({ id: 'dup', title: 'First' });
    p.addStep({ id: 'dup', title: 'Second' });
    expect(p.listSteps()).toHaveLength(1);
  });

  it('PL4-05: original step title is preserved after failed duplicate attempt', () => {
    const p = fresh();
    p.addStep({ id: 'dup', title: 'Original' });
    p.addStep({ id: 'dup', title: 'Replacement' });
    const r = p.getStep('dup');
    expect(r.ok && r.value.title).toBe('Original');
  });

  it('PL4-06: two different ids do not conflict', () => {
    const p = fresh();
    const r1 = p.addStep({ id: 'aa', title: 'AA' });
    const r2 = p.addStep({ id: 'bb', title: 'BB' });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(p.listSteps()).toHaveLength(2);
  });

  it('PL4-07: id can be re-registered after removeStep', () => {
    const p = fresh();
    p.addStep({ id: 'reuse', title: 'Original' });
    p.removeStep('reuse');
    const r = p.addStep({ id: 'reuse', title: 'Reused' });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.title).toBe('Reused');
  });
});

// ─── PL5: Invalid dependency ──────────────────────────────────────────────────

describe('PL5: Invalid dependency', () => {
  it('PL5-01: addStep with unknown dependsOn id returns ok:false', () => {
    const p = fresh();
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['phantom'] });
    expect(r.ok).toBe(false);
  });

  it('PL5-02: error code is INVALID_DEPENDENCY', () => {
    const p = fresh();
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['phantom'] });
    expect(!r.ok && r.error.code).toBe('INVALID_DEPENDENCY');
  });

  it('PL5-03: error message contains the invalid dependency id', () => {
    const p = fresh();
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['ghost-step'] });
    expect(!r.ok && r.error.message).toContain('ghost-step');
  });

  it('PL5-04: plan step count is unchanged after an invalid dependency failure', () => {
    const p = fresh();
    p.addStep({ id: 'b', title: 'B', dependsOn: ['missing'] });
    expect(p.listSteps()).toHaveLength(0);
  });

  it('PL5-05: self-referential dependency → INVALID_DEPENDENCY (step not yet registered)', () => {
    const p = fresh();
    const r = p.addStep({ id: 'self', title: 'Self', dependsOn: ['self'] });
    expect(!r.ok && r.error.code).toBe('INVALID_DEPENDENCY');
  });

  it('PL5-06: multiple deps where one is invalid → entire addStep fails atomically', () => {
    const p = fresh();
    p.addStep({ id: 'valid', title: 'Valid' });
    const r = p.addStep({ id: 'b', title: 'B', dependsOn: ['valid', 'missing'] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_DEPENDENCY');
    expect(p.listSteps()).toHaveLength(1); // only 'valid' remains
  });

  it('PL5-07: referencing a previously removed step in dependsOn → INVALID_DEPENDENCY', () => {
    const p = fresh();
    p.addStep({ id: 'first', title: 'First' });
    p.removeStep('first');
    const r = p.addStep({ id: 'second', title: 'Second', dependsOn: ['first'] });
    expect(!r.ok && r.error.code).toBe('INVALID_DEPENDENCY');
  });
});

// ─── PL6: Immutability ────────────────────────────────────────────────────────

describe('PL6: Immutability', () => {
  it('PL6-01: mutating the returned step from addStep does not affect the stored step', () => {
    const p = fresh();
    const r = p.addStep({ id: 'a', title: 'Alpha' });
    if (r.ok) r.value.title = 'MUTATED';
    const stored = p.getStep('a');
    expect(stored.ok && stored.value.title).toBe('Alpha');
  });

  it('PL6-02: mutating the returned step from getStep does not affect the stored step', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'Alpha' });
    const r1 = p.getStep('a');
    if (r1.ok) r1.value.title = 'MUTATED';
    const r2 = p.getStep('a');
    expect(r2.ok && r2.value.title).toBe('Alpha');
  });

  it('PL6-03: mutating a step from listSteps does not affect the stored step', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'Alpha' });
    const [step] = p.listSteps();
    step!.title = 'MUTATED';
    expect(p.getStep('a').ok && (p.getStep('a') as any).value.title).toBe('Alpha');
  });

  it('PL6-04: mutating dependsOn from getStep result does not affect stored step', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'b', title: 'B', dependsOn: ['a'] });
    const r = p.getStep('b');
    if (r.ok) r.value.dependsOn.push('injected');
    const r2 = p.getStep('b');
    expect(r2.ok && r2.value.dependsOn).toEqual(['a']);
  });

  it('PL6-05: two calls to getStep return independent copies', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' });
    const r1 = p.getStep('a');
    const r2 = p.getStep('a');
    expect(r1).not.toBe(r2);
    if (r1.ok && r2.ok) expect(r1.value).not.toBe(r2.value);
  });

  it('PL6-06: mutating the input object after addStep does not corrupt stored step', () => {
    const p = fresh();
    const input: Parameters<typeof p.addStep>[0] = { id: 'a', title: 'Alpha', dependsOn: [] };
    p.addStep(input);
    input.title = 'MUTATED';
    input.dependsOn!.push('injected');
    const r = p.getStep('a');
    expect(r.ok && r.value.title).toBe('Alpha');
    expect(r.ok && r.value.dependsOn).toEqual([]);
  });

  it('PL6-07: createPlan() makes previously returned snapshots independent of the new state', () => {
    const p = fresh();
    p.addStep({ id: 'old', title: 'Old' });
    const snapshot = p.listSteps();
    p.createPlan('Fresh');
    // snapshot is still valid; new state is empty
    expect(snapshot).toHaveLength(1);
    expect(p.listSteps()).toHaveLength(0);
  });
});

// ─── PL7: Edge cases ──────────────────────────────────────────────────────────

describe('PL7: Edge cases', () => {
  it('PL7-01: empty id string → INVALID_INPUT', () => {
    const r = fresh().addStep({ id: '', title: 'X' });
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('PL7-02: empty title string → INVALID_INPUT', () => {
    const r = fresh().addStep({ id: 'a', title: '' });
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('PL7-03: whitespace-only id → INVALID_INPUT', () => {
    const r = fresh().addStep({ id: '   ', title: 'X' });
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('PL7-04: whitespace-only title → INVALID_INPUT', () => {
    const r = fresh().addStep({ id: 'a', title: '\t\n' });
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('PL7-05: steps are returned in insertion order by listSteps', () => {
    const p = fresh();
    p.addStep({ id: 'z', title: 'Z' });
    p.addStep({ id: 'a', title: 'A' });
    p.addStep({ id: 'm', title: 'M' });
    expect(p.listSteps().map(s => s.id)).toEqual(['z', 'a', 'm']);
  });

  it('PL7-06: two Planner instances are fully independent', () => {
    const p1 = new Planner();
    const p2 = new Planner();
    p1.addStep({ id: 'only-in-p1', title: 'X' });
    expect(p2.listSteps()).toHaveLength(0);
  });

  it('PL7-07: description defaults to empty string when not provided', () => {
    const p = fresh();
    p.addStep({ id: 'a', title: 'A' }); // no description
    const r = p.getStep('a');
    expect(r.ok && r.value.description).toBe('');
  });
});

// ─── PL8: Never-throw contract ────────────────────────────────────────────────

describe('PL8: Never-throw contract', () => {
  it('PL8-01: addStep never throws for any input', () => {
    const p = fresh();
    expect(() => p.addStep({ id: '', title: '' })).not.toThrow();
    expect(() => p.addStep({ id: 'ok', title: 'OK', dependsOn: ['missing'] })).not.toThrow();
    expect(() => p.addStep({ id: 'ok', title: 'OK' })).not.toThrow();
    expect(() => p.addStep({ id: 'ok', title: 'Dup' })).not.toThrow(); // duplicate
  });

  it('PL8-02: getStep never throws for unknown ids', () => {
    const p = fresh();
    expect(() => p.getStep('no-such-step')).not.toThrow();
    expect(() => p.getStep('')).not.toThrow();
  });

  it('PL8-03: removeStep never throws for unknown ids', () => {
    const p = fresh();
    expect(() => p.removeStep('ghost')).not.toThrow();
    expect(() => p.removeStep('')).not.toThrow();
  });

  it('PL8-04: completeStep never throws for unknown ids', () => {
    const p = fresh();
    expect(() => p.completeStep('missing')).not.toThrow();
    expect(() => p.completeStep('')).not.toThrow();
  });

  it('PL8-05: listSteps never throws on any Planner state', () => {
    const p = fresh();
    expect(() => p.listSteps()).not.toThrow();
    p.addStep({ id: 'a', title: 'A' });
    expect(() => p.listSteps()).not.toThrow();
    p.clear();
    expect(() => p.listSteps()).not.toThrow();
  });

  it('PL8-06: createPlan never throws', () => {
    const p = fresh();
    expect(() => p.createPlan()).not.toThrow();
    expect(() => p.createPlan('New title')).not.toThrow();
    expect(() => p.createPlan('')).not.toThrow();
  });
});
