/**
 * P6-10T: WorkflowEngine test suite — 56 tests across 12 groups (WE1–WE12).
 *
 * Groups:
 *   WE1  (5)  CRUD lifecycle
 *   WE2  (5)  Dependency graph validation
 *   WE3  (5)  Topological ordering
 *   WE4  (5)  Cycle detection
 *   WE5  (6)  Execution
 *   WE6  (4)  Planner integration
 *   WE7  (5)  Runtime integration
 *   WE8  (5)  Memory integration
 *   WE9  (4)  Tool integration
 *   WE10 (5)  Edge cases
 *   WE11 (4)  Immutability
 *   WE12 (3)  Never-throw
 */

import { describe, it, expect, vi } from 'vitest';

import {
  WorkflowEngine,
  type WorkflowDefinition,
  type WorkflowStep,
} from '../providers/WorkflowEngine';

import { AgentRuntime }   from '../providers/AgentRuntime';
import { Planner }        from '../providers/Planner';
import { SessionManager } from '../providers/SessionManager';
import { MemoryStore }    from '../providers/MemoryStore';
import type { ToolExecutor } from '../providers/ToolExecutor';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeStep(
  overrides: Partial<WorkflowStep> & Pick<WorkflowStep, 'id'>,
): WorkflowStep {
  return {
    title:  `Title-${overrides.id}`,
    prompt: `Prompt-${overrides.id}`,
    ...overrides,
  };
}

function makeWorkflow(
  id:    string,
  steps: WorkflowStep[],
  name?: string,
): WorkflowDefinition {
  return { id, name: name ?? `Workflow-${id}`, steps };
}

function makeMockRuntime(
  result: Record<string, unknown> = { ok: true, content: 'done' },
): AgentRuntime {
  return {
    run: vi.fn().mockResolvedValue(result),
  } as unknown as AgentRuntime;
}

// ─── WE1: CRUD lifecycle (5) ──────────────────────────────────────────────────

describe('WE1 CRUD lifecycle', () => {
  it('WE1-01: registerWorkflow returns ok:true with the workflow id', () => {
    const engine = new WorkflowEngine();
    const result = engine.registerWorkflow(makeWorkflow('wf-1', []));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('wf-1');
  });

  it('WE1-02: getWorkflow returns the definition after registration', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = engine.getWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('wf-1');
      expect(result.value.steps).toHaveLength(1);
    }
  });

  it('WE1-03: removeWorkflow returns ok:true', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = engine.removeWorkflow('wf-1');
    expect(result.ok).toBe(true);
  });

  it('WE1-04: listWorkflows includes all registered workflows', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-a', []));
    engine.registerWorkflow(makeWorkflow('wf-b', []));
    const list = engine.listWorkflows();
    expect(list).toHaveLength(2);
    expect(list.map(w => w.id).sort()).toEqual(['wf-a', 'wf-b']);
  });

  it('WE1-05: listWorkflows is empty on a new engine', () => {
    const engine = new WorkflowEngine();
    expect(engine.listWorkflows()).toHaveLength(0);
  });
});

// ─── WE2: Dependency graph validation (5) ─────────────────────────────────────

describe('WE2 Dependency graph validation', () => {
  it('WE2-01: workflow with steps that have no dependsOn registers successfully', () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 'a' }), makeStep({ id: 'b' })];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(true);
  });

  it('WE2-02: workflow with valid inter-step dependencies registers successfully', () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a' }),
      makeStep({ id: 'b', dependsOn: ['a'] }),
    ];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(true);
  });

  it('WE2-03: INVALID_DEPENDENCY when step references an unknown step id', () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 'a', dependsOn: ['ghost'] })];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_DEPENDENCY');
  });

  it('WE2-04: workflow is not stored after INVALID_DEPENDENCY', () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 'a', dependsOn: ['ghost'] })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(engine.listWorkflows()).toHaveLength(0);
  });

  it('WE2-05: INVALID_DEPENDENCY error message contains the unknown dep id', () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 'a', dependsOn: ['missing-step'] })];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('missing-step');
  });
});

// ─── WE3: Topological ordering (5) ───────────────────────────────────────────

describe('WE3 Topological ordering', () => {
  it('WE3-01: single-step workflow executes and completes', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.completedSteps).toContain('s1');
  });

  it('WE3-02: two independent steps both appear in completedSteps', async () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 'a' }), makeStep({ id: 'b' })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completedSteps).toContain('a');
      expect(result.value.completedSteps).toContain('b');
    }
  });

  it('WE3-03: dependent step executes after its prerequisite', async () => {
    const callOrder: string[] = [];
    const runtime = {
      run: vi.fn().mockImplementation(async (prompt: string) => {
        callOrder.push(prompt);
        return { ok: true, content: 'done' };
      }),
    } as unknown as AgentRuntime;

    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a', prompt: 'Run-A' }),
      makeStep({ id: 'b', prompt: 'Run-B', dependsOn: ['a'] }),
    ];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    await engine.executeWorkflow('wf-1', { agentRuntime: runtime });

    expect(callOrder.indexOf('Run-A')).toBeLessThan(callOrder.indexOf('Run-B'));
  });

  it('WE3-04: chain A→B→C completes all three steps in order', async () => {
    const callOrder: string[] = [];
    const runtime = {
      run: vi.fn().mockImplementation(async (prompt: string) => {
        callOrder.push(prompt);
        return { ok: true, content: 'done' };
      }),
    } as unknown as AgentRuntime;

    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a', prompt: 'A' }),
      makeStep({ id: 'b', prompt: 'B', dependsOn: ['a'] }),
      makeStep({ id: 'c', prompt: 'C', dependsOn: ['b'] }),
    ];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    const result = await engine.executeWorkflow('wf-1', { agentRuntime: runtime });

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual(['A', 'B', 'C']);
  });

  it('WE3-05: completedSteps includes all step ids after diamond execution', async () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'x' }),
      makeStep({ id: 'y', dependsOn: ['x'] }),
      makeStep({ id: 'z', dependsOn: ['x'] }),
    ];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    const result = await engine.executeWorkflow('wf-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.value.completedSteps].sort()).toEqual(['x', 'y', 'z']);
    }
  });
});

// ─── WE4: Cycle detection (5) ─────────────────────────────────────────────────

describe('WE4 Cycle detection', () => {
  it('WE4-01: self-referential dependsOn → CIRCULAR_DEPENDENCY', () => {
    const engine = new WorkflowEngine();
    const result = engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 'a', dependsOn: ['a'] })]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
  });

  it('WE4-02: mutual cycle A depends on B, B depends on A → CIRCULAR_DEPENDENCY', () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a', dependsOn: ['b'] }),
      makeStep({ id: 'b', dependsOn: ['a'] }),
    ];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
  });

  it('WE4-03: error code is CIRCULAR_DEPENDENCY (not INVALID_DEPENDENCY)', () => {
    const engine = new WorkflowEngine();
    const result = engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 'a', dependsOn: ['a'] })]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
      expect(result.error.code).not.toBe('INVALID_DEPENDENCY');
    }
  });

  it('WE4-04: workflow is not stored after cycle detection', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 'a', dependsOn: ['a'] })]),
    );
    expect(engine.listWorkflows()).toHaveLength(0);
  });

  it('WE4-05: three-node cycle A→B→C→A → CIRCULAR_DEPENDENCY', () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a', dependsOn: ['c'] }),
      makeStep({ id: 'b', dependsOn: ['a'] }),
      makeStep({ id: 'c', dependsOn: ['b'] }),
    ];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
  });
});

// ─── WE5: Execution (6) ───────────────────────────────────────────────────────

describe('WE5 Execution', () => {
  it('WE5-01: executeWorkflow returns ok:true for valid workflow', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
  });

  it('WE5-02: execution status is COMPLETED on success', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1');
    if (result.ok) expect(result.value.status).toBe('COMPLETED');
  });

  it('WE5-03: startedAt is a positive timestamp', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = await engine.executeWorkflow('wf-1');
    if (result.ok) expect(result.value.startedAt).toBeGreaterThan(0);
  });

  it('WE5-04: completedAt is set after execution', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = await engine.executeWorkflow('wf-1');
    if (result.ok) expect(result.value.completedAt).toBeGreaterThan(0);
  });

  it('WE5-05: executionId is a non-empty string', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = await engine.executeWorkflow('wf-1');
    if (result.ok) {
      expect(typeof result.value.executionId).toBe('string');
      expect(result.value.executionId.length).toBeGreaterThan(0);
    }
  });

  it('WE5-06: WORKFLOW_NOT_FOUND for unknown workflow id', async () => {
    const engine = new WorkflowEngine();
    const result = await engine.executeWorkflow('ghost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('WORKFLOW_NOT_FOUND');
  });
});

// ─── WE6: Planner integration (4) ─────────────────────────────────────────────

describe('WE6 Planner integration', () => {
  it('WE6-01: planner.createPlan is called with the workflow name', async () => {
    const engine  = new WorkflowEngine();
    const planner = new Planner();
    const spy     = vi.spyOn(planner, 'createPlan');
    engine.registerWorkflow(makeWorkflow('wf-1', [], 'My Plan'));
    await engine.executeWorkflow('wf-1', { planner });
    expect(spy).toHaveBeenCalledWith('My Plan');
  });

  it('WE6-02: planner.addStep is called once for each workflow step', async () => {
    const engine  = new WorkflowEngine();
    const planner = new Planner();
    const spy     = vi.spyOn(planner, 'addStep');
    const steps   = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    await engine.executeWorkflow('wf-1', { planner });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('WE6-03: planner.completeStep is called after each step executes', async () => {
    const engine  = new WorkflowEngine();
    const planner = new Planner();
    const spy     = vi.spyOn(planner, 'completeStep');
    const steps   = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    await engine.executeWorkflow('wf-1', { planner });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('WE6-04: all planner steps are marked completed after execution', async () => {
    const engine  = new WorkflowEngine();
    const planner = new Planner();
    const steps   = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    await engine.executeWorkflow('wf-1', { planner });
    const planSteps = planner.listSteps();
    expect(planSteps.every(s => s.completed)).toBe(true);
  });
});

// ─── WE7: Runtime integration (5) ─────────────────────────────────────────────

describe('WE7 Runtime integration', () => {
  it('WE7-01: agentRuntime.run is called once per step', async () => {
    const engine  = new WorkflowEngine();
    const runtime = makeMockRuntime();
    const steps   = [makeStep({ id: 'a' }), makeStep({ id: 'b' })];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    await engine.executeWorkflow('wf-1', { agentRuntime: runtime });
    expect(runtime.run as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2);
  });

  it('WE7-02: step.prompt is passed to agentRuntime.run', async () => {
    const engine  = new WorkflowEngine();
    const runtime = makeMockRuntime();
    engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 's1', prompt: 'Do the thing' })]),
    );
    await engine.executeWorkflow('wf-1', { agentRuntime: runtime });
    expect(runtime.run as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('Do the thing');
  });

  it('WE7-03: EXECUTION_FAILED when agentRuntime.run returns ok:false', async () => {
    const engine  = new WorkflowEngine();
    const runtime = makeMockRuntime({
      ok:    false,
      error: { code: 'PROVIDER_ERROR', message: 'API down' },
    });
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1', { agentRuntime: runtime });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EXECUTION_FAILED');
  });

  it('WE7-04: workflowId is correctly set in the execution result', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-alpha', []));
    const result = await engine.executeWorkflow('wf-alpha');
    if (result.ok) expect(result.value.workflowId).toBe('wf-alpha');
  });

  it('WE7-05: no agentRuntime (dry run) still completes execution with all steps', async () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 'a' }),
      makeStep({ id: 'b', dependsOn: ['a'] }),
    ];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('COMPLETED');
      expect(result.value.completedSteps).toHaveLength(2);
    }
  });
});

// ─── WE8: Memory integration (5) ──────────────────────────────────────────────

describe('WE8 Memory integration', () => {
  it('WE8-01: memoryStore.saveMemory is called after successful execution', async () => {
    const engine      = new WorkflowEngine();
    const memoryStore = new MemoryStore();
    const spy         = vi.spyOn(memoryStore, 'saveMemory');
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    await engine.executeWorkflow('wf-1', { memoryStore });
    expect(spy).toHaveBeenCalled();
  });

  it('WE8-02: memoryStore saves under the executionId as the session key', async () => {
    const engine      = new WorkflowEngine();
    const memoryStore = new MemoryStore();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = await engine.executeWorkflow('wf-1', { memoryStore });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const snap = memoryStore.loadMemory(result.value.executionId);
      expect(snap.ok).toBe(true);
    }
  });

  it('WE8-03: no memoryStore → execution completes normally', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
  });

  it('WE8-04: sessionManager.createSession is called when provided', async () => {
    const engine         = new WorkflowEngine();
    const sessionManager = new SessionManager();
    const spy            = vi.spyOn(sessionManager, 'createSession');
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    await engine.executeWorkflow('wf-1', { sessionManager });
    expect(spy).toHaveBeenCalled();
  });

  it('WE8-05: sessionManager.completeSession is called on successful execution', async () => {
    const engine         = new WorkflowEngine();
    const sessionManager = new SessionManager();
    const spy            = vi.spyOn(sessionManager, 'completeSession');
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    await engine.executeWorkflow('wf-1', { sessionManager });
    expect(spy).toHaveBeenCalled();
  });
});

// ─── WE9: Tool integration (4) ────────────────────────────────────────────────

describe('WE9 Tool integration', () => {
  it('WE9-01: workflow with steps that have useTools:true registers successfully', () => {
    const engine = new WorkflowEngine();
    const steps  = [makeStep({ id: 's1', useTools: true })];
    const result = engine.registerWorkflow(makeWorkflow('wf-1', steps));
    expect(result.ok).toBe(true);
  });

  it('WE9-02: useTools and useMemory flags are preserved in the stored definition', () => {
    const engine = new WorkflowEngine();
    const steps  = [
      makeStep({ id: 's1', useTools: true,  useMemory: false }),
      makeStep({ id: 's2', useTools: false, useMemory: true  }),
    ];
    engine.registerWorkflow(makeWorkflow('wf-1', steps));
    const result = engine.getWorkflow('wf-1');
    if (result.ok) {
      expect(result.value.steps[0].useTools).toBe(true);
      expect(result.value.steps[0].useMemory).toBe(false);
      expect(result.value.steps[1].useTools).toBe(false);
      expect(result.value.steps[1].useMemory).toBe(true);
    }
  });

  it('WE9-03: execution with toolExecutor in options completes normally', async () => {
    const engine       = new WorkflowEngine();
    const toolExecutor = { execute: vi.fn() } as unknown as ToolExecutor;
    engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 's1', useTools: true })]),
    );
    const result = await engine.executeWorkflow('wf-1', { toolExecutor });
    expect(result.ok).toBe(true);
  });

  it('WE9-04: no toolExecutor → execution still completes successfully', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(
      makeWorkflow('wf-1', [makeStep({ id: 's1', useTools: true })]),
    );
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
  });
});

// ─── WE10: Edge cases (5) ─────────────────────────────────────────────────────

describe('WE10 Edge cases', () => {
  it('WE10-01: workflow with 0 steps executes with empty completedSteps', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.completedSteps).toHaveLength(0);
  });

  it('WE10-02: DUPLICATE_WORKFLOW when same id is registered twice', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const result = engine.registerWorkflow(makeWorkflow('wf-1', []));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_WORKFLOW');
  });

  it('WE10-03: DUPLICATE_WORKFLOW message references the duplicate id', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-dup', []));
    const result = engine.registerWorkflow(makeWorkflow('wf-dup', []));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DUPLICATE_WORKFLOW');
      expect(result.error.message).toContain('wf-dup');
    }
  });

  it('WE10-04: INVALID_INPUT for empty string workflow id', () => {
    const engine = new WorkflowEngine();
    const result = engine.registerWorkflow({ id: '', name: 'X', steps: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('WE10-05: removeWorkflow then re-register same id succeeds', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    engine.removeWorkflow('wf-1');
    const result = engine.registerWorkflow(makeWorkflow('wf-1', []));
    expect(result.ok).toBe(true);
  });
});

// ─── WE11: Immutability (4) ───────────────────────────────────────────────────

describe('WE11 Immutability', () => {
  it('WE11-01: mutating getWorkflow result does not affect stored definition', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const r1 = engine.getWorkflow('wf-1');
    if (r1.ok) {
      r1.value.steps.push(makeStep({ id: 'injected' }));
    }
    const r2 = engine.getWorkflow('wf-1');
    if (r2.ok) expect(r2.value.steps).toHaveLength(1);
  });

  it('WE11-02: mutating listWorkflows result does not affect stored definitions', () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', []));
    const list = engine.listWorkflows();
    list[0].name = 'MUTATED';
    const list2 = engine.listWorkflows();
    expect(list2[0].name).not.toBe('MUTATED');
  });

  it('WE11-03: mutating input definition after registerWorkflow does not corrupt stored', () => {
    const engine = new WorkflowEngine();
    const def    = makeWorkflow('wf-1', [makeStep({ id: 'orig' })]);
    engine.registerWorkflow(def);
    def.steps.push(makeStep({ id: 'extra' }));
    const r = engine.getWorkflow('wf-1');
    if (r.ok) expect(r.value.steps).toHaveLength(1);
  });

  it('WE11-04: completedSteps in execution result is an independent copy', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const original = result.value.completedSteps.length;
      result.value.completedSteps.push('injected');
      // A second execution should still see exactly 1 completed step
      const result2 = await engine.executeWorkflow('wf-1');
      if (result2.ok) expect(result2.value.completedSteps).toHaveLength(original);
    }
  });
});

// ─── WE12: Never-throw (3) ────────────────────────────────────────────────────

describe('WE12 Never-throw', () => {
  it('WE12-01: registerWorkflow never throws for any edge-case input', () => {
    const engine = new WorkflowEngine();
    const cases  = [
      undefined,
      null,
      {},
      { id: '', name: '', steps: null },
      { id: 'x', name: 'y', steps: [{ id: '', title: '', prompt: '' }] },
    ] as unknown[];
    for (const input of cases) {
      expect(() =>
        engine.registerWorkflow(input as WorkflowDefinition),
      ).not.toThrow();
    }
  });

  it('WE12-02: executeWorkflow never rejects when agentRuntime throws', async () => {
    const engine  = new WorkflowEngine();
    const runtime = {
      run: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as AgentRuntime;
    engine.registerWorkflow(makeWorkflow('wf-1', [makeStep({ id: 's1' })]));
    const result = await engine.executeWorkflow('wf-1', { agentRuntime: runtime });
    expect(result).toBeDefined();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EXECUTION_FAILED');
  });

  it('WE12-03: all CRUD operations never throw for edge-case inputs', () => {
    const engine = new WorkflowEngine();
    const ops = [
      () => engine.getWorkflow(''),
      () => engine.getWorkflow('ghost'),
      () => engine.removeWorkflow(''),
      () => engine.removeWorkflow('ghost'),
      () => engine.listWorkflows(),
    ];
    for (const op of ops) {
      expect(op).not.toThrow();
    }
  });
});
